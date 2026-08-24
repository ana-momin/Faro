import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { filterFeedByTime, getAllQualifiedPosts, getDiscoverPreview, getQualifiedPosts, getRequestCategory, type FeedTimeFilter } from "@/lib/discoverFeed";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, Clapperboard, ClipboardCheck, Clock3, Code2, ExternalLink, Heart, Lightbulb, Loader2, Megaphone, MessageCircle, Radar, Search, Trophy, Workflow, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const overview = trpc.monitoring.overview.useQuery(undefined, { refetchInterval: 30_000 });
  const [visibleCount, setVisibleCount] = useState(10);
  const [timeFilter, setTimeFilter] = useState<FeedTimeFilter>("all");
  const active = overview.data?.monitors.find(({ monitor }) => monitor.status === "active") ?? overview.data?.monitors[0];
  const allQualified = useMemo(() => getAllQualifiedPosts(overview.data?.posts ?? []), [overview.data?.posts]);
  const filteredQualified = useMemo(() => filterFeedByTime(allQualified, timeFilter), [allQualified, timeFilter]);
  const visible = useMemo(() => getDiscoverPreview(filteredQualified, visibleCount), [filteredQualified, visibleCount]);
  const screened = useMemo(() => (overview.data?.posts ?? []).filter(item => item.monitor.id === active?.monitor.id && item.post.source !== "demo").length, [overview.data?.posts, active?.monitor.id]);

  useEffect(() => setVisibleCount(10), [active?.monitor.id, timeFilter]);

  let content: React.ReactNode;
  if (overview.isLoading) {
    content = <div className="grid min-h-80 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#b56a4e]" /></div>;
  } else if (overview.isError) {
    content = <FeedError onRetry={() => overview.refetch()} />;
  } else if (!active) {
    content = <EmptyFeed onSearch={() => setLocation("/search")} />;
  } else {
    content = <section className="mx-auto mt-6 max-w-3xl">
      <div className="border-b border-[#eadfd2] pb-3"><h2 className="text-sm font-extrabold tracking-[-0.04em] text-[#4b3123]">All posts</h2><FeedTimeFilters value={timeFilter} onChange={setTimeFilter} /></div>
      {visible.length ? <BuyerRequestFeed items={visible} hasMore={visibleCount < filteredQualified.length} onMore={() => setVisibleCount(count => count + 10)} onReview={postId => setLocation(`/review?post=${postId}`)} /> : <NoRequests screened={screened} filtered={timeFilter !== "all"} onSearch={() => setLocation("/search")} />}
    </section>;
  }

  return <div className="mx-auto max-w-3xl pb-10">
    <header className="flex items-center justify-between gap-4 border-b border-[#eadfd2] pb-5">
      <h1 className="text-xl font-extrabold tracking-[-0.06em] text-[#422d20]">Posts</h1>
      <Button onClick={() => setLocation("/search")} className="h-9 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]" aria-label="Start a new search">Search</Button>
    </header>
    {content}
  </div>;
}

