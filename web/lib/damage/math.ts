// The damage math over the display config (lib/damage/layers): the soft caps, one layer's run, Max and Mastery. The page's
// Biggest Gains what-if (gains.ts) calls these.

import { applyGroupStep, groupVal } from "@/lib/statTracker/groups";
import { DMG_LAYERS, DMG_MASTERY, DMG_RAT, type DmgLayer } from "./layers";

// @njs _customBlock_DamageDealed
/** Layer 0: past 4000 the sum goes x^0.91, and the result past 15000 x^0.84. */
export function capBase(v: number): number {
  if (v > 4000) {
    v = 4000 + (v - 4000) ** 0.91;
    if (v > 15000) v = 15000 + (v - 15000) ** 0.84;
  }
  return v;
}

/** N.js's "T < v → T·(v/T)^e" bracket. */
const bracket = (v: number, t: number, e: number): number => (v > t ? t * (v / t) ** e : v);
const soft100 = (v: number): number => (v > 100 ? 100 + (v - 100) ** 0.86 : v);

// @njs _customBlock_DamageDealed
/** Layer 1: past 100 x^0.86, past 2e6 √ of the excess, past 1e8 x^0.3. */
export function capPct(v: number): number {
  return bracket(bracket(soft100(v), 2e6, 0.5), 1e8, 0.3);
}

// @njs _customBlock_DamageDealed
/** Layer 2: past 100 x^0.86, then five brackets (2e7 … 6e10) chained in order. */
export function capMult(v: number): number {
  return bracket(bracket(bracket(bracket(bracket(soft100(v), 2e7, 0.8), 5e8, 0.6), 2e9, 0.45), 15e9, 0.36), 6e10, 0.28);
}

const CAPS: Record<string, (v: number) => number> = { capBase, capPct, capMult };

/** Source values of a pool key; [] for a pool that isn't there. */
export type ValsOf = (key: string) => readonly number[];

const sum = (xs: readonly number[]): number => xs.reduce((a, v) => a + (Number(v) || 0), 0);
/** The Reliquarium exponent: the first finite source > 0, else 0 (not owned). */
export const powExp = (vals: readonly number[]): number => vals.find((v) => Number.isFinite(v) && v > 0) ?? 0;

/** One layer's value, plus what its soft cap took in and gave back. */
export function dmgLayer(layer: DmgLayer, valsOf: ValsOf): { val: number; capIn: number; capOut: number } {
  let val = layer.start;
  let capIn = 0;
  let capOut = 0;
  for (const s of layer.steps) {
    if (s.kind === "cap") {
      capIn = val;
      val = CAPS[s.key](val);
      capOut = val;
    } else if (s.kind === "pow") {
      const e = powExp(valsOf(s.key));
      if (e > 0) val **= e;
    } else {
      val = applyGroupStep(s, valsOf(s.key), val);
    }
  }
  return { val, capIn, capOut };
}

// @njs _customBlock_DamageDealed
/** Max = L0 · L1 · L2, then the map-43 replacement. */
export function dmgMax(valsOf: ValsOf): number {
  const total = DMG_LAYERS.reduce((t, l) => t * dmgLayer(l, valsOf).val, 1);
  return applyGroupStep(DMG_RAT, valsOf(DMG_RAT.key), total);
}

/** Whether the arena replaces Max: the same test applyGroupStep uses. */
export const ratActive = (valsOf: ValsOf): boolean => groupVal(DMG_RAT, valsOf(DMG_RAT.key)) > 0;

// @njs _customBlock_DamageDealed
export function dmgMastery(valsOf: ValsOf): number {
  return ratActive(valsOf) ? 0.2 : Math.min(0.8, 0.35 + sum(valsOf(DMG_MASTERY.key)) / 100);
}
