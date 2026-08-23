export type RankedPostInput = {
  body: string;
  postedAt: Date;
  engagement: Record<string, number>;
  includeTerms: string[];
  excludeTerms: string[];
  aiConfidence?: number;
};

export type ScoreComponent = { label: string; points: number };

const HELP_PATTERNS = ["looking for", "need help", "recommend", "who can", "hire", "anyone know", "seeking", "need someone"];

export function rankOpportunity(input: RankedPostInput) {
  const body = input.body.toLowerCase();
  const components: ScoreComponent[] = [];
  const hasExcludedTerm = input.excludeTerms.some(term => body.includes(term.toLowerCase()));

  if (hasExcludedTerm) {
    components.push({ label: "Excluded term present", points: -100 });
    return { score: 0, components };
  }

  const matchedTerms = input.includeTerms.filter(term => body.includes(term.toLowerCase()));
  if (matchedTerms.length) components.push({ label: `Matched ${matchedTerms.length} monitored term${matchedTerms.length === 1 ? "" : "s"}`, points: Math.min(28, matchedTerms.length * 10) });
  if (HELP_PATTERNS.some(pattern => body.includes(pattern))) components.push({ label: "Explicit help-seeking language", points: 28 });

  const ageHours = Math.max(0, (Date.now() - input.postedAt.getTime()) / 3_600_000);
  const recency = ageHours <= 1 ? 18 : ageHours <= 6 ? 13 : ageHours <= 24 ? 8 : 3;
  components.push({ label: "Recency", points: recency });

  const engagementTotal = Object.values(input.engagement).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (engagementTotal >= 100) components.push({ label: "Strong engagement", points: 12 });
  else if (engagementTotal >= 15) components.push({ label: "Early engagement", points: 6 });

  if ((input.aiConfidence ?? 0) >= 0.8) components.push({ label: "High-confidence intent classification", points: 10 });
  else if ((input.aiConfidence ?? 0) >= 0.55) components.push({ label: "Intent classification support", points: 5 });

  const score = Math.max(0, Math.min(100, components.reduce((sum, component) => sum + component.points, 0)));
  return { score, components };
}

export function deterministicIntent(body: string, includeTerms: string[]) {
  const normalized = body.toLowerCase();
  const matchedTerms = includeTerms.filter(term => normalized.includes(term.toLowerCase()));
  const explicitAsk = HELP_PATTERNS.some(pattern => normalized.includes(pattern));
  const confidence = Math.min(0.92, 0.3 + matchedTerms.length * 0.13 + (explicitAsk ? 0.3 : 0));
  return {
    label: explicitAsk ? "Active help-seeking" : matchedTerms.length ? "Potentially relevant" : "Low-intent mention",
    confidence: Math.round(confidence * 100) / 100,
    rationale: explicitAsk
      ? "The post contains explicit help-seeking language and monitored terms."
      : matchedTerms.length
        ? "The post contains monitored terms but no explicit request phrase."
        : "The post did not match an explicit help-seeking pattern.",
    model: "deterministic fallback",
    fallback: true,
  };
}
