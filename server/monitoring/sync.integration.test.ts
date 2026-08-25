import { beforeEach, describe, expect, it, vi } from "vitest";
import { XApiError } from "./xClient";

const mocks = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  listMonitorQueryStates: vi.fn(),
  countMonitorSyncRunsSince: vi.fn(),
  saveMonitorQueryState: vi.fn(),
  recordMonitorSyncRun: vi.fn(),
  recordSync: vi.fn(),
  fetchPublicPosts: vi.fn(),
  upsertFilteredStreamRule: vi.fn(),
  persistNormalizedPost: vi.fn(),
}));

vi.mock("../db", () => ({
  getSyncState: mocks.getSyncState,
  listMonitorQueryStates: mocks.listMonitorQueryStates,
  countMonitorSyncRunsSince: mocks.countMonitorSyncRunsSince,
  saveMonitorQueryState: mocks.saveMonitorQueryState,
  recordMonitorSyncRun: mocks.recordMonitorSyncRun,
  recordSync: mocks.recordSync,
  listActiveMonitors: vi.fn(),
  listActiveMonitorsForPolling: vi.fn(),
}));

vi.mock("./xClient", async importOriginal => {
  const actual = await importOriginal<typeof import("./xClient")>();
  return { ...actual, fetchPublicPosts: mocks.fetchPublicPosts, upsertFilteredStreamRule: mocks.upsertFilteredStreamRule };
});

vi.mock("./ingest", () => ({ persistNormalizedPost: mocks.persistNormalizedPost }));

import { fetchCreditAwarePosts, syncMonitorRecord } from "./sync";

