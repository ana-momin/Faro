import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("responsive dashboard shell", () => {
  it("keeps a mobile navigation header and responsive content spacing across authenticated app pages", () => {
    const layout = projectFile("client/src/components/DashboardLayout.tsx");

    expect(layout).toContain("const isMobile = useIsMobile()");
    expect(layout).toContain("{isMobile && <div className=\"sticky top-0");
    expect(layout).toContain('className="flex-1 p-3 sm:p-5 lg:p-7"');
    expect(layout).toContain('Sidebar collapsible="icon"');
  });
});
