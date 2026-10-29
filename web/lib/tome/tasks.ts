// Ported from Code_TomeRaw_v6_1.gs (v7.9). DO NOT REORDER — these arrays are
// indexed by position, not by name. If you re-sync from the .gs, paste the
// raw arrays verbatim.

import { CardStuff, RANDOlist } from "../arkh/stats/data/game/customlists.js";

// 124 tome tasks in the EXACT order they appear in-game and on the IT website
// (NinjaInfo[32] is the game's display→compute map). The 2026-08 Royal
// Guardian update inserted three tasks at display slots 106–108; IT profiles
// parsed since then carry 121 tomePoints in this order, while older cached
// profiles still have the 118-entry layout (the golden harness remaps those).
export const TOME_TASKS: readonly string[] = [
  "Account LV",
  "Account Skills LV",
  "Total Talent Max LV",
  "Items Found",
  "Total Bubble LV",
  "Stamp Total LV",
  "Cards Total LV",
  "Statue Total LV",
  "Total Achievements Completed",
  "Unique Quests Completed",
  "Total Tasks Completed",
  "Vault Upgrade bonus LV",
  "Most Money held in Storage",
  "Most Spore Caps held in Inventory at once",
  "Total Colosseum Score",
  "Trophies Found",
  "Nametags Found",
  "Premium Hats Found",
  "Best Spiketrap Surprise round",
  "Tournaments Registrations",
  "Lava Dev Streams watched",
  "Total Minigame Highscore",
  "Total AFK Hours claimed",
  "DPS Record on Shimmer Island",
  "Total Arcade Gold Ball Shop Upgrade LV",
  "Most Balls earned from LBoFaF",
  "Jackpots Hit in Arcade",
  "Star Talent Points Owned",
  "Average kills for a Crystal Spawn",
  "Dungeon Rank",
  "Highest Drop Rate Multi",
  "Constellations Completed",
  "Unique Obols Found",
  "Total Vial LV",
  "Total Sigil LV",
  "Post Office PO Boxes Earned",
  "Highest Killroy Score on a Warrior",
  "Highest Killroy Score on an Archer",
  "Highest Killroy Score on a Mage",
  "Megafeathers Earned from Orion",
  "Megafish Earned from Poppy",
  "Megaflesh Earned from Bubba",
  "Fastest Time to kill Chaotic Efaunt (in Seconds)",
  "Largest Oak Log Printer Sample",
  "Largest Copper Ore Printer Sample",
  "Largest Spore Cap Printer Sample",
  "Largest Goldfish Printer Sample",
  "Largest Fly Printer Sample",
  "Total Best Wave in Worship",
  "Best Non Duplicate Goblin Gorefest Wave",
  "Total Prayer Upgrade LV",
  "Total Digits of all Deathnote Kills",
  "Most Giants Killed in a Single Week",
  "Total Refinery Rank",
  "Total Atom Upgrade LV",
  "Total Construct Buildings LV",
  "Equinox Clouds Completed",
  "Most Greenstacks in Storage",
  "Total Cooking Meals LV",
  "Total Kitchen Upgrade LV",
  "Highest Power Mob",
  "Fastest Time reaching Round 100 Arena (in Seconds)",
  "Total Shiny Mob LV",
  "Total Mob Breedability LV",
  "Total Lab Chips Owned",
  "Rift Levels Completed",
  "Total Onyx Statues",
  "Total Artifacts Found",
  "Total Boat Upgrade LV",
  "Gold Bar Sailing Treasure Owned",
  "Highest Captain LV",
  "Most Gaming Bits Owned",
  "Total Gaming Plants Evolved",
  "Best Gold Nugget",
  "Highest Immortal Snail LV",
  "Rat King Crowns Reclaimed",
  "God Rank in Divinity",
  "Fastest Time to Kill 200 Tremor Wurms (in Seconds)",
  "Total Opals Found",
  "Total LV of Cavern Villagers",
  "Total Digits of all Cavern Resources",
  "Total Resource Layers Destroyed",
  "Best Dawg Den score",
  "Best Bravery Monument Round",
  "Best Justice Monument Round",
  "Best Wisdom Monument Round",
  "Total Gambit Time (in Seconds)",
  "Best Pure Memory Round Reached",
  "Total Crops Discovered",
  "Total Golden Food Beanstacks",
  "Highest Crop OG",
  "Total Land Rank",
  "Largest Magic Bean Trade",
  "Farming Stickers Found",
  "Ninja Floors Unlocked",
  "Jade Emporium Upgrades Purchased",
  "Total Ninja Knowledge Upgrades LV",
  "Total Career Summoning Wins",
  "Total Summoning Upgrades LV",
  "Familiars Owned in Summoning",
  "Total Summoning Boss Stone victories",
  "Most DMG Dealt to Gravestone in a Weekly Battle",
  "Most Tottoise in Storage",
  "Best Deathbringer Max Damage in Wraith Mode",
  "Best Windwalker Max Damage in Tempest Mode",
  "Best Arcane Cultist Max Damage in Arcanist Mode",
  // Royal Guardian (2026-08) — display slots 106–108.
  "Total Royal Statue LV",
  "Royal Guardian Outposts Built",
  "Total Resource Grade",
  "Spirited Valley Emperor Boss Kills",
  "Total Coral Reef upgrades",
  "Total Spelunk Shop Upgrades LV",
  "Total Spelunk Discoveries made",
  "Deepest Depth reached in a single Delve",
  "Biggest Haul in a single Delve",
  "Highest leveled Spelunker",
  "Minehead Opponents Defeated",
  "Total Research Grid Upgrades",
  "Total Glimbo Trades",
  "Unique Sushi Created",
  "Button Presses",
  // 2026-09-18 Jelly Operator — appended at the end of the in-game list.
  "Successful Jelly Operations",
  // 2026-10-16 Luminous Menagerie — appended at the end of the in-game list.
  "Luminous Menagerie Rank",
  "Total Menagerie Boosts Upg LV",
];

