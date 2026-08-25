# TwitterAPI.io Retrieval Policy and Live Findings

Faro AI uses **TwitterAPI.io Advanced Search** as its sole active development and testing source. It does not use an unofficial scraper, browser cookies, personal X credentials, or automated outreach. The provider’s Advanced Search endpoint accepts a `Latest` query and a cursor, returns up to 20 posts per page, and indicates whether another page is available.[1]

## Current operational policy — 25 August 2026

Faro now runs in an explicit **polling-first** mode on autoscale hosting. This is not a persistent live stream. The Feed and Search surfaces label its status as polling, show the latest recorded source check, and distinguish saved posts from actively collected posts. The existing official-X filtered-stream worker remains disabled until Faro is moved to persistent hosting and an official X filtered-stream entitlement is verified.

| Control | Default | Purpose |
| --- | ---: | --- |
| Named query families per collection cycle | Up to 3 | Checks direct demand, task-help, and recommendation wording independently. |
| Provider pages per manual sync | Up to 4 | Allows later pages while keeping a hard per-sync source-call ceiling. |
| Pages per individual family per cycle | Up to 2 | Prevents one broad family from consuming the entire cycle. |
| Active monitors per account | 5 | Allows concurrent saved searches without unlimited background coverage. |
| Scheduled polling batch | 1 monitor × 1 page | Provides a predictable future background cadence once the managed heartbeat is enabled. |
| Daily provider-page ledger | 24 pages | Stops all further provider requests once the server-side daily cap is reached. |

Each query family stores its own cursor, newest post ID, completion state, and page count. Faro deduplicates X post IDs across all pages and families **before** buyer qualification and semantic processing. Every successful provider page records raw received, deduplicated, buyer-candidate, persisted, queue-wait, and duration data in a source ledger. A 429 response increases the shared rate-limit penalty but is not retried automatically, so a failed request cannot silently exceed the configured source budget.

The provider queue remains globally serialized. Its default 5.2-second start interval is configurable server-side and adapts upward after rate-limit responses. The aim is controlled useful coverage, not unsafe parallelism.

> **Live validation status:** Offline coverage, TypeScript, and production-build checks are complete. No new TwitterAPI.io request has been made for this deployment. The next high-volume validation must be a user-visible, explicitly bounded run; its exact planned provider-page count must be approved before it starts.

### Managed polling and bounded validation record

The production deployment now has one enabled managed heartbeat named `faro-hourly-bounded-poll`. It invokes `/api/scheduled/ingest` at the top of each UTC hour. Each run selects the stalest active monitor and permits only one provider page; the server-side daily ledger still hard-stops at 24 recorded page attempts. This is intentionally polling, not a stream.

On 25 August 2026, Faro ran one explicitly bounded high-volume validation against the existing AI-agent demand monitor with a maximum of four provider pages. The first provider request returned **HTTP 429** with the provider’s free-tier message requiring at least five seconds between requests. Faro issued **no automatic retry**, did not request a second page or query family, persisted the monitor as rate-limited, and did not save new posts. The validation therefore consumed exactly **one attempted provider request** and did not establish volume scaling against live data. Failed provider pages are now also recorded in the per-page source ledger so future rate-limit attempts remain auditable.

## Root cause found

The earlier implementation did not have a provider outage. Recent manual briefs were recorded as healthy while saving **zero** posts because query setup retained low-signal instruction words such as `find`, `who`, and `operators`, then paired them with a narrow service-demand clause. The strict first-party buyer gate ran before persistence and again in the Feed, so posts could be removed before the user saw them. The Search screen also reported a saved-post count as “screened,” obscuring the difference between source results, duplicates, candidates, and a genuinely empty result.

## Archived one-call discovery policy — superseded

| Retrieval situation | Maximum source calls | Faro AI behavior |
| --- | ---: | --- |
| Initial brief with at least six buyer candidates from the first page | 1 | Use the explicit-provider-demand query only. |
| Initial brief with fewer than six candidates | 3 | Use a primary provider-demand query, one complementary help/recommendation query, then exactly one final coverage step. Faro AI prefers the primary query’s next cursor when available; otherwise it uses a third `want to automate` / direct-need query family. |
| Stored cursor continuation | 1 | Fetch only the continuation page; never fan out to extra query families. |
| Provider returns no next page | 1–3, as applicable | Clear the stored cursor to prevent re-fetching a completed page. |

The plan strips instruction noise from discovery terms, preserves relevant wording variants such as **automation**, **automate**, and **automating**, deduplicates by post ID before model processing, and keeps author, post, timestamp, URL inputs, language, and engagement metadata. A local request-to-delivery check now rejects generic commentary that merely says “I need” or “recommend someone” while retaining concrete requests such as “our company needs someone to automate” or “looking for an AI expert to build.”

To respect the provider’s observed free-tier limit, server-side calls are serialized with a **5.2-second minimum interval**. This avoids Faro AI triggering a rate limit by issuing its own bounded multi-signal calls too quickly.

## Manual Search outcome handling

