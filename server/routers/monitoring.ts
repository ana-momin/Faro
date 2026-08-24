import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { suggestCriteria } from "../monitoring/ai";
import { seedDemo } from "../monitoring/demo";
import { deterministicSuggestion, requireServiceRequestQuery, validateXQuery } from "../monitoring/query";
import { rankOpportunity } from "../monitoring/ranking";
import { classifySyncFailure, syncMonitorRecord } from "../monitoring/sync";
import { protectedProcedure, router } from "../_core/trpc";

const terms = z.array(z.string().trim().min(1).max(80)).max(20);

export const monitoringRouter = router({
  overview: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const [monitors, posts] = await Promise.all([
        db.listMonitorsWithSync(ctx.user.id),
        db.listPostsForUser(ctx.user.id, input?.monitorId),
      ]);
      const rescoredPosts = posts
        .map(({ post, monitorName, monitor }) => {
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
          return { post: { ...post, ruleScore: ranking.score, scoreExplanation: ranking.components }, monitorName, monitor };
        })
        .sort((left, right) => right.post.ruleScore - left.post.ruleScore || right.post.postedAt.getTime() - left.post.postedAt.getTime());
      const pending = rescoredPosts.filter(({ post }) => post.reviewStatus === "pending").length;
      return { monitors, posts: rescoredPosts, summary: { total: rescoredPosts.length, pending, approved: rescoredPosts.filter(({ post }) => post.reviewStatus === "approved").length } };
    }),

  suggest: protectedProcedure
    .input(z.object({ goal: z.string().trim().min(12).max(800) }))
    .mutation(({ input }) => suggestCriteria(input.goal)),

  agentStart: protectedProcedure
    .input(z.object({ brief: z.string().trim().min(12).max(800) }))
    .mutation(async ({ ctx, input }) => {
      const criteria = await suggestCriteria(input.brief);
      const xQuery = requireServiceRequestQuery(criteria.xQuery);
      const previousMonitors = await db.listMonitorsWithSync(ctx.user.id);
      await Promise.all(previousMonitors
        .filter(({ monitor }) => monitor.status === "active")
        .map(({ monitor }) => db.updateMonitorStatus(monitor.id, ctx.user.id, "paused")));
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
        return { monitorId, criteria, sync, syncError: null, sourceStatus: "healthy" as const, sourceLabel: sync.source, humanReviewOnly: true };
      } catch (error) {
        const sourceState = classifySyncFailure(error);
        return { monitorId, criteria, sync: null, syncError: error instanceof Error ? error.message : "Source sync needs attention.", sourceStatus: sourceState.status, sourceLabel: sourceState.label, humanReviewOnly: true };
      }
    }),

  keywordStart: protectedProcedure
    .input(z.object({ keywords: z.string().trim().min(2).max(240) }))
    .mutation(async ({ ctx, input }) => {
      const criteria = deterministicSuggestion(`Find people looking for help with ${input.keywords}`);
      const xQuery = requireServiceRequestQuery(criteria.xQuery);
      const previousMonitors = await db.listMonitorsWithSync(ctx.user.id);
      await Promise.all(previousMonitors
        .filter(({ monitor }) => monitor.status === "active")
        .map(({ monitor }) => db.updateMonitorStatus(monitor.id, ctx.user.id, "paused")));
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
        return { monitorId, criteria, sync, syncError: null, sourceStatus: "healthy" as const, sourceLabel: sync.source, humanReviewOnly: true };
      } catch (error) {
        const sourceState = classifySyncFailure(error);
        return { monitorId, criteria, sync: null, syncError: error instanceof Error ? error.message : "Source sync needs attention.", sourceStatus: sourceState.status, sourceLabel: sourceState.label, humanReviewOnly: true };
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
      const monitorId = await db.createMonitor({ ...input, xQuery: validation.normalizedQuery, userId: ctx.user.id, status: "active" });
      return { monitorId };
    }),

  setStatus: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive(), status: z.enum(["active", "paused"]) }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      await db.updateMonitorStatus(input.monitorId, ctx.user.id, input.status);
      return { ok: true };
    }),

  sync: protectedProcedure
    .input(z.object({ monitorId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await db.getMonitorForUser(input.monitorId, ctx.user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
      try {
        return await syncMonitorRecord(monitor);
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

  seedDemo: protectedProcedure.mutation(async ({ ctx }) => seedDemo(ctx.user.id)),
});
