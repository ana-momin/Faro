import FaroLogo from "@/components/FaroLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Onboarding() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"welcome" | "create" | "signin">("welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const supported = useMemo(() => browserSupportsWebAuthn(), []);
  const registrationOptions = trpc.auth.passkeyRegistrationOptions.useMutation();
  const registrationVerify = trpc.auth.passkeyRegistrationVerify.useMutation();
  const authenticationOptions = trpc.auth.passkeyAuthenticationOptions.useMutation();
  const authenticationVerify = trpc.auth.passkeyAuthenticationVerify.useMutation();

  const finish = async () => {
    await utils.auth.me.invalidate();
  };

  const createWorkspace = async () => {
    if (!name.trim()) return;
    if (!supported) {
      toast.error("This browser cannot create a passkey. Use a current browser with device security enabled.");
      return;
    }
    try {
      setWorking(true);
      const options = await registrationOptions.mutateAsync({ name: name.trim(), email: email.trim() });
      const response = await startRegistration({ optionsJSON: options });
      await registrationVerify.mutateAsync({ response });
      await finish();
      toast.success("Your private Faro workspace is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey setup did not complete. Please try again.");
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
      await finish();
      toast.success("Welcome back to Faro.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This device could not sign in. Try the device where you created Faro.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f8f4ed] p-3 sm:p-5 md:p-6">
      <div className="mx-auto grid h-full max-w-5xl overflow-hidden rounded-[28px] border border-[#eadfd2] bg-[#fffdfa] shadow-[0_24px_60px_rgba(91,55,32,0.1)] md:grid-cols-[1.06fr_0.94fr]">
        <section className="hidden min-h-0 flex-col justify-between bg-[#2b1a13] p-7 text-white md:flex lg:p-9">
          <FaroLogo className="[&>span:last-child]:text-white" />
          <div className="py-5 lg:py-7">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#f6c28e]">
              <Sparkles className="h-5 w-5" />
            </span>
            <h1 className="mt-5 max-w-md text-3xl font-extrabold tracking-[-0.07em] lg:text-4xl">Your private X signal desk.</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">Faro keeps your saved searches, posts, and provider setup inside your own workspace. Every external X action stays manual.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/50"><LockKeyhole className="h-3.5 w-3.5 text-[#f6c28e]" />Protected by this device’s passkey.</div>
        </section>

        <section className="flex min-h-0 flex-col justify-center overflow-y-auto p-6 sm:p-8 md:p-9 lg:p-10">
          <div className="mx-auto w-full max-w-sm">
            <FaroLogo />
            <div className="mt-6">
              {mode === "welcome" && <>
                <h2 className="text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Open your Faro desk.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Create one secure workspace on this device, or return with the passkey you already created.</p>
                <Button onClick={() => setMode("create")} size="lg" className="mt-6 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]"><Fingerprint className="mr-2 h-4 w-4" />Create this device workspace</Button>
                <Button onClick={() => setMode("signin")} variant="outline" size="lg" className="mt-3 h-11 w-full rounded-xl border-[#e7d7c7] text-[#75432e] hover:bg-[#fff4e8]"><LockKeyhole className="mr-2 h-4 w-4" />Use an existing passkey</Button>
              </>}
              {mode === "create" && <>
                <button onClick={() => setMode("welcome")} className="text-xs font-bold text-[#a06952] hover:text-[#75432e]">← Back</button>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Set up your workspace.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Your name is required. Email is optional; Faro uses initials for your profile in this staging release.</p>
                <label className="mt-5 block text-xs font-bold text-[#65483a]">Name<Input value={name} onChange={event => setName(event.target.value)} placeholder="Your name" className="mt-2 h-11 rounded-xl border-[#e7d7c7] bg-white" autoComplete="name" /></label>
                <label className="mt-3 block text-xs font-bold text-[#65483a]">Email <span className="font-medium text-[#ae9788]">optional</span><Input value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="you@example.com" className="mt-2 h-11 rounded-xl border-[#e7d7c7] bg-white" autoComplete="email" /></label>
                <Button onClick={createWorkspace} disabled={working || !name.trim()} size="lg" className="mt-5 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Fingerprint className="mr-2 h-4 w-4" />Create passkey workspace</>}</Button>
              </>}
              {mode === "signin" && <>
                <button onClick={() => setMode("welcome")} className="text-xs font-bold text-[#a06952] hover:text-[#75432e]">← Back</button>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.055em] text-[#312018]">Welcome back.</h2>
                <p className="mt-2 text-sm leading-6 text-[#806c5e]">Use the passkey created for Faro on this device.</p>
                <Button onClick={signIn} disabled={working} size="lg" className="mt-6 h-11 w-full rounded-xl bg-[#b85e43] hover:bg-[#9e4f39]">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Fingerprint className="mr-2 h-4 w-4" />Continue with passkey</>}</Button>
              </>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