// Maps a task index (0-123, position in TOME_TASKS) to a compute index used
// by TOME_BONUSES and the switch in computeRawValue. Verbatim copy of the
// game's NinjaInfo[32] (IT's NEI32) — 2026-08 inserted 118/119/120 at 106–108;
// 2026-09-18 appended 121 (Successful Jelly Operations) at the end;
// 2026-10-16 appended 122/123 (Luminous Menagerie Rank, Menagerie Boosts LV).
export const NEI32: readonly number[] = [
  5, 11, 3, 65, 22, 0, 2, 1, 7, 4, 6, 81, 8, 9, 53, 10, 107, 109, 12, 113,
  106, 75, 13, 14, 80, 79, 25, 15, 16, 17, 18, 19, 21, 23, 24, 26, 27, 28,
  29, 85, 86, 108, 30, 31, 32, 33, 34, 35, 37, 36, 76, 38, 54, 40, 41, 42,
  39, 44, 50, 48, 46, 47, 49, 51, 52, 45, 55, 60, 57, 61, 62, 66, 59, 64,
  63, 111, 58, 56, 93, 84, 83, 92, 91, 87, 88, 89, 82, 94, 68, 69, 67, 77,
  78, 112, 72, 74, 99, 71, 70, 73, 96, 20, 43, 90, 100, 101, 118, 119, 120,
  95, 97, 103, 104, 98, 102, 105, 110, 114, 115, 116, 117, 121,
  122, 123,
];

// Per-task curve params: [x1, x2, x3] where x2 selects the formula in
// calcPointsPercent and x3 is the max points. Indexed by compute_index.
export const TOME_BONUSES: readonly (readonly [number, number, number])[] = [
  [10000, 0, 1000], [2300, 0, 600], [1344, 2, 1000], [12000, 0, 600],
  [323, 2, 500], [7000, 0, 1500], [470, 2, 470], [266, 2, 850], [25, 1, 500],
  [9, 1, 200], [22, 2, 700], [18000, 0, 1200], [13, 2, 100],
  [2000000, 0, 350], [20, 1, 350], [2500, 0, 200], [30, 3, 350], [30, 0, 250],
  [40, 0, 350], [49, 2, 300], [300000, 0, 200], [107, 2, 250],
  [1000000, 4, 1750], [962, 2, 600], [120, 2, 500], [4, 2, 80],
  [20000, 0, 300], [3000, 0, 200], [3000, 0, 200], [3000, 0, 200],
  [10, 3, 200], [9, 1, 400], [9, 1, 400], [9, 1, 300], [9, 1, 300],
  [9, 1, 300], [120, 0, 200], [1000, 0, 300], [700, 0, 600], [31, 2, 750],
  [120, 0, 450], [150, 0, 400], [4000, 0, 900], [5, 1, 150], [150, 0, 600],
  [49, 2, 500], [5, 1, 150], [50, 3, 180], [8000, 0, 200], [750, 0, 250],
  [5400, 0, 750], [500, 2, 200], [100, 0, 150], [10, 1, 200], [25, 0, 250],
  [28, 2, 450], [30, 3, 150], [10000, 0, 200], [10, 0, 200],
  [100000, 0, 200], [185, 2, 1000], [14, 1, 200], [25, 0, 150], [50, 2, 300],
  [9, 1, 200], [1800, 2, 1300], [80, 1, 400], [6, 1, 200], [120, 2, 350],
  [30, 2, 400], [10000, 0, 200], [160, 0, 500], [12, 2, 250], [600, 0, 150],
  [50, 2, 700], [450, 2, 100], [673, 2, 200], [5000, 0, 200], [1000, 0, 200],
  [1000, 0, 150], [6800, 2, 1200], [1200, 2, 1200], [3600, 0, 400],
  [500, 0, 750], [200, 0, 350], [12, 0, 250], [12, 0, 250], [50, 0, 250],
  [200, 0, 250], [18, 2, 250], [10, 1, 400], [7, 1, 250], [150, 0, 350],
  [500, 0, 400], [13, 2, 50], [100, 2, 400], [28, 0, 300], [37, 2, 400],
  [100, 0, 300], [5000, 0, 500], [10, 1, 400], [10, 1, 400], [25, 1, 300],
  [2000, 0, 500], [90, 2, 300], [200, 0, 200], [20, 2, 250], [20, 2, 700],
  [12, 0, 250], [75, 2, 700], [40, 2, 600], [100, 2, 400], [150, 0, 300],
  // 116 "Unique Sushi Created": max 54 → 63 (2026-09-05) → 64 (2026-09-18).
  [365, 2, 365], [109, 2, 750], [1500, 0, 400], [64, 2, 800], [300, 0, 500],
  // 118–120 Royal Guardian (2026-08): Total Royal Statue LV, Outposts Built,
  // Total Resource Grade — from the game's Tome list [118..120].
  [100, 0, 600], [65, 2, 650], [1000, 0, 600],
  // 121 "Successful Jelly Operations" (2026-09-18): 72 obstructions, 800 pts.
  [72, 2, 800],
  // 122–123 Luminous Menagerie (2026-10-16): Tome list [122] = [50,2,1200]
  // (Menagerie Rank), [123] = [700,0,750] (Total Menagerie Boosts Upg LV).
  [50, 2, 1200], [700, 0, 750],
];

