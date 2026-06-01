import { test, expect } from "@playwright/test";

test.describe("Leaderboards Page", () => {
  test("loads and shows player input form", async ({ page }) => {
    await page.goto("/leaderboards");

    await expect(page.getByRole("heading").filter({ hasText: "Leaderboards Tracker" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter player name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Load" })).toBeVisible();
  });

  test("shows tabs for Leaderboards and Dashboard", async ({ page }) => {
    await page.goto("/leaderboards");

    await expect(page.getByRole("button", { name: "📋 Leaderboards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "📊 Dashboard" })).toBeVisible();
  });

  test("shows empty state hint", async ({ page }) => {
    await page.goto("/leaderboards");

    await expect(page.getByText("Enter a player name above and click Load to see leaderboards.")).toBeVisible();
  });

  test("saves hide-anonymous checkbox state to localStorage", async ({ page }) => {
    await page.goto("/leaderboards");

    const checkbox = page.locator('label:has-text("Hide anonymous") input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();

    await checkbox.check();
    // Revisit the page (reload uses same origin so localStorage persists)
    await page.reload();
    await expect(checkbox).toBeChecked();

    // Cleanup
    await checkbox.uncheck();
  });
});
