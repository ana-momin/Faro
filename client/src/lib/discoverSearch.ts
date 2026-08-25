export type SearchLifecycle = "idle" | "brief" | "source" | "qualifying" | "complete" | "empty" | "attention";

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
