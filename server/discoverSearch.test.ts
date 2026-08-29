import { describe, expect, it } from "vitest";
import { getSearchLifecycleDetails, getSearchOutcome } from "../client/src/lib/discoverSearch";

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

describe("Faro search outcomes", () => {
  const base = { saved: 0, candidates: 0, postsSeen: 0, pagesChecked: 4, pageBudget: 4 };

  it("reports what was found and offers a way straight to the results", () => {
    const outcome = getSearchOutcome({ ...base, saved: 3, candidates: 12, postsSeen: 80 });
    expect(outcome.tone).toBe("success");
    expect(outcome.title).toBe("Found 3 buyer requests");
    expect(outcome.detail).toContain("80 recent posts");
    expect(outcome.actions[0]).toMatchObject({ id: "review", primary: true });
  });

  it("explains an empty batch by what the posts actually were, not just a count", () => {
    const topicChatter = getSearchOutcome({ ...base, saved: 0, candidates: 14, postsSeen: 60 });
    expect(topicChatter.detail).toContain("14 mentioned your topic");
    expect(topicChatter.detail).toContain("none were someone asking to hire");

    const offTopic = getSearchOutcome({ ...base, saved: 0, candidates: 0, postsSeen: 60 });
    expect(offTopic.detail).toContain("none were close enough to your topic");
    expect(offTopic.hint).toContain("broader brief");
  });

  it("always leaves an empty batch with a next step rather than a dead end", () => {
    const withMore = getSearchOutcome({ ...base, candidates: 5, postsSeen: 60, hasMore: true });
    expect(withMore.actions[0]).toMatchObject({ id: "loadMore", primary: true });

    const exhausted = getSearchOutcome({ ...base, candidates: 5, postsSeen: 60, hasMore: false });
    expect(exhausted.actions.map(action => action.id)).toContain("refine");
    expect(exhausted.actions.some(action => action.primary)).toBe(true);
  });

  it("offers a genuinely fresh run when a saved brief is reopened", () => {
    const outcome = getSearchOutcome({ ...base, reused: true, saved: 4 });
    expect(outcome.title).toBe("Opened your saved search");
    expect(outcome.detail).toContain("no provider request was used");
    // The reopen path previously dead-ended: re-running a saved brief could only reopen it again.
    expect(outcome.actions[0]).toMatchObject({ id: "runFresh", primary: true });
  });

  it("flags a partially collected batch instead of presenting it as complete", () => {
    const outcome = getSearchOutcome({ ...base, saved: 1, candidates: 14, postsSeen: 60, pagesChecked: 3, pageBudget: 4 });
    expect(outcome.tone).toBe("success");
    expect(outcome.hint).toContain("paused us after 3 of 4 pages");
  });

  it("keeps a source failure recoverable and never blames the user", () => {
    const outcome = getSearchOutcome({ ...base, errorDetail: "TwitterAPI.io is rate-limiting requests right now." });
    expect(outcome.tone).toBe("warning");
    expect(outcome.detail).toBe("TwitterAPI.io is rate-limiting requests right now.");
    expect(outcome.hint).toContain("brief is saved");
    expect(outcome.actions[0]).toMatchObject({ id: "retry", primary: true });
  });
});
