import { describe, expect, it } from "vitest";
import { suggestCriteria } from "./ai";
import { buildXQuery, validateXQuery } from "./query";
import { deterministicIntent, rankOpportunity } from "./ranking";
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

describe("AI query suggestion fallback", () => {
  it("uses deterministic query construction when the built-in model is disabled", async () => {
    const previous = process.env.SIGNALFORGE_DISABLE_LLM;
    process.env.SIGNALFORGE_DISABLE_LLM = "true";
    try {
      const suggestion = await suggestCriteria("People looking for help building a custom AI workflow");
      expect(suggestion.fallback).toBe(true);
      expect(suggestion.model).toBe("deterministic fallback");
      expect(suggestion.xQuery).toContain("-is:retweet");
      expect(suggestion.includeTerms).toContain("custom ai workflow");
      expect(suggestion.xQuery).toContain('("custom ai workflow" OR "ai workflow") ("looking for" OR "need help" OR recommend OR hire)');
    } finally {
      if (previous === undefined) delete process.env.SIGNALFORGE_DISABLE_LLM;
      else process.env.SIGNALFORGE_DISABLE_LLM = previous;
    }
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
    });
    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.components.some(component => component.label === "Explicit help-seeking language")).toBe(true);
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
    expect(classifySyncFailure(new XApiError(402, "payment required"))).toEqual({ status: "payment_required", label: "X API credit required" });
    expect(classifySyncFailure(new XApiError(429, "rate limited"))).toEqual({ status: "rate_limited", label: "X API rate limit active" });
    expect(recentSearchStatus(true)).toEqual({ source: "recent_search", latencyLabel: "Recent Search fallback; stream rule configured" });
  });
});
