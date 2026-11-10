// Refresh the bundled top-player AFK Gains Rate reference in
// lib/afkGains/topAfkGains.ts (+ .meta.ts), on lib/game: the page's tracker
// (computeGameAfkGains) read into the four pools of AFK_POOLS (the fight and ALL
// terms, the two multipliers, the three map-rule rows), the bests rebuilt into
// the page's tree and totalled by its gains model (afkGainsModel). Each
// character is measured on its save's best Arcane AFK map (MAP_PICKS.afk: the
// fighting map with the highest arcane slot-2 bonus — spec A6); talents 79/88/268/448 are gated per class
// (A10). Neutral values are 0 (they're all in the fighting pool); the map
// rules stay neutral because the chosen map is never 216 or 306. No source
// scales with a character stat, so every source takes the best across all
// class families (familySources: []).
//
// Run (from web/):  npx tsx scripts/update-top-afk.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type Pool, type StatCollectorConfig } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { MAP_PICKS, pickMap, poolsOf } from "./_shared/gamePools";
import { computeGameAfkGains } from "../lib/game/trackers/afkGains";
import { AFK_CLASS_TALENTS, AFK_NODES, AFK_POOLS, AFK_ROOT } from "../lib/afkGains/layers";
import { afkGainsModel } from "../lib/afkGains/pageConfig";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import type { StatResult } from "../lib/statTracker/config";

type Node = StatResult["tree"];

const at = (name: string) => `${AFK_ROOT} / ${name}`;
const N_FIGHT = AFK_POOLS[0].sources.length;
const RULES = [AFK_NODES.clam, AFK_NODES.cove, AFK_NODES.type];

/** AFK_POOLS' pools from the tracker's tree: the fighting pool's children split into the fight and ALL terms, the Arcane and EtcBonuses(92)
 *  terms, and the three map-rule rows (root children, carried whole). A tree without them (a target with nothing to fight) throws. */
function afkPools(save: unknown, ci: number): Record<string, Pool> {
  const tree = computeGameAfkGains(save, ci, pickMap(save, ci, MAP_PICKS.afk)).tree;
  const p = poolsOf(tree, { pool: at(AFK_NODES.pool), arcane: at(AFK_NODES.arcane), etc92: at(AFK_NODES.etc92) });
  const rules = RULES.map((name) => {
    const n = tree.children?.find((c) => c.name === name);
    if (!n) throw new Error(`AFK Gains: no "${name}" row`);
    return n;
  });
  return { fight: { items: p.pool.items.slice(0, N_FIGHT) }, all: { items: p.pool.items.slice(N_FIGHT) }, multi: { items: [...p.arcane.items, ...p.etc92.items] }, rules: { items: rules } };
}

/** The tracker's tree from AFK_POOLS' pools, the total from the page's gains model. */
function combineAfk(pools: Record<string, Pool>): StatResult {
  const items = (k: string) => pools[k]?.items ?? [];
  const pool = [...items("fight"), ...items("all")];
  const [arcane, etc92] = items("multi");
  const sum = (xs: Node[]) => xs.reduce((a, n) => a + n.val, 0);
  const tree: Node = {
    name: AFK_ROOT,
    val: 0,
    fmt: "x",
    children: [
      { name: AFK_NODES.pool, val: sum(pool) / 100, fmt: "x", children: pool },
      { name: AFK_NODES.arcane, val: 1 + sum([arcane]) / 100, fmt: "x", children: [arcane] },
      { name: AFK_NODES.etc92, val: 1 + sum([etc92]) / 100, fmt: "x", children: [etc92] },
      ...items("rules"),
    ],
  };
  tree.val = afkGainsModel.totalFromFlat(flattenTree(tree));
  return { tree, total: tree.val };
}

export const AFK_COLLECTOR: StatCollectorConfig = {
  label: "AFK Gains Rate",
  focusBoard: "afkTime",
  root: AFK_ROOT,
  groups: AFK_POOLS,
  computePools: afkPools,
  combine: combineAfk,
  gated: deriveGatedTalentsFor(AFK_CLASS_TALENTS),
  familySources: [],
  outputFile: join(__dirname, "..", "lib", "afkGains", "topAfkGains.ts"),
  metaFile: join(__dirname, "..", "lib", "afkGains", "topAfkGains.meta.ts"),
  constPrefix: "TOP_AFK",
  flatForClassFn: "topAfkFlatForClass",
  scriptName: "scripts/update-top-afk.ts",
};

// Imported by the tests and compare-top-ref without running the collector.
if (require.main === module) runTopCollector(AFK_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
