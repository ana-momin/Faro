import { deterministicSuggestion } from "./query";
import { deterministicIntent } from "./ranking";

export const DISCLOSED_MODEL = "Faro deterministic buyer-intent rules";

type SuggestedCriteria = {
  includeTerms: string[];
  excludeTerms: string[];
  categories: string[];
  xQuery: string;
  rationale: string;
  model: string;
  fallback: boolean;
};

export type MonitorIntentContext = {
  goal: string;
  includeTerms: string[];
  excludeTerms?: string[];
  categories?: string[];
};

export async function suggestCriteria(goal: string): Promise<SuggestedCriteria> {
  const suggestion = deterministicSuggestion(goal);
  return { ...suggestion, model: DISCLOSED_MODEL, fallback: true };
}

export async function classifyPostIntent(body: string, monitor: MonitorIntentContext) {
  const result = deterministicIntent(body, monitor.includeTerms, monitor.goal);
  return { ...result, model: DISCLOSED_MODEL, fallback: true };
}
