import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../_core/env";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  listPostsForUser: vi.fn(),
  claimPostAlertForUser: vi.fn(),
  releasePostAlertForUser: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("../db", () => ({
  getUserById: mocks.getUserById,
  listPostsForUser: mocks.listPostsForUser,
  claimPostAlertForUser: mocks.claimPostAlertForUser,
  releasePostAlertForUser: mocks.releasePostAlertForUser,
}));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { notifyPreferredHighConfidenceSignals } from "./alerts";

const monitor = { id: 4, userId: 9, name: "Automation", goal: "Find automation needs", xQuery: "automation", includeTerms: ["automation"], excludeTerms: [], categories: [], status: "active" as const, createdAt: new Date(), updatedAt: new Date() };

describe("Faro preferred high-confidence alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies the project owner once for a high-confidence signal matching explicitly retained topics", async () => {
    mocks.getUserById.mockResolvedValue({ openId: ENV.ownerOpenId });
    mocks.listPostsForUser.mockResolvedValue([{ post: { body: "Need someone to automate our client intake.", reviewStatus: "approved" }, savedAt: null }]);
    mocks.claimPostAlertForUser.mockResolvedValue(true);
    mocks.notifyOwner.mockResolvedValue(true);
    const delivered = await notifyPreferredHighConfidenceSignals(monitor, [{ postId: 42, confidence: 0.93, label: "Active help-seeking", score: 87, body: "We need help with automation for our sales workflow.", authorName: "Founder" }]);
    expect(delivered).toBe(1);
    expect(mocks.claimPostAlertForUser).toHaveBeenCalledWith(42, 9);
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("skips non-owner monitors and releases a claim when delivery is unavailable", async () => {
    mocks.getUserById.mockResolvedValue({ openId: "another-user" });
    await notifyPreferredHighConfidenceSignals(monitor, [{ postId: 43, confidence: 0.95, label: "Active help-seeking", score: 90, body: "We need automation help.", authorName: "Founder" }]);
    expect(mocks.claimPostAlertForUser).not.toHaveBeenCalled();
    mocks.getUserById.mockResolvedValue({ openId: ENV.ownerOpenId });
    mocks.listPostsForUser.mockResolvedValue([{ post: { body: "Need someone to automate our client intake.", reviewStatus: "approved" }, savedAt: null }]);
    mocks.claimPostAlertForUser.mockResolvedValue(true);
    mocks.notifyOwner.mockResolvedValue(false);
    await notifyPreferredHighConfidenceSignals(monitor, [{ postId: 44, confidence: 0.95, label: "Active help-seeking", score: 90, body: "We need automation help.", authorName: "Founder" }]);
    expect(mocks.releasePostAlertForUser).toHaveBeenCalledWith(44, 9);
  });
});
