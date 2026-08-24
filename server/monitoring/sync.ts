import * as db from "../db";
import { persistNormalizedPost } from "./ingest";
import { buildCoverageQueries } from "./query";
import { isPotentialBuyerOpportunity } from "./ranking";
import { XApiError, consumeFilteredStream, dedupePosts, fetchPublicPosts, filteredStreamRequested, filteredStreamWorkerEnabled, upsertFilteredStreamRule, type PublicSearchResult, type XApiPost, type XApiUser } from "./xClient";

function candidatePosts(monitor: NonNullable<Awaited<ReturnType<typeof db.getMonitorForUser>>>, posts: XApiPost[]) {
  return posts.filter(post => isPotentialBuyerOpportunity({
    body: post.text,
    postedAt: post.created_at ? new Date(post.created_at) : new Date(),
    engagement: post.public_metrics ?? {},
    includeTerms: monitor.includeTerms,
    excludeTerms: monitor.excludeTerms,
    goal: monitor.goal,
    categories: monitor.categories,
  }));
}

export async function fetchCreditAwarePosts(
  monitor: NonNullable<Awaited<ReturnType<typeof db.getMonitorForUser>>>,
  cursor?: { newestId?: string | null; nextToken?: string | null },
) {
  const [primaryQuery] = buildCoverageQueries(monitor.includeTerms, monitor.excludeTerms);
  const continuingPage = Boolean(cursor?.nextToken);
  const primary = await fetchPublicPosts(primaryQuery, continuingPage ? { nextToken: cursor?.nextToken } : { newestId: cursor?.newestId });
  const primaryPosts = dedupePosts(primary.posts);
  const primaryCandidates = candidatePosts(monitor, primaryPosts);
  return {
    result: { ...primary, posts: primaryCandidates } satisfies PublicSearchResult,
    calls: 1,
    rawCount: primaryPosts.length,
    rawReceived: primary.posts.length,
    candidateCount: primaryCandidates.length,
    queryFamilies: 1,
  };
}

export function classifySyncFailure(error: unknown) {
  if (error instanceof XApiError) {
    const provider = error.message.startsWith("TwitterAPI.io:") ? "TwitterAPI.io" : "X API";
    if (error.status === 402) return { status: "payment_required" as const, label: `${provider} credit required` };
    if (error.status === 429) return { status: "rate_limited" as const, label: `${provider} rate limit active` };
  }
  return { status: "error" as const, label: "Sync needs attention" };
}

export async function syncMonitorRecord(monitor: NonNullable<Awaited<ReturnType<typeof db.getMonitorForUser>>>) {
  if (monitor.status !== "active") return { inserted: 0, skipped: "paused" as const };
  const start = Date.now();
  const previous = await db.getSyncState(monitor.id);

  try {
    if (filteredStreamRequested()) {
      await upsertFilteredStreamRule(monitor.xQuery, `signalforge-${monitor.id}`);
    }
    const { result, calls, rawCount, rawReceived, candidateCount, queryFamilies } = await fetchCreditAwarePosts(monitor, { nextToken: previous?.nextToken, newestId: previous?.newestPostId });
    const users = new Map(result.users.map(user => [user.id, user]));
    const settled = await Promise.allSettled(dedupePosts(result.posts).map(xPost => persistNormalizedPost(monitor, xPost, users)));
    const rejected = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    const inserted = settled.length - rejected.length;
    await db.recordSync(monitor.id, {
      source: result.source,
      status: rejected.length ? "degraded" : "healthy",
      latencyLabel: `TwitterAPI.io · ${calls} call${calls === 1 ? "" : "s"} · ${rawCount}/${rawReceived} unique · ${candidateCount} buyer${rejected.length ? ` · ${rejected.length} skipped` : ""}`.slice(0, 80),
      newestPostId: result.newestId ?? previous?.newestPostId ?? null,
      nextToken: result.nextToken ?? null,
      lastSyncedAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: rejected.length ? rejected.map(outcome => outcome.reason instanceof Error ? outcome.reason.message : "Post normalization failed").join("; ").slice(0, 1000) : null,
      lastDurationMs: Date.now() - start,
      retryCount: 0,
    });
    return {
      inserted,
      source: result.source,
      retrieval: {
        sourceCalls: calls,
        queryFamilies,
        rawReceived,
        deduplicatedPosts: rawCount,
        buyerCandidates: candidateCount,
        persisted: inserted,
      },
    };
  } catch (error) {
    const state = classifySyncFailure(error);
    await db.recordSync(monitor.id, {
      source: "recent_search",
      status: state.status,
      latencyLabel: state.label,
      newestPostId: previous?.newestPostId ?? null,
      nextToken: previous?.nextToken ?? null,
      lastSyncedAt: new Date(),
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown synchronization error",
      lastDurationMs: Date.now() - start,
      retryCount: (previous?.retryCount ?? 0) + 1,
    });
    throw error;
  }
}

export async function syncAllActiveMonitors() {
  const monitors = await db.listActiveMonitors();
  const results = await Promise.all(monitors.map(async monitor => {
    try {
      return { monitorId: monitor.id, ok: true, result: await syncMonitorRecord(monitor) };
    } catch (error) {
      return { monitorId: monitor.id, ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "Unknown sync error" };
    }
  }));
  return { monitors: monitors.length, results };
}

function monitorIdFromEventTag(tag: string | undefined) {
  const match = tag?.match(/^signalforge-(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

/** Starts only on a persistent reserved instance when explicitly enabled. */
export async function startFilteredStreamWorker() {
  if (!filteredStreamWorkerEnabled()) return;
  const monitors = await db.listActiveMonitors();
  for (const monitor of monitors) await upsertFilteredStreamRule(monitor.xQuery, `signalforge-${monitor.id}`);

  let retryAttempt = 0;
  while (true) {
    const controller = new AbortController();
    try {
      await consumeFilteredStream(controller.signal, async event => {
        const monitorId = monitorIdFromEventTag(event.matching_rules?.[0]?.tag);
        if (!monitorId || !event.data) return;
        const monitor = monitors.find(item => item.id === monitorId) ?? (await db.listActiveMonitors()).find(item => item.id === monitorId);
        if (!monitor) return;
        const users = new Map((event.includes?.users ?? []).map(user => [user.id, user]));
        await persistNormalizedPost(monitor, event.data, users);
        await db.recordSync(monitor.id, {
          source: "filtered_stream",
          status: "healthy",
          latencyLabel: "Filtered Stream · near real-time",
          newestPostId: event.data.id,
          nextToken: null,
          lastSyncedAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
          lastDurationMs: 0,
          retryCount: 0,
        });
      });
      retryAttempt = 0;
    } catch (error) {
      const state = classifySyncFailure(error);
      const active = await db.listActiveMonitors();
      await Promise.all(active.map(monitor => db.recordSync(monitor.id, {
        source: "filtered_stream",
        status: state.status,
        latencyLabel: state.label,
        newestPostId: null,
        nextToken: null,
        lastSyncedAt: new Date(),
        lastSuccessAt: null,
        lastError: error instanceof Error ? error.message.slice(0, 1000) : "Filtered Stream worker error",
        lastDurationMs: 0,
        retryCount: retryAttempt + 1,
      })));
      const waitMs = Math.min(10_000, 750 * 2 ** retryAttempt);
      retryAttempt = Math.min(retryAttempt + 1, 4);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
}
