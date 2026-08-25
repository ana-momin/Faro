import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMatchReason, getQualifiedPosts, getRequestCategory } from "@/lib/discoverFeed";
import { getSearchLifecycleDetails, type SearchLifecycle } from "@/lib/discoverSearch";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, Braces, Clapperboard, Code2, ExternalLink, FlaskConical, KeyRound, Loader2, Megaphone, Radar, Search as SearchIcon, Send, Sparkles, WandSparkles, Workflow, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const suggestions: Array<{ label: string; value: string; Icon: LucideIcon }> = [
  { label: "AI agents", value: "Find founders and teams looking for a provider to build or implement AI agents.", Icon: Bot },
  { label: "Automation", value: "Find operators who need someone to automate repetitive business workflows.", Icon: Workflow },
  { label: "AI video", value: "Find businesses seeking help with practical AI video production or video automation.", Icon: Clapperboard },
  { label: "Product testing", value: "Find product teams looking for an outside specialist to test and validate an AI-enabled feature before launch.", Icon: FlaskConical },
  { label: "Dev build", value: "Find teams looking for a contract developer to build or integrate an AI-enabled product workflow.", Icon: Code2 },
  { label: "Content", value: "Find businesses seeking someone to create, publish, or automate practical AI-powered social content.", Icon: Megaphone },
];

type RetrievalMetrics = { sourceCalls: number; plannedPageRequests: number; queryFamilies: number; queryFamilyBudget: number; pagesChecked: number; pageBudget: number; rawReceived: number; deduplicatedPosts: number; buyerCandidates: number; persisted: number; queueWaitMs: number };
type SearchResult = { monitorId: number; inserted: number; sourceStatus: string; syncError?: string | null; retrieval?: RetrievalMetrics };

