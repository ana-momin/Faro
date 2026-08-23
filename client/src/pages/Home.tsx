import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Bot,
  Check,
  CircleCheck,
  CircleX,
  Clapperboard,
  Filter,
  Lightbulb,
  ListFilter,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type FeedStatus = "all" | "pending" | "approved" | "rejected";
type Preset = {
  id: string;
  label: string;
  icon: typeof Workflow;
  goal: string;
  name: string;
  includeTerms: string;
  excludeTerms: string;
  xQuery: string;
};

const PRESETS: Preset[] = [
  {
    id: "workflows",
    label: "AI workflows",
    icon: Workflow,
    name: "AI workflow requests",
    goal: "People actively looking for help building custom AI workflows for a small business",
    includeTerms: "custom AI workflow, AI workflow, automation",
    excludeTerms: "job, giveaway",
    xQuery: '("custom AI workflow" OR "AI workflow" OR automation) ("looking for" OR "need someone" OR "need help" OR hire) -(job OR giveaway) -is:retweet',
  },
  {
    id: "automation",
    label: "Automation",
    icon: Zap,
    name: "Automation requests",
    goal: "People who need help automating repetitive business work, systems, or integrations",
    includeTerms: "automation, Zapier, n8n, integration",
    excludeTerms: "job, giveaway",
    xQuery: '(automation OR Zapier OR n8n OR integration) ("need help" OR "looking for" OR "can someone" OR hire) -(job OR giveaway) -is:retweet',
  },
  {
    id: "video",
    label: "AI video",
    icon: Clapperboard,
    name: "AI video requests",
    goal: "People seeking help producing practical AI product, UGC, or short-form videos",
    includeTerms: "AI video, UGC video, product video",
    excludeTerms: "job, giveaway",
    xQuery: '("AI video" OR "UGC video" OR "product video") ("need someone" OR "looking for" OR "need help" OR hire) -(job OR giveaway) -is:retweet',
  },
  {
    id: "custom",
    label: "Custom",
    icon: WandSparkles,
    name: "Custom task requests",
    goal: "People explicitly asking for practical help with an AI-related task",
    includeTerms: "AI, build, implementation",
    excludeTerms: "job, giveaway",
    xQuery: '(AI OR build OR implementation) ("need someone to" OR "looking for someone" OR "can someone help") -(job OR giveaway) -is:retweet',
  },
];

const scoreTone = (score: number) =>
  score >= 80 ? "bg-[#dff5e6] text-[#17643c]" : score >= 60 ? "bg-[#edf2ee] text-[#313b34]" : "bg-[#f3f4f2] text-[#777a76]";
const sourceIcon = (source?: string | null) => (source === "filtered_stream" ? Radio : source === "twitterapi_io" ? Zap : Search);
const compactNumber = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);

