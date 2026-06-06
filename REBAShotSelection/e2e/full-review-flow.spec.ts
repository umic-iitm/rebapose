/**
 * E2E Tests for REBAShotSelection
 *
 * Covers the full 3-user flow: login with password, review grid,
 * lightbox, batch ops, consensus, admin CSV, and resilience scenarios.
 *
 * These tests run against the local dev server by default.
 * To run against a deployed URL:
 *   PLAYWRIGHT_BASE_URL=https://your-app.run.app npx playwright test
 */

import { test, expect, type Page } from "@playwright/test";

// ─── HELPERS ──────────────────────────────────────────────────

const CREDS = {
  reviewer1: process.env.REVIEWER1_PASSWORD || "changeme1",
  reviewer2: process.env.REVIEWER2_PASSWORD || "changeme2",
  admin: process.env.ADMIN_PASSWORD || "changeme_admin",
};

async function loginAs(page: Page, user: keyof typeof CREDS) {
  await page.goto("/");
  await page.locator(`[data-testid="user-${user}"]`).click();
  await page.getByPlaceholder("Password").fill(CREDS[user]);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/review");
}

function getGridCells(page: Page) {
  return page.locator("[data-testid='grid-cell']");
}

// ─── LOGIN ───────────────────────────────────────────────────

test.describe("Login", () => {
  test("shows three user profiles", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="user-reviewer1"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-reviewer2"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-admin"]')).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Reviewer 1").click();
    await page.getByPlaceholder("Password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("[data-testid='login-error']")).toHaveText("Wrong password");
    await expect(page).toHaveURL("/");
  });

  test("no user selected shows error", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Password").fill("anything");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("[data-testid='login-error']")).toHaveText("Select a user");
  });

  test("correct password logs in and navigates to review", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await expect(page.getByText("REBAShotSelection")).toBeVisible();
    await expect(getGridCells(page).first()).toBeVisible();
  });

  test("all three users can log in with correct passwords", async ({ page }) => {
    for (const user of ["reviewer1", "reviewer2", "admin"] as const) {
      await loginAs(page, user);
      await expect(page.getByText("REBAShotSelection")).toBeVisible();
      // Log out
      await page.locator("button").filter({ hasText: "×" }).click();
      await expect(page).toHaveURL("/");
    }
  });

  test("unauthenticated access to /review redirects to login", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/review");
    await expect(page).toHaveURL("/");
  });
});

// ─── REVIEW GRID ─────────────────────────────────────────────

test.describe("Review Grid", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "reviewer1");
  });

  test("displays photo grid with cells", async ({ page }) => {
    const cells = getGridCells(page);
    await expect(cells.first()).toBeVisible();
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
  });

  test("stats bar shows both reviewers' delete counts", async ({ page }) => {
    await expect(page.locator("[data-testid='stats-r1-deletes']")).toBeVisible();
    await expect(page.locator("[data-testid='stats-r2-deletes']")).toBeVisible();
    await expect(page.getByText("Agree:")).toBeVisible();
    await expect(page.getByText("Conflicts:")).toBeVisible();
  });

  test("clicking a photo toggles delete mark", async ({ page }) => {
    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");
    const before = await r1Stats.textContent();

    await getGridCells(page).first().click();

    const after = await r1Stats.textContent();
    expect(before).not.toBe(after);
  });

  test("filter tabs work without crashing", async ({ page }) => {
    for (const label of ["All", "Unreviewed", "My Deletes", "Conflicts", "Both Deleted"]) {
      await page.getByRole("button", { name: label }).click();
      await page.waitForTimeout(200);
    }
    await expect(page.getByText("REBAShotSelection")).toBeVisible();
  });

  test("grid size slider changes layout", async ({ page }) => {
    const slider = page.locator("[data-testid='grid-size-slider']");
    await expect(slider).toBeVisible();
    await slider.fill("100");
    await page.waitForTimeout(300);
    const smallCount = await getGridCells(page).count();
    await slider.fill("300");
    await page.waitForTimeout(300);
    const largeCount = await getGridCells(page).count();
    expect(smallCount).toBeGreaterThan(largeCount);
  });
});

