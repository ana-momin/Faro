# External Provider Notes

## TwitterAPI.io Advanced Search

Source: <https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search>

The documented Advanced Search endpoint uses the `X-API-Key` header. It requires a `query`, accepts `queryType` (`Latest` or `Top`), and uses an optional `cursor` for pagination. The response provides a tweets collection together with `has_next_page` and `next_cursor`. SignalForge uses this endpoint only from server-side code, normalizes public post fields, and preserves the source state in the monitor-sync record.

## Official X API

Sources: <https://docs.x.com/x-api/posts/filtered-stream/introduction> and <https://developer.x.com/>

The official X path supports Filtered Stream for near-real-time posts matching configured rules and Recent Search for polling. SignalForge retains this adapter but shows a visible payment/rate-limit state when account entitlement prevents retrieval.
