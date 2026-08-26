import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const createdAt = timestamp("createdAt", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 191 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: varchar("avatarUrl", { length: 2048 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("passkey"),
  role: varchar("role", { length: 16 }).$type<"user" | "admin">().notNull().default("user"),
  createdAt,
  updatedAt,
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const passkeyCredentials = pgTable("passkey_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  credentialId: varchar("credentialId", { length: 1024 }).notNull().unique(),
  publicKey: text("publicKey").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>().notNull().default([]),
  createdAt,
  updatedAt,
}, table => [index("passkey_credential_user_idx").on(table.userId)]);

export const passkeyChallenges = pgTable("passkey_challenges", {
  id: serial("id").primaryKey(),
  challenge: varchar("challenge", { length: 512 }).notNull().unique(),
  purpose: varchar("purpose", { length: 16 }).notNull(),
  userId: integer("userId"),
  profileName: text("profileName"),
  email: varchar("email", { length: 320 }),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt,
}, table => [index("passkey_challenge_expiry_idx").on(table.expiresAt)]);

export const monitoringCriteria = pgTable("monitoring_criteria", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  goal: text("goal").notNull(),
  xQuery: varchar("xQuery", { length: 1024 }).notNull(),
  includeTerms: jsonb("includeTerms").$type<string[]>().notNull(),
  excludeTerms: jsonb("excludeTerms").$type<string[]>().notNull(),
  categories: jsonb("categories").$type<string[]>().notNull(),
  status: varchar("status", { length: 16 }).$type<"active" | "paused">().notNull().default("active"),
  createdAt,
  updatedAt,
}, table => [index("monitoring_criteria_user_idx").on(table.userId)]);

export const monitorSyncs = pgTable("monitor_syncs", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitorId").notNull().unique(),
  source: varchar("source", { length: 32 }).$type<"filtered_stream" | "recent_search" | "twitterapi_io" | "demo">().notNull().default("recent_search"),
  status: varchar("status", { length: 32 }).$type<"idle" | "healthy" | "degraded" | "rate_limited" | "payment_required" | "error">().notNull().default("idle"),
  latencyLabel: varchar("latencyLabel", { length: 80 }).notNull().default("Not synced"),
  newestPostId: varchar("newestPostId", { length: 128 }),
  nextToken: text("nextToken"),
  lastSyncedAt: timestamp("lastSyncedAt", { withTimezone: true }),
  lastSuccessAt: timestamp("lastSuccessAt", { withTimezone: true }),
  lastError: text("lastError"),
  lastDurationMs: integer("lastDurationMs"),
  retryCount: integer("retryCount").notNull().default(0),
  createdAt,
  updatedAt,
});

export const monitorQueryStates = pgTable("monitor_query_states", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitorId").notNull(),
  familyId: varchar("familyId", { length: 48 }).notNull(),
  queryHash: varchar("queryHash", { length: 64 }).notNull(),
  queryPreview: varchar("queryPreview", { length: 240 }).notNull(),
  nextToken: text("nextToken"),
  newestPostId: varchar("newestPostId", { length: 128 }),
  pagesFetched: integer("pagesFetched").notNull().default(0),
  exhausted: varchar("exhausted", { length: 8 }).$type<"no" | "yes">().notNull().default("no"),
  lastSyncedAt: timestamp("lastSyncedAt", { withTimezone: true }),
  lastSuccessAt: timestamp("lastSuccessAt", { withTimezone: true }),
  lastError: text("lastError"),
  retryCount: integer("retryCount").notNull().default(0),
  createdAt,
  updatedAt,
}, table => [
  uniqueIndex("monitor_query_state_unique").on(table.monitorId, table.familyId, table.queryHash),
  index("monitor_query_state_monitor_idx").on(table.monitorId, table.updatedAt),
]);

