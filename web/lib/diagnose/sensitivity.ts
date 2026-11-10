// How a tracker's total responds to each term, numerically, through the
// tracker's own model of its formula: GainsModel.totalFromFlat recomputes the
// total from a (modified) flat tree, soft caps included. Generic over every
// kit tracker — nothing here knows a formula.

import type { ArkhNode } from "@/lib/dropRate/node";
import { nodePath, type FlatTree } from "@/lib/dropRate/treeFlatten";

export type TotalFromFlat = (flat: FlatTree) => number;

/** `totalFromFlat` with each `[path, factor]` applied. Edits the caller's flat
 *  in place and restores it (a copy per call is O(tree) — 1.4k keys for Damage);
 *  a path the flat lacks stays absent. */
export function totalWith(flat: FlatTree, totalFromFlat: TotalFromFlat, scale: [string, number][]): number {
  const old = scale.map(([p]) => flat[p]);
  try {
    for (const [p, f] of scale) if (p in flat) flat[p] *= f;
    return totalFromFlat(flat);
  } finally {
    scale.forEach(([p], i) => {
      if (old[i] !== undefined) flat[p] = old[i];
    });
  }
}

const H = 1e-3; // ±0.1%

/** d ln total / d ln leaf by a ±0.1% central difference. A leaf at 0 (or
 *  absent) can't be scaled: e = 0 and `zero`. A non-positive total gives 0. */
export function elasticities(
  flat: FlatTree,
  totalFromFlat: TotalFromFlat,
  paths: string[],
): { path: string; e: number; zero?: true }[] {
  return paths.map((path) => {
    if (!flat[path]) return { path, e: 0, zero: true };
    const up = totalWith(flat, totalFromFlat, [[path, 1 + H]]);
    const down = totalWith(flat, totalFromFlat, [[path, 1 - H]]);
    const e = Math.log(up / down) / Math.log((1 + H) / (1 - H));
    return { path, e: Number.isFinite(e) ? e : 0 };
  });
}

/** The factor on `path` that makes totalFromFlat hit `target`: 1 when it
 *  already does, else a root of ln(total / target) bracketed on [1e-3, 1e6]
 *  in ln factor; null when the target is out of reach there (zero leaf, a cap,
 *  a term the model ignores) or not positive. */
export function requiredFactor(flat: FlatTree, totalFromFlat: TotalFromFlat, path: string, target: number): number | null {
  const T = (x: number) => totalWith(flat, totalFromFlat, [[path, Math.exp(x)]]);
  if (Math.abs(T(0) - target) <= 1e-12 * Math.abs(target)) return 1;
  if (!(target > 0)) return null;
  // ponytail: false position (Illinois) instead of plain bisection — same bracket,
  // but ln(total) is ~linear in ln(factor), so it lands in a few steps, not 60
  // (one Damage totalFromFlat costs ~3.6 ms). A NaN or ±∞ end falls back to a halving.
  const g = (x: number) => Math.log(T(x) / target);
  let a = Math.log(1e-3);
  let b = Math.log(1e6);
  let fa = g(a);
  let fb = g(b);
  if (!(fa * fb < 0)) return null; // no sign change (or NaN)
  let side = 0;
  for (let i = 0; i < 200; i++) {
    let c = (a * fb - b * fa) / (fb - fa);
    if (!(c > a && c < b)) c = (a + b) / 2;
    const fc = g(c);
    if (Number.isNaN(fc)) return null;
    if (Math.abs(fc) < 1e-15 || b - a < 1e-15) return Math.exp(c);
    if (fc * fb > 0) {
      b = c;
      fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c;
      fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
  }
  return Math.exp((a + b) / 2);
}

export type Alert = { path: string; kind: "zero" | "neutral" | "runtime-note" };

const RUNTIME = /active buff only|runtime/i;

/** Silent terms: leaves at exactly 0, leaves at exactly 1 in a multiplier
 *  (their own fmt "x" or a "× Π" parent), and nodes the engine can't know
 *  from the save (name or note says "active buff only" / "runtime"). */
export function alerts(flat: FlatTree, tree: ArkhNode): Alert[] {
  const out: Alert[] = [];
  const walk = (n: ArkhNode, path: string, parent?: ArkhNode) => {
    const kids = n.children ?? [];
    if (!kids.length) {
      const v = flat[path];
      if (v === 0) out.push({ path, kind: "zero" });
      else if (v === 1 && (n.fmt === "x" || /Π/.test(parent?.note ?? ""))) out.push({ path, kind: "neutral" });
    }
    if (RUNTIME.test(`${n.name} ${n.note ?? ""}`)) out.push({ path, kind: "runtime-note" });
    kids.forEach((c, i) => walk(c, nodePath(path, c, kids, i), n));
  };
  walk(tree, nodePath("", tree, [tree], 0));
  return out;
}

export type Mutation = `unequip:${number}` | `map:${number}`;

/** A copy of the save envelope with one in-game action applied to character
 *  `charIdx`: "unequip:<slot>" puts "Blank" in gear slot <slot> (row 0 of
 *  EquipOrder; slot 1 is the weapon), zeroes its EquipQTY and drops its stone
 *  upgrades (EMm0); "map:<id>" sets CurrentMap. Keys stored as JSON strings
 *  stay strings. */
export function whatIf(envelope: unknown, mutation: Mutation, charIdx = 0): unknown {
  const env = structuredClone(envelope) as { data?: Record<string, unknown> };
  const data = (env.data ?? env) as Record<string, unknown>; // as the loader reads it
  const m = /^(unequip|map):(\d+)$/.exec(mutation);
  if (!m) throw new Error(`whatIf: bad mutation "${mutation}" (unequip:<slot> | map:<id>)`);
  const [, kind, arg] = m;
  const n = Number(arg);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edit = (key: string, fn: (v: any) => void) => {
    const raw = data[key];
    if (raw == null) return;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    fn(v);
    data[key] = typeof raw === "string" ? JSON.stringify(v) : v;
  };
  if (kind === "unequip") {
    edit(`EquipOrder_${charIdx}`, (rows) => (rows[0][n] = "Blank"));
    edit(`EquipQTY_${charIdx}`, (rows) => (rows[0][n] = 0));
    edit(`EMm0_${charIdx}`, (slots) => delete slots[n]);
  } else data[`CurrentMap_${charIdx}`] = n; // map
  return env;
}
