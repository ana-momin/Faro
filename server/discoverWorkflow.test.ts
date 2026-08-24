import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("Faro Discover and Review workflow wiring", () => {
  it("offers a clear recovery state when the shared overview query fails", () => {
    expect(homeSource).toContain("overview.isError");
    expect(homeSource).toContain("Retry loading");
    expect(homeSource).toContain("overview.refetch()");
  });

  it("opens the dedicated Review route rather than hiding complete post context in Discover", () => {
    expect(homeSource).toContain('setLocation("/review")');
    expect(appSource).toContain('path={"/review"} component={ReviewQueue}');
  });
});
