import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPasskeyErrorMessage } from "../client/src/lib/passkeyErrors";
import { FARO_AVATAR_URLS } from "../shared/faroAvatars";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const namedError = (name: string, message = "technical detail") => Object.assign(new Error(message), { name });

describe("passkey profile experience", () => {
  it("turns WebAuthn failures into concise user-safe guidance", () => {
    expect(getPasskeyErrorMessage(namedError("NotAllowedError"), "create")).toBe("Passkey verification was cancelled or not allowed. Please try again when you are ready.");
    expect(getPasskeyErrorMessage(namedError("TimeoutError"), "signIn")).toBe("The passkey request timed out. Please try again.");
    expect(getPasskeyErrorMessage(namedError("NotSupportedError"), "create")).toBe("This device cannot use passkeys yet. Try a current browser with device security enabled.");
    expect(getPasskeyErrorMessage(new Error("https://www.w3.org/TR/webauthn-2/"), "create")).toBe("We could not confirm that passkey. Please try again.");
  });

  it("keeps avatar choices curated and stores only approved repository paths", () => {
    const onboarding = projectFile("client/src/pages/Onboarding.tsx");
    const router = projectFile("server/routers/localAuth.ts");
    const db = projectFile("server/db.ts");

    expect(FARO_AVATAR_URLS).toHaveLength(4);
    expect(FARO_AVATAR_URLS.every(url => url.startsWith("/faro-avatars/") && url.endsWith(".svg"))).toBe(true);
    expect(onboarding).toContain("Complete your profile.");
    expect(onboarding).toContain("Choose an avatar");
    expect(onboarding).toContain("FARO_AVATARS.map");
    expect(onboarding).not.toContain("private photo storage is coming next");
    expect(router).toContain("avatarUrl: z.enum(FARO_AVATAR_URLS).optional()");
    expect(db).toContain("avatarUrl: input.avatarUrl ?? null");
  });
});
