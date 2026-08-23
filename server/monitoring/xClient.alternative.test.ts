import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTwitterApiIoSearch } from "./xClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TWITTERAPI_IO_KEY;
});

describe("TwitterAPI.io public-post adapter", () => {
  it("normalizes a provider response into direct-link-ready X post fields", async () => {
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
      next_cursor: "next-page",
    }), { status: 200 }));

    const result = await fetchTwitterApiIoSearch('"AI workflow" -is:retweet');

    expect(result.source).toBe("twitterapi_io");
    expect(result.latencyLabel).toContain("latest public posts");
    expect(result.posts[0]).toMatchObject({ id: "1888888888", author_id: "44", public_metrics: { like_count: 12, reply_count: 3 } });
    expect(result.users[0]).toMatchObject({ id: "44", username: "signaltester" });
    expect(result.nextToken).toBe("next-page");
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain("filter%3Aretweets");
  });
});
