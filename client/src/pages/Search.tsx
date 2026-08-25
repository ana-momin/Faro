import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMatchReason, getQualifiedPosts, getRequestCategory } from "@/lib/discoverFeed";
import { getSearchLifecycleDetails, type SearchLifecycle } from "@/lib/discoverSearch";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, Command, ExternalLink, KeyRound, Loader2, Radar, Search as SearchIcon, Send, Sparkles, WandSparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const suggestions = [
  { label: "AI agents", value: "Find founders and teams looking for a provider to build or implement AI agents." },
  { label: "Automation", value: "Find operators who need someone to automate repetitive business workflows." },
  { label: "AI video", value: "Find businesses seeking help with practical AI video production or video automation." },
  { label: "Product testing", value: "Find product teams looking for an outside specialist to test and validate an AI-enabled feature before launch." },
  { label: "Dev build", value: "Find teams looking for a contract developer to build or integrate an AI-enabled product workflow." },
  { label: "Content", value: "Find businesses seeking someone to create, publish, or automate practical AI-powered social content." },
];

type RetrievalMetrics = { sourceCalls: number; plannedPageRequests: number; queryFamilies: number; queryFamilyBudget: number; pagesChecked: number; pageBudget: number; rawReceived: number; deduplicatedPosts: number; buyerCandidates: number; persisted: number; queueWaitMs: number };
type SearchResult = { monitorId: number; inserted: number; sourceStatus: string; syncError?: string | null; retrieval?: RetrievalMetrics };

