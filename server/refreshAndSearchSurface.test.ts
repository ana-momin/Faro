import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const searchSource = readFileSync(resolve(process.cwd(), "client/src/pages/Search.tsx"), "utf8");

describe("Faro refresh and Search result surfaces", () => {
  it("makes source collection an explicit bounded Feed action rather than a passive page refresh", () => {
    expect(homeSource).toContain("trpc.monitoring.sync.useMutation");
    expect(homeSource).toContain("refresh.mutate({ monitorId: active.monitor.id })");
    expect(homeSource).toContain("Uses the active monitor’s bounded source-call budget");
    expect(homeSource).toContain("Refresh completed:");
  });

  it("refetches saved overview data before rendering completed Search results in the centered command workspace", () => {
    expect(searchSource).toContain("await overview.refetch()");
    expect(searchSource).toContain('label="Pages"');
    expect(searchSource).toContain("Qualified requests");
    expect(searchSource).toContain("still needs final review");
    expect(searchSource).toContain('max-w-[1040px]');
    expect(searchSource).toContain("Suggestions");
    expect(searchSource).toContain("CommandProgress");
  });
});
