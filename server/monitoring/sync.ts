import { createHash } from "node:crypto";
import * as db from "../db";
import type { MonitorQueryState } from "../../drizzle/schema";
import { persistNormalizedPost } from "./ingest";
import { collectionPolicy, type CollectionPolicy } from "./policy";
import { buildCoverageQueryFamilies, type CoverageQueryFamily } from "./query";
import { isPotentialBuyerOpportunity } from "./ranking";
import { XApiError, consumeFilteredStream, dedupePosts, fetchPublicPosts, filteredStreamRequested, filteredStreamWorkerEnabled, upsertFilteredStreamRule, type PublicSearchResult, type XApiPost, type XApiUser } from "./xClient";

type Monitor = NonNullable<Awaited<ReturnType<typeof db.getMonitorForUser>>>;

type CoveragePage = {
  family: CoverageQueryFamily;
  queryHash: string;
  pageNumber: number;
  result: PublicSearchResult;
  rawReceived: number;
  deduplicatedPosts: XApiPost[];
  candidates: XApiPost[];
  nextToken: string | null;
  newestPostId: string | null;
  exhausted: "no" | "yes";
  pagesFetched: number;
  durationMs: number;
};

type FetchCoverageContext = {
  queryStates?: MonitorQueryState[];
  newestId?: string | null;
  nextToken?: string | null;
  policy?: Partial<CollectionPolicy>;
};

