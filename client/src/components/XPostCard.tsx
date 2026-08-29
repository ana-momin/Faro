import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useHideAuthorPhotos } from "@/lib/authorPhotos";
import { Bookmark, Check, Clock3, ExternalLink, ThumbsDown } from "lucide-react";
import React from "react";

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
const REQUEST_PATTERN = /\b(?:need(?:s|ed)?\s+(?:a|an|someone|help)|looking for\s+(?:a|an|someone)|seeking\s+(?:a|an|someone)|hire(?:\s+|ing\s+)(?:a|an|someone)|(?:an?\s+)?(?:agency|freelancer|consultant|developer|expert|provider)\s+(?:for|to)|help\s+(?:with|to))\b[^.!?\n]{0,120}/i;

export function makePostExcerpt(body: string, maxLength = 560) {
  const firstMatch = body.search(REQUEST_PATTERN);
  const preferredStart = firstMatch > 90 ? firstMatch - 90 : 0;
  const start = preferredStart ? Math.max(0, body.lastIndexOf(" ", preferredStart)) : 0;
  const end = Math.min(body.length, start + maxLength);
  const boundary = end < body.length ? Math.max(start, body.lastIndexOf(" ", end)) : end;
  return `${start ? "…" : ""}${body.slice(start, boundary).trim()}${boundary < body.length ? "…" : ""}`;
}

export function isCardSelectionKey(event: Pick<React.KeyboardEvent<HTMLElement>, "key" | "target" | "currentTarget">) {
  return event.target === event.currentTarget && (event.key === "Enter" || event.key === " ");
}

export function HighlightedPostExcerpt({ body, maxLength = 560, className = "" }: { body: string; maxLength?: number; className?: string }) {
  const excerpt = makePostExcerpt(body, maxLength);
  const segments = excerpt.split(new RegExp(`(${REQUEST_PATTERN.source})`, "ig"));
  return <p className={`mt-3 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-[#353833] ${className}`}>{segments.map((segment, index) => REQUEST_PATTERN.test(segment) ? <mark key={`${segment}-${index}`} className="rounded bg-[#f8e2c7] px-0.5 font-semibold text-[#673d2c]">{segment}</mark> : segment)}</p>;
}

export default function XPostCard({ post, selected = false, onSelect, onReview, pending = false, compact = false }: XPostCardProps) {
  const { hideAuthorPhotos } = useHideAuthorPhotos();
  const selectableProps = onSelect ? {
    role: "button" as const,
    tabIndex: 0,
    onClick: onSelect,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (isCardSelectionKey(event)) {
        event.preventDefault();
        onSelect();
      }
    },
  } : {};
  return <article {...selectableProps} className={`block w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#9fc7a8] bg-[#f8fbf7] shadow-[0_10px_24px_rgba(27,48,31,0.05)]" : "border-[#e5e7e2] bg-white hover:border-[#c9d9cd]"}`}>
    <div className="flex items-start gap-3"><Avatar className="h-10 w-10 shrink-0 border border-[#edf0eb]">{hideAuthorPhotos ? null : <AvatarImage src={post.authorAvatarUrl || undefined} alt="" />}<AvatarFallback className="bg-[#e9f4eb] text-xs font-extrabold text-[#32734b]">{initial(post)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#20221f]">{post.authorName || post.authorHandle || "Unknown account"}</p><p className="mt-0.5 truncate text-[11px] text-[#858880]">{post.authorHandle ? `@${post.authorHandle}` : "Public X account"}</p></div><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold ${scoreTone(post.ruleScore)}`}>{post.ruleScore}</span></div>
      <HighlightedPostExcerpt body={post.body} maxLength={compact ? 300 : 560} />
      <div className="mt-4 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-[10px] text-[#92958d]"><Clock3 className="h-3.5 w-3.5" />{new Date(post.postedAt).toLocaleString()}</span><div className="flex items-center gap-1"><a href={post.postUrl || "https://x.com"} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1e4de] text-[#5d625a] transition hover:bg-[#f3f5f1]" title="Open on X" aria-label="Open on X"><ExternalLink className="h-3.5 w-3.5" /></a>{onReview && post.reviewStatus === "pending" ? <><button type="button" disabled={pending} onClick={event => { event.stopPropagation(); onReview("approved"); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#cfe6d4] bg-[#edf8ef] text-[#267145] transition hover:bg-[#dff5e6] disabled:opacity-50" title="Save for review" aria-label="Save for review"><Bookmark className="h-3.5 w-3.5" /></button><button type="button" disabled={pending} onClick={event => { event.stopPropagation(); onReview("rejected"); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#f0ddd9] text-[#a24c43] transition hover:bg-[#fdf2f0] disabled:opacity-50" title="Dismiss" aria-label="Dismiss"><ThumbsDown className="h-3.5 w-3.5" /></button></> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ed] text-[#676b64]" title={post.reviewStatus === "approved" ? "Saved" : "Dismissed"}>{post.reviewStatus === "approved" ? <Check className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}</span>}</div></div></div></div>
  </article>;
}
