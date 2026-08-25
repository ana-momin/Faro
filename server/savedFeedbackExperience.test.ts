import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePreferredTopics, preferenceBoost } from "../server/monitoring/preferences";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Settings.tsx"), "utf8");

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

  it("keeps feedback actions compact and makes saved posts visible in Settings", () => {
    expect(homeSource).toContain("trpc.monitoring.save.useMutation");
    expect(homeSource).toContain('onMutate: () => { toast.success("Thanks for the feedback.", { position: "bottom-right"');
    expect(homeSource).toContain('onSuccess: () => { void utils.monitoring.overview.invalidate(); }');
    expect(homeSource).not.toContain('position: "bottom-left"');
    expect(homeSource).toContain('result.saved ? "Saved to Profile." : "Removed from saved posts.", { position: "bottom-right"');
    expect(homeSource).toContain('aria-label="Keep this kind of post"');
    expect(homeSource).toContain('aria-label="Dismiss this kind of post"');
    expect(homeSource).toContain('aria-label="Saved to Profile"');
    expect(homeSource).toContain('onSave={() => selectedItem && save.mutate({ postId: selectedItem.post.id, saved: true })}');
    expect(settingsSource).toContain("trpc.monitoring.saved.useQuery");
    expect(settingsSource).toContain("SavedOrganizer");
  });
});
