import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTwitterApiIoSearch } from "./xClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TWITTERAPI_IO_KEY;
  delete process.env.VITEST;
});

describe("TwitterAPI.io public-post adapter", () => {
  it("normalizes a provider response into direct-link-ready X post fields", async () => {
    process.env.VITEST = "true";
    process.env.TWITTERAPI_IO_KEY = "test-key";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tweets: [{
        id: "1888888888",
        text: "Looking for help with an AI workflow",
        createdAt: "2026-08-23T12:00:00.000Z",
        likeCount: 12,
        replyCount: 3,
        author: { id: "44", userName: "signaltester", name: "Signal Tester" },
      }],
      has_next_page: true,
      next_cursor: "next-page",
    }), { status: 200 }));

    const result = await fetchTwitterApiIoSearch('"AI workflow" -is:retweet');

    expect(result.source).toBe("twitterapi_io");
    expect(result.latencyLabel).toContain("latest public posts");
    expect(result.posts[0]).toMatchObject({ id: "1888888888", author_id: "44", public_metrics: { like_count: 12, reply_count: 3 } });
    expect(result.users[0]).toMatchObject({ id: "44", username: "signaltester" });
    expect(result.nextToken).toBe("next-page");
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain("filter%3Aretweets");
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain("queryType=Latest");
  });

  it("uses a supplied cursor and clears it when the provider reports no next page", async () => {
    process.env.VITEST = "true";
    process.env.TWITTERAPI_IO_KEY = "test-key";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tweets: [],
      has_next_page: false,
      next_cursor: "must-not-be-stored",
    }), { status: 200 }));

    const result = await fetchTwitterApiIoSearch("need help automating a business", "saved-cursor");

    expect(result.nextToken).toBeUndefined();
    const requestedUrl = String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("queryType=Latest");
    expect(requestedUrl).toContain("cursor=saved-cursor");
  });
});
