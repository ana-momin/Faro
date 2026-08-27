import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { filterFeedByTime, getQualifiedPosts, type FeedTimeFilter } from "@/lib/discoverFeed";
import { getSearchLifecycleDetails, type SearchLifecycle } from "@/lib/discoverSearch";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, ChevronDown, Clapperboard, Code2, FlaskConical, Loader2, Megaphone, Radar, Send, WandSparkles, Workflow, type LucideIcon } from "lucide-react";
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
type SearchResult = { monitorId: number; inserted: number; sourceStatus: string; syncError?: string | null; retrieval?: RetrievalMetrics; hasMore?: boolean; reused?: boolean };
type ResultSet = { monitorId: number; monitorName: string; goal: string; items: any[]; persisted: number; fromHistory: boolean; timeFilter: FeedTimeFilter };

export default function Search() {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState<SearchLifecycle>("idle");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [historyMonitorId, setHistoryMonitorId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timeFilter, setTimeFilter] = useState<FeedTimeFilter>("all");
  const overview = trpc.monitoring.overview.useQuery(undefined, { staleTime: 5_000 });
  const providerSetup = trpc.monitoring.providerSetup.useQuery(undefined, { staleTime: 5_000 });
  const activeResultMonitorId = result?.monitorId ?? historyMonitorId;
  const continuation = trpc.monitoring.continuation.useQuery({ monitorId: activeResultMonitorId ?? 0 }, { enabled: Boolean(activeResultMonitorId), staleTime: 5_000 });
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
    setBrief(current => current.trim() ? current : firstBatchBrief);
  }, [firstBatch]);
  useEffect(() => {
    if (!Number.isInteger(historyFromLocation) || historyFromLocation < 1) return;
    setHistoryMonitorId(historyFromLocation);
    setResult(null);
    setRunError(null);
    setPhase("idle");
  }, [historyFromLocation]);

  const finish = async (data: { monitorId: number; sync?: { inserted: number; retrieval?: RetrievalMetrics; hasMore?: boolean } | null; sourceStatus: string; syncError?: string | null; reused?: boolean }) => {
    const retrieval = data.sync?.retrieval;
    const sourceIssue = Boolean(data.syncError) || Boolean(retrieval?.buyerCandidates && !retrieval.persisted);
    await utils.monitoring.overview.invalidate();
    await utils.monitoring.providerSetup.invalidate();
    await overview.refetch();
    await providerSetup.refetch();
    setHistoryMonitorId(null);
    setResult({ monitorId: data.monitorId, inserted: data.sync?.inserted ?? 0, sourceStatus: data.sourceStatus, syncError: data.syncError ?? (sourceIssue ? "Faro found buyer candidates but could not save them. Please run the search again." : null), retrieval, hasMore: data.sync?.hasMore, reused: data.reused });
    setPhase(sourceIssue ? "attention" : data.reused || retrieval?.persisted ? "complete" : "empty");
  };

  const agent = trpc.monitoring.agentStart.useMutation({ onSuccess: finish, onError: error => { setRunError(error.message); setPhase("attention"); toast.error(error.message); } });
  const continueSearch = trpc.monitoring.continueSearch.useMutation({
    onSuccess: async data => {
      await utils.monitoring.overview.invalidate();
      await utils.monitoring.providerSetup.invalidate();
      await utils.monitoring.continuation.invalidate({ monitorId: data.monitorId });
      await overview.refetch();
      await providerSetup.refetch();
      setHistoryMonitorId(data.monitorId);
      setResult(current => ({ monitorId: data.monitorId, inserted: (current?.inserted ?? 0) + data.inserted, sourceStatus: "healthy", retrieval: data.retrieval, hasMore: data.hasMore }));
      toast.success(data.inserted ? `${data.inserted} new qualified post${data.inserted === 1 ? "" : "s"} added from the next source page.` : "The next source page was checked; no additional qualified posts matched.");
    },
    onError: error => toast.error(error.message),
  });
  const pending = agent.isPending;

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
    if (providerSetup.data?.configured && providerSetup.data.remainingCalls <= 0) {
      const message = `Today’s provider limit of ${providerSetup.data.dailyRequestLimit} source call${providerSetup.data.dailyRequestLimit === 1 ? "" : "s"} has been reached. Increase the limit in Settings → Provider or try again tomorrow.`;
      setRunError(message);
      setPhase("attention");
      toast.error(message);
      return;
    }
    setResult(null);
    setHistoryMonitorId(null);
    setRunError(null);
    setElapsedSeconds(0);
    setPhase("brief");
    if (historyMonitorId) setLocation("/search");
    agent.mutate({ brief });
  };
  const chooseTask = (value: string) => { setBrief(value); setPhase("idle"); setResult(null); setHistoryMonitorId(null); };
  const state = getSearchLifecycleDetails(phase, elapsedSeconds);
  const ready = brief.trim().length >= 12;
  const budgetExhausted = Boolean(providerSetup.data?.configured && providerSetup.data.remainingCalls <= 0);
  const resultSet = useMemo<ResultSet | null>(() => {
    const monitorId = activeResultMonitorId;
    if (!monitorId) return null;
    const row = overview.data?.monitors.find(item => item.monitor.id === monitorId);
    const qualifiedItems = getQualifiedPosts(overview.data?.posts ?? [], monitorId, false);
    const items = filterFeedByTime(qualifiedItems, timeFilter);
    return { monitorId, monitorName: row?.monitor.name ?? "Saved search", goal: row?.monitor.goal ?? "", items, persisted: result?.retrieval?.persisted ?? qualifiedItems.length, fromHistory: !result && Boolean(historyMonitorId), timeFilter };
  }, [activeResultMonitorId, historyMonitorId, overview.data?.monitors, overview.data?.posts, result, timeFilter]);
  const showResultSet = Boolean(resultSet && ((result && (phase === "complete" || phase === "empty")) || historyMonitorId));
  return <div className="mx-auto w-full max-w-[1040px] pb-12">
    <header className="flex items-center justify-between border-b border-[#eadfd2] pb-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a25d47]">Faro AI</p><h1 className="mt-0.5 text-lg font-extrabold tracking-[-0.05em] text-[#3d2e23]">Search</h1></div><span className="rounded-full border border-[#ead9c4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#94624a]">Buyer-side only</span></header>
    <section className="mx-auto flex min-h-[470px] max-w-4xl flex-col items-center justify-center px-1 py-12 text-center sm:py-16"><h2 className="text-3xl font-extrabold tracking-[-0.07em] text-[#3f2b20] sm:text-4xl">{firstBatch ? "Run your first bounded batch." : "What would you like to find?"}</h2><p className="mt-3 max-w-md text-sm leading-6 text-[#907564]">{firstBatch ? "Your provider is connected. Review the starter brief, then explicitly run a bounded fresh batch to collect qualified buyer posts." : "Describe a buyer need or use a ready-made prompt."}</p>
      <form id="search-command" onSubmit={submit} className="mt-8 w-full text-left"><div className="overflow-hidden rounded-[14px] border border-[#d9c4af] bg-white shadow-[0_18px_42px_rgba(94,53,30,0.11)]">{pending ? <CommandProgress state={state} /> : <><label className="sr-only">Describe the buyer request Faro should find</label><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-32 resize-none border-0 bg-transparent px-4 py-4 text-sm leading-6 shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="Find people looking for help with…" /></>}<div className="flex items-center justify-between border-t border-[#f1e3d7] px-3 py-2"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#eadfd2] bg-[#fffaf5] px-2.5 text-[10px] font-extrabold text-[#8f604a] transition hover:bg-[#fff0e3]">Suggestions <ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger><DropdownMenuContent side="bottom" sideOffset={8} align="start" avoidCollisions={false} className="max-h-72 w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-xl border-[#ead9c4] bg-[#fffdfa] p-1.5 shadow-[0_16px_35px_rgba(94,53,30,0.14)]">{suggestions.map(item => <DropdownMenuItem key={item.label} onSelect={() => chooseTask(item.value)} className="cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2.5 text-[#674633] focus:bg-[#fff0e3] focus:text-[#674633]"><item.Icon className="mt-0.5 h-3.5 w-3.5 text-[#b56649]" /><span><span className="block text-[10px] font-extrabold">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#9a7b68]">{item.value}</span></span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><Button type="submit" disabled={!ready || pending} className="h-10 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] hover:bg-[#9f4d36]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching</> : <><Send className="mr-2 h-3.5 w-3.5" />{firstBatch ? "Run first batch" : "Run Faro"}</>}</Button></div></div></form>
    </section>
    {budgetExhausted ? <div className="mx-auto -mt-8 max-w-4xl rounded-2xl border border-[#edcaba] bg-[#fff4ed] px-4 py-3 text-left text-[11px] leading-5 text-[#96553e]">Today’s configured provider-call limit is reached. Faro will not start another source search until you increase it in <button type="button" onClick={() => setLocation("/settings?section=provider")} className="font-extrabold underline underline-offset-2">Settings → Provider</button> or the daily window resets.</div> : null}
    {phase !== "idle" && !pending ? <SearchState phase={phase} state={state} result={result} errorDetail={runError} onOpen={() => setLocation("/")} /> : null}
    <section className="mt-8 grid gap-6 border-t border-[#eadfd2] pt-6 lg:grid-cols-[240px_minmax(0,1fr)]"><SearchHistory rows={overview.data?.monitors ?? []} selectedMonitorId={activeResultMonitorId} onOpen={monitorId => { setHistoryMonitorId(monitorId); setResult(null); setRunError(null); setPhase("idle"); }} /><div>{showResultSet && resultSet ? <SearchResultsWithPaging key={resultSet.monitorId} resultSet={resultSet} loading={overview.isFetching} canContinue={Boolean(continuation.data?.available) && !budgetExhausted} budgetExhausted={budgetExhausted} loadingMore={continueSearch.isPending} onContinue={() => continueSearch.mutate({ monitorId: resultSet.monitorId })} onTimeFilterChange={setTimeFilter} onOpenFeed={() => setLocation("/")} onOpen={setSelectedItem} /> : <div className="grid min-h-48 place-items-center rounded-[24px] border border-dashed border-[#ead9c4] bg-[#fffdfa] px-6 text-center text-[11px] leading-5 text-[#9a7c68]">Run a new search or select a saved search to reopen its qualified results.</div>}</div></section>
    <PostDetailDialog item={selectedItem} open={Boolean(selectedItem)} pending={review.isPending || save.isPending || removeFromFeed.isPending} onOpenChange={open => { if (!open) setSelectedItem(null); }} onReview={decision => selectedItem && review.mutate({ postId: selectedItem.post.id, decision })} onSave={() => selectedItem && save.mutate({ postId: selectedItem.post.id, saved: true })} onRemove={() => { if (selectedItem && window.confirm("Remove this stored post from your Feed? It will stay hidden from your future stored result views.")) removeFromFeed.mutate({ postId: selectedItem.post.id }); }} />
  </div>;
}

