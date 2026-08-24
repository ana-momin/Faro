import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { filterFeedByTime, getAllQualifiedPosts, getDiscoverPreview, getRequestCategory, type FeedTimeFilter } from "@/lib/discoverFeed";
import { buildReviewDialogContent } from "@/lib/discoverAgent";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, Check, ChevronDown, Clapperboard, ClipboardCheck, Clock3, Code2, ExternalLink, Heart, Lightbulb, Loader2, Megaphone, MessageCircle, Radar, Search, ThumbsDown, ThumbsUp, Trophy, Workflow, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const overview = trpc.monitoring.overview.useQuery(undefined, { refetchInterval: 30_000 });
  const [visibleCount, setVisibleCount] = useState(10);
  const [timeFilter, setTimeFilter] = useState<FeedTimeFilter>("all");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const review = trpc.monitoring.review.useMutation({
    onSuccess: async () => { await utils.monitoring.overview.invalidate(); toast.success("Decision saved."); },
    onError: error => toast.error(error.message),
  });
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
    content = <section className="mt-6 max-w-4xl">
      <div className="border-b border-[#eadfd2] pb-3"><h2 className="text-sm font-extrabold tracking-[-0.04em] text-[#4b3123]">All posts</h2><FeedTimeFilters value={timeFilter} onChange={setTimeFilter} /></div>
      {visible.length ? <BuyerRequestFeed items={visible} hasMore={visibleCount < filteredQualified.length} onMore={() => setVisibleCount(count => count + 10)} onOpen={setSelectedItem} /> : <NoRequests screened={screened} filtered={timeFilter !== "all"} onSearch={() => setLocation("/search")} />}
    </section>;
  }

  return <div className="max-w-4xl pb-10">
    <header className="flex items-center justify-between gap-4 border-b border-[#eadfd2] pb-5"><h1 className="text-xl font-extrabold tracking-[-0.06em] text-[#422d20]">Posts</h1><Button onClick={() => setLocation("/search")} className="h-9 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]" aria-label="Start a new search">Search</Button></header>
    {content}
    <PostDetailDialog item={selectedItem} open={Boolean(selectedItem)} pending={review.isPending} onOpenChange={open => { if (!open) setSelectedItem(null); }} onReview={decision => selectedItem && review.mutate({ postId: selectedItem.post.id, decision })} />
  </div>;
}

function FeedTimeFilters({ value, onChange }: { value: FeedTimeFilter; onChange: (value: FeedTimeFilter) => void }) {
  const filters: Array<{ value: FeedTimeFilter; label: string }> = [{ value: "all", label: "All" }, { value: "today", label: "Today" }, { value: "last_7_days", label: "Last 7 days" }, { value: "last_month", label: "Last month" }];
  const activeLabel = filters.find(filter => filter.value === value)?.label ?? "All";
  return <div className="mt-3"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#eadfd2] bg-white px-3 text-[10px] font-extrabold text-[#80503a] transition hover:bg-[#fffaf5]">Time <span className="font-medium text-[#a18b7a]">· {activeLabel}</span><ChevronDown className="h-3.5 w-3.5 text-[#a27863]" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="min-w-36 rounded-xl border-[#eadfd2] bg-[#fffdfa] p-1.5 shadow-[0_12px_30px_rgba(92,53,31,0.12)]"><DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as FeedTimeFilter)}>{filters.map(filter => <DropdownMenuRadioItem key={filter.value} value={filter.value} className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-[#6d4a39] focus:bg-[#fff0e2] focus:text-[#6d4a39]">{filter.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu></div>;
}

