export type SearchLifecycle = "idle" | "brief" | "source" | "qualifying" | "complete" | "empty" | "attention";

export function getSearchLifecycleDetails(phase: SearchLifecycle) {
  const states = {
    idle: { label: "Start with a clear service need", detail: "Choose a suggestion or write your own brief.", progress: 0 },
    brief: { label: "Reading your brief", detail: "Faro is shaping a focused search.", progress: 26 },
    source: { label: "Checking the live source", detail: "Searching public X posts for real requests.", progress: 58 },
    qualifying: { label: "Qualifying the signal", detail: "Filtering topic chatter and weak matches.", progress: 82 },
    complete: { label: "Fresh requests are ready", detail: "The strongest matches are ready to review.", progress: 100 },
    empty: { label: "No matching requests this time", detail: "Your source check finished cleanly. Try a sharper brief later.", progress: 100 },
    attention: { label: "Source needs attention", detail: "Faro saved your brief, but the live source could not finish this check.", progress: 100 },
  } as const;
  return states[phase];
}