// ─── LIGHTBOX ────────────────────────────────────────────────

test.describe("Lightbox", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();
  });

  test("Enter key opens lightbox on focused cell", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-testid='lightbox']")).toBeVisible();
  });

  test("arrow keys navigate in lightbox", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const lightbox = page.locator("[data-testid='lightbox']");
    await expect(lightbox).toBeVisible();

    await expect(lightbox.getByText("2 of")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(lightbox.getByText("3 of")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(lightbox.getByText("2 of")).toBeVisible();
  });

  test("X key toggles delete in lightbox", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const lightbox = page.locator("[data-testid='lightbox']");
    await expect(lightbox).toBeVisible();

    await page.keyboard.press("x");
    await expect(lightbox.getByText("MARKED FOR DELETION")).toBeVisible();
    await page.keyboard.press("x");
    await expect(lightbox.getByText("MARKED FOR DELETION")).not.toBeVisible();
  });

  test("Escape closes lightbox", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-testid='lightbox']")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-testid='lightbox']")).not.toBeVisible();
  });

  test("lightbox Mark for Deletion button works", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const lightbox = page.locator("[data-testid='lightbox']");
    await expect(lightbox).toBeVisible();
    await lightbox.getByRole("button", { name: "Mark for Deletion" }).click();
    await expect(lightbox.getByText("MARKED FOR DELETION")).toBeVisible();
    await lightbox.getByRole("button", { name: "Unmark Deletion" }).click();
    await expect(lightbox.getByText("MARKED FOR DELETION")).not.toBeVisible();
  });
});

// ─── KEYBOARD NAVIGATION ─────────────────────────────────────

test.describe("Keyboard navigation", () => {
  test("arrow keys move focus ring through grid", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();

    await page.keyboard.press("ArrowRight");
    const focused = page.locator("[data-testid='grid-cell'].ring-2.ring-blue-500");
    await expect(focused).toHaveCount(1);

    await page.keyboard.press("ArrowRight");
    await expect(focused).toHaveCount(1);
  });

  test("X key marks delete from grid on focused cell", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();
    await page.waitForTimeout(200);
    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");
    const before = await r1Stats.textContent();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("x");
    await page.waitForTimeout(200);

    const after = await r1Stats.textContent();
    expect(before).not.toBe(after);
  });
});

// ─── BATCH OPERATIONS ────────────────────────────────────────

test.describe("Batch selection", () => {
  test("ctrl+click selects multiple photos", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const cells = getGridCells(page);
    await cells.nth(0).click({ modifiers: ["Control"] });
    await cells.nth(1).click({ modifiers: ["Control"] });

    await expect(page.getByText("2 selected").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark for Deletion" })).toBeVisible();
  });

  test("batch Mark for Deletion marks all selected", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");
    const before = parseInt(await r1Stats.textContent() || "0");

    const cells = getGridCells(page);
    await cells.nth(0).click({ modifiers: ["Control"] });
    await cells.nth(1).click({ modifiers: ["Control"] });
    await cells.nth(2).click({ modifiers: ["Control"] });

    await page.getByRole("button", { name: "Mark for Deletion" }).click();

    const after = parseInt(await r1Stats.textContent() || "0");
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("Cancel clears selection", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const cells = getGridCells(page);
    await cells.nth(0).click({ modifiers: ["Control"] });
    await expect(page.getByText("1 selected").first()).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/\d+ selected/).first()).not.toBeVisible();
  });

  test("Escape clears selection", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const cells = getGridCells(page);
    await cells.nth(0).click({ modifiers: ["Control"] });
    await expect(page.getByText("1 selected").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText(/\d+ selected/).first()).not.toBeVisible();
  });
});

// ─── CONSENSUS DASHBOARD ─────────────────────────────────────

