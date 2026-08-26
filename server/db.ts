import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  hiddenPosts,
  listenedPosts,
  monitoringCriteria,
  monitorQueryStates,
  monitorSyncRuns,
  monitorSyncs,
  providerConnections,
  postAlertDeliveries,
  postReviews,
  passkeyChallenges,
  passkeyCredentials,
  savedPosts,
  users,
} from "../drizzle/renderSchema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "avatarUrl", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: { ...updateSet, updatedAt: new Date() } as any,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}

export async function createPasskeyUser(input: { openId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [user] = await db.insert(users).values({
    openId: input.openId,
    loginMethod: "passkey",
    lastSignedIn: new Date(),
  }).returning();
  return user;
}

export async function completePasskeyProfile(userId: number, input: { name: string; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [user] = await db.update(users).set({
    name: input.name,
    email: input.email || null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId)).returning();
  return user;
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function createPasskeyChallenge(input: { challenge: string; purpose: "register" | "authenticate"; userId?: number | null; profileName?: string | null; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [record] = await db.insert(passkeyChallenges).values({
    ...input,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  }).returning();
  return record;
}

export async function consumePasskeyChallenge(challenge: string, purpose: "register" | "authenticate") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [record] = await tx.select().from(passkeyChallenges).where(and(eq(passkeyChallenges.challenge, challenge), eq(passkeyChallenges.purpose, purpose))).limit(1);
    if (!record || record.expiresAt.getTime() < Date.now()) return undefined;
    await tx.delete(passkeyChallenges).where(eq(passkeyChallenges.id, record.id));
    return record;
  });
}

export async function savePasskeyCredential(input: { userId: number; credentialId: string; publicKey: string; counter: number; transports: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(passkeyCredentials).values(input).onConflictDoUpdate({
    target: passkeyCredentials.credentialId,
    set: { publicKey: input.publicKey, counter: input.counter, transports: input.transports, updatedAt: new Date() },
  });
}

export async function getPasskeyCredential(credentialId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(passkeyCredentials).where(eq(passkeyCredentials.credentialId, credentialId)).limit(1);
  return rows[0];
}

export async function updatePasskeyCounter(credentialId: string, counter: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(passkeyCredentials).set({ counter, updatedAt: new Date() }).where(eq(passkeyCredentials.credentialId, credentialId));
}

export async function updateUserAvatar(userId: number, avatarUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
}

export async function listMonitorsWithSync(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ monitor: monitoringCriteria, sync: monitorSyncs })
    .from(monitoringCriteria)
    .leftJoin(monitorSyncs, eq(monitorSyncs.monitorId, monitoringCriteria.id))
    .where(eq(monitoringCriteria.userId, userId))
    .orderBy(desc(monitoringCriteria.updatedAt));
}

export async function getMonitorForUser(monitorId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(monitoringCriteria)
    .where(and(eq(monitoringCriteria.id, monitorId), eq(monitoringCriteria.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listActiveMonitors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitoringCriteria).where(eq(monitoringCriteria.status, "active"));
}

/** Select an oldest-first slice so recurring polls cannot starve earlier monitors. */
export async function listActiveMonitorsForPolling(limit: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ monitor: monitoringCriteria })
    .from(monitoringCriteria)
    .leftJoin(monitorSyncs, eq(monitorSyncs.monitorId, monitoringCriteria.id))
    .where(eq(monitoringCriteria.status, "active"))
    .orderBy(asc(monitorSyncs.lastSyncedAt), asc(monitoringCriteria.id))
    .limit(Math.min(Math.max(limit, 1), 20));
  return rows.map(row => row.monitor);
}

export async function createMonitor(input: typeof monitoringCriteria.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(monitoringCriteria).values(input).returning({ id: monitoringCriteria.id });
  return result.id;
}

export async function updateMonitorStatus(monitorId: number, userId: number, status: "active" | "paused") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(monitoringCriteria)
    .set({ status })
    .where(and(eq(monitoringCriteria.id, monitorId), eq(monitoringCriteria.userId, userId)));
}

export async function renameMonitor(monitorId: number, userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(monitoringCriteria).set({ name }).where(and(eq(monitoringCriteria.id, monitorId), eq(monitoringCriteria.userId, userId)));
}

