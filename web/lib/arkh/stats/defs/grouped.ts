// ===== GROUPED DESCRIPTORS =====
// Shared shape of the "product of groups" stat formulas (Coin Multi, EXP
// Multi, …): each group turns its sources into one factor and the stat is
// the product of the factors, in game order.
//   pct  → 1 + Σ/100      raw → 1 + Σ      min4 → 1 + min(4, Σ)
//   mult → Π(sources): each source is already a factor; max1 wraps the
//          product in max(1, ·) like N.js's Math.max(1, …) blocks.

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

export type GroupKind = "pct" | "raw" | "min4" | "mult";

export type StatGroup = {
  key: string;
  name: string;
  kind: GroupKind;
  /** mult only: the game wraps the product in Math.max(1, ·). */
  max1?: boolean;
  sources: readonly string[];
};

/** A group's factor from its source values. NaN counts as the kind's neutral
 *  element (0 in a sum, 1 in a product), like the old `Number(v) || 0`. */
export function groupFactorOf(g: Pick<StatGroup, "kind" | "max1">, vals: readonly number[]): number {
  if (g.kind === "mult") {
    const p = vals.reduce((a, v) => a * (Number.isNaN(v) ? 1 : v), 1);
    return g.max1 ? Math.max(1, p) : p;
  }
  const sum = vals.reduce((a, v) => a + (Number(v) || 0), 0);
  if (g.kind === "pct") return 1 + sum / 100;
  if (g.kind === "raw") return 1 + sum;
  return 1 + Math.min(4, sum);
}

/** The value a zeroed (e.g. class-gated) source takes in a group of this kind. */
export function neutralValue(kind: GroupKind): number {
  return kind === "mult" ? 1 : 0;
}

export function groupNote(g: Pick<StatGroup, "kind" | "max1">): string {
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
        const factor = groupFactorOf(g, items.map((it) => Number(it.val)));
        total *= factor;
        children.push({ name: g.name, val: factor, fmt: "x", note: groupNote(g), children: items });
      }
      return { val: total, children };
    },
  };
}
