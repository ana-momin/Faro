# TwitterAPI.io Retrieval Policy

Faro AI uses **TwitterAPI.io Advanced Search** as its only active development and testing source. It does not use an unofficial scraper, Nitter, personal X credentials, browser cookies, or automated outreach. The adapter requests the provider’s `Latest` search mode and accepts the provider’s page cursor fields; these are documented capabilities of the Advanced Search endpoint.[1]

## Controlled initial retrieval

Each newly started monitor begins with one explicit, first-party buyer-demand query. Faro AI then applies its deterministic buyer gate before any per-post AI classification. The gate retains concrete first-person requests for practical AI-solvable delivery work, including safe wording variants such as **automation**, **automate**, and **automating**. It continues to reject provider offers, hiring, promotions, networking, education, third-party stories, and generic discussion.

| Condition after the primary page | Source calls for the sync | Behavior |
| --- | ---: | --- |
| At least four plausible buyer candidates | 1 | Use the primary result set only. |
| Fewer than four plausible buyer candidates | 2 maximum | Run one complementary help/recommendation query, merge both result sets, and deduplicate by X post ID before the AI ingestion pipeline. |
| Stored pagination cursor exists | 1 | Request only that continuation page. Faro AI deliberately skips the complementary query. |
| Provider reports no next page | 1 or 2, as above | Clear the stored cursor so a finished page is not fetched again. |

The complementary query is not an unbounded fan-out. It runs only for a sparse initial TwitterAPI.io result set and it is never added to a continuation-page request. A source-sync status records the actual calls, raw posts screened, buyer candidates passed forward, and any rows skipped during persistence.

## Pagination, duplicate, and metadata handling

TwitterAPI.io’s response can include both a next-page indicator and a cursor. Faro AI persists a cursor only when the provider has not explicitly reported that no next page exists. The next sync then resumes with exactly that cursor. The implementation preserves the original normalized post fields—author identity, post text, direct X URL inputs, timestamp, language, and engagement—while removing duplicates first across the primary and complementary result sets, then again defensively before persistence.

> The retrieval policy increases **coverage of eligible buyer intent**, not raw volume. A page that contains no concrete buyer-side requests is correctly allowed to yield zero Faro AI posts.

## Validation performed

The implementation was verified without exploratory live searches or four repeated manual provider runs. The adapter and sync tests mock provider responses, so they do not consume provider credits. They cover explicit `has_next_page` true/false handling, supplied continuation cursors, one-or-two-call limits, cross-query deduplication, early candidate retention, strict noise rejection, and degraded persistence when a single row cannot be normalized.

| Validation command | Result |
| --- | --- |
| Focused retrieval, sync, and adapter tests | 19 tests passed. |
| Full local suite | 24 test files and 86 tests passed. |
| TypeScript check | Passed. |
| Production build | Passed. |

## Operational limits and production note

The first page remains provider-limited, so Faro AI cannot promise a fixed number of qualified posts for every topic or time window. Strict buyer-only gating intentionally discards many public posts that merely mention AI. The stored `TWITTERAPI_IO_KEY` remains server-side and is not exposed to the browser. If production coverage or economics later require a provider comparison, assess the official X API separately; do not reintroduce the cancelled unofficial scraper.

## Reference

[1]: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search "TwitterAPI.io — Tweet Advanced Search"
