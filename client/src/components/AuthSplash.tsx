import FaroLogo from "@/components/FaroLogo";

const STORAGE_KEY = "faro:has-signed-in";

/**
 * Whether this browser has ever reached a signed-in Faro session.
 *
 * While `useAuth` is still resolving we do not yet know whether the visitor is signed in, and the
 * two outcomes want different loading states: a returning user should see the workspace skeleton
 * so the app feels instant, while a first-time visitor seeing a fake dashboard that then flips to
 * a passkey prompt just looks broken. This flag lets the loading state match where the visitor is
 * actually about to land. It is a presentation hint only - never an auth decision.
 */
export function hasSignedInBefore() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSignedInOnThisDevice() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage unavailable; the visitor simply gets the neutral splash next time.
  }
}

/** Calm branded hold for a visitor who is most likely about to be asked to sign in. */
export function AuthSplash() {
  return (
    <div className="grid h-[100dvh] place-items-center bg-[#f8f4ed] p-6">
      <div className="flex flex-col items-center gap-5">
        <div className="animate-pulse">
          <FaroLogo className="[&>span:first-child]:h-12 [&>span:first-child]:w-12 [&>span:first-child]:rounded-[16px] [&>span:last-child]:text-[26px]" />
        </div>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-[#eadfd2]">
          <div className="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] rounded-full bg-[#b85f45]" />
        </div>
        <p className="text-[11px] font-semibold text-[#9a7c68]">Preparing your secure sign-in…</p>
      </div>
      <style>{"@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}"}</style>
    </div>
  );
}
