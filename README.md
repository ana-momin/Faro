# SignalForge

SignalForge is a **human-in-the-loop public X listening dashboard**. It translates a monitoring goal into editable X query criteria, ingests matching public posts, scores them transparently, and lets a reviewer approve or reject an opportunity. It does **not** automate outreach, messages, posting, or any other external action.

## Operating model

| Layer | What SignalForge does | Human boundary |
| --- | --- | --- |
| Criteria | Saves plain-English goals, keywords, exclusions, and validated X query rules. | A person reviews and saves every monitor. |
| Ingestion | Uses official X API access when entitled, or TwitterAPI.io Advanced Search as a server-side alternative provider. It can configure an official Filtered Stream rule when enabled. | The app reads public data only. |
| Ranking | Combines explicit rules, freshness, engagement, and intent confidence. | The score is advisory and always explained. |
| Review | Stores approved/rejected labels and notes. | The reviewer decides; no decision triggers communication. |

## Setup

Set `X_API_BEARER_TOKEN` in the project’s secure secret settings for the official X path. The token is read only by server-side code. X provides a Filtered Stream endpoint for near-real-time posts matching rules and a Recent Search endpoint for polling; endpoint access and consumption are determined by the X account’s current plan.[1][2]

When the official account is not entitled to retrieve posts, configure `TWITTERAPI_IO_KEY` as the alternative public-data path. SignalForge then uses TwitterAPI.io Advanced Search server-side, sends the saved query and durable page cursor, normalizes the returned author/content/timestamp/engagement fields, and saves direct `x.com` links for human review. TwitterAPI.io documents `X-API-Key` authentication, a required query, and cursor-based pagination for that endpoint.[4] Confirm that this alternative source is permitted by the specific submission reviewer before relying on it as the final integration.

The initial implementation uses **Recent Search** as the reliable autoscale-safe fallback and displays the selected source plus status/latency in the dashboard. When the app is on persistent Reserved Hosting, set both `X_FILTERED_STREAM_ENABLED=true` and `SIGNALFORGE_PERSISTENT_WORKER=true` after verifying the project has the necessary X API access. The single worker then maintains Filtered Stream ingestion, saves posts through the same normalization/ranking path, and reports the source as `filtered_stream`. Reserved Hosting is usage-billed, with a full-utilization ceiling of about **$37.50/month** before the included $10 monthly usage credit; do not enable it until you are comfortable with that cost profile.[3]

The built-in model is **`gpt-5-mini`**. It is invoked on the server only, for structured query suggestions and nuanced public-post intent classification. If it is unavailable or deliberately disabled with `SIGNALFORGE_DISABLE_LLM=true`, SignalForge uses a deterministic keyword and help-seeking fallback; the interface labels that fallback explicitly.

The configured official X token currently authenticates but the live Recent Search check returned **HTTP 402 (payment required)**. SignalForge records that as a visible source state instead of displaying false “live” data. The configured TwitterAPI.io credential is separately validated and is used preferentially whenever it is available. If either provider returns a payment or rate-limit status, the dashboard names that provider in the source-health card rather than silently swapping sources.

## Demo and review workflow

Use **Load demo** from the empty queue to create clearly labeled synthetic sample criteria and posts. Demo rows are marked as samples and do not provide a false X post URL. They exist only to demonstrate ranking, explanation, approval/rejection, and CSV export.

For live use, select **Try a natural-language query**, enter a plain-English goal such as “people looking for someone to build a custom AI workflow,” select **Suggest**, inspect the generated X rule, and save it. You can instead enter targeted keyword inclusions/exclusions directly. Click **Sync** on the saved monitor to retrieve public posts. A live result shows author, post text, timestamp, score explanation, and a direct X link; a demo row is conspicuously marked and never masquerades as an external post. Select a result to see the score components and intent rationale, then use **Approve** or **Reject** as a human-review record. Export creates a local CSV of the reviewable feed; it does not send data or initiate contact.

## Submission demonstration

Record a 45–90 second screen capture after the app is published. Show the **Try a natural-language query** action, the resulting criteria/rule, a successful **Sync** yielding a live public post with its X link, the ranking explanation, and a manual approve/reject decision. Include this README and the source project checkpoint with the submission. If live credentials are unavailable at recording time, label the demonstration as a product walkthrough and do not present demo rows as live results.

The completed live-query walkthrough, including the exact plain-English input, generated rule, and observed 20-post source response, is documented in [docs/SUBMISSION_DEMO.md](docs/SUBMISSION_DEMO.md).

## Recurring ingestion

The project includes a protected `/api/scheduled/ingest` endpoint. It is idempotent through durable cursors and the database’s unique `(monitorId, xPostId)` constraint; transient X failures are recorded with retry counts and specific rate-limit/payment states. After the site is published, create a project-owned recurring job that POSTs to that endpoint. The handler authenticates the job, runs active monitors, and returns a status report. Do not use an in-process timer.

## Development and quality checks

Run `pnpm check` for type checking and `pnpm test` for the test suite. The tests cover X credential authentication, query-rule validation, rule-based ranking, duplicate incoming post IDs, and payment/rate-limit fallback states.

## Privacy and safety

SignalForge stores the X bearer token only as a server-side secret. It is designed for public-post discovery and manual assessment, not surveillance of private content. Review decisions are internal labels; they never invoke posting, messaging, outreach, or an external workflow.

## References

[1]: https://docs.x.com/x-api/posts/filtered-stream/introduction "X API — Filtered Stream"
[2]: https://developer.x.com/ "X Developer Platform"
[3]: https://help.manus.im/ "Manus Reserved Hosting — cost profile"
[4]: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search "TwitterAPI.io — Advanced Search"
