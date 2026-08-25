import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePreferredTopics, preferenceBoost } from "../server/monitoring/preferences";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");

describe("Faro saved feedback experience", () => {
  it("only boosts topics the user explicitly kept or saved", () => {
    const topics = derivePreferredTopics([
      { post: { body: "Need someone to automate client intake with n8n.", reviewStatus: "approved" as const }, savedAt: null },
      { post: { body: "Looking for a developer to build an API.", reviewStatus: "pending" as const }, savedAt: null },
    ]);
    expect(topics).toContain("automation");
    expect(topics).not.toContain("development");
    expect(preferenceBoost("Our company needs automation help.", topics).points).toBeGreaterThan(0);
    expect(preferenceBoost("Need an API developer.", topics).points).toBe(0);
  });

  it("keeps feedback actions compact and makes saved posts visible in Profile", () => {
    expect(homeSource).toContain("trpc.monitoring.save.useMutation");
    expect(homeSource).toContain('position: "bottom-left"');
    expect(homeSource).toContain('aria-label="Keep this kind of post"');
    expect(homeSource).toContain('aria-label="Dismiss this kind of post"');
    expect(homeSource).toContain('aria-label={item.savedAt ? "Remove from saved posts" : "Save post"}');
    expect(profileSource).toContain("trpc.monitoring.saved.useQuery");
    expect(profileSource).toContain(">Saved posts<");
  });
});
