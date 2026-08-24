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

  it("opens the dedicated Review route rather than hiding complete post context in Feed", () => {
    expect(homeSource).toContain('setLocation(`/review?post=${postId}`)');
    expect(appSource).toContain('path={"/review"} component={ReviewQueue}');
  });

  it("explains when a live search returned posts that did not meet service-request qualification", () => {
    expect(homeSource).toContain("Faro screened ${screened} stored public posts for this search");
    expect(homeSource).toContain("filtered as noise, not lost");
    expect(homeSource).toContain("getAllQualifiedPosts(overview.data?.posts ?? [])");
  });

  it("renders Feed as full post cards instead of a dense table", () => {
    expect(homeSource).toContain(">Posts<");
    expect(homeSource).toContain(">All posts<");
    expect(homeSource).toContain("getAllQualifiedPosts");
    expect(homeSource).toContain("function RequestCard");
    expect(homeSource).toContain("whitespace-pre-wrap");
    expect(homeSource).toContain("Open X");
    expect(homeSource).toContain("Matched from");
    expect(homeSource).not.toContain("Request feed");
    expect(homeSource).not.toContain('grid-cols-[minmax(0,1fr)_130px_60px_28px]');
  });
});