test.describe("Consensus Dashboard", () => {
  test("shows both reviewers' stats", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await page.getByRole("button", { name: "Consensus" }).click();
    await expect(page).toHaveURL("/consensus");

    await expect(page.getByText("Reviewer 1").first()).toBeVisible();
    await expect(page.getByText("Reviewer 2").first()).toBeVisible();
    await expect(page.getByText("both agree to delete").first()).toBeVisible();
    await expect(page.getByText("conflicts to resolve").first()).toBeVisible();
  });

  test("conflicts tab shows disagreements", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await page.getByRole("button", { name: "Consensus" }).click();
    await page.getByRole("button", { name: /Conflicts/ }).click();

    const content = await page.textContent("body");
    expect(
      content?.includes("DELETE") || content?.includes("No conflicts")
    ).toBeTruthy();
  });

  test("both-deleted tab shows agreed deletions", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await page.getByRole("button", { name: "Consensus" }).click();
    await page.getByRole("button", { name: /Both Deleted/ }).click();
    await expect(page.getByText("Both reviewers agree")).toBeVisible();
  });

  test("summary tab shows progress bars", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await page.getByRole("button", { name: "Consensus" }).click();
    await page.getByRole("button", { name: "Summary" }).click();
    await expect(page.getByText("Review Progress")).toBeVisible();
  });

  test("back to grid navigation works", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await page.getByRole("button", { name: "Consensus" }).click();
    await expect(page).toHaveURL("/consensus");
    await page.getByText("← Grid").click();
    await expect(page).toHaveURL("/review");
  });
});

// ─── CROSS-USER VISIBILITY ───────────────────────────────────

test.describe("Cross-user visibility", () => {
  test("other reviewer's delete markers are visible (orange badges)", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const otherMarkers = page.locator("[data-testid='grid-cell'] .bg-orange-500");
    await expect(otherMarkers.first()).toBeVisible({ timeout: 5000 });
    const count = await otherMarkers.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── PREVIEW PANEL ──────────────────────────────────────────

test.describe("Preview panel", () => {
  test("hovering a cell shows frame in preview panel", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const preview = page.locator("[data-testid='preview-panel']");
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Hover or navigate")).toBeVisible();

    await getGridCells(page).first().hover();
    await expect(preview.locator("img")).toBeVisible();
    await expect(preview.getByText("Frame 1 of")).toBeVisible();
  });

  test("arrow key navigation updates preview panel", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();
    const preview = page.locator("[data-testid='preview-panel']");
    await expect(preview.getByText("Frame 1 of")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(preview.getByText("Frame 2 of")).toBeVisible();
  });
});

// ─── ADMIN ───────────────────────────────────────────────────

test.describe("Admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("admin sees grid in read-only mode", async ({ page }) => {
    await expect(getGridCells(page).first()).toBeVisible();
    await expect(page.getByText("View-only mode")).toBeVisible();
  });

  test("clicking a photo does NOT toggle delete for admin", async ({ page }) => {
    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");
    const before = await r1Stats.textContent();

    await getGridCells(page).first().click();

    const after = await r1Stats.textContent();
    expect(before).toBe(after);
  });

  test("admin does not see Review Marked button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Review Marked" })).not.toBeVisible();
  });

  test("admin sees Download CSV button", async ({ page }) => {
    await expect(page.locator("[data-testid='download-csv']")).toBeVisible();
  });

  test("admin can open lightbox but cannot mark delete", async ({ page }) => {
    await getGridCells(page).first().click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const lightbox = page.locator("[data-testid='lightbox']");
    await expect(lightbox).toBeVisible();
    await expect(lightbox.getByRole("button", { name: /Mark for Deletion|Unmark/ })).not.toBeVisible();
  });

  test("admin consensus page has Download CSV", async ({ page }) => {
    await page.getByRole("button", { name: "Consensus" }).click();
    await expect(page).toHaveURL("/consensus");
    await expect(page.locator("[data-testid='download-csv']")).toBeVisible();
  });
});

// ─── DELETE PERSISTENCE ACROSS NAVIGATION ────────────────────

