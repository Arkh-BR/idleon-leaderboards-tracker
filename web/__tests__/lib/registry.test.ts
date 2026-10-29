import { describe, it, expect } from "vitest";
import { CATEGORIES, flatBoards, type CategoryKey } from "@/lib/registry";

// The registry mirrors IdleonToolbox's leaderboard catalog (one entry per
// board the IT API serves). Re-sync it whenever IT adds boards: fetch
// `?leaderboard=<category>` for each category and diff the keys.
describe("registry", () => {
  it("contains 8 categories", () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  // Per-category counts as of the 2026-10 Luminous Menagerie update: IT moved
  // 9 class-specific boards into a new "masterclass" category (13 boards with
  // 4 new ones) and added 3 general boards → 178 total.
  const expectedCategories: { key: CategoryKey; expectedBoards: number }[] = [
    { key: "global", expectedBoards: 1 },
    { key: "general", expectedBoards: 61 },
    { key: "tasks", expectedBoards: 11 },
    { key: "skills", expectedBoards: 21 },
    { key: "character", expectedBoards: 11 },
    { key: "misc", expectedBoards: 41 },
    { key: "caverns", expectedBoards: 19 },
    { key: "masterclass", expectedBoards: 13 },
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
    // The three Royal Guardian boards moved to "masterclass" in 2026-10.
    expect(general.slice(i + 1, i + 7)).toEqual([
      "totalSushiPerfectos",
      "totalButtonPresses",
      "cookingMasteryLevel",
      "totalAdviceFishUpgrades",
      "totalEquinoxUpgrades",
      "bestJellyDps",
    ]);
    const misc = CATEGORIES.find((c) => c.key === "misc")!.boards.map((b) => b.apiKey);
    expect(misc.indexOf("totalSpelunkingDepths")).toBe(misc.indexOf("highestSpelunkingPower") + 1);
    expect(misc.indexOf("totalManicSpelunkingDepths")).toBe(misc.indexOf("totalSpelunkingDepths") + 1);
    const caverns = CATEGORIES.find((c) => c.key === "caverns")!.boards.map((b) => b.apiKey);
    expect(caverns.indexOf("totalVillagerExp/hr")).toBe(caverns.indexOf("highestVillagerExp/hr") + 1);
    expect(caverns.at(-1)).toBe("totalFountainUpgrades");
  });

  it("includes the 2026-09-30 Jelly Operator additions in IT's order", () => {
    const general = CATEGORIES.find((c) => c.key === "general")!.boards.map((b) => b.apiKey);
    const p = general.indexOf("totalPlotRanks");
    expect(general.slice(p + 1, p + 4)).toEqual([
      "totalDayMarketLevels",
      "totalNightMarketLevels",
      "totalPrimeKills",
    ]);
    const s = general.indexOf("totalEquinoxUpgrades");
    expect(general.slice(s + 1, s + 6)).toEqual([
      "bestJellyDps",
      "totalJellyCellLevels",
      "totalJellyUpgrades",
      "bestSushiCombo",
      "arenaWaves",
    ]);
  });

  it("mirrors the 2026-10 masterclass split and Menagerie additions in IT's order", () => {
    const general = CATEGORIES.find((c) => c.key === "general")!.boards.map((b) => b.apiKey);
    expect(general.slice(-3)).toEqual(["bestCrucibleRound", "menagerieRank", "totalMenagerieBoostLevels"]);
    const masterclass = CATEGORIES.find((c) => c.key === "masterclass")!.boards.map((b) => b.apiKey);
    expect(masterclass).toEqual([
      "totalGrimoireUpgrades",
      "totalBonesCollected",
      "totalCompassUpgrades",
      "totalDustCollected",
      "totalMedallions",
      "totalArcanistUpgrades",
      "totalTachyonsCollected",
      "highestArcaneMapMulti",
      "totalRoyalArmoryUpgrades",
      "totalRoyalResourceGrades",
      "totalRoyalStatueLevels",
      "totalOutposts",
      "highestOutpostResourceRate",
    ]);
  });
});
