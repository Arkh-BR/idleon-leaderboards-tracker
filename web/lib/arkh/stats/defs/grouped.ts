// ===== GROUPED DESCRIPTORS =====
// Shared shape of the "product of groups" stat formulas (Coin Multi, EXP
// Multi, …): each group turns its sources into one factor and the stat is
// the product of the factors, in game order.
//   pct  → 1 + Σ/100      raw → 1 + Σ      min4 → 1 + min(4, Σ)
//   mult → Π(sources): each source is already a factor; max1 wraps the
//          product in max(1, ·) like N.js's Math.max(1, …) blocks.
// Two opt-in step kinds act on the running total instead of multiplying it
// (Drop Rate adds constants between multiplications and replaces the total on
// one map): add → total + Σ (with `below`: only a total under N, capped at N),
// replace → the first finite source replaces the total. A replace source that
// does not apply must be left out of its pool, not emitted as NaN: flattenTree
// turns NaN into 0, and the what-if would then replace the total with 0.

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

export type GroupKind = "pct" | "raw" | "min4" | "mult" | "add" | "replace";

export type StatGroup = {
  key: string;
  name: string;
  kind: GroupKind;
  /** mult only: the game wraps the product in Math.max(1, ·). */
  max1?: boolean;
  /** add only: the step applies just when the running total is under this,
   *  and tops it up to at most this (the DR chip floor, capped at 5). */
  below?: number;
  /** Tooltip text after the shape note ("× (1 + Σ/100) · <note>"). */
  note?: string;
  sources: readonly string[];
};

/** A group's factor from its source values. NaN counts as the kind's neutral
 *  element (0 in a sum, 1 in a product), like the old `Number(v) || 0`. */
export function groupFactorOf(g: Pick<StatGroup, "kind" | "max1">, vals: readonly number[]): number {
  if (g.kind === "add" || g.kind === "replace") return NaN; // no factor: see groupVal
  if (g.kind === "mult") {
    const p = vals.reduce((a, v) => a * (Number.isNaN(v) ? 1 : v), 1);
    return g.max1 ? Math.max(1, p) : p;
  }
  const sum = vals.reduce((a, v) => a + (Number(v) || 0), 0);
  if (g.kind === "pct") return 1 + sum / 100;
  if (g.kind === "raw") return 1 + sum;
  return 1 + Math.min(4, sum);
}

/** The group's own number in the tree: the factor for pct/raw/min4/mult, Σ for
 *  add, the replacement (NaN when no source is finite) for replace. */
export function groupVal(g: Pick<StatGroup, "kind" | "max1">, vals: readonly number[]): number {
  if (g.kind === "add") return vals.reduce((a, v) => a + (Number(v) || 0), 0);
  if (g.kind === "replace") return vals.find((v) => Number.isFinite(v)) ?? NaN;
  return groupFactorOf(g, vals);
}

/** The running total after one group. The ONE place a step is applied: the
 *  descriptor's combine and the Biggest Gains what-if both call it, so the tree
 *  and the what-if cannot diverge. */
export function applyGroupStep(g: Pick<StatGroup, "kind" | "max1" | "below">, vals: readonly number[], total: number): number {
  const v = groupVal(g, vals);
  if (g.kind === "add") return g.below === undefined ? total + v : total < g.below ? Math.min(g.below, total + v) : total;
  if (g.kind === "replace") return Number.isNaN(v) ? total : v;
  return total * v;
}

/** The value a zeroed (e.g. class-gated) source takes in a group of this kind. */
export function neutralValue(kind: GroupKind): number {
  return kind === "mult" ? 1 : kind === "replace" ? NaN : 0;
}

export function groupNote(g: Pick<StatGroup, "kind" | "max1" | "below">): string {
  if (g.kind === "add") return g.below === undefined ? "+ Σ" : `+ Σ (only below ${g.below}, capped at ${g.below})`;
  if (g.kind === "replace") return "replaces the total";
  if (g.kind === "pct") return "× (1 + Σ/100)";
  if (g.kind === "raw") return "× (1 + Σ)";
  if (g.kind === "min4") return "× (1 + min(4, Σ))";
  return g.max1 ? "× max(1, Π)" : "× Π";
}

export function groupedDescriptor(opts: {
  id: string;
  name: string;
  scope: string;
  category: string;
  system: string;
  groups: readonly StatGroup[];
}): Descriptor {
  const pools: Record<string, SourceSpec[]> = {};
  for (const g of opts.groups) pools[g.key] = g.sources.map((id) => ({ system: opts.system, id }));
  return {
    id: opts.id,
    name: opts.name,
    scope: opts.scope,
    category: opts.category,
    pools,
    combine(p) {
      let total = 1;
      const children: ArkhNode[] = [];
      for (const g of opts.groups) {
        const items = p[g.key]?.items ?? [];
        const vals = items.map((it) => Number(it.val));
        total = applyGroupStep(g, vals, total);
        const fmt = g.kind === "add" ? "+" : g.kind === "replace" ? "raw" : "x";
        children.push({ name: g.name, val: groupVal(g, vals), fmt, note: g.note ? `${groupNote(g)} · ${g.note}` : groupNote(g), children: items });
      }
      return { val: total, children };
    },
  };
}
