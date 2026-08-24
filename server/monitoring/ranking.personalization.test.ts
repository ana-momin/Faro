import { describe, expect, it } from "vitest";
import { rankOpportunity } from "./ranking";

describe("Faro personalized relevance scoring", () => {
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
    expect(result.components.map(component => component.label)).toContain("Direct service request");
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

  it("brings an urgent, explicitly scoped video task to the top of the queue", () => {
    const result = rankOpportunity({
      includeTerms: ["AI video", "UGC video", "automation"],
      excludeTerms: ["giveaway", "job"],
      goal: "People seeking help producing practical AI product videos and automation",
      body: "Need someone to build an AI UGC video for our product launch this week. We have the brief and budget ready.",
      postedAt: new Date(),
      engagement: { reply_count: 1 },
      aiConfidence: 0.92,
    });

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.components.map(component => component.label)).toContain("Defined task or service need");
    expect(result.components.map(component => component.label)).toContain("Timing signal");
  });

  it("keeps a keyword-only educational recommendation out of a service-request feed", () => {
    const result = rankOpportunity({
      ...profile,
      body: "If you have an hour this week, I recommend this lecture about the future of AI workflows and automation.",
      postedAt: new Date(),
      engagement: { like_count: 200 },
      aiConfidence: 0.95,
      aiLabel: "Active help-seeking",
    });

    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("Non-service context");
  });

  it("rejects second-person sales copy that only sounds like a service request", () => {
    const result = rankOpportunity({
      ...profile,
      body: "You do not need more advice. You need someone to show you how to build your business with AI automation coaching and workshops.",
      postedAt: new Date(),
      engagement: { like_count: 30 },
      aiConfidence: 0.95,
      aiLabel: "Active help-seeking",
    });

    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("Promotional rather than request-led");
  });

  it("keeps co-founder and hiring requests out even when they mention a monitored topic", () => {
    const result = rankOpportunity({
      ...profile,
      body: "I am looking for a technical co-founder who understands AI workflows to join me full time.",
      postedAt: new Date(),
      engagement: {},
      aiConfidence: 0.9,
      aiLabel: "Active help-seeking",
    });

    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("Non-service context");
  });

  it("ranks a genuine provider request above a topic-only discussion", () => {
    const providerRequest = rankOpportunity({
      ...profile,
      body: "Our operations team needs a freelancer to automate client intake with custom AI workflows. Budget is approved and we need help this month.",
      postedAt: new Date(),
      engagement: {},
      aiConfidence: 0.9,
      aiLabel: "Active help-seeking",
    });
    const topicOnly = rankOpportunity({
      ...profile,
      body: "Custom AI workflows are changing how small businesses think about client intake.",
      postedAt: new Date(),
      engagement: { like_count: 500 },
      aiConfidence: 0.99,
      aiLabel: "Active help-seeking",
    });

    expect(providerRequest.score).toBeGreaterThanOrEqual(80);
    expect(topicOnly.score).toBe(0);
  });
});
