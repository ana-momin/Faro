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
const LLM_TIMEOUT_MS = 12_000;
const LLM_BATCH_TIMEOUT_MS = 20_000;
// Whole-run ceiling for classifying one sync's candidates. A sync also has to fetch provider pages
// (paced ~5.2s apart) and write results, all inside the serverless function limit, so classification
// gets a bounded slice rather than an open-ended one: once it is spent, the posts still waiting are
// scored deterministically instead of the request dying at the platform timeout with nothing saved.
const INTENT_CLASSIFICATION_BUDGET_MS = 25_000;
// Deliberately low. The bottleneck is the provider's rate limit, not local parallelism: at 4
// concurrent batched requests the API returned enough 429s that retry backoff made a full sync
// slower AND cost some chunks their model verdict entirely. Fewer, larger, calmer requests
// classify the same posts faster and more reliably.
const MAX_CONCURRENT_LLM_CALLS = 2;
// Classifying posts one-per-request meant a 37-candidate batch fired 37 separate calls; batching
// turns that into a handful, which keeps the whole sync inside the serverless function budget.
// Kept bounded so one malformed or rate-limited response only costs this many posts a model
// verdict (they fall back to deterministic individually, never the whole run).
const INTENT_BATCH_SIZE = 12;

// Only words that plausibly describe employment/promo noise, never delivery-work vocabulary.
const SAFE_NOISE_EXCLUDE_TERM = /^[a-z0-9][a-z0-9 -]{1,30}$/i;
// "hir" (not "hire") so this also catches "hiring" - hire/hiring aren't the same root by simple
// suffix stripping (hire -> hiring drops the "e"), and "hiring" is extremely common inside a
// genuine buyer ask ("thinking about hiring someone to build...") as well as in job-post noise.
// "job" is included for the same reason - the LLM proposes it as an excludeTerm on almost every
// brief, but it appears just as often inside a genuine task-scoped ask ("a quick automation job
// for us") as inside real job-post noise, which NON_SERVICE_CONTEXT_PATTERNS already catches
// contextually ("job opening", "hiring a", "apply now") without a blind substring veto.
const BUYER_SIGNAL_WORD = /\b(freelance|freelancer|hir|agency|developer|expert|consultant|specialist|provider|build|automat|workflow|recommend|looking|need|seek|help|creator|editor|design|test|video|content|ai|agent|job)\w*\b/i;

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

/**
 * Runs one LLM request under both the concurrency cap and a request timeout.
 *
 * The timeout deliberately starts INSIDE the slot. Wrapping the other way around -
 * withTimeout(withLLMSlot(run)) - charges time spent waiting in the concurrency queue against the
 * request's own budget, so once a sync had more candidates than MAX_CONCURRENT_LLM_CALLS, the
 * posts at the back of the queue "timed out" before their request was ever sent. Every one of
 * those then silently fell back to the strict deterministic classifier, which is why a 37-candidate
 * batch could save a single post: the model never actually saw most of them.
 */
