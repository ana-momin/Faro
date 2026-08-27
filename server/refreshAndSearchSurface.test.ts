import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const searchSource = readFileSync(resolve(process.cwd(), "client/src/pages/Search.tsx"), "utf8");

describe("Faro refresh and Search result surfaces", () => {
  it("makes source collection an explicit bounded Feed action rather than a passive page refresh", () => {
    expect(homeSource).toContain("trpc.monitoring.sync.useMutation");
    expect(homeSource).toContain("refresh.mutate({ monitorId: active.monitor.id })");
    expect(homeSource).toContain("Checks up to three fresh source pages for the current search");
    expect(homeSource).toContain("saved results");
    expect(homeSource).toContain("Connect your X data provider.");
    expect(homeSource).toContain("Configure provider");
    expect(homeSource).toContain("Run first X batch unavailable until a provider is configured");
    expect(homeSource).toContain("Your provider is ready for a first batch.");
    expect(homeSource).toContain("Prepare first batch");
    expect(homeSource).toContain("1 source request");
    expect(homeSource).toContain('setLocation("/search?firstBatch=1")');
  });

  it("refetches saved overview data before rendering completed Search results in the centered command workspace", () => {
    expect(searchSource).toContain("await overview.refetch()");
    expect(searchSource).toContain('label="Pages"');
    expect(searchSource).toContain("Top 10 recent qualified requests");
    expect(searchSource).toContain("No qualified requests in this selected time range");
    expect(searchSource).toContain('max-w-[1040px]');
    expect(searchSource).toContain("Suggestions");
    expect(searchSource).toContain("CommandProgress");
    expect(searchSource).toContain('side="bottom"');
    expect(searchSource).toContain("overflow-y-auto");
    expect(searchSource).toContain("firstBatchBrief");
    expect(searchSource).toContain("Run your first bounded batch.");
    expect(searchSource).not.toContain("Keyword search");
    expect(searchSource).not.toContain("keywordStart.useMutation");
    expect(searchSource).toContain("providerSetup.data?.configured && providerSetup.data.remainingCalls <= 0");
    expect(searchSource).toContain("Today’s provider limit of ${providerSetup.data.dailyRequestLimit}");
    expect(searchSource).toContain("persistenceFailures");
    expect(searchSource).not.toContain("buyerCandidates && !retrieval.persisted");
    expect(searchSource).toContain("No buyer-service requests were saved for this brief.");
    expect(searchSource).toContain("Faro is designed for people seeking help with services such as AI agents");
  });

  it("keeps rich post actions available in Search and lets saved history reopen result sets without another provider request", () => {
    expect(homeSource).toContain("Current search · newest first");
    expect(homeSource).toContain("Latest qualified requests");
    expect(searchSource).toContain("<RequestCard");
    expect(searchSource).toContain("<PostDetailDialog");
    expect(searchSource).toContain("historyMonitorId");
    expect(searchSource).toContain("historyFromLocation");
    expect(searchSource).toContain("Reopening stored results never uses a provider request.");
    expect(searchSource).toContain("function SearchHistory");
    expect(searchSource).toContain("Reopen a saved result set without another provider call.");
    expect(searchSource).toContain("continueSearch");
    expect(searchSource).toContain("Load more recent matches");
    expect(searchSource).toContain("continues this search");
    expect(searchSource).toContain("Filter saved search results by time");
    expect(searchSource).toContain('label: "Last 7 days"');
  });
});
