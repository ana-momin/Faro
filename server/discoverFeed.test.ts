import { describe, expect, it } from "vitest";
import { filterFeedByTime, getAllQualifiedPosts, getDiscoverPreview, getQualifiedPosts, getRequestCategory, isConcreteBuyerRequest, prioritizeCurrentMonth } from "../client/src/lib/discoverFeed";

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

  it("keeps a concrete developer recommendation request available in the broader Feed", () => {
    const recommendation = item(13, 10, 50, "twitterapi.io", "Does anyone know a developer who can automate our client intake with AI?");
    expect(isConcreteBuyerRequest(recommendation.post)).toBe(true);
    expect(getAllQualifiedPosts([recommendation]).map(row => row.post.id)).toEqual([13]);
  });

  it("keeps first-party needs-someone and expert requests visible after server qualification", () => {
    const needsSomeone = item(14, 10, 78, "twitterapi.io", "Our company needs someone to automate the support workflow.");
    const expertRequest = item(15, 10, 78, "twitterapi.io", "Looking for an AI expert to build a workflow for our business.");
    expect(getAllQualifiedPosts([needsSomeone, expertRequest]).map(row => row.post.id)).toEqual([14, 15]);
  });

  it("keeps a semantically confirmed concrete buyer request visible when its wording is flexible", () => {
    const flexible = { ...item(16, 10, 78, "twitterapi.io", "Imma need someone to build an AI app for hearing aids to translate languages in real time."), post: { ...item(16, 10, 78).post, aiIntent: { label: "Active help-seeking", confidence: 0.91 } } };
    expect(getAllQualifiedPosts([flexible]).map(row => row.post.id)).toEqual([16]);
  });

  it("keeps all qualifying saved buyer requests available to the Feed across prior briefs", () => {
    const rows = [item(1, 10, 89), item(2, 11, 92), item(3, 12, 81)];
    expect(getAllQualifiedPosts(rows).map(row => row.post.id)).toEqual([1, 2, 3]);
  });

  it("deduplicates saved posts by provider X post ID before local Feed paging", () => {
    const first = item(20, 10, 82);
    const second = item(21, 11, 86);
    const duplicateFirst = { ...first, post: { ...first.post, xPostId: "same-x-post" } };
    const duplicateSecond = { ...second, post: { ...second.post, xPostId: "same-x-post" } };
    expect(getAllQualifiedPosts([duplicateFirst, duplicateSecond]).map(row => row.post.id)).toEqual([20]);
  });

  it("filters qualified saved posts by the compact local Time menu windows", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const thisWeekBase = item(22, 10, 82);
    const lastWeekBase = item(23, 10, 82);
    const recent = { ...thisWeekBase, post: { ...thisWeekBase.post, postedAt: "2026-08-20T10:00:00.000Z" } };
    const lastMonth = { ...lastWeekBase, post: { ...lastWeekBase.post, postedAt: "2026-07-31T10:00:00.000Z" } };
    expect(filterFeedByTime([recent, lastMonth], "last_7_days", now).map(row => row.post.id)).toEqual([22]);
    expect(filterFeedByTime([recent, lastMonth], "last_month", now).map(row => row.post.id)).toEqual([23]);
  });

  it("prioritizes current-month saved requests before older qualified history", () => {
    const older = { ...item(24, 10, 96), post: { ...item(24, 10, 96).post, postedAt: "2026-07-31T15:00:00.000Z" } };
    const currentEarlier = { ...item(25, 10, 70), post: { ...item(25, 10, 70).post, postedAt: "2026-08-03T15:00:00.000Z" } };
    const currentLatest = { ...item(26, 10, 65), post: { ...item(26, 10, 65).post, postedAt: "2026-08-23T15:00:00.000Z" } };
    expect(prioritizeCurrentMonth([older, currentEarlier, currentLatest], new Date("2026-08-24T12:00:00.000Z")).map(row => row.post.id)).toEqual([26, 25, 24]);
  });

  it("labels practical buyer-request work by task category", () => {
    expect(getRequestCategory({ body: "Need a product tester to validate our AI feature" })).toBe("Product testing");
    expect(getRequestCategory({ body: "Looking for a developer to build an AI product" })).toBe("Development");
    expect(getRequestCategory({ body: "Need a creator to post social media content with AI" })).toBe("Content & social");
  });
});
