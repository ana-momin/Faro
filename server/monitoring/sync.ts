import * as db from "../db";
import { persistNormalizedPost } from "./ingest";
import { XApiError, consumeFilteredStream, dedupePosts, fetchPublicPosts, filteredStreamRequested, filteredStreamWorkerEnabled, upsertFilteredStreamRule } from "./xClient";

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
    const continuingPage = Boolean(previous?.nextToken);
    const result = await fetchPublicPosts(monitor.xQuery, continuingPage
      ? { nextToken: previous?.nextToken }
      : { newestId: previous?.newestPostId },
    );
    const users = new Map(result.users.map(user => [user.id, user]));
    const settled = await Promise.allSettled(dedupePosts(result.posts).map(xPost => persistNormalizedPost(monitor, xPost, users)));
    const rejected = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    const inserted = settled.length - rejected.length;
    await db.recordSync(monitor.id, {
      source: result.source,
      status: rejected.length ? "degraded" : "healthy",
      latencyLabel: rejected.length ? `${result.latencyLabel} · ${rejected.length} post${rejected.length === 1 ? "" : "s"} skipped` : result.latencyLabel,
      newestPostId: result.newestId ?? previous?.newestPostId ?? null,
      nextToken: result.nextToken ?? null,
      lastSyncedAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: rejected.length ? rejected.map(outcome => outcome.reason instanceof Error ? outcome.reason.message : "Post normalization failed").join("; ").slice(0, 1000) : null,
      lastDurationMs: Date.now() - start,
      retryCount: 0,
    });
    return { inserted, source: result.source };
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
