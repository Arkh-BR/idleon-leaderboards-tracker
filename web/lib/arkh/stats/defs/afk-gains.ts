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
// the only copy of the shape (lib/afkGains/layers `afkRate`: combine here + the Biggest Gains what-if).

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

// The display config (names, pools, source ids) and the rate's one shape live in lib/afkGains/layers (Ruling B): re-exported, so every
// importer of this def keeps working and both engines read the same objects.
import { AFK_NODES, AFK_ROOT, AFK_POOLS, AFK_VOTE_NAME, afkRate, type AfkParts } from "@/lib/afkGains/layers";
export { AFK_NODES, AFK_ROOT, AFK_POOLS, AFK_VOTE_NAME, afkRate, type AfkParts };

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
      { name: AFK_NODES.arcane, val: 1 + parts.arcane / 100, fmt: "x", note: "× (1 + Σ/100) · MapBon slot 2", children: arcane ? [arcane] : [] },
      { name: AFK_NODES.etc92, val: 1 + parts.etc92 / 100, fmt: "x", note: "× (1 + Σ/100)", children: etc92 ? [etc92] : [] },
      ...items("rules"),
    ];
    return { val: afkRate(parts), children, note: "max(1%, ·)" };
  },
};

export default afkGainsDesc;
