import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const transportSource = readFileSync(resolve(process.cwd(), "client/src/lib/trpcTransport.ts"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("tRPC transport resilience", () => {
  it("retries both fallback documents and transient network failures before returning a clear reconnect error", () => {
    expect(transportSource).toContain("for (let attempt = 0; attempt < 3; attempt += 1)");
    expect(transportSource).toContain("catch (error)");
    expect(transportSource).toContain("globalThis.setTimeout");
    expect(transportSource).toContain("isUnexpectedApiResponse");
    expect(transportSource).toContain("empty or non-JSON API response");
    expect(transportSource).toContain("Faro could not reach its API after reconnecting");
  });

  it("keeps the Feed safe and actionable when the API is temporarily unreachable", () => {
    expect(homeSource).toContain("Faro is reconnecting to its API.");
    expect(homeSource).toContain("Faro retried the connection automatically.");
    expect(homeSource).toContain("no source search was started");
  });
});
