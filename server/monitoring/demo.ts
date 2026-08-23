import * as db from "../db";
import { deterministicIntent, rankOpportunity } from "./ranking";
import { buildXQuery } from "./query";

const DEMO_POSTS = [
  {
    id: "demo-automation-request-001",
    author: "Demo account",
    body: "DEMO SAMPLE — I’m looking for someone to map a lead-intake automation for a small services team. Any workflow builders to recommend?",
    engagement: { like_count: 18, reply_count: 4, repost_count: 2, quote_count: 0 },
    hoursAgo: 1,
  },
  {
    id: "demo-ai-video-request-002",
    author: "Demo account",
    body: "DEMO SAMPLE — Need help testing an AI UGC video workflow for a product launch. Who has built something practical recently?",
    engagement: { like_count: 7, reply_count: 3, repost_count: 0, quote_count: 0 },
    hoursAgo: 5,
  },
  {
    id: "demo-low-intent-003",
    author: "Demo account",
    body: "DEMO SAMPLE — Reading about AI workflows today. Interesting space, but I’m not shopping for a provider right now.",
    engagement: { like_count: 3, reply_count: 0, repost_count: 0, quote_count: 0 },
    hoursAgo: 19,
  },
];

export async function seedDemo(userId: number) {
  if (await db.hasDemoMonitor(userId)) return { created: false };
  const includeTerms = ["automation", "AI workflow", "UGC video"];
  const excludeTerms = ["not shopping", "giveaway"];
  const monitorId = await db.createMonitor({
    userId,
    name: "Demo: AI workflow requests",
    goal: "Demo-only sample criteria for public AI workflow and UGC video requests.",
    xQuery: buildXQuery(includeTerms, excludeTerms),
    includeTerms,
    excludeTerms,
    categories: ["service request", "automation", "video"],
    status: "active",
  });

  for (const post of DEMO_POSTS) {
    const postedAt = new Date(Date.now() - post.hoursAgo * 3_600_000);
    const intent = deterministicIntent(post.body, includeTerms);
    const ranking = rankOpportunity({ body: post.body, postedAt, engagement: post.engagement, includeTerms, excludeTerms, aiConfidence: intent.confidence });
    await db.upsertListenedPost({
      monitorId,
      xPostId: post.id,
      authorName: post.author,
      authorHandle: null,
      authorId: null,
      body: post.body,
      postUrl: null,
      postedAt,
      language: "en",
      engagement: post.engagement,
      matchedRule: buildXQuery(includeTerms, excludeTerms),
      source: "demo",
      ruleScore: ranking.score,
      scoreExplanation: ranking.components,
      aiIntent: intent,
    });
  }
  await db.recordSync(monitorId, {
    source: "demo",
    status: "healthy",
    latencyLabel: "Demo-only sample data",
    newestPostId: DEMO_POSTS[0].id,
    nextToken: null,
    lastSyncedAt: new Date(),
    lastSuccessAt: new Date(),
    lastError: null,
    lastDurationMs: 0,
    retryCount: 0,
  });
  return { created: true };
}
