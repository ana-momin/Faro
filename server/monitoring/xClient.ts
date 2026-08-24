export type XApiPost = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  public_metrics?: Record<string, number>;
};

export type XApiUser = { id: string; username?: string; name?: string; profileImageUrl?: string; profile_image_url?: string };

export type RecentSearchResult = {
  posts: XApiPost[];
  users: XApiUser[];
  newestId?: string;
  nextToken?: string;
};

export type PublicSearchResult = RecentSearchResult & {
  source: "recent_search" | "twitterapi_io";
  latencyLabel: string;
};

export function dedupePosts(posts: XApiPost[]) {
  const seen = new Set<string>();
  return posts.filter(post => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

export function recentSearchStatus(streamEnabled: boolean) {
  return {
    source: "recent_search" as const,
    latencyLabel: streamEnabled ? "Recent Search fallback; stream rule configured" : "Recent Search fallback",
  };
}

export class XApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "XApiError";
  }
}

const X_API_BASE = "https://api.x.com/2";
const TWITTERAPI_IO_MIN_INTERVAL_MS = 5_200;
let twitterApiIoQueue: Promise<void> = Promise.resolve();
let lastTwitterApiIoRequestAt = 0;

async function waitForTwitterApiIoRequestSlot() {
  if (process.env.VITEST) return;
  let releaseSlot: (() => void) | undefined;
  const previous = twitterApiIoQueue;
  twitterApiIoQueue = new Promise<void>(resolve => { releaseSlot = resolve; });
  await previous;
  try {
    const delay = Math.max(0, lastTwitterApiIoRequestAt + TWITTERAPI_IO_MIN_INTERVAL_MS - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastTwitterApiIoRequestAt = Date.now();
  } finally {
    releaseSlot?.();
  }
}

function bearerToken() {
  const token = process.env.X_API_BEARER_TOKEN;
  if (!token) throw new XApiError(401, "X API token is not configured.");
  return token;
}

async function xRequest(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const response = await fetch(`${X_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${bearerToken()}`, ...(init.headers ?? {}) },
  });

  const transient = response.status === 429 || response.status >= 500;
  if (transient && attempt < 2) {
    const retryAfterHeader = Number(response.headers.get("retry-after") || 0);
    const retryAfterMs = retryAfterHeader > 0 ? Math.min(retryAfterHeader * 1000, 4_000) : 600 * (attempt + 1);
    await new Promise(resolve => setTimeout(resolve, retryAfterMs));
    return xRequest(path, init, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new XApiError(response.status, body.slice(0, 600) || `X API returned HTTP ${response.status}.`);
  }
  return response;
}

