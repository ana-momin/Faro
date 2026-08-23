import { describe, expect, it } from "vitest";
import { rankOpportunity } from "./ranking";

describe("Alpha X personalized relevance scoring", () => {
  const profile = {
    includeTerms: ["custom AI workflows", "AI workflows"],
    excludeTerms: ["giveaway", "job"],
    goal: "People asking for help building custom AI workflows for a small business",
  };

  it("elevates a specific request that matches the user outcome", () => {
    const result = rankOpportunity({
      ...profile,
      body: "Our small business is looking for someone to map custom AI workflows for client intake. Any recommendations?",
      postedAt: new Date(),
      engagement: { like_count: 8, reply_count: 2 },
      aiConfidence: 0.9,
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.components.map(component => component.label)).toContain("Buyer or decision-maker context");
    expect(result.components.map(component => component.label)).toContain("Explicit help-seeking language");
  });

  it("deprioritizes a generic promotional mention despite topic overlap", () => {
    const result = rankOpportunity({
      ...profile,
      body: "We built custom AI workflows. Book a call and follow for more automation tips.",
      postedAt: new Date(),
      engagement: { like_count: 120 },
      aiConfidence: 0.65,
    });

    expect(result.score).toBeLessThan(45);
    expect(result.components.map(component => component.label)).toContain("Promotional rather than request-led");
  });
});
