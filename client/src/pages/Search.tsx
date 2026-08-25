import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getQualifiedPosts, getRequestCategory } from "@/lib/discoverFeed";
import { getSearchLifecycleDetails, type SearchLifecycle } from "@/lib/discoverSearch";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, ExternalLink, KeyRound, Loader2, Radar, Search as SearchIcon, Sparkles, WandSparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const suggestions = [
  { label: "AI agents", value: "Find founders and teams looking for a provider to build or implement AI agents." },
  { label: "Automation", value: "Find operators who need someone to automate repetitive business workflows." },
  { label: "AI video", value: "Find businesses seeking help with practical AI video production or video automation." },
  { label: "Product testing", value: "Find product teams looking for an outside specialist to test and validate an AI-enabled feature before launch." },
  { label: "Dev build", value: "Find teams looking for a contract developer to build or integrate an AI-enabled product workflow." },
  { label: "Content & posts", value: "Find businesses seeking someone to create, publish, or automate practical AI-powered social content." },
  { label: "Contests", value: "Find teams seeking help with a practical AI project, competition entry, or contest submission." },
];

type RetrievalMetrics = {
  sourceCalls: number;
  plannedPageRequests: number;
  queryFamilies: number;
  queryFamilyBudget: number;
  pagesChecked: number;
  pageBudget: number;
  rawReceived: number;
  deduplicatedPosts: number;
  buyerCandidates: number;
  persisted: number;
  queueWaitMs: number;
};

type SearchResult = {
  monitorId: number;
  inserted: number;
  sourceStatus: string;
  syncError?: string | null;
  retrieval?: RetrievalMetrics;
};

