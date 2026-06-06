/**
 * LAYER 1: Store Logic Tests
 *
 * Tests every data operation that the old Flask+GCS app got wrong.
 * These run in <1 second with no network, no browser, no DB.
 *
 * Failure modes covered:
 * - Toggle delete creates/removes exactly one vote
 * - Batch operations don't duplicate or lose votes
 * - Two users' votes are fully independent
 * - Rapid toggling doesn't corrupt state
 * - Vote counts always add up (the invariant)
 * - Undo doesn't touch the other user's data
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  toggleDelete,
  batchDelete,
  batchUndoDelete,
  _resetForTest,
  _getVotesRaw,
} from "../store";
import type { Vote } from "../mockData";

beforeEach(() => {
  _resetForTest([]);
});

// ─── SINGLE VOTE OPERATIONS ───────────────────────────────────

describe("toggleDelete", () => {
  it("creates a vote when none exists", () => {
    toggleDelete(1, "reviewer1");
    const votes = _getVotesRaw();
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({
      photoId: 1,
      userId: "reviewer1",
      action: "delete",
    });
    expect(votes[0].votedAt).toBeTruthy();
  });

  it("removes the vote on second toggle (undo)", () => {
    toggleDelete(1, "reviewer1");
    expect(_getVotesRaw()).toHaveLength(1);
    toggleDelete(1, "reviewer1");
    expect(_getVotesRaw()).toHaveLength(0);
  });

  it("toggle-toggle-toggle leaves exactly one vote", () => {
    toggleDelete(1, "reviewer1");
    toggleDelete(1, "reviewer1");
    toggleDelete(1, "reviewer1");
    const votes = _getVotesRaw();
    expect(votes).toHaveLength(1);
    expect(votes[0].photoId).toBe(1);
  });

  it("does not create duplicate votes for the same photo+user", () => {
    toggleDelete(5, "reviewer1");
    // Force a second insert by manipulating — but our toggle should prevent it
    toggleDelete(5, "reviewer1"); // this removes
    toggleDelete(5, "reviewer1"); // this re-adds
    const user1Votes = _getVotesRaw().filter(
      (v) => v.photoId === 5 && v.userId === "reviewer1"
    );
    expect(user1Votes).toHaveLength(1);
  });
});

// ─── TWO-USER INDEPENDENCE ────────────────────────────────────
// THE critical test: user1's actions never touch user2's data
// (Old app failed this — overwriting the shared JSON blob)

describe("two-user independence", () => {
  it("user1 delete does not affect user2 votes", () => {
    toggleDelete(10, "reviewer2");
    toggleDelete(10, "reviewer1");
    const votes = _getVotesRaw();
    expect(votes.filter((v) => v.userId === "reviewer2")).toHaveLength(1);
    expect(votes.filter((v) => v.userId === "reviewer1")).toHaveLength(1);
    expect(votes).toHaveLength(2);
  });

  it("user1 undo does not remove user2's vote on same photo", () => {
    toggleDelete(10, "reviewer1");
    toggleDelete(10, "reviewer2");
    // user1 undoes their delete
    toggleDelete(10, "reviewer1");
    const votes = _getVotesRaw();
    expect(votes.filter((v) => v.userId === "reviewer1")).toHaveLength(0);
    expect(votes.filter((v) => v.userId === "reviewer2")).toHaveLength(1);
  });

  it("both users can delete the same photo independently", () => {
    toggleDelete(42, "reviewer1");
    toggleDelete(42, "reviewer2");
    const votes = _getVotesRaw();
    const photo42votes = votes.filter((v) => v.photoId === 42);
    expect(photo42votes).toHaveLength(2);
    expect(photo42votes.map((v) => v.userId).sort()).toEqual(["reviewer1", "reviewer2"]);
  });

  it("batch delete by user1 does not touch user2 existing votes", () => {
    toggleDelete(1, "reviewer2");
    toggleDelete(2, "reviewer2");
    toggleDelete(3, "reviewer2");
    batchDelete([1, 2, 3, 4, 5], "reviewer1");
    const votes = _getVotesRaw();
    expect(votes.filter((v) => v.userId === "reviewer2")).toHaveLength(3);
    expect(votes.filter((v) => v.userId === "reviewer1")).toHaveLength(5);
  });

  it("batch undo by user1 does not touch user2 votes on same photos", () => {
    batchDelete([10, 20, 30], "reviewer1");
    batchDelete([10, 20, 30], "reviewer2");
    batchUndoDelete([10, 20, 30], "reviewer1");
    const votes = _getVotesRaw();
    expect(votes.filter((v) => v.userId === "reviewer1")).toHaveLength(0);
    expect(votes.filter((v) => v.userId === "reviewer2")).toHaveLength(3);
  });
});

// ─── BATCH OPERATIONS ─────────────────────────────────────────

describe("batchDelete", () => {
  it("creates votes for all specified photos", () => {
    batchDelete([1, 2, 3, 4, 5], "reviewer1");
    const votes = _getVotesRaw();
    expect(votes).toHaveLength(5);
    expect(votes.map((v) => v.photoId).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("skips photos already deleted (no duplicates)", () => {
    toggleDelete(3, "reviewer1");
    batchDelete([1, 2, 3, 4, 5], "reviewer1");
    const user1Votes = _getVotesRaw().filter((v) => v.userId === "reviewer1");
    expect(user1Votes).toHaveLength(5);
    const photo3Votes = user1Votes.filter((v) => v.photoId === 3);
    expect(photo3Votes).toHaveLength(1);
  });

  it("handles empty array gracefully", () => {
    batchDelete([], "reviewer1");
    expect(_getVotesRaw()).toHaveLength(0);
  });

  it("handles large batch (1000 photos)", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => i + 1);
    batchDelete(ids, "reviewer1");
    expect(_getVotesRaw()).toHaveLength(1000);
  });
});

describe("batchUndoDelete", () => {
  it("removes votes for specified photos only", () => {
    batchDelete([1, 2, 3, 4, 5], "reviewer1");
    batchUndoDelete([2, 4], "reviewer1");
    const remaining = _getVotesRaw().map((v) => v.photoId).sort();
    expect(remaining).toEqual([1, 3, 5]);
  });

  it("does nothing when undoing photos not deleted", () => {
    batchDelete([1, 2], "reviewer1");
    batchUndoDelete([99, 100], "reviewer1");
    expect(_getVotesRaw()).toHaveLength(2);
  });
});

// ─── RAPID-FIRE OPERATIONS ────────────────────────────────────
// Simulates fast clicking — the old app lost data here due to
// stale read-modify-write cycles

describe("rapid-fire operations (simulate fast clicking)", () => {
  it("100 rapid toggles on the same photo end in correct state", () => {
    for (let i = 0; i < 100; i++) {
      toggleDelete(1, "reviewer1");
    }
    // 100 toggles = even number = back to no vote
    expect(
      _getVotesRaw().filter((v) => v.photoId === 1 && v.userId === "reviewer1")
    ).toHaveLength(0);
  });

  it("101 rapid toggles on the same photo end in correct state", () => {
    for (let i = 0; i < 101; i++) {
      toggleDelete(1, "reviewer1");
    }
    // 101 toggles = odd number = one vote
    expect(
      _getVotesRaw().filter((v) => v.photoId === 1 && v.userId === "reviewer1")
    ).toHaveLength(1);
  });

  it("interleaved rapid operations from both users", () => {
    for (let i = 1; i <= 50; i++) {
      toggleDelete(i, "reviewer1");
      toggleDelete(i, "reviewer2");
    }
    expect(_getVotesRaw().filter((v) => v.userId === "reviewer1")).toHaveLength(50);
    expect(_getVotesRaw().filter((v) => v.userId === "reviewer2")).toHaveLength(50);
  });

  it("batch delete then rapid individual undos", () => {
    batchDelete([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "reviewer1");
    // Rapidly undo odds
    for (const id of [1, 3, 5, 7, 9]) {
      toggleDelete(id, "reviewer1");
    }
    const remaining = _getVotesRaw()
      .filter((v) => v.userId === "reviewer1")
      .map((v) => v.photoId)
      .sort((a, b) => a - b);
    expect(remaining).toEqual([2, 4, 6, 8, 10]);
  });
});

// ─── COUNT INVARIANT ──────────────────────────────────────────
// After any sequence of operations, the counts must add up.
// Old app failed: total_progress decreased between saves.

describe("count invariant", () => {
  it("total votes = user1 votes + user2 votes (always)", () => {
    // Random-ish operations
    batchDelete([1, 2, 3, 4, 5], "reviewer1");
    batchDelete([3, 4, 5, 6, 7], "reviewer2");
    toggleDelete(1, "reviewer1"); // undo
    toggleDelete(8, "reviewer2");
    batchUndoDelete([6], "reviewer2");

    const votes = _getVotesRaw();
    const u1 = votes.filter((v) => v.userId === "reviewer1").length;
    const u2 = votes.filter((v) => v.userId === "reviewer2").length;
    expect(votes.length).toBe(u1 + u2);
  });

  it("no orphan votes (every vote has a valid userId)", () => {
    batchDelete([1, 2, 3], "reviewer1");
    batchDelete([4, 5, 6], "reviewer2");
    toggleDelete(1, "reviewer1");
    const votes = _getVotesRaw();
    for (const v of votes) {
      expect(["reviewer1", "reviewer2"]).toContain(v.userId);
      expect(v.action).toBe("delete");
      expect(v.photoId).toBeGreaterThan(0);
    }
  });

  it("delete count never exceeds total photos for a user", () => {
    const totalPhotos = 4023;
    const ids = Array.from({ length: totalPhotos }, (_, i) => i + 1);
    batchDelete(ids, "reviewer1");
    const u1Votes = _getVotesRaw().filter((v) => v.userId === "reviewer1");
    expect(u1Votes.length).toBeLessThanOrEqual(totalPhotos);
    expect(u1Votes.length).toBe(totalPhotos);
    // Delete them all again — should not create duplicates
    batchDelete(ids, "reviewer1");
    const u1VotesAfter = _getVotesRaw().filter((v) => v.userId === "reviewer1");
    expect(u1VotesAfter.length).toBe(totalPhotos);
  });
});

// ─── PRELOADED STATE ──────────────────────────────────────────
// Simulates resuming a session where the DB already has votes

describe("preloaded state (resume session)", () => {
  it("existing votes survive new operations", () => {
    const existing: Vote[] = [
      { photoId: 100, userId: "reviewer1", action: "delete", votedAt: "2026-04-20T10:00:00Z" },
      { photoId: 200, userId: "reviewer1", action: "delete", votedAt: "2026-04-20T10:01:00Z" },
      { photoId: 100, userId: "reviewer2", action: "delete", votedAt: "2026-04-20T11:00:00Z" },
    ];
    _resetForTest(existing);

    toggleDelete(300, "reviewer1");
    const votes = _getVotesRaw();
    expect(votes).toHaveLength(4);
    expect(votes.find((v) => v.photoId === 100 && v.userId === "reviewer1")).toBeTruthy();
    expect(votes.find((v) => v.photoId === 200 && v.userId === "reviewer1")).toBeTruthy();
    expect(votes.find((v) => v.photoId === 100 && v.userId === "reviewer2")).toBeTruthy();
    expect(votes.find((v) => v.photoId === 300 && v.userId === "reviewer1")).toBeTruthy();
  });

  it("toggle on preloaded vote removes it correctly", () => {
    const existing: Vote[] = [
      { photoId: 100, userId: "reviewer1", action: "delete", votedAt: "2026-04-20T10:00:00Z" },
      { photoId: 200, userId: "reviewer2", action: "delete", votedAt: "2026-04-20T10:00:00Z" },
    ];
    _resetForTest(existing);

    toggleDelete(100, "reviewer1"); // undo the preloaded vote
    const votes = _getVotesRaw();
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ photoId: 200, userId: "reviewer2" });
  });
});

// ─── STRESS TEST ──────────────────────────────────────────────

describe("stress test (full 4023 photos)", () => {
  it("both users delete all 4023 photos, then one undoes all", () => {
    const allIds = Array.from({ length: 4023 }, (_, i) => i + 1);
    batchDelete(allIds, "reviewer1");
    batchDelete(allIds, "reviewer2");
    expect(_getVotesRaw()).toHaveLength(4023 * 2);

    batchUndoDelete(allIds, "reviewer1");
    const votes = _getVotesRaw();
    expect(votes.filter((v) => v.userId === "reviewer1")).toHaveLength(0);
    expect(votes.filter((v) => v.userId === "reviewer2")).toHaveLength(4023);
  });

  it("alternating deletes across full set maintain consistency", () => {
    const allIds = Array.from({ length: 4023 }, (_, i) => i + 1);
    // user1 deletes evens, user2 deletes odds
    const evens = allIds.filter((id) => id % 2 === 0);
    const odds = allIds.filter((id) => id % 2 !== 0);
    batchDelete(evens, "reviewer1");
    batchDelete(odds, "reviewer2");

    const votes = _getVotesRaw();
    expect(votes.filter((v) => v.userId === "reviewer1")).toHaveLength(evens.length);
    expect(votes.filter((v) => v.userId === "reviewer2")).toHaveLength(odds.length);
    expect(votes.length).toBe(evens.length + odds.length);

    // No overlap — no photo has both users' votes
    const bothDeleted = allIds.filter((id) =>
      votes.some((v) => v.photoId === id && v.userId === "reviewer1") &&
      votes.some((v) => v.photoId === id && v.userId === "reviewer2")
    );
    expect(bothDeleted).toHaveLength(0);
  });
});
