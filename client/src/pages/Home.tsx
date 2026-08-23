import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Bot, Check, ChevronDown, CircleAlert, Download, Loader2, Plus, Radio, RefreshCw, Search, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type FeedStatus = "all" | "pending" | "approved" | "rejected";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function statusStyle(status: string | null | undefined) {
  if (status === "healthy") return "bg-[#e0f1e7] text-[#275c40]";
  if (status === "payment_required" || status === "rate_limited") return "bg-[#ffe9df] text-[#8a3e23]";
  if (status === "error" || status === "degraded") return "bg-[#f8dddd] text-[#8c3030]";
  return "bg-[#e7edf2] text-[#4b6376]";
}

export default function Home() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<FeedStatus>("all");
  const [minimumScore, setMinimumScore] = useState(0);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [goal, setGoal] = useState("People asking for help building custom AI workflows for a small business");
  const [name, setName] = useState("AI workflow requests");
  const [includeTerms, setIncludeTerms] = useState("AI workflow, automation, custom workflow");
  const [excludeTerms, setExcludeTerms] = useState("job, giveaway");
  const [xQuery, setXQuery] = useState('(\"AI workflow\" OR automation OR \"custom workflow\") -(job OR giveaway) -is:retweet');
  const overview = trpc.monitoring.overview.useQuery(undefined, { refetchInterval: 30_000 });

  const invalidate = () => utils.monitoring.overview.invalidate();
  const suggest = trpc.monitoring.suggest.useMutation({
    onSuccess: result => {
      setIncludeTerms(result.includeTerms.join(", "));
      setExcludeTerms(result.excludeTerms.join(", "));
      setXQuery(result.xQuery);
      toast.success(result.fallback ? "A deterministic query suggestion is ready." : `Suggestion ready via ${result.model}.`);
    },
    onError: () => toast.error("Couldn’t create a suggestion. You can still edit the query directly."),
  });
  const create = trpc.monitoring.create.useMutation({ onSuccess: () => { toast.success("Saved search created."); setShowCreator(false); invalidate(); }, onError: error => toast.error(error.message) });
  const seedDemo = trpc.monitoring.seedDemo.useMutation({ onSuccess: result => { toast.success(result.created ? "Clearly labeled demo data added." : "Demo data is already present."); invalidate(); }, onError: () => toast.error("Couldn’t add demo data.") });
  const sync = trpc.monitoring.sync.useMutation({ onSuccess: result => { toast.success(`${result.inserted} public posts checked.`); invalidate(); }, onError: error => { toast.error("Sync status updated — check the source card."); invalidate(); console.warn(error.message); } });
  const review = trpc.monitoring.review.useMutation({ onSuccess: () => { toast.success("Human review decision saved."); invalidate(); }, onError: error => toast.error(error.message) });

  const allPosts = overview.data?.posts ?? [];
  const posts = useMemo(() => allPosts.filter(({ post }) => (filter === "all" || post.reviewStatus === filter) && post.ruleScore >= minimumScore), [allPosts, filter, minimumScore]);
  const selected = allPosts.find(({ post }) => post.id === selectedId) ?? posts[0] ?? null;
  const monitors = overview.data?.monitors ?? [];
  const latestSync = monitors.find(({ sync: monitorSync }) => monitorSync)?.sync;
  const sourceName = latestSync?.source === "filtered_stream" ? "X Stream" : latestSync?.source === "twitterapi_io" ? "Alt. X API" : "X Search";

  function createMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({
      name,
      goal,
      xQuery,
      includeTerms: includeTerms.split(",").map(term => term.trim()).filter(Boolean),
      excludeTerms: excludeTerms.split(",").map(term => term.trim()).filter(Boolean),
      categories: ["public requests", "human review"],
    });
  }

  function exportFeed() {
    const header = ["Score", "Review", "Intent", "Confidence", "Author", "Timestamp", "Post", "Matched rule", "Source", "X link"];
    const rows = allPosts.map(({ post, monitorName }) => [post.ruleScore, post.reviewStatus, post.aiIntent.label, post.aiIntent.confidence, post.authorHandle ? `@${post.authorHandle}` : post.authorName, new Date(post.postedAt).toISOString(), post.body, post.matchedRule, post.source, post.postUrl, monitorName]);
    const blob = new Blob([[header, ...rows].map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "signalforge-human-review-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <DashboardLayout><div className="relative mx-auto max-w-[1550px] overflow-hidden rounded-[28px] bg-[#f8fafb] px-4 py-5 md:px-8 md:py-8">
    <div className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 rounded-full bg-[#d8eafb]/75 blur-[1px]" />
    <div className="pointer-events-none absolute right-64 top-36 h-36 w-36 rotate-12 rounded-[38px] bg-[#f7dbe1]/70" />
    <div className="pointer-events-none absolute -bottom-24 left-[20%] h-56 w-56 rounded-full border-[22px] border-[#dcecf9]/80" />

    <header className="relative z-10 flex flex-col justify-between gap-6 border-b border-[#dfe7ed] pb-7 lg:flex-row lg:items-end">
      <div>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6c7e8c]"><span className="h-2 w-2 rounded-full bg-[#8fc7ee]" /> Public-signal review workspace</div>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-[-0.075em] text-[#141b22] sm:text-5xl">Find the signal.<br /><span className="text-[#5b7183]">Keep the human in control.</span></h1>
        <p className="mt-4 max-w-xl text-sm font-light leading-6 text-[#5e7080]">Turn public X conversations into a deliberately reviewable opportunity queue. SignalForge never sends outreach, posts, or messages.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full border-[#c8d8e3] bg-white/80 text-[#263c4d] hover:bg-white" onClick={exportFeed} disabled={!allPosts.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
        <Button className="rounded-full bg-[#17232d] px-5 text-white hover:bg-[#263b4b]" onClick={() => setShowCreator(value => !value)}><Plus className="mr-2 h-4 w-4" /> New monitor</Button>
      </div>
    </header>

    <section className="relative z-10 mt-5 flex flex-col gap-4 rounded-[20px] border border-[#cbdde8] bg-[#edf7fc]/80 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4d7893]">Submission flow</p><p className="mt-1 text-sm text-[#385b70]"><strong>1.</strong> Describe intent in plain English. <strong>2.</strong> Review the generated query. <strong>3.</strong> Sync public X posts. <strong>4.</strong> Review manually.</p></div>
      <Button variant="outline" className="shrink-0 rounded-full border-[#a7c7da] bg-white text-[#294b61]" onClick={() => setShowCreator(true)}><Sparkles className="mr-2 h-4 w-4" /> Try a natural-language query</Button>
    </section>

    {showCreator && <section className="relative z-10 mt-6 rounded-[24px] border border-[#bed3e2] bg-white/85 p-5 shadow-[0_16px_50px_rgba(54,85,110,0.08)] backdrop-blur md:p-6">
      <div className="mb-5 flex items-start justify-between gap-6"><div><p className="text-xs font-medium uppercase tracking-[0.15em] text-[#6f8595]">Monitor builder</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.05em]">Describe the listening goal.</h2><p className="mt-2 text-sm font-light text-[#647683]">Use a natural-language intent or targeted keywords. Select <strong>Suggest</strong>, inspect the rule, save, then sync live public results.</p></div><button className="rounded-full p-2 hover:bg-[#edf3f7]" onClick={() => setShowCreator(false)} aria-label="Close monitor builder"><X className="h-4 w-4" /></button></div>
      <form onSubmit={createMonitor} className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b]">Monitor name<Input value={name} onChange={event => setName(event.target.value)} className="h-11 rounded-xl border-[#d7e3ea] bg-white text-sm normal-case tracking-normal" /></label>
        <div className="flex items-end gap-2"><label className="grid flex-1 gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b]">Natural-language intent<Textarea value={goal} onChange={event => setGoal(event.target.value)} className="min-h-20 rounded-xl border-[#d7e3ea] bg-white text-sm normal-case tracking-normal" /></label><Button type="button" variant="outline" className="mb-0 h-10 rounded-xl border-[#c9d9e4]" onClick={() => suggest.mutate({ goal })} disabled={suggest.isPending}><Sparkles className="mr-2 h-4 w-4" /> {suggest.isPending ? "Thinking" : "Suggest"}</Button></div>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b]">Keyword inclusions<Input value={includeTerms} onChange={event => setIncludeTerms(event.target.value)} className="h-11 rounded-xl border-[#d7e3ea] bg-white text-sm normal-case tracking-normal" /></label>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b]">Exclude terms<Input value={excludeTerms} onChange={event => setExcludeTerms(event.target.value)} className="h-11 rounded-xl border-[#d7e3ea] bg-white text-sm normal-case tracking-normal" /></label>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b] lg:col-span-2">Validated X rule<Input value={xQuery} onChange={event => setXQuery(event.target.value)} className="mono h-11 rounded-xl border-[#d7e3ea] bg-white text-xs normal-case tracking-normal" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2"><p className="flex items-center gap-2 text-xs font-light text-[#627587]"><ShieldCheck className="h-4 w-4 text-[#448169]" /> Saved rules find public posts for manual review only.</p><Button type="submit" disabled={create.isPending} className="rounded-full bg-[#17232d] px-5 text-white"><Radio className="mr-2 h-4 w-4" /> Save monitor</Button></div>
      </form>
    </section>}

    <section className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
      <Metric label="Saved monitors" value={String(monitors.length).padStart(2, "0")} detail="Criteria under your control" />
      <Metric label="Review queue" value={String(overview.data?.summary.pending ?? 0).padStart(2, "0")} detail="Awaiting a human decision" accent="blue" />
      <Metric label="Approved" value={String(overview.data?.summary.approved ?? 0).padStart(2, "0")} detail="No action is sent" accent="pink" />
      <Metric label="Live source" value={sourceName} detail={latestSync?.latencyLabel ?? "Create or load a monitor"} />
    </section>

    <section className="relative z-10 mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_390px]">
      <div className="rounded-[25px] border border-[#d9e5ec] bg-white/80 p-4 shadow-[0_16px_50px_rgba(54,85,110,0.07)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 border-b border-[#e2eaef] pb-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6c8394]">Opportunity feed</p><h2 className="mt-1 text-xl font-bold tracking-[-0.05em]">Ranked X results</h2><p className="mt-1 text-[11px] text-[#738898]">Live rows include author, content, timestamp, and a direct X link. Demo rows remain visibly labeled.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-full bg-[#eef3f6] p-1">{(["all", "pending", "approved", "rejected"] as FeedStatus[]).map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs transition ${filter === value ? "bg-white font-semibold text-[#223340] shadow-sm" : "text-[#6b7e8d]"}`}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div><label className="flex items-center gap-2 text-xs text-[#617484]">Score <select className="rounded-full border border-[#d4e0e7] bg-white px-2 py-1.5" value={minimumScore} onChange={event => setMinimumScore(Number(event.target.value))}><option value={0}>All</option><option value={60}>60+</option><option value={80}>80+</option></select></label></div></div>
        <div className="mt-3 grid gap-2">{overview.isLoading && <div className="flex min-h-56 items-center justify-center text-sm text-[#6b8090]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the human review queue</div>}{!overview.isLoading && !posts.length && <div className="soft-grid flex min-h-64 flex-col items-center justify-center rounded-2xl px-6 text-center"><div className="mb-4 flex items-end gap-1.5"><span className="h-3 w-1.5 rounded-full bg-[#a6cfe8]" /><span className="h-6 w-1.5 rounded-full bg-[#7eb9dd]" /><span className="h-10 w-1.5 rounded-full bg-[#eeb6c7]" /><span className="h-6 w-1.5 rounded-full bg-[#7eb9dd]" /><span className="h-3 w-1.5 rounded-full bg-[#a6cfe8]" /></div><h3 className="font-bold tracking-[-0.04em]">No signal has cleared the gate—yet.</h3><p className="mt-2 max-w-sm text-sm font-light text-[#647887]">Create a monitor to start secure X search, or load clearly labeled demo signals to preview ranking, explanation, and human decision points.</p><div className="mt-5 flex gap-2"><Button variant="outline" className="rounded-full border-[#c8dbe8] bg-white" onClick={() => setShowCreator(true)}><Plus className="mr-2 h-4 w-4" /> Create monitor</Button><Button className="rounded-full bg-[#17232d]" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>Load demo</Button></div></div>}{posts.map(({ post, monitorName }) => <button key={post.id} onClick={() => setSelectedId(post.id)} className={`group grid gap-3 rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[72px_1fr_auto] ${selected?.post.id === post.id ? "border-[#99c0db] bg-[#f4f9fc]" : "border-transparent hover:border-[#d5e3eb] hover:bg-[#fbfdfe]"}`}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15222c] text-sm font-extrabold text-white"><span>{post.ruleScore}</span></div><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-xs font-bold tracking-[-0.02em]">{post.authorHandle ? `@${post.authorHandle}` : post.authorName || "Unknown author"}</span><span className="text-[11px] text-[#718594]">{new Date(post.postedAt).toLocaleString()}</span><span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#6f8595]">{monitorName}</span></div><p className="line-clamp-2 text-sm leading-6 text-[#263640]">{post.body}</p><div className="mt-2 flex flex-wrap gap-2"><Badge className="rounded-full bg-[#e3f0fa] text-[10px] font-medium text-[#315a75] hover:bg-[#e3f0fa]">{post.aiIntent.label}</Badge>{post.source === "demo" && <Badge className="rounded-full bg-[#f6e4e8] text-[10px] font-medium text-[#874d5c] hover:bg-[#f6e4e8]">Demo sample</Badge>}</div></div><div className="flex items-start gap-1 self-start"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${post.reviewStatus === "approved" ? "bg-[#e1f1e6] text-[#306e4a]" : post.reviewStatus === "rejected" ? "bg-[#f8e3e3] text-[#8c4141]" : "bg-[#edf1f3] text-[#667986]"}`}>{post.reviewStatus}</span><ChevronDown className="mt-1 h-3.5 w-3.5 text-[#7c8f9b] transition group-hover:translate-y-0.5" /></div></button>)}</div>
      </div>
      <aside className="rounded-[25px] border border-[#d9e5ec] bg-[#fcfeff]/90 p-5 shadow-[0_16px_50px_rgba(54,85,110,0.07)] backdrop-blur">{selected ? <PostDetail item={selected} onReview={(decision) => review.mutate({ postId: selected.post.id, decision })} reviewPending={review.isPending} /> : <div className="flex min-h-64 flex-col items-center justify-center text-center"><CircleAlert className="h-6 w-6 text-[#7199b5]" /><p className="mt-3 text-sm text-[#607685]">Select a post to see why it ranked.</p></div>}</aside>
    </section>

    <section className="relative z-10 mt-6 grid gap-4 lg:grid-cols-2">{monitors.map(({ monitor, sync: monitorSync }) => <article key={monitor.id} className="rounded-[20px] border border-[#d7e4eb] bg-white/75 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#768b9b]">Saved monitor</p><h3 className="mt-1 font-bold tracking-[-0.04em]">{monitor.name}</h3><p className="mt-1 line-clamp-1 text-xs font-light text-[#647988]">{monitor.goal}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusStyle(monitorSync?.status)}`}>{monitorSync?.status?.replaceAll("_", " ") ?? "ready"}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5edf1] pt-3"><p className="mono max-w-[60%] truncate text-[10px] text-[#627886]">{monitor.xQuery}</p><Button size="sm" variant="outline" className="h-8 rounded-full border-[#c9dce8] text-xs" onClick={() => sync.mutate({ monitorId: monitor.id })} disabled={sync.isPending}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Sync</Button></div><p className="mt-2 text-[11px] text-[#708694]">{monitorSync?.latencyLabel ?? "Not synced yet"}{monitorSync?.lastSyncedAt ? ` · ${new Date(monitorSync.lastSyncedAt).toLocaleString()}` : ""}</p></article>)}</section>
  </div></DashboardLayout>;
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: "blue" | "pink" }) {
  return <article className={`rounded-[21px] border border-[#d8e4ea] bg-white/75 p-4 shadow-[0_8px_25px_rgba(54,85,110,0.045)] ${accent === "blue" ? "border-l-4 border-l-[#a8d6f1]" : accent === "pink" ? "border-l-4 border-l-[#efbaca]" : ""}`}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#758a9a]">{label}</p><p className="mt-3 text-2xl font-extrabold tracking-[-0.06em] text-[#18232c]">{value}</p><p className="mt-1 text-xs font-light text-[#6a7f8e]">{detail}</p></article>;
}

function PostDetail({ item, onReview, reviewPending }: { item: { post: any; monitorName: string }; onReview: (decision: "approved" | "rejected") => void; reviewPending: boolean }) {
  const { post, monitorName } = item;
  const engagement = Object.values(post.engagement as Record<string, number>).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  return <div><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#73899a]">Why this ranked</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.055em]">Human review brief</h2></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17232d] text-base font-extrabold text-white">{post.ruleScore}</div></div><div className="mt-5 rounded-2xl bg-[#f1f6f9] p-4"><p className="text-xs font-bold">{post.authorHandle ? `@${post.authorHandle}` : post.authorName || "Unknown author"}</p><p className="mt-2 text-sm leading-6 text-[#273944]">{post.body}</p><div className="mt-3 flex items-center justify-between text-[11px] text-[#6b8090]"><span>{new Date(post.postedAt).toLocaleString()}</span><span>{compactNumber(engagement)} engagement</span></div></div><div className="mt-5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#73899a]">Transparent rule score</p><div className="mt-2 grid gap-2">{(post.scoreExplanation as Array<{ label: string; points: number }>).map(component => <div className="flex items-center justify-between rounded-xl border border-[#e1eaef] px-3 py-2 text-xs" key={component.label}><span className="text-[#516a7b]">{component.label}</span><span className={`font-bold ${component.points > 0 ? "text-[#34795a]" : "text-[#a24848]"}`}>{component.points > 0 ? "+" : ""}{component.points}</span></div>)}</div></div><div className="mt-5 rounded-2xl border border-[#d6e5ee] bg-[#edf7fd] p-4"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#477895]" /><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#477895]">Intent classification</p></div><p className="mt-2 text-sm font-bold text-[#25465d]">{post.aiIntent.label} · {Math.round(post.aiIntent.confidence * 100)}%</p><p className="mt-1 text-xs leading-5 text-[#527187]">{post.aiIntent.rationale}</p><p className="mt-2 text-[10px] text-[#6b8798]">{post.aiIntent.fallback ? "Deterministic fallback" : post.aiIntent.model} · advisory only</p></div><div className="mt-5 flex flex-wrap gap-2">{post.postUrl ? <a href={post.postUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-[#c9dbe6] bg-white px-3 text-xs font-semibold text-[#36576c] hover:bg-[#f2f8fb]">Open on X <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></a> : <span className="inline-flex h-9 items-center rounded-full bg-[#f5e6e9] px-3 text-xs font-medium text-[#865061]">Demo sample — no X link</span>}{post.reviewStatus === "pending" ? <><Button className="h-9 rounded-full bg-[#276e4c] text-xs hover:bg-[#1f5a3e]" disabled={reviewPending} onClick={() => onReview("approved")}><ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Approve</Button><Button variant="outline" className="h-9 rounded-full border-[#e7c2c2] text-xs text-[#9c3e3e] hover:bg-[#fff5f5]" disabled={reviewPending} onClick={() => onReview("rejected")}><ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Reject</Button></> : <span className="inline-flex h-9 items-center rounded-full bg-[#eff4f6] px-3 text-xs font-semibold text-[#566d7d]"><Check className="mr-1.5 h-3.5 w-3.5" /> {post.reviewStatus}</span>}</div><p className="mt-5 text-[11px] leading-5 text-[#6b8190]">Decision state: {post.reviewStatus}. SignalForge stores this as a human-review label only; it does not trigger any communication.</p><p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#7990a0]">Matched {monitorName}</p></div>;
}
