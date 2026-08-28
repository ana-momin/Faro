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
    expect(providerSource).toContain("$0.10 in free credit (10,000 credits)");
    expect(providerSource).toContain("setDailyRequestLimit] = useState(10)");
    expect(routerSource).toContain("dailyRequestLimit: 10, remainingCalls: 10");
  });

  it("shows saved provider state only for the provider the client selected", () => {
    expect(providerSource).toContain("const selectedProviderConnected = Boolean(setup?.configured && setup.provider === provider)");
    expect(providerSource).toContain("{selectedProviderConnected ?");
    expect(providerSource).toContain("onClick={() => chooseProvider(option)}");
    expect(providerSource).toContain("Connect ${selected.name}");
    expect(providerSource).toContain("setCredential(\"\")");
  });

  it("keeps active navigation alignment explicit and lets a saved provider update its limit without replacing the key", () => {
    expect(sidebarSource).toContain('!h-10 !w-full !justify-start !gap-3 !px-3');
    expect(sidebarSource).toContain('!h-11 !w-11 !justify-center !px-0');
    // The collapsed active nav item no longer gets a manual -translate-x-1 nudge: that shifted
    // the whole button (icon included) 4px off from its unselected siblings instead of fixing
    // whatever it was originally compensating for, and was reported as visible misalignment.
    expect(sidebarSource).not.toContain('-translate-x-1');
    expect(providerSource).toContain("updateProviderDailyLimit");
    expect(providerSource).toContain("Save limit");
    expect(providerSource).toContain("Changing the daily limit never needs the key again.");
    expect(providerSource).toContain("Replace API key");
    expect(providerSource).toContain("Change it without re-entering your saved API key.");
    expect(providerSource).toContain("Provider credit balance stays in your");
    expect(routerSource).toContain("updateProviderDailyLimit");
    expect(routerSource).toContain("updateProviderDailyRequestLimitForUser");
  });

  it("opens Provider from Feed inside Settings and centralizes secondary workspace controls there", () => {
    expect(homeSource).toContain('setLocation("/settings?section=provider")');
    expect(homeSource).toContain('setLocation("/search?firstBatch=1")');
    expect(appSource).toContain('path={"/settings"}');
    expect(appSource).toContain('path={"/provider"}');
    expect(appSource).toContain('path={"/saved"}');
    expect(sidebarSource).toContain('label: "Settings", path: "/settings"');
    expect(sidebarSource).not.toContain('label: "History"');
    expect(sidebarSource).not.toContain('history=all');
    expect(sidebarSource).toContain('collapsible="icon"');
    expect(sidebarSource).toContain("Minimize sidebar");
    expect(settingsSource).toContain("SavedOrganizer");
    expect(settingsSource).not.toContain("MonitorManager");
    expect(settingsSource).toContain("ProviderSetup");
    expect(settingsSource).not.toContain("SearchHistoryPanel");
    expect(settingsSource).not.toContain('label: "Searches"');
    expect(settingsSource).toContain("selectSection");
    expect(settingsSource).not.toContain("Workspace controls");
    expect(sidebarSource).toContain('aria-label="Open account actions"');
    expect(sidebarSource).toContain("<MoreHorizontal");
    expect(sidebarSource).toContain("Open Profile");
    expect(sidebarSource).toContain('const collapsed = state === "collapsed"');
    expect(sidebarSource).toContain("!h-11 !w-11 !justify-center !px-0");
    // The minimize control and the feedback trigger above it now share the exact same
    // collapsed/expanded size logic so the two icons line up pixel-for-pixel.
    expect(sidebarSource).toContain('${collapsed ? "h-11 w-11" : "h-9 w-9"}');
    expect(sidebarSource).toContain("<DevFeedbackTrigger collapsed={collapsed} />");
    expect(profileSource).not.toContain('setTab(');
    expect(settingsSource).not.toContain("Manage saved searches");
    expect(settingsSource).not.toContain("<details");
  });

  it("uses a per-client encrypted connection and caps each collection batch to three fresh provider pages", () => {
    expect(routerSource).toContain("encryptClientCredential");
    expect(routerSource).toContain("countMonitorSyncRunsForUserSince");
    expect(syncSource).toContain("maxProviderCallsPerSync: Math.min(4");
    expect(syncSource).toContain("automaticCollection");
    expect(syncSource).toContain("getProviderConnectionForUser");
  });
});
