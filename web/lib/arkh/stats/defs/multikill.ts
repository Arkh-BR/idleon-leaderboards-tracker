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
// (lib/multikill/gains.ts) and the collector all go through it (lib/multikill/layers).

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

// The display config and the page's pure formula live in lib/multikill/layers (Ruling B): re-exported, so every importer of this def keeps working.
import { MK_NODES, MK_POOLS, MK_ROOT, mkHalves, mkRuleRows, mkTotal, type MkParts } from "@/lib/multikill/layers";
export { MK_NODES, MK_POOLS, MK_ROOT, MK_RULES, mkHalves, mkSoftCap, mkTotal, type MkParts } from "@/lib/multikill/layers";

const num = (n: ArkhNode | undefined, dflt: number): number => {
  const v = Number(n?.val);
  return Number.isFinite(v) ? v : dflt;
};
const sum = (xs: ArkhNode[]): number => xs.reduce((a, it) => a + (Number(it.val) || 0), 0);

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
      { name: MK_NODES.base, val: h.base, fmt: "+", note: "B′", children: [...base, ...mkRuleRows(parts, parts.base, h.base)] },
      tier ?? { name: MK_NODES.tier, val: 1, fmt: "raw" },
      {
        name: MK_NODES.perTier,
        val: h.perTier,
        fmt: "+",
        note: "P′ (× Damage Tier)",
        children: [...perTier, ...mkRuleRows(parts, parts.perTier, h.perTier)],
      },
      ...items("status"),
    ];
    return { val: mkTotal(parts), children, note: "⌊B′ + T × P′⌋", fmt: "%" };
  },
};

export default multikillDesc;
