export type SearchLifecycle = "idle" | "brief" | "source" | "qualifying" | "complete" | "empty" | "attention";

export type SearchOutcomeActionId = "review" | "feed" | "loadMore" | "runFresh" | "refine" | "retry";
export type SearchOutcomeAction = { id: SearchOutcomeActionId; label: string; primary?: boolean };
export type SearchOutcome = {
  tone: "success" | "neutral" | "warning";
  title: string;
  detail: string;
  hint?: string;
  actions: SearchOutcomeAction[];
};

export type SearchOutcomeInput = {
  reused?: boolean;
  saved: number;
  candidates: number;
  postsSeen: number;
  pagesChecked: number;
  pageBudget: number;
  hasMore?: boolean;
  errorDetail?: string | null;
};

/**
 * Turns the raw counters a sync returns into the one thing the user actually needs: what happened,
 * why, and what they can do next. Each finished search lands in exactly one of these outcomes, and
 * every outcome offers a real next step rather than a dead end.
 */
export function getSearchOutcome({
  reused = false,
  saved,
  candidates,
  postsSeen,
  pagesChecked,
  pageBudget,
  hasMore = false,
  errorDetail,
}: SearchOutcomeInput): SearchOutcome {
  if (errorDetail) {
    return {
      tone: "warning",
      title: "That search stopped early",
      detail: errorDetail,
      hint: "Your brief is saved, so nothing was lost.",
      actions: [{ id: "retry", label: "Try again", primary: true }, { id: "feed", label: "Open Feed" }],
    };
  }

  // A cycle that ends before its page budget means the source cut us off part-way; the pages that
  // did land are still kept, so this is a "there is more to get" note rather than a failure.
  const partialHint = pagesChecked > 0 && pagesChecked < pageBudget
    ? `The source paused us after ${pagesChecked} of ${pageBudget} pages, so this batch is partial. Checking more posts in a moment picks up where it stopped.`
    : undefined;

  if (reused) {
    return {
      tone: "neutral",
      title: "Opened your saved search",
      detail: saved
        ? `Showing the ${saved} result${saved === 1 ? "" : "s"} already collected for this brief — no provider request was used.`
        : "Showing the results already collected for this brief — no provider request was used.",
      hint: "Posts move fast on X. Search again to pull anything published since you last ran this.",
      actions: [
        { id: "runFresh", label: "Search for new posts", primary: true },
        { id: "review", label: "Review results" },
        { id: "feed", label: "Open Feed" },
      ],
    };
  }

  if (saved > 0) {
    return {
      tone: "success",
      title: saved === 1 ? "Found 1 buyer request" : `Found ${saved} buyer requests`,
      detail: `Read ${postsSeen} recent post${postsSeen === 1 ? "" : "s"} · ${candidates} matched your topic · ${saved} ${saved === 1 ? "is" : "are"} someone actually asking to hire.`,
      hint: partialHint,
      actions: [
        { id: "review", label: "Review results", primary: true },
        ...(hasMore ? [{ id: "loadMore" as const, label: "Check more posts" }] : []),
        { id: "feed", label: "Open Feed" },
      ],
    };
  }

  const topicButNoDemand = candidates > 0;
  return {
    tone: "neutral",
    title: "No buyer requests in this batch",
    detail: topicButNoDemand
      ? `Read ${postsSeen} recent posts. ${candidates} mentioned your topic, but none were someone asking to hire — mostly people offering services or discussing it.`
      : `Read ${postsSeen} recent posts, but none were close enough to your topic to be worth checking.`,
    hint: partialHint
      ?? (topicButNoDemand
        ? "The topic is busy but demand is quiet right now. Checking more posts is usually what finds the ask."
        : "A plainer, broader brief tends to match how people actually write."),
    actions: [
      ...(hasMore ? [{ id: "loadMore" as const, label: "Check more posts", primary: true }] : []),
      { id: "refine", label: "Edit the brief", primary: !hasMore },
      { id: "feed", label: "Open Feed" },
    ],
  };
}

export function getSearchLifecycleDetails(phase: SearchLifecycle, elapsedSeconds = 0) {
  const qualifyingProgress = Math.min(96, 82 + Math.floor(elapsedSeconds / 2));
  const qualifyingDetail = elapsedSeconds >= 8
    ? "Still checking current requests and applying Faro’s buyer filter."
    : "Filtering topic chatter and weak matches.";
  const states = {
    idle: { label: "Start with a clear service need", detail: "Choose a suggestion or write your own brief.", progress: 0 },
    brief: { label: "Reading your brief", detail: "Faro is shaping a focused search.", progress: 26 },
    source: { label: "Checking the live source", detail: "Searching public X posts for real requests.", progress: 58 },
    qualifying: { label: "Finding the strongest requests", detail: qualifyingDetail, progress: qualifyingProgress },
    complete: { label: "Fresh requests are ready", detail: "The strongest matches are ready to review.", progress: 100 },
    empty: { label: "No matching requests this time", detail: "Your source check finished cleanly. Try a sharper brief later.", progress: 100 },
    attention: { label: "Source needs attention", detail: "Faro saved your brief, but the live source could not finish this check.", progress: 100 },
  } as const;
  return states[phase];
}