export async function deleteMonitorForUser(monitorId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const owned = await tx.select({ id: monitoringCriteria.id }).from(monitoringCriteria)
      .where(and(eq(monitoringCriteria.id, monitorId), eq(monitoringCriteria.userId, userId))).limit(1);
    if (!owned[0]) return false;
    const postRows = await tx.select({ id: listenedPosts.id }).from(listenedPosts).where(eq(listenedPosts.monitorId, monitorId));
    const postIds = postRows.map(row => row.id);
    if (postIds.length) {
      await tx.delete(postReviews).where(inArray(postReviews.postId, postIds));
      await tx.delete(savedPosts).where(inArray(savedPosts.postId, postIds));
      await tx.delete(postAlertDeliveries).where(inArray(postAlertDeliveries.postId, postIds));
      await tx.delete(listenedPosts).where(inArray(listenedPosts.id, postIds));
    }
    await tx.delete(monitorQueryStates).where(eq(monitorQueryStates.monitorId, monitorId));
    await tx.delete(monitorSyncRuns).where(eq(monitorSyncRuns.monitorId, monitorId));
    await tx.delete(monitorSyncs).where(eq(monitorSyncs.monitorId, monitorId));
    await tx.delete(monitoringCriteria).where(eq(monitoringCriteria.id, monitorId));
    return true;
  });
}

export async function listPostsForUser(userId: number, monitorId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(monitoringCriteria.userId, userId)];
  if (monitorId) conditions.push(eq(listenedPosts.monitorId, monitorId));
  return db
    .select({ post: listenedPosts, monitorName: monitoringCriteria.name, monitor: monitoringCriteria, savedAt: savedPosts.createdAt, savedNote: savedPosts.note, savedPriority: savedPosts.priority })
    .from(listenedPosts)
    .innerJoin(monitoringCriteria, eq(monitoringCriteria.id, listenedPosts.monitorId))
    .leftJoin(savedPosts, and(eq(savedPosts.postId, listenedPosts.id), eq(savedPosts.userId, userId)))
    .where(and(...conditions))
    .orderBy(desc(listenedPosts.ruleScore), desc(listenedPosts.postedAt))
    .limit(200);
}

export async function listSavedPostsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ post: listenedPosts, monitorName: monitoringCriteria.name, monitor: monitoringCriteria, savedAt: savedPosts.createdAt, savedNote: savedPosts.note, savedPriority: savedPosts.priority })
    .from(savedPosts)
    .innerJoin(listenedPosts, eq(listenedPosts.id, savedPosts.postId))
    .innerJoin(monitoringCriteria, eq(monitoringCriteria.id, listenedPosts.monitorId))
    .where(and(eq(savedPosts.userId, userId), eq(monitoringCriteria.userId, userId)))
    .orderBy(desc(savedPosts.createdAt))
    .limit(100);
}

export async function savePostForUser(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(savedPosts).values({ postId, userId }).onConflictDoUpdate({
    target: [savedPosts.userId, savedPosts.postId],
    set: { createdAt: new Date(), updatedAt: new Date() },
  });
}

export async function unsavePostForUser(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(savedPosts).where(and(eq(savedPosts.postId, postId), eq(savedPosts.userId, userId)));
}

export async function hidePostForUser(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const owned = await tx
      .select({ xPostId: listenedPosts.xPostId })
      .from(listenedPosts)
      .innerJoin(monitoringCriteria, eq(monitoringCriteria.id, listenedPosts.monitorId))
      .where(and(eq(listenedPosts.id, postId), eq(monitoringCriteria.userId, userId)))
      .limit(1);
    if (!owned[0]) return false;
    await tx.insert(hiddenPosts).values({ userId, xPostId: owned[0].xPostId }).onConflictDoUpdate({
      target: [hiddenPosts.userId, hiddenPosts.xPostId],
      set: { createdAt: new Date() },
    });
    return true;
  });
}

export async function listHiddenPostIdsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ xPostId: hiddenPosts.xPostId }).from(hiddenPosts).where(eq(hiddenPosts.userId, userId));
  return rows.map(row => row.xPostId);
}

export async function updateSavedPostForUser(postId: number, userId: number, input: { note?: string | null; priority?: "normal" | "high" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const values: { note?: string | null; priority?: "normal" | "high"; updatedAt: Date } = { updatedAt: new Date() };
  if (input.note !== undefined) values.note = input.note;
  if (input.priority !== undefined) values.priority = input.priority;
  await db.update(savedPosts).set(values).where(and(eq(savedPosts.postId, postId), eq(savedPosts.userId, userId)));
}

export async function claimPostAlertForUser(postId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(postAlertDeliveries).values({ postId, userId });
    return true;
  } catch {
    return false;
  }
}

export async function releasePostAlertForUser(postId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(postAlertDeliveries).where(and(eq(postAlertDeliveries.postId, postId), eq(postAlertDeliveries.userId, userId)));
}

export async function listPostsForMonitor(monitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listenedPosts).where(eq(listenedPosts.monitorId, monitorId));
}

