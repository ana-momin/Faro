import { describe, expect, it } from "vitest";

const describeLiveCredentialCheck = process.env.RUN_LIVE_PROVIDER_CREDENTIAL_TESTS === "1" ? describe : describe.skip;

describeLiveCredentialCheck("TwitterAPI.io credential", () => {
  it("authenticates a lightweight public-post search request with the server-side API key", async () => {
    const apiKey = process.env.TWITTERAPI_IO_KEY;
    expect(apiKey, "TWITTERAPI_IO_KEY must be configured for alternative X ingestion").toBeTruthy();

    const params = new URLSearchParams({ query: "automation", queryType: "Latest", cursor: "" });
    const response = await fetch(`https://api.twitterapi.io/twitter/tweet/advanced_search?${params.toString()}`, {
      headers: { "X-API-Key": apiKey ?? "" },
    });

    // 402/429 prove authentication succeeded but the account needs credit or
    // has reached a provider limit. 401/403 must fail so credentials are fixed.
    expect(
      [200, 402, 429],
      `Alternative X-data credential was not accepted (HTTP ${response.status})`,
    ).toContain(response.status);
  }, 20_000);
});
