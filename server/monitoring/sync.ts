import { createHash } from "node:crypto";
import * as db from "../db";
import type { MonitorQueryState } from "../../drizzle/renderSchema";
import { classifyPostIntents, isLlmConfigured } from "./ai";
import { persistNormalizedPost } from "./ingest";
import { notifyPreferredHighConfidenceSignals } from "./alerts";
import { collectionPolicy, type CollectionPolicy } from "./policy";
import { decryptClientCredential } from "./providerCredentials";
import { buildCoverageQueryFamilies, type CoverageQueryFamily } from "./query";
import { isPotentialBuyerOpportunity } from "./ranking";
import { XApiError, consumeFilteredStream, dedupePosts, fetchPublicPosts, filteredStreamRequested, filteredStreamWorkerEnabled, upsertFilteredStreamRule, type ClientProviderCredential, type PublicSearchResult, type XApiPost, type XApiUser } from "./xClient";

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
  provider?: ClientProviderCredential;
  queryStates?: MonitorQueryState[];
  newestId?: string | null;
  nextToken?: string | null;
  mode?: "fresh" | "continue";
  policy?: Partial<CollectionPolicy>;
};

export type MonitorSyncOptions = Partial<CollectionPolicy> & { mode?: "fresh" | "continue" };

type PageFailureMetadata = {
  familyId: string;
  queryHash: string;
  pageNumber: number;
  durationMs: number;
};

function pageFailureMetadata(error: unknown): PageFailureMetadata | undefined {
  if (!error || typeof error !== "object" || !("faroPage" in error)) return undefined;
  return (error as { faroPage?: PageFailureMetadata }).faroPage;
}

function candidatePosts(monitor: Monitor, posts: XApiPost[]) {
  const relaxedForModelReview = isLlmConfigured();
  return posts.filter(post => isPotentialBuyerOpportunity({
    body: post.text,
    postedAt: post.created_at ? new Date(post.created_at) : new Date(),
    engagement: post.public_metrics ?? {},
    includeTerms: monitor.includeTerms,
    excludeTerms: monitor.excludeTerms,
    goal: monitor.goal,
    categories: monitor.categories,
  }, { relaxedForModelReview }));
}

function queryHash(query: string) {
  return createHash("sha256").update(query).digest("hex");
}

function legacyDirectDemandState(monitor: Monitor, states: MonitorQueryState[]) {
  const legacyHash = queryHash(monitor.xQuery);
  return states.find(state => state.familyId === "direct_demand" && state.queryHash === legacyHash && Boolean(state.nextToken));
}

