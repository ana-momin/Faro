import { TRPCError } from "@trpc/server";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { z } from "zod";
import * as db from "../db";
import { clearLocalSession, issueLocalSession } from "../auth/localSession";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const rpName = "Faro AI";

function requestPasskeyConfig(request: { protocol: string; get(name: string): string | undefined; headers: Record<string, unknown> }) {
  const host = request.get("host") || String(request.headers.host || "localhost:3000");
  const origin = process.env.PASSKEY_ORIGIN || `${request.protocol === "https" || request.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${host}`;
  const rpID = process.env.PASSKEY_RP_ID || new URL(origin).hostname;
  return { origin, rpID };
}

function toBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export const localAuthRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    clearLocalSession(ctx.res, ctx.req);
    return { success: true } as const;
  }),
  passkeyRegistrationOptions: publicProcedure.mutation(async ({ ctx }) => {
    const { rpID } = requestPasskeyConfig(ctx.req);
    const userHandle = crypto.randomUUID();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: `faro-${userHandle.slice(0, 8)}`,
      userDisplayName: "Faro member",
      userID: new TextEncoder().encode(userHandle),
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    await db.createPasskeyChallenge({ challenge: options.challenge, purpose: "register" });
    return options;
  }),
  passkeyRegistrationVerify: publicProcedure
    .input(z.object({ response: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = input.response?.response?.clientDataJSON ? JSON.parse(Buffer.from(input.response.response.clientDataJSON, "base64url").toString("utf8")).challenge : null;
      if (!challenge) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid passkey registration response." });
      const saved = await db.consumePasskeyChallenge(challenge, "register");
      if (!saved) throw new TRPCError({ code: "BAD_REQUEST", message: "This passkey setup request expired. Please try again." });
      const { origin, rpID } = requestPasskeyConfig(ctx.req);
      const verification = await verifyRegistrationResponse({ response: input.response, expectedChallenge: saved.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!verification.verified || !verification.registrationInfo) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your device could not verify this passkey." });
      const user = await db.createPasskeyUser({ openId: crypto.randomUUID() });
      await db.savePasskeyCredential({
        userId: user.id,
        credentialId: verification.registrationInfo.credential.id,
        publicKey: toBase64Url(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter,
        transports: verification.registrationInfo.credential.transports ?? [],
      });
      await issueLocalSession(ctx.res, ctx.req, user.id);
      return { user };
    }),
  completeProfile: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(320).optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.completePasskeyProfile(ctx.user.id, { name: input.name, email: input.email || null });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Your Faro profile could not be updated." });
      return { user };
    }),
  passkeyAuthenticationOptions: publicProcedure.mutation(async ({ ctx }) => {
    const { rpID } = requestPasskeyConfig(ctx.req);
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
    await db.createPasskeyChallenge({ challenge: options.challenge, purpose: "authenticate" });
    return options;
  }),
  passkeyAuthenticationVerify: publicProcedure
    .input(z.object({ response: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = input.response?.response?.clientDataJSON ? JSON.parse(Buffer.from(input.response.response.clientDataJSON, "base64url").toString("utf8")).challenge : null;
      const credentialId = input.response?.id;
      if (!challenge || !credentialId) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid passkey sign-in response." });
      const saved = await db.consumePasskeyChallenge(challenge, "authenticate");
      const storedCredential = await db.getPasskeyCredential(credentialId);
      if (!saved || !storedCredential) throw new TRPCError({ code: "UNAUTHORIZED", message: "This sign-in request expired. Please try again." });
      const { origin, rpID } = requestPasskeyConfig(ctx.req);
      const verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: storedCredential.credentialId, publicKey: fromBase64Url(storedCredential.publicKey), counter: storedCredential.counter, transports: storedCredential.transports as any },
        requireUserVerification: true,
      });
      if (!verification.verified) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your device could not verify this passkey." });
      await db.updatePasskeyCounter(storedCredential.credentialId, verification.authenticationInfo.newCounter);
      await db.updateUserLastSignedIn(storedCredential.userId);
      const user = await db.getUserById(storedCredential.userId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your Faro profile is unavailable." });
      await issueLocalSession(ctx.res, ctx.req, user.id);
      return { user };
    }),
});
