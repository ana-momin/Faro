import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const introSource = readFileSync(resolve(process.cwd(), "client/src/pages/ProductIntro.tsx"), "utf8");
const styleSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("Faro premium interaction surfaces", () => {
  it("uses an embedded full-post detail surface with Faro analysis and manual decisions", () => {
    expect(homeSource).toContain(">Posts<");
    expect(homeSource).toContain("function PostDetailDialog");
    expect(homeSource).toContain("Faro AI read");
    expect(homeSource).toContain("Human decision required");
  });

  it("keeps application scrolling usable while hiding visible scrollbar chrome", () => {
    expect(styleSource).toContain("scrollbar-width: none");
    expect(styleSource).toContain("*::-webkit-scrollbar");
  });

  it("keeps the product site focused and free of prior 3D-style signal components", () => {
    expect(introSource).toContain("Find the people");
    expect(introSource).toContain("productStages");
    expect(introSource).toContain("No automated outreach");
    expect(introSource).not.toContain("SignalOrbital");
    expect(introSource).not.toContain("SignalProof");
  });
});
