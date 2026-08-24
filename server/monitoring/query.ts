export type QueryValidation = {
  valid: boolean;
  normalizedQuery: string;
  errors: string[];
};

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function uniqueTerms(terms: string[]) {
  return Array.from(new Set(terms.map(term => term.trim()).filter(Boolean))).slice(0, 20);
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
    .filter(word => word.length > 2 && !["looking", "someone", "people", "with", "that", "need", "help", "build", "building", "want", "asking", "for"].includes(word));
  const includeTerms = expandServiceDiscoveryTerms(goal, extractedPhrases.length ? extractedPhrases : usefulWords);
  const actionTerms = ["looking for someone", "looking for a freelancer", "looking for an agency", "need someone", "need a freelancer", "need an agency", "need an expert", "need help with", "need help building", "need help automating", "looking to hire", "want to hire", "recommend an agency", "recommend a freelancer", "can someone build", "can someone automate", "who can build", "seeking a provider"];
  const topicClause = includeTerms.length > 1
    ? `(${includeTerms.map(quoteTerm).join(" OR ")})`
    : quoteTerm(includeTerms[0] ?? "automation");
  const intentClause = `(${actionTerms.map(quoteTerm).join(" OR ")})`;
  return {
    includeTerms: includeTerms.length ? includeTerms : ["automation", "AI"],
    excludeTerms: ["job", "giveaway", "co-founder", "course", "tutorial", "podcast"],
    categories: ["service request"],
    xQuery: buildServiceDemandQuery(includeTerms.length ? includeTerms : ["automation", "AI"], ["job", "giveaway", "co-founder", "course", "tutorial", "podcast"]),
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
  return uniqueTerms([...terms, ...expansions]).slice(0, 8);
}

const SERVICE_REQUEST_QUERY = '("looking for someone" OR "looking for a freelancer" OR "looking for an agency" OR "need someone" OR "need a freelancer" OR "need an agency" OR "need help with" OR "looking to hire" OR "seeking a provider" OR "recommend a freelancer" OR "recommend an agency")';

export function buildServiceDemandQuery(includeTerms: string[], excludeTerms: string[] = []) {
  const topics = uniqueTerms(includeTerms).slice(0, 8);
  const topicClause = topics.length > 1 ? `(${topics.map(quoteTerm).join(" OR ")})` : quoteTerm(topics[0] ?? "automation");
  const exclusions = uniqueTerms(excludeTerms).map(term => `-${quoteTerm(term)}`).join(" ");
  return [topicClause, SERVICE_REQUEST_QUERY, exclusions, "-is:retweet"].filter(Boolean).join(" ").slice(0, 1024);
}

export function requireServiceRequestQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return SERVICE_REQUEST_QUERY;
  if (normalized.includes("looking for someone") || normalized.includes("need someone") || normalized.includes("looking to hire") || normalized.includes("seeking a provider")) return normalized;
  return `${normalized} ${SERVICE_REQUEST_QUERY}`.slice(0, 1024).trim();
}
