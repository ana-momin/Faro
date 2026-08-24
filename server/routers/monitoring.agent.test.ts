import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMonitor: vi.fn(),
  getMonitorForUser: vi.fn(),
  listMonitorsWithSync: vi.fn(),
  suggestCriteria: vi.fn(),
  syncMonitorRecord: vi.fn(),
  classifySyncFailure: vi.fn(),
  updateMonitorStatus: vi.fn(),
}));

vi.mock("../db", () => ({
  createMonitor: mocks.createMonitor,
  getMonitorForUser: mocks.getMonitorForUser,
  listMonitorsWithSync: mocks.listMonitorsWithSync,
  updateMonitorStatus: mocks.updateMonitorStatus,
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
  it("maps, saves, and checks a single user-requested service brief", async () => {
    mocks.suggestCriteria.mockResolvedValueOnce(criteria);
    mocks.listMonitorsWithSync.mockResolvedValueOnce([{ monitor: { id: 13, status: "active" } }]);
    mocks.updateMonitorStatus.mockResolvedValueOnce(undefined);
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
    expect(mocks.updateMonitorStatus).toHaveBeenCalledWith(13, 7, "paused");
    expect(mocks.syncMonitorRecord).toHaveBeenCalledWith({ id: 42 });
    expect(result).toMatchObject({ monitorId: 42, humanReviewOnly: true, syncError: null, sourceStatus: "healthy" });
  });

  it("keeps the saved brief and reports sync trouble without taking external action", async () => {
    mocks.suggestCriteria.mockResolvedValueOnce(criteria);
    mocks.listMonitorsWithSync.mockResolvedValueOnce([]);
    mocks.createMonitor.mockResolvedValueOnce(43);
    mocks.getMonitorForUser.mockResolvedValueOnce({ id: 43 });
    mocks.syncMonitorRecord.mockRejectedValueOnce(new Error("source unavailable"));
    mocks.classifySyncFailure.mockReturnValueOnce({ status: "error", label: "Sync needs attention" });

    const caller = monitoringRouter.createCaller({ user } as any);
    const result = await caller.agentStart({ brief: "Operators who need a provider for AI video production" });

    expect(result).toMatchObject({ monitorId: 43, humanReviewOnly: true, sync: null, syncError: "source unavailable", sourceStatus: "error" });
  });
});
