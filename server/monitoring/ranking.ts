export type RankedPostInput = {
  body: string;
  postedAt: Date;
  engagement: Record<string, number>;
  includeTerms: string[];
  excludeTerms: string[];
  goal?: string;
  categories?: string[];
  aiConfidence?: number;
};

export type ScoreComponent = { label: string; points: number };

const HELP_PATTERNS = ["looking for", "need help", "recommend", "who can", "hire", "anyone know", "seeking", "need someone", "can anyone", "any suggestions"];
const DECISION_PATTERNS = ["our team", "my team", "our business", "my business", "our company", "client", "clients", "founder", "agency", "small business", "budget", "project", "for us"];
const PROMOTIONAL_PATTERNS = ["book a call", "dm me", "follow for", "we built", "i built", "launching", "limited offer", "sign up", "buy now", "check out my"];
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

export function rankOpportunity(input: RankedPostInput) {
  const body = input.body.toLowerCase();
  const components: ScoreComponent[] = [];
  const hasExcludedTerm = input.excludeTerms.some(term => body.includes(term.toLowerCase()));

  if (hasExcludedTerm) {
    components.push({ label: "Excluded term present", points: -100 });
    return { score: 0, components };
  }

  const matchedTerms = input.includeTerms.filter(term => body.includes(term.toLowerCase()));
  if (matchedTerms.length) {
    const points = Math.min(34, matchedTerms.reduce((total, term) => total + (term.trim().includes(" ") ? 16 : 9), 0));
    components.push({ label: `Topic fit · ${matchedTerms.length} monitored concept${matchedTerms.length === 1 ? "" : "s"}`, points });
  } else {
    components.push({ label: "Weak monitored-topic fit", points: -10 });
  }

  const coveredGoalTokens = goalCoverage(body, input.goal);
  if (coveredGoalTokens >= 3) components.push({ label: "Matches desired outcome context", points: 10 });
  else if (coveredGoalTokens >= 1) components.push({ label: "Partial desired outcome context", points: 5 });

  const explicitAsk = hasAny(body, HELP_PATTERNS);
  if (explicitAsk) components.push({ label: "Explicit help-seeking language", points: 24 });

  if (hasAny(body, DECISION_PATTERNS)) components.push({ label: "Buyer or decision-maker context", points: 8 });

  const hasSpecificity = /\d|\?|\bfor (my|our|a)\b|\bworkflow\b|\bproject\b/.test(body);
  if (hasSpecificity) components.push({ label: "Specific usable context", points: 6 });

  if (hasAny(body, PROMOTIONAL_PATTERNS) && !explicitAsk) components.push({ label: "Promotional rather than request-led", points: -20 });
  if (body.trim().length < 55 || /^https?:\/\//.test(body.trim())) components.push({ label: "Low-context post", points: -12 });

  const ageHours = Math.max(0, (Date.now() - input.postedAt.getTime()) / 3_600_000);
  const recency = ageHours <= 1 ? 14 : ageHours <= 6 ? 10 : ageHours <= 24 ? 6 : ageHours <= 72 ? 3 : 0;
  if (recency) components.push({ label: "Fresh enough to act on", points: recency });

  const engagementTotal = Object.values(input.engagement).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (engagementTotal >= 100) components.push({ label: "Strong public engagement", points: 8 });
  else if (engagementTotal >= 15) components.push({ label: "Early engagement signal", points: 4 });

  if ((input.aiConfidence ?? 0) >= 0.8) components.push({ label: "High-confidence intent support", points: 8 });
  else if ((input.aiConfidence ?? 0) >= 0.55) components.push({ label: "Intent support", points: 4 });

  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, component) => sum + component.points, 0))));
  return { score, components };
}

export function deterministicIntent(body: string, includeTerms: string[], goal = "") {
  const normalized = body.toLowerCase();
  const matchedTerms = includeTerms.filter(term => normalized.includes(term.toLowerCase()));
  const explicitAsk = hasAny(normalized, HELP_PATTERNS);
  const desiredOutcomeTokens = goalCoverage(normalized, goal);
  const promotional = hasAny(normalized, PROMOTIONAL_PATTERNS);
  const isActive = explicitAsk && matchedTerms.length > 0;
  const isRelevant = matchedTerms.length > 0 || desiredOutcomeTokens >= 2;
  const confidence = Math.min(0.94, 0.16 + matchedTerms.length * 0.15 + (explicitAsk ? 0.3 : 0) + Math.min(0.15, desiredOutcomeTokens * 0.05) - (promotional && !explicitAsk ? 0.08 : 0));
  return {
    label: isActive ? "Active help-seeking" : isRelevant ? "Potentially relevant" : "Low-intent mention",
    confidence: Math.max(0.05, Math.round(confidence * 100) / 100),
    rationale: isActive
      ? "The post combines a monitored topic with an expressed need that fits this monitoring goal."
      : isRelevant
        ? "The post overlaps with the monitored topic or desired outcome, but does not clearly ask for help."
        : "The post does not show enough topic and outcome fit for this monitoring goal.",
    model: "deterministic fallback",
    fallback: true,
  };
}
