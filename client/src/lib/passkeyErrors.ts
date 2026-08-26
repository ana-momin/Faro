type PasskeyAction = "create" | "signIn" | "profile";

const safeServerMessages = [
  "This passkey setup request expired. Please try again.",
  "Your device could not verify this passkey.",
  "This sign-in request expired. Please try again.",
  "Your Faro profile is unavailable.",
  "Your Faro profile could not be updated.",
];

export function getPasskeyErrorMessage(error: unknown, action: PasskeyAction): string {
  const errorName = error instanceof Error ? error.name : "";
  const serverMessage = error instanceof Error ? error.message : "";

  if (safeServerMessages.includes(serverMessage)) return serverMessage;
  if (errorName === "NotAllowedError") return "Passkey verification was cancelled or not allowed. Please try again when you are ready.";
  if (errorName === "AbortError") return "Passkey verification was cancelled. Please try again when you are ready.";
  if (errorName === "TimeoutError") return "The passkey request timed out. Please try again.";
  if (errorName === "InvalidStateError") return "This passkey is already on this device. Try signing in instead.";
  if (errorName === "NotSupportedError") return "This device cannot use passkeys yet. Try a current browser with device security enabled.";
  if (errorName === "SecurityError") return "Passkeys must be used from the Faro staging address. Reload the page and try again.";

  if (action === "profile") return "We could not save your profile. Please try again.";
  return "We could not confirm that passkey. Please try again.";
}