export const monitorSyncRuns = pgTable("monitor_sync_runs", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitorId").notNull(),
  familyId: varchar("familyId", { length: 48 }).notNull(),
  queryHash: varchar("queryHash", { length: 64 }).notNull(),
  pageNumber: integer("pageNumber").notNull(),
  source: varchar("source", { length: 32 }).$type<"filtered_stream" | "recent_search" | "twitterapi_io" | "demo">().notNull().default("twitterapi_io"),
  status: varchar("status", { length: 32 }).$type<"healthy" | "degraded" | "rate_limited" | "payment_required" | "error">().notNull(),
  rawReceived: integer("rawReceived").notNull().default(0),
  deduplicatedPosts: integer("deduplicatedPosts").notNull().default(0),
  buyerCandidates: integer("buyerCandidates").notNull().default(0),
  persistedPosts: integer("persistedPosts").notNull().default(0),
  queueWaitMs: integer("queueWaitMs").notNull().default(0),
  durationMs: integer("durationMs").notNull().default(0),
  error: varchar("error", { length: 1000 }),
  createdAt,
}, table => [
  index("monitor_sync_run_monitor_idx").on(table.monitorId, table.createdAt),
  index("monitor_sync_run_family_idx").on(table.monitorId, table.familyId, table.createdAt),
]);

export const providerConnections = pgTable("provider_connections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  provider: varchar("provider", { length: 32 }).$type<"twitterapi_io" | "official_x">().notNull(),
  encryptedCredential: text("encryptedCredential").notNull(),
  credentialHint: varchar("credentialHint", { length: 16 }).notNull(),
  dailyRequestLimit: integer("dailyRequestLimit").notNull().default(20),
  automaticCollection: boolean("automaticCollection").notNull().default(false),
  createdAt,
  updatedAt,
});

export const listenedPosts = pgTable("listened_posts", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitorId").notNull(),
  xPostId: varchar("xPostId", { length: 128 }).notNull(),
  authorId: varchar("authorId", { length: 128 }),
  authorHandle: varchar("authorHandle", { length: 80 }),
  authorName: varchar("authorName", { length: 160 }),
  authorAvatarUrl: varchar("authorAvatarUrl", { length: 2048 }),
  body: text("body").notNull(),
  postUrl: varchar("postUrl", { length: 1024 }),
  postedAt: timestamp("postedAt", { withTimezone: true }).notNull(),
  capturedAt: timestamp("capturedAt", { withTimezone: true }).defaultNow().notNull(),
  language: varchar("language", { length: 24 }),
  engagement: jsonb("engagement").$type<Record<string, number>>().notNull(),
  matchedRule: varchar("matchedRule", { length: 1024 }).notNull(),
  source: varchar("source", { length: 16 }).$type<"x_api" | "demo">().notNull().default("x_api"),
  ruleScore: integer("ruleScore").notNull().default(0),
  scoreExplanation: jsonb("scoreExplanation").$type<Array<{ label: string; points: number }>>().notNull(),
  aiIntent: jsonb("aiIntent").$type<{ label: string; confidence: number; rationale: string; model: string; fallback: boolean }>().notNull(),
  reviewStatus: varchar("reviewStatus", { length: 16 }).$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
}, table => [
  uniqueIndex("listened_post_unique").on(table.monitorId, table.xPostId),
  index("listened_post_monitor_score_idx").on(table.monitorId, table.ruleScore),
  index("listened_post_review_idx").on(table.reviewStatus),
]);

export const postReviews = pgTable("post_reviews", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull(),
  userId: integer("userId").notNull(),
  decision: varchar("decision", { length: 16 }).$type<"approved" | "rejected">().notNull(),
  note: varchar("note", { length: 1000 }),
  createdAt,
}, table => [index("post_review_post_idx").on(table.postId)]);

export const savedPosts = pgTable("saved_posts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  postId: integer("postId").notNull(),
  note: varchar("note", { length: 1000 }),
  priority: varchar("priority", { length: 16 }).$type<"normal" | "high">().notNull().default("normal"),
  createdAt,
  updatedAt,
}, table => [
  uniqueIndex("saved_post_user_post_unique").on(table.userId, table.postId),
  index("saved_post_user_created_idx").on(table.userId, table.createdAt),
]);

export const hiddenPosts = pgTable("hidden_posts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  xPostId: varchar("xPostId", { length: 128 }).notNull(),
  createdAt,
}, table => [
  uniqueIndex("hidden_post_user_x_post_unique").on(table.userId, table.xPostId),
  index("hidden_post_user_created_idx").on(table.userId, table.createdAt),
]);

export const postAlertDeliveries = pgTable("post_alert_deliveries", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  postId: integer("postId").notNull(),
  createdAt,
}, table => [
  uniqueIndex("post_alert_user_post_unique").on(table.userId, table.postId),
  index("post_alert_user_created_idx").on(table.userId, table.createdAt),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
