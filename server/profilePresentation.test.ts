import { describe, expect, it } from "vitest";
import { getMembershipLabel, getProfileFirstName, getProfileInitials } from "../client/src/lib/profile";

describe("Faro profile presentation", () => {
  it("builds a personal greeting and initials from the signed-in member", () => {
    expect(getProfileFirstName("M Anas")).toBe("M");
    expect(getProfileInitials("M Anas")).toBe("MA");
  });

  it("keeps membership context personal without relying on fake profile data", () => {
    expect(getMembershipLabel("2026-08-23T18:52:02.000Z")).toBe("Member since August 2026");
    expect(getMembershipLabel(null)).toBe("Private Faro AI member");
  });
});
