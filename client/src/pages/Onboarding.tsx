import FaroLogo from "@/components/FaroLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getPasskeyErrorMessage } from "@/lib/passkeyErrors";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { ArrowLeft, CheckCircle2, Fingerprint, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type OnboardingMode = "welcome" | "create" | "signin" | "profile";

export default function Onboarding({ profileRequired = false }: { profileRequired?: boolean }) {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<OnboardingMode>(profileRequired ? "profile" : "welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const supported = useMemo(() => browserSupportsWebAuthn(), []);
  const registrationOptions = trpc.auth.passkeyRegistrationOptions.useMutation();
  const registrationVerify = trpc.auth.passkeyRegistrationVerify.useMutation();
  const authenticationOptions = trpc.auth.passkeyAuthenticationOptions.useMutation();
  const authenticationVerify = trpc.auth.passkeyAuthenticationVerify.useMutation();
  const profileComplete = trpc.auth.completeProfile.useMutation();

  const refreshSession = async () => {
    await utils.auth.me.invalidate();
  };

  const createPasskey = async () => {
    if (!supported) {
      toast.error("This browser cannot create a passkey. Use a current browser with device security enabled.");
      return;
    }
    try {
      setWorking(true);
      const options = await registrationOptions.mutateAsync();
      const response = await startRegistration({ optionsJSON: options });
      await registrationVerify.mutateAsync({ response });
      await refreshSession();
      setMode("profile");
      toast.success("Passkey confirmed. Finish your Faro profile.");
    } catch (error) {
      toast.error(getPasskeyErrorMessage(error, "create"));
    } finally {
      setWorking(false);
    }
  };

  const signIn = async () => {
    if (!supported) {
      toast.error("This browser cannot use a passkey. Use the device where you created your Faro passkey.");
      return;
    }
    try {
      setWorking(true);
      const options = await authenticationOptions.mutateAsync();
      const response = await startAuthentication({ optionsJSON: options });
      await authenticationVerify.mutateAsync({ response });
      await refreshSession();
      toast.success("Welcome back to Faro.");
    } catch (error) {
      toast.error(getPasskeyErrorMessage(error, "signIn"));
    } finally {
      setWorking(false);
    }
  };

  const completeProfile = async () => {
    if (!name.trim()) return;
    // Validated before the request so a malformed address gets a specific, fixable message rather
    // than the server's generic "could not save your profile" - the user cannot act on that.
    if (emailError) {
      toast.error(emailError);
      return;
    }
    try {
      setWorking(true);
      await profileComplete.mutateAsync({ name: name.trim(), email: email.trim() });
      await refreshSession();
      toast.success("Your Faro desk is ready.");
    } catch (error) {
      toast.error(getPasskeyErrorMessage(error, "profile"));
    } finally {
      setWorking(false);
    }
  };

  const isProfile = mode === "profile";
  // Email is optional here, so an empty field is valid; only a filled-in malformed one is an error.
  const emailError = email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    ? "That email address does not look right. Check for a missing @ or domain, or leave it blank."
    : null;

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f8f4ed] p-3 sm:p-5 md:p-6">
      <div className="mx-auto grid h-full max-w-5xl overflow-hidden rounded-[28px] border border-[#eadfd2] bg-[#fffdfa] shadow-[0_24px_60px_rgba(91,55,32,0.1)] md:grid-cols-[1.06fr_0.94fr]">
        <section className="hidden min-h-0 flex-col justify-between bg-[#2b1a13] p-7 text-white md:flex lg:p-9">
          <FaroLogo className="[&>span:last-child]:text-white" />
          <div className="py-5 lg:py-7">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#f6c28e]"><Sparkles className="h-5 w-5" /></span>
            <h1 className="mt-5 max-w-md text-3xl font-extrabold tracking-[-0.07em] lg:text-4xl">A quieter way to find your next signal.</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">One passkey protects your Faro desk. No password, no provider connection, and no X request are needed to get started.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/50"><LockKeyhole className="h-3.5 w-3.5 text-[#f6c28e]" />Protected by this device’s passkey.</div>
        </section>

        <section className="flex min-h-0 flex-col justify-center overflow-y-auto p-6 sm:p-8 md:p-9 lg:p-10">
          <div className="mx-auto w-full max-w-sm">
            <FaroLogo />
            <div className="mt-6">
              {mode === "welcome" && <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0df] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9b583d]"><LockKeyhole className="h-3 w-3" />Passwordless access</span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Open your Faro desk.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Create a device passkey in seconds, or return with the one you already use.</p>
                <Button onClick={() => setMode("create")} size="lg" className="mt-6 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]"><Fingerprint className="mr-2 h-4 w-4" />Create a new passkey</Button>
                <Button onClick={() => setMode("signin")} variant="outline" size="lg" className="mt-3 h-11 w-full rounded-xl border-[#e7d7c7] text-[#75432e] hover:bg-[#fff4e8]"><LockKeyhole className="mr-2 h-4 w-4" />I already have a passkey</Button>
              </>}
              {mode === "create" && <>
                <button onClick={() => setMode("welcome")} className="inline-flex items-center gap-1 text-xs font-bold text-[#a06952] hover:text-[#75432e]"><ArrowLeft className="h-3.5 w-3.5" />Back</button>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Create your passkey.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Choose Windows Hello, Google Password Manager, your phone, or another available passkey method. Faro never sees that secret.</p>
                <Button onClick={createPasskey} disabled={working} size="lg" className="mt-6 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Fingerprint className="mr-2 h-4 w-4" />Continue with passkey</>}</Button>
              </>}
              {mode === "signin" && <>
                <button onClick={() => setMode("welcome")} className="inline-flex items-center gap-1 text-xs font-bold text-[#a06952] hover:text-[#75432e]"><ArrowLeft className="h-3.5 w-3.5" />Back</button>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Use your existing passkey.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Choose the Faro passkey from this device, Google Password Manager, or your phone.</p>
                <Button onClick={signIn} disabled={working} size="lg" className="mt-6 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Fingerprint className="mr-2 h-4 w-4" />Continue with passkey</>}</Button>
              </>}
              {isProfile && <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f5eb] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3b7a4e]"><CheckCircle2 className="h-3 w-3" />Passkey confirmed</span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Complete your profile.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Add your name to enter your desk.</p>
                <label className="mt-5 block text-xs font-bold text-[#65483a]">Name<Input value={name} onChange={event => setName(event.target.value)} placeholder="Your name" className="mt-2 h-11 rounded-xl border-[#e7d7c7] bg-white" autoComplete="name" autoFocus /></label>
                <label className="mt-3 block text-xs font-bold text-[#65483a]">Email <span className="font-medium text-[#ae9788]">optional</span><Input value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="you@example.com" aria-invalid={Boolean(emailError)} className={`mt-2 h-11 rounded-xl bg-white ${emailError ? "border-[#d9a094] focus-visible:ring-[#d9a094]" : "border-[#e7d7c7]"}`} autoComplete="email" /></label>
                {emailError ? <p className="mt-1.5 text-[11px] font-semibold leading-4 text-[#b0503f]">{emailError}</p> : null}
                <Button onClick={completeProfile} disabled={working || !name.trim()} size="lg" className="mt-5 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter Faro"}</Button>
              </>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
