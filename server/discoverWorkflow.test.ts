import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const searchSource = readFileSync(resolve(process.cwd(), "client/src/pages/Search.tsx"), "utf8");

describe("Faro Feed workflow wiring", () => {
  it("offers a clear recovery state when the shared overview query fails", () => {
    expect(homeSource).toContain("overview.isError");
    expect(homeSource).toContain("Retry loading");
    expect(homeSource).toContain("overview.refetch()");
  });

  it("opens complete post context and Faro analysis inside Feed rather than a separate Review route", () => {
    expect(homeSource).toContain("function PostDetailDialog");
    expect(homeSource).toContain("buildReviewDialogContent");
    expect(homeSource).toContain("Faro AI read");
    expect(homeSource).toContain('review.mutate({ postId: selectedItem.post.id, decision })');
    expect(appSource).not.toContain('path={"/review"}');
  });

  it("explains when a live search returned posts that did not meet service-request qualification", () => {
    expect(homeSource).toContain("Faro screened ${screened} stored public posts for this search");
    expect(homeSource).toContain("filtered as noise, not lost");
    expect(homeSource).toContain("getAllQualifiedPosts(overview.data?.posts ?? [])");
  });

  it("renders Feed as full post cards instead of a dense table", () => {
    expect(homeSource).toContain(">Posts<");
    expect(homeSource).toContain(">Latest practical requests<");
    expect(homeSource).toContain("getAllQualifiedPosts");
    expect(homeSource).toContain("function RequestCard");
    expect(homeSource).toContain("whitespace-pre-wrap");
    expect(homeSource).toContain("Open X");
    expect(homeSource).toContain("Why it matched:");
    expect(homeSource).not.toContain("Request feed");
    expect(homeSource).not.toContain('grid-cols-[minmax(0,1fr)_130px_60px_28px]');
  });

  it("keeps completed qualified results in the Search workspace rather than requiring a Feed redirect", () => {
    expect(searchSource).toContain("function SearchResults");
    expect(searchSource).toContain("Top 10 qualified requests");
    expect(searchSource).toContain("getQualifiedPosts(overview.data?.posts ?? [], result.monitorId, false)");
  });
});
