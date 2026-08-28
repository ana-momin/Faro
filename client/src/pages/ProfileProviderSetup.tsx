import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CircleHelp, ExternalLink, Eye, EyeOff, KeyRound, Pencil, PlugZap, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Provider = "twitterapi_io" | "official_x";

const providerInfo: Record<Provider, { name: string; detail: string; pricing: string; setup: string }> = {
  twitterapi_io: {
    name: "TwitterAPI.io",
    detail: "Independent third-party X data service. Faro uses one advanced-search request for each new collection batch.",
    pricing: "https://twitterapi.io/pricing",
    setup: "https://twitterapi.io/dashboard",
  },
  official_x: {
    name: "Official X API",
    detail: "X’s direct developer platform. Your bearer token is used only for your Faro account’s collection requests.",
    pricing: "https://docs.x.com/x-api/getting-started/pricing",
    setup: "https://developer.x.com/",
  },
};

export function ProviderSetup({ setup, loading }: { setup: any; loading: boolean }) {
  const utils = trpc.useUtils();
  const [provider, setProvider] = useState<Provider>("twitterapi_io");
  const [credential, setCredential] = useState("");
  const [showCredential, setShowCredential] = useState(false);
  const [dailyRequestLimit, setDailyRequestLimit] = useState(10);
  const [editingSavedProvider, setEditingSavedProvider] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const providerSelectionInitialized = useRef(false);
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!setup?.configured || providerSelectionInitialized.current) return;
    setProvider(setup.provider);
    setDailyRequestLimit(setup.dailyRequestLimit);
    providerSelectionInitialized.current = true;
  }, [setup?.configured, setup?.provider, setup?.dailyRequestLimit]);
  const save = trpc.monitoring.saveProviderSetup.useMutation({
    onSuccess: async () => {
      setCredential("");
      await utils.monitoring.providerSetup.invalidate();
      await utils.monitoring.overview.invalidate();
      toast.success("Provider connection saved. Faro will use this account only.", { position: "bottom-right" });
    },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });
  const remove = trpc.monitoring.removeProviderSetup.useMutation({
    onSuccess: async () => {
      await utils.monitoring.providerSetup.invalidate();
      await utils.monitoring.overview.invalidate();
      toast.success("Provider connection removed.", { position: "bottom-right" });
    },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });
  const updateDailyLimit = trpc.monitoring.updateProviderDailyLimit.useMutation({
    onSuccess: async result => {
      setDailyRequestLimit(result.dailyRequestLimit);
      await utils.monitoring.providerSetup.invalidate();
      await utils.monitoring.overview.invalidate();
      toast.success("Daily request limit updated.", { position: "bottom-right", duration: 1500 });
    },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });
  const selected = providerInfo[provider];
  const selectedProviderConnected = Boolean(setup?.configured && setup.provider === provider);
  const chooseProvider = (nextProvider: Provider) => {
    setProvider(nextProvider);
    setCredential("");
    setShowCredential(false);
    setEditingSavedProvider(false);
    setDailyRequestLimit(nextProvider === setup?.provider ? setup.dailyRequestLimit : 10);
  };
  if (loading) return <section className="mt-5 grid min-h-56 place-items-center rounded-[28px] border border-[#eadfd2] bg-white text-xs font-bold text-[#9a7d68]">Loading provider setup…</section>;
  return <><section className="mt-5 max-w-3xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">Client-owned connection</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-0.05em] text-[#432b1e]">Provider setup</h2><p className="mt-2 max-w-xl text-[11px] leading-5 text-[#8e7463]">Connect the account that pays for your source requests. Faro stores it encrypted and never displays the full key again.</p></div>{selectedProviderConnected ? <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d1e4d5] bg-[#f4fbf5] px-3 py-2 text-[10px] font-extrabold text-[#3f7757]"><ShieldCheck className="h-3.5 w-3.5" />{selected.name} connected</span> : <span className="rounded-full border border-[#eed8bd] bg-[#fff8ed] px-3 py-2 text-[10px] font-extrabold text-[#9a613f]">Setup needed</span>}</div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{(Object.keys(providerInfo) as Provider[]).map(option => { const info = providerInfo[option]; const active = provider === option; return <button key={option} type="button" onClick={() => chooseProvider(option)} className={`rounded-[22px] border p-4 text-left transition ${active ? "border-[#d69b79] bg-[#fff4e8] shadow-[0_8px_18px_rgba(99,59,31,0.05)]" : "border-[#eadfd2] bg-white hover:bg-[#fffaf5]"}`}><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-[#f5d9c4] text-[#a65a40]" : "bg-[#f7eee6] text-[#9b6b53]"}`}><PlugZap className="h-4 w-4" /></span><ProviderHelp detail={info.detail} /></div><p className="mt-3 text-xs font-extrabold text-[#573b2d]">{info.name}</p><p className="mt-1 text-[10px] leading-4 text-[#987d6c]">Your account, your provider billing.</p></button>; })}</div>
    <div className="mt-4 rounded-[26px] border border-[#eadfd2] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold text-[#56392a]">{selected.name} credential</p><p className="mt-1 text-[10px] leading-5 text-[#977a68]">A new Search or Refresh uses only the explicit source-call allowance you set. Saved results use no provider calls.</p>{provider === "twitterapi_io" ? <p className="mt-2 max-w-xl text-[9px] leading-4 text-[#7d6555]">New TwitterAPI.io accounts currently include $0.10 in free credit (10,000 credits) with no card required. Provider terms and pricing can change; confirm in its dashboard before collecting.</p> : null}</div><div className="flex gap-2"><a href={selected.pricing} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#eadfd2] px-2.5 text-[10px] font-extrabold text-[#83523c] hover:bg-[#fff4e8]">Pricing <ExternalLink className="h-3 w-3" /></a><a href={selected.setup} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#f7e6d7] px-2.5 text-[10px] font-extrabold text-[#8f4e38] hover:bg-[#f2dac7]">Get key <ExternalLink className="h-3 w-3" /></a></div></div>
      {selectedProviderConnected ? <><div className="mt-4 rounded-2xl border border-[#e2eee4] bg-[#f7fcf8] p-3.5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="inline-flex items-center gap-2 text-[10px] font-bold text-[#49705a]"><KeyRound className="h-3.5 w-3.5" />Saved {selected.name} key {setup.credentialHint}</p><p className="mt-1 text-[9px] text-[#668271]">Your saved key stays encrypted. Changing the daily limit never needs the key again.</p></div><div className="flex gap-1.5"><button type="button" onClick={() => setEditingSavedProvider(value => !value)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cfe4d5] bg-white px-2.5 text-[10px] font-extrabold text-[#477b5b] hover:bg-[#e8f4ea]" aria-label={editingSavedProvider ? "Cancel API key replacement" : `Replace ${selected.name} API key`}><Pencil className="h-3.5 w-3.5" />{editingSavedProvider ? "Cancel" : "Replace key"}</button><button type="button" disabled={remove.isPending} onClick={() => setConfirmRemove(true)} className="grid h-8 w-8 place-items-center rounded-lg text-[#a24b43] hover:bg-[#fff0ee]" aria-label="Remove provider connection" title="Remove provider connection"><Trash2 className="h-3.5 w-3.5" /></button></div></div><div className="mt-3 grid gap-2 border-t border-[#dcecdf] pt-3 sm:grid-cols-3"><UsageMetric label="Today" value={`${setup?.callsToday ?? 0} used`} /><UsageMetric label="Remaining" value={`${setup?.remainingCalls ?? 0} requests`} /><UsageMetric label="Daily limit" value={`${setup?.dailyRequestLimit ?? dailyRequestLimit} requests`} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#dcecdf] pt-3"><p className="text-[9px] leading-4 text-[#668271]">Provider credit balance stays in your {selected.name} dashboard; Faro does not query it.</p><button type="button" onClick={() => setLocation("/search?firstBatch=1")} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#477b5b] px-3 text-[10px] font-extrabold text-white transition hover:bg-[#38694b]"><ArrowRight className="h-3.5 w-3.5" />Find first posts</button></div></div>
        <section className="mt-4 rounded-2xl border border-[#eadfd2] bg-[#fffdfa] p-3.5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-extrabold text-[#573b2d]">Daily source-call limit</p><p className="mt-1 max-w-sm text-[9px] leading-4 text-[#987d6c]">This is Faro’s guardrail for this provider. Change it without re-entering your saved API key.</p></div><div className="flex items-end gap-2"><label className="block"><span className="sr-only">Daily request limit</span><input type="number" min={1} max={100} value={dailyRequestLimit} onChange={event => setDailyRequestLimit(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="h-10 w-24 rounded-xl border border-[#dec9b5] bg-white px-3 text-xs font-bold text-[#56392a] outline-none focus:border-[#c98262]" /></label><button type="button" disabled={updateDailyLimit.isPending || dailyRequestLimit === setup?.dailyRequestLimit} onClick={() => updateDailyLimit.mutate({ dailyRequestLimit })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#b85f45] px-3.5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36] disabled:cursor-not-allowed disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />{updateDailyLimit.isPending ? "Saving…" : "Save limit"}</button></div></div></section>
        {editingSavedProvider ? <section className="mt-4 rounded-2xl border border-[#edd1c4] bg-[#fff7f1] p-3.5"><p className="text-[11px] font-extrabold text-[#794330]">Replace API key</p><p className="mt-1 text-[9px] leading-4 text-[#9a725e]">Only use this if you want to change the saved {selected.name} credential. It does not affect your daily limit.</p><CredentialInput provider={provider} credential={credential} showCredential={showCredential} onCredential={setCredential} onToggle={() => setShowCredential(visible => !visible)} /><div className="mt-3 flex justify-end"><button type="button" disabled={credential.trim().length < 12 || save.isPending} onClick={() => save.mutate({ provider, credential: credential.trim(), dailyRequestLimit })} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#b85f45] px-3.5 text-[10px] font-extrabold text-white hover:bg-[#9f4d36] disabled:cursor-not-allowed disabled:opacity-40"><KeyRound className="h-3.5 w-3.5" />{save.isPending ? "Saving…" : "Save replacement"}</button></div></section> : null}</> : <><CredentialInput provider={provider} credential={credential} showCredential={showCredential} onCredential={setCredential} onToggle={() => setShowCredential(visible => !visible)} /><label className="mt-4 block max-w-48"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9b7e6b]">Daily request limit</span><input type="number" min={1} max={100} value={dailyRequestLimit} onChange={event => setDailyRequestLimit(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="mt-2 h-10 w-full rounded-xl border border-[#dec9b5] bg-[#fffdfa] px-3 text-xs font-bold text-[#56392a] outline-none focus:border-[#c98262]" /></label><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] leading-5 text-[#9a7a67]">Set a daily limit before connecting this provider. Background collection stays off by default.</p><button type="button" disabled={credential.trim().length < 12 || save.isPending} onClick={() => save.mutate({ provider, credential: credential.trim(), dailyRequestLimit })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36] disabled:cursor-not-allowed disabled:opacity-40"><KeyRound className="h-3.5 w-3.5" />{save.isPending ? "Saving…" : `Connect ${selected.name}`}</button></div></>}</div>
    </section>
    <ConfirmDialog open={confirmRemove} onOpenChange={setConfirmRemove} title="Remove this provider connection?" description="Searches and Refresh will stop until another key is added. This can't be undone." confirmLabel="Remove" pending={remove.isPending} onConfirm={() => remove.mutate()} />
  </>;
}

function ProviderHelp({ detail }: { detail: string }) { return <Tooltip><TooltipTrigger asChild><span className="grid h-7 w-7 place-items-center rounded-lg border border-[#eadfd2] text-[#9b725d]" aria-label="Provider information"><CircleHelp className="h-3.5 w-3.5" /></span></TooltipTrigger><TooltipContent side="top" className="max-w-56 bg-[#3f2b20] px-3 py-2 text-[10px] leading-4 text-white">{detail}</TooltipContent></Tooltip>; }
function UsageMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[#dcecdf] bg-white/70 px-2.5 py-2"><p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-[#789281]">{label}</p><p className="mt-0.5 text-[10px] font-extrabold text-[#49705a]">{value}</p></div>; }
function CredentialInput({ provider, credential, showCredential, onCredential, onToggle }: { provider: Provider; credential: string; showCredential: boolean; onCredential: (value: string) => void; onToggle: () => void }) { return <label className="mt-4 block"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9b7e6b]">Paste credential</span><div className="relative mt-2"><input type={showCredential ? "text" : "password"} autoComplete="off" value={credential} onChange={event => onCredential(event.target.value)} className="h-11 w-full rounded-xl border border-[#dec9b5] bg-white px-3 pr-12 text-xs text-[#56392a] outline-none placeholder:text-[#b39a88] focus:border-[#c98262]" placeholder={provider === "twitterapi_io" ? "TwitterAPI.io API key" : "Official X API bearer token"} /><button type="button" onClick={onToggle} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#9b725d] transition hover:text-[#75432e]" aria-label={showCredential ? "Hide credential" : "Show credential"} title={showCredential ? "Hide credential" : "Show credential"}>{showCredential ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><p className="mt-1.5 text-[9px] text-[#a08370]">Reveal only to check what you typed. Faro encrypts the credential when you save it.</p></label>; }
