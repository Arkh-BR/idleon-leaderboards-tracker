// Refresh the bundled top-player Multikill reference in
// lib/multikill/topMultikill.ts (+ .meta.ts), on lib/game: the page's tracker
// (computeGameMultikill) read into the two halves' sources plus the root-level
// tier and status rows, the bests rebuilt into the page's tree (halves from
// mkHalves) and totalled by its gains model (multikillGainsModel). Every
// character is measured on map 251 (w6a1, MK_COLLECTOR_MAP — spec M7): every
// endgame character is at the tier-51 cap there, so MK = B + 51·P doesn't
// depend on the max damage, and the Death Note row is the W6 page. Candidates:
// the #1 of every board plus the top 10 of Monsters Killed (M15). Talents 46/469 are
// gated per class (M16); both sit in the per-tier sum, so `groups: []` makes
// their neutral value 0. No source scales with a character stat (the damage
// tier does through max damage, but every endgame char is at the tier-51 cap
// on map 251), so every source takes the best across all class families
// (familySources: []).
//
// Run (from web/):  npx tsx scripts/update-top-multikill.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type Pool, type StatCollectorConfig } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { poolsOf } from "./_shared/gamePools";
import { computeGameMultikill } from "../lib/game/trackers/multikill";
import { MK_CLASS_TALENTS, MK_COLLECTOR_MAP, MK_NODES, MK_ROOT, mkHalves } from "../lib/multikill/layers";
import { multikillGainsModel, partsFromFlat } from "../lib/multikill/gains";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import type { StatResult } from "../lib/statTracker/config";

type Node = StatResult["tree"];

const at = (name: string) => `${MK_ROOT} / ${name}`;
/** A root child by name (the tier is named by its ladder: ×2 below map 300, so MK_NODES.tier on map 251). */
const row = (tree: Node, ...names: string[]): Node => {
  const n = tree.children?.find((c) => names.includes(c.name));
  if (!n) throw new Error(`Multikill: no "${names[0]}" row`);
  return n;
};

/** The halves' sources (with their rule rows: none on map 251, so the positions stay aligned), the tier and the status rows. */
function mkPools(save: unknown, ci: number): Record<string, Pool> {
  const tree = computeGameMultikill(save, ci, MK_COLLECTOR_MAP).tree;
  return {
    ...poolsOf(tree, { base: at(MK_NODES.base), perTier: at(MK_NODES.perTier) }),
    tier: { items: [row(tree, MK_NODES.tier, MK_NODES.tierW7)] },
    status: { items: [row(tree, MK_NODES.active)] },
  };
}

/** The tracker's tree from the pools: each half's value is mkHalves' B′ / P′, the total the page's gains model's. */
function combineMk(pools: Record<string, Pool>): StatResult {
  const items = (k: string) => pools[k]?.items ?? [];
  const base: Node = { name: MK_NODES.base, val: 0, fmt: "+", children: items("base") };
  const perTier: Node = { name: MK_NODES.perTier, val: 0, fmt: "+", children: items("perTier") };
  const tree: Node = { name: MK_ROOT, val: 0, fmt: "%", children: [base, ...items("tier"), perTier, ...items("status")] };
  const flat = flattenTree(tree);
  ({ base: base.val, perTier: perTier.val } = mkHalves(partsFromFlat(flat)));
  tree.val = multikillGainsModel.totalFromFlat(flat);
  return { tree, total: tree.val };
}

export const MK_COLLECTOR: StatCollectorConfig = {
  label: "Multikill",
  focusBoard: "monstersKilled",
  root: MK_ROOT,
  groups: [],
  computePools: mkPools,
  combine: combineMk,
  gated: deriveGatedTalentsFor(MK_CLASS_TALENTS),
  familySources: [],
  outputFile: join(__dirname, "..", "lib", "multikill", "topMultikill.ts"),
  metaFile: join(__dirname, "..", "lib", "multikill", "topMultikill.meta.ts"),
  constPrefix: "TOP_MULTIKILL",
  flatForClassFn: "topMultikillFlatForClass",
  scriptName: "scripts/update-top-multikill.ts",
};

// Imported by the tests without running the collector.
if (require.main === module) runTopCollector(MK_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
