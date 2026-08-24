export type RankedPostInput = {
  body: string;
  postedAt: Date;
  engagement: Record<string, number>;
  includeTerms: string[];
  excludeTerms: string[];
  goal?: string;
  categories?: string[];
  aiConfidence?: number;
  aiLabel?: string;
};

export type ScoreComponent = { label: string; points: number };

const DIRECT_SERVICE_REQUEST_PATTERNS = ["looking for someone", "looking for a freelancer", "looking for an agency", "looking to hire", "need someone", "need a freelancer", "need an agency", "need an expert", "need a consultant", "needs someone", "needs a freelancer", "needs an agency", "needs an expert", "needs a consultant", "need help with", "need help building", "needs help with", "needs help building", "can someone build", "can someone set up", "can someone implement", "who can build", "who can help us", "recommend someone", "recommend a freelancer", "recommend an agency", "seeking a provider", "seeking an expert", "looking to outsource", "need a team to", "needs a team to", "hire a"];
const SERVICE_DELIVERY_PATTERNS = ["build", "map", "implement", "set up", "setup", "automate", "integrate", "configure", "develop", "create", "produce", "edit", "manage", "design", "launch", "maintain", "streamline", "install"];
const PROVIDER_PATTERNS = ["freelancer", "agency", "consultant", "expert", "specialist", "developer", "builder", "contractor", "service provider", "vendor"];
const URGENCY_PATTERNS = ["asap", "urgent", "this week", "today", "tomorrow", "by friday", "right away", "quickly"];
const DECISION_PATTERNS = ["our team", "my team", "our business", "my business", "our company", "client", "clients", "founder", "agency", "small business", "budget", "project", "for us"];
const NON_SERVICE_CONTEXT_PATTERNS = ["book a call", "dm me", "follow for", "we built", "i built", "launching", "limited offer", "sign up", "buy now", "check out my", "you need", "you don't need", "they need someone", "businesses don't need", "show you how", "more advice", "stop being told", "coaching", "workshop", "workshops", "motivation", "my next role", "next role", "my course", "course on", "webinar", "lecture", "podcast", "newsletter", "tutorial", "tips", "learning", "recommend this", "recommend a talk", "recommend a lecture", "recommend a course", "recommend a podcast", "co-founder", "cofounder", "looking for a job", "job seeker", "open to work", "we are hiring", "we're hiring", "hiring:", "hiring for", "hiring a", "hiring an", "job opening", "apply now", "click the link", "join the team", "self-motivated", "willing to learn", "per hour", "hrs/week", "pay:", "internship", "full-time", "full time", "part-time", "part time", "salary", "resume", "candidate", "position"];
const PROMOTIONAL_PATTERNS = ["book a call", "dm me", "follow for", "we built", "i built", "launching", "limited offer", "sign up", "buy now", "check out my", "you need", "you don't need", "show you how", "more advice", "stop being told", "coaching", "workshop", "workshops"];
const GENERIC_GOAL_WORDS = new Set(["people", "asking", "help", "building", "build", "looking", "someone", "with", "from", "that", "this", "their", "about", "small", "business", "public", "posts", "for", "and", "the", "a", "an", "to", "of", "in"]);

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3 && !GENERIC_GOAL_WORDS.has(token));
}

function goalCoverage(body: string, goal?: string) {
  const goalTokens = Array.from(new Set(tokens(goal ?? "")));
  return goalTokens.filter(token => body.includes(token)).length;
}

function hasAny(body: string, patterns: string[]) {
  return patterns.some(pattern => body.includes(pattern));
}

function matchedConcepts(body: string, includeTerms: string[]) {
  return includeTerms.filter(term => body.includes(term.toLowerCase()));
}

function serviceIntentAssessment(body: string, includeTerms: string[], goal?: string) {
  const concepts = matchedConcepts(body, includeTerms);
  const goalMatches = goalCoverage(body, goal);
  const directRequest = hasAny(body, DIRECT_SERVICE_REQUEST_PATTERNS);
  const deliveryScope = hasAny(body, SERVICE_DELIVERY_PATTERNS);
  const providerRequest = hasAny(body, PROVIDER_PATTERNS);
  const buyerContext = hasAny(body, DECISION_PATTERNS);
  const nonServiceContext = hasAny(body, NON_SERVICE_CONTEXT_PATTERNS);
  const promotionalContext = hasAny(body, PROMOTIONAL_PATTERNS);
  const hasRelevantNeed = concepts.length > 0 || goalMatches > 0;
  const serviceSeeking = !nonServiceContext && directRequest && hasRelevantNeed && (deliveryScope || providerRequest);

  return { concepts, goalMatches, directRequest, deliveryScope, providerRequest, buyerContext, nonServiceContext, promotionalContext, serviceSeeking };
}

