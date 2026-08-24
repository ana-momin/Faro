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

import { fetchCreditAwarePosts, syncMonitorRecord } from "./sync";

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

  it("keeps concrete buyer candidates across a bounded secondary query", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [{ id: "one", text: "Looking for someone to build automation for our business." }],
      users: [],
      newestId: "one",
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [
        { id: "one", text: "Looking for someone to build automation for our business." },
        { id: "two", text: "Need someone to automate an operations workflow for our team." },
      ],
      users: [],
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });

    const coverage = await fetchCreditAwarePosts(monitor);

    expect(coverage.calls).toBe(2);
    expect(coverage.rawCount).toBe(2);
    expect(coverage.result.posts.map(post => post.id)).toEqual(["one", "two"]);
  });

  it("uses only the primary query when it already has four buyer candidates", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [
        { id: "one", text: "Looking for someone to build automation for our business." },
        { id: "two", text: "Need someone to automate an operations workflow for our team." },
        { id: "three", text: "Need an agency to build an automation workflow for our client team." },
        { id: "four", text: "Looking to hire a developer to implement automation in our business." },
      ],
      users: [],
      newestId: "four",
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });

    const coverage = await fetchCreditAwarePosts(monitor);

    expect(coverage.calls).toBe(1);
    expect(coverage.result.posts).toHaveLength(4);
    expect(mocks.fetchPublicPosts).toHaveBeenCalledTimes(1);
  });

  it("uses one continuation request and never expands to a second query family", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [{ id: "next", text: "Need someone to automate an operations workflow for our team." }],
      users: [],
      newestId: "next",
      nextToken: "following-page",
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });

    const coverage = await fetchCreditAwarePosts(monitor, { nextToken: "saved-page" });

    expect(coverage.calls).toBe(1);
    expect(mocks.fetchPublicPosts).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPublicPosts).toHaveBeenCalledWith(expect.any(String), { nextToken: "saved-page" });
    expect(coverage.result.nextToken).toBe("following-page");
  });

  it("returns an empty candidate set after two empty bounded pages", async () => {
    const emptyResult = {
      posts: [],
      users: [],
      source: "twitterapi_io" as const,
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    };
    mocks.fetchPublicPosts.mockResolvedValueOnce(emptyResult).mockResolvedValueOnce(emptyResult);

    const coverage = await fetchCreditAwarePosts(monitor);

    expect(coverage.calls).toBe(2);
    expect(coverage.rawCount).toBe(0);
    expect(coverage.result.posts).toEqual([]);
  });

  it("persists a degraded live-source state when an individual public post cannot be normalized", async () => {
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [
        { id: "one", text: "Looking for someone to build automation for our business." },
        { id: "two", text: "Need someone to automate an operations workflow for our team." },
      ],
      users: [],
      newestId: "two",
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });
    mocks.fetchPublicPosts.mockResolvedValueOnce({
      posts: [],
      users: [],
      source: "twitterapi_io",
      latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
    });
    mocks.persistNormalizedPost.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("invalid provider timestamp"));

    await expect(syncMonitorRecord(monitor)).resolves.toEqual({ inserted: 1, source: "twitterapi_io" });
    expect(mocks.recordSync).toHaveBeenCalledWith(17, expect.objectContaining({
      source: "twitterapi_io",
      status: "degraded",
      latencyLabel: expect.stringContaining("1 skipped"),
      lastError: "invalid provider timestamp",
    }));
  });
});
