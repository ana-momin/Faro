# Polling-First Core Verification Notes

The restarted development service loaded successfully after the bounded polling core changes. Desktop visual checks confirmed that Feed now identifies the collection mode as **“Polling, not live stream”** and shows source-call, page, query-family, active-monitor, and freshness context without displacing the post-first Feed.

Search now explains that a newly created monitor consumes a bounded polling budget across named buyer-demand query families and continuation pages. Its static “View more” clarification remains explicit: revealing saved posts does not create a new source call.

No provider request was made for this verification. The existing saved Feed content was used only to inspect rendering.

## Refresh and Search follow-up — 25 August 2026

Desktop checks confirmed that Feed now exposes a compact **Refresh** control next to Search, while retaining the visible polling and source-budget status rail. The control was not clicked during visual verification, so no provider request was created.

Search retains its focused brief input and now has a results presentation designed for qualified X posts: collection coverage chips, a richer account/category/result-card format, and clearer no-result explanations. The refreshed Search flow waits for the overview query to refetch before rendering a completed run’s results, preventing the prior race where the result view could evaluate stale saved-post data.

Mobile checks confirmed that Feed keeps Refresh and Search as separate compact actions, retains the visible polling status rail, and preserves post-card controls without horizontal overflow. The Search brief form remains readable at 375 px, including category suggestions and the Run Faro action. No Refresh or Run Faro action was clicked during this visual check, so no provider request was made.

## Feed detail refinement — 25 August 2026

Desktop and mobile Feed checks confirmed that the dense polling telemetry rail has been removed. The Feed now starts with a concise **Buyer-side signals / Latest practical requests** heading, followed by the local Time control and post cards. Refresh remains available in the header without exposing operational counters. No provider request was made during this visual verification.

## Wide Search refinement — 25 August 2026

Desktop verification confirms that Search now uses a wider workspace, a short **Buyer requests / Search** heading, one expanded brief field, compact suggestion pills, and a dedicated buyer-only Run Faro action. Mobile verification confirms that the same controls stack cleanly without horizontal overflow or excess explanatory copy. No source search was run during this visual check.

## Search lifecycle and Profile actions — 25 August 2026

Desktop and mobile checks confirmed the Search surface remains minimal while its in-flight lifecycle now continuously advances after the qualifying stage. Source mutation failures show their returned error text immediately rather than leaving a static 82% view. Profile preserves its personalized composition while the photo change, Feed entry, and sign-out actions use compact accessible icon controls with descriptive labels. No source search was run during these checks.

## Saved feedback experience — 25 August 2026

Desktop and mobile checks confirmed that Profile now exposes a compact Saved tab with a count, while its personalized workspace remains intact. Feed continues to use compact detail entry controls; icon-only feedback and save actions are available inside the post detail view, where their text labels remain available to assistive technology and browser tooltips. No feedback, save action, or source request was triggered during these checks.

## Quality and control upgrade — 25 August 2026

Desktop verification confirms that Feed now presents a concise **Why it matched** line beneath each qualified post and Profile exposes compact Profile, Saved, and Monitors navigation. Saved and Monitor panels are interaction-driven, with source-level regression coverage for private notes, priority, pause/resume, rename, and deletion controls. No provider request, feedback action, save mutation, monitor action, or owner notification was triggered during visual verification.

Mobile verification confirms that the concise match reason remains legible beneath Feed cards and the three Profile controls fit cleanly without horizontal overflow. No source, feedback, save, monitor, or notification action was triggered during this check.

## Immediate saved state correction — 25 August 2026

The Feed remains stable after the post-detail save correction. Regression coverage verifies that a save intent updates the open detail state immediately, replaces the action with a non-clickable Saved indicator, and restores the previous state if persistence fails. No source request or post interaction was triggered during verification.

## LLM-style Search redesign — 25 August 2026

Desktop and mobile verification confirms that Search now provides a focused LLM-style prompt workspace: a display-scale buyer-intent headline, concise Brief and Keyword modes, an abstract espresso signal visual, prompt suggestions, and a compact run control. The desktop two-column composition collapses into a clear vertical prompt-and-signal sequence on mobile with no horizontal overflow. No source request was triggered during these checks.

## Centered Search command interface — 25 August 2026

Desktop and mobile verification confirms that Search now uses a centered, rectangular LLM-style command bar beneath a personalized morning greeting. The bar keeps Ask Faro and Keyword search modes, exposes six icon-led task presets, and maintains a compact Run Faro control. The mobile presentation is clean, centered, and free of horizontal overflow. No source request was triggered during these checks.

## Compact Search command refinement — 25 August 2026

Desktop and mobile verification confirms that the greeting and decorative mark are removed. The centered rectangular command bar now contains Ask Faro, Keyword search, and a Suggestions dropdown for full prompt lines. Active collection progress is rendered inside this command surface rather than as a detached status area. No source request was triggered during these checks.

## Suggestions control placement — 25 August 2026

Desktop and mobile verification confirms that the redundant “Real requests only” helper label is removed. The keyboard-accessible Suggestions dropdown now occupies that lower-left command-bar position, balanced against Run Faro. No source request was triggered during these checks.