function CommandProgress({ state }: { state: ReturnType<typeof getSearchLifecycleDetails> }) { return <div className="px-4 py-5"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#b85f45]" /><span className="truncate text-sm font-extrabold text-[#694432]">{state.label}</span></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><p className="mt-2 text-[11px] leading-5 text-[#967a68]">{state.detail}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className="h-full rounded-full bg-[#b85f45] transition-all duration-700" style={{ width: `${state.progress}%` }} /></div></div>; }

function SearchState({ phase, state, result, errorDetail, onOpen }: { phase: SearchLifecycle; state: ReturnType<typeof getSearchLifecycleDetails>; result: SearchResult | null; errorDetail: string | null; onOpen: () => void }) { const alert = phase === "attention"; const done = phase === "complete" || phase === "empty" || alert; const metrics = result?.retrieval; const detail = alert ? errorDetail || result?.syncError || state.detail : result?.reused ? "This saved brief is already open below. Its existing qualified results were reopened without another provider call." : metrics ? metrics.buyerCandidates ? `${metrics.persisted} qualified request${metrics.persisted === 1 ? "" : "s"} saved.` : "No concrete buyer request saved this time." : state.detail; return <section className={`mx-auto mt-2 max-w-4xl overflow-hidden rounded-[22px] border p-4 sm:p-5 ${alert ? "border-[#edcaba] bg-[#fff4ed]" : done ? "border-[#cae4d1] bg-[#f7fcf7]" : "border-[#ead9c4] bg-white"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${alert ? "bg-[#f8ded2] text-[#a55136]" : done ? "bg-[#e1f0e4] text-[#397657]" : "bg-[#f7e3d1] text-[#9b593f]"}`}>{alert ? <Radar className="h-3.5 w-3.5" /> : done ? <BadgeCheck className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}</span><div><p className={`text-xs font-extrabold ${alert ? "text-[#a55136]" : done ? "text-[#397657]" : "text-[#704635]"}`}>{state.label}</p><p className="mt-1 text-[11px] leading-5 text-[#987c69]">{detail}</p></div></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full transition-all duration-700 ${alert ? "bg-[#c46b4d]" : done ? "bg-[#5a9a70]" : "bg-[#b85f45]"}`} style={{ width: `${state.progress}%` }} /></div>{metrics && done && !alert ? <div className="mt-4 flex flex-wrap gap-2"><Metric label="Pages" value={`${metrics.pagesChecked}/${metrics.pageBudget}`} /><Metric label="Queries" value={`${metrics.queryFamilies}/${metrics.queryFamilyBudget}`} /><Metric label="Saved" value={String(metrics.persisted)} /></div> : null}{done && !alert ? <Button onClick={onOpen} variant="outline" className="mt-4 h-9 rounded-xl border-[#cce1d1] bg-white text-xs font-bold text-[#40745a] hover:bg-[#fafffa]">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#eadfd2] bg-white px-3 py-2"><p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#a78a76]">{label}</p><p className="mt-0.5 text-xs font-extrabold text-[#604132]">{value}</p></div>; }

function SearchHistory({ rows, selectedMonitorId, onOpen }: { rows: any[]; selectedMonitorId: number | null | undefined; onOpen: (monitorId: number) => void }) {
  return <aside className="self-start rounded-[24px] border border-[#eadfd2] bg-white p-2.5 shadow-[0_10px_24px_rgba(99,59,31,0.04)]"><div className="px-2.5 pb-2 pt-1"><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">Search history</p><p className="mt-1 text-[10px] leading-4 text-[#9a7c68]">Reopen a saved result set without another provider call.</p></div>{rows.length ? <div className="max-h-[420px] space-y-1 overflow-y-auto pr-0.5">{rows.map(({ monitor }) => { const selected = monitor.id === selectedMonitorId; return <button key={monitor.id} type="button" onClick={() => onOpen(monitor.id)} className={`w-full rounded-2xl px-3 py-2.5 text-left transition ${selected ? "bg-[#f8e8d9] text-[#874a35]" : "text-[#755e4e] hover:bg-[#fff8f1]"}`} aria-current={selected ? "page" : undefined}><span className="block line-clamp-2 text-[10px] font-extrabold leading-4">{monitor.goal}</span><span className="mt-1 block truncate text-[9px] text-[#a08370]">{monitor.name}</span></button>; })}</div> : <p className="px-2.5 py-6 text-center text-[10px] leading-5 text-[#9a7c68]">Your completed searches will appear here.</p>}</aside>;
}

function SearchResultsWithPaging({ resultSet, loading, canContinue, budgetExhausted, loadingMore, onContinue, onTimeFilterChange, onOpenFeed, onOpen }: { resultSet: ResultSet; loading: boolean; canContinue: boolean; budgetExhausted: boolean; loadingMore: boolean; onContinue: () => void; onTimeFilterChange: (filter: FeedTimeFilter) => void; onOpenFeed: () => void; onOpen: (item: any) => void }) {
  const [visibleCount, setVisibleCount] = useState(10);
  useEffect(() => setVisibleCount(10), [resultSet.monitorId, resultSet.timeFilter]);
  const visible = resultSet.items.slice(0, visibleCount);
  const hasSavedMore = visibleCount < resultSet.items.length;
  const support = resultSet.fromHistory ? `Reopened saved results from ${resultSet.monitorName}. Reopening stored results never uses a provider request.` : "This result set is saved and can be reopened from Search history without another provider request.";
  return <section id="search-results" className="mt-8 border-t border-[#eadfd2] pt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">{resultSet.fromHistory ? "Saved result set" : "Faro found"}</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[#4b3123]">Top 10 recent qualified requests</h2><p className="mt-1 max-w-xl text-[10px] font-medium leading-5 text-[#9a7b68]">{support}</p></div><div className="flex items-center gap-3"><SearchTimeFilter value={resultSet.timeFilter} onChange={onTimeFilterChange} /><button onClick={onOpenFeed} className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#9a523b] hover:text-[#713c2b]">View all in Feed <ArrowRight className="h-3 w-3" /></button></div></div>{loading ? <div className="mt-4 grid min-h-28 place-items-center rounded-[22px] border border-[#ead9c4] bg-white"><Loader2 className="h-4 w-4 animate-spin text-[#b56a4e]" /></div> : resultSet.items.length ? <div className="mt-4 space-y-4">{visible.map(item => <RequestCard key={item.post.id} item={item} onOpen={() => onOpen(item)} />)}</div> : <div className="mt-4 rounded-[22px] border border-dashed border-[#ead9c4] bg-[#fffdfa] p-5 text-[11px] text-[#92735f]">{resultSet.persisted ? "No qualified requests in this selected time range. Choose a wider range to review every saved match without another provider call." : "No qualified requests were saved for this search."}</div>}{hasSavedMore ? <button type="button" onClick={() => setVisibleCount(count => count + 10)} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-dashed border-[#e7d4c0] bg-[#fffaf5] px-4 py-3 text-left text-[10px] font-extrabold text-[#8b503a] transition hover:bg-[#fff4e8]"><span>Show 10 more <span className="ml-1 font-medium text-[#a98a76]">· this saved batch</span></span><ArrowRight className="h-3.5 w-3.5" /></button> : canContinue ? <button type="button" onClick={onContinue} disabled={loadingMore} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[#d7b18f] bg-[#fff5e9] px-4 py-3 text-left text-[10px] font-extrabold text-[#8b503a] transition hover:bg-[#ffeddb] disabled:cursor-not-allowed disabled:opacity-60"><span>{loadingMore ? "Checking the next source page…" : "Load more recent matches"}<span className="ml-1 font-medium text-[#a98a76]">· continues this search</span></span>{loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}</button> : budgetExhausted ? <p className="mt-4 rounded-2xl border border-[#f0c5be] bg-[#fff4f2] px-4 py-3 text-[10px] leading-5 text-[#a14a42]">Daily provider-call limit reached. Increase it in Settings → Provider to load the next source page.</p> : null}</section>;
}

function SearchTimeFilter({ value, onChange }: { value: FeedTimeFilter; onChange: (filter: FeedTimeFilter) => void }) {
  const filters: Array<{ value: FeedTimeFilter; label: string }> = [{ value: "all", label: "All saved" }, { value: "last_24_hours", label: "Last 24 hours" }, { value: "last_7_days", label: "Last 7 days" }, { value: "last_30_days", label: "Last 30 days" }];
  const label = filters.find(filter => filter.value === value)?.label ?? "All saved";
  return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#eadfd2] bg-white px-3 text-[10px] font-extrabold text-[#80503a] transition hover:bg-[#fffaf5]" aria-label="Filter saved search results by time">Time <span className="font-medium text-[#a18b7a]">· {label}</span><ChevronDown className="h-3.5 w-3.5 text-[#a27863]" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-36 rounded-xl border border-[#eadfd2] bg-[#fffdfa] p-1.5 shadow-[0_12px_30px_rgba(92,53,31,0.12)]">{filters.map(filter => <DropdownMenuItem key={filter.value} onSelect={() => onChange(filter.value)} className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-[#6d4a39] focus:bg-[#fff0e2] focus:text-[#6d4a39]">{filter.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
