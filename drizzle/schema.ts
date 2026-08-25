import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const monitoringCriteria = mysqlTable(
  "monitoring_criteria",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    goal: text("goal").notNull(),
    xQuery: varchar("xQuery", { length: 1024 }).notNull(),
    includeTerms: json("includeTerms").$type<string[]>().notNull(),
    excludeTerms: json("excludeTerms").$type<string[]>().notNull(),
    categories: json("categories").$type<string[]>().notNull(),
    status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("monitoring_criteria_user_idx").on(table.userId)],
);

export const monitorSyncs = mysqlTable(
  "monitor_syncs",
  {
    id: int("id").autoincrement().primaryKey(),
    monitorId: int("monitorId").notNull(),
    source: mysqlEnum("source", ["filtered_stream", "recent_search", "twitterapi_io", "demo"]).default("recent_search").notNull(),
    status: mysqlEnum("status", ["idle", "healthy", "degraded", "rate_limited", "payment_required", "error"]).default("idle").notNull(),
    latencyLabel: varchar("latencyLabel", { length: 80 }).default("Not synced").notNull(),
    newestPostId: varchar("newestPostId", { length: 64 }),
    nextToken: text("nextToken"),
    lastSyncedAt: timestamp("lastSyncedAt"),
    lastSuccessAt: timestamp("lastSuccessAt"),
    lastError: text("lastError"),
    lastDurationMs: int("lastDurationMs"),
    retryCount: int("retryCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("monitor_sync_monitor_unique").on(table.monitorId)],
);

/**
 * Independent continuation state for each discovery-query family. Keeping this
 * separate from the monitor summary prevents one family from overwriting the
 * paging cursor of another family during a bounded polling cycle.
 */
export const monitorQueryStates = mysqlTable(
  "monitor_query_states",
  {
    id: int("id").autoincrement().primaryKey(),
    monitorId: int("monitorId").notNull(),
    familyId: varchar("familyId", { length: 48 }).notNull(),
    queryHash: varchar("queryHash", { length: 64 }).notNull(),
    queryPreview: varchar("queryPreview", { length: 240 }).notNull(),
    nextToken: text("nextToken"),
    newestPostId: varchar("newestPostId", { length: 64 }),
    pagesFetched: int("pagesFetched").default(0).notNull(),
    exhausted: mysqlEnum("exhausted", ["no", "yes"]).default("no").notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    lastSuccessAt: timestamp("lastSuccessAt"),
    lastError: text("lastError"),
    retryCount: int("retryCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("monitor_query_state_unique").on(table.monitorId, table.familyId, table.queryHash),
    index("monitor_query_state_monitor_idx").on(table.monitorId, table.updatedAt),
  ],
);

/**
 * One immutable ledger row per provider request/page. It makes provider spend
 * and discovery yield inspectable without storing provider credentials.
 */
export const monitorSyncRuns = mysqlTable(
  "monitor_sync_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    monitorId: int("monitorId").notNull(),
    familyId: varchar("familyId", { length: 48 }).notNull(),
    queryHash: varchar("queryHash", { length: 64 }).notNull(),
    pageNumber: int("pageNumber").notNull(),
    source: mysqlEnum("source", ["filtered_stream", "recent_search", "twitterapi_io", "demo"]).default("twitterapi_io").notNull(),
    status: mysqlEnum("status", ["healthy", "degraded", "rate_limited", "payment_required", "error"]).notNull(),
    rawReceived: int("rawReceived").default(0).notNull(),
    deduplicatedPosts: int("deduplicatedPosts").default(0).notNull(),
    buyerCandidates: int("buyerCandidates").default(0).notNull(),
    persistedPosts: int("persistedPosts").default(0).notNull(),
    queueWaitMs: int("queueWaitMs").default(0).notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    error: varchar("error", { length: 1000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("monitor_sync_run_monitor_idx").on(table.monitorId, table.createdAt),
    index("monitor_sync_run_family_idx").on(table.monitorId, table.familyId, table.createdAt),
  ],
);

export const listenedPosts = mysqlTable(
  "listened_posts",
  {
    id: int("id").autoincrement().primaryKey(),
    monitorId: int("monitorId").notNull(),
    xPostId: varchar("xPostId", { length: 64 }).notNull(),
    authorId: varchar("authorId", { length: 64 }),
    authorHandle: varchar("authorHandle", { length: 80 }),
    authorName: varchar("authorName", { length: 160 }),
    authorAvatarUrl: varchar("authorAvatarUrl", { length: 1024 }),
    body: text("body").notNull(),
    postUrl: varchar("postUrl", { length: 512 }),
    postedAt: timestamp("postedAt").notNull(),
    capturedAt: timestamp("capturedAt").defaultNow().notNull(),
    language: varchar("language", { length: 24 }),
    engagement: json("engagement").$type<Record<string, number>>().notNull(),
    matchedRule: varchar("matchedRule", { length: 1024 }).notNull(),
    source: mysqlEnum("source", ["x_api", "demo"]).default("x_api").notNull(),
    ruleScore: int("ruleScore").default(0).notNull(),
    scoreExplanation: json("scoreExplanation").$type<Array<{ label: string; points: number }>>().notNull(),
    aiIntent: json("aiIntent").$type<{ label: string; confidence: number; rationale: string; model: string; fallback: boolean }>().notNull(),
    reviewStatus: mysqlEnum("reviewStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  table => [
    uniqueIndex("listened_post_unique").on(table.monitorId, table.xPostId),
    index("listened_post_monitor_score_idx").on(table.monitorId, table.ruleScore),
    index("listened_post_review_idx").on(table.reviewStatus),
  ],
);

export const postReviews = mysqlTable(
  "post_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId").notNull(),
    userId: int("userId").notNull(),
    decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
    note: varchar("note", { length: 1000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("post_review_post_idx").on(table.postId)],
);

/** A private bookmark list; saving never triggers an external X action. */
export const savedPosts = mysqlTable(
  "saved_posts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    postId: int("postId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("saved_post_user_post_unique").on(table.userId, table.postId),
    index("saved_post_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export type MonitoringCriterion = typeof monitoringCriteria.$inferSelect;
export type ListenedPost = typeof listenedPosts.$inferSelect;
export type MonitorQueryState = typeof monitorQueryStates.$inferSelect;
export type MonitorSyncRun = typeof monitorSyncRuns.$inferSelect;
export type SavedPost = typeof savedPosts.$inferSelect;
