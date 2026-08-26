import { describe, expect, it } from "vitest";
import { DISCLOSED_MODEL, suggestCriteria } from "./ai";

describe("deterministic buyer-intent suggestion engine", () => {
  it("builds a focused suggestion without invoking a managed model", async () => {
    const result = await suggestCriteria("People looking for help building custom AI workflows");

    expect(result.fallback).toBe(true);
    expect(result.model).toBe(DISCLOSED_MODEL);
    expect(result.includeTerms.length).toBeGreaterThan(0);
    expect(result.xQuery).toContain("-is:retweet");
  });

  it("returns the same recommendation for the same brief", async () => {
    const goal = "People seeking help implementing AI workflow automation";
    const [first, second] = await Promise.all([suggestCriteria(goal), suggestCriteria(goal)]);
    expect(first).toEqual(second);
  });
});