function FeedTimeFilters({ value, onChange }: { value: FeedTimeFilter; onChange: (value: FeedTimeFilter) => void }) {
  const filters: Array<{ value: FeedTimeFilter; label: string }> = [{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "this_week", label: "This week" }, { value: "last_week", label: "Last week" }, { value: "this_month", label: "This month" }];
  return <div className="mt-3 flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">{filters.map(filter => <button key={filter.value} type="button" onClick={() => onChange(filter.value)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-extrabold transition ${value === filter.value ? "border-[#d49a78] bg-[#fff4e8] text-[#8b4e37]" : "border-[#eadfd2] bg-white text-[#957967] hover:bg-[#fffaf5]"}`}>{filter.label}</button>)}</div>;
}

function BuyerRequestFeed({ items, hasMore, onMore, onReview }: { items: any[]; hasMore: boolean; onMore: () => void; onReview: (postId: number) => void }) {
  return <div className="mt-4 space-y-4">{items.map(item => <RequestCard key={item.post.xPostId || item.post.id} item={item} onReview={() => onReview(item.post.id)} />)}{hasMore ? <button onClick={onMore} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#e7d4c0] bg-[#fffaf5] px-4 py-3 text-left text-[10px] font-extrabold text-[#8b503a] transition hover:bg-[#fff4e8] active:scale-[0.99]"><span>View 10 more <span className="ml-1 font-medium text-[#a98a76]">· saved posts only</span></span><ArrowRight className="h-3.5 w-3.5" /></button> : null}</div>;
}

function RequestCard({ item, onReview }: { item: any; onReview: () => void }) {
  const { post, monitorName } = item;
  const category = getRequestCategory(post);
  const author = post.authorName || post.authorHandle || "X member";
  const handle = post.authorHandle ? `@${String(post.authorHandle).replace(/^@/, "")}` : "X member";
  const initial = author.charAt(0).toUpperCase();
  const Icon = category === "Automation" ? Zap : category === "AI video" ? Clapperboard : category === "Custom AI workflow" ? Workflow : category === "Product testing" ? ClipboardCheck : category === "Contests & bounties" ? Trophy : category === "Content & social" ? Megaphone : category === "Development" ? Code2 : category === "Research & design" ? Lightbulb : Bot;
  const likes = Number(post.engagement?.like_count ?? post.engagement?.likes ?? 0);
  const replies = Number(post.engagement?.reply_count ?? post.engagement?.replies ?? 0);
  const [expanded, setExpanded] = useState(false);
  const isLong = String(post.body ?? "").length > 300;
  return <article className="overflow-hidden rounded-[28px] border border-[#eadfd2] bg-white shadow-[0_14px_32px_rgba(95,58,33,0.045)] transition hover:border-[#e0baa0]"><div className="p-4 sm:p-5"><div className="flex items-start gap-3"><Avatar className="h-11 w-11 shrink-0 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-xs font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><p className="truncate text-sm font-extrabold text-[#3d2e23]">{author}</p><span className="truncate text-[11px] text-[#a18b7a]">{handle}</span><span className="hidden text-[#c2aa97] sm:inline">·</span><span className="hidden items-center gap-1 text-[10px] font-medium text-[#a18b7a] sm:inline-flex"><Clock3 className="h-3 w-3" />{formatPostDate(post.postedAt)}</span></div><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="inline-flex items-center gap-1 rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]"><Icon className="h-3 w-3" />{category}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#e7f3e9] px-2 py-1 text-[9px] font-extrabold text-[#3f7757]"><BadgeCheck className="h-3 w-3" />{post.ruleScore} signal</span></div></div></div><p className={`mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#4e392d] sm:text-[15px] sm:leading-7 ${isLong && !expanded ? "line-clamp-6" : ""}`}>{post.body}</p>{isLong ? <button type="button" onClick={() => setExpanded(value => !value)} className="mt-2 text-[11px] font-extrabold text-[#9b573e] hover:text-[#733d2c]">{expanded ? "See less" : "See more"}</button> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e6de] bg-[#fffdfa] px-4 py-3 sm:px-5"><div className="flex items-center gap-3 text-[10px] font-bold text-[#9b8575]"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{replies || "Reply"}</span><span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{likes || "Signal"}</span></div><div className="flex items-center gap-2"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ead5c2] bg-white px-3 text-[10px] font-extrabold text-[#80503a] transition hover:bg-[#fff4e8]"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Open X</span></a><button onClick={onReview} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#b85f45] px-3 text-[10px] font-extrabold text-white transition hover:bg-[#9f4d36] active:scale-[0.97]">Review <ArrowRight className="h-3.5 w-3.5" /></button></div></div><div className="border-t border-[#f5ece5] bg-white px-4 py-2.5 text-[9px] font-medium text-[#a18b7a] sm:px-5">Matched from {monitorName || "saved Faro search"}</div></article>;
}

function formatPostDate(value: string | Date | undefined) { if (!value) return "Saved request"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Saved request" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function EmptyFeed({ onSearch }: { onSearch: () => void }) { return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#f6e6d4] text-[#a55a42]"><Radar className="h-4 w-4" /></span><h2 className="mt-3 text-base font-extrabold tracking-[-0.04em]">Ready for request posts.</h2><p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-5 text-[#9a8474]">Run one focused X search. Faro keeps only real requests for help.</p><Button onClick={onSearch} className="mt-4 h-10 rounded-xl bg-[#b85f45] text-xs font-extrabold text-white hover:bg-[#9f4d36]"><Search className="mr-2 h-3.5 w-3.5" />Search</Button></div></div>; }
function NoRequests({ screened, filtered, onSearch }: { screened: number; filtered: boolean; onSearch: () => void }) { return <div className="mt-4 grid min-h-44 place-items-center rounded-[24px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><BadgeCheck className="mx-auto h-5 w-5 text-[#6c9b7b]" /><h2 className="mt-3 text-sm font-extrabold">{filtered ? "No saved posts in this period." : "Nothing qualified yet."}</h2><p className="mx-auto mt-1.5 max-w-md text-[10px] leading-5 text-[#9a8474]">{filtered ? "Try a wider local time filter. This does not run another X search." : `Faro screened ${screened} stored public posts for this search. Service offers and topic chatter were filtered as noise, not lost.`}</p>{filtered ? null : <button onClick={onSearch} className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#99523c] hover:text-[#713c2b]">Refine search <ArrowRight className="h-3 w-3" /></button>}</div></div>; }
function FeedError({ onRetry }: { onRetry: () => void }) { return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-[#efd4c7] bg-[#fff7f1] px-6 text-center"><div><Radar className="mx-auto h-5 w-5 text-[#b8654a]" /><h2 className="mt-3 text-base font-extrabold">Feed needs a refresh.</h2><p className="mt-1.5 text-[10px] text-[#9a8474]">Saved requests are safe. This does not start another source search.</p><Button onClick={onRetry} variant="outline" className="mt-4 h-9 rounded-xl border-[#e2bfae] bg-white text-xs font-extrabold text-[#98513a] hover:bg-[#fffaf7]">Retry loading</Button></div></div>; }