function BuyerRequestFeed({ items, hasMore, onMore, onOpen }: { items: any[]; hasMore: boolean; onMore: () => void; onOpen: (item: any) => void }) {
  return <div className="mt-4 space-y-4">{items.map(item => <RequestCard key={item.post.xPostId || item.post.id} item={item} onOpen={() => onOpen(item)} />)}{hasMore ? <button onClick={onMore} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#e7d4c0] bg-[#fffaf5] px-4 py-3 text-left text-[10px] font-extrabold text-[#8b503a] transition hover:bg-[#fff4e8] active:scale-[0.99]"><span>View 10 more <span className="ml-1 font-medium text-[#a98a76]">· saved posts only</span></span><ArrowRight className="h-3.5 w-3.5" /></button> : null}</div>;
}

function RequestCard({ item, onOpen }: { item: any; onOpen: () => void }) {
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
  return <article role="button" tabIndex={0} onClick={onOpen} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }} className="cursor-pointer overflow-hidden rounded-[28px] border border-[#eadfd2] bg-white shadow-[0_14px_32px_rgba(95,58,33,0.045)] transition hover:border-[#e0baa0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd674c]"><div className="p-4 sm:p-5"><div className="flex items-start gap-3"><Avatar className="h-11 w-11 shrink-0 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-xs font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><p className="truncate text-sm font-extrabold text-[#3d2e23]">{author}</p><span className="truncate text-[11px] text-[#a18b7a]">{handle}</span><span className="hidden text-[#c2aa97] sm:inline">·</span><span className="hidden items-center gap-1 text-[10px] font-medium text-[#a18b7a] sm:inline-flex"><Clock3 className="h-3 w-3" />{formatPostDate(post.postedAt)}</span></div><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="inline-flex items-center gap-1 rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]"><Icon className="h-3 w-3" />{category}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#e7f3e9] px-2 py-1 text-[9px] font-extrabold text-[#3f7757]"><BadgeCheck className="h-3 w-3" />{post.ruleScore} signal</span></div></div></div><p className={`mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#4e392d] sm:text-[15px] sm:leading-7 ${isLong && !expanded ? "line-clamp-6" : ""}`}>{post.body}</p>{isLong ? <button type="button" onClick={event => { event.stopPropagation(); setExpanded(value => !value); }} className="mt-2 text-[11px] font-extrabold text-[#9b573e] hover:text-[#733d2c]">{expanded ? "See less" : "See more"}</button> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e6de] bg-[#fffdfa] px-4 py-3 sm:px-5"><div className="flex items-center gap-3 text-[10px] font-bold text-[#9b8575]"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{replies || "Reply"}</span><span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{likes || "Signal"}</span></div><div className="flex items-center gap-2"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ead5c2] bg-white px-3 text-[10px] font-extrabold text-[#80503a] transition hover:bg-[#fff4e8]"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Open X</span></a><span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#b85f45] px-3 text-[10px] font-extrabold text-white">Details <ArrowRight className="h-3.5 w-3.5" /></span></div></div><div className="border-t border-[#f5ece5] bg-white px-4 py-2.5 text-[9px] font-medium text-[#a18b7a] sm:px-5">Matched from {monitorName || "saved Faro search"}</div></article>;
}

