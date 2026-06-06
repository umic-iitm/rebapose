/**
 * LAYER 3: Supabase Integration Tests
 *
 * Run AFTER wiring up Supabase. Tests the real database layer.
 * Simulates every failure mode from the old Flask+GCS app
 * against the actual production database.
 *
 * Usage:
 *   npx tsx tests/supabase-integration.ts
 *
 * Prerequisites:
 *   - Set SUPABASE_URL and SUPABASE_ANON_KEY env vars
 *   - OR edit the constants below
 *   - Uses a test conference/session that can be cleaned up
 */

// ── CONFIG (update when Supabase is wired up) ─────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const TEST_PREFIX = "__test_";

// ── TYPES ─────────────────────────────────────────────────────

interface Vote {
  photo_id: number;
  user_id: string;
  action: "delete";
  voted_at?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration_ms: number;
}

// ── SUPABASE CLIENT (minimal, no SDK needed) ──────────────────

async function supabaseQuery(
  table: string,
  method: "GET" | "POST" | "DELETE",
  params?: Record<string, string>,
  body?: unknown
): Promise<{ data: any; error: string | null; status: number }> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: method === "POST" ? "return=representation" : "return=minimal",
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `${res.status}: ${text}`, status: res.status };
  }

  const data = method === "DELETE" ? null : await res.json();
  return { data, error: null, status: res.status };
}

// ── TEST HELPERS ──────────────────────────────────────────────

async function insertVote(photoId: number, userId: string): Promise<boolean> {
  const { error } = await supabaseQuery("votes", "POST", undefined, {
    photo_id: photoId,
    user_id: `${TEST_PREFIX}${userId}`,
    action: "delete",
  });
  return !error;
}

async function deleteVote(photoId: number, userId: string): Promise<boolean> {
  const { error } = await supabaseQuery("votes", "DELETE", {
    photo_id: `eq.${photoId}`,
    user_id: `eq.${TEST_PREFIX}${userId}`,
  });
  return !error;
}

async function getVotes(userId?: string): Promise<Vote[]> {
  const params: Record<string, string> = {
    user_id: userId ? `eq.${TEST_PREFIX}${userId}` : `like.${TEST_PREFIX}%`,
    select: "*",
  };
  const { data, error } = await supabaseQuery("votes", "GET", params);
  if (error) return [];
  return data || [];
}

async function cleanupTestData(): Promise<void> {
  await supabaseQuery("votes", "DELETE", {
    user_id: `like.${TEST_PREFIX}%`,
  });
}

