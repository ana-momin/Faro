import { describe, expect, it } from "vitest";

describe("Faro project identity", () => {
  it("uses the configured managed application title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("Faro");
  });
});
