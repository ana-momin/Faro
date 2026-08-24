import { describe, expect, it } from "vitest";
import { getDiscoverPreview, getQualifiedPosts } from "../client/src/lib/discoverFeed";

const item = (id: number, monitorId: number, score: number, source = "twitterapi.io") => ({ post: { id, source, ruleScore: score, reviewStatus: "pending" as const }, monitor: { id: monitorId } });

describe("Faro Discover feed selection", () => {
  it("keeps Discover focused on qualified posts from the active brief when they exist", () => {
    const rows = [item(1, 10, 89), item(2, 11, 92), item(3, 10, 48), item(4, 10, 82, "demo")];
    expect(getQualifiedPosts(rows, 10).map(row => row.post.id)).toEqual([1]);
  });

  it("falls back to all qualified stored posts and limits the Discover preview without losing Review data", () => {
    const rows = [item(1, 10, 89), item(2, 11, 92), item(3, 12, 81)];
    const qualified = getQualifiedPosts(rows, 99);
    expect(qualified).toHaveLength(3);
    expect(getDiscoverPreview(qualified, 2).map(row => row.post.id)).toEqual([1, 2]);
  });

  it("can keep a newly started brief clear instead of resurfacing prior monitors", () => {
    const rows = [item(1, 10, 89), item(2, 11, 92)];
    expect(getQualifiedPosts(rows, 99, false)).toEqual([]);
  });
});