// Fallback: if the raw extractor returns null for these compute indices, the
// .gs script falls back to leaderboard lookups. We DON'T do that here (paste
// flow has no LB data), but keeping the map so we can flag the fallback case
// in the Source column.
export const COMPUTE_LB_FALLBACK: Readonly<Record<number, [string, string]>> = {
  0: ["tasks", "totalStamps"],
  2: ["general", "totalCards"],
  11: ["skills", "totalSkillsLevels"],
  22: ["tasks", "totalBubbles"],
  23: ["general", "totalVials"],
  37: ["general", "totalWaves"],
  40: ["tasks", "refinedSalts"],
  46: ["general", "highestPowerPet"],
  50: ["general", "totalMeals"],
  57: ["general", "totalBoats"],
  58: ["general", "godRank"],
  71: ["general", "endlessSummoningWins"],
  82: ["caverns", "totalGambitTime"],
  87: ["caverns", "bellRings"],
  88: ["caverns", "bellPings"],
  89: ["caverns", "totalStringLevels"],
  91: ["caverns", "brokenJars"],
  92: ["caverns", "totalLayersDestroyed"],
  93: ["caverns", "totalOpals"],
  97: ["general", "totalCoralKidUpgrades"],
  102: ["misc", "biggestHaulSpelunking"],
  103: ["general", "totalSpelunkingUpgrades"],
  105: ["misc", "highestSpelunkingPower"],
  108: ["misc", "highestMegaFlesh"],
  110: ["misc", "mineheadOpponentsDefeated"],
  115: ["misc", "glimboTotalTrades"],
};

// Cards perTier table (rawName -> perTier) = the game's CardStuff[w][i][2],
// read from the regenerated game data so new cards flow in with every update
// (the hand-copied table missed SpelunkingCard6 / fallEvent2 / fm_rat and had
// w7b12 at 1e8 instead of 4e7). "Blank" rows are padding.
export const CARDS_PER_TIER: Readonly<Record<string, number>> = Object.fromEntries(
  (CardStuff as string[][][])
    .flat()
    .filter((c) => c[0] !== "Blank")
    .map((c) => [c[0], Number(c[2])]),
);

// Dungeon rank thresholds on OptLacc[71] (dungeon points) — the game's
// RANDOlist[29], read from the regenerated game data so new ranks flow in
// with every update. The previous hand-copied table stopped at 100M and was
// padded with 999999999 sentinels, so every account past ~120M points was
// capped at rank 66 (ARKHE at 1.93B is rank 75; the live table has 87
// thresholds up to 1e16).
export const DUNGEON_LEVELS: readonly number[] = (
  ((RANDOlist as unknown as unknown[][])[29] as unknown[]) || []
).map(Number);

// mapEnemies values (map index per deathNote rawName) for the 104 deathNote
// mobs — originally from IT website-data; the W7 tail is kept in sync with the
// game's DeathNoteMobs[6] via MapAFKtarget (w7b8–w7b10 = maps 322–324, and
// w7b11/w7b12 = 325/326 added 2026-08). Order is irrelevant (digit sum).
export const DEATHNOTE_MOB_IDX: readonly number[] = [
  1, 17, 2, 14, 16, 19, 24, 26, 27, 28, 8, 15, 13, 18, 31, 51, 52, 53, 57,
  58, 59, 60, 62, 63, 64, 65, 101, 103, 104, 105, 106, 107, 108, 109, 110,
  111, 112, 113, 116, 117, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160,
  161, 162, 163, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212,
  213, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264,
  301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 315, 316, 317,
  318, 319, 320, 321, 322, 323, 324, 325, 326,
];
