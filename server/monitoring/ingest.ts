import type { MonitoringCriterion } from "../../drizzle/renderSchema";
import * as db from "../db";
import { classifyPostIntent, type PostIntent } from "./ai";
import { rankOpportunity } from "./ranking";
import type { XApiPost, XApiUser } from "./xClient";

/**
 * `precomputedIntent` lets a sync classify all of its candidates in a few batched model requests
 * up front (see classifyPostIntents) instead of one request per post. Callers that only ever
 * handle a single post - the filtered-stream worker - can omit it and classify inline.
 */
export async function persistNormalizedPost(monitor: MonitoringCriterion, xPost: XApiPost, users: Map<string, XApiUser>, precomputedIntent?: PostIntent) {
  const author = xPost.author_id ? users.get(xPost.author_id) : undefined;
  const intent = precomputedIntent ?? await classifyPostIntent(xPost.text, {
    goal: monitor.goal,
    includeTerms: monitor.includeTerms,
    excludeTerms: monitor.excludeTerms,
    categories: monitor.categories,
  });
  const ranking = rankOpportunity({
    body: xPost.text,
    postedAt: xPost.created_at ? new Date(xPost.created_at) : new Date(),
    engagement: xPost.public_metrics ?? {},
    includeTerms: monitor.includeTerms,
    excludeTerms: monitor.excludeTerms,
    goal: monitor.goal,
    categories: monitor.categories,
    aiConfidence: intent.confidence,
    aiLabel: intent.label,
  });
  const persisted = await db.upsertListenedPost({
    monitorId: monitor.id,
    xPostId: xPost.id,
    authorId: xPost.author_id ?? null,
    authorHandle: author?.username ?? null,
    authorName: author?.name ?? null,
    authorAvatarUrl: author?.profileImageUrl ?? null,
    body: xPost.text,
    postUrl: author?.username ? `https://x.com/${author.username}/status/${xPost.id}` : `https://x.com/i/web/status/${xPost.id}`,
    postedAt: xPost.created_at ? new Date(xPost.created_at) : new Date(),
    language: xPost.lang ?? null,
    engagement: xPost.public_metrics ?? {},
    matchedRule: monitor.xQuery,
    source: "x_api",
    ruleScore: ranking.score,
    scoreExplanation: ranking.components,
    aiIntent: intent,
  });
  return { postId: persisted.id, isNew: persisted.isNew, confidence: intent.confidence, label: intent.label, score: ranking.score, body: xPost.text, authorName: author?.name ?? author?.username ?? "Public X account" };
}
