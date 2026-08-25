# Polling-First Core Verification Notes

The restarted development service loaded successfully after the bounded polling core changes. Desktop visual checks confirmed that Feed now identifies the collection mode as **“Polling, not live stream”** and shows source-call, page, query-family, active-monitor, and freshness context without displacing the post-first Feed.

Search now explains that a newly created monitor consumes a bounded polling budget across named buyer-demand query families and continuation pages. Its static “View more” clarification remains explicit: revealing saved posts does not create a new source call.

No provider request was made for this verification. The existing saved Feed content was used only to inspect rendering.