export default function Search() {
  const { user } = useAuth();
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
  const greetingName = user?.name?.trim() || "there";

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

  const chooseTask = (value: string) => { setMode("agent"); setBrief(value); setPhase("idle"); setResult(null); };
  const state = getSearchLifecycleDetails(phase, elapsedSeconds);
  const ready = mode === "agent" ? brief.trim().length >= 12 : keywords.trim().length >= 2;
  const qualifiedResults = useMemo(() => result ? getQualifiedPosts(overview.data?.posts ?? [], result.monitorId, false) : [], [overview.data?.posts, result]);

  return <div className="mx-auto w-full max-w-[1040px] pb-12">
    <header className="flex items-center justify-between border-b border-[#eadfd2] pb-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a25d47]">Faro AI</p><h1 className="mt-0.5 text-lg font-extrabold tracking-[-0.05em] text-[#3d2e23]">Search</h1></div><span className="rounded-full border border-[#ead9c4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#94624a]">Buyer-side only</span></header>
    <section className="mx-auto flex min-h-[500px] max-w-4xl flex-col items-center justify-center px-1 py-12 text-center sm:py-16"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f4dfca] text-[#a15a41]"><Sparkles className="h-4 w-4" /></div><p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Morning, {greetingName}.</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-0.07em] text-[#3f2b20] sm:text-4xl">What would you like to find?</h2><p className="mt-3 max-w-md text-sm leading-6 text-[#907564]">Describe a buyer need, or choose a task to begin.</p>
      <form onSubmit={submit} className="mt-8 w-full text-left"><div className="overflow-hidden rounded-[18px] border border-[#d9c4af] bg-white shadow-[0_18px_42px_rgba(94,53,30,0.11)]"><div className="flex items-center gap-2 border-b border-[#f1e3d7] px-3 py-2"><ModeButton active={mode === "agent"} icon={WandSparkles} label="Ask Faro" onClick={() => { setMode("agent"); setPhase("idle"); setResult(null); }} /><ModeButton active={mode === "keyword"} icon={KeyRound} label="Keyword search" onClick={() => { setMode("keyword"); setPhase("idle"); setResult(null); }} /><span className="ml-auto hidden text-[10px] font-medium text-[#a78c78] sm:inline">No outreach</span></div>{mode === "agent" ? <><label className="sr-only">Describe the buyer request Faro should find</label><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-28 resize-none border-0 bg-transparent px-4 py-4 text-sm leading-6 shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="Find people looking for help with…" /><div className="flex flex-wrap items-center gap-1.5 border-t border-[#f1e3d7] px-3 py-2.5">{suggestions.map(item => <TaskIcon key={item.label} label={item.label} Icon={item.Icon} active={brief === item.value} onClick={() => chooseTask(item.value)} />)}<span className="ml-auto hidden text-[10px] font-medium text-[#a78c78] md:inline">Choose a task</span></div></> : <><label className="sr-only">Keywords or a focused phrase</label><Input value={keywords} onChange={event => setKeywords(event.target.value)} className="h-28 border-0 bg-transparent px-4 text-sm shadow-none placeholder:text-[#b39a88] focus-visible:ring-0" placeholder="automation specialist, n8n setup, product tester…" /><div className="flex items-center gap-2 border-t border-[#f1e3d7] px-3 py-2.5"><SearchIcon className="h-3.5 w-3.5 text-[#b77052]" /><span className="text-[10px] font-medium text-[#a78c78]">Focused keyword search</span></div></>}<div className="flex items-center justify-end border-t border-[#f1e3d7] px-3 py-2"><Button type="submit" disabled={!ready || pending} className="h-10 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] hover:bg-[#9f4d36]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching</> : <><Send className="mr-2 h-3.5 w-3.5" />Run Faro</>}</Button></div></div></form>
      <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold text-[#a18673]"><Radar className="h-3.5 w-3.5 text-[#bd7255]" />Real requests only. Offers and noise stay out.</div>
    </section>
    {phase !== "idle" ? <SearchState phase={phase} state={state} result={result} errorDetail={runError} onOpen={() => setLocation("/")} /> : null}
    {result && (phase === "complete" || phase === "empty") ? <SearchResults items={qualifiedResults} loading={overview.isFetching} persisted={result.retrieval?.persisted ?? 0} onOpenFeed={() => setLocation("/")} /> : null}
  </div>;
}

function TaskIcon({ label, Icon, active, onClick }: { label: string; Icon: LucideIcon; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-lg border transition ${active ? "border-[#d59674] bg-[#f8e4d1] text-[#944f38]" : "border-[#eadfd2] bg-[#fffaf5] text-[#9a725d] hover:border-[#d8ae91] hover:bg-[#fff0e3]"}`} aria-label={`Use ${label} task`} title={label}><Icon className="h-3.5 w-3.5" /></button>; }
function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-extrabold transition ${active ? "bg-[#f8eadc] text-[#914f39]" : "text-[#a18270] hover:bg-[#fff8f1]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }

function SearchState({ phase, state, result, errorDetail, onOpen }: { phase: SearchLifecycle; state: ReturnType<typeof getSearchLifecycleDetails>; result: SearchResult | null; errorDetail: string | null; onOpen: () => void }) { const alert = phase === "attention"; const done = phase === "complete" || phase === "empty" || alert; const metrics = result?.retrieval; const detail = alert ? errorDetail || result?.syncError || state.detail : metrics ? metrics.buyerCandidates ? `${metrics.persisted} qualified request${metrics.persisted === 1 ? "" : "s"} saved.` : "No concrete buyer request saved this time." : state.detail; return <section className={`mx-auto mt-2 max-w-4xl overflow-hidden rounded-[22px] border p-4 sm:p-5 ${alert ? "border-[#edcaba] bg-[#fff4ed]" : done ? "border-[#cae4d1] bg-[#f7fcf7]" : "border-[#ead9c4] bg-white"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${alert ? "bg-[#f8ded2] text-[#a55136]" : done ? "bg-[#e1f0e4] text-[#397657]" : "bg-[#f7e3d1] text-[#9b593f]"}`}>{alert ? <Radar className="h-3.5 w-3.5" /> : done ? <BadgeCheck className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}</span><div><p className={`text-xs font-extrabold ${alert ? "text-[#a55136]" : done ? "text-[#397657]" : "text-[#704635]"}`}>{state.label}</p><p className="mt-1 text-[11px] leading-5 text-[#987c69]">{detail}</p></div></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full transition-all duration-700 ${alert ? "bg-[#c46b4d]" : done ? "bg-[#5a9a70]" : "bg-[#b85f45]"}`} style={{ width: `${state.progress}%` }} /></div>{metrics && done && !alert ? <div className="mt-4 flex flex-wrap gap-2"><Metric label="Pages" value={`${metrics.pagesChecked}/${metrics.pageBudget}`} /><Metric label="Queries" value={`${metrics.queryFamilies}/${metrics.queryFamilyBudget}`} /><Metric label="Saved" value={String(metrics.persisted)} /></div> : null}{done && !alert ? <Button onClick={onOpen} variant="outline" className="mt-4 h-9 rounded-xl border-[#cce1d1] bg-white text-xs font-bold text-[#40745a] hover:bg-[#fafffa]">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#eadfd2] bg-white px-3 py-2"><p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#a78a76]">{label}</p><p className="mt-0.5 text-xs font-extrabold text-[#604132]">{value}</p></div>; }
function SearchResults({ items, loading, persisted, onOpenFeed }: { items: any[]; loading: boolean; persisted: number; onOpenFeed: () => void }) { return <section className="mt-8 border-t border-[#eadfd2] pt-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">Faro found</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[#4b3123]">Qualified requests</h2></div><button onClick={onOpenFeed} className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#9a523b] hover:text-[#713c2b]">Feed <ArrowRight className="h-3 w-3" /></button></div>{loading ? <div className="mt-4 grid min-h-28 place-items-center rounded-[22px] border border-[#ead9c4] bg-white"><Loader2 className="h-4 w-4 animate-spin text-[#b56a4e]" /></div> : items.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.slice(0, 10).map(item => <SearchResultCard key={item.post.id} item={item} />)}</div> : <div className="mt-4 rounded-[22px] border border-dashed border-[#ead9c4] bg-[#fffdfa] p-5 text-[11px] text-[#92735f]">{persisted ? `${persisted} saved post${persisted === 1 ? "" : "s"} still needs final review.` : "No qualified requests saved this time."}</div>}</section>; }
function SearchResultCard({ item }: { item: any }) { const { post } = item; const author = post.authorName || post.authorHandle || "Public X account"; const category = getRequestCategory(post); const handle = post.authorHandle ? `@${String(post.authorHandle).replace(/^@/, "")}` : "X member"; const initial = author.charAt(0).toUpperCase(); return <article className="overflow-hidden rounded-[22px] border border-[#ead9c4] bg-white shadow-[0_10px_22px_rgba(99,59,31,0.045)]"><div className="p-4"><div className="flex items-start gap-3"><Avatar className="h-10 w-10 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-xs font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate text-xs font-extrabold text-[#4b3123]">{author}</p><span className="text-[10px] text-[#9b735c]">{handle}</span><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e7f3e9] px-2 py-1 text-[9px] font-extrabold text-[#3f7757]"><BadgeCheck className="h-3 w-3" />Qualified</span></div><div className="mt-1.5 flex items-center gap-2"><span className="rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]">{category}</span><span className="text-[9px] font-bold text-[#a48a79]">{post.ruleScore} signal</span></div></div></div><p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5 text-[#604536]">{post.body}</p></div><div className="flex items-center justify-between gap-3 border-t border-[#f0e6de] bg-[#fffdfa] px-4 py-2.5"><span className="truncate text-[9px] font-semibold text-[#a18b7a]">{getMatchReason(post)}</span><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-[#98513a] hover:text-[#713c2b]">Open X <ExternalLink className="h-3 w-3" /></a></div></article>; }
