import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { warmProfileImage } from "../client/src/hooks/useWarmProfileImage";

describe("Faro profile photo performance", () => {
  it("warms a stored avatar URL without requesting an image when none exists", () => {
    const OriginalImage = globalThis.Image;
    const source = vi.fn();
    class TestImage {
      decoding = "";
      set src(value: string) { source(value); }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    try {
      warmProfileImage("/manus-storage/faro/member.webp");
      warmProfileImage(undefined);
      expect(source).toHaveBeenCalledTimes(1);
      expect(source).toHaveBeenCalledWith("/manus-storage/faro/member.webp");
    } finally {
      globalThis.Image = OriginalImage;
    }
  });

  it("renders the shared cat profile image directly without an opacity gate", () => {
    const profile = readFileSync(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8");
    const layout = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

    expect(layout).toContain("useWarmProfileImage(FARO_SHARED_PROFILE_IMAGE)");
    expect(layout).toContain("AvatarImage src={FARO_SHARED_PROFILE_IMAGE}");
    expect(profile).toContain('fetchPriority="high"');
    expect(profile).toContain('alt="Faro profile cat"');
    expect(profile).toContain('className="object-cover object-center"');
    expect(profile).not.toContain("profileImageLoaded");
    expect(profile).toContain("delayMs={300}");
  });
});
