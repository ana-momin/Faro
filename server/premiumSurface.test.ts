import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const introSource = readFileSync(resolve(process.cwd(), "client/src/pages/ProductIntro.tsx"), "utf8");
const styleSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("Faro premium interaction surfaces", () => {
  it("uses a wide, hidden-scrollbar full-post review surface", () => {
    expect(homeSource).toContain("lg:max-w-[1180px]");
    expect(homeSource).toContain("scrollbar-none");
    expect(homeSource).toContain("Review the full signal");
  });

  it("keeps application scrolling usable while hiding visible scrollbar chrome", () => {
    expect(styleSource).toContain("scrollbar-width: none");
    expect(styleSource).toContain("*::-webkit-scrollbar");
  });

  it("keeps the product site focused and free of prior 3D-style signal components", () => {
    expect(introSource).toContain("Find the people");
    expect(introSource).toContain("A quiet path to the right request.");
    expect(introSource).toContain("Live signal sample");
    expect(introSource).toContain("aria-pressed={activeSignal === index}");
    expect(introSource).not.toContain("SignalOrbital");
    expect(introSource).not.toContain("SignalProof");
  });
});
