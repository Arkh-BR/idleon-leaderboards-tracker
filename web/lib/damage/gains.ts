// Biggest Gains for the Damage page: a what-if over the flat tree through the
// same dmgMax the tree uses, so the model and the tree cannot diverge. The
// sources are every direct child of the three layers' source groups; the soft
// caps, the Reliquarium exponent, the map-43 replacement, the map-306 divider
// and Mastery are rules or other stats, never ranked (a map is picked, not
// improved). The divider and the Buff 108 row still count in totalFromFlat.
// Gains are measured on Max.

import { directChildren, GROUP_DISPLAY } from "@/lib/statTracker/biggestGains";
import type { GainSource, GainsModel } from "@/lib/statTracker/config";
import { groupVal, type StatGroup } from "@/lib/arkh/stats/defs/grouped";
import { DMG_KEYS, DMG_LAYERS, DMG_RAT, DMG_ROOT, dmgMax, type ValsOf } from "@/lib/arkh/stats/defs/damage";

/** Buff 108 is an active buff the save doesn't hold: always 0, never offered. */
const BUFF_108 = "Buff 108 (active buff only)";

/** The tree path of every pool the descriptor reads, by pool key: the source
 *  groups, the Reliquarium (a group node with one item), the map-306 divider
 *  and the arena. GROUPS is the rankable subset. */
const POOL_PATH = new Map<string, string>([[DMG_RAT.key, `${DMG_ROOT} / ${DMG_RAT.name}`]]);
const GROUPS: { path: string; g: StatGroup }[] = [];
for (const layer of DMG_LAYERS) {
  for (const step of layer.steps) {
    if (step.kind === "cap") continue;
    const path = `${DMG_ROOT} / ${layer.node} / ${step.name}`;
    POOL_PATH.set(step.key, path);
    if (step.kind !== "pow" && step.key !== DMG_KEYS.map) GROUPS.push({ path, g: step });
  }
}

/** A pool's source values, read back from the flat tree. */
const valsOf =
  (flat: Record<string, number>): ValsOf =>
  (key) => directChildren(POOL_PATH.get(key) ?? "", flat).map((p) => Number(flat[p]));

export const damageGainsModel: GainsModel = {
  sources(yoursFlat, refFlat) {
    const out: GainSource[] = [];
    for (const { path: gp, g } of GROUPS) {
      for (const path of directChildren(gp, yoursFlat, refFlat)) {
        const source = path.slice(gp.length + 3);
        if (source !== BUFF_108) out.push({ path, group: g.name, source, display: GROUP_DISPLAY[g.kind] });
      }
    }
    return out;
  },
  totalFromFlat: (flat) => dmgMax(valsOf(flat)),
  // The arena's own test (groupVal is NaN unless a source is finite and > 0).
  replacedBy: (flat) => (Number.isFinite(groupVal(DMG_RAT, valsOf(flat)(DMG_RAT.key))) ? DMG_RAT.name : null),
};
