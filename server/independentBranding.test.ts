import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("independent deployed branding", () => {
  it("serves the Faro mark from the repository for both the app logo and browser favicon", () => {
    const logo = projectFile("client/src/components/FaroLogo.tsx");
    const html = projectFile("client/index.html");
    const mark = projectFile("client/public/faro-mark.svg");

    expect(logo).toContain('const FARO_MARK_URL = "/faro-mark.svg"');
    expect(logo).not.toContain("/manus-storage/");
    expect(html).toContain('href="/faro-mark.svg"');
    expect(mark).toContain("<svg");
  });
});
