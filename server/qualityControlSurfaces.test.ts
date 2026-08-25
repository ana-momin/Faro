import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers/monitoring.ts"), "utf8");
const syncSource = readFileSync(resolve(process.cwd(), "server/monitoring/sync.ts"), "utf8");
const alertSource = readFileSync(resolve(process.cwd(), "server/monitoring/alerts.ts"), "utf8");

describe("Faro quality-control surfaces", () => {
  it("explains Feed matches while applying client-side duplicate and noise controls", () => {
    expect(homeSource).toContain("getMatchReason");
    expect(homeSource).toContain("Why it matched:");
    expect(readFileSync(resolve(process.cwd(), "client/src/lib/discoverFeed.ts"), "utf8")).toContain("isNearDuplicate");
    expect(readFileSync(resolve(process.cwd(), "client/src/lib/discoverFeed.ts"), "utf8")).toContain("isLowSignalNoise");
  });

  it("offers user-owned saved organization and monitor lifecycle controls", () => {
    expect(profileSource).toContain("SavedOrganizer");
    expect(profileSource).toContain("MonitorManager");
    expect(profileSource).toContain("trpc.monitoring.updateSaved.useMutation");
    expect(routerSource).toContain("rename: protectedProcedure");
    expect(routerSource).toContain("delete: protectedProcedure");
  });

  it("keeps preferred-topic alerts owner-scoped and deduplicated", () => {
    expect(syncSource).toContain("notifyPreferredHighConfidenceSignals");
    expect(alertSource).toContain("owner.openId !== ENV.ownerOpenId");
    expect(alertSource).toContain("claimPostAlertForUser");
    expect(alertSource).toContain("releasePostAlertForUser");
  });
});
