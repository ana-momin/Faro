import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const profileRouter = router({
  uploadPhoto: protectedProcedure
    .input(z.object({ dataUrl: z.string().min(32).max(3_000_000) }))
    .mutation(async () => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Profile photos are unavailable in the free Vercel and Neon staging setup until independent object storage is connected." });
    }),
});
