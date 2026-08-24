import { describe, expect, it } from "vitest";
import { getAllQualifiedPosts, getDiscoverPreview, getQualifiedPosts, getRequestCategory, isConcreteBuyerRequest } from "../client/src/lib/discoverFeed";

const item = (id: number, monitorId: number, score: number, source = "twitterapi.io", body = "Looking to hire someone to automate our sales workflow") => ({ post: { id, source, ruleScore: score, body, reviewStatus: "pending" as const }, monitor: { id: monitorId } });

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

  it("does not let an old high score surface generic AI commentary as a buyer request", () => {
    const generic = item(9, 10, 100, "twitterapi.io", "Most people build home servers for storage, but one developer filled theirs with AI.");
    expect(isConcreteBuyerRequest(generic.post)).toBe(false);
    expect(getQualifiedPosts([generic], 10)).toEqual([]);
  });

  it("does not treat a third-party story about businesses looking for help as a first-party buyer request", () => {
    const thirdPartyStory = item(10, 10, 100, "twitterapi.io", "Small businesses were looking for someone to eliminate repetitive work, according to a founder's story.");
    expect(isConcreteBuyerRequest(thirdPartyStory.post)).toBe(false);
  });

  it("does not surface a generic founder story or networking ask as a service request", () => {
    const thirdPartyFounder = item(11, 10, 100, "twitterapi.io", "A founder looking for someone they once met can unlock their next opportunity.");
    const networkingAsk = item(12, 10, 100, "twitterapi.io", "Looking for someone with technical fluency to sit down, chat, and explore possibilities.");
    expect(isConcreteBuyerRequest(thirdPartyFounder.post)).toBe(false);
    expect(isConcreteBuyerRequest(networkingAsk.post)).toBe(false);
  });

  it("keeps all qualifying saved buyer requests available to the Feed across prior briefs", () => {
    const rows = [item(1, 10, 89), item(2, 11, 92), item(3, 12, 81)];
    expect(getAllQualifiedPosts(rows).map(row => row.post.id)).toEqual([1, 2, 3]);
  });

  it("labels practical buyer-request work by task category", () => {
    expect(getRequestCategory({ body: "Need a product tester to validate our AI feature" })).toBe("Product testing");
    expect(getRequestCategory({ body: "Looking for a developer to build an AI product" })).toBe("Development");
    expect(getRequestCategory({ body: "Need a creator to post social media content with AI" })).toBe("Content & social");
  });
});
