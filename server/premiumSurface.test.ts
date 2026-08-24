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

  it("adds the proof-led signal receipt section to the product experience", () => {
    expect(introSource).toContain("<SignalProof");
    expect(introSource).toContain("Built around proof, not pretty noise.");
  });
});
