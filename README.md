# Faro

Faro is a **human-led public X signal workspace**. It turns a monitoring goal into editable query criteria, reads matching public posts, and brings the findings with the clearest fit to the front of a review queue. It does **not** automate outreach, messages, posting, or any other external action.

## How Faro prioritizes findings

| Signal dimension | What the score looks for | Why it matters |
| --- | --- | --- |
| Topic fit | The monitored concepts, with higher weight for multi-word phrases. | Keeps findings attached to the subject the user actually specified. |
| Desired outcome | Overlap with the outcome stated in the monitoring goal. | Personalizes results to the user’s use case rather than broad keyword mentions. |
| Expressed need | Language such as “looking for,” “need help,” or “recommend.” | Moves request-led posts ahead of casual discussion. |
| Decision context | Small-business, team, client, project, founder, or budget cues. | Helps surface posts where practical evaluation may be occurring. |
| Specificity and freshness | Concrete context, recency, and bounded engagement support. | Makes the queue more actionable without overvaluing popularity. |
| Noise controls | Exclusions, promotional phrases, and low-context content. | Pushes generic promotion and thin mentions down the queue. |

> **Human-control boundary.** Faro provides an advisory relevance score and evidence. A person chooses whether to approve or reject a finding, and neither decision triggers communication.

## Setup

Set `X_API_BEARER_TOKEN` in the project’s secure secret settings for the official X path. The token is read only by server-side code. X provides a Filtered Stream endpoint for near-real-time posts matching rules and a Recent Search endpoint for polling; endpoint access and consumption are determined by the X account’s current plan.[1][2]

When the official account is not entitled to retrieve posts, configure `TWITTERAPI_IO_KEY` as the alternative public-data path. Faro then uses TwitterAPI.io Advanced Search server-side, sends the saved query and durable page cursor, normalizes author/content/timestamp/engagement fields, and saves direct `x.com` links for human review. TwitterAPI.io documents `X-API-Key` authentication, a required query, and cursor-based pagination for that endpoint.[4]

Recent Search is the autoscale-safe fallback and the workspace shows the active source plus status and latency. On persistent Reserved Hosting, set both `X_FILTERED_STREAM_ENABLED=true` and `SIGNALFORGE_PERSISTENT_WORKER=true` after verifying the necessary X API access. The worker maintains Filtered Stream ingestion through the same normalization and relevance path.[3]

The built-in model is **`gpt-5-mini`**. It is called on the server only for structured signal suggestions and context-aware intent interpretation. The model receives the monitoring goal, monitored terms, exclusions, and categories, and is bounded by a 12-second timeout. If it is unavailable or disabled with `SIGNALFORGE_DISABLE_LLM=true`, Faro uses its deterministic relevance profile instead.

## Using the review workspace

Select **New signal** and describe the ideal finding in plain English. Choose **Suggest** to obtain editable public-search criteria; save the signal, then sync it. The findings panel defaults to a focused signal, supports review-state and relevance thresholds, and shows the monitor goal beside each selected finding’s evidence. Opening a finding displays the relevance breakdown, intent interpretation, author, timestamp, engagement, and a direct X link.

Clearly labeled demo rows are onboarding examples only. Live public rows are distinguished by their source monitor and direct X link. The workspace no longer exports CSV; it is intentionally designed around in-product, evidence-led human review.

## Recurring ingestion

The project includes a protected `/api/scheduled/ingest` endpoint. It is idempotent through durable cursors and the database’s unique `(monitorId, xPostId)` constraint. Transient provider failures are recorded with retry counts and rate-limit/payment states. After publishing, create a project-owned recurring job that POSTs to this endpoint; do not use an in-process timer.

## Development and quality checks

Run `pnpm check` for type checking and `pnpm test` for the test suite. Tests cover query validation, deduplication, alternative provider handling, personalized ranking, deterministic fallbacks, and review-safe X API states.

## Privacy and safety

Faro stores the X bearer token only as a server-side secret. It is designed for public-post discovery and manual assessment, not surveillance of private content. Review decisions are internal labels; they never invoke posting, messaging, outreach, or an external workflow.

## References

[1]: https://docs.x.com/x-api/posts/filtered-stream/introduction "X API — Filtered Stream"
[2]: https://developer.x.com/ "X Developer Platform"
[3]: https://help.manus.im/ "Manus Reserved Hosting — cost profile"
[4]: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search "TwitterAPI.io — Advanced Search"
