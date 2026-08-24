import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { parseProfileImageDataUrl } from "../profileImage";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

export const profileRouter = router({
  uploadPhoto: protectedProcedure
    .input(z.object({ dataUrl: z.string().min(32).max(3_000_000) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const image = parseProfileImageDataUrl(input.dataUrl);
        const { url } = await storagePut(`faro-members/${ctx.user.id}/profile.${image.extension}`, image.bytes, image.contentType);
        await db.updateUserAvatar(ctx.user.id, url);
        return { avatarUrl: url };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Faro could not save this image." });
      }
    }),
});
