# Polling-First Core Verification Notes

The restarted development service loaded successfully after the bounded polling core changes. Desktop visual checks confirmed that Feed now identifies the collection mode as **“Polling, not live stream”** and shows source-call, page, query-family, active-monitor, and freshness context without displacing the post-first Feed.

Search now explains that a newly created monitor consumes a bounded polling budget across named buyer-demand query families and continuation pages. Its static “View more” clarification remains explicit: revealing saved posts does not create a new source call.

No provider request was made for this verification. The existing saved Feed content was used only to inspect rendering.

## Refresh and Search follow-up — 25 August 2026

Desktop checks confirmed that Feed now exposes a compact **Refresh** control next to Search, while retaining the visible polling and source-budget status rail. The control was not clicked during visual verification, so no provider request was created.

Search retains its focused brief input and now has a results presentation designed for qualified X posts: collection coverage chips, a richer account/category/result-card format, and clearer no-result explanations. The refreshed Search flow waits for the overview query to refetch before rendering a completed run’s results, preventing the prior race where the result view could evaluate stale saved-post data.

Mobile checks confirmed that Feed keeps Refresh and Search as separate compact actions, retains the visible polling status rail, and preserves post-card controls without horizontal overflow. The Search brief form remains readable at 375 px, including category suggestions and the Run Faro action. No Refresh or Run Faro action was clicked during this visual check, so no provider request was made.
