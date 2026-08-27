import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { suggestCriteria } from "../monitoring/ai";
import { seedDemo } from "../monitoring/demo";
import { collectionPolicy } from "../monitoring/policy";
import { credentialHint, encryptClientCredential, type ClientProvider } from "../monitoring/providerCredentials";
import { deterministicSuggestion, requireServiceRequestQuery, validateXQuery } from "../monitoring/query";
import { rankOpportunity } from "../monitoring/ranking";
import { derivePreferredTopics, preferenceBoost } from "../monitoring/preferences";
import { classifySyncFailure, hasResumableContinuation, syncMonitorRecord } from "../monitoring/sync";
import { protectedProcedure, router } from "../_core/trpc";

const terms = z.array(z.string().trim().min(1).max(80)).max(20);

async function requireActiveMonitorCapacity(userId: number) {
  const policy = collectionPolicy();
  const active = await db.countActiveMonitorsForUser(userId);
  if (active >= policy.activeMonitorLimitPerUser) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Pause an existing saved search before adding another. Faro supports ${policy.activeMonitorLimitPerUser} active monitors per account.`,
    });
  }
  return { active, limit: policy.activeMonitorLimitPerUser };
}

async function requireProviderConnection(userId: number) {
  const connection = await db.getProviderConnectionForUser(userId);
  if (!connection) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Connect a TwitterAPI.io or Official X API key in Profile before collecting posts.",
    });
  }
  return connection;
}

function utcDayStart() {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart;
}

function normalizeSearchBrief(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function findSavedSearchByBrief(userId: number, brief: string) {
  const normalizedBrief = normalizeSearchBrief(brief);
  const rows = await db.listMonitorsWithSync(userId);
  return rows.find(({ monitor }) => normalizeSearchBrief(monitor.goal) === normalizedBrief)?.monitor;
}

async function requireAvailableSourceBudget(userId: number) {
  const connection = await requireProviderConnection(userId);
  const callsToday = await db.countMonitorSyncRunsForUserSince(userId, utcDayStart());
  if (callsToday >= connection.dailyRequestLimit) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Today’s provider limit of ${connection.dailyRequestLimit} source call${connection.dailyRequestLimit === 1 ? "" : "s"} has been reached. Increase the limit in Settings → Provider or try again tomorrow.`,
    });
  }
  return { connection, callsToday, remainingCalls: connection.dailyRequestLimit - callsToday };
}