// ── TEST RUNNER ───────────────────────────────────────────────

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration_ms: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (e: any) {
    results.push({
      name,
      passed: false,
      error: e.message,
      duration_ms: Date.now() - start,
    });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── TESTS ─────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════");
  console.log(" SUPABASE INTEGRATION TESTS");
  console.log(" Simulating every old Flask+GCS failure mode");
  console.log("═══════════════════════════════════════════════\n");

  // Check connectivity first
  console.log("Checking Supabase connection...");
  const { error } = await supabaseQuery("votes", "GET", { limit: "1" });
  if (error) {
    console.error(`\n✗ Cannot connect to Supabase: ${error}`);
    console.error("  Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.");
    process.exit(1);
  }
  console.log("✓ Connected\n");

  await cleanupTestData();

  // ── 1. BASIC CRUD ─────────────────────────────────────────

  console.log("─── Basic CRUD ───");

  await runTest("Insert a single vote", async () => {
    const ok = await insertVote(1, "user1");
    assert(ok, "Insert failed");
    const votes = await getVotes("user1");
    assert(votes.length >= 1, `Expected >=1 vote, got ${votes.length}`);
  });

  await runTest("Read back the vote we just inserted", async () => {
    const votes = await getVotes("user1");
    const found = votes.find((v) => v.photo_id === 1);
    assert(!!found, "Vote for photo 1 not found");
    assert(found!.action === "delete", `Expected action=delete, got ${found!.action}`);
  });

  await runTest("Delete (undo) a vote", async () => {
    const ok = await deleteVote(1, "user1");
    assert(ok, "Delete failed");
    const votes = await getVotes("user1");
    const found = votes.find((v) => v.photo_id === 1);
    assert(!found, "Vote still exists after delete");
  });

  await cleanupTestData();

  // ── 2. OLD BUG: STALE READ-MODIFY-WRITE ──────────────────
  // The old app did: read all → modify in memory → write all back
  // If stale data was read, previous saves were overwritten.
  // New architecture: each vote is an independent row INSERT.

  console.log("\n─── Stale Read-Modify-Write (old GCS bug) ───");

  await runTest("Rapid sequential inserts don't lose data", async () => {
    const promises = [];
    for (let i = 1; i <= 20; i++) {
      promises.push(insertVote(i, "user1"));
    }
    // Execute sequentially to simulate page-by-page saves
    for (const p of promises) await p;

    const votes = await getVotes("user1");
    const ids = votes.map((v) => v.photo_id).sort((a, b) => a - b);
    assert(ids.length === 20, `Expected 20 votes, got ${ids.length}: [${ids}]`);
  });

  await cleanupTestData();

  await runTest("Parallel inserts from same user don't lose data", async () => {
    // Simulate clicking rapidly — all requests in flight simultaneously
    const promises = Array.from({ length: 20 }, (_, i) =>
      insertVote(i + 1, "user1")
    );
    const results = await Promise.all(promises);
    assert(results.every(Boolean), "Some inserts failed");

    const votes = await getVotes("user1");
    assert(votes.length === 20, `Expected 20 votes, got ${votes.length}`);
  });

  await cleanupTestData();

  // ── 3. OLD BUG: MULTI-INSTANCE CONFLICT ──────────────────
  // Two Cloud Run instances with separate caches would overwrite
  // each other's saves. Test: two users writing simultaneously.

  console.log("\n─── Multi-Instance / Two-User Conflict ───");

  await runTest("Simultaneous inserts from two users don't conflict", async () => {
    const user1Promises = Array.from({ length: 10 }, (_, i) =>
      insertVote(i + 1, "user1")
    );
    const user2Promises = Array.from({ length: 10 }, (_, i) =>
      insertVote(i + 1, "user2")
    );

    // Fire all simultaneously
    await Promise.all([...user1Promises, ...user2Promises]);

    const u1Votes = await getVotes("user1");
    const u2Votes = await getVotes("user2");
    assert(u1Votes.length === 10, `User1: expected 10, got ${u1Votes.length}`);
    assert(u2Votes.length === 10, `User2: expected 10, got ${u2Votes.length}`);
  });

  await cleanupTestData();

  await runTest("User1 deleting does not affect User2 votes", async () => {
    await insertVote(1, "user1");
    await insertVote(1, "user2");
    await insertVote(2, "user2");

    // User1 removes their vote on photo 1
    await deleteVote(1, "user1");

    const u2Votes = await getVotes("user2");
    assert(u2Votes.length === 2, `User2 should still have 2 votes, got ${u2Votes.length}`);

    const u1Votes = await getVotes("user1");
    assert(u1Votes.length === 0, `User1 should have 0 votes, got ${u1Votes.length}`);
  });

  await cleanupTestData();

  // ── 4. OLD BUG: SAVE THEN NAVIGATE LOSES DATA ────────────
  // The old app: POST /save → redirect → GET /review read stale blob.

  console.log("\n─── Save-Then-Read Consistency ───");

  await runTest("Write then immediate read returns the written data", async () => {
    await insertVote(42, "user1");
    // Immediately read back — no delay
    const votes = await getVotes("user1");
    const found = votes.find((v) => v.photo_id === 42);
    assert(!!found, "Immediate read after write failed — vote not found");
  });

  await cleanupTestData();

  await runTest("Write 50 votes then read all back immediately", async () => {
    for (let i = 1; i <= 50; i++) {
      await insertVote(i, "user1");
    }
    const votes = await getVotes("user1");
    assert(votes.length === 50, `Expected 50, got ${votes.length}`);
  });

  await cleanupTestData();

  // ── 5. STRESS TEST ────────────────────────────────────────

  console.log("\n─── Stress Test (simulated 4023 photos) ───");

  await runTest("Bulk insert 100 votes (batch)", async () => {
    // Supabase supports batch inserts
    const batch = Array.from({ length: 100 }, (_, i) => ({
      photo_id: i + 1,
      user_id: `${TEST_PREFIX}user1`,
      action: "delete" as const,
    }));
    const { error } = await supabaseQuery("votes", "POST", undefined, batch);
    assert(!error, `Batch insert failed: ${error}`);

    const votes = await getVotes("user1");
    assert(votes.length === 100, `Expected 100, got ${votes.length}`);
  });

  await cleanupTestData();

  await runTest("Interleaved inserts and deletes maintain count", async () => {
    // Insert 20
    for (let i = 1; i <= 20; i++) await insertVote(i, "user1");
    // Delete evens
    for (let i = 2; i <= 20; i += 2) await deleteVote(i, "user1");
    // Should have 10 remaining (odds)
    const votes = await getVotes("user1");
    assert(votes.length === 10, `Expected 10, got ${votes.length}`);
    const ids = votes.map((v) => v.photo_id).sort((a, b) => a - b);
    const expectedOdds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    assert(
      JSON.stringify(ids) === JSON.stringify(expectedOdds),
      `Expected odds, got ${ids}`
    );
  });

  await cleanupTestData();

  // ── 6. CONSENSUS QUERY ────────────────────────────────────

  console.log("\n─── Consensus Query ───");

  await runTest("Aggregate query: both-deleted count", async () => {
    // Both users delete photos 1-5
    for (let i = 1; i <= 5; i++) {
      await insertVote(i, "user1");
      await insertVote(i, "user2");
    }
    // Only user1 deletes 6-10
    for (let i = 6; i <= 10; i++) {
      await insertVote(i, "user1");
    }

    const u1 = await getVotes("user1");
    const u2 = await getVotes("user2");

    const u1Ids = new Set(u1.map((v) => v.photo_id));
    const u2Ids = new Set(u2.map((v) => v.photo_id));

    let bothCount = 0;
    for (const id of u1Ids) {
      if (u2Ids.has(id)) bothCount++;
    }

    assert(bothCount === 5, `Expected 5 both-deleted, got ${bothCount}`);
    assert(u1.length === 10, `User1 expected 10, got ${u1.length}`);
    assert(u2.length === 5, `User2 expected 5, got ${u2.length}`);
  });

  await cleanupTestData();

  // ── SUMMARY ───────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration_ms, 0);

  if (failed === 0) {
    console.log(` ALL ${total} TESTS PASSED (${totalTime}ms)`);
  } else {
    console.log(` ${passed}/${total} passed, ${failed} FAILED (${totalTime}ms)`);
    console.log("\n Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`   ✗ ${r.name}: ${r.error}`);
    }
  }
  console.log("═══════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
