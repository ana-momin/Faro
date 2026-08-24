import { invokeLLM } from "../_core/llm";
import { buildServiceDemandQuery, deterministicSuggestion, expandServiceDiscoveryTerms, validateXQuery } from "./query";
import { deterministicIntent } from "./ranking";

export const DISCLOSED_MODEL = "gpt-5-mini";

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

export function modelTimeoutMs() {
  // Buyer-safe deterministic criteria are available, so a stalled AI brief
  // should not keep a user waiting for the old twelve-second ceiling.
  const configured = Number(process.env.SIGNALFORGE_LLM_TIMEOUT_MS ?? 4_500);
  return Number.isFinite(configured) ? Math.max(250, Math.min(configured, 30_000)) : 4_500;
}

async function withModelTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Language model response timed out.")), modelTimeoutMs());
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function asTerms(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, limit)
    : [];
}

export async function suggestCriteria(goal: string): Promise<SuggestedCriteria> {
  if (process.env.SIGNALFORGE_DISABLE_LLM === "true") return deterministicSuggestion(goal);
  try {
    const response = await withModelTimeout(invokeLLM({
      model: DISCLOSED_MODEL,
      messages: [
        {
          role: "system",
          content: "You turn a social-listening goal into a compact, safe X search suggestion. Target only public posts. Prioritize the expressed need, desired outcome, and specific high-signal phrases. Do not infer personal traits. Do not propose outreach, posting, or messaging.",
        },
        { role: "user", content: `Listening goal: ${goal}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "listening_criteria",
          strict: true,
          schema: {
            type: "object",
            properties: {
              includeTerms: { type: "array", items: { type: "string" } },
              excludeTerms: { type: "array", items: { type: "string" } },
              categories: { type: "array", items: { type: "string" } },
              xQuery: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["includeTerms", "excludeTerms", "categories", "xQuery", "rationale"],
            additionalProperties: false,
          },
        },
      },
    }));
    const content = response.choices[0]?.message.content;
    const result = typeof content === "string" ? JSON.parse(content) : null;
    const xQuery = typeof result?.xQuery === "string" ? result.xQuery : "";
    if (!result || !validateXQuery(xQuery).valid) return deterministicSuggestion(goal);
    const includeTerms = expandServiceDiscoveryTerms(goal, asTerms(result.includeTerms, 10));
    const exclusions = asTerms(result.excludeTerms, 10);
    const discoveryQuery = buildServiceDemandQuery(includeTerms, exclusions);
    return {
      includeTerms,
      excludeTerms: exclusions,
      categories: asTerms(result.categories, 5),
      xQuery: discoveryQuery,
      rationale: typeof result.rationale === "string" ? result.rationale.slice(0, 500) : "AI-generated query suggestion.",
      model: DISCLOSED_MODEL,
      fallback: false,
    };
  } catch {
    return deterministicSuggestion(goal);
  }
}

export async function classifyPostIntent(body: string, monitor: MonitorIntentContext) {
  const fallback = () => deterministicIntent(body, monitor.includeTerms, monitor.goal);
  if (process.env.SIGNALFORGE_DISABLE_LLM === "true") return fallback();
  try {
    const response = await withModelTimeout(invokeLLM({
      model: DISCLOSED_MODEL,
      messages: [
        {
          role: "system",
          content: "Classify only the expressed intent in this public social post relative to the supplied listening goal. Mark Active help-seeking only when the author appears to need a person, freelancer, agency, provider, consultant, or expert to deliver a concrete relevant service. A topical mention alone is not service-seeking. Treat promotions, educational content, tool discussions, event or podcast recommendations, job hunting, permanent hiring, co-founder searches, networking, and generic AI commentary as Potentially relevant or Low-intent mention, not Active help-seeking. Do not infer sensitive traits or identity. This is for human review only; never recommend autonomous outreach.",
        },
        { role: "user", content: `Listening goal: ${monitor.goal}\nMonitored terms: ${monitor.includeTerms.join(", ")}\nExcluded terms: ${(monitor.excludeTerms ?? []).join(", ") || "none"}\nCategories: ${(monitor.categories ?? []).join(", ") || "none"}\n\nPost: ${body}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "post_intent",
          strict: true,
          schema: {
            type: "object",
            properties: {
              label: { type: "string", enum: ["Active help-seeking", "Potentially relevant", "Low-intent mention"] },
              confidence: { type: "number" },
              rationale: { type: "string" },
            },
            required: ["label", "confidence", "rationale"],
            additionalProperties: false,
          },
        },
      },
    }));
    const content = response.choices[0]?.message.content;
    const result = typeof content === "string" ? JSON.parse(content) : null;
    if (!result || typeof result.confidence !== "number" || typeof result.label !== "string") return fallback();
    return {
      label: result.label,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      rationale: typeof result.rationale === "string" ? result.rationale.slice(0, 400) : "AI intent classification.",
      model: DISCLOSED_MODEL,
      fallback: false,
    };
  } catch {
    return fallback();
  }
}