function PostDetailDialog({ item, open, pending, onOpenChange, onReview }: { item: any | null; open: boolean; pending: boolean; onOpenChange: (open: boolean) => void; onReview: (decision: "approved" | "rejected") => void }) {
  if (!item) return null;
  const { post, monitorName } = item;
  const detail = buildReviewDialogContent(post);
  const score = Math.max(0, Math.min(100, Number(post.ruleScore || 0)));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] max-w-3xl gap-0 overflow-y-auto rounded-[28px] border-[#eadfd2] bg-[#fffdfa] p-0 sm:max-w-3xl" showCloseButton><DialogHeader className="border-b border-[#eedfd2] bg-white p-5 pr-12 text-left sm:p-6 sm:pr-14"><div className="flex items-center gap-3"><Avatar className="h-11 w-11"><AvatarImage src={post.authorAvatarUrl || undefined} alt="" /><AvatarFallback className="bg-[#f8e4c8] font-bold text-[#9c573f]">{detail.authorLabel.charAt(0).toUpperCase() || "F"}</AvatarFallback></Avatar><div className="min-w-0"><DialogTitle className="truncate text-base font-extrabold tracking-[-0.04em] text-[#3d2e23]">{detail.authorLabel}</DialogTitle><DialogDescription className="mt-1 truncate text-[11px] text-[#9a8a7b]">{detail.handleLabel} · {monitorName || "saved Faro search"}</DialogDescription></div><span className="ml-auto rounded-full bg-[#e7f3e9] px-2.5 py-1 text-[10px] font-extrabold text-[#3f7757]">{score} signal</span></div></DialogHeader><div className="p-5 sm:p-6"><p className="whitespace-pre-wrap text-[15px] leading-7 text-[#3b2d23]">{detail.fullPost}</p><section className="mt-6 rounded-2xl border border-[#eddbc8] bg-[#fbf2e7] p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a25d47]">Faro AI read</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-[#83503a]">{detail.agentRead.confidence}</span></div><p className="mt-3 text-[13px] leading-6 text-[#765845]">{detail.agentRead.summary}</p>{detail.agentRead.evidence.length ? <div className="mt-3 flex flex-wrap gap-1.5">{detail.agentRead.evidence.map(reason => <span key={reason.label} className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-bold text-[#80523d]">{reason.label}</span>)}</div> : null}</section></div><div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[#eee0d4] bg-white p-4 sm:px-6"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl border border-[#e5d3bd] px-3 text-xs font-bold text-[#794b36] hover:bg-[#fbf2e5]"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open in X</a>{post.reviewStatus === "pending" ? <><Button disabled={pending} onClick={() => onReview("approved")} className="h-10 rounded-xl bg-[#b85f45] px-3 text-xs font-extrabold text-white hover:bg-[#9f4d36]"><ThumbsUp className="mr-1.5 h-3.5 w-3.5" />Keep</Button><Button disabled={pending} onClick={() => onReview("rejected")} variant="outline" className="h-10 rounded-xl border-[#eed5cc] px-3 text-xs font-bold text-[#a14941] hover:bg-[#fff4f0]"><ThumbsDown className="mr-1.5 h-3.5 w-3.5" />Dismiss</Button></> : <span className="inline-flex h-10 items-center rounded-xl bg-[#f1e2d0] px-3 text-xs font-bold text-[#8f4e38]">{post.reviewStatus === "approved" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />}Already {post.reviewStatus}</span>}<span className="ml-auto text-[10px] font-medium text-[#a18b7a]">Decision stays manual</span></div></DialogContent></Dialog>;
}

function formatPostDate(value: string | Date | undefined) { if (!value) return "Saved request"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Saved request" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function EmptyFeed({ onSearch }: { onSearch: () => void }) { return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#f6e6d4] text-[#a55a42]"><Radar className="h-4 w-4" /></span><h2 className="mt-3 text-base font-extrabold tracking-[-0.04em]">Ready for request posts.</h2><p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-5 text-[#9a8474]">Run one focused X search. Faro keeps only real requests for help.</p><Button onClick={onSearch} className="mt-4 h-10 rounded-xl bg-[#b85f45] text-xs font-extrabold text-white hover:bg-[#9f4d36]"><Search className="mr-2 h-3.5 w-3.5" />Search</Button></div></div>; }
function NoRequests({ screened, filtered, onSearch }: { screened: number; filtered: boolean; onSearch: () => void }) { return <div className="mt-4 grid min-h-44 place-items-center rounded-[24px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><BadgeCheck className="mx-auto h-5 w-5 text-[#6c9b7b]" /><h2 className="mt-3 text-sm font-extrabold">{filtered ? "No saved posts in this period." : "Nothing qualified yet."}</h2><p className="mx-auto mt-1.5 max-w-md text-[10px] leading-5 text-[#9a8474]">{filtered ? "Try a wider local time filter. This does not run another X search." : `Faro screened ${screened} stored public posts for this search. Service offers and topic chatter were filtered as noise, not lost.`}</p>{filtered ? null : <button onClick={onSearch} className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#99523c] hover:text-[#713c2b]">Refine search <ArrowRight className="h-3 w-3" /></button>}</div></div>; }
function FeedError({ onRetry }: { onRetry: () => void }) { return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-[#efd4c7] bg-[#fff7f1] px-6 text-center"><div><Radar className="mx-auto h-5 w-5 text-[#b8654a]" /><h2 className="mt-3 text-base font-extrabold">Feed needs a refresh.</h2><p className="mt-1.5 text-[10px] text-[#9a8474]">Saved requests are safe. This does not start another source search.</p><Button onClick={onRetry} variant="outline" className="mt-4 h-9 rounded-xl border-[#e2bfae] bg-white text-xs font-extrabold text-[#98513a] hover:bg-[#fffaf7]">Retry loading</Button></div></div>; }
