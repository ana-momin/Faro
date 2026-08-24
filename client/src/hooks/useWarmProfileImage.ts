import { useEffect } from "react";

export function warmProfileImage(avatarUrl?: string | null) {
  if (!avatarUrl || typeof Image === "undefined") return;

  const image = new Image();
  image.decoding = "async";
  image.src = avatarUrl;
}

export function useWarmProfileImage(avatarUrl?: string | null) {
  useEffect(() => {
    warmProfileImage(avatarUrl);
  }, [avatarUrl]);
}
