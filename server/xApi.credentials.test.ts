import { describe, expect, it } from "vitest";

describe("X API credential", () => {
  it("authenticates a lightweight Recent Search request with the server-side bearer token", async () => {
    const token = process.env.X_API_BEARER_TOKEN;
    expect(token, "X_API_BEARER_TOKEN must be configured for ingestion").toBeTruthy();

    const response = await fetch(
      "https://api.x.com/2/tweets/search/recent?query=from%3ATwitterDev&max_results=10&tweet.fields=created_at",
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Rate-limit and payment-required responses prove the credential was
    // accepted. Authentication failures still fail loudly so the secret can
    // be corrected before shipping.
    expect(
      [200, 402, 429],
      `X API credential was not accepted (HTTP ${response.status})`,
    ).toContain(response.status);
  }, 20_000);
});
