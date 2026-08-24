import { describe, expect, it } from "vitest";
import { getProductStage, PRODUCT_INTRO_PATH, productStages } from "../client/src/lib/productIntro";

describe("Faro product introduction", () => {
  it("uses a dedicated product route and tells the complete three-part product story", () => {
    expect(PRODUCT_INTRO_PATH).toBe("/faro");
    expect(productStages.map(stage => stage.eyebrow)).toEqual(["01 · Sense", "02 · Qualify", "03 · Decide"]);
  });

  it("keeps the stage graphic selection safely within the product story", () => {
    expect(getProductStage(-10)).toEqual(productStages[0]);
    expect(getProductStage(99)).toEqual(productStages[2]);
  });
});
