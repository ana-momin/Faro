export type QueryValidation = {
  valid: boolean;
  normalizedQuery: string;
  errors: string[];
};

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function uniqueTerms(terms: string[]) {
  return Array.from(new Set(terms.map(term => term.trim()).filter(Boolean))).slice(0, 20);
}

const DISCOVERY_NOISE_TERMS = new Set([
  "a", "an", "and", "find", "for", "from", "help", "looking", "need", "needs", "of", "operator", "operators", "or", "people", "person", "provider", "providers", "service", "services", "someone", "the", "to", "who", "with",
]);

function discoveryTerms(terms: string[]) {
  return uniqueTerms(terms)
    .map(term => term.replace(/\s+/g, " ").trim())
    .filter(term => term.length > 1 && !DISCOVERY_NOISE_TERMS.has(term.toLowerCase()))
    .slice(0, 8);
}

function quoteTerm(term: string) {
  return /\s/.test(term) ? `"${term.replaceAll('"', "")}"` : term;
}

export function buildXQuery(includeTerms: string[], excludeTerms: string[]) {
  const includes = uniqueTerms(includeTerms);
  const excludes = uniqueTerms(excludeTerms);
  const includeClause = includes.length > 1
    ? `(${includes.map(quoteTerm).join(" OR ")})`
    : includes.map(quoteTerm).join("");
  const excludeClause = excludes.map(term => `-${quoteTerm(term)}`).join(" ");
  return [includeClause, excludeClause, "-is:retweet"].filter(Boolean).join(" ").trim();
}

export function validateXQuery(query: string): QueryValidation {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const errors: string[] = [];
  if (!normalizedQuery) errors.push("Add at least one search term.");
  if (normalizedQuery.length > 1024) errors.push("Keep the query within 1,024 characters.");
  if (CONTROL_CHARACTERS.test(normalizedQuery)) errors.push("Remove control characters from the query.");

  let depth = 0;
  for (const character of normalizedQuery) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) errors.push("Close parentheses in the correct order.");
  }
  if (depth !== 0) errors.push("Balance all parentheses in the query.");

  return { valid: errors.length === 0, normalizedQuery, errors: Array.from(new Set(errors)) };
}

export function deterministicSuggestion(goal: string) {
  const normalizedGoal = goal.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const phrasePatterns = [
    /custom ai workflows?/,
    /ai workflows?/,
    /ai-generated ugc videos?/,
    /ugc videos?/,
    /video creation/,
    /workflow automation/,
    /automation/,
  ];
  const extractedPhrases = phrasePatterns
    .filter(pattern => pattern.test(normalizedGoal))
    .map(pattern => normalizedGoal.match(pattern)?.[0] ?? "");
  const usefulWords = normalizedGoal
    .split(" ")
    .filter(word => word.length > 2 && !["looking", "someone", "people", "with", "that", "need", "help", "build", "building", "want", "asking", "for", "find", "who", "operators", "operator", "provider", "providers"].includes(word));
  const includeTerms = expandServiceDiscoveryTerms(goal, extractedPhrases.length ? extractedPhrases : usefulWords);
  const actionTerms = ["looking for someone", "looking for a freelancer", "looking for an agency", "looking for a developer", "looking for a tester", "looking for a designer", "looking for a creator", "looking for an editor", "need someone", "need a freelancer", "need an agency", "need a developer", "need a tester", "need a designer", "need an expert", "need help with", "need a hand with", "need help building", "need help automating", "looking to hire", "want to hire", "recommend an agency", "recommend a freelancer", "does anyone know a developer", "does anyone know an agency", "does anyone know a freelancer", "recommendations for a developer", "recommendations for an agency", "can someone build", "can someone automate", "who can build", "seeking a provider"];
  const topicClause = includeTerms.length > 1
    ? `(${includeTerms.map(quoteTerm).join(" OR ")})`
    : quoteTerm(includeTerms[0] ?? "automation");
  const intentClause = `(${actionTerms.map(quoteTerm).join(" OR ")})`;
  return {
    includeTerms: includeTerms.length ? includeTerms : ["automation", "AI"],
    excludeTerms: ["job", "hiring", "salary", "internship", "giveaway", "co-founder", "course", "tutorial", "podcast"],
    categories: ["service request"],
    xQuery: buildServiceDemandQuery(includeTerms.length ? includeTerms : ["automation", "AI"], ["job", "hiring", "salary", "internship", "giveaway", "co-founder", "course", "tutorial", "podcast"]),
    rationale: "Deterministic keyword extraction was used because the AI suggestion service was unavailable.",
    model: "deterministic fallback",
    fallback: true,
  };
}

export function expandServiceDiscoveryTerms(goal: string, terms: string[]) {
  const normalized = goal.toLowerCase();
  const expansions: string[] = [];
  if (/custom ai workflows?|ai workflows?/.test(normalized)) expansions.push("custom ai workflow", "ai workflow", "automation", "automate", "ai agent");
  if (/automation|automate/.test(normalized)) expansions.push("automation", "automate", "workflow", "ai agent", "operations");
  if (/ai video|video creation|ugc video/.test(normalized)) expansions.push("ai video", "video production", "video editor", "ugc video", "video automation");
  if (/product test|user test|qa|quality assurance|bug test|validate/.test(normalized)) expansions.push("product testing", "user testing", "qa testing", "quality assurance", "bug testing");
  if (/contest|competition|challenge|bounty/.test(normalized)) expansions.push("contest submission", "competition entry", "bounty task", "challenge project");
  if (/content|social|post|posting|distribution|creator/.test(normalized)) expansions.push("social media content", "content creation", "content posting", "creator", "distribution");
  if (/developer|development|software|app|website|integration|api/.test(normalized)) expansions.push("software development", "app development", "web development", "api integration", "developer");
  if (/research|design|prototype|product/.test(normalized)) expansions.push("product research", "product design", "prototype", "user research", "product testing");
  // Curated expansions are known-good search vocabulary; put them ahead of caller-supplied terms
  // (which may come from an LLM and can include awkward multi-word phrasing) so they aren't
  // crowded out of discoveryTerms' slice(0, 8) before preferBroadTermsFirst even gets a look.
  return discoveryTerms([...expansions, ...terms]);
}

