const PREFERENCE_TOPICS: Array<{ id: string; expression: RegExp }> = [
  { id: "automation", expression: /\b(automation|automate|automating|n8n|zapier)\b/i },
  { id: "ai_agents", expression: /\b(ai agents?|agentic)\b/i },
  { id: "workflows", expression: /\b(workflow|intake|integration|implementation)\b/i },
  { id: "development", expression: /\b(developer|engineer|api|app|software|build)\b/i },
  { id: "ai_video", expression: /\b(ai video|ugc video|video automation|video editor)\b/i },
  { id: "product_testing", expression: /\b(product test|user test|qa|quality assurance|validate)\b/i },
  { id: "content", expression: /\b(content|social media|creator|publish|distribution)\b/i },
];

type PreferencePost = { post: { body: string; reviewStatus: "pending" | "approved" | "rejected" }; savedAt?: Date | null };

export function derivePreferredTopics(rows: PreferencePost[]) {
  const likedPosts = rows.filter(row => row.post.reviewStatus === "approved" || Boolean(row.savedAt));
  return PREFERENCE_TOPICS.filter(topic => likedPosts.some(row => topic.expression.test(row.post.body))).map(topic => topic.id);
}

export function preferenceBoost(body: string, topics: string[]) {
  const matches = PREFERENCE_TOPICS.filter(topic => topics.includes(topic.id) && topic.expression.test(body));
  return { points: Math.min(12, matches.length * 6), matches: matches.map(topic => topic.id) };
}
