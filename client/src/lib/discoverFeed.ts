export type FeedPost = { id: number; source: string; ruleScore: number; reviewStatus: "pending" | "approved" | "rejected"; body?: string };
export type FeedItem = { post: FeedPost; monitor: { id: number } };

const CONCRETE_BUYER_ACTION = "(looking for (?:someone|a freelancer|an? agency|an? expert|an? consultant)|looking to hire|need(?:s)? (?:someone|a freelancer|an? agency|an? expert|an? consultant|a team)|need(?:s)? help (?:building|automating|implementing|setting up|creating|integrating)|seeking (?:a provider|an? expert)|can someone (?:build|set up|implement)|who can (?:build|help us)|recommend (?:someone|a freelancer|an? agency)|looking to outsource|hire (?:a |an ))";
const CONCRETE_BUYER_REQUEST = new RegExp(`\\b(i(?:'m| am)?|we|our|my|team|company|business|founder|client)\\b.{0,90}${CONCRETE_BUYER_ACTION}\\b`, "i");
const OPENING_BUYER_REQUEST = new RegExp(`^\\s*${CONCRETE_BUYER_ACTION}\\b`, "i");

export function isConcreteBuyerRequest(post: FeedPost) {
  return Boolean(post.body && (CONCRETE_BUYER_REQUEST.test(post.body) || OPENING_BUYER_REQUEST.test(post.body)));
}

export function getQualifiedPosts<T extends FeedItem>(items: T[], activeMonitorId?: number, fallbackToAll = true) {
  const qualified = items.filter(({ post }) => post.source !== "demo" && post.ruleScore >= 55 && isConcreteBuyerRequest(post));
  const active = activeMonitorId ? qualified.filter(({ monitor }) => monitor.id === activeMonitorId) : qualified;
  return active.length || !fallbackToAll ? active : qualified;
}

export function getDiscoverPreview<T>(items: T[], limit = 10) {
  return items.slice(0, Math.max(1, limit));
}

export function getRequestCategory(post: { body?: string }) {
  const body = (post.body ?? "").toLowerCase();
  if (/(ai video|ugc video|video production|video editor|video automation)/.test(body)) return "AI video";
  if (/(ai agent|agents|agentic)/.test(body)) return "AI agents";
  if (/(automate|automation|zapier|n8n)/.test(body)) return "Automation";
  if (/(workflow|intake|support|sales)/.test(body)) return "Custom AI workflow";
  return "AI implementation";
}
