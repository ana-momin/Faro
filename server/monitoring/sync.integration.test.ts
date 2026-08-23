import { beforeEach, describe, expect, it, vi } from "vitest";
import { XApiError } from "./xClient";

const mocks = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  recordSync: vi.fn(),
  fetchPublicPosts: vi.fn(),
  upsertFilteredStreamRule: vi.fn(),
  persistNormalizedPost: vi.fn(),
}));

vi.mock("../db", () => ({
  getSyncState: mocks.getSyncState,
  recordSync: mocks.recordSync,
  listActiveMonitors: vi.fn(),
}));

vi.mock("./xClient", async importOriginal => {
  const actual = await importOriginal<typeof import("./xClient")>();
  return {
    ...actual,
    fetchPublicPosts: mocks.fetchPublicPosts,
    upsertFilteredStreamRule: mocks.upsertFilteredStreamRule,
  };
});

vi.mock("./ingest", () => ({ persistNormalizedPost: mocks.persistNormalizedPost }));

import { syncMonitorRecord } from "./sync";

const monitor = {
  id: 17,
  userId: 3,
  name: "Integration test monitor",
  goal: "Test health-state persistence",
  xQuery: "automation -is:retweet",
  includeTerms: ["automation"],
  excludeTerms: [],
  categories: ["test"],
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("syncMonitorRecord X fallback integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSyncState.mockResolvedValue(undefined);
  });

  it("persists payment-required status when X Recent Search returns HTTP 402", async () => {
    mocks.fetchPublicPosts.mockRejectedValueOnce(new XApiError(402, "payment required"));

    await expect(syncMonitorRecord(monitor)).rejects.toThrow("payment required");
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({
      source: "recent_search",
      status: "payment_required",
      latencyLabel: "X API credit required",
      retryCount: 1,
    }));
  });

  it("persists rate-limited status when X Recent Search returns HTTP 429", async () => {
    mocks.fetchPublicPosts.mockRejectedValueOnce(new XApiError(429, "rate limited"));

    await expect(syncMonitorRecord(monitor)).rejects.toThrow("rate limited");
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({
      source: "recent_search",
      status: "rate_limited",
      latencyLabel: "X API rate limit active",
      retryCount: 1,
    }));
  });

  it("persists a degraded live-source state when an individual public post cannot be normalized", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [{ id: "one", text: "first" }, { id: "two", text: "second" }],
      users: [],
      newestId: "two",
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });
    mocks.persistNormalizedPost.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("invalid provider timestamp"));

    await expect(syncMonitorRecord(monitor)).resolves.toEqual({ inserted: 1, source: "twitterapi_io" });
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({
      source: "twitterapi_io",
      status: "degraded",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts · 1 post skipped",
      lastError: "invalid provider timestamp",
    }));
  });
});
