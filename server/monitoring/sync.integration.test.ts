import { beforeEach, describe, expect, it, vi } from "vitest";
import { XApiError } from "./xClient";

const mocks = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  recordSync: vi.fn(),
  fetchRecentSearch: vi.fn(),
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
    fetchRecentSearch: mocks.fetchRecentSearch,
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
    mocks.fetchRecentSearch.mockRejectedValueOnce(new XApiError(402, "payment required"));

    await expect(syncMonitorRecord(monitor)).rejects.toThrow("payment required");
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({
      source: "recent_search",
      status: "payment_required",
      latencyLabel: "X API credit required",
      retryCount: 1,
    }));
  });

  it("persists rate-limited status when X Recent Search returns HTTP 429", async () => {
    mocks.fetchRecentSearch.mockRejectedValueOnce(new XApiError(429, "rate limited"));

    await expect(syncMonitorRecord(monitor)).rejects.toThrow("rate limited");
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({
      source: "recent_search",
      status: "rate_limited",
      latencyLabel: "X rate limit active",
      retryCount: 1,
    }));
  });
});
