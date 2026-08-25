import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");
const providerSource = readFileSync(resolve(process.cwd(), "client/src/pages/ProfileProviderSetup.tsx"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers/monitoring.ts"), "utf8");
const syncSource = readFileSync(resolve(process.cwd(), "server/monitoring/sync.ts"), "utf8");

describe("client-owned provider setup", () => {
  it("keeps provider configuration in Profile with official guidance links and masked-key treatment", () => {
    expect(profileSource).toContain("ProviderSetup");
    expect(providerSource).toContain("https://twitterapi.io/pricing");
    expect(providerSource).toContain("https://docs.x.com/x-api/getting-started/pricing");
    expect(providerSource).toContain('type="password"');
    expect(providerSource).toContain("credentialHint");
  });

  it("opens Provider directly from Feed and keeps Saved, Monitors, and Provider in the compact account menu rather than a Profile tab bar", () => {
    expect(homeSource).toContain('setLocation("/provider")');
    expect(appSource).toContain('path={"/provider"}');
    expect(appSource).toContain('path={"/saved"}');
    expect(appSource).toContain('path={"/monitors"}');
    expect(sidebarSource).toContain('setLocation("/saved")');
    expect(sidebarSource).toContain('setLocation("/monitors")');
    expect(sidebarSource).toContain('setLocation("/provider")');
    expect(sidebarSource).toContain('collapsible="icon"');
    expect(sidebarSource).toContain("Minimize sidebar");
    expect(profileSource).not.toContain('setTab(');
  });

  it("uses a per-client encrypted connection and locks each collection batch to one provider request", () => {
    expect(routerSource).toContain("encryptClientCredential");
    expect(routerSource).toContain("countMonitorSyncRunsForUserSince");
    expect(syncSource).toContain("maxProviderCallsPerSync: 1");
    expect(syncSource).toContain("automaticCollection");
    expect(syncSource).toContain("getProviderConnectionForUser");
  });
});
