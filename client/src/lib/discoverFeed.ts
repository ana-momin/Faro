export type FeedPost = { id: number; xPostId?: string | null; source: string; ruleScore: number; reviewStatus: "pending" | "approved" | "rejected"; body?: string; postedAt?: string | Date | null; authorName?: string | null; authorHandle?: string | null; authorAvatarUrl?: string | null };
export type FeedItem = { post: FeedPost; monitor: { id: number } };
export type FeedTimeFilter = "all" | "today" | "last_7_days" | "last_month";

const CONCRETE_BUYER_ACTION = "(looking for (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:(?:ai|automation) )?expert|an? consultant|a specialist|a contractor)|looking to hire|need(?:s)? (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:(?:ai|automation) )?expert|an? consultant|a specialist|a contractor|a team)|need(?:s)? (?:help|a hand) (?:building|automating|implementing|setting up|creating|integrating)|seeking (?:a provider|an? (?:(?:ai|automation) )?expert)|can someone (?:build|set up|implement)|can anyone recommend|who can (?:build|help us)|recommend (?:someone|a freelancer|an? agency)|does anyone know an? (?:developer|agency|freelancer|consultant|(?:ai|automation) expert)|anyone know an? (?:developer|agency|freelancer|(?:ai|automation) expert)|recommendations for an? (?:developer|agency|freelancer)|looking to outsource|hire (?:a |an ))";
const CONCRETE_BUYER_REQUEST = new RegExp(`\\b(i(?:'m| am)?|we(?:'re| are)?|our (?:team|company|business)|my (?:team|business|company)|our|my)\\b.{0,90}${CONCRETE_BUYER_ACTION}\\b`, "i");
const OPENING_BUYER_REQUEST = /^\s*(?:looking for (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant)|looking to hire\b|need(?:s)? (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant|a team)|need(?:s)? (?:help|a hand)\b|seeking (?:a provider|an? (?:ai )?expert)|can someone (?:build|set up|implement)\b|who can (?:build|help us)\b|recommend (?:someone|a freelancer|an? agency)|does anyone know an? (?:developer|agency|freelancer|consultant)|anyone know an? (?:developer|agency|freelancer)|recommendations for an? (?:developer|agency|freelancer)|looking to outsource\b|hire (?:a |an ))/i;
const DELIVERY_SCOPE = /\b(build|implement|set up|setup|automate|integrate|configure|develop|create|produce|edit|manage|design|launch|maintain|streamline|install|test|validate|research|audit|debug|fix|clean up|migrate|document|ship|publish|post|submit|enter)\b/i;
const NAMED_PROVIDER = /\b(freelancer|agency|consultant|expert|specialist|developer|engineer|tester|designer|creator|editor|contractor|vendor)\b/i;

export function isConcreteBuyerRequest(post: FeedPost) {
  if (!post.body) return false;
  if (/\b(?:looking for|seeking|open to)\b.{0,45}\b(?:role|position|employment|job|work)\b/i.test(post.body)) return false;
  const buyerAsk = CONCRETE_BUYER_REQUEST.test(post.body) || OPENING_BUYER_REQUEST.test(post.body);
  const intent = (post as FeedPost & { aiIntent?: { label?: string; confidence?: number } }).aiIntent;
  const semanticBuyer = intent?.label === "Active help-seeking" && (intent.confidence ?? 0) >= 0.8;
  return DELIVERY_SCOPE.test(post.body) && (buyerAsk || semanticBuyer);
}

export function getQualifiedPosts<T extends FeedItem>(items: T[], activeMonitorId?: number, fallbackToAll = true) {
  const qualified = getAllQualifiedPosts(items);
  const active = activeMonitorId ? qualified.filter(({ monitor }) => monitor.id === activeMonitorId) : qualified;
  return active.length || !fallbackToAll ? active : qualified;
}

export function getAllQualifiedPosts<T extends FeedItem>(items: T[]) {
  const seen = new Set<string>();
  const accepted: T[] = [];
  return items.filter(item => {
    const { post } = item;
    if (post.source === "demo" || post.ruleScore < 50 || !isConcreteBuyerRequest(post) || isLowSignalNoise(post)) return false;
    const key = post.xPostId ? `x:${post.xPostId}` : `saved:${post.id}`;
    if (seen.has(key)) return false;
    if (accepted.some(previous => isNearDuplicate(previous.post, post))) return false;
    seen.add(key);
    accepted.push(item);
    return true;
  });
}

function normalizedWords(body = "") {
  return body.toLowerCase().replace(/https?:\/\/\S+|@\w+/g, " ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(word => word.length > 2 && !["the", "and", "for", "with", "that", "this", "from", "your", "our", "you", "are", "was", "have", "need", "looking"].includes(word));
}

export function isNearDuplicate(first: { body?: string; authorHandle?: string | null }, second: { body?: string; authorHandle?: string | null }) {
  const left = new Set(normalizedWords(first.body));
  const right = new Set(normalizedWords(second.body));
  if (!left.size || !right.size) return false;
  const overlap = Array.from(left).filter(word => right.has(word)).length;
  const similarity = overlap / Math.min(left.size, right.size);
  const sameAuthor = Boolean(first.authorHandle && second.authorHandle && first.authorHandle === second.authorHandle);
  return similarity >= 0.82 || (sameAuthor && similarity >= 0.58);
}

export function isLowSignalNoise(post: { body?: string }) {
  const body = post.body ?? "";
  const promotion = /\b(webinar|newsletter|link in bio|free guide|follow me|limited spots|book a call|dm me for|my agency|we offer)\b/i.test(body);
  const explicitBuyerVoice = /\b(i(?:'m| am)|we(?:'re| are)|our|my)\b.{0,90}\b(need|looking for|seeking|hire|recommend)/i.test(body);
  return promotion && !explicitBuyerVoice;
}

export function getMatchReason(post: { body?: string }) {
  const body = post.body ?? "";
  const category = getRequestCategory({ body });
  if (/\b(recommend|does anyone know|anyone know|recommendations?)\b/i.test(body)) return `Seeking a ${category.toLowerCase()} recommendation`;
  if (/\b(need|needs|looking for|seeking|hire|outsource)\b/i.test(body)) return `Direct request for ${category.toLowerCase()} help`;
  return `Concrete ${category.toLowerCase()} delivery need`;
}

export function prioritizeCurrentMonth<T extends FeedItem>(items: T[], now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const timestamp = (item: T) => {
    const raw = item.post.postedAt;
    if (!raw) return 0;
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };
  const currentMonth: T[] = [];
  const older: T[] = [];
  items.forEach(item => (timestamp(item) >= monthStart ? currentMonth : older).push(item));
  const newestFirst = (left: T, right: T) => timestamp(right) - timestamp(left);
  return [...currentMonth.sort(newestFirst), ...older.sort(newestFirst)];
}

export function getDiscoverPreview<T>(items: T[], limit = 10) {
  return items.slice(0, Math.max(1, limit));
}

export function filterFeedByTime<T extends FeedItem>(items: T[], filter: FeedTimeFilter, now = new Date()) {
  if (filter === "all") return items;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(dayStart);
  sevenDaysAgo.setDate(dayStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return items.filter(({ post }) => {
    if (!post.postedAt) return false;
    const postedAt = new Date(post.postedAt);
    if (Number.isNaN(postedAt.getTime())) return false;
    if (filter === "today") return postedAt >= dayStart;
    if (filter === "last_7_days") return postedAt >= sevenDaysAgo;
    return postedAt >= lastMonthStart && postedAt < monthStart;
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
