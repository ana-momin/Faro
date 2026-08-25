import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getSearchLifecycleDetails } from "../client/src/lib/discoverSearch";

const searchSource = readFileSync(resolve(process.cwd(), "client/src/pages/Search.tsx"), "utf8");
const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");

describe("Faro Search progress and Profile actions", () => {
  it("continues qualifying progress beyond the former static 82% state", () => {
    expect(getSearchLifecycleDetails("qualifying", 0).progress).toBe(82);
    expect(getSearchLifecycleDetails("qualifying", 12).progress).toBe(88);
    expect(getSearchLifecycleDetails("qualifying", 60).progress).toBe(96);
    expect(getSearchLifecycleDetails("qualifying", 12).detail).toContain("Still checking");
    expect(searchSource).toContain("setElapsedSeconds");
    expect(searchSource).toContain("errorDetail={runError}");
  });

  it("uses labelled icon-led controls for key Profile actions", () => {
    expect(profileSource).toContain('aria-label="Change profile photo"');
    expect(profileSource).toContain('aria-label="Open Feed"');
    expect(profileSource).toContain('aria-label="Sign out"');
  });
});