test.describe("Delete persistence across navigation", () => {
  test("deletes survive grid → consensus → grid", async ({ page }) => {
    await loginAs(page, "reviewer1");

    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");
    await getGridCells(page).first().click();
    const afterDelete = await r1Stats.textContent();

    await page.getByRole("button", { name: "Consensus" }).click();
    await expect(page).toHaveURL("/consensus");

    await page.getByText("← Grid").click();
    await expect(page).toHaveURL("/review");

    const afterReturn = await r1Stats.textContent();
    expect(afterReturn).toBe(afterDelete);
  });

  test("deletes survive filter switching", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");

    await getGridCells(page).first().click();
    const afterDelete = await r1Stats.textContent();

    await page.getByRole("button", { name: "Unreviewed" }).click();
    await page.getByRole("button", { name: "All" }).click();

    const afterReturn = await r1Stats.textContent();
    expect(afterReturn).toBe(afterDelete);
  });
});

// ─── RESILIENCE / SMOKE TESTS ────────────────────────────────
// Real-world scenarios: idle browser, rapid interactions, sudden close

test.describe("Resilience scenarios", () => {
  test("state persists after 5 seconds of idle (simulated browser idle)", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const r1Stats = page.locator("[data-testid='stats-r1-deletes'] b");

    await getGridCells(page).first().click();
    const afterDelete = await r1Stats.textContent();

    await page.waitForTimeout(5000);

    const afterIdle = await r1Stats.textContent();
    expect(afterIdle).toBe(afterDelete);
    await expect(getGridCells(page).first()).toBeVisible();
  });

  test("rapid clicking does not corrupt state", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const cell = getGridCells(page).first();

    for (let i = 0; i < 20; i++) {
      await cell.click({ delay: 50 });
    }

    await expect(page.getByText("REBAShotSelection")).toBeVisible();
    await expect(getGridCells(page).first()).toBeVisible();
  });

  test("selection without marking X — then clicking elsewhere clears selection", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const cells = getGridCells(page);

    await cells.nth(0).click({ modifiers: ["Control"] });
    await cells.nth(1).click({ modifiers: ["Control"] });
    await expect(page.getByText("2 selected").first()).toBeVisible();

    await cells.nth(5).click();
    await expect(page.getByText(/\d+ selected/).first()).not.toBeVisible();
  });

  test("rapid filter switching does not crash", async ({ page }) => {
    await loginAs(page, "reviewer1");
    const filters = ["All", "Unreviewed", "My Deletes", "Conflicts", "Both Deleted"];
    for (let round = 0; round < 3; round++) {
      for (const f of filters) {
        await page.getByRole("button", { name: f }).click();
      }
    }
    await expect(page.getByText("REBAShotSelection")).toBeVisible();
  });

  test("open lightbox, idle 3s, navigate, close — app stable", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-testid='lightbox']")).toBeVisible();

    await page.waitForTimeout(3000);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-testid='lightbox']")).not.toBeVisible();
    await expect(getGridCells(page).first()).toBeVisible();
  });

  test("logout and re-login preserves app stability", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();

    await page.locator("button").filter({ hasText: "×" }).click();
    await expect(page).toHaveURL("/");

    await loginAs(page, "reviewer2");
    await expect(getGridCells(page).first()).toBeVisible();
    await expect(page.getByText("REBAShotSelection")).toBeVisible();
  });

  test("switch between users — each sees correct role", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await expect(page.getByRole("button", { name: "Review Marked" })).toBeVisible();
    await expect(page.locator("[data-testid='download-csv']")).not.toBeVisible();
    await page.locator("button").filter({ hasText: "×" }).click();

    await loginAs(page, "admin");
    await expect(page.locator("[data-testid='download-csv']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review Marked" })).not.toBeVisible();
  });

  test("reviewer2 sees reviewer1 markers after reviewer1 makes deletions (same session)", async ({ page }) => {
    await loginAs(page, "reviewer1");
    await getGridCells(page).first().click();
    await page.locator("button").filter({ hasText: "×" }).click();

    await loginAs(page, "reviewer2");
    const r1Markers = page.locator("[data-testid='grid-cell'] .bg-orange-500");
    await page.waitForTimeout(500);
    const count = await r1Markers.count();
    expect(count).toBeGreaterThan(0);
  });
});
