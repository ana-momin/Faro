export const FARO_AVATAR_URLS = [
  "/faro-avatars/ember.svg",
  "/faro-avatars/sage.svg",
  "/faro-avatars/dusk.svg",
  "/faro-avatars/sky.svg",
] as const;

export type FaroAvatarUrl = (typeof FARO_AVATAR_URLS)[number];

export const FARO_AVATARS: ReadonlyArray<{ url: FaroAvatarUrl; label: string }> = [
  { url: "/faro-avatars/ember.svg", label: "Ember" },
  { url: "/faro-avatars/sage.svg", label: "Sage" },
  { url: "/faro-avatars/dusk.svg", label: "Dusk" },
  { url: "/faro-avatars/sky.svg", label: "Sky" },
];
