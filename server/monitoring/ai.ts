import { z } from "zod";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { buildServiceDemandQuery, deterministicSuggestion, expandServiceDiscoveryTerms } from "./query";
import { deterministicIntent } from "./ranking";

export const DISCLOSED_MODEL = "Faro deterministic buyer-intent rules";
export const LLM_DISCLOSED_MODEL = "Faro LLM buyer-intent classifier";

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

const LLM_MODEL = process.env.FARO_LLM_MODEL?.trim() || "qwen/qwen3.8-27b";
const LLM_TIMEOUT_MS = 8_000;
const MAX_CONCURRENT_LLM_CALLS = 4;

// Only words that plausibly describe employment/promo noise, never delivery-work vocabulary.
const SAFE_NOISE_EXCLUDE_TERM = /^[a-z0-9][a-z0-9 -]{1,30}$/i;
// "hir" (not "hire") so this also catches "hiring" - hire/hiring aren't the same root by simple
// suffix stripping (hire -> hiring drops the "e"), and "hiring" is extremely common inside a
// genuine buyer ask ("thinking about hiring someone to build...") as well as in job-post noise.
const BUYER_SIGNAL_WORD = /\b(freelance|freelancer|hir|agency|developer|expert|consultant|specialist|provider|build|automat|workflow|recommend|looking|need|seek|help|creator|editor|design|test|video|content|ai|agent)\w*\b/i;

function llmEnabled() {
  return !process.env.VITEST && Boolean(ENV.forgeApiKey);
}

/** Whether classifyPostIntent will actually call an LLM rather than the deterministic fallback. */
export const isLlmConfigured = llmEnabled;

let activeLLMCalls = 0;
const llmWaiters: Array<() => void> = [];

async function withLLMSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeLLMCalls >= MAX_CONCURRENT_LLM_CALLS) {
    await new Promise<void>(resolve => llmWaiters.push(resolve));
  }
  activeLLMCalls += 1;
  try {
    return await run();
  } finally {
    activeLLMCalls -= 1;
    llmWaiters.shift()?.();
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM request timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function firstMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === "string" ? part : "text" in part ? part.text : "")).join("");
  }
  return "";
}

// Only the shape needs to be trustworthy here; an over-length array or string from the model
// is truncated rather than rejected, since throwing away a whole valid classification/suggestion
// over one field running a little long just forces a needless deterministic-fallback detour.
function truncatedStringArray(maxItems: number) {
  return z.array(z.string().trim().min(1)).default([]).transform(items => items.slice(0, maxItems));
}

const suggestionSchema = z.object({
  includeTerms: truncatedStringArray(10),
  excludeTerms: truncatedStringArray(12),
  categories: truncatedStringArray(4),
  rationale: z.string().trim().transform(value => value.slice(0, 400)).default(""),
});

