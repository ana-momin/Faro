import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("passkey-first onboarding flow", () => {
  it("creates a device passkey before collecting the minimal required profile", () => {
    const router = projectFile("server/routers/localAuth.ts");
    const database = projectFile("server/db.ts");
    const onboarding = projectFile("client/src/pages/Onboarding.tsx");
    const layout = projectFile("client/src/components/DashboardLayout.tsx");

    expect(router).toContain("passkeyRegistrationOptions: publicProcedure.mutation");
    expect(router).toContain("completeProfile: protectedProcedure");
    expect(router).toContain("name: z.string().trim().min(1).max(120)");
    expect(router).toContain('residentKey: "preferred", userVerification: "preferred"');
    expect(router).toContain('generateAuthenticationOptions({ rpID, userVerification: "preferred" })');
    expect(router).toContain("requireUserVerification: false");
    expect(database).toContain("completePasskeyProfile");
    expect(onboarding).toContain("Create a new passkey");
    expect(onboarding).toContain("I already have a passkey");
    expect(onboarding).toContain("Google Password Manager");
    expect(onboarding).toContain("Passkey confirmed");
    expect(onboarding).toContain("Complete your profile.");
    expect(onboarding).not.toContain("Faro uses the same shared profile image for every member.");
    expect(onboarding).not.toContain("FARO_SHARED_PROFILE_IMAGE");
    expect(onboarding).not.toContain("Choose an avatar");
    expect(layout).toContain("!user || !user.name?.trim()");
  });
});
