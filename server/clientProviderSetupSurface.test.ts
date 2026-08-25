import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Settings.tsx"), "utf8");
const providerSource = readFileSync(resolve(process.cwd(), "client/src/pages/ProfileProviderSetup.tsx"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers/monitoring.ts"), "utf8");
const syncSource = readFileSync(resolve(process.cwd(), "server/monitoring/sync.ts"), "utf8");

describe("client-owned provider setup", () => {
  it("keeps provider configuration in Settings with official guidance links and masked-key treatment", () => {
    expect(settingsSource).toContain("ProviderSetup");
    expect(profileSource).not.toContain("ProviderSetup");
    expect(providerSource).toContain("https://twitterapi.io/pricing");
    expect(providerSource).toContain("https://docs.x.com/x-api/getting-started/pricing");
    expect(providerSource).toContain('type={showCredential ? "text" : "password"}');
    expect(providerSource).toContain("credentialHint");
    expect(providerSource).toContain('aria-label={showCredential ? "Hide credential" : "Show credential"}');
    expect(providerSource).toContain("Find first posts");
  });

  it("shows saved provider state only for the provider the client selected", () => {
    expect(providerSource).toContain("const selectedProviderConnected = Boolean(setup?.configured && setup.provider === provider)");
    expect(providerSource).toContain("{selectedProviderConnected ?");
    expect(providerSource).toContain("onClick={() => chooseProvider(option)}");
    expect(providerSource).toContain("Connect ${selected.name}");
    expect(providerSource).toContain("setCredential(\"\")");
  });

  it("opens Provider from Feed inside Settings and centralizes secondary workspace controls there", () => {
    expect(homeSource).toContain('setLocation("/settings?section=provider")');
    expect(homeSource).toContain('setLocation("/search?firstBatch=1")');
    expect(appSource).toContain('path={"/settings"}');
    expect(appSource).toContain('path={"/provider"}');
    expect(appSource).toContain('path={"/saved"}');
    expect(appSource).toContain('path={"/monitors"}');
    expect(sidebarSource).toContain('label: "Settings", path: "/settings"');
    expect(sidebarSource).toContain('collapsible="icon"');
    expect(sidebarSource).toContain("Minimize sidebar");
    expect(settingsSource).toContain("SavedOrganizer");
    expect(settingsSource).toContain("MonitorManager");
    expect(settingsSource).toContain("ProviderSetup");
    expect(settingsSource).toContain("selectSection");
    expect(settingsSource).not.toContain("Workspace controls");
    expect(sidebarSource).toContain('aria-label="Open account actions"');
    expect(sidebarSource).toContain("<MoreHorizontal");
    expect(sidebarSource).toContain("Open Profile");
    expect(sidebarSource).toContain('className="h-8 w-8 rounded-xl');
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