export const monitoringRouter = router({
  overview: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const [monitors, storedPosts, connection, callsToday, hiddenPostIds] = await Promise.all([
        db.listMonitorsWithSync(ctx.user.id),
        db.listPostsForUser(ctx.user.id, input?.monitorId),
        db.getProviderConnectionForUser(ctx.user.id),
        db.countMonitorSyncRunsForUserSince(ctx.user.id, dayStart),
        db.listHiddenPostIdsForUser(ctx.user.id),
      ]);
      const hidden = new Set(hiddenPostIds);
      const posts = storedPosts.filter(({ post }) => !hidden.has(post.xPostId));
      const preferredTopics = derivePreferredTopics(posts);
      const rescoredPosts = posts
        .map(({ post, monitorName, monitor, savedAt }) => {
          const ranking = rankOpportunity({
            body: post.body,
            postedAt: new Date(post.postedAt),
            engagement: post.engagement,
            includeTerms: monitor.includeTerms,
            excludeTerms: monitor.excludeTerms,
            goal: monitor.goal,
            categories: monitor.categories,
            aiConfidence: post.aiIntent.confidence,
            aiLabel: post.aiIntent.label,
          });
          const preference = preferenceBoost(post.body, preferredTopics);
          const scoreExplanation = preference.points
            ? [...ranking.components, { label: "Matches your kept topics", points: preference.points }]
            : ranking.components;
          return { post: { ...post, ruleScore: Math.min(100, ranking.score + preference.points), scoreExplanation }, monitorName, monitor, savedAt };
        })
        .sort((left, right) => right.post.ruleScore - left.post.ruleScore || right.post.postedAt.getTime() - left.post.postedAt.getTime());
      const pending = rescoredPosts.filter(({ post }) => post.reviewStatus === "pending").length;
      const policy = collectionPolicy();
      const activeMonitors = monitors.filter(({ monitor }) => monitor.status === "active");
      const lastCheckedAt = monitors
        .map(({ sync }) => sync?.lastSyncedAt?.getTime() ?? 0)
        .reduce((latest, current) => Math.max(latest, current), 0);
      return {
        monitors,
        posts: rescoredPosts,
        summary: { total: rescoredPosts.length, pending, approved: rescoredPosts.filter(({ post }) => post.reviewStatus === "approved").length, saved: rescoredPosts.filter(({ savedAt }) => Boolean(savedAt)).length, preferredTopics },
        collection: {
          mode: "polling" as const,
          label: policy.pollingLabel,
          activeMonitors: activeMonitors.length,
          activeMonitorLimit: policy.activeMonitorLimitPerUser,
          scheduledMonitorBatchSize: policy.scheduledMonitorBatchSize,
          lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt) : null,
          perSyncPageBudget: policy.maxProviderCallsPerSync,
          perSyncFamilyBudget: policy.maxQueryFamiliesPerSync,
          callsToday,
          dailyCallBudget: connection?.dailyRequestLimit ?? 0,
          remainingCalls: Math.max(0, (connection?.dailyRequestLimit ?? 0) - callsToday),
          configured: Boolean(connection),
          provider: connection?.provider ?? null,
          credentialHint: connection?.credentialHint ?? null,
          strictBatch: true,
        },
      };
    }),

  providerSetup: protectedProcedure.query(async ({ ctx }) => {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [connection, callsToday] = await Promise.all([
      db.getProviderConnectionForUser(ctx.user.id),
      db.countMonitorSyncRunsForUserSince(ctx.user.id, dayStart),
    ]);
    if (!connection) return { configured: false as const, callsToday: 0, dailyRequestLimit: 20, remainingCalls: 20, strictBatch: true as const };
    return {
      configured: true as const,
      provider: connection.provider,
      credentialHint: connection.credentialHint,
      dailyRequestLimit: connection.dailyRequestLimit,
      callsToday,
      remainingCalls: Math.max(0, connection.dailyRequestLimit - callsToday),
      automaticCollection: false as const,
      strictBatch: true as const,
    };
  }),

  saveProviderSetup: protectedProcedure
    .input(z.object({ provider: z.enum(["twitterapi_io", "official_x"]), credential: z.string().trim().min(12).max(4096), dailyRequestLimit: z.number().int().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const provider = input.provider as ClientProvider;
      await db.upsertProviderConnectionForUser({
        userId: ctx.user.id,
        provider,
        encryptedCredential: encryptClientCredential(input.credential),
        credentialHint: credentialHint(input.credential),
        dailyRequestLimit: input.dailyRequestLimit,
        automaticCollection: false,
      });
      return { ok: true, provider, credentialHint: credentialHint(input.credential), dailyRequestLimit: input.dailyRequestLimit };
    }),

  updateProviderDailyLimit: protectedProcedure
    .input(z.object({ dailyRequestLimit: z.number().int().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const connection = await db.getProviderConnectionForUser(ctx.user.id);
      if (!connection) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Connect a provider before updating its daily limit." });
      await db.updateProviderDailyRequestLimitForUser(ctx.user.id, input.dailyRequestLimit);
      return { ok: true, provider: connection.provider, dailyRequestLimit: input.dailyRequestLimit };
    }),

  removeProviderSetup: protectedProcedure.mutation(async ({ ctx }) => {
    await db.deleteProviderConnectionForUser(ctx.user.id);
    return { ok: true };
  }),

  suggest: protectedProcedure
    .input(z.object({ goal: z.string().trim().min(12).max(800) }))
    .mutation(({ input }) => suggestCriteria(input.goal)),

  agentStart: protectedProcedure
    .input(z.object({ brief: z.string().trim().min(12).max(800) }))
    .mutation(async ({ ctx, input }) => {
      const savedSearch = await findSavedSearchByBrief(ctx.user.id, input.brief);
      if (savedSearch) {
        return {
          monitorId: savedSearch.id,
          criteria: null,
          sync: null,
          reused: true as const,
          syncError: null,
          sourceStatus: "healthy" as const,
          sourceLabel: "Saved result set",
          humanReviewOnly: true,
        };
      }
      await requireAvailableSourceBudget(ctx.user.id);
      const criteria = await suggestCriteria(input.brief);
      const xQuery = requireServiceRequestQuery(criteria.xQuery);
      const monitorCapacity = await requireActiveMonitorCapacity(ctx.user.id);
      const monitorId = await db.createMonitor({
        userId: ctx.user.id,
        name: `Faro Agent · ${input.brief.slice(0, 42)}`,
        goal: input.brief,
        xQuery,
        includeTerms: criteria.includeTerms,
        excludeTerms: criteria.excludeTerms,
        categories: ["service request", "human review", "agent-assisted"],
        status: "active",
      });
      const monitor = await db.getMonitorForUser(monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Faro could not save this brief." });
      try {
        const sync = await syncMonitorRecord(monitor);
        return { monitorId, criteria, sync, syncError: null, sourceStatus: "healthy" as const, sourceLabel: sync.source, monitorCapacity, humanReviewOnly: true };
      } catch (error) {
        const sourceState = classifySyncFailure(error);
        return { monitorId, criteria, sync: null, syncError: error instanceof Error ? error.message : "Source sync needs attention.", sourceStatus: sourceState.status, sourceLabel: sourceState.label, monitorCapacity, humanReviewOnly: true };
      }
    }),

  keywordStart: protectedProcedure
    .input(z.object({ keywords: z.string().trim().min(2).max(240) }))
    .mutation(async ({ ctx, input }) => {
      await requireAvailableSourceBudget(ctx.user.id);
      const criteria = deterministicSuggestion(`Find people looking for help with ${input.keywords}`);
      const xQuery = requireServiceRequestQuery(criteria.xQuery);
      const monitorCapacity = await requireActiveMonitorCapacity(ctx.user.id);
      const monitorId = await db.createMonitor({
        userId: ctx.user.id,
        name: `Keyword search · ${input.keywords.slice(0, 42)}`,
        goal: `Find people looking for help with ${input.keywords}`,
        xQuery,
        includeTerms: criteria.includeTerms,
        excludeTerms: criteria.excludeTerms,
        categories: ["keyword search", "service request", "human review"],
        status: "active",
      });
      const monitor = await db.getMonitorForUser(monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Faro could not save this keyword search." });
      try {
        const sync = await syncMonitorRecord(monitor);
        return { monitorId, criteria, sync, syncError: null, sourceStatus: "healthy" as const, sourceLabel: sync.source, monitorCapacity, humanReviewOnly: true };
      } catch (error) {
        const sourceState = classifySyncFailure(error);
        return { monitorId, criteria, sync: null, syncError: error instanceof Error ? error.message : "Source sync needs attention.", sourceStatus: sourceState.status, sourceLabel: sourceState.label, monitorCapacity, humanReviewOnly: true };
      }
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(3).max(120),
      goal: z.string().trim().min(12).max(1200),
      xQuery: z.string().trim().min(1).max(1024),
      includeTerms: terms,
      excludeTerms: terms,
      categories: z.array(z.string().trim().min(1).max(64)).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const validation = validateXQuery(input.xQuery);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.errors.join(" ") });
      }
      await requireActiveMonitorCapacity(ctx.user.id);
      const monitorId = await db.createMonitor({ ...input, xQuery: validation.normalizedQuery, userId: ctx.user.id, status: "active" });
      return { monitorId };
    }),

  setStatus: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive(), status: z.enum(["active", "paused"]) }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      if (input.status === "active" && monitor.status !== "active") await requireActiveMonitorCapacity(ctx.user.id);
      await db.updateMonitorStatus(input.monitorId, ctx.user.id, input.status);
      return { ok: true };
    }),

  rename: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive(), name: z.string().trim().min(3).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      await db.renameMonitor(input.monitorId, ctx.user.id, input.name);
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db.deleteMonitorForUser(input.monitorId, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      return { ok: true };
    }),

  sync: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAvailableSourceBudget(ctx.user.id);
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      try {
        return await syncMonitorRecord(monitor);
      } catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "X synchronization failed." });
      }
    }),

  continuation: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      const states = await db.listMonitorQueryStates(monitor.id);
      return { available: hasResumableContinuation(monitor, states) };
    }),

  continueSearch: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAvailableSourceBudget(ctx.user.id);
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      const states = await db.listMonitorQueryStates(monitor.id);
      if (!hasResumableContinuation(monitor, states)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "There are no additional pages available for this search." });
      try {
        return { monitorId: monitor.id, ...(await syncMonitorRecord(monitor, { mode: "continue" })) };
      } catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "X synchronization failed." });
      }
    }),

  review: protectedProcedure
    .input(z.object({ postId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostForUser(input.postId, ctx.user.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      await db.saveReview(input.postId, ctx.user.id, input.decision, input.note);
      return { ok: true, humanReviewOnly: true };
    }),

  save: protectedProcedure
    .input(z.object({ postId: z.number().int().positive(), saved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostForUser(input.postId, ctx.user.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      if (input.saved) await db.savePostForUser(input.postId, ctx.user.id);
      else await db.unsavePostForUser(input.postId, ctx.user.id);
      return { ok: true, saved: input.saved, humanReviewOnly: true };
    }),

  updateSaved: protectedProcedure
    .input(z.object({ postId: z.number().int().positive(), note: z.string().trim().max(1000).nullable().optional(), priority: z.enum(["normal", "high"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostForUser(input.postId, ctx.user.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      await db.updateSavedPostForUser(input.postId, ctx.user.id, { note: input.note, priority: input.priority });
      return { ok: true };
    }),

  removeFromFeed: protectedProcedure
    .input(z.object({ postId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const removed = await db.hidePostForUser(input.postId, ctx.user.id);
      if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      return { ok: true };
    }),

  saved: protectedProcedure.query(async ({ ctx }) => {
    const [rows, hiddenPostIds] = await Promise.all([db.listSavedPostsForUser(ctx.user.id), db.listHiddenPostIdsForUser(ctx.user.id)]);
    const hidden = new Set(hiddenPostIds);
    return rows.filter(({ post }) => !hidden.has(post.xPostId));
  }),

  seedDemo: protectedProcedure.mutation(async ({ ctx }) => seedDemo(ctx.user.id)),
});