// Short phrase fragments deliberately replace long exact multi-word phrases here: X's search
// treats a quoted phrase as a strict consecutive-word match, so a list of ~20 specific 3-6 word
// phrases (e.g. "looking for an automation expert") only matches that literal wording and misses
// the countless ways real people actually phrase a request. A 2-word fragment like "looking for"
// matches every one of those variants at once, giving the provider query real recall while the
// LLM-backed classification pipeline (server/monitoring/ai.ts, ranking.ts) supplies the precision
// that used to be attempted here.
const PRIMARY_SERVICE_REQUEST_QUERY = '("looking for" OR "need someone" OR "need a developer" OR "need a provider" OR "need a team" OR "looking to hire" OR "looking to outsource")';
const SECONDARY_SERVICE_REQUEST_QUERY = '("can anyone recommend" OR "does anyone know" OR "any recommendations" OR "who should I hire" OR "who can help" OR recommend)';
const TERTIARY_SERVICE_REQUEST_QUERY = '("need help" OR "help me automate" OR "help us automate" OR "could use help" OR "who can build" OR "can someone")';
const OBSERVED_PROVIDER_NOISE_TERMS = ["job", "hiring", "full-time", "salary", "internship", "apply", "course", "training", "webinar", "podcast", "giveaway"];

export type CoverageQueryFamilyId = "direct_demand" | "task_help" | "recommendation";

export type CoverageQueryFamily = {
  id: CoverageQueryFamilyId;
  query: string;
  priority: number;
};

/**
 * A single-word term matches broadly (X search treats it as a standalone token match anywhere
 * in the tweet); a multi-word term gets quoted and must match that exact consecutive wording,
 * so it only ever finds tweets phrased that precisely. Putting single-word terms first here
 * means the top-N cutoff below keeps the reliably-matching terms even when an upstream source
 * (an LLM, or a goal-driven expansion) also proposed several riskier multi-word phrases.
 */
function preferBroadTermsFirst(terms: string[]) {
  return [...terms].sort((left, right) => Number(/\s/.test(left)) - Number(/\s/.test(right)));
}

function buildBoundedDemandQuery(includeTerms: string[], excludeTerms: string[], buyerSignals: string) {
  const topics = preferBroadTermsFirst(discoveryTerms(includeTerms)).slice(0, 5);
  const topicClause = topics.length > 1 ? `(${topics.map(quoteTerm).join(" OR ")})` : quoteTerm(topics[0] ?? "automation");
  const exclusions = uniqueTerms([...OBSERVED_PROVIDER_NOISE_TERMS, ...excludeTerms]).slice(0, 12).map(term => `-${quoteTerm(term)}`).join(" ");
  const query = [topicClause, buyerSignals, exclusions, "-is:retweet"].filter(Boolean).join(" ");
  return query.length <= 1024 ? query : `${quoteTerm(topics[0] ?? "automation")} ${buyerSignals} -is:retweet`;
}

export function buildServiceDemandQuery(includeTerms: string[], excludeTerms: string[] = []) {
  return buildBoundedDemandQuery(includeTerms, excludeTerms, PRIMARY_SERVICE_REQUEST_QUERY);
}

/**
 * Named families let the collection dispatcher persist an independent cursor
 * for every query rather than losing progress when it changes family.
 */
export function buildCoverageQueryFamilies(includeTerms: string[], excludeTerms: string[] = []): CoverageQueryFamily[] {
  const candidates: CoverageQueryFamily[] = [
    { id: "direct_demand", query: buildBoundedDemandQuery(includeTerms, excludeTerms, PRIMARY_SERVICE_REQUEST_QUERY), priority: 1 },
    { id: "task_help", query: buildBoundedDemandQuery(includeTerms, excludeTerms, TERTIARY_SERVICE_REQUEST_QUERY), priority: 2 },
    { id: "recommendation", query: buildBoundedDemandQuery(includeTerms, excludeTerms, SECONDARY_SERVICE_REQUEST_QUERY), priority: 3 },
  ];
  const seen = new Set<string>();
  return candidates.filter(family => {
    if (seen.has(family.query)) return false;
    seen.add(family.query);
    return true;
  });
}

/** Backwards-compatible query-only form for callers that do not need family identity. */
export function buildCoverageQueries(includeTerms: string[], excludeTerms: string[] = []) {
  return buildCoverageQueryFamilies(includeTerms, excludeTerms).map(family => family.query);
}

export function requireServiceRequestQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return PRIMARY_SERVICE_REQUEST_QUERY;
  if (/looking for|need(?:s)? (?:someone|a hand|help)|looking to hire|looking to outsource|seeking a provider|does anyone know|any recommendations|recommend|who can/i.test(normalized)) return normalized;
  return `${normalized} ${PRIMARY_SERVICE_REQUEST_QUERY}`.slice(0, 1024).trim();
}