function withLLMRequest<T>(run: () => Promise<T>, timeoutMs: number | (() => number) = LLM_TIMEOUT_MS): Promise<T> {
  return withLLMSlot(() => {
    // Resolved here, inside the slot, so a caller can budget against time remaining at the moment
    // the request starts rather than the moment it was queued.
    const budget = typeof timeoutMs === "function" ? timeoutMs() : timeoutMs;
    if (budget <= 1_000) throw new Error("LLM time budget exhausted before the request could start");
    return withTimeout(run(), budget);
  });
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
  const response = await withLLMRequest(() =>
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
              "includeTerms must all be about WHAT is being requested (the subject/deliverable), never HOW someone is asking for it - never propose a buyer-intent phrase itself (\"looking for\", \"need\", \"want\", \"help\", \"hire\") as an includeTerm; that vocabulary is handled separately and only dilutes the topic. " +
              "The single most important, most specific term describing the brief's subject must always be includeTerms[0], even if the brief is short (e.g. brief \"ai agent\" -> includeTerms[0] must be \"AI agent\" or \"AI agents\", never a generic verb like \"build\" or \"automate\"). " +
              'Respond with ONLY a JSON object shaped exactly like {"includeTerms": string[], "excludeTerms": string[], "categories": string[], "rationale": string}. No markdown, no extra keys.\n\n' +
              'Example - brief: "Find operators who need someone to automate repetitive business workflows." ' +
              '→ good includeTerms: ["automation", "automate", "workflow", "business process", "operations"]. ' +
              '→ bad includeTerms (never do this): ["need automation", "automation for", "automate workflows", "build a bot", "looking for", "help"].',
          },
          {
            role: "user",
            content: `Buyer-service search brief: "${goal}"\n\nReturn 3-8 includeTerms (mostly single words, at most 1-2 short natural multi-word terms) describing the deliverable being requested, 3-8 excludeTerms that filter out noise (e.g. job, hiring, salary, course), up to 3 short categories, and a one-sentence rationale.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
      }),
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

export type PostIntent = {
  label: (typeof INTENT_LABELS)[number];
  confidence: number;
  rationale: string;
  model: string;
  fallback: boolean;
};

const INTENT_CLASSIFIER_RULES =
  "You classify public X (Twitter) posts for a buyer-side social-listening tool. Faro only wants posts where the author, their team, or their company has a SPECIFIC, PERSONAL need and is asking someone else to deliver real work FOR THEM: build, automate, develop, test, design, edit, or otherwise provide a service. " +
  "Exclude: the author offering their own services, a job/employment listing, a co-founder search, a course, or generic topic discussion. " +
  "Also exclude promotional or marketing content, INCLUDING a rhetorical question addressed to a broad audience that the author then answers themselves (e.g. \"who can build with X? Anyone can!\") - that is advertising a product/tool to everyone, not a personal request for someone to do work for the author.\n\n" +
  'Example - NOT active help-seeking (promotional rhetorical question, not a personal request): "WHO CAN BUILD WITH [tool]? The answer is simple: almost anyone willing to experiment. You could be a beginner discovering AI for the first time..." ' +
  'Example - IS active help-seeking (a specific personal ask): "We need a contract developer to integrate an AI workflow into our product this month, budget approved."';

const batchIntentSchema = z.object({
  results: z
    .array(
      z.object({
        index: z.number().int(),
        label: z.enum(INTENT_LABELS),
        confidence: z.number().transform(value => Math.max(0, Math.min(1, value))),
        rationale: z.string().trim().transform(value => value.slice(0, 300)).default(""),
      }),
    )
    .default([]),
});

function deterministicIntentResult(body: string, monitor: MonitorIntentContext): PostIntent {
  return { ...deterministicIntent(body, monitor.includeTerms, monitor.goal), model: DISCLOSED_MODEL, fallback: true };
}

/** Classifies one chunk of posts in a single request; indexes in the reply are 1-based. */
async function llmClassifyBatch(bodies: string[], monitor: MonitorIntentContext, deadline: number): Promise<Array<PostIntent | undefined>> {
  const numbered = bodies.map((body, index) => `Post ${index + 1}:\n"""${body.slice(0, 600)}"""`).join("\n\n");
  // The remaining budget is read inside the concurrency slot, i.e. when this request actually
  // starts rather than when it was queued, so a chunk waiting its turn is never charged for time
  // it spent waiting - and never starts a request it has no time left to finish.
  const response = await withLLMRequest(
    () =>
      invokeLLM({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content:
              INTENT_CLASSIFIER_RULES +
              '\n\nYou are given several numbered posts. Classify EACH one independently. Respond with ONLY a JSON object shaped exactly like {"results": [{"index": 1, "label": "Active help-seeking" | "Potentially relevant" | "Low-intent mention", "confidence": number between 0 and 1, "rationale": string}]}. ' +
              'Include exactly one result per post, and set "index" to that post\'s number. Keep each rationale to one short sentence. No markdown, no extra keys.',
          },
          {
            role: "user",
            content: `Monitoring goal: "${monitor.goal}"\nMonitored topics: ${monitor.includeTerms.join(", ") || "none"}\n\n${numbered}\n\nClassify all ${bodies.length} post(s) above and return exactly ${bodies.length} result object(s).`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: Math.min(4_000, 260 * bodies.length + 200),
      }),
    () => Math.min(LLM_BATCH_TIMEOUT_MS, deadline - Date.now()),
  );
  const raw = firstMessageText(response.choices[0]?.message?.content);
  const parsed = batchIntentSchema.parse(JSON.parse(raw));
  const byIndex = new Map(parsed.results.map(result => [result.index, result]));
  return bodies.map((_, index) => {
    const result = byIndex.get(index + 1);
    if (!result) return undefined;
    return {
      label: result.label,
      confidence: Math.max(0.05, Math.round(result.confidence * 100) / 100),
      rationale: result.rationale || "LLM-assessed buyer intent.",
      model: LLM_DISCLOSED_MODEL,
      fallback: false,
    };
  });
}

/**
 * Classifies every candidate post for one sync. Posts are sent in small batched requests rather
 * than one request each, and any post the model does not return a usable verdict for falls back to
 * the deterministic classifier individually - a single bad chunk never costs the whole run.
 */
export async function classifyPostIntents(bodies: string[], monitor: MonitorIntentContext, options: { budgetMs?: number } = {}): Promise<PostIntent[]> {
  if (!bodies.length) return [];
  if (!llmEnabled()) return bodies.map(body => deterministicIntentResult(body, monitor));

  const deadline = Date.now() + Math.max(0, options.budgetMs ?? INTENT_CLASSIFICATION_BUDGET_MS);
  const chunks: string[][] = [];
  for (let start = 0; start < bodies.length; start += INTENT_BATCH_SIZE) {
    chunks.push(bodies.slice(start, start + INTENT_BATCH_SIZE));
  }
  const classified = await Promise.all(
    chunks.map(async chunk => {
      try {
        return await llmClassifyBatch(chunk, monitor, deadline);
      } catch (error) {
        console.warn("[Faro ai] batched classifyPostIntents call failed; using deterministic fallback for this chunk", error);
        return chunk.map(() => undefined);
      }
    }),
  );
  return chunks.flatMap((chunk, chunkIndex) =>
    chunk.map((body, offset) => classified[chunkIndex]?.[offset] ?? deterministicIntentResult(body, monitor)),
  );
}

export async function classifyPostIntent(body: string, monitor: MonitorIntentContext): Promise<PostIntent> {
  const [intent] = await classifyPostIntents([body], monitor);
  return intent ?? deterministicIntentResult(body, monitor);
}
