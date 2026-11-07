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
// replace → the first finite source > 0 replaces the total. Meant for a single
// source: emit 0 when it doesn't apply (never omit it or emit NaN: flattenTree
// turns NaN into 0, and 0 is what keeps the what-if equal to the tree).

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

// The folds live in lib/statTracker/groups (Ruling KK: lib/game must not import lib/arkh); re-exported so every importer of this module keeps working.
import { applyGroupStep, groupNote, groupVal, type StatGroup } from "@/lib/statTracker/groups";
export { applyGroupStep, groupFactorOf, groupNote, groupVal, neutralValue, type GroupKind, type StatGroup } from "@/lib/statTracker/groups";

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
