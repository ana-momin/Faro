import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  listenedPosts,
  monitoringCriteria,
  monitorSyncs,
  postReviews,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
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

export async function createMonitor(input: typeof monitoringCriteria.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(monitoringCriteria).values(input);
  return Number(result[0].insertId);
}

export async function updateMonitorStatus(monitorId: number, userId: number, status: "active" | "paused") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(monitoringCriteria)
    .set({ status })
    .where(and(eq(monitoringCriteria.id, monitorId), eq(monitoringCriteria.userId, userId)));
}

export async function listPostsForUser(userId: number, monitorId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(monitoringCriteria.userId, userId)];
  if (monitorId) conditions.push(eq(listenedPosts.monitorId, monitorId));
  return db
    .select({ post: listenedPosts, monitorName: monitoringCriteria.name, monitor: monitoringCriteria })
    .from(listenedPosts)
    .innerJoin(monitoringCriteria, eq(monitoringCriteria.id, listenedPosts.monitorId))
    .where(and(...conditions))
    .orderBy(desc(listenedPosts.ruleScore), desc(listenedPosts.postedAt))
    .limit(200);
}

export async function listPostsForMonitor(monitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listenedPosts).where(eq(listenedPosts.monitorId, monitorId));
}

export async function upsertListenedPost(input: typeof listenedPosts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(listenedPosts).values(input).onDuplicateKeyUpdate({
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
}

export async function recordSync(monitorId: number, state: Omit<typeof monitorSyncs.$inferInsert, "monitorId">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(monitorSyncs).values({ monitorId, ...state }).onDuplicateKeyUpdate({
    set: { ...state, updatedAt: new Date() },
  });
}

export async function getSyncState(monitorId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(monitorSyncs).where(eq(monitorSyncs.monitorId, monitorId)).limit(1);
  return rows[0];
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
