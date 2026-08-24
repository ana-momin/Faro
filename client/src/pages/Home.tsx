import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllQualifiedPosts, getDiscoverPreview, getQualifiedPosts, getRequestCategory } from "@/lib/discoverFeed";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, ChevronRight, Clapperboard, ClipboardCheck, Code2, Compass, Lightbulb, Loader2, Megaphone, Radar, Search, Sparkles, Trophy, Workflow, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const overview = trpc.monitoring.overview.useQuery(undefined, { refetchInterval: 30_000 });
  const [visibleCount, setVisibleCount] = useState(10);
  const active = overview.data?.monitors.find(({ monitor }) => monitor.status === "active") ?? overview.data?.monitors[0];
  const activeQualified = useMemo(
    () => getQualifiedPosts(overview.data?.posts ?? [], active?.monitor.id, false),
    [overview.data?.posts, active?.monitor.id],
  );
  const qualified = useMemo(
    () => getQualifiedPosts(overview.data?.posts ?? [], active?.monitor.id, true),
    [overview.data?.posts, active?.monitor.id],
  );
  const allQualified = useMemo(() => getAllQualifiedPosts(overview.data?.posts ?? []), [overview.data?.posts]);
  const visible = useMemo(() => getDiscoverPreview(allQualified, visibleCount), [allQualified, visibleCount]);
  const isShowingSavedFallback = Boolean(active && !activeQualified.length && allQualified.length);
  const screened = useMemo(
    () => (overview.data?.posts ?? []).filter(item => item.monitor.id === active?.monitor.id && item.post.source !== "demo").length,
    [overview.data?.posts, active?.monitor.id],
  );

  useEffect(() => setVisibleCount(10), [active?.monitor.id]);

  let content: React.ReactNode;
  if (overview.isLoading) {
    content = <div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#b56a4e]" /></div>;
  } else if (overview.isError) {
    content = <DiscoverError onRetry={() => overview.refetch()} />;
  } else if (!active) {
    content = <EmptyDiscover onSearch={() => setLocation("/search")} />;
  } else {
    content = <>
      <section className="mt-5 rounded-[26px] border border-[#ead9c4] bg-[#fbf2e5] p-4 shadow-[0_14px_32px_rgba(99,59,31,0.05)] sm:p-5">
        <div className="flex items-start gap-3 sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f1d7b9] text-[#98533b]"><Radar className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#a45c45]">Latest brief</p><h2 className="mt-1 line-clamp-2 text-sm font-extrabold leading-5 tracking-[-0.03em] text-[#472f21] sm:text-base">{active.monitor.goal}</h2></div>
          <span title="Saved source status" className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-[#e7d2bb] bg-white/75 px-2.5 py-2 text-[9px] font-bold text-[#63806a] sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-[#62a075]" />{active.sync?.latencyLabel || "Ready"}</span>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f8e8d6] text-[#a05940]"><Sparkles className="h-3.5 w-3.5" /></span><div><h2 className="text-sm font-extrabold tracking-[-0.035em]">Request feed</h2><p className="mt-0.5 text-[10px] font-medium text-[#9d8574]">{isShowingSavedFallback ? "All qualifying saved requests" : "Buyer-only service requests"}</p></div></div>
          <button onClick={() => setLocation("/review")} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ead9c4] bg-white px-3 text-[10px] font-extrabold text-[#914e39] transition hover:bg-[#fff6ee] active:scale-[0.97]" aria-label="Open full review"><span className="hidden sm:inline">Review</span><ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        {visible.length ? <BuyerRequestList items={visible} hasMore={visibleCount < allQualified.length} onMore={() => setVisibleCount(count => count + 10)} onOpen={postId => setLocation(`/review?post=${postId}`)} /> : <NoRequests screened={screened} onSearch={() => setLocation("/search")} />}
      </section>
    </>;
  }

  return <div className="mx-auto max-w-5xl pb-10">
    <header className="flex items-center justify-between gap-4 border-b border-[#eadfd2] pb-5">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1d7b9] text-[#8f4e38]"><Compass className="h-[18px] w-[18px]" /></span><div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Feed</p><h1 className="mt-0.5 text-xl font-extrabold tracking-[-0.06em]">Buyer requests</h1></div></div>
      <Button onClick={() => setLocation("/search")} className="h-10 rounded-xl bg-[#b85f45] px-3 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]" aria-label="Start a new search"><Search className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Search</span></Button>
    </header>
    {content}
  </div>;
}