export function rankOpportunity(input: RankedPostInput) {
  const body = input.body.toLowerCase();
  const components: ScoreComponent[] = [];
  const hasExcludedTerm = input.excludeTerms.some(term => body.includes(term.toLowerCase()));

  if (hasExcludedTerm) {
    components.push({ label: "Excluded term present", points: -100 });
    return { score: 0, components };
  }

  const assessment = serviceIntentAssessment(body, input.includeTerms, input.goal);
  if (assessment.nonServiceContext) {
    components.push({ label: assessment.promotionalContext ? "Promotional rather than request-led" : "Non-service context", points: -100 });
    return { score: 0, components };
  }

  if (!assessment.serviceSeeking) {
    if (assessment.concepts.length) components.push({ label: `Topic mention · ${assessment.concepts.length} monitored concept${assessment.concepts.length === 1 ? "" : "s"}`, points: 8 });
    components.push({ label: "No clear service-seeking intent", points: -40 });
    return { score: 0, components };
  }

  const topicPoints = Math.min(18, assessment.concepts.reduce((total, term) => total + (term.trim().includes(" ") ? 12 : 6), 0));
  if (topicPoints) components.push({ label: `Topic fit · ${assessment.concepts.length} monitored concept${assessment.concepts.length === 1 ? "" : "s"}`, points: topicPoints });

  components.push({ label: "Direct service request", points: 42 });
  if (assessment.deliveryScope) components.push({ label: "Defined task or service need", points: 18 });
  if (assessment.providerRequest) components.push({ label: "Provider or expert requested", points: 10 });
  if (assessment.goalMatches >= 3) components.push({ label: "Matches desired outcome context", points: 8 });
  else if (assessment.goalMatches >= 1) components.push({ label: "Partial desired outcome context", points: 4 });
  if (hasAny(body, URGENCY_PATTERNS)) components.push({ label: "Timing signal", points: 8 });
  if (assessment.buyerContext) components.push({ label: "Buyer or decision-maker context", points: 12 });

  const hasSpecificity = /\d|\?|\bfor (my|our|a)\b|\bworkflow\b|\bproject\b|\bbrief\b|\bbudget\b/.test(body);
  if (hasSpecificity) components.push({ label: "Specific usable context", points: 6 });

  if (body.trim().length < 55 || /^https?:\/\//.test(body.trim())) components.push({ label: "Low-context post", points: -12 });

  const ageHours = Math.max(0, (Date.now() - input.postedAt.getTime()) / 3_600_000);
  const recency = ageHours <= 1 ? 10 : ageHours <= 6 ? 7 : ageHours <= 24 ? 4 : ageHours <= 72 ? 2 : 0;
  if (recency) components.push({ label: "Fresh enough to act on", points: recency });

  const engagementTotal = Object.values(input.engagement).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (engagementTotal >= 100) components.push({ label: "Strong public engagement", points: 4 });
  else if (engagementTotal >= 15) components.push({ label: "Early engagement signal", points: 2 });

  if (input.aiLabel === "Active help-seeking" && (input.aiConfidence ?? 0) >= 0.8) components.push({ label: "High-confidence intent support", points: 4 });

  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, component) => sum + component.points, 0))));
  return { score, components };
}

export function deterministicIntent(body: string, includeTerms: string[], goal = "") {
  const normalized = body.toLowerCase();
  const assessment = serviceIntentAssessment(normalized, includeTerms, goal);
  const isActive = assessment.serviceSeeking;
  const isRelevant = !assessment.nonServiceContext && (assessment.concepts.length > 0 || assessment.goalMatches >= 2);
  const confidence = isActive
    ? Math.min(0.94, 0.58 + assessment.concepts.length * 0.08 + (assessment.deliveryScope ? 0.12 : 0) + (assessment.buyerContext ? 0.08 : 0))
    : isRelevant
      ? Math.min(0.48, 0.14 + assessment.concepts.length * 0.08 + assessment.goalMatches * 0.04)
      : 0.08;
  return {
    label: isActive ? "Active help-seeking" : isRelevant ? "Potentially relevant" : "Low-intent mention",
    confidence: Math.max(0.05, Math.round(confidence * 100) / 100),
    rationale: isActive
      ? "The post expresses a concrete need for a person, provider, or expert to deliver a relevant service."
      : isRelevant
        ? "The post overlaps with the monitored topic or outcome but does not clearly seek a provider or service."
        : "The post does not show a relevant service-seeking need for this monitoring goal.",
    model: "deterministic fallback",
    fallback: true,
  };
}
