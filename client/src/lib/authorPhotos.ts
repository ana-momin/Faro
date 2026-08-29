import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "faro:hide-author-photos";
const CHANGE_EVENT = "faro:hide-author-photos-changed";

/**
 * Viewer preference for hiding the profile photos attached to public X posts, showing each
 * author's initial instead. Some people would rather not have arbitrary strangers' photos rendered
 * on their screen at all - for privacy, for focus, or on personal or religious grounds - and the
 * post's text, handle, and link are what Faro is actually for.
 *
 * Deliberately applies to every author rather than trying to guess anything about who they are:
 * inferring characteristics of real people from their photo would be both unreliable and wrong.
 *
 * Stored per-browser rather than on the account: it is a display preference, needs no migration,
 * and reads/writes are guarded because storage can throw in private windows.
 */
function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useHideAuthorPhotos() {
  const [hidden, setHidden] = useState(readPreference);

  useEffect(() => {
    const sync = () => setHidden(readPreference());
    // `storage` covers other tabs; the custom event covers other components in this one.
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const setHideAuthorPhotos = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable; the in-memory state below still applies for this session.
    }
    setHidden(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { hideAuthorPhotos: hidden, setHideAuthorPhotos };
}
