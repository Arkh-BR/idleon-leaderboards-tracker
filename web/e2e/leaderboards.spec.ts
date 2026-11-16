import { test, expect } from "@playwright/test";

test.describe("Leaderboards Page", () => {
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
