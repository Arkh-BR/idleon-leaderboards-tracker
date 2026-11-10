// Refresh the bundled top-player Damage reference in lib/damage/topDamage.ts
// (+ .meta.ts), on lib/game: the page's tracker (computeGameDamage) read into
// one pool per layer step (plus the arena and Mastery), the bests rebuilt
// with the tracker's own layerOf and totalled by the page's gains model
// (damageGainsModel). Every character is measured on map 251 (w6a1, DMG_COLLECTOR_MAP):
// Max only depends on the map on 43 (Royal Guardian arena) and 306 (Clamworks),
// so any other map keeps both map rules neutral — the map-independent Max. The
// class talents the formula reads (DMG_CLASS_TALENTS) are gated per class.
//
// No board ranks damage, so the candidates are the #1 of every board plus the
// top 10 of Monsters Killed (the combat board, like Multikill's).
//
// Which sources stay per CLASS FAMILY (familySources) — those that scale with
// a character stat, which a warrior never gets from a mage; every other source
// takes the best across all families. Names are the exact node names the
// tracker emits (lib/game/trackers/damage.ts); the collector throws if one
// matches nothing, so a rename can't silently fall back to the cross-family best.
//   · l0      Weapon Power² (wpSquared), Primary Stat (statType), Weapon Power +
//             Stat (statWpFloor), and the three base-damage bubbles that scale
//             with HP / move speed / MP (bubbleHP, bubbleSPD, bubbleMP);
//   · l1base  Primary Stat^0.7 (statPow), Talents 86 / 446 (× log10 of HP / MP);
//   · l1chain Talent 290 (× move-speed steps);
//   · l2rift  Bubbles W5 / A5 / M5 (× ⌊stat/250⌋ and zero off the bubble's class).
//
// Known residual: the Weapon Power talents (530/140/170/320/500/365) and the
// move-speed talents (616/631/266/77/641) live INSIDE those composite sources
// (WP, speed), not as nodes of their own, so they can't be class-gated: a
// family's reference WP / speed may include another class's skill talents.
// Same for 95 / 455 / 20 (inside Primary Stat) and 97 / 277 / 457 (inside
// Weapon Power²): they are in DMG_CLASS_TALENTS, but the gating only
// neutralises top-level source nodes, so it never touches them.
//
// Not measured: Wraith / Tempest / Tesseract forms and the dungeon branch (not
// ported), and active buffs (Talents 108/124 are 0).
//
// Run (from web/):
//   npx tsx scripts/update-top-damage.ts   [--limit N] [--slow] [--saves-dir <dir>]
// The IT profiles API answers 403 outside the deployed site; offline, point
// --saves-dir at already-downloaded saves, e.g. scripts/updater/.cache/saves-fresh.
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type Pool, type StatCollectorConfig } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { poolsOf } from "./_shared/gamePools";
import { computeGameDamage, layerOf } from "../lib/game/trackers/damage";
import { DMG_CLASS_TALENTS, DMG_COLLECTOR_MAP, DMG_GROUPS, DMG_LAYERS, DMG_MASTERY, DMG_RAT, DMG_ROOT } from "../lib/damage/layers";
import { dmgMastery } from "../lib/damage/math";
import { damageGainsModel } from "../lib/damage/gains";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { groupVal } from "../lib/statTracker/groups";
import type { StatResult } from "../lib/statTracker/config";

type Node = StatResult["tree"];

/** Every pool the tree has, by step key: each layer step with sources (the Reliquarium's pow step included), the arena and Mastery. */
export const DMG_PARENTS: Record<string, string> = {
  ...Object.fromEntries(DMG_LAYERS.flatMap((l) => l.steps.filter((s) => s.kind !== "cap").map((s) => [s.key, `${DMG_ROOT} / ${l.node} / ${s.name}`]))),
  [DMG_RAT.key]: `${DMG_ROOT} / ${DMG_RAT.name}`,
  [DMG_MASTERY.key]: `${DMG_ROOT} / ${DMG_MASTERY.name}`,
};

