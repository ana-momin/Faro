# Provider Setup Reference

Verified on 25 August 2026 for the client-owned Provider Setup surface.

| Provider | Client setup and billing guidance | Official links |
| --- | --- | --- |
| TwitterAPI.io | Independent third-party service. Its pricing page describes pay-as-you-go credits, a minimum charge per API call, and charges based on returned data; current endpoint pricing should always be confirmed on its site before a client buys credits. | [Pricing](https://twitterapi.io/pricing) · [Dashboard](https://twitterapi.io/dashboard) · [Advanced Search documentation](https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search) |
| Official X API | X documents a pay-per-usage, prepaid credit model. Clients purchase credits and can set a billing-cycle spending limit in the Developer Console; the page also notes that requests are blocked when the configured limit is reached. | [Pricing and credits](https://docs.x.com/x-api/getting-started/pricing) · [Developer Console](https://developer.x.com/) |

Faro AI must not present a fixed expected charge per batch. Provider pricing, endpoint costs, rate limits, and account entitlements are controlled by the provider and can change. The UI should instead disclose Faro’s own deterministic control: a strict one-provider-request collection batch, with saved-result viewing requiring no new provider request.
