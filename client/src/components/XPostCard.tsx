import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bookmark, Check, Clock3, ExternalLink, ThumbsDown } from "lucide-react";

type FaroPost = {
  id: number;
  authorName?: string | null;
  authorHandle?: string | null;
  authorAvatarUrl?: string | null;
  body: string;
  postUrl?: string | null;
  postedAt: Date | string;
  ruleScore: number;
  reviewStatus: "pending" | "approved" | "rejected";
};

type XPostCardProps = {
  post: FaroPost;
  selected?: boolean;
  onSelect?: () => void;
  onReview?: (decision: "approved" | "rejected") => void;
  pending?: boolean;
  compact?: boolean;
};

const scoreTone = (score: number) => score >= 80 ? "bg-[#dff5e6] text-[#17643c]" : score >= 60 ? "bg-[#eff3ef] text-[#3a4a3f]" : "bg-[#f3f4f2] text-[#777a76]";
const initial = (post: FaroPost) => (post.authorName || post.authorHandle || "F").trim().charAt(0).toUpperCase();

export default function XPostCard({ post, selected = false, onSelect, onReview, pending = false, compact = false }: XPostCardProps) {
  const CardTag = onSelect ? "button" : "article";
  return <CardTag {...(onSelect ? { type: "button" as const, onClick: onSelect } : {})} className={`block w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#9fc7a8] bg-[#f8fbf7] shadow-[0_10px_24px_rgba(27,48,31,0.05)]" : "border-[#e5e7e2] bg-white hover:border-[#c9d9cd]"}`}>
    <div className="flex items-start gap-3"><Avatar className="h-10 w-10 shrink-0 border border-[#edf0eb]"><AvatarImage src={post.authorAvatarUrl || undefined} alt="" /><AvatarFallback className="bg-[#e9f4eb] text-xs font-extrabold text-[#32734b]">{initial(post)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#20221f]">{post.authorName || post.authorHandle || "Unknown account"}</p><p className="mt-0.5 truncate text-[11px] text-[#858880]">{post.authorHandle ? `@${post.authorHandle}` : "Public X account"}</p></div><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold ${scoreTone(post.ruleScore)}`}>{post.ruleScore}</span></div>
      <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 text-[#353833] ${compact ? "line-clamp-3" : ""}`}>{post.body}</p>
      <div className="mt-4 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-[10px] text-[#92958d]"><Clock3 className="h-3.5 w-3.5" />{new Date(post.postedAt).toLocaleString()}</span><div className="flex items-center gap-1"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1e4de] text-[#5d625a] transition hover:bg-[#f3f5f1]" title="Open on X" aria-label="Open on X"><ExternalLink className="h-3.5 w-3.5" /></a>{onReview && post.reviewStatus === "pending" ? <><button type="button" disabled={pending} onClick={event => { event.stopPropagation(); onReview("approved"); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#cfe6d4] bg-[#edf8ef] text-[#267145] transition hover:bg-[#dff5e6] disabled:opacity-50" title="Save for review" aria-label="Save for review"><Bookmark className="h-3.5 w-3.5" /></button><button type="button" disabled={pending} onClick={event => { event.stopPropagation(); onReview("rejected"); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#f0ddd9] text-[#a24c43] transition hover:bg-[#fdf2f0] disabled:opacity-50" title="Dismiss" aria-label="Dismiss"><ThumbsDown className="h-3.5 w-3.5" /></button></> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ed] text-[#676b64]" title={post.reviewStatus === "approved" ? "Saved" : "Dismissed"}>{post.reviewStatus === "approved" ? <Check className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}</span>}</div></div></div></div>
  </CardTag>;
}
