export type FeedPost = { id: number; xPostId?: string | null; source: string; ruleScore: number; reviewStatus: "pending" | "approved" | "rejected"; body?: string; postedAt?: string | Date | null; authorName?: string | null; authorHandle?: string | null; authorAvatarUrl?: string | null };
export type FeedItem = { post: FeedPost; monitor: { id: number } };
export type FeedTimeFilter = "all" | "today" | "this_week" | "last_week" | "this_month";

const CONCRETE_BUYER_ACTION = "(looking for (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant)|looking to hire|need(?:s)? (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant|a team)|need(?:s)? (?:help|a hand) (?:building|automating|implementing|setting up|creating|integrating)|seeking (?:a provider|an? (?:ai )?expert)|can someone (?:build|set up|implement)|who can (?:build|help us)|recommend (?:someone|a freelancer|an? agency)|does anyone know an? (?:developer|agency|freelancer|consultant)|anyone know an? (?:developer|agency|freelancer)|recommendations for an? (?:developer|agency|freelancer)|looking to outsource|hire (?:a |an ))";
const CONCRETE_BUYER_REQUEST = new RegExp(`\\b(i(?:'m| am)?|we(?:'re| are)?|our (?:team|company|business)|my (?:team|business|company)|our|my)\\b.{0,90}${CONCRETE_BUYER_ACTION}\\b`, "i");
const OPENING_BUYER_REQUEST = /^\s*(?:looking for (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant)|looking to hire\b|need(?:s)? (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant|a team)|need(?:s)? (?:help|a hand)\b|seeking (?:a provider|an? (?:ai )?expert)|can someone (?:build|set up|implement)\b|who can (?:build|help us)\b|recommend (?:someone|a freelancer|an? agency)|does anyone know an? (?:developer|agency|freelancer|consultant)|anyone know an? (?:developer|agency|freelancer)|recommendations for an? (?:developer|agency|freelancer)|looking to outsource\b|hire (?:a |an ))/i;
const DELIVERY_SCOPE = /\b(build|implement|set up|setup|automate|integrate|configure|develop|create|produce|edit|manage|design|launch|maintain|streamline|install|test|validate|research|audit|debug|ship|publish|post|submit|enter)\b/i;
const NAMED_PROVIDER = /\b(freelancer|agency|consultant|expert|specialist|developer|engineer|tester|designer|creator|editor|contractor|vendor)\b/i;

export function isConcreteBuyerRequest(post: FeedPost) {
  if (!post.body) return false;
  const buyerAsk = CONCRETE_BUYER_REQUEST.test(post.body) || OPENING_BUYER_REQUEST.test(post.body);
  return buyerAsk && (DELIVERY_SCOPE.test(post.body) || NAMED_PROVIDER.test(post.body));
}

export function getQualifiedPosts<T extends FeedItem>(items: T[], activeMonitorId?: number, fallbackToAll = true) {
  const qualified = getAllQualifiedPosts(items);
  const active = activeMonitorId ? qualified.filter(({ monitor }) => monitor.id === activeMonitorId) : qualified;
  return active.length || !fallbackToAll ? active : qualified;
}

export function getAllQualifiedPosts<T extends FeedItem>(items: T[]) {
  const seen = new Set<string>();
  return items.filter(({ post }) => {
    if (post.source === "demo" || post.ruleScore < 50 || !isConcreteBuyerRequest(post)) return false;
    const key = post.xPostId ? `x:${post.xPostId}` : `saved:${post.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getDiscoverPreview<T>(items: T[], limit = 10) {
  return items.slice(0, Math.max(1, limit));
}

export function filterFeedByTime<T extends FeedItem>(items: T[], filter: FeedTimeFilter, now = new Date()) {
  if (filter === "all") return items;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7));
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return items.filter(({ post }) => {
    if (!post.postedAt) return false;
    const postedAt = new Date(post.postedAt);
    if (Number.isNaN(postedAt.getTime())) return false;
    if (filter === "today") return postedAt >= dayStart;
    if (filter === "this_week") return postedAt >= weekStart && postedAt < nextWeekStart;
    if (filter === "last_week") return postedAt >= lastWeekStart && postedAt < weekStart;
    return postedAt >= monthStart;
  });
}

export function getRequestCategory(post: { body?: string }) {
  const body = (post.body ?? "").toLowerCase();
  if (/(ai video|ugc video|video production|video editor|video automation)/.test(body)) return "AI video";
  if (/(ai agent|agents|agentic)/.test(body)) return "AI agents";
  if (/(automate|automation|zapier|n8n)/.test(body)) return "Automation";
  if (/(product test|user test|qa|quality assurance|bug test|validate)/.test(body)) return "Product testing";
  if (/(contest|competition|challenge|bounty)/.test(body)) return "Contests & bounties";
  if (/(social media|content post|content creation|creator|distribution|publish)/.test(body)) return "Content & social";
  if (/(developer|engineer|software|app development|web development|api integration)/.test(body)) return "Development";
  if (/(research|prototype|product design|ux|ui design)/.test(body)) return "Research & design";
  if (/(workflow|intake|support|sales)/.test(body)) return "Custom AI workflow";
  return "AI implementation";
}
