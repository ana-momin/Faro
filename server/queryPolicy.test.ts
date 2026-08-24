import { describe, expect, it } from "vitest";
import { faroQueryPolicy } from "../client/src/lib/queryPolicy";

describe("Faro query performance policy", () => {
  it("keeps recently loaded workspace data available through normal navigation", () => {
    expect(faroQueryPolicy.queries.staleTime).toBe(30_000);
    expect(faroQueryPolicy.queries.gcTime).toBe(10 * 60_000);
  });

  it("avoids disruptive focus refetches while retaining a reconnect refresh", () => {
    expect(faroQueryPolicy.queries.refetchOnWindowFocus).toBe(false);
    expect(faroQueryPolicy.queries.refetchOnReconnect).toBe(true);
    expect(faroQueryPolicy.queries.retry).toBe(1);
  });
});
