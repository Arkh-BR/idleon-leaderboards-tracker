// ===== DAMAGE DESCRIPTOR =====
// N.js _customBlock_DamageDealed("Max") / ("Mastery"): the damage range shown
// in the character panel, Min ~ Max, Min = Max × Mastery.
//   Max = L0 × L1 × L2, three layers that each run their steps in game order:
//     L0 base      (0): Σ sources → soft cap → + food (after the cap)
//     L1 damage %  (1): × (1 + Σ/100) / × factor … → soft cap
//     L2 multipliers (1): × … → soft cap → × post-cap factors → ^ Reliquarium → × map
//   The Royal Guardian arena (map 43) replaces the whole Max with RatDMG.
//   Mastery = min(0.8, 0.35 + Σ/100); a flat 0.2 on map 43.
// Every group is a source pool of the `damage` system (systems/damage); the
// shapes and the order live in lib/damage/layers (re-exported below). dmgMax()/dmgLayer() are the one copy of the
// math: combine() here, the Biggest Gains what-if and the Observed Max
// collector all go through them. combine() takes no ctx (the collector calls it
// without one): the map rules arrive as sources (`rat`, `l2map`).
// Not ported: Wraith / Tempest / Tesseract forms and the dungeon branch.

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";
import { applyGroupStep, groupNote, groupVal, type StatGroup } from "./grouped";
import { DMG_LAYERS, DMG_MASTERY, DMG_NODES, DMG_RAT, DMG_ROOT, type DmgLayer, type DmgStep } from "@/lib/damage/layers";

// The display config (names, layers, steps, source ids) lives in lib/damage/layers (Ruling B): re-exported, so every importer of
// this file keeps working. The math over it (caps, dmgLayer, dmgMax, dmgMastery, combine) stays here.
export { DMG_KEYS, DMG_LAYERS, DMG_MASTERY, DMG_NODES, DMG_RAT, DMG_ROOT, DMG_RULES, type DmgLayer, type DmgStep } from "@/lib/damage/layers";

const isGroup = (s: DmgStep): s is StatGroup => s.kind !== "cap" && s.kind !== "pow";

/** Every StatGroup of the descriptor (layers + mastery + rat): what the
 *  Observed Max collector and the neutral-value logic iterate. The `pow` pool
 *  isn't here — the collector treats it as `pct`, whose neutral 0 is the pow's. */
export const DMG_GROUPS: readonly StatGroup[] = [...DMG_LAYERS.flatMap((l) => l.steps.filter(isGroup)), DMG_MASTERY, DMG_RAT];

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
const powExp = (vals: readonly number[]): number => vals.find((v) => Number.isFinite(v) && v > 0) ?? 0;

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
const ratActive = (valsOf: ValsOf): boolean => groupVal(DMG_RAT, valsOf(DMG_RAT.key)) > 0;

// @njs _customBlock_DamageDealed
export function dmgMastery(valsOf: ValsOf): number {
  return ratActive(valsOf) ? 0.2 : Math.min(0.8, 0.35 + sum(valsOf(DMG_MASTERY.key)) / 100);
}

const short = (v: number): string => (Math.abs(v) >= 1e6 ? v.toExponential(3) : String(+v.toFixed(3)));

/** A group's tree node, shaped like groupedDescriptor's. A `replace` that
 *  doesn't apply shows 0, not NaN: the tree carries no NaN. */
function groupNode(g: StatGroup, items: ArkhNode[], vals: readonly number[]): ArkhNode {
  const v = groupVal(g, vals);
  return {
    name: g.name,
    val: Number.isNaN(v) ? 0 : v,
    fmt: g.kind === "add" ? "+" : g.kind === "replace" ? "raw" : "x",
    note: groupNote(g),
    children: items,
  };
}

const pools: Record<string, SourceSpec[]> = {};
for (const s of [...DMG_LAYERS.flatMap((l) => l.steps), DMG_MASTERY, DMG_RAT]) {
  if ("sources" in s) pools[s.key] = s.sources.map((id) => ({ system: "damage", id }));
}

const damageDesc: Descriptor = {
  id: "damage",
  name: DMG_ROOT,
  scope: "character+map",
  category: "progression",
  pools,
  combine(p) {
    const items = (k: string) => p[k]?.items ?? [];
    const valsOf: ValsOf = (k) => items(k).map((it) => Number(it.val));
    const children: ArkhNode[] = DMG_LAYERS.map((layer) => {
      const r = dmgLayer(layer, valsOf);
      const steps = layer.steps.map((s): ArkhNode => {
        if (s.kind === "cap") {
          return { name: s.name, val: r.capIn ? r.capOut / r.capIn : 1, fmt: "x", note: `${short(r.capIn)} → ${short(r.capOut)}` };
        }
        if (s.kind === "pow") {
          return { name: s.name, val: powExp(valsOf(s.key)), fmt: "raw", note: `${layer.node} ^ exponent (0 = inactive)`, children: items(s.key) };
        }
        return groupNode(s, items(s.key), valsOf(s.key));
      });
      return { name: layer.node, val: r.val, fmt: layer.key === "base" ? "raw" : "x", children: steps };
    });
    children.push(groupNode(DMG_RAT, items(DMG_RAT.key), valsOf(DMG_RAT.key)));
    children.push({
      name: DMG_NODES.mastery,
      val: dmgMastery(valsOf),
      fmt: "raw",
      note: ratActive(valsOf) ? "fixed 0.2 on map 43" : "min(0.8, 0.35 + Σ/100)",
      children: items(DMG_MASTERY.key),
    });
    return { val: dmgMax(valsOf), children, note: "Min ~ Max · Min = Max × Mastery", fmt: "raw" };
  },
};

export default damageDesc;
