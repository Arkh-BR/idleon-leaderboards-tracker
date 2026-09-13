import { describe, it, expect } from "vitest";
import { CATEGORIES, flatBoards, type CategoryKey } from "@/lib/registry";

// The registry mirrors IdleonToolbox's leaderboard catalog (one entry per
// board the IT API serves). Re-sync it whenever IT adds boards: fetch
// `?leaderboard=<category>` for each category and diff the keys.
describe("registry", () => {
  it("contains 7 categories", () => {
    expect(CATEGORIES).toHaveLength(7);
  });

  // Per-category counts as of the 2026-09 Royal Guardian / W7 Taskmaster
  // update (IT added 8 general, 2 misc and 2 caverns boards → 165 total).
  const expectedCategories: { key: CategoryKey; expectedBoards: number }[] = [
    { key: "global", expectedBoards: 1 },
    { key: "general", expectedBoards: 55 },
    { key: "tasks", expectedBoards: 11 },
    { key: "skills", expectedBoards: 21 },
    { key: "character", expectedBoards: 14 },
    { key: "misc", expectedBoards: 44 },
    { key: "caverns", expectedBoards: 19 },
  ];

  const totalExpectedBoards = expectedCategories.reduce((sum, c) => sum + c.expectedBoards, 0);

  it(`contains ${totalExpectedBoards} total boards across all categories`, () => {
    const total = CATEGORIES.reduce((sum, cat) => sum + cat.boards.length, 0);
    expect(total).toBe(totalExpectedBoards);
    expect(flatBoards()).toHaveLength(totalExpectedBoards);
  });

  expectedCategories.forEach(({ key, expectedBoards }) => {
    it(`category '${key}' has ${expectedBoards} boards`, () => {
      const cat = CATEGORIES.find((c) => c.key === key);
      expect(cat).toBeDefined();
      expect(cat!.boards).toHaveLength(expectedBoards);
    });
  });

  it("every board has an apiKey and label", () => {
    for (const cat of CATEGORIES) {
      for (const board of cat.boards) {
        expect(board.apiKey).toBeTruthy();
        expect(board.label).toBeTruthy();
        expect(typeof board.apiKey).toBe("string");
        expect(typeof board.label).toBe("string");
      }
    }
  });

  it("board apiKeys are unique across all categories", () => {
    const keys = new Set<string>();
    for (const cat of CATEGORIES) {
      for (const board of cat.boards) {
        expect(keys.has(board.apiKey)).toBe(false);
        keys.add(board.apiKey);
      }
    }
    expect(keys.size).toBe(totalExpectedBoards);
  });

  it("includes the 2026-09 additions in IT's order", () => {
    const general = CATEGORIES.find((c) => c.key === "general")!.boards.map((b) => b.apiKey);
    const i = general.indexOf("totalSushiKnowledgeLevels");
    expect(general.slice(i + 1, i + 10)).toEqual([
      "totalSushiPerfectos",
      "totalButtonPresses",
      "cookingMasteryLevel",
      "totalAdviceFishUpgrades",
      "totalEquinoxUpgrades",
      "totalRoyalArmoryUpgrades",
      "totalRoyalResourceGrades",
      "totalRoyalStatueLevels",
      "arenaWaves",
    ]);
    const misc = CATEGORIES.find((c) => c.key === "misc")!.boards.map((b) => b.apiKey);
    expect(misc.indexOf("totalSpelunkingDepths")).toBe(misc.indexOf("highestSpelunkingPower") + 1);
    expect(misc.indexOf("totalManicSpelunkingDepths")).toBe(misc.indexOf("totalSpelunkingDepths") + 1);
    const caverns = CATEGORIES.find((c) => c.key === "caverns")!.boards.map((b) => b.apiKey);
    expect(caverns.indexOf("totalVillagerExp/hr")).toBe(caverns.indexOf("highestVillagerExp/hr") + 1);
    expect(caverns.at(-1)).toBe("totalFountainUpgrades");
  });
});
