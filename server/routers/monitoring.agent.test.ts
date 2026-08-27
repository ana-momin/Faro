import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMonitor: vi.fn(),
  getMonitorForUser: vi.fn(),
  countActiveMonitorsForUser: vi.fn(),
  suggestCriteria: vi.fn(),
  syncMonitorRecord: vi.fn(),
  classifySyncFailure: vi.fn(),
  updateMonitorStatus: vi.fn(),
  getProviderConnectionForUser: vi.fn(),
  countMonitorSyncRunsForUserSince: vi.fn(),
  listMonitorQueryStates: vi.fn(),
  listMonitorsWithSync: vi.fn(),
}));

vi.mock("../db", () => ({
  createMonitor: mocks.createMonitor,
  getMonitorForUser: mocks.getMonitorForUser,
  countActiveMonitorsForUser: mocks.countActiveMonitorsForUser,
  updateMonitorStatus: mocks.updateMonitorStatus,
  getProviderConnectionForUser: mocks.getProviderConnectionForUser,
  countMonitorSyncRunsForUserSince: mocks.countMonitorSyncRunsForUserSince,
  listMonitorQueryStates: mocks.listMonitorQueryStates,
  listMonitorsWithSync: mocks.listMonitorsWithSync,
}));
vi.mock("../monitoring/ai", () => ({ suggestCriteria: mocks.suggestCriteria }));
vi.mock("../monitoring/sync", () => ({ syncMonitorRecord: mocks.syncMonitorRecord, classifySyncFailure: mocks.classifySyncFailure }));

import { monitoringRouter } from "./monitoring";

const user = { id: 7, openId: "owner", name: "Owner", email: "owner@example.com", role: "user" };
const criteria = {
  includeTerms: ["automation"],
  excludeTerms: ["job"],
  categories: ["service request"],
  xQuery: 'automation "need someone" -job -is:retweet',
  rationale: "Service request intent",
  model: "gpt-5-mini",
  fallback: false,
};

describe("monitoring.agentStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProviderConnectionForUser.mockResolvedValue({ provider: "twitterapi_io", dailyRequestLimit: 20 });
    mocks.countMonitorSyncRunsForUserSince.mockResolvedValue(0);
    mocks.listMonitorQueryStates.mockResolvedValue([]);
    mocks.listMonitorsWithSync.mockResolvedValue([]);
  });

  it("maps, saves, and checks a single user-requested service brief", async () => {
    mocks.suggestCriteria.mockResolvedValueOnce(criteria);
    mocks.countActiveMonitorsForUser.mockResolvedValueOnce(1);
    mocks.createMonitor.mockResolvedValueOnce(42);
    mocks.getMonitorForUser.mockResolvedValueOnce({ id: 42 });
    mocks.syncMonitorRecord.mockResolvedValueOnce({ inserted: 3 });

    const caller = monitoringRouter.createCaller({ user } as any);
    const result = await caller.agentStart({ brief: "Founders who need someone to automate client intake" });

    expect(mocks.createMonitor).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      status: "active",
      categories: ["service request", "human review", "agent-assisted"],
      xQuery: expect.stringContaining("need someone"),
    }));
    expect(mocks.updateMonitorStatus).not.toHaveBeenCalled();
    expect(mocks.syncMonitorRecord).toHaveBeenCalledWith({ id: 42 });
    expect(result).toMatchObject({ monitorId: 42, humanReviewOnly: true, syncError: null, sourceStatus: "healthy", monitorCapacity: { active: 1, limit: 5 } });
  });

  it("keeps the saved brief and reports sync trouble without taking external action", async () => {
    mocks.suggestCriteria.mockResolvedValueOnce(criteria);
    mocks.countActiveMonitorsForUser.mockResolvedValueOnce(0);
    mocks.createMonitor.mockResolvedValueOnce(43);
    mocks.getMonitorForUser.mockResolvedValueOnce({ id: 43 });
    mocks.syncMonitorRecord.mockRejectedValueOnce(new Error("source unavailable"));
    mocks.classifySyncFailure.mockReturnValueOnce({ status: "error", label: "Sync needs attention" });

    const caller = monitoringRouter.createCaller({ user } as any);
    const result = await caller.agentStart({ brief: "Operators who need a provider for AI video production" });

    expect(result).toMatchObject({ monitorId: 43, humanReviewOnly: true, sync: null, syncError: "source unavailable", sourceStatus: "error" });
  });

  it("protects provider cost by refusing another active monitor at the configured capacity", async () => {
    mocks.suggestCriteria.mockResolvedValueOnce(criteria);
    mocks.countActiveMonitorsForUser.mockResolvedValueOnce(5);

    const caller = monitoringRouter.createCaller({ user } as any);

    await expect(caller.agentStart({ brief: "Founders who need an expert to build an AI workflow" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Pause an existing saved search"),
    });
    expect(mocks.createMonitor).not.toHaveBeenCalled();
  });

  it("blocks a new search before criteria generation when the daily source-call limit is exhausted", async () => {
    mocks.getProviderConnectionForUser.mockResolvedValueOnce({ provider: "twitterapi_io", dailyRequestLimit: 1 });
    mocks.countMonitorSyncRunsForUserSince.mockResolvedValueOnce(1);
    const caller = monitoringRouter.createCaller({ user } as any);

    await expect(caller.agentStart({ brief: "Founders who need someone to automate their customer intake" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Today’s provider limit of 1 source call has been reached"),
    });
    expect(mocks.suggestCriteria).not.toHaveBeenCalled();
    expect(mocks.createMonitor).not.toHaveBeenCalled();
  });

  it("reopens an exact saved brief without consuming another provider call or creating a duplicate monitor", async () => {
    mocks.listMonitorsWithSync.mockResolvedValueOnce([{ monitor: { id: 55, goal: "Founders who need someone to automate client intake" } }]);
    const caller = monitoringRouter.createCaller({ user } as any);

    await expect(caller.agentStart({ brief: "  Founders who need someone to automate client intake  " })).resolves.toMatchObject({
      monitorId: 55,
      reused: true,
      sync: null,
      sourceLabel: "Saved result set",
    });
    expect(mocks.suggestCriteria).not.toHaveBeenCalled();
    expect(mocks.createMonitor).not.toHaveBeenCalled();
    expect(mocks.syncMonitorRecord).not.toHaveBeenCalled();
  });

  it("continues only a saved cursor for the same saved search, including a manually reopened paused search", async () => {
    mocks.getMonitorForUser.mockResolvedValue({ id: 42, status: "paused" });
    mocks.listMonitorQueryStates.mockResolvedValue([{ nextToken: "next-page" }]);
    mocks.syncMonitorRecord.mockResolvedValueOnce({ inserted: 2, hasMore: true });
    const caller = monitoringRouter.createCaller({ user } as any);

    await expect(caller.continuation({ monitorId: 42 })).resolves.toEqual({ available: true });
    await expect(caller.continueSearch({ monitorId: 42 })).resolves.toMatchObject({ monitorId: 42, inserted: 2, hasMore: true });
    expect(mocks.syncMonitorRecord).toHaveBeenCalledWith({ id: 42, status: "paused" }, { mode: "continue" });
  });
});
