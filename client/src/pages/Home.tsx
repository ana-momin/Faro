import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { filterFeedByTime, getAllQualifiedPosts, getDiscoverPreview, getMatchReason, getRequestCategory, prioritizeCurrentMonth, type FeedTimeFilter } from "@/lib/discoverFeed";
import { buildReviewDialogContent, getBuyerRequestEvidence } from "@/lib/discoverAgent";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bookmark, BookmarkCheck, Bot, Check, ChevronDown, Clapperboard, ClipboardCheck, Clock3, Code2, ExternalLink, Heart, Lightbulb, Loader2, Megaphone, MessageCircle, Radar, RefreshCw, Search, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, Trash2, Trophy, Workflow, Zap } from "lucide-react";
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
    onMutate: () => { toast.success("Thanks for the feedback.", { position: "bottom-right", duration: 1500 }); },
    onSuccess: () => { void utils.monitoring.overview.invalidate(); },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });
  const save = trpc.monitoring.save.useMutation({
    onMutate: input => {
      const previous = selectedItem;
      if (input.saved) setSelectedItem((current: any) => current ? { ...current, savedAt: new Date().toISOString() } : current);
      return { previous };
    },
    onSuccess: result => { void utils.monitoring.overview.invalidate(); toast.success(result.saved ? "Saved to Profile." : "Removed from saved posts.", { position: "bottom-right", duration: 1500 }); },
    onError: (error, _input, context) => { setSelectedItem(context?.previous ?? null); toast.error(error.message, { position: "bottom-right" }); },
  });
  const removeFromFeed = trpc.monitoring.removeFromFeed.useMutation({
    onSuccess: async () => {
      setSelectedItem(null);
      await utils.monitoring.overview.invalidate();
      await utils.monitoring.saved.invalidate();
      toast.success("Removed from Feed.", { position: "bottom-right", duration: 1500 });
    },
    onError: error => toast.error(error.message, { position: "bottom-right" }),
  });
  const active = overview.data?.monitors.find(({ monitor }) => monitor.status === "active") ?? overview.data?.monitors[0];
  const providerReady = Boolean(overview.data?.collection.configured);
  const refresh = trpc.monitoring.sync.useMutation({
    onSuccess: async sync => {
      await utils.monitoring.overview.invalidate();
      const retrieval = sync.retrieval;
      if (sync.skipped === "daily_budget") {
        toast.message("Today’s source-call budget is reached. Saved posts remain available.");
      } else if (retrieval?.persisted) {
        toast.success(`${retrieval.persisted} new qualified post${retrieval.persisted === 1 ? "" : "s"} added from one new source batch.`);
      } else {
        toast.message("One new source batch checked; no qualified posts this time.");
      }
    },
    onError: error => toast.error(error.message),
  });
  const allQualified = useMemo(() => prioritizeCurrentMonth(getAllQualifiedPosts(overview.data?.posts ?? [])), [overview.data?.posts]);
  const filteredQualified = useMemo(() => filterFeedByTime(allQualified, timeFilter), [allQualified, timeFilter]);
  const visible = useMemo(() => getDiscoverPreview(filteredQualified, visibleCount), [filteredQualified, visibleCount]);
  const screened = useMemo(() => (overview.data?.posts ?? []).filter(item => item.monitor.id === active?.monitor.id && item.post.source !== "demo").length, [overview.data?.posts, active?.monitor.id]);

  useEffect(() => setVisibleCount(10), [active?.monitor.id, timeFilter]);

  let content: React.ReactNode;
  if (overview.isLoading) {
    content = <div className="grid min-h-80 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#b56a4e]" /></div>;
  } else if (overview.isError) {
    content = <FeedError error={overview.error} onRetry={() => overview.refetch()} />;
  } else if (!active) {
    content = <EmptyFeed providerReady={providerReady} onConfigure={() => setLocation("/settings?section=provider")} onSearch={() => setLocation("/search?firstBatch=1")} />;
  } else {
    content = <section className="mx-auto mt-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eadfd2] pb-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a25d47]">All your search results</p><h2 className="mt-1 text-base font-extrabold tracking-[-0.04em] text-[#4b3123]">Top qualified requests</h2></div><FeedTimeFilters value={timeFilter} onChange={setTimeFilter} /></div>
      {visible.length ? <BuyerRequestFeed items={visible} hasMore={visibleCount < filteredQualified.length} onMore={() => setVisibleCount(count => count + 10)} onOpen={setSelectedItem} /> : <NoRequests screened={screened} filtered={timeFilter !== "all"} onSearch={() => setLocation("/search")} />}
    </section>;
  }

  return <div className="mx-auto w-full max-w-4xl pb-10">
    <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 border-b border-[#eadfd2] pb-5"><h1 className="text-xl font-extrabold tracking-[-0.06em] text-[#422d20]">Posts</h1><div className="flex items-center gap-2"><Button variant="outline" onClick={() => { if (!providerReady) { setLocation("/profile"); toast.message("Connect a provider in Profile before collecting posts."); return; } if (active) refresh.mutate({ monitorId: active.monitor.id }); }} disabled={!active || refresh.isPending} className="h-9 rounded-xl border-[#e2cbb6] bg-white px-3 text-xs font-extrabold text-[#8c503a] hover:bg-[#fff5eb]" aria-label="Collect the next X batch" title={providerReady ? "Collects one new source batch" : "Connect a provider in Profile"}><>{refresh.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}Refresh</></Button><Button onClick={() => setLocation("/search")} className="h-9 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]" aria-label="Start a new search">Search</Button></div></header>
    {content}
    <PostDetailDialog item={selectedItem} open={Boolean(selectedItem)} pending={review.isPending || save.isPending || removeFromFeed.isPending} onOpenChange={open => { if (!open) setSelectedItem(null); }} onReview={decision => selectedItem && review.mutate({ postId: selectedItem.post.id, decision })} onSave={() => selectedItem && save.mutate({ postId: selectedItem.post.id, saved: true })} onRemove={() => { if (selectedItem && window.confirm("Remove this stored post from your Feed? It will stay hidden from your future stored result views.")) removeFromFeed.mutate({ postId: selectedItem.post.id }); }} />
  </div>;
}

