import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDiscoverPreview, getRequestCategory } from "../client/src/lib/discoverFeed";

describe("Faro buyer-demand workflow", () => {
  it("labels request categories and caps the initial Discover feed at ten saved matches", () => {
    expect(getRequestCategory({ body: "Need someone to build AI agents for our support team" })).toBe("AI agents");
    expect(getRequestCategory({ body: "Looking to automate our lead intake in n8n" })).toBe("Automation");
    expect(getDiscoverPreview(Array.from({ length: 14 }, (_, id) => id), 10)).toHaveLength(10);
  });

  it("keeps controlled expansion local to saved matches and wires the separate Search workspace", () => {
    const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const search = readFileSync(new URL("../client/src/pages/Search.tsx", import.meta.url), "utf8");
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const sidebar = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    expect(home).toContain("View 10 more");
    expect(home).toContain("saved posts only");
    expect(search).toContain("Keyword search");
    expect(app).toContain('path={"/search"}');
    expect(sidebar).toContain('label: "Search"');
    expect(sidebar).not.toContain('label: "Review"');
    expect(sidebar).not.toContain('label: "Signals"');
    expect(app).not.toContain('path={"/signals"}');
  });

  it("keeps one fixed workspace shell mounted across section changes", () => {
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const sidebar = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    const avatar = readFileSync(new URL("../client/src/components/ui/avatar.tsx", import.meta.url), "utf8");
    const logo = readFileSync(new URL("../client/src/components/FaroLogo.tsx", import.meta.url), "utf8");

    expect(app).toContain("<DashboardLayout>");
    expect(sidebar).toContain('collapsible="offcanvas"');
    expect(sidebar).not.toContain("toggleSidebar");
    expect(sidebar).not.toContain("cursor-col-resize");
    expect(avatar).toContain("delayMs = 150");
    expect(logo).toContain('loading="eager"');
  });
});
