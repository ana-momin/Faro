import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Bot, Compass, Loader2, Radar, Search, Sparkles, Target, Zap } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const DEFAULT_BRIEF = "Find founders and operators who need a provider to build custom AI workflows, automate operations, or produce practical AI video.";

const scoreTone = (score: number) => score >= 80 ? "bg-[#dff5e6] text-[#17643c]" : "bg-[#f2f3f0] text-[#30322e]";

export default function Home() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const overview = trpc.monitoring.overview.useQuery(undefined, { refetchInterval: 30_000 });
  const agent = trpc.monitoring.agentStart.useMutation({
    onSuccess: result => {
      utils.monitoring.overview.invalidate();
      toast.success(result.syncError ? "Faro mapped and saved the brief." : "Faro mapped the brief and checked X.");
    },
    onError: error => toast.error(error.message),
  });

  const activeBrief = overview.data?.monitors.find(({ monitor }) => monitor.status === "active") ?? overview.data?.monitors[0];
  const qualified = useMemo(() => (overview.data?.posts ?? []).filter(({ post, monitor }) => post.source !== "demo" && (!activeBrief || monitor.id === activeBrief.monitor.id) && post.ruleScore >= 60).slice(0, 4), [overview.data?.posts, activeBrief]);
  const monitored = activeBrief ? 1 : 0;

  function runAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    agent.mutate({ brief });
  }

  return <DashboardLayout>
    <div className="mx-auto max-w-6xl pb-8">
      <header className="flex items-center justify-between border-b border-[#e8e9e5] pb-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#111214] text-white"><Compass className="h-4 w-4" /></span><div><h1 className="text-xl font-extrabold tracking-[-0.055em]">Discover</h1><p className="text-[11px] text-[#858780]">Service demand on X, sorted for human review.</p></div></div>
        <button onClick={() => setLocation("/review")} className="grid h-9 w-9 place-items-center rounded-xl border border-[#e3e4df] text-[#4e514b] transition hover:bg-white" title="Open review queue"><ArrowUpRight className="h-4 w-4" /></button>
      </header>

      <section className="mt-6 overflow-hidden rounded-[28px] bg-[#171916] p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8dfb8]"><span className="h-1.5 w-1.5 rounded-full bg-[#67c886]" />Faro Agent</div><h2 className="mt-2 max-w-xl text-2xl font-extrabold tracking-[-0.055em] sm:text-3xl">Describe the client you want to find.</h2></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#b7efc6]"><Radar className="h-5 w-5" /></span></div>
        <form onSubmit={runAgent} className="mt-6"><Textarea value={brief} onChange={event => setBrief(event.target.value)} className="min-h-24 resize-none border-white/10 bg-white/8 text-sm leading-6 text-white placeholder:text-white/40 focus-visible:ring-[#78cf94]" placeholder="Who should Faro find?" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-4 text-[10px] text-white/55"><AgentStep icon={Target} label="Maps intent" /><AgentStep icon={Search} label="Checks X" /><AgentStep icon={Zap} label="Filters noise" /></div><Button type="submit" disabled={agent.isPending || brief.trim().length < 12} className="h-10 rounded-xl bg-[#dff5e6] px-4 text-xs font-bold text-[#174c2c] hover:bg-white">{agent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Run Faro</>}</Button></div></form>
        {agent.data && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[10px] text-white/70"><Bot className="h-3.5 w-3.5 text-[#9ee2ae]" />{agent.data.syncError ? "Brief saved — source sync needs attention." : "Brief mapped, source checked, results ready for review."}</div>}
      </section>

      <section className="mt-7"><div className="flex items-center justify-between"><div><p className="text-sm font-extrabold tracking-[-0.03em]">Qualified now</p><p className="mt-1 text-[10px] text-[#8d8f88]">Requests with an actual service need.</p></div><button onClick={() => setLocation("/review")} className="text-[11px] font-bold text-[#277449]">Review queue</button></div>
        {overview.isLoading ? <div className="mt-4 grid min-h-40 place-items-center rounded-2xl border border-[#e7e8e4] bg-white"><Loader2 className="h-5 w-5 animate-spin text-[#9ca097]" /></div> : qualified.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{qualified.map(({ post, monitorName }) => <button key={post.id} onClick={() => setLocation("/review")} className="flex items-start gap-3 rounded-2xl border border-[#e7e8e4] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b7d9bf] hover:shadow-[0_12px_24px_rgba(27,33,27,0.05)]"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${scoreTone(post.ruleScore)}`}>{post.ruleScore}</span><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-bold">{post.authorHandle ? `@${post.authorHandle}` : post.authorName || "Unknown"}</span><span className="text-[9px] text-[#999b95]">{monitorName}</span></div><p className="mt-1 line-clamp-2 text-sm leading-5 text-[#343633]">{post.body}</p></div></button>)}</div> : <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfe1dc] bg-white px-5 text-center"><Search className="h-5 w-5 text-[#a9aca5]" /><p className="mt-3 text-sm font-bold">Nothing worth your time yet.</p><p className="mt-1 text-[10px] text-[#969890]">Faro keeps topical chatter out.</p></div>}</section>

      <section className="mt-5 grid grid-cols-3 gap-2 sm:gap-3"><Metric icon={Radar} value={String(monitored)} label="active briefs" /><Metric icon={Target} value={String(qualified.length)} label="qualified now" /><Metric icon={Bot} value="On demand" label="agent runs" /></section>
    </div>
  </DashboardLayout>;
}

function AgentStep({ icon: Icon, label }: { icon: typeof Target; label: string }) {
  return <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-[#a8dfb8]" />{label}</span>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Radar; value: string; label: string }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-[#e7e8e4] bg-white px-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f1f3ef]"><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="truncate text-xs font-bold leading-none">{value}</p><p className="mt-1 truncate text-[9px] text-[#8d8f88]">{label}</p></div></div>;
}
