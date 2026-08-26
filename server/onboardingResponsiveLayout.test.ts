import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("passkey onboarding responsive layout", () => {
  it("fits the page shell to the dynamic viewport and reserves scroll only for short-screen form content", () => {
    const onboarding = projectFile("client/src/pages/Onboarding.tsx");

    expect(onboarding).toContain('h-[100dvh] overflow-hidden');
    expect(onboarding).toContain('grid h-full max-w-5xl overflow-hidden');
    expect(onboarding).toContain('hidden min-h-0 flex-col');
    expect(onboarding).toContain('flex min-h-0 flex-col justify-center overflow-y-auto');
    expect(onboarding).toContain('src={FARO_SHARED_PROFILE_IMAGE}');
    expect(onboarding).toContain('h-14 w-14 rounded-full');
    expect(onboarding).not.toContain('role="radiogroup" aria-label="Choose an optional Faro avatar"');
    expect(onboarding).not.toContain("min-h-screen");
  });
});
