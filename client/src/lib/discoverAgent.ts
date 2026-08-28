export type AgentReason = { label: string; points: number };
export type BuyerRequestEvidence = { label: string; phrase: string };

export type AgentPostInput = {
  body: string;
  ruleScore: number;
  scoreExplanation?: AgentReason[] | null;
};

export type ReviewDialogPostInput = AgentPostInput & {
  authorName?: string | null;
  authorHandle?: string | null;
};

export function personalizedGreeting(name?: string | null, date = new Date()) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";
  const hour = date.getHours();
  const dayVariant = date.getDate() % 3;
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greetings = [
    `Good ${period}, ${firstName}.`,
    `${firstName}, your signal desk is ready.`,
    `Hey ${firstName}, let’s find the right requests.`,
  ];
  return greetings[dayVariant];
}

export function summarizePostForAgent(post: AgentPostInput) {
  const evidence = (post.scoreExplanation ?? []).filter(reason => reason.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);
  const timeSensitive = evidence.some(reason => reason.label === "Timing signal");
  const serviceSignal = evidence.find(reason => /task|service|help request|buyer/i.test(reason.label));
  const confidence = post.ruleScore >= 85 ? "High confidence" : post.ruleScore >= 70 ? "Promising signal" : "Worth a quick review";
  const summary = serviceSignal
    ? `This reads like a concrete request for outside help. Faro AI found ${serviceSignal.label.toLowerCase()}.`
    : "This post overlaps with the active brief. Check the full context before saving it.";
  return {
    confidence,
    summary: timeSensitive ? `${summary} The timing language suggests reviewing it soon.` : summary,
    evidence,
  };
}

export function buildReviewDialogContent(post: ReviewDialogPostInput) {
  return {
    authorLabel: post.authorName || post.authorHandle || "Public X account",
    handleLabel: post.authorHandle ? `@${post.authorHandle.replace(/^@/, "")}` : "Public X account",
    fullPost: post.body,
    agentRead: summarizePostForAgent(post),
  };
}

export function getBuyerRequestEvidence(post: Pick<AgentPostInput, "body">): BuyerRequestEvidence[] {
  const body = post.body ?? "";
  const evidence: BuyerRequestEvidence[] = [];
  const request = body.match(/\b(?:looking for|looking to hire|looking to outsource|need(?:s)?|seeking|can someone|who can|does anyone know|anyone know|any recommendations?(?: for)?|recommend(?:ations)? for|would love|trying to find|hoping to find|who should i hire)\b[^.!?\n]{0,130}/i)?.[0]?.trim();
  if (request) evidence.push({ label: "Buyer request", phrase: request });
  const delivery = body.match(/\b(?:build|implement|set up|automate|integrate|configure|develop|create|produce|edit|manage|design|test|validate|research|audit|debug|fix|migrate|launch|maintain|streamline)\b[^.!?\n]{0,95}/i)?.[0]?.trim();
  if (delivery) evidence.push({ label: "Delivery scope", phrase: delivery });
  return evidence.slice(0, 2);
}
