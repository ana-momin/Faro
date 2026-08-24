const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function parseProfileImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Choose a JPG, PNG, or WebP image.");
  const contentType = match[1];
  if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(contentType)) throw new Error("Choose a JPG, PNG, or WebP image.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PROFILE_IMAGE_BYTES) throw new Error("Choose an image smaller than 2 MB.");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return { bytes, contentType, extension };
}