export default function Search() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"agent" | "keyword">("agent");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [phase, setPhase] = useState<SearchLifecycle>("idle");
  const [result, setResult] = useState<SearchResult | null>(null);
  const overview = trpc.monitoring.overview.useQuery(undefined, { staleTime: 5_000 });

  const finish = async (data: { monitorId: number; sync?: { inserted: number; retrieval?: RetrievalMetrics } | null; sourceStatus: string; syncError?: string | null }) => {
    const retrieval = data.sync?.retrieval;
    const sourceIssue = Boolean(data.syncError) || Boolean(retrieval?.buyerCandidates && !retrieval.persisted);
    await utils.monitoring.overview.invalidate();
    await overview.refetch();
    setResult({
      monitorId: data.monitorId,
      inserted: data.sync?.inserted ?? 0,
      sourceStatus: data.sourceStatus,
      syncError: data.syncError ?? (sourceIssue ? "Faro found buyer candidates but could not save them. Please run the search again." : null),
      retrieval,
    });
    setPhase(sourceIssue ? "attention" : retrieval?.persisted ? "complete" : "empty");
  };

  const agent = trpc.monitoring.agentStart.useMutation({ onSuccess: finish, onError: error => { setPhase("attention"); toast.error(error.message); } });
  const keyword = trpc.monitoring.keywordStart.useMutation({ onSuccess: finish, onError: error => { setPhase("attention"); toast.error(error.message); } });
  const pending = agent.isPending || keyword.isPending;

  useEffect(() => {
    if (!pending) return;
    setPhase("brief");
    const source = window.setTimeout(() => setPhase("source"), 420);
    const qualify = window.setTimeout(() => setPhase("qualifying"), 1250);
    return () => { window.clearTimeout(source); window.clearTimeout(qualify); };
  }, [pending]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    setPhase("brief");
    if (mode === "agent") agent.mutate({ brief });
    else keyword.mutate({ keywords });
  };

  const state = getSearchLifecycleDetails(phase);
  const ready = mode === "agent" ? brief.trim().length >= 12 : keywords.trim().length >= 2;
  const qualifiedResults = useMemo(() => result ? getQualifiedPosts(overview.data?.posts ?? [], result.monitorId, false) : [], [overview.data?.posts, result]);

  return <div className="mx-auto w-full max-w-6xl pb-10">
    <header className="flex items-center justify-between gap-4 border-b border-[#eadfd2] pb-5">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1d7b9] text-[#8f4e38]"><SearchIcon className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Buyer requests</p><h1 className="mt-0.5 text-2xl font-extrabold tracking-[-0.06em] text-[#3d2e23]">Search</h1></div></div>
      <span className="hidden rounded-full bg-[#f8eadc] px-3 py-1.5 text-[10px] font-extrabold text-[#91503a] sm:inline">X demand</span>
    </header>
    <section className="mt-6 overflow-hidden rounded-[30px] border border-[#ead9c4] bg-[#fbf2e5] p-4 shadow-[0_16px_36px_rgba(99,59,31,0.06)] sm:p-6 lg:p-7">
      <div className="flex gap-2">
        <ModeButton active={mode === "agent"} icon={Sparkles} label="AI brief" onClick={() => { setMode("agent"); setPhase("idle"); setResult(null); }} />
        <ModeButton active={mode === "keyword"} icon={KeyRound} label="Keyword search" onClick={() => { setMode("keyword"); setPhase("idle"); setResult(null); }} />
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-stretch">
        <div className="min-w-0">
          {mode === "agent" ? <><label className="sr-only">Describe the buyer request Faro should find</label><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-36 resize-none rounded-[22px] border-[#e3cdb1] bg-white px-4 py-3 text-sm leading-6 focus-visible:ring-[#bd674c]" placeholder="Describe the kind of buyer request you want to find…" /><div className="mt-3 flex flex-wrap gap-1.5">{suggestions.map(item => <button key={item.label} type="button" onClick={() => setBrief(item.value)} className={`inline-flex rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${brief === item.value ? "border-[#d49a78] bg-[#fff5ea] text-[#8d4d37]" : "border-[#ead9c4] bg-white/70 text-[#806452] hover:bg-white"}`}>{item.label}</button>)}</div></> : <><label className="sr-only">Keywords or a focused phrase</label><Input value={keywords} onChange={event => setKeywords(event.target.value)} className="h-16 rounded-[22px] border-[#e3cdb1] bg-white px-4 text-sm focus-visible:ring-[#bd674c]" placeholder="Keywords or a focused phrase" /></>}
        </div>
        <div className="flex flex-col justify-between rounded-[22px] border border-[#edd9c3] bg-white/70 p-4"><span className="inline-flex w-fit rounded-full bg-[#f8eadc] px-2 py-1 text-[9px] font-extrabold text-[#92513c]">Buyer-only</span><Button type="submit" disabled={!ready || pending} className="mt-8 h-11 w-full rounded-2xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] hover:bg-[#9f4d36]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching</> : <><Radar className="mr-2 h-4 w-4" />Run Faro</>}</Button></div>
      </form>
      {phase !== "idle" ? <SearchState phase={phase} state={state} result={result} onOpen={() => setLocation("/")} /> : null}
      {result && (phase === "complete" || phase === "empty") ? <SearchResults items={qualifiedResults} loading={overview.isFetching} persisted={result.retrieval?.persisted ?? 0} onOpenFeed={() => setLocation("/")} /> : null}
    </section>
  </div>;
}

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Sparkles; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${active ? "border-[#d69d7b] bg-white text-[#914f39] shadow-sm" : "border-transparent text-[#967760] hover:bg-white/60"}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function SearchState({ phase, state, result, onOpen }: { phase: SearchLifecycle; state: ReturnType<typeof getSearchLifecycleDetails>; result: SearchResult | null; onOpen: () => void }) {
  const alert = phase === "attention";
  const done = phase === "complete" || phase === "empty" || alert;
  const metrics = result?.retrieval;
  const detail = alert
    ? result?.syncError || state.detail
    : metrics
      ? metrics.buyerCandidates
        ? `${metrics.persisted} qualified request${metrics.persisted === 1 ? "" : "s"} saved.`
        : "No concrete buyer request saved this time."
      : state.detail;

  return <div className={`mt-6 rounded-2xl border p-4 ${alert ? "border-[#edcaba] bg-[#fff4ed]" : done ? "border-[#cae4d1] bg-[#f4fbf4]" : "border-[#ead9c4] bg-white/70"}`}>
    <div className="flex items-start justify-between gap-4"><div><p className={`text-xs font-extrabold ${alert ? "text-[#a55136]" : done ? "text-[#397657]" : "text-[#8b604a]"}`}>{state.label}</p><p className="mt-1 text-[10px] leading-5 text-[#987c69]">{detail}</p></div><span className="text-[10px] font-extrabold text-[#a45a43]">{state.progress}%</span></div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full transition-all duration-700 ${alert ? "bg-[#c46b4d]" : done ? "bg-[#5a9a70]" : "bg-[#b85f45]"}`} style={{ width: `${state.progress}%` }} /></div>
    {metrics && done && !alert ? <div className="mt-4 grid grid-cols-3 gap-2"><Metric label="Pages" value={`${metrics.pagesChecked}/${metrics.pageBudget}`} /><Metric label="Queries" value={`${metrics.queryFamilies}/${metrics.queryFamilyBudget}`} /><Metric label="Saved" value={String(metrics.persisted)} /></div> : null}
    {done && !alert ? <Button onClick={onOpen} variant="outline" className="mt-4 h-9 rounded-xl border-[#cce1d1] bg-white text-xs font-bold text-[#40745a] hover:bg-[#fafffa]">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#eadfd2] bg-white/85 px-2.5 py-2"><p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#a78a76]">{label}</p><p className="mt-0.5 text-xs font-extrabold text-[#604132]">{value}</p></div>; }

function SearchResults({ items, loading, persisted, onOpenFeed }: { items: any[]; loading: boolean; persisted: number; onOpenFeed: () => void }) {
  return <section className="mt-6 border-t border-[#ead9c4] pt-5"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-extrabold tracking-[-0.04em] text-[#4b3123]">Qualified requests</h2><button onClick={onOpenFeed} className="text-[10px] font-extrabold text-[#9a523b] hover:text-[#713c2b]">Feed <ArrowRight className="ml-1 inline h-3 w-3" /></button></div>{loading ? <div className="mt-4 grid min-h-24 place-items-center rounded-2xl border border-[#ead9c4] bg-white/60"><Loader2 className="h-4 w-4 animate-spin text-[#b56a4e]" /></div> : items.length ? <div className="mt-4 space-y-3">{items.slice(0, 10).map(item => <SearchResultCard key={item.post.id} item={item} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#ead9c4] bg-white/60 p-4 text-[11px] text-[#92735f]">{persisted ? `${persisted} saved post${persisted === 1 ? "" : "s"} still needs final review.` : "No qualified requests saved this time."}</div>}</section>;
}

function SearchResultCard({ item }: { item: any }) {
  const { post } = item;
  const author = post.authorName || post.authorHandle || "Public X account";
  const category = getRequestCategory(post);
  const handle = post.authorHandle ? `@${String(post.authorHandle).replace(/^@/, "")}` : "X member";
  const initial = author.charAt(0).toUpperCase();
  return <article className="overflow-hidden rounded-[22px] border border-[#ead9c4] bg-white shadow-[0_10px_22px_rgba(99,59,31,0.045)]"><div className="p-4"><div className="flex items-start gap-3"><Avatar className="h-10 w-10 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-xs font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate text-xs font-extrabold text-[#4b3123]">{author}</p><span className="text-[10px] text-[#9b735c]">{handle}</span><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e7f3e9] px-2 py-1 text-[9px] font-extrabold text-[#3f7757]"><BadgeCheck className="h-3 w-3" />Qualified</span></div><div className="mt-1.5 flex items-center gap-2"><span className="rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]">{category}</span><span className="text-[9px] font-bold text-[#a48a79]">{post.ruleScore} signal</span></div></div></div><p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5 text-[#604536]">{post.body}</p></div><div className="flex items-center justify-between border-t border-[#f0e6de] bg-[#fffdfa] px-4 py-2.5"><span className="text-[9px] font-semibold text-[#a18b7a]">{post.postedAt ? new Date(post.postedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recent saved post"}</span><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#98513a] hover:text-[#713c2b]">Open in X <ExternalLink className="h-3 w-3" /></a></div></article>;
}