The Search workspace now distinguishes a source error from a valid empty search and reports the real pipeline metrics. On completion it states: source checks used, raw posts received, unique posts after deduplication, buyer candidates, and qualified posts saved. A true empty state only appears after the bounded coverage plan has produced no concrete first-party buyer requests.

## Controlled live evaluation — 24 August 2026

Three required live brief evaluations were initiated through Faro AI’s actual retrieval and qualification code, not mocked data. The first encountered the provider’s free-tier QPS message before paced handling was added. After pacing, the automation brief completed three calls and returned 40 raw posts, all unique, but only one candidate survived the prior gate. Manual inspection showed that candidate was generic commentary about agents evaluating products, **not** a person seeking a service; the local request-to-delivery gate was tightened and a regression test was added to reject that pattern.

| Brief | Provider outcome | Calls observed | Raw / unique | Qualified buyer opportunities shown |
| --- | --- | ---: | ---: | ---: |
| People looking for someone to build AI automation | Completed before the credit balance was exhausted; the lone candidate was rejected after manual inspection as generic commentary. | 3 | 40 / 40 | 0 verified buyer requests |
| People looking for AI UGC video creation | Provider returned `Credits is not enough. Please recharge`. | 1 attempted; no completed page | — | — |
| People needing custom AI workflows or agents | Provider returned `Credits is not enough. Please recharge`. | 1 attempted; no completed page | — | — |

No further live calls were made after the credit response. This preserves the user’s credit balance and avoids representing provider exhaustion as a zero-result search. The documented source metrics and new UI error state make the distinction visible.

## Remaining limitation

Faro AI cannot guarantee multiple qualified opportunities for every brief: X may have no current first-party buyer requests matching a narrow topic, and the provider’s page composition is outside Faro AI’s control. The current provider account also requires sufficient credits to complete the remaining live validations. When credits are available, re-run the same three briefs; Faro AI will pace calls and record the exact raw, deduplicated, qualified, persisted, and displayed counts.

## Archived credit safety policy — 24 August 2026

After a refreshed provider key was supplied, testing exceeded the intended budget. All temporary live-test runners were removed. The replacement key received exactly **one** lightweight authenticated validation request, which passed. Faro now enforces **one protected TwitterAPI.io request per manually initiated search**: there is no automatic query expansion, automatic continuation fetch, retry search, or background live refresh. Feed pagination, duplicate suppression, time filters, post expansion, and Search result display operate entirely on already-saved rows and never contact the provider.

## Stored-data diagnosis — 24 August 2026

Local inspection found many previously saved raw X rows but only a small number of credible buyer-side requests. Older, loose source runs had persisted generic commentary, service offers, job-seeking text, and unrelated uses of “looking for”; the current overview re-scores and the Feed then applies a second concrete-buyer gate, rightly hiding those rows. Faro now uses more precise future query families for **developer, automation-expert, AI-expert, agency, and direct build/automation requests**, plus matching recommendation language. This improves the next approved retrieval attempt, but it cannot manufacture additional genuine requests from the existing saved set.

The buyer gate now also requires a defined delivery task for general provider requests, which removes generic “looking for a developer” announcements. It preserves concrete build, automation, implementation, testing, repair, migration, and automation-specialist requests. The Feed presents the Faro summary, confidence, evidence, and manual Keep/Dismiss controls directly inside the clicked post detail view; the separate Review route has been removed.

## Approved four-call calibration — 24 August 2026

The user explicitly approved a one-time calibration ceiling of four TwitterAPI.io calls: two briefs, each tested with a direct-demand and a recommendation-demand signal family. The runner paused 5.5 seconds between calls, would have stopped after two consecutive zero-buyer outcomes, and did not use pagination, automatic retries, or hidden follow-up calls.

| Brief and signal family | Source calls | Raw posts | Hard-noise rejects | Semantic buyer confirmations | Decision |
|---|---:|---:|---:|---:|---|
| AI automation · direct provider need | 1 | 16 | 4 | 8 | Retain, but use stronger job/promotion exclusions and manual review. |
| AI automation · recommendation request | 1 | 20 | 4 | 0 | Retire from normal searches; it produced education, generic discussion, and noise. |
| AI product development · direct provider need | 1 | 8 | 2 | 2 | Retain as a lower-volume, concrete-build family with promotion exclusions. |
| AI product development · recommendation request | 1 | 1 | 0 | 1 | Keep only as an optional future calibration family; sample size is too small for normal use. |
| **Total** | **4** | **45** | **10** | **11** | No additional calibration call is authorized by this batch. |

Manual inspection showed that semantic confirmation alone was still too permissive for some job notices and question-led service advertisements. Faro therefore now excludes observed job, hiring, compensation, training, and promotion noise from the direct query family; rejects question-led provider ads; lets plausible flexible buyer wording reach semantic classification; and preserves a high-confidence semantic buyer confirmation in Feed only when the post also states a concrete delivery task. The calibration runner did **not** persist its sample to the product Feed, preventing experimental rows from appearing as production opportunities.

The one-request manual-search rule above was superseded on 25 August 2026 by the bounded multi-family polling policy. The historical calibration limit remains unchanged: its four calls do not authorize additional testing calls.

## Reference

[1]: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search "TwitterAPI.io — Tweet Advanced Search"
