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
  return discoveryTerms([...terms, ...expansions]);
}

const PRIMARY_SERVICE_REQUEST_QUERY = '("looking for a developer" OR "looking for someone to build" OR "looking for an automation expert" OR "looking for an AI expert" OR "looking for an agency" OR "need a developer to" OR "need someone to build" OR "need someone to automate" OR "need an automation expert")';
const SECONDARY_SERVICE_REQUEST_QUERY = '("can anyone recommend a developer" OR "can anyone recommend an automation" OR "does anyone know a developer" OR "does anyone know an automation expert" OR "recommend an automation consultant" OR "looking to outsource")';
const TERTIARY_SERVICE_REQUEST_QUERY = '("need help automating" OR "need someone to automate" OR "need someone to build" OR "help me automate" OR "help us automate" OR "need an AI workflow" OR "need an AI agent")';
const OBSERVED_PROVIDER_NOISE_TERMS = ["job", "hiring", "full-time", "salary", "internship", "apply", "course", "training", "webinar", "podcast", "giveaway"];

export type CoverageQueryFamilyId = "direct_demand" | "task_help" | "recommendation";

export type CoverageQueryFamily = {
  id: CoverageQueryFamilyId;
  query: string;
  priority: number;
};

function buildBoundedDemandQuery(includeTerms: string[], excludeTerms: string[], buyerSignals: string) {
  const topics = discoveryTerms(includeTerms).slice(0, 5);
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
  if (/looking for (someone|a freelancer|an agency|a developer|a tester|a designer|a creator|an editor)|need (someone|a freelancer|an agency|a developer|a tester|a designer)|need a hand with|looking to hire|seeking a provider|does anyone know a (developer|agency|freelancer)|recommendations for an? (developer|agency|freelancer)/.test(normalized)) return normalized;
  return `${normalized} ${PRIMARY_SERVICE_REQUEST_QUERY}`.slice(0, 1024).trim();
}
