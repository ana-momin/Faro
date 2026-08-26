import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPasskeyErrorMessage } from "../client/src/lib/passkeyErrors";
import { FARO_SHARED_PROFILE_IMAGE } from "../client/src/lib/sharedProfileImage";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const namedError = (name: string, message = "technical detail") => Object.assign(new Error(message), { name });

describe("passkey profile experience", () => {
  it("turns WebAuthn failures into concise user-safe guidance", () => {
    expect(getPasskeyErrorMessage(namedError("NotAllowedError"), "create")).toBe("Passkey verification was cancelled or not allowed. Please try again when you are ready.");
    expect(getPasskeyErrorMessage(namedError("TimeoutError"), "signIn")).toBe("The passkey request timed out. Please try again.");
    expect(getPasskeyErrorMessage(namedError("NotSupportedError"), "create")).toBe("This device cannot use passkeys yet. Try a current browser with device security enabled.");
    expect(getPasskeyErrorMessage(new Error("https://www.w3.org/TR/webauthn-2/"), "create")).toBe("We could not confirm that passkey. Please try again.");
  });

  it("uses the supplied shared profile image and does not ask a member to choose or upload one", () => {
    const onboarding = projectFile("client/src/pages/Onboarding.tsx");
    const router = projectFile("server/routers/localAuth.ts");
    const db = projectFile("server/db.ts");
    const layout = projectFile("client/src/components/DashboardLayout.tsx");
    const profile = projectFile("client/src/pages/Profile.tsx");

    expect(FARO_SHARED_PROFILE_IMAGE).toBe("/manus-storage/faro-profile-cat_199fa72a.png");
    expect(onboarding).toContain("Complete your profile.");
    expect(onboarding).toContain("Faro uses the same shared profile image for every member.");
    expect(onboarding).not.toContain("Choose an avatar");
    expect(onboarding).not.toContain("FARO_AVATARS.map");
    expect(onboarding).not.toContain("private photo storage is coming next");
    expect(router).not.toContain("avatarUrl:");
    expect(db).not.toContain("avatarUrl: input.avatarUrl");
    expect(layout).toContain("AvatarImage src={FARO_SHARED_PROFILE_IMAGE}");
    expect(profile).toContain("const avatarUrl = FARO_SHARED_PROFILE_IMAGE");
  });
});
