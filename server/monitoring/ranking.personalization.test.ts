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

  it("rejects a job opening that uses the same service vocabulary", () => {
    const result = rankOpportunity({
      ...profile,
      body: "Hiring: AI automation expert. We need someone to build and maintain automations across Zapier and n8n. Pay: $8/hr. Apply now.",
      postedAt: new Date(),
      engagement: {},
      aiConfidence: 0.98,
      aiLabel: "Active help-seeking",
    });

    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("Non-service context");
  });

  it("requires a concrete delivery scope or provider before accepting a direct-sounding ask", () => {
    const result = rankOpportunity({
      ...profile,
      body: "I need someone who is hungry like me to work on YouTube automation again.",
      postedAt: new Date(),
      engagement: {},
      aiConfidence: 0.9,
      aiLabel: "Active help-seeking",
    });

    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("No clear service-seeking intent");
  });

  it("rejects networking language that asks for a person but not a delivered service", () => {
    const result = rankOpportunity({
      ...profile,
      body: "Looking for someone with the technical fluency to understand AI workflows and automation and explore what is possible.",
      postedAt: new Date(),
      engagement: {},
      aiConfidence: 0.88,
      aiLabel: "Active help-seeking",
    });

    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("No clear service-seeking intent");
  });

  it("rejects community-building posts that invite peers rather than seek a provider", () => {
    const result = rankOpportunity({
      ...profile,
      body: "Builders and founders, I am looking for people building AI workflows. Drop what you're working on right now.",
      postedAt: new Date(),
      engagement: {},
      aiConfidence: 0.95,
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

  it("rejects a person offering the monitored service instead of asking for it", () => {
    const result = rankOpportunity({
      includeTerms: ["AI agents", "automation"],
      excludeTerms: [],
      goal: "Find people looking for AI agents and automation help",
      body: "I build AI agents and automation systems for founders. DM me for my services.",
      postedAt: new Date(),
      engagement: {},
    });
    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("Service offer rather than buyer request");
  });

  it("rejects a self-description of delivered services even without a direct sales call to action", () => {
    const result = rankOpportunity({
      includeTerms: ["automation", "AI workflow"],
      excludeTerms: [],
      goal: "Find teams that need AI workflow and automation help",
      body: "I am an operations leader who builds AI-powered automation workflows and process systems for fast-moving companies.",
      postedAt: new Date(),
      engagement: {},
    });
    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("Service offer rather than buyer request");
  });

  it("rejects generic commentary about people needing AI help without a buyer asking for a provider", () => {
    const result = rankOpportunity({
      includeTerms: ["AI", "automation"],
      excludeTerms: [],
      goal: "Find buyers looking for AI automation help",
      body: "People need help using AI properly, and every brand should consider automation this year.",
      postedAt: new Date(),
      engagement: {},
      aiLabel: "Active help-seeking",
      aiConfidence: 0.96,
    });
    expect(result.score).toBe(0);
    expect(result.components.map(component => component.label)).toContain("No clear service-seeking intent");
  });

  it("accepts a concrete first-person request for help automating a real workflow", () => {
    const result = rankOpportunity({
      includeTerms: ["automation", "AI workflow"],
      excludeTerms: [],
      goal: "Find buyers looking for AI workflow automation help",
      body: "I need help automating our lead follow-up workflow with AI this month. Can someone recommend a freelancer?",
      postedAt: new Date(),
      engagement: {},
    });
    expect(result.score).toBeGreaterThanOrEqual(55);
  });
});
