import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_INTRO_PATH } from "../client/src/lib/productIntro";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("Faro product-introduction navigation", () => {
  it("registers the dedicated product route outside the persistent workspace shell", () => {
    expect(appSource).toContain('if (pathname === "/faro") return <Suspense fallback={null}><ProductIntro /></Suspense>');
    expect(appSource).toContain("<DashboardLayout>");
    expect(PRODUCT_INTRO_PATH).toBe("/faro");
  });

  it("connects both sidebar and mobile Faro AI brand triggers to the product route", () => {
    expect(sidebarSource).toContain('import { PRODUCT_INTRO_PATH } from "@/lib/productIntro"');
    expect((sidebarSource.match(/setLocation\(PRODUCT_INTRO_PATH\)/g) ?? [])).toHaveLength(2);
  });
});
