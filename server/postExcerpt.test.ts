import { describe, expect, it } from "vitest";
import { makePostExcerpt } from "../client/src/components/XPostCard";

describe("makePostExcerpt", () => {
  it("keeps a long post compact while retaining the service-request language", () => {
    const body = `${"Background context ".repeat(70)}We are looking for a freelancer to automate our client intake workflow and need help shipping it this month. ${"More detail ".repeat(70)}`;
    const excerpt = makePostExcerpt(body);
    expect(excerpt.length).toBeLessThanOrEqual(565);
    expect(excerpt.toLowerCase()).toContain("looking for a freelancer");
  });
});