const monitor = {
  id: 17,
  userId: 3,
  name: "Integration test monitor",
  goal: "Find people asking for help building business automation workflows",
  xQuery: "automation -is:retweet",
  includeTerms: ["automation"],
  excludeTerms: [],
  categories: ["test"],
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sourceResult = (posts: Array<{ id: string; text: string }>, nextToken?: string, queueWaitMs = 0, providerAttempts = 1) => ({
  posts,
  users: [],
  newestId: posts[0]?.id,
  nextToken,
  source: "twitterapi_io" as const,
  latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
  queueWaitMs,
  providerAttempts,
});

const smallPolicy = { maxProviderCallsPerSync: 4, maxPagesPerFamily: 2, maxQueryFamiliesPerSync: 3 };

describe("bounded multi-family sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSyncState.mockResolvedValue(undefined);
    mocks.listMonitorQueryStates.mockResolvedValue([]);
    mocks.countMonitorSyncRunsSince.mockResolvedValue(0);
    mocks.saveMonitorQueryState.mockResolvedValue(undefined);
    mocks.recordMonitorSyncRun.mockResolvedValue(undefined);
    mocks.recordSync.mockResolvedValue(undefined);
    mocks.persistNormalizedPost.mockResolvedValue(undefined);
  });

  it("checks every named query family before spending a continuation page and deduplicates across families", async () => {
    mocks.fetchPublicPosts
      .mockResolvedValueOnce(sourceResult([{ id: "direct-one", text: "Looking for someone to build automation for our business." }, { id: "shared", text: "Need someone to automate our operations workflow." }], "direct-next", 12))
      .mockResolvedValueOnce(sourceResult([{ id: "shared", text: "Need someone to automate our operations workflow." }, { id: "recommendation-one", text: "Does anyone know an automation expert who can build our workflow?" }]))
      .mockResolvedValueOnce(sourceResult([{ id: "task-help-one", text: "Need help automating a manual onboarding workflow." }]))
      .mockResolvedValueOnce(sourceResult([{ id: "direct-two", text: "Looking for an automation expert to implement a client workflow." }]));

    const coverage = await fetchCreditAwarePosts(monitor, { policy: smallPolicy });

    expect(mocks.fetchPublicPosts).toHaveBeenCalledTimes(4);
    expect(coverage.calls).toBe(4);
    expect(coverage.pages).toHaveLength(4);
    expect(coverage.queryFamilies).toBe(3);
    expect(coverage.rawReceived).toBe(6);
    expect(coverage.rawCount).toBe(5);
    expect(coverage.candidateCount).toBe(4);
    expect(coverage.result.posts.map(post => post.id)).toEqual(["direct-one", "shared", "recommendation-one", "direct-two"]);
    expect(mocks.fetchPublicPosts.mock.calls.some(([, cursor]) => cursor?.nextToken === "direct-next")).toBe(true);
  });

  it("resumes the legacy primary cursor during the migration to independent family state", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce(sourceResult([{ id: "continued", text: "Need someone to automate an operations workflow for our team." }], "following-page"));

    const coverage = await fetchCreditAwarePosts(monitor, { nextToken: "legacy-direct-cursor", queryStates: [], policy: { maxProviderCallsPerSync: 1 } });

    expect(mocks.fetchPublicPosts).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPublicPosts).toHaveBeenCalledWith(expect.any(String), { nextToken: "legacy-direct-cursor" });
    expect(coverage.pages[0]?.nextToken).toBe("following-page");
  });

  it("caps pages even when a provider advertises endless continuations", async () => {
    mocks.fetchPublicPosts.mockResolvedValue(sourceResult([{ id: "a", text: "Need someone to automate a workflow." }], "next"));

    const coverage = await fetchCreditAwarePosts(monitor, { policy: { maxProviderCallsPerSync: 2, maxPagesPerFamily: 1, maxQueryFamiliesPerSync: 3 } });

    expect(coverage.pages).toHaveLength(2);
    expect(coverage.calls).toBe(2);
    expect(coverage.pages.every(page => page.pagesFetched === 1)).toBe(true);
  });

  it("records query state and a call-level ledger row for each completed provider page", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce(sourceResult([
      { id: "one", text: "Looking for someone to build automation for our business." },
      { id: "two", text: "Need someone to automate an operations workflow for our team." },
    ], undefined, 48));

    await expect(syncMonitorRecord(monitor, { maxProviderCallsPerSync: 1, maxQueryFamiliesPerSync: 1 })).resolves.toMatchObject({
      inserted: 2,
      source: "twitterapi_io",
      retrieval: { sourceCalls: 1, pagesChecked: 1, queryFamilies: 1, buyerCandidates: 2, persisted: 2, queueWaitMs: 48 },
    });
    expect(mocks.saveMonitorQueryState).toHaveBeenCalledWith(17, expect.objectContaining({ familyId: "direct_demand", pagesFetched: 1, exhausted: "yes" }));
    expect(mocks.recordMonitorSyncRun).toHaveBeenCalledWith(expect.objectContaining({ monitorId: 17, pageNumber: 1, rawReceived: 2, deduplicatedPosts: 2, buyerCandidates: 2, persistedPosts: 2, queueWaitMs: 48 }));
  });

  it("persists a rate-limit source state without consuming later families", async () => {
    mocks.fetchPublicPosts.mockRejectedValueOnce(new XApiError(429, "TwitterAPI.io: rate limited"));

    await expect(syncMonitorRecord(monitor, { maxProviderCallsPerSync: 1 })).rejects.toThrow("rate limited");
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({ status: "rate_limited", latencyLabel: "TwitterAPI.io rate limit active", retryCount: 1 }));
    expect(mocks.recordMonitorSyncRun).toHaveBeenCalledWith(expect.objectContaining({ monitorId: 17, familyId: "direct_demand", status: "rate_limited", rawReceived: 0, persistedPosts: 0 }));
    expect(mocks.fetchPublicPosts).toHaveBeenCalledTimes(1);
  });

  it("skips a sync before provider access when the daily call ledger is at its cap", async () => {
    mocks.countMonitorSyncRunsSince.mockResolvedValueOnce(2);

    await expect(syncMonitorRecord(monitor, { maxProviderCallsPerDay: 2 })).resolves.toMatchObject({
      inserted: 0,
      source: "twitterapi_io",
      skipped: "daily_budget",
      retrieval: { sourceCalls: 0, pagesChecked: 0 },
    });
    expect(mocks.fetchPublicPosts).not.toHaveBeenCalled();
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({ status: "rate_limited", latencyLabel: "Daily source-call budget reached" }));
  });
});
