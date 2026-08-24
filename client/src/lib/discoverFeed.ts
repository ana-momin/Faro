export type FeedPost = { id: number; source: string; ruleScore: number; reviewStatus: "pending" | "approved" | "rejected"; body?: string };
export type FeedItem = { post: FeedPost; monitor: { id: number } };

export function getQualifiedPosts<T extends FeedItem>(items: T[], activeMonitorId?: number, fallbackToAll = true) {
  const qualified = items.filter(({ post }) => post.source !== "demo" && post.ruleScore >= 55);
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
