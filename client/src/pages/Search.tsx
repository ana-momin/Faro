import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getQualifiedPosts } from "@/lib/discoverFeed";
import { getSearchLifecycleDetails, type SearchLifecycle } from "@/lib/discoverSearch";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, ChevronDown, Clapperboard, Code2, FlaskConical, KeyRound, Loader2, Megaphone, Radar, Send, WandSparkles, Workflow, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { PostDetailDialog, RequestCard } from "./Home";

const suggestions: Array<{ label: string; value: string; Icon: LucideIcon }> = [
  { label: "AI agents", value: "Find founders and teams looking for a provider to build or implement AI agents.", Icon: Bot },
  { label: "Automation", value: "Find operators who need someone to automate repetitive business workflows.", Icon: Workflow },
  { label: "AI video", value: "Find businesses seeking help with practical AI video production or video automation.", Icon: Clapperboard },
  { label: "Product testing", value: "Find product teams looking for an outside specialist to test and validate an AI-enabled feature before launch.", Icon: FlaskConical },
  { label: "Dev build", value: "Find teams looking for a contract developer to build or integrate an AI-enabled product workflow.", Icon: Code2 },
  { label: "Content", value: "Find businesses seeking someone to create, publish, or automate practical AI-powered social content.", Icon: Megaphone },
];
const firstBatchBrief = "Find founders, operators, and teams actively asking for help with AI agents, workflow automation, or practical AI implementation.";

type RetrievalMetrics = { sourceCalls: number; plannedPageRequests: number; queryFamilies: number; queryFamilyBudget: number; pagesChecked: number; pageBudget: number; rawReceived: number; deduplicatedPosts: number; buyerCandidates: number; persisted: number; queueWaitMs: number };
type SearchResult = { monitorId: number; inserted: number; sourceStatus: string; syncError?: string | null; retrieval?: RetrievalMetrics };
type ResultSet = { monitorId: number; monitorName: string; goal: string; items: any[]; persisted: number; fromHistory: boolean };

