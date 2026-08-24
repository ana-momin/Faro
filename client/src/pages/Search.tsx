import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSearchLifecycleDetails, type SearchLifecycle } from "@/lib/discoverSearch";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, KeyRound, Loader2, Radar, Search as SearchIcon, Sparkles, WandSparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const suggestions = [
  { label: "AI agents", value: "Find founders and teams looking for a provider to build or implement AI agents." },
  { label: "Automation", value: "Find operators who need someone to automate repetitive business workflows." },
  { label: "AI video", value: "Find businesses seeking help with practical AI video production or video automation." },
];

export default function Search() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"agent" | "keyword">("agent");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [phase, setPhase] = useState<SearchLifecycle>("idle");
  const [result, setResult] = useState<{ inserted: number; sourceStatus: string; syncError?: string | null } | null>(null);
  const finish = async (data: { sync?: { inserted: number } | null; sourceStatus: string; syncError?: string | null }) => {
    await utils.monitoring.overview.invalidate();
    setResult({ inserted: data.sync?.inserted ?? 0, sourceStatus: data.sourceStatus, syncError: data.syncError });
    setPhase(data.syncError ? "attention" : data.sync?.inserted ? "complete" : "empty");
  };
  const agent = trpc.monitoring.agentStart.useMutation({ onSuccess: finish, onError: error => { setPhase("attention"); toast.error(error.message); } });
  const keyword = trpc.monitoring.keywordStart.useMutation({ onSuccess: finish, onError: error => { setPhase("attention"); toast.error(error.message); } });
  const pending = agent.isPending || keyword.isPending;
  useEffect(() => { if (!pending) return; setPhase("brief"); const source = window.setTimeout(() => setPhase("source"), 420); const qualify = window.setTimeout(() => setPhase("qualifying"), 1250); return () => { window.clearTimeout(source); window.clearTimeout(qualify); }; }, [pending]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (mode === "agent") agent.mutate({ brief }); else keyword.mutate({ keywords }); };
  const state = getSearchLifecycleDetails(phase);
  const ready = mode === "agent" ? brief.trim().length >= 12 : keywords.trim().length >= 2;
  return <DashboardLayout><div className="mx-auto max-w-4xl pb-10"><header className="flex items-center gap-3 border-b border-[#eadfd2] pb-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f1d7b9] text-[#8f4e38]"><SearchIcon className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Search X demand</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.06em]">Give Faro a signal to hunt.</h1></div></header><section className="mt-7 overflow-hidden rounded-[30px] border border-[#ead9c4] bg-[#fbf2e5] p-5 shadow-[0_16px_36px_rgba(99,59,31,0.07)] sm:p-7"><div className="flex gap-2"><ModeButton active={mode === "agent"} icon={Sparkles} label="AI brief" onClick={() => { setMode("agent"); setPhase("idle"); setResult(null); }} /><ModeButton active={mode === "keyword"} icon={KeyRound} label="Keyword search" onClick={() => { setMode("keyword"); setPhase("idle"); setResult(null); }} /></div><form onSubmit={submit} className="mt-6">{mode === "agent" ? <><label className="text-sm font-extrabold">What kind of buyer request should Faro find?</label><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="mt-3 min-h-28 resize-none rounded-2xl border-[#e3cdb1] bg-white text-sm leading-6 focus-visible:ring-[#bd674c]" placeholder="Example: Find founders looking for someone to automate lead follow-up with AI." /><div className="mt-3 flex flex-wrap gap-2">{suggestions.map(item => <button key={item.label} type="button" onClick={() => setBrief(item.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-bold transition ${brief === item.value ? "border-[#d49a78] bg-[#fff5ea] text-[#8d4d37]" : "border-[#ead9c4] bg-white/70 text-[#806452] hover:bg-white"}`}><WandSparkles className="h-3 w-3" />{item.label}</button>)}</div></> : <><label className="text-sm font-extrabold">Keywords or a focused phrase</label><Input value={keywords} onChange={event => setKeywords(event.target.value)} className="mt-3 h-13 rounded-2xl border-[#e3cdb1] bg-white px-4 text-sm focus-visible:ring-[#bd674c]" placeholder="Example: n8n automation for sales" /><p className="mt-3 text-[10px] leading-5 text-[#9a7d68]">Faro still keeps only people asking for help. Keywords guide the search; they do not surface service providers.</p></>}<div className="mt-6 flex items-center justify-between gap-4"><p className="max-w-md text-[10px] leading-5 text-[#987b67]">Each run makes one controlled public-source check. “View more” in Discover only reveals saved matches and never spends another source call.</p><Button type="submit" disabled={!ready || pending} className="h-11 shrink-0 rounded-2xl bg-[#b85f45] px-5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] hover:bg-[#9f4d36]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching</> : <><Radar className="mr-2 h-4 w-4" />Run Faro</>}</Button></div></form>{phase !== "idle" ? <SearchState phase={phase} state={state} result={result} onOpen={() => setLocation("/")} /> : null}</section></div></DashboardLayout>;
}
function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Sparkles; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${active ? "border-[#d69d7b] bg-white text-[#914f39] shadow-sm" : "border-transparent text-[#967760] hover:bg-white/60"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
function SearchState({ phase, state, result, onOpen }: { phase: SearchLifecycle; state: ReturnType<typeof getSearchLifecycleDetails>; result: { inserted: number; sourceStatus: string; syncError?: string | null } | null; onOpen: () => void }) { const alert = phase === "attention"; const done = phase === "complete" || phase === "empty" || alert; return <div className={`mt-6 rounded-2xl border p-4 ${alert ? "border-[#edcaba] bg-[#fff4ed]" : done ? "border-[#cae4d1] bg-[#f4fbf4]" : "border-[#ead9c4] bg-white/70"}`}><div className="flex items-start justify-between gap-4"><div><p className={`text-xs font-extrabold ${alert ? "text-[#a55136]" : done ? "text-[#397657]" : "text-[#8b604a]"}`}>{state.label}</p><p className="mt-1 text-[10px] leading-5 text-[#987c69]">{alert ? result?.syncError || state.detail : result?.inserted ? `${result.inserted} public posts screened. Faro will show only buyer requests with a real service need.` : state.detail}</p></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full transition-all duration-700 ${alert ? "bg-[#c46b4d]" : done ? "bg-[#5a9a70]" : "bg-[#b85f45]"}`} style={{ width: `${state.progress}%` }} /></div>{done && !alert ? <Button onClick={onOpen} variant="outline" className="mt-4 h-9 rounded-xl border-[#cce1d1] bg-white text-xs font-bold text-[#40745a] hover:bg-[#fafffa]">Open Discover <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}</div>; }
