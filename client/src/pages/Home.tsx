import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getDiscoverPreview, getQualifiedPosts, getRequestCategory } from "@/lib/discoverFeed";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Compass, ExternalLink, Loader2, Radar, Search, Sparkles } from "lucide-react";
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
  const isShowingSavedFallback = Boolean(active && !activeQualified.length && qualified.length);
  const visible = useMemo(() => getDiscoverPreview(qualified, visibleCount), [qualified, visibleCount]);
  const screened = useMemo(() => (overview.data?.posts ?? []).filter(item => item.monitor.id === active?.monitor.id && item.post.source !== "demo").length, [overview.data?.posts, active?.monitor.id]);
  useEffect(() => setVisibleCount(10), [active?.monitor.id]);

  let content: React.ReactNode;
  if (overview.isLoading) {
    content = <div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#b1856d]" /></div>;
  } else if (overview.isError) {
    content = <DiscoverError onRetry={() => overview.refetch()} />;
  } else if (!active) {
    content = <EmptyDiscover onSearch={() => setLocation("/search")} />;
  } else {
    content = <>
      <section className="mt-6 overflow-hidden rounded-[26px] border border-[#ead9c4] bg-[#fbf2e5] p-5 shadow-[0_12px_28px_rgba(99,59,31,0.05)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Current signal</p>
            <h2 className="mt-2 max-w-3xl text-lg font-extrabold leading-snug tracking-[-0.04em] text-[#442d20]">{active.monitor.goal}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {active.monitor.includeTerms.slice(0, 5).map(term => <span key={term} className="rounded-full border border-[#e5cdb7] bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#86624e]">{term}</span>)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/75 px-3 py-2 text-right">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#a28a77]">Source</p>
            <p className="mt-1 text-[10px] font-bold text-[#5c7e66]">{active.sync?.latencyLabel || "Ready"}</p>
          </div>
        </div>
      </section>
      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold tracking-[-0.03em]">Highlighted buyer requests</p>
            <p className="mt-1 text-[10px] text-[#9a8a7b]">{isShowingSavedFallback ? `Showing the best ${Math.min(10, qualified.length)} saved buyer requests while this newest search has no match yet.` : `Top ${Math.min(10, qualified.length)} of ${qualified.length} qualified matches. People offering services are excluded.`}</p>
          </div>
          <button onClick={() => setLocation("/review")} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#98523c] hover:text-[#713c2b]">Open full review <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        {visible.length ? <BuyerRequestList items={visible} hasMore={visibleCount < qualified.length} onMore={() => setVisibleCount(count => count + 10)} onOpen={postId => setLocation(`/review?post=${postId}`)} /> : <NoRequests screened={screened} onSearch={() => setLocation("/search")} />}
      </section>
    </>;
  }

  return <DashboardLayout><div className="mx-auto max-w-6xl pb-10">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eadfd2] pb-6">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f1d7b9] text-[#8f4e38]"><Compass className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Live buyer demand</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.06em]">Top matching requests</h1></div></div>
      <Button onClick={() => setLocation("/search")} className="h-10 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]"><Search className="mr-2 h-3.5 w-3.5" />New search</Button>
    </header>
    {content}
  </div></DashboardLayout>;
}

function BuyerRequestList({ items, hasMore, onMore, onOpen }: { items: any[]; hasMore: boolean; onMore: () => void; onOpen: (postId: number) => void }) {
  return <div className="mt-4 overflow-hidden rounded-[24px] border border-[#eadfd2] bg-white">
    <div className="hidden grid-cols-[minmax(0,1fr)_130px_60px_28px] gap-4 border-b border-[#f1e5db] bg-[#fffaf5] px-5 py-3 text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#a28a78] sm:grid"><span>Buyer request</span><span>Service category</span><span>Signal</span><span /></div>
    {items.map(item => <RequestRow key={item.post.id} item={item} onOpen={() => onOpen(item.post.id)} />)}
    {hasMore ? <button onClick={onMore} className="flex w-full items-center justify-between border-t border-[#f1e5db] bg-[#fffaf5] px-5 py-3.5 text-left text-[11px] font-extrabold text-[#8b503a] hover:bg-[#fff4e8]"><span>Show 10 more saved matches <span className="ml-1 font-medium text-[#a98a76]">· no new source check</span></span><ArrowRight className="h-3.5 w-3.5" /></button> : null}
  </div>;
}

