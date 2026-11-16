import { test, expect } from "@playwright/test";

// Small fixtures for /api/lb/*, so the suite never reaches Idleon Toolbox.
const metric = (key: string, label: string) => ({ key, label, notation: "default", top: 0, topTies: 1, players: 3, maxed: false, section: "Totals" });
const META = {
  createdAt: Date.UTC(2026, 10, 15, 12),
  totalPlayers: 3,
  tabs: [{ key: "account", label: "Account", sections: [{ name: "Totals", metrics: [metric("totalMoney", "Total Money"), metric("totalStatues", "Total Statues")] }] }],
};
const GLOBAL = { metric: "globalRanking", createdAt: META.createdAt, top: [{ mainChar: "Alpha", value: 100, rank: 1 }, { mainChar: "Beta", value: 90, rank: 2 }], around: [] };
const FIXTURES: Record<string, { status: number; body: unknown }> = {
  meta: { status: 200, body: META },
  board: { status: 200, body: GLOBAL },
  names: { status: 200, body: { players: [] } },
  player: { status: 404, body: { error: "Player not found. Check the name or make the profile public on Idleon Toolbox." } },
};

test.describe("Leaderboards Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/lb/**", (route) => {
      const kind = new URL(route.request().url()).pathname.split("/")[3];
      const f = FIXTURES[kind] ?? { status: 404, body: { error: "not stubbed" } };
      return route.fulfill({ status: f.status, contentType: "application/json", body: JSON.stringify(f.body) });
    });
  });

  test("loads and shows player input form", async ({ page }) => {
    await page.goto("/leaderboards");

    await expect(page.getByRole("heading").filter({ hasText: "Leaderboards Tracker" })).toBeVisible();
    await expect(page.getByPlaceholder("Player name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Load" })).toBeVisible();
  });

  test("shows Overview, Dashboard and the board tabs", async ({ page }) => {
    await page.goto("/leaderboards");

    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Account \(\d+\)$/ })).toBeVisible();
  });

  test("lists boards without a player loaded", async ({ page }) => {
    await page.goto("/leaderboards");

    await page.getByRole("button", { name: /^Account \(\d+\)$/ }).click();
    await expect(page.locator("#board-totalMoney")).toBeVisible();
  });

  test("saves the show-anonymous toggle to localStorage", async ({ page }) => {
    await page.goto("/leaderboards");

    const checkbox = page.locator('label:has-text("Show anonymous") input[type="checkbox"]');
    await expect(checkbox).toBeChecked();

    await checkbox.uncheck();
    // Revisit the page (reload uses same origin so localStorage persists)
    await page.reload();
    await expect(checkbox).not.toBeChecked();

    // Cleanup
    await checkbox.check();
  });
});
