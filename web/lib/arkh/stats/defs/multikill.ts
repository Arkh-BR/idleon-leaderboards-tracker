// ===== MULTIKILL DESCRIPTOR =====
// N.js WorkbenchStuff("MultiKillTOTAL") (@7756167): the AFK Info panel's
// "MULTIKILL: X%" line (spec M1):
//   MK = ⌊ B′ + T × P′ ⌋
//   B  = Σ of the 9 MultiKill_base terms (@7754109)
//   P  = Σ of the 18 MultiKill_perTier terms (@7751511)
//   T  = OverkillStuffs("2"), the damage tier 1–51 (common/overkill.ts)
//   B′, P′ = B and P after the Shimmerfin Deep soft cap (map ≥ 300), or
//            replaced by the Crystal Glunko Cove (map 216 + cavern 17)
// Linear in the tier — not a product of groups — so this is its own
// descriptor (not groupedDescriptor). combine() is a pure function of the
// pools (the Observed Max collector calls it without a ctx), so the map rules
// arrive as sources of the `rules` pool (spec M14). mkTotal() is the one copy
// of the formula: combine here, the Biggest Gains what-if
// (lib/multikill/gains.ts) and the collector all go through it.

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

export const MK_ROOT = "Multikill";

/** The root's children. Fixed names, so snapshot and Observed Max paths never
 *  move — except the tier: a W7 map names it by its ×5 ladder, so neither
 *  Biggest Gains nor Compare meets the map-251 (×2) reference there (M12). */
export const MK_NODES = {
  base: "Base Multikill",
  tier: "Damage Tier",
  tierW7: "Damage Tier (W7 ×5 ladder)",
  perTier: "Multikill per Tier",
  active: "Active in AFK",
} as const;

/** Rule rows each half carries on the maps where they apply (M2/M14). */
export const MK_RULES = {
  softCap: "Shimmerfin Deep soft cap",
  cove: "Crystal Glunko Cove",
} as const;

/** Source ids of the `multikill` system, N.js order. */
export const MK_POOLS: Record<"base" | "perTier" | "tier" | "rules" | "status", readonly string[]> = {
  base: ["sign47", "saltLick8", "stampC19", "deathNoteBuilding", "etc29", "ach148", "ach122", "ach123", "talent654"],
  perTier: [
    "deathNoteWorld", "deathNoteMini", "vialOverkill", "buff46", "talent58", "arcade8", "artifact26", "buff469",
    "chipMkill", "etc71", "meas9", "card80", "sign78", "prayer16", "shiny4", "box13b", "bubbleMKtier", "cardSet11",
  ],
  tier: ["tier"],
  rules: ["softCap", "cove"],
  status: ["active"],
};

// @njs MultiKill_base
// @njs MultiKill_perTier
/** The Shimmerfin Deep soft cap N.js applies to each sum on maps ≥ 300.
 *  Practically continuous (the steps at 50, 100 and 250 are under 0.05); the
 *  top bracket has no ceiling (slope 1/50). */
export function mkSoftCap(v: number): number {
  if (v >= 250) return 98.14 + (v - 250) / 50;
  if (v >= 200) return 95.6 + (v - 200) / 20;
  if (v >= 150) return 90.6 + (v - 150) / 10;
  if (v >= 100) return 80.6 + (v - 100) / 5;
  if (v >= 50) return 47.3 + (v - 50) / 1.5;
  if (v >= 20) return 20 + (v - 20) / 1.1;
  return v;
}

export type MkParts = {
  /** B: Σ of the base sources. */
  base: number;
  /** P: Σ of the per-tier sources. */
  perTier: number;
  /** T: the damage tier. */
  tier: number;
  /** Map ≥ 300. */
  softCap: boolean;
  /** Map 216 in cavern 17: the Cove's two replacement values. */
  cove: { base: number; perTier: number } | null;
};

/** B′ and P′. N.js applies the Cove after the soft cap; they never meet (216 < 300). */
export function mkHalves(p: MkParts): { base: number; perTier: number } {
  if (p.cove) return p.cove;
  return p.softCap ? { base: mkSoftCap(p.base), perTier: mkSoftCap(p.perTier) } : { base: p.base, perTier: p.perTier };
}

// @njs MultiKillTOTAL
export function mkTotal(p: MkParts): number {
  const h = mkHalves(p);
  return Math.floor(h.base + p.tier * h.perTier);
}

const num = (n: ArkhNode | undefined, dflt: number): number => {
  const v = Number(n?.val);
  return Number.isFinite(v) ? v : dflt;
};
const sum = (xs: ArkhNode[]): number => xs.reduce((a, it) => a + (Number(it.val) || 0), 0);

/** The rule row a half carries on this map: the soft cap (Σ → capped, with the
 *  W7 notice's "reduced by ~X%") or the Cove's replacement value. */
function ruleRows(p: MkParts, raw: number, value: number): ArkhNode[] {
  if (p.cove) return [{ name: MK_RULES.cove, val: value, fmt: "+", note: `replaces Σ ${raw.toFixed(2)} (map 216, cavern 17)` }];
  if (!p.softCap) return [];
  const cut = raw > 0 ? Math.max(0, Math.round(100 * (1 - value / raw))) : 0;
  return [{ name: MK_RULES.softCap, val: value, fmt: "+", note: `Σ ${raw.toFixed(2)} → ${value.toFixed(3)} · reduced by ~${cut}%` }];
}

const pools: Record<string, SourceSpec[]> = {};
for (const [key, ids] of Object.entries(MK_POOLS)) pools[key] = ids.map((id) => ({ system: "multikill", id }));

const multikillDesc: Descriptor = {
  id: "multikill",
  name: MK_ROOT,
  scope: "character+map",
  category: "progression",
  pools,
  // No ctx: the Observed Max collector calls combine without one
  // (combineStatPools). Everything map-dependent arrives as a source.
  combine(p) {
    const items = (k: string) => p[k]?.items ?? [];
    const base = items("base");
    const perTier = items("perTier");
    const [tier] = items("tier");
    const [soft, cove] = items("rules");
    const parts: MkParts = {
      base: sum(base),
      perTier: sum(perTier),
      tier: num(tier, 1),
      softCap: num(soft, 0) === 1,
      cove: num(cove, 0) === 1 ? { base: num(cove?.children?.[0], 0), perTier: num(cove?.children?.[1], 0) } : null,
    };
    const h = mkHalves(parts);
    const children: ArkhNode[] = [
      { name: MK_NODES.base, val: h.base, fmt: "+", note: "B′", children: [...base, ...ruleRows(parts, parts.base, h.base)] },
      tier ?? { name: MK_NODES.tier, val: 1, fmt: "raw" },
      {
        name: MK_NODES.perTier,
        val: h.perTier,
        fmt: "+",
        note: "P′ (× Damage Tier)",
        children: [...perTier, ...ruleRows(parts, parts.perTier, h.perTier)],
      },
      ...items("status"),
    ];
    return { val: mkTotal(parts), children, note: "⌊B′ + T × P′⌋", fmt: "%" };
  },
};

export default multikillDesc;
