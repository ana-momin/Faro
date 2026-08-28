import { describe, expect, it } from "vitest";
import { suggestCriteria } from "./ai";
import { buildServiceDemandQuery, buildXQuery, expandServiceDiscoveryTerms, validateXQuery } from "./query";
import { deterministicIntent, isPotentialBuyerOpportunity, rankOpportunity } from "./ranking";
import { classifySyncFailure } from "./sync";
import { XApiError, dedupePosts, recentSearchStatus } from "./xClient";

describe("monitoring query validation", () => {
  it("builds a readable X rule and excludes retweets", () => {
    expect(buildXQuery(["AI workflow", "automation"], ["job"])).toBe('(\"AI workflow\" OR automation) -job -is:retweet');
  });

  it("rejects malformed query structure", () => {
    const result = validateXQuery("(automation OR ai workflow");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Balance");
  });
});

describe("deterministic query suggestion", () => {
  it("uses deterministic query construction without a managed model dependency", async () => {
    const suggestion = await suggestCriteria("People looking for help building a custom AI workflow");
    expect(suggestion.fallback).toBe(true);
    expect(suggestion.model).toBe("Faro deterministic buyer-intent rules");
    expect(suggestion.xQuery).toContain("-is:retweet");
    expect(suggestion.includeTerms).toContain("custom ai workflow");
    expect(suggestion.includeTerms).toContain("automation");
    expect(suggestion.xQuery).toContain('(automation OR automate OR "custom ai workflow"');
    expect(suggestion.xQuery).toContain("-co-founder");
  });

  it("broadens workflow searches with service-delivery language while retaining the original concept", () => {
    const terms = expandServiceDiscoveryTerms("Find providers for a custom AI workflow", ["custom ai workflow"]);
    expect(terms).toEqual(expect.arrayContaining(["custom ai workflow", "automation", "ai agent"]));
    const query = buildServiceDemandQuery(terms, ["job"]);
    expect(query).toContain('"looking for" OR "need someone" OR "need a developer"');
    expect(query.length).toBeLessThanOrEqual(1024);
  });
});

describe("opportunity ranking", () => {
  it("rewards a recent, explicit, monitored help request", () => {
    const body = "Looking for someone to build an AI workflow automation for our team.";
    const intent = deterministicIntent(body, ["AI workflow", "automation"]);
    const score = rankOpportunity({
      body,
      postedAt: new Date(),
      engagement: { like_count: 25, reply_count: 3 },
      includeTerms: ["AI workflow", "automation"],
      excludeTerms: ["giveaway"],
      aiConfidence: intent.confidence,
      aiLabel: intent.label,
    });
    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.components.some(component => component.label === "Direct service request")).toBe(true);
  });

  it("suppresses a post containing an excluded term", () => {
    const score = rankOpportunity({
      body: "Looking for automation ideas for a giveaway.",
      postedAt: new Date(),
      engagement: {},
      includeTerms: ["automation"],
      excludeTerms: ["giveaway"],
    });
    expect(score.score).toBe(0);
  });

  it("keeps a concrete buyer request before the per-post model call", () => {
    expect(isPotentialBuyerOpportunity({
      body: "Looking for someone to build automation for our business.",
      postedAt: new Date(),
      engagement: {},
      includeTerms: ["automation"],
      excludeTerms: [],
      goal: "Test health-state persistence",
      categories: ["service request"],
    })).toBe(true);
  });

  it("recognizes a concrete automation request when the post uses the verb form", () => {
    expect(isPotentialBuyerOpportunity({
      body: "Need someone to automate an operations workflow for our team.",
      postedAt: new Date(),
      engagement: {},
      includeTerms: ["automation"],
      excludeTerms: [],
      goal: "Test health-state persistence",
      categories: ["service request"],
    })).toBe(true);
  });

  it("rejects generic agent commentary that only mentions a hypothetical need and recommendation", () => {
    expect(isPotentialBuyerOpportunity({
      body: "Imagine I need a tool. My agent may recommend someone else after evaluating products, APIs, and documentation.",
      postedAt: new Date(),
      engagement: {},
      includeTerms: ["ai agent", "automation"],
      excludeTerms: [],
      goal: "Find people looking for someone to build AI automation",
      categories: ["service request"],
    })).toBe(false);
  });

  it("keeps a flexible first-person request for an automation specialist before model classification", () => {
    expect(isPotentialBuyerOpportunity({
      body: "Can anyone recommend an automation specialist for our sales team?",
      postedAt: new Date(),
      engagement: {},
      includeTerms: ["automation"],
      excludeTerms: [],
      goal: "Find people looking for someone to build AI automation",
      categories: ["service request"],
    })).toBe(true);
  });

  it("keeps flexible provider language for semantic classification while still excluding hard noise", () => {
    expect(isPotentialBuyerOpportunity({
      body: "I would love a developer to build an AI app for hearing aids to translate languages in real time.",
      postedAt: new Date(),
      engagement: {},
      includeTerms: ["AI app", "developer"],
      excludeTerms: [],
      goal: "Find buyers looking for a developer to build an AI-enabled product",
      categories: ["service request"],
    })).toBe(true);
  });
});

describe("ingestion resilience", () => {
  it("deduplicates duplicate incoming X post IDs before persistence", () => {
    const unique = dedupePosts([
      { id: "101", text: "first" },
      { id: "101", text: "duplicate" },
      { id: "102", text: "second" },
    ]);
    expect(unique.map(post => post.id)).toEqual(["101", "102"]);
  });

  it("reports payment and rate-limit states without misrepresenting the source", () => {
    expect(classifySyncFailure(new XApiError(402, "payment required"))).toMatchObject({ status: "payment_required", label: "X API credit required" });
    expect(classifySyncFailure(new XApiError(429, "rate limited"))).toMatchObject({ status: "rate_limited", label: "X API rate limit active" });
    expect(recentSearchStatus(true)).toEqual({ source: "recent_search", latencyLabel: "Recent Search fallback; stream rule configured" });
  });

  it("never surfaces a raw provider error body, and catches a credit issue even when the provider used the wrong HTTP status for it", () => {
    const rawBody = 'TwitterAPI.io: {"error":"Unauthorized","message":"Credits is not enough.Please recharge"}';
    const result = classifySyncFailure(new XApiError(401, rawBody));
    expect(result.status).toBe("payment_required");
    expect(result.message).not.toContain("{");
    expect(result.message).not.toContain("Unauthorized");
    expect(result.message.toLowerCase()).toContain("credit");

    const genericAuthFailure = classifySyncFailure(new XApiError(401, "TwitterAPI.io: invalid key"));
    expect(genericAuthFailure.status).toBe("unauthorized");
    expect(genericAuthFailure.message).not.toContain("invalid key");

    const rateLimit = classifySyncFailure(new XApiError(429, "TwitterAPI.io: too many requests"));
    expect(rateLimit.message).not.toContain("too many requests");

    const unknownFailure = classifySyncFailure(new Error("ECONNRESET"));
    expect(unknownFailure.message).not.toContain("ECONNRESET");
  });
});
