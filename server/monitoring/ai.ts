import { invokeLLM } from "../_core/llm";
import { deterministicSuggestion, validateXQuery } from "./query";
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

function asTerms(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, limit)
    : [];
}

export async function suggestCriteria(goal: string): Promise<SuggestedCriteria> {
  if (process.env.SIGNALFORGE_DISABLE_LLM === "true") return deterministicSuggestion(goal);
  try {
    const response = await invokeLLM({
      model: DISCLOSED_MODEL,
      messages: [
        {
          role: "system",
          content: "You turn a social-listening goal into a compact, safe X search suggestion. Target only public posts. Do not infer personal traits. Do not propose outreach, posting, or messaging.",
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
    });
    const content = response.choices[0]?.message.content;
    const result = typeof content === "string" ? JSON.parse(content) : null;
    const xQuery = typeof result?.xQuery === "string" ? result.xQuery : "";
    if (!result || !validateXQuery(xQuery).valid) return deterministicSuggestion(goal);
    return {
      includeTerms: asTerms(result.includeTerms, 10),
      excludeTerms: asTerms(result.excludeTerms, 10),
      categories: asTerms(result.categories, 5),
      xQuery,
      rationale: typeof result.rationale === "string" ? result.rationale.slice(0, 500) : "AI-generated query suggestion.",
      model: DISCLOSED_MODEL,
      fallback: false,
    };
  } catch {
    return deterministicSuggestion(goal);
  }
}

export async function classifyPostIntent(body: string, includeTerms: string[]) {
  if (process.env.SIGNALFORGE_DISABLE_LLM === "true") return deterministicIntent(body, includeTerms);
  try {
    const response = await invokeLLM({
      model: DISCLOSED_MODEL,
      messages: [
        {
          role: "system",
          content: "Classify only the expressed intent in this public social post. Do not infer sensitive traits or identity. This is for human review only; never recommend autonomous outreach.",
        },
        { role: "user", content: `Monitored terms: ${includeTerms.join(", ")}\n\nPost: ${body}` },
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
    });
    const content = response.choices[0]?.message.content;
    const result = typeof content === "string" ? JSON.parse(content) : null;
    if (!result || typeof result.confidence !== "number" || typeof result.label !== "string") return deterministicIntent(body, includeTerms);
    return {
      label: result.label,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      rationale: typeof result.rationale === "string" ? result.rationale.slice(0, 400) : "AI intent classification.",
      model: DISCLOSED_MODEL,
      fallback: false,
    };
  } catch {
    return deterministicIntent(body, includeTerms);
  }
}
