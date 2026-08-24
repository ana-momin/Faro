export type FeedPost = { id: number; source: string; ruleScore: number; reviewStatus: "pending" | "approved" | "rejected" };
export type FeedItem = { post: FeedPost; monitor: { id: number } };

export function getQualifiedPosts<T extends FeedItem>(items: T[], activeMonitorId?: number, fallbackToAll = true) {
  const qualified = items.filter(({ post }) => post.source !== "demo" && post.ruleScore >= 55);
  const active = activeMonitorId ? qualified.filter(({ monitor }) => monitor.id === activeMonitorId) : qualified;
  return active.length || !fallbackToAll ? active : qualified;
}

export function getDiscoverPreview<T>(items: T[], limit = 6) {
  return items.slice(0, Math.max(1, limit));
}
