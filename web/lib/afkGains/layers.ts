// The AFK Gains page's display config: the root, the node names, the source pools (ids = the afk system's cases, N.js order) and the one copy of
// the rate's shape (`afkRate`). The engine (lib/game's tracker adapter, lib/game/trackers/afkGains.ts) and the page's
// Biggest Gains model (pageConfig.ts) read this, so it lives here, not in the engine (Ruling B, as lib/damage/layers).

import type { StatGroup } from "@/lib/statTracker/groups";

export const AFK_ROOT = "AFK Gains Rate";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const AFK_VOTE_NAME = "AFK Gains (Weekly Vote 6)";

/** Tree node names. Fixed, so snapshot and Observed Max paths never move with
 *  the map (the monster and the AFK type go in the notes). */
export const AFK_NODES = {
  pool: "⚔️ Fighting AFK pool",
  arcane: "🗺️ Arcane Map Bonus: AFK Gains",
  etc92: "🎽 AFK Gains Multi (Equipment)",
  clam: "🦪 The Clamworks",
  cove: "🏝️ Crystal Glunko Cove",
  type: "🎯 AFK target type",
} as const;

/** Class talents of the formula (per-character GetTalentNumber) — spec A10: the Observed Max collector gates them per class by their
 *  "(Talent n)" node names. 621 (Tick Tock) and 650 (Rando Event Looty) are star talents of every class. */
export const AFK_CLASS_TALENTS = [79, 88, 268, 448] as const;

/** Source pools (ids = the afk system's cases, N.js order). `fight` and `all`
 *  both land in G1; they stay separate so a future skill selector only swaps
 *  `fight`. `kind` only feeds the collector's neutral value for a zeroed
 *  class talent. */
export const AFK_POOLS: readonly StatGroup[] = [
  {
    key: "fight",
    name: "Fighting terms",
    kind: "pct",
    sources: [
      "base", "fam8", "boxFightAFK", "talent88", "bribe3", "talent268", "cardSet10", "talent448",
      "talent621", "card43", "talent79", "etc20", "etc59", "starFightAFK", "guild4", "prayer4",
      "curse12", "chipFafk", "cardW6d1",
    ],
  },
  {
    key: "all",
    name: "ALL (every AFK type)",
    kind: "pct",
    sources: [
      "merit", "arcade6", "compass57", "voidSet", "flurbo7", "divMajor", "divMinor5", "comp6",
      "comp25", "shrine8", "talent650", "winBonus11", "goldFoodAllAFK", "cardW6d3", "roo5",
      "vote6", "eventShop5", "vault23", "bunU",
    ],
  },
  { key: "multi", name: "MULTI", kind: "pct", sources: ["arcaneMapAfk", "etc92"] },
  { key: "rules", name: "Map rules", kind: "mult", sources: ["clamworks306", "cglunkoCove", "afkType"] },
];

export type AfkParts = {
  /** Σ of the fight + ALL pools, base 40 included. */
  sum: number;
  arcane: number;
  etc92: number;
  /** R1: 0.2 on map 306, else 1. */
  clam: number;
  /** R2: the Cove's rate when active, else 0. */
  cove: number;
  /** R3: 1 for a fight (or the Cove), 0 for Nothing / Paying_Respect / no definition. */
  type: number;
};

/** The one copy of the rate's shape. N.js adds the 0.4 base outside Σ/100;
 *  here it's the 40 inside Σ — equal up to float rounding (1e-16).
 *  ponytail: sum order differs from N.js's nesting at that level only. */
export function afkRate(p: AfkParts): number {
  const v = p.cove > 0 ? p.cove : (p.sum / 100) * (1 + p.arcane / 100) * (1 + p.etc92 / 100) * p.clam;
  return p.type * Math.max(0.01, v);
}