export async function upsertListenedPost(input: typeof listenedPosts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(listenedPosts).values(input).onConflictDoUpdate({
    target: [listenedPosts.monitorId, listenedPosts.xPostId],
    set: {
      authorId: input.authorId,
      authorHandle: input.authorHandle,
      authorName: input.authorName,
      authorAvatarUrl: input.authorAvatarUrl,
      body: input.body,
      postUrl: input.postUrl,
      postedAt: input.postedAt,
      capturedAt: new Date(),
      language: input.language,
      engagement: input.engagement,
      matchedRule: input.matchedRule,
      ruleScore: input.ruleScore,
      scoreExplanation: input.scoreExplanation,
      aiIntent: input.aiIntent,
    },
  });
  const rows = await db.select({ id: listenedPosts.id }).from(listenedPosts)
    .where(and(eq(listenedPosts.monitorId, input.monitorId), eq(listenedPosts.xPostId, input.xPostId))).limit(1);
  return rows[0]?.id;
}

export async function recordSync(monitorId: number, state: Omit<typeof monitorSyncs.$inferInsert, "monitorId">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(monitorSyncs).values({ monitorId, ...state }).onConflictDoUpdate({
    target: monitorSyncs.monitorId,
    set: { ...state, updatedAt: new Date() },
  });
}

export async function getSyncState(monitorId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(monitorSyncs).where(eq(monitorSyncs.monitorId, monitorId)).limit(1);
  return rows[0];
}

export async function listMonitorQueryStates(monitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(monitorQueryStates)
    .where(eq(monitorQueryStates.monitorId, monitorId))
    .orderBy(desc(monitorQueryStates.updatedAt));
}

export async function saveMonitorQueryState(
  monitorId: number,
  state: Omit<typeof monitorQueryStates.$inferInsert, "monitorId">,
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(monitorQueryStates).values({ monitorId, ...state }).onConflictDoUpdate({
    target: [monitorQueryStates.monitorId, monitorQueryStates.familyId, monitorQueryStates.queryHash],
    set: { ...state, updatedAt: new Date() },
  });
}

export async function recordMonitorSyncRun(input: typeof monitorSyncRuns.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(monitorSyncRuns).values(input);
}

export async function listRecentMonitorSyncRuns(monitorId: number, limit = 24) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(monitorSyncRuns)
    .where(eq(monitorSyncRuns.monitorId, monitorId))
    .orderBy(desc(monitorSyncRuns.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function countMonitorSyncRunsSince(startedAt: Date) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: monitorSyncRuns.id })
    .from(monitorSyncRuns)
    .where(gte(monitorSyncRuns.createdAt, startedAt));
  return rows.length;
}

export async function countMonitorSyncRunsForUserSince(userId: number, startedAt: Date) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: monitorSyncRuns.id })
    .from(monitorSyncRuns)
    .innerJoin(monitoringCriteria, eq(monitoringCriteria.id, monitorSyncRuns.monitorId))
    .where(and(eq(monitoringCriteria.userId, userId), gte(monitorSyncRuns.createdAt, startedAt)));
  return rows.length;
}

export async function getProviderConnectionForUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertProviderConnectionForUser(input: typeof providerConnections.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(providerConnections).values(input).onConflictDoUpdate({
    target: providerConnections.userId,
    set: {
      provider: input.provider,
      encryptedCredential: input.encryptedCredential,
      credentialHint: input.credentialHint,
      dailyRequestLimit: input.dailyRequestLimit,
      automaticCollection: input.automaticCollection,
      updatedAt: new Date(),
    },
  });
}

export async function updateProviderDailyRequestLimitForUser(userId: number, dailyRequestLimit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(providerConnections).set({ dailyRequestLimit, updatedAt: new Date() }).where(eq(providerConnections.userId, userId));
}

export async function deleteProviderConnectionForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(providerConnections).where(eq(providerConnections.userId, userId));
}

export async function countActiveMonitorsForUser(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const monitors = await db
    .select({ id: monitoringCriteria.id })
    .from(monitoringCriteria)
    .where(and(eq(monitoringCriteria.userId, userId), eq(monitoringCriteria.status, "active")));
  return monitors.length;
}

export async function saveReview(postId: number, userId: number, decision: "approved" | "rejected", note?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => {
    await tx.update(listenedPosts).set({ reviewStatus: decision, reviewedAt: new Date() }).where(eq(listenedPosts.id, postId));
    await tx.insert(postReviews).values({ postId, userId, decision, note: note || null });
  });
}

export async function getPostForUser(postId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ post: listenedPosts, monitor: monitoringCriteria })
    .from(listenedPosts)
    .innerJoin(monitoringCriteria, eq(monitoringCriteria.id, listenedPosts.monitorId))
    .where(and(eq(listenedPosts.id, postId), eq(monitoringCriteria.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function hasDemoMonitor(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: monitoringCriteria.id })
    .from(monitoringCriteria)
    .where(and(eq(monitoringCriteria.userId, userId), eq(monitoringCriteria.name, "Demo: AI workflow requests")))
    .limit(1);
  return Boolean(rows[0]);
}

export async function countPostsForMonitors(monitorIds: number[]) {
  const db = await getDb();
  if (!db || !monitorIds.length) return [];
  return db.select().from(listenedPosts).where(inArray(listenedPosts.monitorId, monitorIds));
}