export default function Search() {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const [mode, setMode] = useState<"agent" | "keyword">("agent");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [phase, setPhase] = useState<SearchLifecycle>("idle");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [historyMonitorId, setHistoryMonitorId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const overview = trpc.monitoring.overview.useQuery(undefined, { staleTime: 5_000 });
  const firstBatch = new URLSearchParams(location.split("?")[1] ?? "").get("firstBatch") === "1";
  const historyFromLocation = Number(new URLSearchParams(location.split("?")[1] ?? "").get("history"));
  const review = trpc.monitoring.review.useMutation({
    onMutate: () => { toast.success("Thanks for the feedback.", { position: "bottom-right", duration: 1500 }); },
    onSuccess: () => { void utils.monitoring.overview.invalidate(); },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });
  const save = trpc.monitoring.save.useMutation({
    onMutate: input => {
      const previous = selectedItem;
      if (input.saved) setSelectedItem((current: any) => current ? { ...current, savedAt: new Date().toISOString() } : current);
      return { previous };
    },
    onSuccess: result => { void utils.monitoring.overview.invalidate(); toast.success(result.saved ? "Saved to Profile." : "Removed from saved posts.", { position: "bottom-right", duration: 1500 }); },
    onError: (error, _input, context) => { setSelectedItem(context?.previous ?? null); toast.error(error.message, { position: "bottom-right" }); },
  });
  const removeFromFeed = trpc.monitoring.removeFromFeed.useMutation({
    onSuccess: async () => {
      setSelectedItem(null);
      await utils.monitoring.overview.invalidate();
      await utils.monitoring.saved.invalidate();
      toast.success("Removed from Feed.", { position: "bottom-right", duration: 1500 });
    },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });

  useEffect(() => {
    if (!firstBatch) return;
    setMode("agent");
    setBrief(current => current.trim() ? current : firstBatchBrief);
  }, [firstBatch]);
  useEffect(() => {
    if (!Number.isInteger(historyFromLocation) || historyFromLocation < 1) return;
    setHistoryMonitorId(historyFromLocation);
    setResult(null);
    setRunError(null);
    setPhase("idle");
  }, [historyFromLocation]);

  const finish = async (data: { monitorId: number; sync?: { inserted: number; retrieval?: RetrievalMetrics } | null; sourceStatus: string; syncError?: string | null }) => {
    const retrieval = data.sync?.retrieval;
    const sourceIssue = Boolean(data.syncError) || Boolean(retrieval?.buyerCandidates && !retrieval.persisted);
    await utils.monitoring.overview.invalidate();
    await overview.refetch();
    setHistoryMonitorId(null);
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
    setHistoryMonitorId(null);
    setRunError(null);
    setElapsedSeconds(0);
    setPhase("brief");
    if (historyMonitorId) setLocation("/search");
    if (mode === "agent") agent.mutate({ brief });
    else keyword.mutate({ keywords });
  };
  const chooseTask = (value: string) => { setMode("agent"); setBrief(value); setPhase("idle"); setResult(null); setHistoryMonitorId(null); };
  const state = getSearchLifecycleDetails(phase, elapsedSeconds);
  const ready = mode === "agent" ? brief.trim().length >= 12 : keywords.trim().length >= 2;
  const resultSet = useMemo<ResultSet | null>(() => {
    const monitorId = result?.monitorId ?? historyMonitorId;
    if (!monitorId) return null;
    const row = overview.data?.monitors.find(item => item.monitor.id === monitorId);
    const items = getQualifiedPosts(overview.data?.posts ?? [], monitorId, false);
    return { monitorId, monitorName: row?.monitor.name ?? "Saved search", goal: row?.monitor.goal ?? "", items, persisted: result?.retrieval?.persisted ?? items.length, fromHistory: !result && Boolean(historyMonitorId) };
  }, [historyMonitorId, overview.data?.monitors, overview.data?.posts, result]);
  const showResultSet = Boolean(resultSet && ((result && (phase === "complete" || phase === "empty")) || historyMonitorId));
  return <div className="mx-auto w-full max-w-[1040px] pb-12">
    <header className="flex items-center justify-between border-b border-[#eadfd2] pb-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a25d47]">Faro AI</p><h1 className="mt-0.5 text-lg font-extrabold tracking-[-0.05em] text-[#3d2e23]">Search</h1></div><span className="rounded-full border border-[#ead9c4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#94624a]">Buyer-side only</span></header>
    <section className="mx-auto flex min-h-[470px] max-w-4xl flex-col items-center justify-center px-1 py-12 text-center sm:py-16"><h2 className="text-3xl font-extrabold tracking-[-0.07em] text-[#3f2b20] sm:text-4xl">{firstBatch ? "Run your first bounded batch." : "What would you like to find?"}</h2><p className="mt-3 max-w-md text-sm leading-6 text-[#907564]">{firstBatch ? "Your provider is connected. Review the starter brief, then explicitly run one source request to collect qualified buyer posts." : "Describe a buyer need or use a ready-made prompt."}</p>
      <form id="search-command" onSubmit={submit} className="mt-8 w-full text-left"><div className="overflow-hidden rounded-[14px] border border-[#d9c4af] bg-white shadow-[0_18px_42px_rgba(94,53,30,0.11)]"><div className="flex items-center gap-2 border-b border-[#f1e3d7] px-3 py-2"><ModeButton active={mode === "agent"} icon={WandSparkles} label="Ask Faro" onClick={() => { setMode("agent"); setPhase("idle"); setResult(null); setHistoryMonitorId(null); }} /><ModeButton active={mode === "keyword"} icon={KeyRound} label="Keyword search" onClick={() => { setMode("keyword"); setPhase("idle"); setResult(null); setHistoryMonitorId(null); }} /></div>{pending ? <CommandProgress state={state} /> : mode === "agent" ? <><label className="sr-only">Describe the buyer request Faro should find</label><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-32 resize-none border-0 bg-transparent px-4 py-4 text-sm leading-6 shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="Find people looking for help with…" /></> : <><label className="sr-only">Keywords or a focused phrase</label><Input value={keywords} onChange={event => setKeywords(event.target.value)} className="h-32 border-0 bg-transparent px-4 text-sm shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="automation specialist, n8n setup, product tester…" /></>}<div className="flex items-center justify-between border-t border-[#f1e3d7] px-3 py-2"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#eadfd2] bg-[#fffaf5] px-2.5 text-[10px] font-extrabold text-[#8f604a] transition hover:bg-[#fff0e3]">Suggestions <ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger><DropdownMenuContent side="bottom" sideOffset={8} align="start" avoidCollisions={false} className="max-h-72 w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-xl border-[#ead9c4] bg-[#fffdfa] p-1.5 shadow-[0_16px_35px_rgba(94,53,30,0.14)]">{suggestions.map(item => <DropdownMenuItem key={item.label} onSelect={() => chooseTask(item.value)} className="cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2.5 text-[#674633] focus:bg-[#fff0e3] focus:text-[#674633]"><item.Icon className="mt-0.5 h-3.5 w-3.5 text-[#b56649]" /><span><span className="block text-[10px] font-extrabold">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#9a7b68]">{item.value}</span></span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><Button type="submit" disabled={!ready || pending} className="h-10 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] hover:bg-[#9f4d36]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching</> : <><Send className="mr-2 h-3.5 w-3.5" />{firstBatch ? "Run first batch" : "Run Faro"}</>}</Button></div></div></form>
    </section>
    {phase !== "idle" && !pending ? <SearchState phase={phase} state={state} result={result} errorDetail={runError} onOpen={() => setLocation("/")} /> : null}
    {showResultSet && resultSet ? <SearchResults resultSet={resultSet} loading={overview.isFetching} onOpenFeed={() => setLocation("/")} onOpen={setSelectedItem} /> : null}
    <PostDetailDialog item={selectedItem} open={Boolean(selectedItem)} pending={review.isPending || save.isPending || removeFromFeed.isPending} onOpenChange={open => { if (!open) setSelectedItem(null); }} onReview={decision => selectedItem && review.mutate({ postId: selectedItem.post.id, decision })} onSave={() => selectedItem && save.mutate({ postId: selectedItem.post.id, saved: true })} onRemove={() => { if (selectedItem && window.confirm("Remove this stored post from your Feed? It will stay hidden from your future stored result views.")) removeFromFeed.mutate({ postId: selectedItem.post.id }); }} />
  </div>;
}

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-extrabold transition ${active ? "bg-[#f8eadc] text-[#914f39]" : "text-[#a18270] hover:bg-[#fff8f1]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
function CommandProgress({ state }: { state: ReturnType<typeof getSearchLifecycleDetails> }) { return <div className="px-4 py-5"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#b85f45]" /><span className="truncate text-sm font-extrabold text-[#694432]">{state.label}</span></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><p className="mt-2 text-[11px] leading-5 text-[#967a68]">{state.detail}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className="h-full rounded-full bg-[#b85f45] transition-all duration-700" style={{ width: `${state.progress}%` }} /></div></div>; }

function SearchState({ phase, state, result, errorDetail, onOpen }: { phase: SearchLifecycle; state: ReturnType<typeof getSearchLifecycleDetails>; result: SearchResult | null; errorDetail: string | null; onOpen: () => void }) { const alert = phase === "attention"; const done = phase === "complete" || phase === "empty" || alert; const metrics = result?.retrieval; const detail = alert ? errorDetail || result?.syncError || state.detail : metrics ? metrics.buyerCandidates ? `${metrics.persisted} qualified request${metrics.persisted === 1 ? "" : "s"} saved.` : "No concrete buyer request saved this time." : state.detail; return <section className={`mx-auto mt-2 max-w-4xl overflow-hidden rounded-[22px] border p-4 sm:p-5 ${alert ? "border-[#edcaba] bg-[#fff4ed]" : done ? "border-[#cae4d1] bg-[#f7fcf7]" : "border-[#ead9c4] bg-white"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${alert ? "bg-[#f8ded2] text-[#a55136]" : done ? "bg-[#e1f0e4] text-[#397657]" : "bg-[#f7e3d1] text-[#9b593f]"}`}>{alert ? <Radar className="h-3.5 w-3.5" /> : done ? <BadgeCheck className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}</span><div><p className={`text-xs font-extrabold ${alert ? "text-[#a55136]" : done ? "text-[#397657]" : "text-[#704635]"}`}>{state.label}</p><p className="mt-1 text-[11px] leading-5 text-[#987c69]">{detail}</p></div></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full transition-all duration-700 ${alert ? "bg-[#c46b4d]" : done ? "bg-[#5a9a70]" : "bg-[#b85f45]"}`} style={{ width: `${state.progress}%` }} /></div>{metrics && done && !alert ? <div className="mt-4 flex flex-wrap gap-2"><Metric label="Pages" value={`${metrics.pagesChecked}/${metrics.pageBudget}`} /><Metric label="Queries" value={`${metrics.queryFamilies}/${metrics.queryFamilyBudget}`} /><Metric label="Saved" value={String(metrics.persisted)} /></div> : null}{done && !alert ? <Button onClick={onOpen} variant="outline" className="mt-4 h-9 rounded-xl border-[#cce1d1] bg-white text-xs font-bold text-[#40745a] hover:bg-[#fafffa]">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#eadfd2] bg-white px-3 py-2"><p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#a78a76]">{label}</p><p className="mt-0.5 text-xs font-extrabold text-[#604132]">{value}</p></div>; }

function SearchResults({ resultSet, loading, onOpenFeed, onOpen }: { resultSet: ResultSet; loading: boolean; onOpenFeed: () => void; onOpen: (item: any) => void }) { const support = resultSet.fromHistory ? `Reopened saved results from ${resultSet.monitorName}. Reopening stored results never uses a provider request.` : "This result set is saved and can be reopened from Search history without another provider request."; return <section id="search-results" className="mt-8 border-t border-[#eadfd2] pt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">{resultSet.fromHistory ? "Saved result set" : "Faro found"}</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[#4b3123]">Top qualified requests</h2><p className="mt-1 max-w-xl text-[10px] font-medium leading-5 text-[#9a7b68]">{support}</p></div><button onClick={onOpenFeed} className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#9a523b] hover:text-[#713c2b]">View all in Feed <ArrowRight className="h-3 w-3" /></button></div>{loading ? <div className="mt-4 grid min-h-28 place-items-center rounded-[22px] border border-[#ead9c4] bg-white"><Loader2 className="h-4 w-4 animate-spin text-[#b56a4e]" /></div> : resultSet.items.length ? <div className="mt-4 space-y-4">{resultSet.items.map(item => <RequestCard key={item.post.id} item={item} onOpen={() => onOpen(item)} />)}</div> : <div className="mt-4 rounded-[22px] border border-dashed border-[#ead9c4] bg-[#fffdfa] p-5 text-[11px] text-[#92735f]">{resultSet.persisted ? `${resultSet.persisted} saved post${resultSet.persisted === 1 ? "" : "s"} still needs final review.` : "No qualified requests were saved for this search."}</div>}</section>; }
