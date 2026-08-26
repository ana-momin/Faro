import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("independent Vercel and Neon staging contract", () => {
  it("keeps passkey onboarding device-local with passkey-first identity and a required-name profile completion", () => {
    const router = projectFile("server/routers/localAuth.ts");
    const onboarding = projectFile("client/src/pages/Onboarding.tsx");

    expect(router).toContain("passkeyRegistrationOptions: publicProcedure.mutation");
    expect(router).toContain("completeProfile: protectedProcedure");
    expect(router).toContain("name: z.string().trim().min(1).max(120)");
    expect(router).toContain('email: z.string().trim().email().max(320).optional().or(z.literal(""))');
    expect(onboarding).toContain("disabled={working || !name.trim()}");
    expect(onboarding).toContain("Passkey confirmed");
    expect(onboarding).toContain("Profile photo · optional");
  });

  it("uses independent session and credential-encryption secrets", () => {
    const session = projectFile("server/auth/localSession.ts");
    const credentials = projectFile("server/monitoring/providerCredentials.ts");

    expect(session).toContain("process.env.SESSION_SECRET");
    expect(session).toContain("at least 32 characters");
    expect(credentials).toContain("process.env.CREDENTIAL_ENCRYPTION_SECRET");
    expect(credentials).not.toContain("process.env.JWT_SECRET");
  });

  it("routes Vercel requests through the shared stateless Express application", () => {
    const app = projectFile("server/app.ts");
    const entrypoint = projectFile("api/[...path].ts");
    const trpcEntrypoint = projectFile("api/trpc/[...path].ts");
    const healthEntrypoint = projectFile("api/healthz.ts");
    const config = projectFile("vercel.json");

    expect(app).toContain('app.get("/healthz"');
    expect(app).toContain('app.use("/api/trpc"');
    expect(app).not.toContain("app.listen");
    expect(entrypoint).toContain('import { createFaroApp } from "../server/app.ts"');
    expect(entrypoint).toContain("export default app");
    expect(trpcEntrypoint).toContain('import { createFaroApp } from "../../server/app.ts"');
    expect(trpcEntrypoint).toContain("export default app");
    expect(healthEntrypoint).toContain('res.status(200).json({ ok: true, service: "faro-ai" })');
    expect(config).toContain('"source": "/healthz", "destination": "/api/healthz"');
    expect(config).toContain('"source": "/:path((?!api(?:/|$)).*)", "destination": "/index.html"');
  });

  it("does not expose a profile-photo upload control until independent object storage is available", () => {
    const profile = projectFile("client/src/pages/Profile.tsx");
    expect(profile).not.toContain("profile.uploadPhoto");
    expect(profile).not.toContain("Change profile photo");
  });
});
