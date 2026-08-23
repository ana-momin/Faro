import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { suggestCriteria } from "../monitoring/ai";
import { seedDemo } from "../monitoring/demo";
import { validateXQuery } from "../monitoring/query";
import { rankOpportunity } from "../monitoring/ranking";
import { syncMonitorRecord } from "../monitoring/sync";
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
