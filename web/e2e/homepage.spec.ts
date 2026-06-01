import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("shows title and tracker cards", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading").filter({ hasText: "Idleon Trackers" })
    ).toBeVisible();

    const cards = [
      { title: "IT Leaderboards Tracker", desc: "See your rank" },
      { title: "Tome Score Tracker", desc: "offline" },
      { title: "Drop Rate Tracker", desc: "Game Code Faithful" },
      { title: "Talents Tracker", desc: "Per-talent" },
      { title: "Sheets \u0026 Tools", desc: "curated" },
    ];
    for (const card of cards) {
      // Each card is a link with class "group" containing the title text.
      const locator = page
        .locator("a.group")
        .filter({ hasText: card.title })
        .filter({ hasText: card.desc });
      await expect(locator).toBeVisible();
    }
  });

  test("navigates to leaderboards page", async ({ page }) => {
    await page.goto("/");
    const link = page
      .locator("a.group")
      .filter({ hasText: "IT Leaderboards Tracker" });
    await link.click();
    await expect(page).toHaveURL(/\/leaderboards/);
    await expect(
      page.getByRole("heading").filter({ hasText: "Leaderboards Tracker" })
    ).toBeVisible();
  });
});
