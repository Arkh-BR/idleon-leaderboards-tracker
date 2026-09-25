// ===== AFK GAINS RATE DESCRIPTOR =====
// N.js k._customBlock_AFKgainrates("Fighting") (@4421667): the fighting AFK
// gains rate the AFK Info panel prints as ⌊100·rate⌋% (spec A1–A3):
//   rate = max(.01, v)
//   v    = Cove rate                 on map 216 in cavern 17 (replaces all)
//        = 0.2 × Σ/100 × G2 × G3     on map 306 (Clamworks)
//        = Σ/100 × G2 × G3           elsewhere
//   Σ = 40 (base) + fight terms + ALL terms, G2 = 1 + arcane₂/100, G3 = 1 + Etc92/100
// × 0 when the map's AFK target isn't a fight (A9). Not a product of "1 + x"
// groups, so this is its own descriptor (not groupedDescriptor); afkRate() is
// the only copy of the shape (combine here + the Biggest Gains what-if).

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";
import type { StatGroup } from "./grouped";

export const AFK_ROOT = "AFK Gains Rate";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const AFK_VOTE_NAME = "Vote 6 (AFK Gains)";

/** Tree node names. Fixed, so snapshot and Observed Max paths never move with
 *  the map (the monster and the AFK type go in the notes). */
export const AFK_NODES = {
  pool: "⚔️ Fighting AFK pool",
  arcane: "🗺️ Arcane map bonus (slot 2)",
  etc92: "🎽 AFK Gains multi gear (Etc 92)",
  clam: "🦪 Clamworks ×0.2 (map 306)",
  cove: "🏝️ Crystal Glunko Cove (map 216, cavern 17)",
  type: "🎯 AFK target type",
} as const;

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

const num = (n: ArkhNode | undefined, dflt: number): number => {
  const v = Number(n?.val);
  return Number.isFinite(v) ? v : dflt;
};

const pools: Record<string, SourceSpec[]> = {};
for (const g of AFK_POOLS) pools[g.key] = g.sources.map((id) => ({ system: "afk", id }));

const afkGainsDesc: Descriptor = {
  id: "afk-gains",
  name: AFK_ROOT,
  scope: "character+map",
  category: "progression",
  pools,
  // No ctx: the Observed Max collector calls combine without one
  // (combineStatPools). Everything map-dependent arrives as a `rules` source.
  combine(p) {
    const items = (k: string) => p[k]?.items ?? [];
    const pool = [...items("fight"), ...items("all")];
    const [arcane, etc92] = items("multi");
    const [clam, cove, type] = items("rules");
    const parts: AfkParts = {
      sum: pool.reduce((a, it) => a + (Number(it.val) || 0), 0),
      arcane: num(arcane, 0),
      etc92: num(etc92, 0),
      clam: num(clam, 1),
      cove: num(cove, 0),
      type: num(type, 1),
    };
    const children: ArkhNode[] = [
      { name: AFK_NODES.pool, val: parts.sum / 100, fmt: "x", note: "Σ/100", children: pool },
      { name: AFK_NODES.arcane, val: 1 + parts.arcane / 100, fmt: "x", note: "× (1 + Σ/100)", children: arcane ? [arcane] : [] },
      { name: AFK_NODES.etc92, val: 1 + parts.etc92 / 100, fmt: "x", note: "× (1 + Σ/100)", children: etc92 ? [etc92] : [] },
      ...items("rules"),
    ];
    return { val: afkRate(parts), children, note: "max(1%, ·)" };
  },
};

export default afkGainsDesc;
