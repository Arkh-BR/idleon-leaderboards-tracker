// Refresh the bundled top-player Damage reference in lib/damage/topDamage.ts
// (+ .meta.ts). Every character is measured on map 251 (w6a1, DMG_COLLECTOR_MAP):
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
// damage system emits (systems/damage/damage.ts); the collector throws if one
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

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhDamagePools, combineDamagePools, DMG_COLLECTOR_MAP } from "../lib/arkh/computeDamage";
import { DMG_ROOT, DMG_GROUPS, DMG_LAYERS } from "../lib/arkh/stats/defs/damage";
import { DMG_CLASS_TALENTS } from "../lib/arkh/stats/systems/damage/damage";
import type { Pool } from "../lib/arkh/stats/tree-builder";

/** The Reliquarium's pool key (the layers' one `pow` step). */
const RELIC_KEY = DMG_LAYERS.flatMap((l) => l.steps).find((st) => st.kind === "pow")!.key;

/** One character's pools with the Reliquarium forced off (val 0, "Carried" 0). Its
 *  exponent 4/(5+OLA[473]) is < 1, so mergeBest's "keep the larger" would let ONE
 *  carrier make every family reference apply L2^0.33; same paths, neutral value. */
export function collectorPools(save: any, ci: number): Record<string, Pool> {
  const pools = computeArkhDamagePools(save, ci, DMG_COLLECTOR_MAP);
  const relic = pools[RELIC_KEY];
  if (!relic) return pools;
  const items = relic.items.map((it) => ({
    ...it,
    val: 0,
    children: it.children?.map((c) => (c.name === "Carried" ? { ...c, val: 0 } : c)),
  }));
  return { ...pools, [RELIC_KEY]: { ...relic, items } };
}

// Imported by the unit test (collectorPools) without running the collector.
if (require.main === module) runTopCollector({
  label: "Damage",
  // No board ranks damage: the combat one, like Multikill.
  focusBoard: "monstersKilled",
  root: DMG_ROOT,
  groups: DMG_GROUPS,
  computePools: collectorPools,
  combine: combineDamagePools,
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
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