function BuyerRequestList({ items, hasMore, onMore, onOpen }: { items: any[]; hasMore: boolean; onMore: () => void; onOpen: (postId: number) => void }) {
  return <div className="mt-4 space-y-2">{items.map(item => <RequestCard key={item.post.id} item={item} onOpen={() => onOpen(item.post.id)} />)}{hasMore ? <button onClick={onMore} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#e7d4c0] bg-[#fffaf5] px-4 py-3 text-left text-[10px] font-extrabold text-[#8b503a] transition hover:bg-[#fff4e8] active:scale-[0.99]"><span>Show 10 more saved matches <span className="ml-1 font-medium text-[#a98a76]">· no new source check</span></span><ArrowRight className="h-3.5 w-3.5" /></button> : null}</div>;
}

function RequestCard({ item, onOpen }: { item: any; onOpen: () => void }) {
  const { post } = item;
  const category = getRequestCategory(post);
  const author = post.authorName || post.authorHandle || "X member";
  const initial = author.charAt(0).toUpperCase();
  const Icon = category === "Automation" ? Zap : category === "AI video" ? Clapperboard : category === "Custom AI workflow" ? Workflow : category === "Product testing" ? ClipboardCheck : category === "Contests & bounties" ? Trophy : category === "Content & social" ? Megaphone : category === "Development" ? Code2 : category === "Research & design" ? Lightbulb : Bot;
  return <button onClick={onOpen} className="group flex w-full items-start gap-3 rounded-[22px] border border-[#eadfd2] bg-white p-3.5 text-left shadow-[0_8px_20px_rgba(95,58,33,0.035)] transition hover:-translate-y-0.5 hover:border-[#dfb999] hover:bg-[#fffdfb] active:scale-[0.995] sm:p-4"><Avatar className="h-10 w-10 shrink-0 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-[11px] font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-extrabold text-[#3d2e23]">{author}</p>{post.authorHandle ? <span className="hidden truncate text-[10px] text-[#ab9382] sm:inline">@{String(post.authorHandle).replace(/^@/, "")}</span> : null}<span className="rounded-full bg-[#e7f3e9] px-1.5 py-0.5 text-[9px] font-extrabold text-[#3f7757]">{post.ruleScore}</span></div><p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[#745f50] sm:text-[12px]">{post.body}</p><span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]"><Icon className="h-3 w-3" />{category}</span></div><ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[#b38e78] transition group-hover:translate-x-0.5 group-hover:text-[#935139]" /></button>;
}

function EmptyDiscover({ onSearch }: { onSearch: () => void }) { return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#f6e6d4] text-[#a55a42]"><Radar className="h-4 w-4" /></span><h2 className="mt-3 text-base font-extrabold tracking-[-0.04em]">Ready to find buyers.</h2><p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-5 text-[#9a8474]">Run one focused X search. Faro keeps only real requests for help.</p><Button onClick={onSearch} className="mt-4 h-10 rounded-xl bg-[#b85f45] text-xs font-extrabold text-white hover:bg-[#9f4d36]"><Search className="mr-2 h-3.5 w-3.5" />Search</Button></div></div>; }
function NoRequests({ screened, onSearch }: { screened: number; onSearch: () => void }) { return <div className="mt-4 grid min-h-44 place-items-center rounded-[24px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><BadgeCheck className="mx-auto h-5 w-5 text-[#6c9b7b]" /><h2 className="mt-3 text-sm font-extrabold">Nothing qualified yet.</h2><p className="mx-auto mt-1.5 max-w-md text-[10px] leading-5 text-[#9a8474]">Faro screened {screened} stored public posts for this search. Service offers and topic chatter were filtered as noise, not lost.</p><button onClick={onSearch} className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#99523c] hover:text-[#713c2b]">Refine search <ArrowRight className="h-3 w-3" /></button></div></div>; }
function DiscoverError({ onRetry }: { onRetry: () => void }) { return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-[#efd4c7] bg-[#fff7f1] px-6 text-center"><div><Radar className="mx-auto h-5 w-5 text-[#b8654a]" /><h2 className="mt-3 text-base font-extrabold">Feed needs a refresh.</h2><p className="mt-1.5 text-[10px] text-[#9a8474]">Saved requests are safe. This does not start another source search.</p><Button onClick={onRetry} variant="outline" className="mt-4 h-9 rounded-xl border-[#e2bfae] bg-white text-xs font-extrabold text-[#98513a] hover:bg-[#fffaf7]">Retry loading</Button></div></div>; }