/** The Reliquarium's pool key (the layers' one `pow` step). */
const RELIC_KEY = DMG_LAYERS.flatMap((l) => l.steps).find((st) => st.kind === "pow")!.key;

/** One character's pools with the Reliquarium forced off (val 0, its trace dropped). Its exponent 4/(5+OLA[473]) is < 1, so mergeBest's
 *  "keep the larger" would let ONE carrier make every family reference apply L2^0.33; same paths, neutral value. */
function damagePools(save: unknown, ci: number): Record<string, Pool> {
  const pools = poolsOf(computeGameDamage(save, ci, DMG_COLLECTOR_MAP).tree, DMG_PARENTS);
  pools[RELIC_KEY] = { items: pools[RELIC_KEY].items.map(({ children: _, ...it }) => ({ ...it, val: 0 })) };
  return pools;
}

/** The tracker's tree from pools: each layer through layerOf (its steps on the running value, as the tracker runs them), the arena and
 *  Mastery beside them, the total from the page's gains model. */
function combineDamage(pools: Record<string, Pool>): StatResult {
  const items = (k: string) => pools[k]?.items ?? [];
  const byId = new Map<string, Node>();
  for (const s of [...DMG_LAYERS.flatMap((l) => l.steps), DMG_RAT, DMG_MASTERY]) if ("sources" in s) s.sources.forEach((id, i) => byId.set(id, items(s.key)[i]));
  const rat = groupVal(DMG_RAT, items(DMG_RAT.key).map((i) => i.val));
  const tree: Node = {
    name: DMG_ROOT,
    val: 0,
    fmt: "raw",
    children: [
      ...DMG_LAYERS.map((l) => layerOf(l, (id) => byId.get(id)!).node),
      { name: DMG_RAT.name, val: Number.isNaN(rat) ? 0 : rat, fmt: "raw", children: items(DMG_RAT.key) },
      { name: DMG_MASTERY.name, val: dmgMastery((k) => items(k).map((i) => i.val)), fmt: "raw", children: items(DMG_MASTERY.key) },
    ],
  };
  tree.val = damageGainsModel.totalFromFlat(flattenTree(tree));
  return { tree, total: tree.val };
}

export const DMG_COLLECTOR: StatCollectorConfig = {
  label: "Damage",
  // No board ranks damage: the combat one, like Multikill.
  focusBoard: "monstersKilled",
  root: DMG_ROOT,
  groups: DMG_GROUPS,
  computePools: damagePools,
  combine: combineDamage,
  gated: deriveGatedTalentsFor(DMG_CLASS_TALENTS),
  familySources: [
    { group: "l0", name: "Weapon Power²" }, // wpSquared
    { group: "l0", name: "Primary Stat" }, // statType
    { group: "l0", name: "Weapon Power + Stat (max 150)" }, // statWpFloor
    { group: "l0", name: "Big Meaty Claws (Bubble bdmgHP)" }, // bubbleHP
    { group: "l0", name: "Quick Slap (Bubble bdmgSPD)" }, // bubbleSPD
    { group: "l0", name: "Name I Guess (Bubble bdmgMP)" }, // bubbleMP
    { group: "l1base", name: "Primary Stat^0.7" }, // statPow
    { group: "l1base", name: "Meat Shank (Talent 86)" }, // talent86
    { group: "l1base", name: "Overclocked Energy (Talent 446)" }, // talent446
    { group: "l1chain", name: "Speedna (Talent 290)" }, // talent290
    { group: "l2rift", name: "Power Trione (Bubble W5)" }, // bubbleW5
    { group: "l2rift", name: "Power Tritwo (Bubble A5)" }, // bubbleA5
    { group: "l2rift", name: "Power Trithree (Bubble M5)" }, // bubbleM5
  ],
  outputFile: join(__dirname, "..", "lib", "damage", "topDamage.ts"),
  metaFile: join(__dirname, "..", "lib", "damage", "topDamage.meta.ts"),
  constPrefix: "TOP_DAMAGE",
  flatForClassFn: "topDamageFlatForClass",
  scriptName: "scripts/update-top-damage.ts",
};

// Imported by the tests without running the collector.
if (require.main === module) runTopCollector(DMG_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
