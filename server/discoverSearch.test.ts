import { describe, expect, it } from "vitest";
import { getSearchLifecycleDetails } from "../client/src/lib/discoverSearch";

describe("Faro Discover search lifecycle", () => {
  it("communicates meaningful live-search stages before completion", () => {
    expect(getSearchLifecycleDetails("brief").progress).toBe(26);
    expect(getSearchLifecycleDetails("source").progress).toBe(58);
    expect(getSearchLifecycleDetails("qualifying").progress).toBe(82);
  });

  it("distinguishes a clean no-match result from a source problem", () => {
    expect(getSearchLifecycleDetails("empty").label).toBe("No matching requests this time");
    expect(getSearchLifecycleDetails("attention").label).toBe("Source needs attention");
  });
});
