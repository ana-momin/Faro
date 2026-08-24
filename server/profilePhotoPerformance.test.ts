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

  it("prioritizes the large Profile avatar while keeping a smooth fallback contract", () => {
    const profile = readFileSync(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8");
    const layout = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

    expect(layout).toContain("useWarmProfileImage(user?.avatarUrl)");
    expect(profile).toContain('fetchPriority="high"');
    expect(profile).toContain('onLoadingStatusChange={status => setProfileImageLoaded(status === "loaded")}');
    expect(profile).toContain("delayMs={300}");
  });
});
