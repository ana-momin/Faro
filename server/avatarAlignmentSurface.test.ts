import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const avatarSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/avatar.tsx"), "utf8");

describe("Faro account avatar alignment", () => {
  it("centers both profile imagery and fallback content inside the circular avatar frame", () => {
    expect(avatarSource).toContain("items-center justify-center");
    expect(avatarSource).toContain("object-cover object-center");
    expect(avatarSource).toContain("rounded-full leading-none");
  });
});
