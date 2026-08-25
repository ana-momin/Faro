import { describe, expect, it } from "vitest";
import { buildReviewDialogContent, getBuyerRequestEvidence, personalizedGreeting, summarizePostForAgent } from "../client/src/lib/discoverAgent";

describe("Faro AI Discover helpers", () => {
  it("uses the authenticated user’s first name in a time-aware greeting", () => {
    expect(personalizedGreeting("M Anas", new Date("2026-08-24T08:00:00"))).toContain("M");
  });

  it("summarizes service evidence and urgency for a selected post", () => {
    const summary = summarizePostForAgent({
      body: "Need someone to automate my workflow this week.",
      ruleScore: 91,
      scoreExplanation: [{ label: "Defined task or service need", points: 24 }, { label: "Timing signal", points: 6 }],
    });
    expect(summary.confidence).toBe("High confidence");
    expect(summary.summary).toContain("reviewing it soon");
    expect(summary.evidence).toHaveLength(2);
  });

  it("keeps complete post content and identity ready for the review dialog", () => {
    const content = buildReviewDialogContent({ authorName: "Nora Patel", authorHandle: "norapatel", body: "I need an operator to build a complete AI workflow for our client intake before next month.", ruleScore: 88, scoreExplanation: [{ label: "Defined task or service need", points: 24 }] });
    expect(content.authorLabel).toBe("Nora Patel");
    expect(content.handleLabel).toBe("@norapatel");
    expect(content.fullPost).toContain("complete AI workflow");
    expect(content.agentRead.confidence).toBe("High confidence");
  });

  it("extracts the concrete buyer request and delivery wording for honest popup highlighting", () => {
    const evidence = getBuyerRequestEvidence({ body: "Our team is looking for a developer to automate the client intake workflow with AI." });
    expect(evidence.map(item => item.label)).toEqual(["Buyer request", "Delivery scope"]);
    expect(evidence[0]?.phrase).toContain("looking for a developer");
    expect(evidence[1]?.phrase).toContain("automate the client intake workflow");
  });
});
