// Bottom-up "frankenstein" recompute of AGGREGATE nodes for the top-player
// reference map.
//
// best-per-path maximizes every leaf, but an aggregate node (a bucket like
// 🃏 Cards = Σ its cards, or the Additive Pool = Σ its buckets, or a
// multiplier like the Cards DR-Multi = 1 + Σ its cards / 100) ends up showing
// the best SINGLE player's value — it isn't recomputed from its
// independently-maxed children, so it understates the true ceiling (the best
// of each component combined).
//
// We can't recompute generically: most tree nodes are BESPOKE per-source
// formulas whose children are inputs (Salt Lick = Lv × Per Lv, a talent's
// Effective Level, …), not clean addends. So we DETECT, per node path, which
// simple op (SUM / PROD / 1+Σ/100 / …) reproduces the parent from its
// children — and require it to hold for EVERY scanned player before trusting
// it. Nodes with a verified op get recomputed from their maxed children;
// everything else keeps its best-per-path value (which, for a single source,
// already IS its frankenstein max). No formula is ever guessed.

import { nodePath, type FlatTree } from "../../lib/dropRate/treeFlatten";
import type { CorganNode } from "../../lib/corgan/node";

const approx = (a: number, b: number) =>
  Math.abs(a - b) <= Math.abs(b) * 5e-4 + 1e-6;

const isMult = (c: CorganNode) => c.fmt === "x";

// Each op predicts the parent value from its children's values (aligned to
// `kids`). Additive children = everything that isn't a multiplier (fmt "x").
type OpFn = (kids: CorganNode[], vals: number[]) => number;
const OPS: Record<string, OpFn> = {
  "1+SUM/100": (_k, v) => 1 + v.reduce((a, b) => a + b, 0) / 100,
  "PROD(x)": (k, v) =>
    k.reduce((a, c, i) => (isMult(c) ? a * (v[i] !== 0 ? v[i] : 1) : a), 1),
  PROD: (_k, v) => v.reduce((a, b) => a * (b !== 0 ? b : 1), 1),
  "SUM(+raw)*PROD(x)": (k, v) => {
    let s = 0;
    let p = 1;
    k.forEach((c, i) => {
      if (isMult(c)) p *= v[i] !== 0 ? v[i] : 1;
      else s += v[i];
    });
    return s * p;
  },
  "SUM(+raw)": (k, v) => k.reduce((a, c, i) => (isMult(c) ? a : a + v[i]), 0),
  SUM: (_k, v) => v.reduce((a, b) => a + b, 0),
};
// Most-specific first: a node that matches several ops (usually because it
// has a single child, so the ops coincide) takes the tightest form.
const PRIORITY = [
  "1+SUM/100",
  "PROD(x)",
  "PROD",
  "SUM(+raw)*PROD(x)",
  "SUM(+raw)",
  "SUM",
];

function matchOps(n: CorganNode): Set<string> {
  const kids = n.children || [];
  const out = new Set<string>();
  if (!kids.length) return out;
  const vals = kids.map((c) => Number(c.val) || 0);
  const p = Number(n.val) || 0;
  for (const name of PRIORITY) {
    try {
      if (approx(p, OPS[name](kids, vals))) out.add(name);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Walk one player's tree and intersect the matching-op set per node path
 *  into `opSets` (an op survives only if it matched for every tree seen). */
export function accumulateOps(
  tree: CorganNode,
  opSets: Map<string, Set<string>>
): void {
  const walk = (
    n: CorganNode,
    parentPath: string,
    sibs: CorganNode[],
    idx: number
  ) => {
    const path = nodePath(parentPath, n, sibs, idx);
    const kids = n.children || [];
    if (kids.length) {
      const m = matchOps(n);
      const prev = opSets.get(path);
      if (!prev) opSets.set(path, m);
      else for (const o of [...prev]) if (!m.has(o)) prev.delete(o);
    }
    for (let i = 0; i < kids.length; i++) walk(kids[i], path, kids, i);
  };
  walk(tree, "", [tree], 0);
}

/** Collapse each path's surviving op set to its highest-priority op. */
export function chooseOps(opSets: Map<string, Set<string>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, set] of opSets) {
    for (const o of PRIORITY) {
      if (set.has(o)) {
        out.set(path, o);
        break;
      }
    }
  }
  return out;
}

/**
 * Recompute the reference map bottom-up over a structure tree: a node with a
 * verified op becomes op(of its recomputed children); every other node keeps
 * its best-per-path value from `bestFlat`. Returns a flat path→value map.
 */
export function recomputeFrankenstein(
  structure: CorganNode,
  bestFlat: FlatTree,
  opByPath: Map<string, string>
): { flat: FlatTree; recomputed: number } {
  const out: FlatTree = {};
  let recomputed = 0;
  const walk = (
    n: CorganNode,
    parentPath: string,
    sibs: CorganNode[],
    idx: number
  ): number => {
    const path = nodePath(parentPath, n, sibs, idx);
    const kids = n.children || [];
    let val: number;
    if (kids.length) {
      const childVals = kids.map((c, i) => walk(c, path, kids, i));
      const op = opByPath.get(path);
      if (op) {
        val = OPS[op](kids, childVals);
        recomputed++;
      } else {
        val = bestFlat[path] ?? (Number(n.val) || 0);
      }
    } else {
      val = bestFlat[path] ?? (Number(n.val) || 0);
    }
    out[path] = val;
    return val;
  };
  walk(structure, "", [structure], 0);
  // Carry over any best-per-path paths the structure tree didn't cover (a
  // source some other player had but the structure player lacked).
  for (const p in bestFlat) if (!(p in out)) out[p] = bestFlat[p];
  return { flat: out, recomputed };
}