export default function Home() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<FeedStatus>("pending");
  const [minimumScore, setMinimumScore] = useState(60);
  const [activeMonitorId, setActiveMonitorId] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [goal, setGoal] = useState(PRESETS[0].goal);
  const [name, setName] = useState(PRESETS[0].name);
  const [includeTerms, setIncludeTerms] = useState(PRESETS[0].includeTerms);
  const [excludeTerms, setExcludeTerms] = useState(PRESETS[0].excludeTerms);
  const [xQuery, setXQuery] = useState(PRESETS[0].xQuery);

  const overviewInput = useMemo(() => (activeMonitorId ? { monitorId: activeMonitorId } : undefined), [activeMonitorId]);
  const overview = trpc.monitoring.overview.useQuery(overviewInput, { refetchInterval: 30_000 });
  const monitors = overview.data?.monitors ?? [];
  const allPosts = overview.data?.posts ?? [];
  const activeMonitor = monitors.find(({ monitor }) => monitor.id === activeMonitorId)?.monitor;
  const activeSync = monitors.find(({ monitor }) => monitor.id === activeMonitorId)?.sync;
  const SourceIcon = sourceIcon(activeSync?.source);
  const posts = useMemo(
    () => allPosts.filter(({ post }) => (filter === "all" || post.reviewStatus === filter) && post.ruleScore >= minimumScore),
    [allPosts, filter, minimumScore],
  );
  const selected = posts.find(({ post }) => post.id === selectedId) ?? posts[0] ?? null;
  const explicitRequests = allPosts.filter(({ post }) => post.aiIntent.label === "Active help-seeking").length;

  useEffect(() => {
    if (!focused && monitors.length) {
      setActiveMonitorId(monitors[0].monitor.id);
      setFocused(true);
    }
  }, [focused, monitors]);

  const invalidate = () => utils.monitoring.overview.invalidate();
  const sync = trpc.monitoring.sync.useMutation({
    onSuccess: result => {
      toast.success(`${result.inserted} new opportunities checked.`);
      invalidate();
    },
    onError: () => {
      toast.error("Live source needs attention.");
      invalidate();
    },
  });
  const create = trpc.monitoring.create.useMutation({
    onSuccess: result => {
      setActiveMonitorId(result.monitorId);
      setFocused(true);
      setShowCreator(false);
      toast.success("Live signal ready.");
      sync.mutate({ monitorId: result.monitorId });
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const suggest = trpc.monitoring.suggest.useMutation({
    onSuccess: result => {
      setIncludeTerms(result.includeTerms.join(", "));
      setExcludeTerms(result.excludeTerms.join(", "));
      setXQuery(result.xQuery);
      toast.success("Criteria mapped.");
    },
    onError: () => toast.error("Try editing the terms directly."),
  });
  const review = trpc.monitoring.review.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      invalidate();
    },
    onError: error => toast.error(error.message),
  });

  function applyPreset(preset: Preset) {
    setGoal(preset.goal);
    setName(preset.name);
    setIncludeTerms(preset.includeTerms);
    setExcludeTerms(preset.excludeTerms);
    setXQuery(preset.xQuery);
    setShowCreator(true);
  }

  function createMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({
      name,
      goal,
      xQuery,
      includeTerms: includeTerms.split(",").map(term => term.trim()).filter(Boolean),
      excludeTerms: excludeTerms.split(",").map(term => term.trim()).filter(Boolean),
      categories: ["task request", "human review"],
    });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1380px] pb-8">
        <header className="flex items-center justify-between border-b border-[#e9eae7] pb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#111214] text-white"><Radio className="h-4 w-4" /></span>
            <div>
              <h1 className="text-lg font-bold tracking-[-0.05em]">Live opportunities</h1>
              <p className="text-[11px] text-[#858780]">X task requests · human review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton icon={RefreshCw} label="Sync active signal" loading={sync.isPending} onClick={() => activeMonitorId && sync.mutate({ monitorId: activeMonitorId })} disabled={!activeMonitorId || sync.isPending} />
            <Button className="h-9 rounded-xl bg-[#111214] px-3 text-xs hover:bg-[#292a27]" onClick={() => setShowCreator(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Signal</Button>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
          {PRESETS.map(preset => {
            const Icon = preset.icon;
            return <button key={preset.id} onClick={() => applyPreset(preset)} className="group rounded-2xl border border-[#e7e8e4] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#111214] hover:shadow-[0_8px_20px_rgba(17,18,20,0.06)]" title={`Set up ${preset.label}`}>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f1f3f0] text-[#232622] group-hover:bg-[#111214] group-hover:text-white"><Icon className="h-4 w-4" /></span>
              <span className="mt-2 block text-[11px] font-semibold leading-4 text-[#343633]">{preset.label}</span>
            </button>;
          })}
        </section>

        {showCreator && <section className="mt-4 rounded-2xl border border-[#e1e3df] bg-white p-4 shadow-[0_10px_28px_rgba(18,18,18,0.05)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1f3f0]"><Settings2 className="h-4 w-4" /></span><p className="text-sm font-bold">Tune signal</p></div>
            <IconButton icon={X} label="Close signal editor" onClick={() => setShowCreator(false)} />
          </div>
          <form onSubmit={createMonitor} className="mt-4 grid gap-3 lg:grid-cols-2">
            <MiniField label="Name"><Input value={name} onChange={event => setName(event.target.value)} /></MiniField>
            <div className="flex items-end gap-2"><MiniField label="Looking for" className="flex-1"><Textarea value={goal} onChange={event => setGoal(event.target.value)} className="min-h-16" /></MiniField><Button type="button" variant="outline" className="h-9 rounded-lg px-3" onClick={() => suggest.mutate({ goal })} disabled={suggest.isPending} title="Map criteria"><Sparkles className="h-4 w-4" /></Button></div>
            <MiniField label="Terms"><Input value={includeTerms} onChange={event => setIncludeTerms(event.target.value)} /></MiniField>
            <MiniField label="Exclude"><Input value={excludeTerms} onChange={event => setExcludeTerms(event.target.value)} /></MiniField>
            <MiniField label="X query" className="lg:col-span-2"><Input value={xQuery} onChange={event => setXQuery(event.target.value)} className="font-mono text-[11px]" /></MiniField>
            <div className="flex items-center justify-end lg:col-span-2"><Button type="submit" disabled={create.isPending} className="h-9 rounded-lg bg-[#111214] px-4 text-xs">Start live feed</Button></div>
          </form>
        </section>}

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
          <div className="overflow-hidden rounded-2xl border border-[#e5e6e2] bg-white">
            <div className="flex items-center justify-between border-b border-[#ecece9] p-3 sm:p-4">
              <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${activeSync?.status === "healthy" ? "bg-[#4ca96f]" : "bg-[#c4c7c1]"}`} /><select className="h-8 max-w-[190px] rounded-lg border-0 bg-transparent px-1 text-sm font-bold focus:ring-0" value={activeMonitorId ?? ""} onChange={event => { setActiveMonitorId(event.target.value ? Number(event.target.value) : null); setSelectedId(null); setFocused(true); }}><option value="">All signals</option>{monitors.map(({ monitor }) => <option key={monitor.id} value={monitor.id}>{monitor.name}</option>)}</select></div>
              <div className="flex items-center gap-1"><IconButton icon={ListFilter} label="All" active={filter === "all"} onClick={() => setFilter("all")} /><IconButton icon={Lightbulb} label="Needs review" active={filter === "pending"} onClick={() => setFilter("pending")} /><IconButton icon={CircleCheck} label="Approved" active={filter === "approved"} onClick={() => setFilter("approved")} /><IconButton icon={CircleX} label="Rejected" active={filter === "rejected"} onClick={() => setFilter("rejected")} /><select aria-label="Minimum relevance" className="ml-1 h-8 rounded-lg border border-[#e1e2de] bg-[#fafaf8] px-2 text-[10px] font-semibold" value={minimumScore} onChange={event => setMinimumScore(Number(event.target.value))}><option value={0}>All</option><option value={60}>60+</option><option value={80}>80+</option></select></div>
            </div>
            <div className="divide-y divide-[#eff0ed]">
              {overview.isLoading && <div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#949790]" /></div>}
              {!overview.isLoading && !posts.length && <EmptyFeed onAdd={() => setShowCreator(true)} />}
              {posts.map(({ post, monitorName }) => <button key={post.id} onClick={() => setSelectedId(post.id)} className={`grid w-full gap-3 px-3 py-3 text-left transition sm:grid-cols-[38px_1fr_auto] sm:px-4 ${selected?.post.id === post.id ? "bg-[#f7f9f6]" : "hover:bg-[#fafbf9]"}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl text-[11px] font-bold ${scoreTone(post.ruleScore)}`}>{post.ruleScore}</span>
                <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-bold">{post.authorHandle ? `@${post.authorHandle}` : post.authorName || "Unknown"}</span><span className="text-[10px] text-[#9b9d96]">{new Date(post.postedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{post.aiIntent.label === "Active help-seeking" && <span className="rounded-full bg-[#dff5e6] px-1.5 py-0.5 text-[9px] font-bold text-[#17643c]">ASKING</span>}</div><p className="mt-1 line-clamp-2 text-sm leading-5 text-[#353733]">{post.body}</p><div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#969891]"><Zap className="h-3 w-3" />{monitorName}{post.source === "demo" && <span className="rounded-full bg-[#f6e8eb] px-1.5 py-0.5 text-[9px] text-[#8b5560]">SAMPLE</span>}</div></div>
                <span className="pt-1 text-[9px] font-semibold uppercase text-[#a0a29c]">{post.reviewStatus}</span>
              </button>)}
            </div>
          </div>
          <aside className="rounded-2xl border border-[#e5e6e2] bg-white p-4">{selected ? <OpportunityPanel item={selected} goal={activeMonitor?.goal ?? ""} onReview={decision => review.mutate({ postId: selected.post.id, decision })} pending={review.isPending} /> : <div className="grid min-h-64 place-items-center text-center"><Search className="h-5 w-5 text-[#b3b5af]" /></div>}</aside>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"><LiveChip icon={SourceIcon} value={activeSync?.status === "healthy" ? "Live" : "Paused"} label={activeSync?.latencyLabel ?? "No source"} /><LiveChip icon={Lightbulb} value={String(explicitRequests)} label="active asks" /><LiveChip icon={Workflow} value={String(monitors.length)} label="signals" /></section>
      </div>
    </DashboardLayout>
  );
}

function IconButton({ icon: Icon, label, onClick, active = false, loading = false, disabled = false }: { icon: typeof RefreshCw; label: string; onClick: () => void; active?: boolean; loading?: boolean; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`grid h-8 w-8 place-items-center rounded-lg transition ${active ? "bg-[#111214] text-white" : "text-[#767871] hover:bg-[#f1f2ef]"} disabled:opacity-40`}><Icon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>;
}

function MiniField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b8d86] ${className}`}>{label}{children}</label>;
}

