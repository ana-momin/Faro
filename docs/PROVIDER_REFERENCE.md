# X Data Provider Reference

Faro supports two client-owned data sources. A client authorizes exactly one at a time in **Settings → Provider**; Faro's server never shares a credential across accounts.

## TwitterAPI.io

Independent third-party service using pay-as-you-go credits, billed per API call based on returned data. Confirm current pricing directly on its site before purchasing credits.

- [Pricing](https://twitterapi.io/pricing) · [Dashboard](https://twitterapi.io/dashboard) · [Advanced Search docs](https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search)

**Advanced Search endpoint contract:** authenticates with an `X-API-Key` header; accepts `query`, `queryType` (`Latest` or `Top`), and an optional `cursor`. The first page uses an empty cursor; subsequent pages use the returned `next_cursor`. Each page returns up to 20 posts along with `has_next_page`. Faro follows the cursor until it is absent or the configured per-sync page cap is reached, deduplicates post IDs, and persists one cursor per query family (see `server/monitoring/query.ts` and `server/monitoring/sync.ts`).

## Official X API

The direct X developer platform, billed on a prepaid-credit model with an optional billing-cycle spending limit set in the Developer Console.

- [Pricing and credits](https://docs.x.com/x-api/getting-started/pricing) · [Developer Console](https://developer.x.com/)
- Recent Search: `GET /2/tweets/search/recent`, used for on-demand polling.
- Filtered Stream: `GET /2/tweets/search/stream`, implemented in `server/monitoring/xClient.ts` but only ever started on a persistent (non-autoscale) host — never on Vercel's stateless functions.

## Faro's own guardrails

Faro never presents a fixed expected charge per batch, since provider pricing, rate limits, and account entitlements are controlled by the provider and can change. Instead it discloses its own deterministic controls: a bounded number of provider requests per client-initiated collection batch, and a client-configurable daily request allowance enforced server-side before any provider call is made.