function RequestRow({ item, onOpen }: { item: any; onOpen: () => void }) {
  const { post, monitorName } = item;
  const category = getRequestCategory(post);
  const author = post.authorName || post.authorHandle || "X member";
  return <button onClick={onOpen} className="grid w-full gap-2 border-b border-[#f4ece5] px-4 py-4 text-left transition hover:bg-[#fffaf5] sm:grid-cols-[minmax(0,1fr)_130px_60px_28px] sm:items-center sm:gap-4 sm:px-5"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-extrabold text-[#3d2e23]">{author}</p><span className="hidden truncate text-[10px] text-[#a18b7a] sm:inline">{monitorName}</span></div><p className="mt-1.5 max-h-10 overflow-hidden text-[11px] leading-5 text-[#725e50]">{post.body}</p></div><span className="w-fit rounded-full bg-[#f9eadc] px-2.5 py-1 text-[10px] font-extrabold text-[#9d563e]">{category}</span><span className="w-fit rounded-full bg-[#e7f3e9] px-2.5 py-1 text-[10px] font-extrabold text-[#3f7757]">{post.ruleScore}</span><ExternalLink className="hidden h-3.5 w-3.5 text-[#a06b55] sm:block" /></button>;
}

function EmptyDiscover({ onSearch }: { onSearch: () => void }) { return <div className="mt-8 grid min-h-72 place-items-center rounded-[28px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f6e6d4] text-[#a55a42]"><Radar className="h-5 w-5" /></span><h2 className="mt-4 text-xl font-extrabold tracking-[-0.05em]">Your buyer-request desk is ready.</h2><p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-[#9a8474]">Run an AI brief or a targeted keyword search. Faro will keep only people who are asking for help.</p><Button onClick={onSearch} className="mt-5 h-10 rounded-xl bg-[#b85f45] text-xs font-extrabold text-white hover:bg-[#9f4d36]"><Sparkles className="mr-2 h-3.5 w-3.5" />Start a search</Button></div></div>; }
function NoRequests({ screened, onSearch }: { screened: number; onSearch: () => void }) { return <div className="mt-4 grid min-h-48 place-items-center rounded-[24px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><BadgeCheck className="mx-auto h-5 w-5 text-[#6c9b7b]" /><h2 className="mt-3 text-sm font-extrabold">No buyer request qualified from this check.</h2><p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-[#9a8474]">Faro screened {screened} stored public posts for this search. Service offers and topic chatter were filtered as noise, not lost.</p><button onClick={onSearch} className="mt-3 text-[11px] font-extrabold text-[#99523c] hover:text-[#713c2b]">Refine in Search <ArrowRight className="ml-1 inline h-3 w-3" /></button></div></div>; }
function DiscoverError({ onRetry }: { onRetry: () => void }) { return <div className="mt-8 grid min-h-72 place-items-center rounded-[28px] border border-[#efd4c7] bg-[#fff7f1] px-6 text-center"><div><h2 className="text-lg font-extrabold">Discover needs a quick refresh.</h2><p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-[#9a8474]">Saved buyer requests could not load right now. This does not start another source search.</p><Button onClick={onRetry} variant="outline" className="mt-5 h-10 rounded-xl border-[#e2bfae] bg-white text-xs font-extrabold text-[#98513a] hover:bg-[#fffaf7]">Retry loading</Button></div></div>; }