function FeedTimeFilters({ value, onChange }: { value: FeedTimeFilter; onChange: (value: FeedTimeFilter) => void }) {
  const filters: Array<{ value: FeedTimeFilter; label: string }> = [{ value: "all", label: "All" }, { value: "today", label: "Today" }, { value: "last_7_days", label: "Last 7 days" }, { value: "last_month", label: "Last month" }];
  const activeLabel = filters.find(filter => filter.value === value)?.label ?? "All";
  return <div className="mt-3"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#eadfd2] bg-white px-3 text-[10px] font-extrabold text-[#80503a] transition hover:bg-[#fffaf5]">Time <span className="font-medium text-[#a18b7a]">· {activeLabel}</span><ChevronDown className="h-3.5 w-3.5 text-[#a27863]" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="min-w-36 rounded-xl border-[#eadfd2] bg-[#fffdfa] p-1.5 shadow-[0_12px_30px_rgba(92,53,31,0.12)]"><DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as FeedTimeFilter)}>{filters.map(filter => <DropdownMenuRadioItem key={filter.value} value={filter.value} className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-[#6d4a39] focus:bg-[#fff0e2] focus:text-[#6d4a39]">{filter.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu></div>;
}

function BuyerRequestFeed({ items, hasMore, onMore, onOpen }: { items: any[]; hasMore: boolean; onMore: () => void; onOpen: (item: any) => void }) {
  return <div className="mt-4 space-y-4">{items.map(item => <RequestCard key={item.post.xPostId || item.post.id} item={item} onOpen={() => onOpen(item)} />)}{hasMore ? <button onClick={onMore} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#e7d4c0] bg-[#fffaf5] px-4 py-3 text-left text-[10px] font-extrabold text-[#8b503a] transition hover:bg-[#fff4e8] active:scale-[0.99]"><span>Show 10 more <span className="ml-1 font-medium text-[#a98a76]">· saved results</span></span><ArrowRight className="h-3.5 w-3.5" /></button> : null}</div>;
}

export function RequestCard({ item, onOpen }: { item: any; onOpen: () => void }) {
  const { post, monitorName } = item;
  const category = getRequestCategory(post);
  const matchReason = getMatchReason(post);
  const author = post.authorName || post.authorHandle || "X member";
  const handle = post.authorHandle ? `@${String(post.authorHandle).replace(/^@/, "")}` : "X member";
  const initial = author.charAt(0).toUpperCase();
  const Icon = category === "Automation" ? Zap : category === "AI video" ? Clapperboard : category === "Custom AI workflow" ? Workflow : category === "Product testing" ? ClipboardCheck : category === "Contests & bounties" ? Trophy : category === "Content & social" ? Megaphone : category === "Development" ? Code2 : category === "Research & design" ? Lightbulb : Bot;
  const likes = Number(post.engagement?.like_count ?? post.engagement?.likes ?? 0);
  const replies = Number(post.engagement?.reply_count ?? post.engagement?.replies ?? 0);
  const [expanded, setExpanded] = useState(false);
  const isLong = String(post.body ?? "").length > 300;
  return <article role="button" tabIndex={0} onClick={onOpen} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }} className="cursor-pointer overflow-hidden rounded-[28px] border border-[#eadfd2] bg-white shadow-[0_14px_32px_rgba(95,58,33,0.045)] transition hover:border-[#e0baa0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd674c]"><div className="p-4 sm:p-5"><div className="flex items-start gap-3"><Avatar className="h-11 w-11 shrink-0 border border-[#f0ded0]"><AvatarImage src={post.authorAvatarUrl || undefined} alt={author} /><AvatarFallback className="bg-[#f9e8d8] text-xs font-extrabold text-[#a45a41]">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><p className="truncate text-sm font-extrabold text-[#3d2e23]">{author}</p><span className="truncate text-[11px] text-[#a18b7a]">{handle}</span><span className="hidden text-[#c2aa97] sm:inline">·</span><span className="hidden items-center gap-1 text-[10px] font-medium text-[#a18b7a] sm:inline-flex"><Clock3 className="h-3 w-3" />{formatPostDate(post.postedAt)}</span></div><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="inline-flex items-center gap-1 rounded-full bg-[#fbefe5] px-2 py-1 text-[9px] font-extrabold text-[#9b593f]"><Icon className="h-3 w-3" />{category}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#e7f3e9] px-2 py-1 text-[9px] font-extrabold text-[#3f7757]"><BadgeCheck className="h-3 w-3" />{post.ruleScore} signal</span></div></div></div><p className={`mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#4e392d] sm:text-[15px] sm:leading-7 ${isLong && !expanded ? "line-clamp-6" : ""}`}>{post.body}</p>{isLong ? <button type="button" onClick={event => { event.stopPropagation(); setExpanded(value => !value); }} className="mt-2 text-[11px] font-extrabold text-[#9b573e] hover:text-[#733d2c]">{expanded ? "See less" : "See more"}</button> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e6de] bg-[#fffdfa] px-4 py-3 sm:px-5"><div className="flex items-center gap-3 text-[10px] font-bold text-[#9b8575]"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{replies || "Reply"}</span><span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{likes || "Signal"}</span></div><div className="flex items-center gap-2"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ead5c2] bg-white px-3 text-[10px] font-extrabold text-[#80503a] transition hover:bg-[#fff4e8]"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Open X</span></a><span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#b85f45] px-3 text-[10px] font-extrabold text-white">Details <ArrowRight className="h-3.5 w-3.5" /></span></div></div><div className="border-t border-[#f5ece5] bg-white px-4 py-2.5 text-[9px] font-medium text-[#a18b7a] sm:px-5"><span className="font-extrabold text-[#8c523d]">Why it matched:</span> {matchReason}</div></article>;
}