export default function Search() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"agent" | "keyword">("agent");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [phase, setPhase] = useState<SearchLifecycle>("idle");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const overview = trpc.monitoring.overview.useQuery(undefined, { staleTime: 5_000 });

  const finish = async (data: { monitorId: number; sync?: { inserted: number; retrieval?: RetrievalMetrics } | null; sourceStatus: string; syncError?: string | null }) => {
    const retrieval = data.sync?.retrieval;
    const sourceIssue = Boolean(data.syncError) || Boolean(retrieval?.buyerCandidates && !retrieval.persisted);
    await utils.monitoring.overview.invalidate();
    await overview.refetch();
    setResult({ monitorId: data.monitorId, inserted: data.sync?.inserted ?? 0, sourceStatus: data.sourceStatus, syncError: data.syncError ?? (sourceIssue ? "Faro found buyer candidates but could not save them. Please run the search again." : null), retrieval });
    setPhase(sourceIssue ? "attention" : retrieval?.persisted ? "complete" : "empty");
  };

  const agent = trpc.monitoring.agentStart.useMutation({ onSuccess: finish, onError: error => { setRunError(error.message); setPhase("attention"); toast.error(error.message); } });
  const keyword = trpc.monitoring.keywordStart.useMutation({ onSuccess: finish, onError: error => { setRunError(error.message); setPhase("attention"); toast.error(error.message); } });
  const pending = agent.isPending || keyword.isPending;

  useEffect(() => {
    if (!pending) { setElapsedSeconds(0); return; }
    setPhase("brief");
    const startedAt = Date.now();
    const source = window.setTimeout(() => setPhase("source"), 360);
    const qualify = window.setTimeout(() => setPhase("qualifying"), 1_050);
    const pulse = window.setInterval(() => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1_000))), 500);
    return () => { window.clearTimeout(source); window.clearTimeout(qualify); window.clearInterval(pulse); };
  }, [pending]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    setRunError(null);
    setElapsedSeconds(0);
    setPhase("brief");
    if (mode === "agent") agent.mutate({ brief });
    else keyword.mutate({ keywords });
  };

  const state = getSearchLifecycleDetails(phase, elapsedSeconds);
  const ready = mode === "agent" ? brief.trim().length >= 12 : keywords.trim().length >= 2;
  const qualifiedResults = useMemo(() => result ? getQualifiedPosts(overview.data?.posts ?? [], result.monitorId, false) : [], [overview.data?.posts, result]);

  return <div className="mx-auto w-full max-w-[1160px] pb-12">
    <header className="flex items-center justify-between border-b border-[#eadfd2] pb-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f4dfca] text-[#9a563e]"><Command className="h-4 w-4" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a25d47]">Faro AI</p><h1 className="mt-0.5 text-2xl font-extrabold tracking-[-0.06em] text-[#3d2e23]">Discovery</h1></div></div><span className="hidden rounded-full border border-[#ead9c4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#94624a] sm:inline">Buyer-side only</span></header>

    <section className="relative mt-6 overflow-hidden rounded-[34px] border border-[#e8d6c3] bg-[#fffaf4] px-5 py-6 shadow-[0_18px_46px_rgba(101,61,34,0.08)] sm:px-8 sm:py-9">
      <SignalArtwork />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-[#ead9c4] bg-white/80 px-3 py-1.5 text-[10px] font-extrabold text-[#9b593f]"><Sparkles className="h-3.5 w-3.5" />Ask Faro</div><h2 className="mt-4 text-3xl font-extrabold leading-[1.04] tracking-[-0.065em] text-[#432b1e] sm:text-4xl">Find the people<br className="hidden sm:block" /> already asking.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-[#856b59]">Describe a practical need. Faro filters public X posts into buyer-side requests.</p>
          <form onSubmit={submit} className="mt-6"><div className="rounded-[26px] border border-[#e5cdb7] bg-white p-2 shadow-[0_12px_28px_rgba(101,61,34,0.07)]"><div className="flex items-center gap-1 border-b border-[#f1e3d7] px-1 pb-2"><ModeButton active={mode === "agent"} icon={WandSparkles} label="Brief" onClick={() => { setMode("agent"); setPhase("idle"); setResult(null); }} /><ModeButton active={mode === "keyword"} icon={KeyRound} label="Keyword search" onClick={() => { setMode("keyword"); setPhase("idle"); setResult(null); }} /></div>{mode === "agent" ? <><label className="sr-only">Describe the buyer request Faro should find</label><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-32 resize-none border-0 bg-transparent px-3 py-4 text-sm leading-6 shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="Describe the buyer request you want Faro to find…" /><div className="flex flex-wrap gap-1.5 px-2 pb-2">{suggestions.map(item => <button key={item.label} type="button" onClick={() => setBrief(item.value)} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold transition ${brief === item.value ? "bg-[#f6dfca] text-[#8e4e39]" : "bg-[#fff8f1] text-[#967864] hover:bg-[#f8eadc]"}`}>{item.label}</button>)}</div></> : <><label className="sr-only">Keywords or a focused phrase</label><Input value={keywords} onChange={event => setKeywords(event.target.value)} className="h-28 border-0 bg-transparent px-3 text-sm shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="automation specialist, n8n setup, product tester…" /></>}<div className="flex items-center justify-between gap-3 border-t border-[#f1e3d7] px-2 pt-2"><span className="hidden text-[10px] font-medium text-[#a48a78] sm:inline">No outreach. No offers. Just real requests.</span><Button type="submit" disabled={!ready || pending} className="ml-auto h-10 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] hover:bg-[#9f4d36]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching</> : <><Send className="mr-2 h-3.5 w-3.5" />Run Faro</>}</Button></div></div></form></div>
        <SearchVisualPanel mode={mode} pending={pending} />
      </div>
    </section>
    {phase !== "idle" ? <SearchState phase={phase} state={state} result={result} errorDetail={runError} onOpen={() => setLocation("/")} /> : <SearchIdleHint />}
    {result && (phase === "complete" || phase === "empty") ? <SearchResults items={qualifiedResults} loading={overview.isFetching} persisted={result.retrieval?.persisted ?? 0} onOpenFeed={() => setLocation("/")} /> : null}
  </div>;
}

function SignalArtwork() { return <><div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#ecc09f]/35 blur-3xl" /><div className="pointer-events-none absolute bottom-[-180px] left-[30%] h-72 w-72 rounded-full bg-[#ebd3b9]/45 blur-3xl" /></>; }

function SearchVisualPanel({ mode, pending }: { mode: "agent" | "keyword"; pending: boolean }) { return <aside className="relative min-h-56 overflow-hidden rounded-[28px] border border-white/80 bg-[#422c20] p-5 text-white shadow-[0_16px_34px_rgba(73,40,25,0.16)]"><div className="pointer-events-none absolute -right-16 -top-14 h-48 w-48 rounded-full border-[18px] border-[#f0b98e]/25" /><div className="pointer-events-none absolute bottom-[-46px] left-[-40px] h-36 w-36 rounded-full border border-[#e9bb96]/30" /><div className="relative flex h-full flex-col justify-between"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 text-[#ffd0ad]"><Bot className="h-4 w-4" /></span><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-extrabold text-[#f6c9a7]">{mode === "agent" ? "AI brief" : "Focused terms"}</span></div><div><div className="flex h-20 items-end gap-1.5"><span className={`w-2 rounded-full bg-[#f5be97] transition-all duration-500 ${pending ? "h-16 animate-pulse" : "h-7"}`} /><span className={`w-2 rounded-full bg-[#e68a63] transition-all duration-500 ${pending ? "h-10 animate-pulse" : "h-14"}`} /><span className={`w-2 rounded-full bg-[#ffd4b4] transition-all duration-500 ${pending ? "h-20 animate-pulse" : "h-10"}`} /><span className={`w-2 rounded-full bg-[#c96b4e] transition-all duration-500 ${pending ? "h-12 animate-pulse" : "h-16"}`} /></div><p className="mt-4 text-lg font-extrabold tracking-[-0.05em]">One prompt.<br />Buyer-side signals.</p><p className="mt-2 max-w-[220px] text-[11px] leading-5 text-white/60">Faro turns intent into a focused public X discovery run.</p></div></div></aside>; }

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Sparkles; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-extrabold transition ${active ? "bg-[#f8eadc] text-[#914f39]" : "text-[#a18270] hover:bg-[#fff8f1]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }

function SearchIdleHint() { return <div className="mx-auto mt-5 flex max-w-3xl items-center justify-center gap-2 text-center text-[10px] font-semibold text-[#a18673]"><SearchIcon className="h-3.5 w-3.5 text-[#bd7255]" />Use a brief for intent, or a keyword for precision.</div>; }

function SearchState({ phase, state, result, errorDetail, onOpen }: { phase: SearchLifecycle; state: ReturnType<typeof getSearchLifecycleDetails>; result: SearchResult | null; errorDetail: string | null; onOpen: () => void }) {
  const alert = phase === "attention";
  const done = phase === "complete" || phase === "empty" || alert;
  const metrics = result?.retrieval;
  const detail = alert ? errorDetail || result?.syncError || state.detail : metrics ? metrics.buyerCandidates ? `${metrics.persisted} qualified request${metrics.persisted === 1 ? "" : "s"} saved.` : "No concrete buyer request saved this time." : state.detail;
  return <section className={`mx-auto mt-6 max-w-4xl overflow-hidden rounded-[26px] border p-4 sm:p-5 ${alert ? "border-[#edcaba] bg-[#fff4ed]" : done ? "border-[#cae4d1] bg-[#f7fcf7]" : "border-[#ead9c4] bg-white"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${alert ? "bg-[#f8ded2] text-[#a55136]" : done ? "bg-[#e1f0e4] text-[#397657]" : "bg-[#f7e3d1] text-[#9b593f]"}`}>{alert ? <Radar className="h-3.5 w-3.5" /> : done ? <BadgeCheck className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}</span><div><p className={`text-xs font-extrabold ${alert ? "text-[#a55136]" : done ? "text-[#397657]" : "text-[#704635]"}`}>{state.label}</p><p className="mt-1 text-[11px] leading-5 text-[#987c69]">{detail}</p></div></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full transition-all duration-700 ${alert ? "bg-[#c46b4d]" : done ? "bg-[#5a9a70]" : "bg-[#b85f45]"}`} style={{ width: `${state.progress}%` }} /></div>{metrics && done && !alert ? <div className="mt-4 flex flex-wrap gap-2"><Metric label="Pages" value={`${metrics.pagesChecked}/${metrics.pageBudget}`} /><Metric label="Queries" value={`${metrics.queryFamilies}/${metrics.queryFamilyBudget}`} /><Metric label="Saved" value={String(metrics.persisted)} /></div> : null}{done && !alert ? <Button onClick={onOpen} variant="outline" className="mt-4 h-9 rounded-xl border-[#cce1d1] bg-white text-xs font-bold text-[#40745a] hover:bg-[#fafffa]">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}</section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#eadfd2] bg-white px-3 py-2"><p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#a78a76]">{label}</p><p className="mt-0.5 text-xs font-extrabold text-[#604132]">{value}</p></div>; }

function SearchResults({ items, loading, persisted, onOpenFeed }: { items: any[]; loading: boolean; persisted: number; onOpenFeed: () => void }) { return <section className="mt-8 border-t border-[#eadfd2] pt-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">Faro found</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[#4b3123]">Qualified requests</h2></div><button onClick={onOpenFeed} className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#9a523b] hover:text-[#713c2b]">Feed <ArrowRight className="h-3 w-3" /></button></div>{loading ? <div className="mt-4 grid min-h-28 place-items-center rounded-[22px] border border-[#ead9c4] bg-white"><Loader2 className="h-4 w-4 animate-spin text-[#b56a4e]" /></div> : items.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.slice(0, 10).map(item => <SearchResultCard key={item.post.id} item={item} />)}</div> : <div className="mt-4 rounded-[22px] border border-dashed border-[#ead9c4] bg-[#fffdfa] p-5 text-[11px] text-[#92735f]">{persisted ? `${persisted} saved post${persisted === 1 ? "" : "s"} still needs final review.` : "No qualified requests saved this time."}</div>}</section>; }

function SearchResultCard({ item }: { item: any }) { const { post } = item; const author = post.authorName || post.authorHandle || "Public X account"; const category = getRequestCategory(post); const handle = post.authorHandle ? `@${String(post.authorHandle).replace(/^@/, "")}` : "X member"; const initial = author.charAt(0).toUpperCase(); return <article className="overflow-hidden rounded-[22px] border border-[#ead9c4] bg-white shadow-[0_10px_22px_rgba(99,59,31,0.045)]"><div className="p-4"><div className="flex items-start gap-3"><Avatar className="h-10 w-10 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-xs font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate text-xs font-extrabold text-[#4b3123]">{author}</p><span className="text-[10px] text-[#9b735c]">{handle}</span><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e7f3e9] px-2 py-1 text-[9px] font-extrabold text-[#3f7757]"><BadgeCheck className="h-3 w-3" />Qualified</span></div><div className="mt-1.5 flex items-center gap-2"><span className="rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]">{category}</span><span className="text-[9px] font-bold text-[#a48a79]">{post.ruleScore} signal</span></div></div></div><p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5 text-[#604536]">{post.body}</p></div><div className="flex items-center justify-between gap-3 border-t border-[#f0e6de] bg-[#fffdfa] px-4 py-2.5"><span className="truncate text-[9px] font-semibold text-[#a18b7a]">{getMatchReason(post)}</span><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-[#98513a] hover:text-[#713c2b]">Open X <ExternalLink className="h-3 w-3" /></a></div></article>; }
