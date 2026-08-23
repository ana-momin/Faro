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
  const includeTerms = uniqueTerms(extractedPhrases.length ? extractedPhrases : usefulWords).slice(0, 5);
  const actionTerms = ["looking for", "need help", "recommend", "hire"];
  const topicClause = includeTerms.length > 1
    ? `(${includeTerms.map(quoteTerm).join(" OR ")})`
    : quoteTerm(includeTerms[0] ?? "automation");
  const intentClause = `(${actionTerms.map(quoteTerm).join(" OR ")})`;
  return {
    includeTerms: includeTerms.length ? includeTerms : ["automation", "AI"],
    excludeTerms: ["job", "giveaway"],
    categories: ["service request"],
    xQuery: `${topicClause} ${intentClause} -job -giveaway -is:retweet`,
    rationale: "Deterministic keyword extraction was used because the AI suggestion service was unavailable.",
    model: "deterministic fallback",
    fallback: true,
  };
}
