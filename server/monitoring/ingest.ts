import type { MonitoringCriterion } from "../../drizzle/schema";
import * as db from "../db";
import { classifyPostIntent } from "./ai";
import { rankOpportunity } from "./ranking";
import type { XApiPost, XApiUser } from "./xClient";

export async function persistNormalizedPost(monitor: MonitoringCriterion, xPost: XApiPost, users: Map<string, XApiUser>) {
  const author = xPost.author_id ? users.get(xPost.author_id) : undefined;
  const intent = await classifyPostIntent(xPost.text, monitor.includeTerms);
  const ranking = rankOpportunity({
    body: xPost.text,
    postedAt: xPost.created_at ? new Date(xPost.created_at) : new Date(),
    engagement: xPost.public_metrics ?? {},
    includeTerms: monitor.includeTerms,
    excludeTerms: monitor.excludeTerms,
    aiConfidence: intent.confidence,
  });
  await db.upsertListenedPost({
    monitorId: monitor.id,
    xPostId: xPost.id,
    authorId: xPost.author_id ?? null,
    authorHandle: author?.username ?? null,
    authorName: author?.name ?? null,
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
}