export function hasResumableContinuation(monitor: Monitor, states: MonitorQueryState[]) {
  const currentFamilyHashes = new Set(buildCoverageQueryFamilies(monitor.includeTerms, monitor.excludeTerms).map(family => `${family.id}:${queryHash(family.query)}`));
  return states.some(state => Boolean(state.nextToken) && (currentFamilyHashes.has(`${state.familyId}:${state.queryHash}`) || (state.familyId === "direct_demand" && state.queryHash === queryHash(monitor.xQuery))));
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
  const provider = context.provider ?? (process.env.VITEST ? { provider: "twitterapi_io" as const, credential: "test-provider-key" } : undefined);
  if (!provider) throw new XApiError(401, "Connect a provider key before collecting posts.");
  const stateByFamily = new Map((context.queryStates ?? []).map(state => [`${state.familyId}:${state.queryHash}`, state]));
  const families = buildCoverageQueryFamilies(monitor.includeTerms, monitor.excludeTerms)
    .slice(0, policy.maxQueryFamiliesPerSync);
  const plans = families.map(family => {
    const currentHash = queryHash(family.query);
    const currentState = stateByFamily.get(`${family.id}:${currentHash}`);
    const resumableLegacyState = context.mode === "continue" && family.id === "direct_demand" && !currentState
      ? legacyDirectDemandState(monitor, context.queryStates ?? [])
      : undefined;
    const requestQuery = resumableLegacyState ? monitor.xQuery : family.query;
    const hash = resumableLegacyState?.queryHash ?? currentHash;
    const legacyContextState = family.id === "direct_demand" && !context.queryStates?.length
      ? { newestPostId: context.newestId ?? null, nextToken: context.nextToken ?? null, pagesFetched: 0 }
      : undefined;
    const state = currentState ?? resumableLegacyState ?? legacyContextState;
    return {
      family: requestQuery === family.query ? family : { ...family, query: requestQuery },
      hash,
      pageCalls: 0,
      closedForCycle: false,
      nextToken: state?.nextToken ?? null,
      newestPostId: state?.newestPostId ?? null,
      pagesFetched: state?.pagesFetched ?? 0,
      lastSyncedAt: currentState?.lastSyncedAt?.getTime() ?? resumableLegacyState?.lastSyncedAt?.getTime() ?? 0,
    };
  }).sort((left, right) => left.lastSyncedAt - right.lastSyncedAt);

  const pages: CoveragePage[] = [];
  const seenIds = new Set<string>();
  let selectionIndex = 0;

  while (pages.length < policy.maxProviderCallsPerSync) {
    const eligible = plans.filter(plan => !plan.closedForCycle && plan.pageCalls < policy.maxPagesPerFamily && (context.mode !== "continue" || Boolean(plan.nextToken)));
    if (!eligible.length) break;
    const firstPass = eligible.filter(plan => plan.pageCalls === 0);
    const pool = firstPass.length ? firstPass : eligible;
    const plan = pool[selectionIndex % pool.length];
    selectionIndex += 1;
    if (!plan) break;

    const startedAt = Date.now();
    const cursor = (plan.pageCalls > 0 || context.mode === "continue") && plan.nextToken
      ? { nextToken: plan.nextToken }
      : plan.newestPostId
        ? { newestId: plan.newestPostId }
        : undefined;
    let result: PublicSearchResult;
    try {
      result = await fetchPublicPosts(plan.family.query, cursor, provider);
    } catch (error) {
      if (error && typeof error === "object") {
        (error as { faroPage?: PageFailureMetadata }).faroPage = {
          familyId: plan.family.id,
          queryHash: plan.hash,
          pageNumber: plan.pagesFetched + 1,
          durationMs: Date.now() - startedAt,
        };
      }
      throw error;
    }
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

/**
 * Turns a provider failure into a clean, human-readable outcome. Provider APIs return their own
 * raw error bodies (e.g. TwitterAPI.io: {"error":"Unauthorized","message":"Credits is not
 * enough.Please recharge"}), and providers aren't consistent about which HTTP status they use for
 * a billing problem - TwitterAPI.io has been observed returning 401 rather than 402 for this - so
 * this also pattern-matches the message text. The `message` field here, never error.message
 * directly, is what should ever reach a client-facing syncError.
 */
export function classifySyncFailure(error: unknown) {
  if (error instanceof XApiError) {
    const provider = error.message.startsWith("TwitterAPI.io:") ? "TwitterAPI.io" : "X API";
    const looksLikeCreditIssue = /credit|recharge|insufficient|quota|balance/i.test(error.message);
    if (error.status === 402 || (error.status === 401 && looksLikeCreditIssue)) {
      return { status: "payment_required" as const, label: `${provider} credit required`, message: `${provider} account is out of credits. Add credits in your provider dashboard, then try again.` };
    }
    if (error.status === 429) {
      return { status: "rate_limited" as const, label: `${provider} rate limit active`, message: `${provider} is rate-limiting requests right now. Wait a moment and try again.` };
    }
    if (error.status === 401 || error.status === 403) {
      return { status: "unauthorized" as const, label: `${provider} key invalid`, message: `${provider} rejected your saved key. Check or replace it in Settings → Provider.` };
    }
    return { status: "error" as const, label: "Sync needs attention", message: `${provider} could not complete this request right now. Please try again shortly.` };
  }
  return { status: "error" as const, label: "Sync needs attention", message: "Faro could not complete this search right now. Please try again." };
}

export async function syncMonitorRecord(monitor: Monitor, policyOverrides?: MonitorSyncOptions) {
  if (monitor.status !== "active" && policyOverrides?.mode !== "continue") return { inserted: 0, skipped: "paused" as const };
  const start = Date.now();
  const connection = await db.getProviderConnectionForUser(monitor.userId);
  if (!connection) throw new XApiError(401, "Connect a TwitterAPI.io or Official X API key in Profile before collecting posts.");
  const provider: ClientProviderCredential = {
    provider: connection.provider,
    credential: decryptClientCredential(connection.encryptedCredential),
  };
  const source = provider.provider === "twitterapi_io" ? "twitterapi_io" : "recent_search";
  // TwitterAPI.io pages are a fixed ~20 tweets each with a mandatory ~5.2s gap between requests
  // (server/monitoring/xClient.ts), and this whole call has to fit inside Vercel's 60s function
  // budget alongside LLM classification of every candidate. 4 pages (up to 2 per family) is the
  // safe ceiling within that budget - roughly a third more raw posts per search than the previous
  // 3-page cap, without risking a timeout. Beyond a single search, "Load more recent matches" lets
  // a user explicitly fetch another bounded batch on demand instead of one large, riskier request.
  const configuredPolicy = {
    ...effectivePolicy(policyOverrides),
    maxProviderCallsPerSync: Math.min(4, Math.max(1, policyOverrides?.maxProviderCallsPerSync ?? collectionPolicy().maxProviderCallsPerSync)),
    maxPagesPerFamily: 2,
    maxProviderCallsPerDay: connection.dailyRequestLimit,
  };
  const [previous, queryStates, callsToday] = await Promise.all([
    db.getSyncState(monitor.id),
    db.listMonitorQueryStates(monitor.id),
    db.countMonitorSyncRunsForUserSince(monitor.userId, utcDayStart()),
  ]);
  const remainingCallsToday = Math.max(0, configuredPolicy.maxProviderCallsPerDay - callsToday);
  if (!remainingCallsToday) {
    await db.recordSync(monitor.id, {
      source,
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
      hasMore: false,
      persistenceFailures: 0,
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
      provider,
      policy: cyclePolicy,
      mode: policyOverrides?.mode,
    });
    const users = new Map(coverage.result.users.map(user => [user.id, user]));
    const candidates = coverage.pages.flatMap(page => page.candidates.map(post => ({ page, post })));
    const owners = await db.listStoredPostOwnersForUser(monitor.userId, candidates.map(({ post }) => post.id));
    const ownerMonitorIdsByPostId = new Map<string, Set<number>>();
    for (const owner of owners) {
      const monitorIds = ownerMonitorIdsByPostId.get(owner.xPostId) ?? new Set<number>();
      monitorIds.add(owner.monitorId);
      ownerMonitorIdsByPostId.set(owner.xPostId, monitorIds);
    }
    const persistableCandidates = candidates.filter(({ post }) => {
      const existingMonitorIds = ownerMonitorIdsByPostId.get(post.id);
      return !existingMonitorIds || existingMonitorIds.has(monitor.id);
    });
    // Classify every candidate in a few batched model requests before persisting, rather than
    // letting each persist call fire its own request and queue behind the concurrency cap.
    // Whatever is left of a ~45s working window after the paced provider fetches, so the run still
    // has room to persist results and respond before the platform's function timeout.
    const classificationBudgetMs = Math.max(5_000, 45_000 - (Date.now() - start));
    const intents = await classifyPostIntents(persistableCandidates.map(({ post }) => post.text), {
      goal: monitor.goal,
      includeTerms: monitor.includeTerms,
      excludeTerms: monitor.excludeTerms,
      categories: monitor.categories,
    }, { budgetMs: classificationBudgetMs });
    const settled = await Promise.allSettled(persistableCandidates.map(({ post }, index) => persistNormalizedPost(monitor, post, users, intents[index])));
    const rejected = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    const persistedByPage = new Map<CoveragePage, number>();
    settled.forEach((outcome, index) => {
      const entry = persistableCandidates[index];
      if (entry && outcome.status === "fulfilled" && outcome.value.isNew && outcome.value.score >= 50 && outcome.value.label === "Active help-seeking") {
        persistedByPage.set(entry.page, (persistedByPage.get(entry.page) ?? 0) + 1);
      }
    });
    const persistedSignals = settled.flatMap(outcome => outcome.status === "fulfilled" && outcome.value.isNew && outcome.value.score >= 50 && outcome.value.label === "Active help-seeking" ? [outcome.value] : []);
    const inserted = persistedSignals.length;
    try {
      await notifyPreferredHighConfidenceSignals(monitor, persistedSignals);
    } catch (error) {
      console.warn("[Faro alerts]", error);
    }

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
      hasMore: coverage.pages.some(page => Boolean(page.nextToken)),
      persistenceFailures: rejected.length,
      retrieval: {
        sourceCalls: coverage.calls,
        plannedPageRequests: coverage.plannedPageRequests,
        queryFamilies: coverage.queryFamilies,
        queryFamilyBudget: coverage.queryFamilyBudget,
        pagesChecked,
        pageBudget: coverage.pageBudget,
        rawReceived: coverage.rawReceived,
        deduplicatedPosts: coverage.rawCount,
        buyerCandidates: persistableCandidates.length,
        persisted: inserted,
        queueWaitMs: coverage.result.queueWaitMs,
      },
    };
  } catch (error) {
    const state = classifySyncFailure(error);
    // The DB status columns predate the "unauthorized" classification (a plain varchar with no
    // DB-level constraint, but not worth widening for what's otherwise an internal audit field);
    // fold it into "error" there while the richer status still reaches the client via sourceState.
    const dbStatus = state.status === "unauthorized" ? "error" : state.status;
    const failedPage = pageFailureMetadata(error);
    if (failedPage) {
      await db.recordMonitorSyncRun({
        monitorId: monitor.id,
        familyId: failedPage.familyId,
        queryHash: failedPage.queryHash,
        pageNumber: failedPage.pageNumber,
        source: error instanceof XApiError && error.message.startsWith("TwitterAPI.io:") ? "twitterapi_io" : "recent_search",
        status: dbStatus,
        rawReceived: 0,
        deduplicatedPosts: 0,
        buyerCandidates: 0,
        persistedPosts: 0,
        queueWaitMs: 0,
        durationMs: failedPage.durationMs,
        error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown provider failure",
      });
    }
    await db.recordSync(monitor.id, {
      source: "recent_search",
      status: dbStatus,
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
  const optedIn: Monitor[] = [];
  for (const monitor of monitors) {
    const connection = await db.getProviderConnectionForUser(monitor.userId);
    if (connection?.automaticCollection) optedIn.push(monitor);
  }
  const results = await Promise.all(optedIn.map(async monitor => {
    try {
      return { monitorId: monitor.id, ok: true, result: await syncMonitorRecord(monitor) };
    } catch (error) {
      return { monitorId: monitor.id, ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "Unknown sync error" };
    }
  }));
  return { monitors: optedIn.length, results };
}

/**
 * Autoscale-safe polling entrypoint. It chooses the stalest active monitors
 * and processes them serially so the shared provider limiter has an auditable
 * request order and one monitor cannot dominate a scheduled invocation.
 */
export async function syncScheduledMonitorBatch() {
  const policy = collectionPolicy();
  const candidates = await db.listActiveMonitorsForPolling(policy.scheduledMonitorBatchSize * 4);
  const monitors: Monitor[] = [];
  for (const candidate of candidates) {
    const connection = await db.getProviderConnectionForUser(candidate.userId);
    if (connection?.automaticCollection) monitors.push(candidate);
    if (monitors.length >= policy.scheduledMonitorBatchSize) break;
  }
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
        status: state.status === "unauthorized" ? "error" : state.status,
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