export async function fetchRecentSearch(query: string, cursor?: { newestId?: string | null; nextToken?: string | null }) {
  const params = new URLSearchParams({
    query,
    max_results: "25",
    expansions: "author_id",
    "tweet.fields": "author_id,created_at,lang,public_metrics",
    "user.fields": "id,name,username,profile_image_url",
  });
  if (cursor?.newestId) params.set("since_id", cursor.newestId);
  if (cursor?.nextToken) params.set("next_token", cursor.nextToken);

  const response = await xRequest(`/tweets/search/recent?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: XApiPost[];
    includes?: { users?: XApiUser[] };
    meta?: { newest_id?: string; next_token?: string };
  };
  const users = (payload.includes?.users ?? []).map(user => ({ ...user, profileImageUrl: user.profile_image_url ?? user.profileImageUrl }));
  return {
    posts: payload.data ?? [],
    users,
    newestId: payload.meta?.newest_id,
    nextToken: payload.meta?.next_token,
  } satisfies RecentSearchResult;
}

type TwitterApiIoTweet = {
  id?: string;
  tweetId?: string;
  text?: string;
  fullText?: string;
  createdAt?: string;
  created_at?: string;
  lang?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  author?: { id?: string; userName?: string; username?: string; name?: string; profilePicture?: string; profileImageUrl?: string; profile_image_url?: string; avatar?: string };
};

function twitterApiIoKey() {
  return process.env.TWITTERAPI_IO_KEY;
}

function twitterApiIoQuery(query: string) {
  return query.replaceAll("-is:retweet", "-filter:retweets");
}

export async function fetchTwitterApiIoSearch(query: string, cursor?: string | null): Promise<PublicSearchResult> {
  const apiKey = twitterApiIoKey();
  if (!apiKey) throw new XApiError(401, "TwitterAPI.io key is not configured.");
  const params = new URLSearchParams({ query: twitterApiIoQuery(query), queryType: "Latest", cursor: cursor ?? "" });
  const request = async (attempt = 0): Promise<Response> => {
    await waitForTwitterApiIoRequestSlot();
    const response = await fetch(`https://api.twitterapi.io/twitter/tweet/advanced_search?${params.toString()}`, {
      headers: { "X-API-Key": apiKey },
    });
    if (response.status === 429 && attempt < 1) return request(attempt + 1);
    return response;
  };
  const response = await request();
  if (!response.ok) {
    const body = await response.text();
    throw new XApiError(response.status, `TwitterAPI.io: ${body.slice(0, 600) || `HTTP ${response.status}.`}`);
  }
  const payload = (await response.json()) as { tweets?: TwitterApiIoTweet[]; has_next_page?: boolean; hasNextPage?: boolean; next_cursor?: string; nextCursor?: string };
  const users: XApiUser[] = [];
  const posts: XApiPost[] = [];
  for (const tweet of payload.tweets ?? []) {
    const id = tweet.id ?? tweet.tweetId;
    const text = tweet.text ?? tweet.fullText;
    if (!id || !text) continue;
    const authorId = tweet.author?.id;
    if (authorId) users.push({ id: authorId, username: tweet.author?.userName ?? tweet.author?.username, name: tweet.author?.name, profileImageUrl: tweet.author?.profilePicture ?? tweet.author?.profileImageUrl ?? tweet.author?.profile_image_url ?? tweet.author?.avatar });
    posts.push({
      id,
      text,
      author_id: authorId,
      created_at: tweet.createdAt ?? tweet.created_at,
      lang: tweet.lang,
      public_metrics: {
        like_count: Number(tweet.likeCount ?? 0),
        reply_count: Number(tweet.replyCount ?? 0),
        repost_count: Number(tweet.retweetCount ?? 0),
        quote_count: Number(tweet.quoteCount ?? 0),
      },
    });
  }
  return {
    posts,
    users,
    newestId: posts[0]?.id,
    nextToken: payload.has_next_page === false || payload.hasNextPage === false ? undefined : payload.next_cursor ?? payload.nextCursor,
    source: "twitterapi_io",
    latencyLabel: "TwitterAPI.io Advanced Search · latest public posts",
  };
}

export async function fetchPublicPosts(query: string, cursor?: { newestId?: string | null; nextToken?: string | null }): Promise<PublicSearchResult> {
  if (twitterApiIoKey()) {
    return fetchTwitterApiIoSearch(query, cursor?.nextToken);
  }
  const result = await fetchRecentSearch(query, cursor);
  return { ...result, ...recentSearchStatus(filteredStreamRequested()) };
}

export async function upsertFilteredStreamRule(value: string, tag: string) {
  const current = await xRequest("/tweets/search/stream/rules");
  const existing = (await current.json()) as { data?: Array<{ id: string; value: string; tag?: string }> };
  if (existing.data?.some(rule => rule.value === value)) return { configured: true, created: false };

  await xRequest("/tweets/search/stream/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ add: [{ value, tag }] }),
  });
  return { configured: true, created: true };
}

/**
 * Reserved-hosting integration point. A persistent worker can call this and
 * write each streamed post through the same normalizer used by Recent Search.
 * It is intentionally never started on autoscale hosting.
 */
export async function openFilteredStream(signal: AbortSignal) {
  return xRequest(
    "/tweets/search/stream?expansions=author_id&tweet.fields=author_id,created_at,lang,public_metrics&user.fields=id,name,username",
    { signal },
  );
}

export function filteredStreamRequested() {
  return process.env.X_FILTERED_STREAM_ENABLED === "true";
}

export function filteredStreamWorkerEnabled() {
  return filteredStreamRequested() && process.env.SIGNALFORGE_PERSISTENT_WORKER === "true";
}

export type FilteredStreamEvent = {
  data?: XApiPost;
  includes?: { users?: XApiUser[] };
  matching_rules?: Array<{ id?: string; tag?: string }>;
};

export async function consumeFilteredStream(
  signal: AbortSignal,
  onEvent: (event: FilteredStreamEvent) => Promise<void>,
) {
  const response = await openFilteredStream(signal);
  if (!response.body) throw new Error("Filtered Stream returned no response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const payload = line.trim();
      if (!payload || payload.startsWith(":")) continue;
      try {
        await onEvent(JSON.parse(payload) as FilteredStreamEvent);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
}