function candidatePosts(monitor: Monitor, posts: XApiPost[]) {
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

function queryHash(query: string) {
  return createHash("sha256").update(query).digest("hex");
}

function effectivePolicy(overrides?: Partial<CollectionPolicy>) {
  return { ...collectionPolicy(), ...overrides };
}

function utcDayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Executes a fair bounded cycle across all discovery families. The first page
 * of every family is collected before a family receives a continuation page;
 * each continuation cursor remains independent in the database.
 */
export async function fetchCreditAwarePosts(monitor: Monitor, context: FetchCoverageContext = {}) {
  const policy = effectivePolicy(context.policy);
  const stateByFamily = new Map((context.queryStates ?? []).map(state => [`${state.familyId}:${state.queryHash}`, state]));
  const families = buildCoverageQueryFamilies(monitor.includeTerms, monitor.excludeTerms)
    .slice(0, policy.maxQueryFamiliesPerSync);
  const plans = families.map(family => {
    const hash = queryHash(family.query);
    const legacyState = family.id === "direct_demand" && !context.queryStates?.length
      ? { newestPostId: context.newestId ?? null, nextToken: context.nextToken ?? null, pagesFetched: 0 }
      : undefined;
    const state = stateByFamily.get(`${family.id}:${hash}`) ?? legacyState;
    return {
      family,
      hash,
      pageCalls: 0,
      closedForCycle: false,
      nextToken: state?.nextToken ?? null,
      newestPostId: state?.newestPostId ?? null,
      pagesFetched: state?.pagesFetched ?? 0,
    };
  });

  const pages: CoveragePage[] = [];
  const seenIds = new Set<string>();
  let selectionIndex = 0;

  while (pages.length < policy.maxProviderCallsPerSync) {
    const eligible = plans.filter(plan => !plan.closedForCycle && plan.pageCalls < policy.maxPagesPerFamily);
    if (!eligible.length) break;
    const firstPass = eligible.filter(plan => plan.pageCalls === 0);
    const pool = firstPass.length ? firstPass : eligible;
    const plan = pool[selectionIndex % pool.length];
    selectionIndex += 1;
    if (!plan) break;

    const startedAt = Date.now();
    const cursor = plan.nextToken
      ? { nextToken: plan.nextToken }
      : plan.newestPostId
        ? { newestId: plan.newestPostId }
        : undefined;
    const result = await fetchPublicPosts(plan.family.query, cursor);
    const localUnique = dedupePosts(result.posts);
    const newAcrossCycle = localUnique.filter(post => {
      if (seenIds.has(post.id)) return false;
      seenIds.add(post.id);
      return true;
    });
    const candidates = candidatePosts(monitor, newAcrossCycle);
    plan.pageCalls += 1;
    plan.pagesFetched += 1;
    plan.nextToken = result.nextToken ?? null;
    plan.newestPostId = result.newestId ?? plan.newestPostId;
    if (!plan.nextToken || plan.pageCalls >= policy.maxPagesPerFamily) plan.closedForCycle = true;
    pages.push({
      family: plan.family,
      queryHash: plan.hash,
      pageNumber: plan.pagesFetched,
      result,
      rawReceived: result.posts.length,
      deduplicatedPosts: newAcrossCycle,
      candidates,
      nextToken: plan.nextToken,
      newestPostId: plan.newestPostId,
      exhausted: plan.nextToken ? "no" : "yes",
      pagesFetched: plan.pagesFetched,
      durationMs: Date.now() - startedAt,
    });
  }

  const resultPosts = pages.flatMap(page => page.candidates);
  const resultUsers = new Map<string, XApiUser>();
  for (const page of pages) for (const user of page.result.users) resultUsers.set(user.id, user);
  const firstResult = pages[0]?.result;
  const deduplicatedPosts = pages.flatMap(page => page.deduplicatedPosts).length;
  return {
    result: {
      posts: resultPosts,
      users: Array.from(resultUsers.values()),
      newestId: pages.find(page => page.newestPostId)?.newestPostId ?? context.newestId ?? undefined,
      nextToken: pages.find(page => page.nextToken)?.nextToken ?? undefined,
      source: firstResult?.source ?? "twitterapi_io",
      latencyLabel: firstResult?.latencyLabel ?? "No provider pages were eligible",
      queueWaitMs: pages.reduce((total, page) => total + (page.result.queueWaitMs ?? 0), 0),
      providerAttempts: pages.reduce((total, page) => total + (page.result.providerAttempts ?? 1), 0),
    } satisfies PublicSearchResult,
    pages,
    calls: pages.reduce((total, page) => total + (page.result.providerAttempts ?? 1), 0),
    plannedPageRequests: policy.maxProviderCallsPerSync,
    rawCount: deduplicatedPosts,
    rawReceived: pages.reduce((total, page) => total + page.rawReceived, 0),
    candidateCount: resultPosts.length,
    queryFamilies: new Set(pages.map(page => page.family.id)).size,
    queryFamilyBudget: families.length,
    pageBudget: policy.maxProviderCallsPerSync,
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

export async function syncMonitorRecord(monitor: Monitor, policyOverrides?: Partial<CollectionPolicy>) {
  if (monitor.status !== "active") return { inserted: 0, skipped: "paused" as const };
  const start = Date.now();
  const configuredPolicy = effectivePolicy(policyOverrides);
  const [previous, queryStates, callsToday] = await Promise.all([
    db.getSyncState(monitor.id),
    db.listMonitorQueryStates(monitor.id),
    db.countMonitorSyncRunsSince(utcDayStart()),
  ]);
  const remainingCallsToday = Math.max(0, configuredPolicy.maxProviderCallsPerDay - callsToday);
  if (!remainingCallsToday) {
    await db.recordSync(monitor.id, {
      source: "twitterapi_io",
      status: "rate_limited",
      latencyLabel: "Daily source-call budget reached",
      newestPostId: previous?.newestPostId ?? null,
      nextToken: previous?.nextToken ?? null,
      lastSyncedAt: new Date(),
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      lastError: null,
      lastDurationMs: Date.now() - start,
      retryCount: previous?.retryCount ?? 0,
    });
    return {
      inserted: 0,
      source: "twitterapi_io" as const,
      skipped: "daily_budget" as const,
      retrieval: {
        sourceCalls: 0,
        plannedPageRequests: 0,
        queryFamilies: 0,
        queryFamilyBudget: configuredPolicy.maxQueryFamiliesPerSync,
        pagesChecked: 0,
        pageBudget: 0,
        rawReceived: 0,
        deduplicatedPosts: 0,
        buyerCandidates: 0,
        persisted: 0,
        queueWaitMs: 0,
      },
    };
  }
  const cyclePolicy = { ...configuredPolicy, maxProviderCallsPerSync: Math.min(configuredPolicy.maxProviderCallsPerSync, remainingCallsToday) };

  try {
    if (filteredStreamRequested()) {
      await upsertFilteredStreamRule(monitor.xQuery, `signalforge-${monitor.id}`);
    }
    const coverage = await fetchCreditAwarePosts(monitor, {
      queryStates,
      newestId: previous?.newestPostId,
      nextToken: previous?.nextToken,
      policy: cyclePolicy,
    });
    const users = new Map(coverage.result.users.map(user => [user.id, user]));
    const candidates = coverage.pages.flatMap(page => page.candidates.map(post => ({ page, post })));
    const settled = await Promise.allSettled(candidates.map(({ post }) => persistNormalizedPost(monitor, post, users)));
    const rejected = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    const persistedByPage = new Map<CoveragePage, number>();
    settled.forEach((outcome, index) => {
      const entry = candidates[index];
      if (entry && outcome.status === "fulfilled") {
        persistedByPage.set(entry.page, (persistedByPage.get(entry.page) ?? 0) + 1);
      }
    });
    const inserted = settled.length - rejected.length;

    await Promise.all(coverage.pages.map(async page => {
      await db.saveMonitorQueryState(monitor.id, {
        familyId: page.family.id,
        queryHash: page.queryHash,
        queryPreview: page.family.query.slice(0, 240),
        nextToken: page.nextToken,
        newestPostId: page.newestPostId,
        pagesFetched: page.pagesFetched,
        exhausted: page.exhausted,
        lastSyncedAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
        retryCount: 0,
      });
      await db.recordMonitorSyncRun({
        monitorId: monitor.id,
        familyId: page.family.id,
        queryHash: page.queryHash,
        pageNumber: page.pageNumber,
        source: page.result.source,
        status: "healthy",
        rawReceived: page.rawReceived,
        deduplicatedPosts: page.deduplicatedPosts.length,
        buyerCandidates: page.candidates.length,
        persistedPosts: persistedByPage.get(page) ?? 0,
        queueWaitMs: page.result.queueWaitMs ?? 0,
        durationMs: page.durationMs,
        error: null,
      });
    }));

    const pagesChecked = coverage.pages.length;
    await db.recordSync(monitor.id, {
      source: coverage.result.source,
      status: rejected.length ? "degraded" : "healthy",
      latencyLabel: `Polling · ${coverage.calls}/${coverage.pageBudget} calls · ${pagesChecked} pages · ${coverage.queryFamilies} queries`.slice(0, 80),
      newestPostId: coverage.result.newestId ?? previous?.newestPostId ?? null,
      nextToken: coverage.result.nextToken ?? null,
      lastSyncedAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: rejected.length ? rejected.map(outcome => outcome.reason instanceof Error ? outcome.reason.message : "Post normalization failed").join("; ").slice(0, 1000) : null,
      lastDurationMs: Date.now() - start,
      retryCount: 0,
    });
    return {
      inserted,
      source: coverage.result.source,
      retrieval: {
        sourceCalls: coverage.calls,
        plannedPageRequests: coverage.plannedPageRequests,
        queryFamilies: coverage.queryFamilies,
        queryFamilyBudget: coverage.queryFamilyBudget,
        pagesChecked,
        pageBudget: coverage.pageBudget,
        rawReceived: coverage.rawReceived,
        deduplicatedPosts: coverage.rawCount,
        buyerCandidates: coverage.candidateCount,
        persisted: inserted,
        queueWaitMs: coverage.result.queueWaitMs,
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

/**
 * Autoscale-safe polling entrypoint. It chooses the stalest active monitors
 * and processes them serially so the shared provider limiter has an auditable
 * request order and one monitor cannot dominate a scheduled invocation.
 */
export async function syncScheduledMonitorBatch() {
  const policy = collectionPolicy();
  const monitors = await db.listActiveMonitorsForPolling(policy.scheduledMonitorBatchSize);
  const results: Array<{ monitorId: number; ok: boolean; result?: Awaited<ReturnType<typeof syncMonitorRecord>>; error?: string }> = [];
  for (const monitor of monitors) {
    try {
      results.push({ monitorId: monitor.id, ok: true, result: await syncMonitorRecord(monitor, { maxProviderCallsPerSync: policy.scheduledProviderCallsPerMonitor, maxPagesPerFamily: 1 }) });
    } catch (error) {
      results.push({ monitorId: monitor.id, ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "Unknown sync error" });
    }
  }
  return { monitors: monitors.length, batchSize: policy.scheduledMonitorBatchSize, results };
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
