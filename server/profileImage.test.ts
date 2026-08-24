import { describe, expect, it } from "vitest";
import { parseProfileImageDataUrl } from "./profileImage";

describe("Faro profile image validation", () => {
  it("accepts a supported compact PNG data URL", () => {
    expect(parseProfileImageDataUrl("data:image/png;base64,aGVsbG8=")).toMatchObject({ contentType: "image/png", extension: "png" });
  });

  it("rejects unsupported or malformed avatar content", () => {
    expect(() => parseProfileImageDataUrl("data:image/gif;base64,aGVsbG8=")).toThrow("JPG, PNG, or WebP");
  });
});
