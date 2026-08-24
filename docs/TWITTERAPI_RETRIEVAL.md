# TwitterAPI.io Retrieval Policy and Live Findings

Faro AI uses **TwitterAPI.io Advanced Search** as its sole active development and testing source. It does not use an unofficial scraper, browser cookies, personal X credentials, or automated outreach. The provider’s Advanced Search endpoint accepts a `Latest` query and a cursor, returns up to 20 posts per page, and indicates whether another page is available.[1]

## Root cause found

The earlier implementation did not have a provider outage. Recent manual briefs were recorded as healthy while saving **zero** posts because query setup retained low-signal instruction words such as `find`, `who`, and `operators`, then paired them with a narrow service-demand clause. The strict first-party buyer gate ran before persistence and again in the Feed, so posts could be removed before the user saw them. The Search screen also reported a saved-post count as “screened,” obscuring the difference between source results, duplicates, candidates, and a genuinely empty result.

## Repaired credit-aware discovery plan

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

## Credit safety stop — 24 August 2026

After a refreshed provider key was supplied, testing exceeded the intended budget. All temporary live-test runners were removed and all active provider work was stopped. **No further TwitterAPI.io request may be made unless the user gives explicit written approval and a fixed maximum call count.** Feed pagination, duplicate suppression, time filters, and post expansion operate entirely on already-saved rows and never contact the provider.

## Stored-data diagnosis — 24 August 2026

Local inspection found many previously saved raw X rows but only a small number of credible buyer-side requests. Older, loose source runs had persisted generic commentary, service offers, job-seeking text, and unrelated uses of “looking for”; the current overview re-scores and the Feed then applies a second concrete-buyer gate, rightly hiding those rows. Faro now uses more precise future query families for **developer, automation-expert, AI-expert, agency, and direct build/automation requests**, plus matching recommendation language. This improves the next approved retrieval attempt, but it cannot manufacture additional genuine requests from the existing saved set.

The buyer gate now also requires a defined delivery task for general provider requests, which removes generic “looking for a developer” announcements. It preserves concrete build, automation, implementation, testing, repair, migration, and automation-specialist requests. The Feed presents the Faro summary, confidence, evidence, and manual Keep/Dismiss controls directly inside the clicked post detail view; the separate Review route has been removed.

## Reference

[1]: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search "TwitterAPI.io — Tweet Advanced Search"