function LiveChip({ icon: Icon, value, label }: { icon: typeof Zap; value: string; label: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-[#e5e6e2] bg-white px-3 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f2f4f1]"><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-xs font-bold leading-none">{value}</p><p className="mt-1 truncate text-[9px] text-[#90928b]">{label}</p></div></div>;
}

function EmptyFeed({ onAdd }: { onAdd: () => void }) {
  return <div className="grid min-h-72 place-items-center p-6 text-center"><div><Search className="mx-auto h-5 w-5 text-[#b4b6b0]" /><p className="mt-3 text-sm font-semibold">No task requests here yet.</p><Button variant="outline" className="mt-3 h-8 rounded-lg text-xs" onClick={onAdd}>Add signal</Button></div></div>;
}

function OpportunityPanel({ item, goal, onReview, pending }: { item: { post: any; monitorName: string }; goal: string; onReview: (decision: "approved" | "rejected") => void; pending: boolean }) {
  const { post, monitorName } = item;
  const engagement = Object.values(post.engagement as Record<string, number>).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  const positiveReasons = (post.scoreExplanation as Array<{ label: string; points: number }>).filter(component => component.points > 0);
  const timingReason = positiveReasons.find(component => component.label === "Timing signal");
  const shortReasons = positiveReasons.filter(component => component.label !== "Timing signal").slice(0, timingReason ? 2 : 3);
  const visibleReasons = timingReason ? [timingReason, ...shortReasons] : shortReasons;

  return <div>
    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-bold ${scoreTone(post.ruleScore)}`}>{post.ruleScore}</span><div><p className="text-xs font-bold">Opportunity</p><p className="text-[10px] text-[#969891]">{monitorName}</p></div></div><span className="text-[10px] text-[#969891]">{compactNumber(engagement)} engage</span></div>
    <div className="mt-4 rounded-xl bg-[#f5f6f3] p-3"><p className="text-xs font-bold">{post.authorHandle ? `@${post.authorHandle}` : post.authorName || "Unknown"}</p><p className="mt-2 text-sm leading-6 text-[#343633]">{post.body}</p><p className="mt-2 text-[10px] text-[#8c8f88]">{new Date(post.postedAt).toLocaleString()}</p></div>
    {goal && <div className="mt-3 flex items-center gap-2 text-[10px] text-[#73766f]"><Search className="h-3.5 w-3.5" /><span className="line-clamp-1">{goal}</span></div>}
    <div className="mt-4 flex flex-wrap gap-1.5">{visibleReasons.map(reason => <span key={reason.label} className={`rounded-full px-2 py-1 text-[9px] font-semibold ${reason.label === "Timing signal" ? "bg-[#fff1d9] text-[#9c5d09]" : "bg-[#edf5ef] text-[#39704b]"}`}>{reason.label === "Explicit help-seeking language" ? "Asked for help" : reason.label === "Timing signal" ? "Time-sensitive" : reason.label}</span>)}</div>
    <div className="mt-5 flex items-center gap-2">{post.postUrl && <a href={post.postUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border border-[#dedfda]" title="Open on X"><ArrowUpRight className="h-4 w-4" /></a>}{post.reviewStatus === "pending" ? <><Button className="h-9 flex-1 rounded-lg bg-[#187144] text-xs hover:bg-[#135f38]" onClick={() => onReview("approved")} disabled={pending}><ThumbsUp className="mr-1.5 h-3.5 w-3.5" />Keep</Button><Button variant="outline" className="h-9 rounded-lg px-3 text-[#9c443d]" onClick={() => onReview("rejected")} disabled={pending} title="Dismiss"><ThumbsDown className="h-3.5 w-3.5" /></Button></> : <span className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#f0f1ef] text-xs font-semibold text-[#666862]"><Check className="mr-1.5 h-3.5 w-3.5" />{post.reviewStatus}</span>}</div>
    <div className="mt-4 flex items-center gap-2 text-[9px] text-[#a1a39c]"><Bot className="h-3 w-3" />{post.aiIntent.label} · {Math.round(post.aiIntent.confidence * 100)}%</div>
  </div>;
}
