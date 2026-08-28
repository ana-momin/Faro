import type { MonitoringCriterion } from "../../drizzle/renderSchema";
import { ENV } from "../_core/env";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { derivePreferredTopics, preferenceBoost } from "./preferences";

type PersistedSignal = { postId?: number; confidence: number; label: string; score: number; body: string; authorName: string };

/** Owner-only alerting: no outreach, no external post action, and one delivery per user/post. */
export async function notifyPreferredHighConfidenceSignals(monitor: MonitoringCriterion, signals: PersistedSignal[]) {
  const owner = await db.getUserById(monitor.userId);
  if (!owner || owner.openId !== ENV.ownerOpenId) return 0;
  const history = await db.listPostsForUser(monitor.userId);
  const topics = derivePreferredTopics(history);
  if (!topics.length) return 0;
  let delivered = 0;
  for (const signal of signals) {
    if (!signal.postId || signal.label !== "Active help-seeking" || signal.confidence < 0.88 || signal.score < 75) continue;
    const preference = preferenceBoost(signal.body, topics);
    if (!preference.points || !(await db.claimPostAlertForUser(signal.postId, monitor.userId))) continue;
    const accepted = await notifyOwner({
      title: "Faro: high-confidence preferred signal",
      content: `${signal.authorName}: ${signal.body.slice(0, 420)}`,
    });
    if (accepted) delivered += 1;
    else await db.releasePostAlertForUser(signal.postId, monitor.userId);
  }
  return delivered;
}
