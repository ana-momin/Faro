import { useAuth } from "@/_core/hooks/useAuth";
import XPostCard from "@/components/XPostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildReviewDialogContent, personalizedGreeting } from "@/lib/discoverAgent";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, Bot, CheckCircle2, CircleAlert, Compass, ExternalLink, Loader2, Radar, RefreshCw, Search, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const DEFAULT_BRIEF = "Find founders and operators who need a provider to build custom AI workflows, automate operations, or produce practical AI video.";

export default function Home() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [searchStep, setSearchStep] = useState<1 | 2 | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const overview = trpc.monitoring.overview.useQuery(undefined, { refetchInterval: 30_000 });
  const agent = trpc.monitoring.agentStart.useMutation({
    onSuccess: result => {
      utils.monitoring.overview.invalidate();
      if (result.syncError) toast.error(result.sourceLabel);
      else toast.success(result.sync?.inserted ? `${result.sync.inserted} live posts checked.` : "Live X source checked — no new posts found.");
    },
    onError: error => toast.error(error.message),
  });
  const review = trpc.monitoring.review.useMutation({
    onSuccess: () => { utils.monitoring.overview.invalidate(); toast.success("Saved to your review queue."); },
    onError: error => toast.error(error.message),
  });
  const sync = trpc.monitoring.sync.useMutation({
    onSuccess: result => { utils.monitoring.overview.invalidate(); toast.success(`${result.inserted} new posts checked.`); },
    onError: error => { utils.monitoring.overview.invalidate(); toast.error(error.message); },
  });

  useEffect(() => {
    if (!agent.isPending) {
      setSearchStep(null);
      return;
    }
    setSearchStep(1);
    const sourceTimer = window.setTimeout(() => setSearchStep(2), 650);
    return () => window.clearTimeout(sourceTimer);
  }, [agent.isPending]);

  const activeBrief = overview.data?.monitors.find(({ monitor }) => monitor.status === "active") ?? overview.data?.monitors[0];
  const allQualified = useMemo(() => (overview.data?.posts ?? []).filter(({ post }) => post.source !== "demo" && post.ruleScore >= 55), [overview.data?.posts]);
  const activeQualified = useMemo(() => allQualified.filter(({ monitor }) => !activeBrief || monitor.id === activeBrief.monitor.id), [allQualified, activeBrief]);
  const qualified = activeQualified.length ? activeQualified : allQualified;
  const greeting = personalizedGreeting(user?.name);

  function runAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    agent.mutate({ brief });
  }

  return <DashboardLayout>
    <div className="mx-auto max-w-6xl pb-8">
      <header className="flex items-center justify-between border-b border-[#eadfd2] pb-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1d7b9] text-[#8f4e38]"><Compass className="h-4 w-4" /></span><div><p className="text-[11px] font-bold text-[#a25d47]">{greeting}</p><h1 className="mt-0.5 text-xl font-extrabold tracking-[-0.055em]">Discover requests</h1></div></div>
        <button onClick={() => activeBrief && sync.mutate({ monitorId: activeBrief.monitor.id })} disabled={!activeBrief || sync.isPending} className="grid h-9 w-9 place-items-center rounded-xl border border-[#e8dacc] bg-white text-[#765d4a] transition hover:bg-[#fff8ef] disabled:opacity-40" title="Check live source"><RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} /></button>
      </header>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-[#ead9c4] bg-[#fbf2e5] p-5 text-[#38291f] shadow-[0_16px_35px_rgba(105,68,38,0.06)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a25d47]"><span className="h-1.5 w-1.5 rounded-full bg-[#be694d]" />Faro Agent</div><h2 className="mt-2 max-w-xl text-2xl font-extrabold tracking-[-0.055em] sm:text-3xl">Describe the client you want to find.</h2></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f4dfc4] text-[#a5533c]"><Radar className="h-5 w-5" /></span></div>
        <form onSubmit={runAgent} className="mt-6"><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-24 resize-none border-[#e3cdb1] bg-white text-sm leading-6 text-[#3b2d23] placeholder:text-[#b79a80] focus-visible:ring-[#bd674c]" placeholder="Who should Faro find?" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="hidden text-[10px] font-semibold text-[#9b765f] sm:block">One brief. One focused live search.</p><Button type="submit" disabled={agent.isPending || brief.trim().length < 12} className="h-12 rounded-2xl bg-[#b85f45] px-5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.22)] transition hover:-translate-y-0.5 hover:bg-[#9f4d36] hover:shadow-[0_12px_22px_rgba(157,76,53,0.28)] disabled:transform-none">{agent.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching X</> : <><Sparkles className="mr-2 h-4 w-4" />Run Faro<ArrowRight className="ml-2 h-4 w-4" /></>}</Button></div></form>
        {searchStep && <SearchProgress step={searchStep} />}
        {agent.data && !agent.isPending && <AgentOutcome result={agent.data} />}
      </section>

      <section className="mt-7"><div><p className="text-sm font-extrabold tracking-[-0.03em]">Qualified requests</p><p className="mt-1 text-[10px] text-[#9a8a7b]">Open a post for the full context and Faro AI’s read.</p></div>
        {overview.isLoading ? <div className="mt-4 grid min-h-40 place-items-center rounded-2xl border border-[#eadfd2] bg-white"><Loader2 className="h-5 w-5 animate-spin text-[#b6a697]" /></div> : qualified.length ? <div className="mt-4 grid gap-3 xl:grid-cols-2">{qualified.map(({ post }) => <XPostCard key={post.id} post={post} pending={review.isPending} onSelect={() => setSelectedPost(post)} onReview={decision => review.mutate({ postId: post.id, decision })} />)}</div> : <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[#eadfd2] bg-[#fffdfa] px-5 text-center"><Search className="h-5 w-5 text-[#b7a799]" /><p className="mt-3 text-sm font-bold">No qualified requests yet.</p><p className="mt-1 max-w-md text-[10px] text-[#9d8e80]">{activeBrief?.sync?.status === "payment_required" ? "Your live X provider needs account credit before Faro can fetch fresh posts." : "Check the live source for fresh provider requests. Topic chatter stays out."}</p></div>}</section>

    </div>
    <PostReviewDialog post={selectedPost} pending={review.isPending} onClose={() => setSelectedPost(null)} onReview={decision => selectedPost && review.mutate({ postId: selectedPost.id, decision })} />
  </DashboardLayout>;
}

function PostReviewDialog({ post, pending, onClose, onReview }: { post: any; pending: boolean; onClose: () => void; onReview: (decision: "approved" | "rejected") => void }) {
  const dialogContent = post ? buildReviewDialogContent(post) : null;
  const agentRead = dialogContent?.agentRead;
  const initial = dialogContent?.authorLabel.trim().charAt(0).toUpperCase() || "F";
  return <Dialog open={Boolean(post)} onOpenChange={open => !open && onClose()}><DialogContent className="max-w-[calc(100%-1rem)] gap-0 overflow-hidden rounded-[26px] border-[#ead9c4] bg-[#fffdfa] p-0 shadow-[0_32px_90px_rgba(68,39,22,0.24)] sm:max-w-[calc(100%-3rem)] sm:rounded-[32px] lg:max-w-[1180px]" showCloseButton><div className="grid max-h-[calc(100vh-1rem)] overflow-y-auto overscroll-contain scrollbar-none lg:grid-cols-[minmax(0,1.35fr)_380px]"><section className="min-w-0 p-5 sm:p-8 lg:p-10"><DialogHeader><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#a25d47]">Qualified public request · score {post?.ruleScore}</p><DialogTitle className="mt-2 text-2xl font-extrabold tracking-[-0.055em] text-[#3b281e] sm:text-3xl">Review the full signal</DialogTitle><DialogDescription className="mt-2 max-w-xl text-xs leading-5 text-[#907b6b]">Read the original context, then decide whether it deserves a place in your human review queue.</DialogDescription></DialogHeader><div className="mt-8 flex items-center gap-3 border-y border-[#eee0d4] py-4"><Avatar className="h-12 w-12"><AvatarImage src={post?.authorAvatarUrl || undefined} alt="" /><AvatarFallback className="bg-[#f8e4c8] font-bold text-[#9c573f]">{initial}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-extrabold">{dialogContent?.authorLabel}</p><p className="mt-0.5 truncate text-[11px] text-[#9a8a7b]">{dialogContent?.handleLabel}</p></div><span className="ml-auto shrink-0 rounded-full bg-[#e7f3e9] px-2.5 py-1 text-[10px] font-extrabold text-[#3f7757]">{post?.ruleScore}</span></div><article className="mt-7 whitespace-pre-wrap text-[16px] leading-8 text-[#3b2d23] sm:text-[17px]">{dialogContent?.fullPost}</article><div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#9a8a7b]"><span>{post && new Date(post.postedAt).toLocaleString()}</span><a href={post?.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="inline-flex items-center font-bold text-[#8e4d38] hover:text-[#6f3828]"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open original in X</a></div><div className="mt-8 flex flex-wrap gap-2 border-t border-[#eee0d4] pt-6">{post?.reviewStatus === "pending" ? <><Button disabled={pending} onClick={() => onReview("approved")} className="h-12 rounded-2xl bg-[#b85f45] px-5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]"><ThumbsUp className="mr-2 h-4 w-4" />Keep this request</Button><Button disabled={pending} onClick={() => onReview("rejected")} variant="outline" className="h-12 rounded-2xl border-[#eed5cc] px-5 text-xs font-bold text-[#a14941] hover:bg-[#fff4f0]"><ThumbsDown className="mr-2 h-4 w-4" />Dismiss</Button></> : <span className="inline-flex h-12 items-center rounded-2xl bg-[#f1e2d0] px-5 text-xs font-bold text-[#8f4e38]">Already {post?.reviewStatus}</span>}</div></section><aside className="relative overflow-hidden border-t border-[#eadfd2] bg-[#38261d] p-5 text-white sm:p-8 lg:border-l lg:border-t-0 lg:p-9"><div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#cb7252]/25 blur-3xl" /><div className="relative"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#f2bc9c]"><Bot className="h-3.5 w-3.5" />Faro AI read</div><p className="mt-5 text-2xl font-extrabold tracking-[-0.05em] text-white">{agentRead?.confidence}</p><p className="mt-3 text-sm leading-6 text-white/70">{agentRead?.summary}</p><div className="mt-8"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/45">Evidence Faro used</p><div className="mt-3 space-y-2">{agentRead?.evidence.map(reason => <div key={reason.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 backdrop-blur"><span className="text-[11px] font-semibold text-white/82">{reason.label}</span><span className="rounded-full bg-[#f3c29f] px-2 py-0.5 text-[10px] font-extrabold text-[#543020]">+{reason.points}</span></div>)}</div></div><div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#f2bc9c]">Human-only boundary</p><p className="mt-2 text-[11px] leading-5 text-white/62">Faro AI surfaces context. It never replies, messages, follows, or reaches out for you.</p></div></div></aside></div></DialogContent></Dialog>;
}

function SearchProgress({ step }: { step: 1 | 2 }) {
  const scanning = step === 2;
  return <div className="mt-5 rounded-2xl border border-[#ead9c4] bg-white/70 p-3.5"><div className="flex items-center justify-between text-[10px] font-bold text-[#8b604a]"><span>{scanning ? "Scanning live X and qualifying requests" : "Preparing your search brief"}</span><span className="flex items-center gap-1.5 text-[#b15d44]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />{scanning ? "Live" : "Starting"}</span></div><div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#f2dfc8]"><div className={`h-full rounded-full bg-[#b85f45] transition-all duration-700 ease-out ${scanning ? "w-full animate-pulse" : "w-[42%]"}`} /></div><p className="mt-2 text-[10px] text-[#9c7b65]">This stays active until the live source returns.</p></div>;
}

function AgentOutcome({ result }: { result: { syncError: string | null; sourceStatus: string; sourceLabel?: string; sync: { inserted: number } | null } }) {
  const failed = Boolean(result.syncError);
  const message = failed
    ? result.sourceStatus === "payment_required" ? "Live X source needs account credit before Faro can fetch posts." : `${result.sourceLabel}. Faro saved the brief, but could not complete a live source check.`
    : result.sync?.inserted ? `${result.sync.inserted} live posts were checked. Qualified requests appear below.` : "Live X source checked. No new public posts matched this brief yet.";
  return <div className={`mt-5 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[11px] font-semibold ${failed ? "bg-[#fff0e9] text-[#a55136]" : "bg-[#eaf4e9] text-[#2f7147]"}`}>{failed ? <CircleAlert className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}{message}</div>;
}