export function PostDetailDialog({ item, open, pending, onOpenChange, onReview, onSave, onRemove }: { item: any | null; open: boolean; pending: boolean; onOpenChange: (open: boolean) => void; onReview: (decision: "approved" | "rejected") => void; onSave: () => void; onRemove: () => void }) {
  if (!item) return null;
  const { post, monitorName } = item;
  const detail = buildReviewDialogContent(post);
  const matched = getBuyerRequestEvidence(post);
  const score = Math.max(0, Math.min(100, Number(post.ruleScore || 0)));
  const category = getRequestCategory(post);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-y-auto rounded-[30px] border-[#eadfd2] bg-[#fffdfa] p-0 sm:max-w-4xl" showCloseButton>
      <DialogHeader className="border-b border-[#ecdccd] bg-[linear-gradient(135deg,#fffdf9_0%,#fbf0e4_100%)] p-5 pr-12 text-left sm:p-6 sm:pr-14">
        <div className="flex items-start gap-3"><Avatar className="h-12 w-12 border border-white shadow-sm"><AvatarImage src={post.authorAvatarUrl || undefined} alt="" /><AvatarFallback className="bg-[#f8e4c8] font-bold text-[#9c573f]">{detail.authorLabel.charAt(0).toUpperCase() || "F"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><DialogTitle className="truncate text-[17px] font-extrabold tracking-[-0.045em] text-[#3d2e23]">{detail.authorLabel}</DialogTitle><span className="rounded-full border border-[#e8d4c0] bg-white/80 px-2 py-0.5 text-[9px] font-extrabold text-[#8d573f]">{category}</span></div><DialogDescription className="mt-1 truncate text-[11px] text-[#9a8a7b]">{detail.handleLabel} · {monitorName || "saved Faro search"}</DialogDescription></div><div className="rounded-2xl border border-[#d8e8dc] bg-white/90 px-3 py-2 text-right shadow-sm"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#5d8b69]">Signal</p><p className="mt-0.5 text-sm font-extrabold text-[#356646]">{score}<span className="text-[10px] text-[#81a28a]">/100</span></p></div></div>
      </DialogHeader>
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.8fr)]">
        <section className="min-w-0 p-5 sm:p-6"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a25d47]">Original post</p>{matched.length ? <div className="mt-3 rounded-2xl border border-[#f0d8bd] bg-[#fff3e5] p-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#9b573e]">Matched request wording</p><div className="mt-2 flex flex-wrap gap-1.5">{matched.map(item => <span key={item.label} className="rounded-full bg-white px-2 py-1 text-[9px] font-extrabold text-[#80523d]">{item.label}</span>)}</div></div> : null}<HighlightedPostText text={detail.fullPost} phrases={matched.map(item => item.phrase)} /></section>
        <aside className="border-t border-[#eedfd2] bg-[#fff7ef] p-5 md:border-t-0 md:border-l sm:p-6"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f5d9c4] text-[#a25d47]"><Sparkles className="h-4 w-4" /></span><div><p className="text-[11px] font-extrabold text-[#593829]">Faro AI read</p><p className="text-[10px] text-[#9a765f]">Decision support, not automation</p></div></div><div className="mt-5 rounded-2xl border border-[#ecd8c4] bg-white p-4 shadow-[0_8px_20px_rgba(98,57,31,0.04)]"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a25d47]">Confidence</p><span className="text-[11px] font-extrabold text-[#714833]">{detail.agentRead.confidence}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f3e3d4]"><div className="h-full rounded-full bg-[#bc674a] transition-[width] duration-300" style={{ width: `${score}%` }} /></div><p className="mt-4 text-[12px] leading-5 text-[#765845]">{detail.agentRead.summary}</p></div>{detail.agentRead.evidence.length ? <div className="mt-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a25d47]">Why Faro surfaced this</p><div className="mt-2 flex flex-wrap gap-1.5">{detail.agentRead.evidence.map(reason => <span key={reason.label} className="inline-flex items-center gap-1 rounded-full border border-[#ead7c4] bg-white px-2 py-1 text-[9px] font-bold text-[#80523d]"><BadgeCheck className="h-3 w-3 text-[#6a9877]" />{reason.label}</span>)}</div></div> : null}</aside>
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[#eee0d4] bg-white/95 p-4 backdrop-blur sm:px-6"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e5d3bd] text-[#794b36] transition hover:bg-[#fbf2e5]" aria-label="Open post in X" title="Open in X"><ExternalLink className="h-3.5 w-3.5" /></a>{item.savedAt ? <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#c9dfcf] bg-[#eff8f0] text-[#3f7757]" aria-label="Saved to Profile" title="Saved to Profile"><BookmarkCheck className="h-4 w-4" /></span> : <Button disabled={pending} onClick={onSave} variant="outline" className="h-10 w-10 rounded-xl border border-[#ead7c4] px-0 text-[#85533d] hover:bg-[#fff4e8]" aria-label="Save post" title="Save post"><Bookmark className="h-4 w-4" /></Button>}{post.reviewStatus === "pending" ? <><Button disabled={pending} onClick={() => onReview("approved")} className="h-10 w-10 rounded-xl bg-[#b85f45] px-0 text-white hover:bg-[#9f4d36]" aria-label="Keep this kind of post" title="Keep"><ThumbsUp className="h-4 w-4" /></Button><Button disabled={pending} onClick={() => onReview("rejected")} variant="outline" className="h-10 w-10 rounded-xl border-[#eed5cc] px-0 text-[#a14941] hover:bg-[#fff4f0]" aria-label="Dismiss this kind of post" title="Dismiss"><ThumbsDown className="h-4 w-4" /></Button></> : <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1e2d0] text-[#8f4e38]" aria-label="Reviewed" title="Reviewed">{post.reviewStatus === "approved" ? <Check className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}</span>}<Button disabled={pending} onClick={onRemove} variant="outline" className="h-10 w-10 rounded-xl border-[#efd5cc] px-0 text-[#a14941] hover:bg-[#fff4f0]" aria-label="Remove post from Feed" title="Remove from Feed"><Trash2 className="h-3.5 w-3.5" /></Button><span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-[#8f7868]"><ShieldCheck className="h-3.5 w-3.5 text-[#6b9877]" />Human decision required</span></div>
    </DialogContent>
  </Dialog>;
}

function HighlightedPostText({ text, phrases }: { text: string; phrases: string[] }) {
  const cleaned = Array.from(new Set(phrases.map(phrase => phrase.trim()).filter(Boolean))).sort((a, b) => b.length - a.length);
  if (!cleaned.length) return <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[#3b2d23]">{text}</p>;
  const expression = new RegExp(`(${cleaned.map(escapeRegExp).join("|")})`, "ig");
  return <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[#3b2d23]">{text.split(expression).map((part, index) => cleaned.some(phrase => phrase.toLowerCase() === part.toLowerCase()) ? <mark key={`${part}-${index}`} className="rounded bg-[#fee3b8] px-0.5 font-semibold text-[#62351f]">{part}</mark> : part)}</p>;
}

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function formatPostDate(value: string | Date | undefined) { if (!value) return "Saved request"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Saved request" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatRelativeTime(value: string | Date) { const date = new Date(value); const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000)); if (seconds < 60) return "just now"; if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`; return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function EmptyFeed({ providerReady, onConfigure, onSearch }: { providerReady: boolean; onConfigure: () => void; onSearch: () => void }) {
  const title = providerReady ? "Your provider is ready for a first batch." : "Connect your X data provider.";
  const description = providerReady
    ? "Start with Faro’s recommended buyer brief, then run one clearly labeled source batch to bring qualified posts into this Feed."
    : "Add your TwitterAPI.io key or Official X API bearer token in Profile → Provider before Faro can collect posts.";

  return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div className="w-full max-w-md"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#f6e6d4] text-[#a55a42]"><Radar className="h-4 w-4" /></span><h2 className="mt-3 text-base font-extrabold tracking-[-0.04em]">{title}</h2><p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-5 text-[#9a8474]">{description}</p>{providerReady ? <Button onClick={onSearch} className="mt-4 h-10 rounded-xl bg-[#b85f45] text-xs font-extrabold text-white hover:bg-[#9f4d36]"><RefreshCw className="mr-2 h-3.5 w-3.5" />Prepare first batch <span className="ml-1.5 text-white/70">· 1 source request</span></Button> : <div className="mt-4 grid gap-2 sm:grid-cols-2"><Button onClick={onConfigure} className="h-10 rounded-xl bg-[#b85f45] text-xs font-extrabold text-white hover:bg-[#9f4d36]"><ShieldCheck className="mr-2 h-3.5 w-3.5" />Configure provider</Button><Button disabled variant="outline" className="h-10 rounded-xl border-[#ead7c5] bg-white text-xs font-extrabold text-[#9d806d]" aria-label="Run first X batch unavailable until a provider is configured" title="Configure a provider in Provider"><RefreshCw className="mr-2 h-3.5 w-3.5" />Run first batch</Button></div>}</div></div>;
}
function NoRequests({ screened, filtered, onSearch }: { screened: number; filtered: boolean; onSearch: () => void }) { return <div className="mt-4 grid min-h-44 place-items-center rounded-[24px] border border-dashed border-[#ead7c5] bg-[#fffdfa] px-6 text-center"><div><BadgeCheck className="mx-auto h-5 w-5 text-[#6c9b7b]" /><h2 className="mt-3 text-sm font-extrabold">{filtered ? "No saved posts in this period." : "Nothing qualified yet."}</h2><p className="mx-auto mt-1.5 max-w-md text-[10px] leading-5 text-[#9a8474]">{filtered ? "Try a wider local time filter. This does not run another X search." : `Faro screened ${screened} stored public posts for this search. Service offers and topic chatter were filtered as noise, not lost.`}</p>{filtered ? null : <button onClick={onSearch} className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#99523c] hover:text-[#713c2b]">Refine search <ArrowRight className="h-3 w-3" /></button>}</div></div>; }
function FeedError({ error, onRetry }: { error: unknown; onRetry: () => void }) { const reconnecting = String((error as Error | undefined)?.message ?? "").includes("could not reach its API"); return <div className="mt-7 grid min-h-64 place-items-center rounded-[26px] border border-[#efd4c7] bg-[#fff7f1] px-6 text-center"><div><Radar className="mx-auto h-5 w-5 text-[#b8654a]" /><h2 className="mt-3 text-base font-extrabold">{reconnecting ? "Faro is reconnecting to its API." : "Feed needs a refresh."}</h2><p className="mt-1.5 text-[10px] text-[#9a8474]">{reconnecting ? "Faro retried the connection automatically. Your saved requests are safe and no source search was started." : "Saved requests are safe. This does not start another source search."}</p><Button onClick={onRetry} variant="outline" className="mt-4 h-9 rounded-xl border-[#e2bfae] bg-white text-xs font-extrabold text-[#98513a] hover:bg-[#fffaf7]">Retry loading</Button></div></div>; }