async function llmSuggestCriteria(goal: string): Promise<SuggestedCriteria> {
  const response = await withTimeout(
    withLLMSlot(() =>
      invokeLLM({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You extract search terms for a social-listening tool that finds X (Twitter) posts from BUYERS actively asking someone else to deliver real work: AI agents, automation, software/app development, product or QA testing, content, or video. " +
              "includeTerms become an X search query, so EVERY term must be something a real person would plausibly type verbatim in a tweet - not a phrase assembled by chopping up the brief. " +
              "Prefer short, common, single words (\"automation\", \"chatbot\", \"onboarding\") over invented multi-word phrases: a multi-word term must match EXACTLY as written, so unnatural combinations (\"automation for\", \"need automation\") will never match real tweets and are worse than useless. " +
              "Never propose terms that would mostly surface people offering their own services, job/employment listings, co-founder searches, courses, or generic topic chatter. " +
              'Respond with ONLY a JSON object shaped exactly like {"includeTerms": string[], "excludeTerms": string[], "categories": string[], "rationale": string}. No markdown, no extra keys.\n\n' +
              'Example - brief: "Find operators who need someone to automate repetitive business workflows." ' +
              '→ good includeTerms: ["automation", "automate", "workflow", "business process", "operations"]. ' +
              '→ bad includeTerms (never do this): ["need automation", "automation for", "automate workflows", "build a bot"].',
          },
          {
            role: "user",
            content: `Buyer-service search brief: "${goal}"\n\nReturn 3-8 includeTerms (mostly single words, at most 1-2 short natural multi-word terms) describing the deliverable being requested, 3-8 excludeTerms that filter out noise (e.g. job, hiring, salary, course), up to 3 short categories, and a one-sentence rationale.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
      }),
    ),
    LLM_TIMEOUT_MS,
  );
  const raw = firstMessageText(response.choices[0]?.message?.content);
  const parsed = suggestionSchema.parse(JSON.parse(raw));
  const fallbackTerms = deterministicSuggestion(goal).includeTerms;
  const includeTerms = expandServiceDiscoveryTerms(goal, parsed.includeTerms.length ? parsed.includeTerms : fallbackTerms);
  // excludeTerms are a hard -100 veto in rankOpportunity regardless of intent, so only accept
  // LLM-proposed terms that clearly can't appear inside a genuine buyer request (e.g. never
  // "freelance"/"hire", which show up constantly in real "looking for a freelancer" asks).
  const safeLlmExcludeTerms = parsed.excludeTerms.filter(term => SAFE_NOISE_EXCLUDE_TERM.test(term) && !BUYER_SIGNAL_WORD.test(term));
  // "job" and "hiring" are deliberately left out of this always-on base set: both show up
  // constantly inside genuine buyer language ("need someone for a quick automation job",
  // "thinking about hiring a developer"), and a blind substring veto vetoed real, LLM-confirmed
  // buyer posts over it. Actual job/employment listings are already caught contextually by
  // NON_SERVICE_CONTEXT_PATTERNS in ranking.ts ("hiring a", "hiring for", "job opening", "apply
  // now", "salary", "full-time", ...) and by the classification prompt's own explicit exclusion.
  const excludeTerms = Array.from(
    new Set([...safeLlmExcludeTerms, "salary", "internship", "giveaway", "co-founder", "course", "tutorial", "podcast"]),
  ).slice(0, 14);
  return {
    includeTerms: includeTerms.length ? includeTerms : ["automation", "AI"],
    excludeTerms,
    categories: parsed.categories.length ? parsed.categories : ["service request"],
    xQuery: buildServiceDemandQuery(includeTerms.length ? includeTerms : ["automation", "AI"], excludeTerms),
    rationale: parsed.rationale || "LLM-assisted buyer-intent term extraction.",
    model: LLM_DISCLOSED_MODEL,
    fallback: false,
  };
}

export async function suggestCriteria(goal: string): Promise<SuggestedCriteria> {
  if (llmEnabled()) {
    try {
      return await llmSuggestCriteria(goal);
    } catch (error) {
      console.warn("[Faro ai] suggestCriteria LLM call failed; using deterministic fallback", error);
    }
  }
  const suggestion = deterministicSuggestion(goal);
  return { ...suggestion, model: DISCLOSED_MODEL, fallback: true };
}

const INTENT_LABELS = ["Active help-seeking", "Potentially relevant", "Low-intent mention"] as const;

const intentSchema = z.object({
  label: z.enum(INTENT_LABELS),
  confidence: z.number().transform(value => Math.max(0, Math.min(1, value))),
  rationale: z.string().trim().transform(value => value.slice(0, 300)).default(""),
});

async function llmClassifyPostIntent(body: string, monitor: MonitorIntentContext) {
  const response = await withTimeout(
    withLLMSlot(() =>
      invokeLLM({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You classify a public X (Twitter) post for a buyer-side social-listening tool. Faro only wants posts where the author, their team, or their company has a SPECIFIC, PERSONAL need and is asking someone else to deliver real work FOR THEM: build, automate, develop, test, design, edit, or otherwise provide a service. " +
              "Exclude: the author offering their own services, a job/employment listing, a co-founder search, a course, or generic topic discussion. " +
              "Also exclude promotional or marketing content, INCLUDING a rhetorical question addressed to a broad audience that the author then answers themselves (e.g. \"who can build with X? Anyone can!\") - that is advertising a product/tool to everyone, not a personal request for someone to do work for the author. " +
              'Respond with ONLY a JSON object shaped exactly like {"label": "Active help-seeking" | "Potentially relevant" | "Low-intent mention", "confidence": number between 0 and 1, "rationale": string}. No markdown, no extra keys.\n\n' +
              'Example - NOT active help-seeking (promotional rhetorical question, not a personal request): "WHO CAN BUILD WITH [tool]? The answer is simple: almost anyone willing to experiment. You could be a beginner discovering AI for the first time..." ' +
              'Example - IS active help-seeking (a specific personal ask): "We need a contract developer to integrate an AI workflow into our product this month, budget approved."',
          },
          {
            role: "user",
            content: `Monitoring goal: "${monitor.goal}"\nMonitored topics: ${monitor.includeTerms.join(", ") || "none"}\n\nPost:\n"""${body.slice(0, 600)}"""\n\nClassify this post.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
    ),
    LLM_TIMEOUT_MS,
  );
  const raw = firstMessageText(response.choices[0]?.message?.content);
  const parsed = intentSchema.parse(JSON.parse(raw));
  return {
    label: parsed.label,
    confidence: Math.max(0.05, Math.round(parsed.confidence * 100) / 100),
    rationale: parsed.rationale || "LLM-assessed buyer intent.",
    model: LLM_DISCLOSED_MODEL,
    fallback: false,
  };
}

export async function classifyPostIntent(body: string, monitor: MonitorIntentContext) {
  if (llmEnabled()) {
    try {
      return await llmClassifyPostIntent(body, monitor);
    } catch (error) {
      console.warn("[Faro ai] classifyPostIntent LLM call failed; using deterministic fallback", error);
    }
  }
  const result = deterministicIntent(body, monitor.includeTerms, monitor.goal);
  return { ...result, model: DISCLOSED_MODEL, fallback: true };
}
