// The group folds of the "product of groups" stat pages (Coin Multi, EXP Multi, Damage, AFK, Artifact Find, ...): the shape of a group and what a
// group makes of its sources' values. lib/game's tracker adapters and the page's Biggest Gains model read this.
//
// A group turns its source values into one number and the stat is the running product of the groups in order:
//   pct 1 + S/100 | raw 1 + S | min4 1 + min(4, S) | mult the product of the values (max1: at least 1)
// `add` (running total + S, optionally only under `below`, topped up to at most `below`) and `replace` (the first finite value above 0 replaces
// the running total) act on the running total instead of multiplying it.

export type GroupKind = "pct" | "raw" | "min4" | "mult" | "add" | "replace";

export type StatGroup = {
  key: string;
  name: string;
  kind: GroupKind;
  /** mult only: the game wraps the product in Math.max(1, ·). */
  max1?: boolean;
  /** add only: applies just while the running total is under this, and tops it up to at most this. */
  below?: number;
  /** Tooltip text after the shape note. */
  note?: string;
  sources: readonly string[];
};

const sumOf = (vals: readonly number[]): number => vals.reduce((a, v) => a + (Number(v) || 0), 0); // a NaN counts as 0

/** The factor a pct / raw / min4 / mult group multiplies the total by (NaN for add and replace: they have no factor). */
export function groupFactorOf(g: Pick<StatGroup, "kind" | "max1">, vals: readonly number[]): number {
  switch (g.kind) {
    case "pct":
      return 1 + sumOf(vals) / 100;
    case "raw":
      return 1 + sumOf(vals);
    case "min4":
      return 1 + Math.min(4, sumOf(vals));
    case "mult": {
      const product = vals.reduce((a, v) => (Number.isNaN(v) ? a : a * v), 1); // a NaN counts as 1
      return g.max1 ? Math.max(1, product) : product;
    }
    default:
      return NaN;
  }
}

/** The group's own number in the tree: its factor, the sum for `add`, the first finite value above 0 for `replace` (NaN when there is none). */
export function groupVal(g: Pick<StatGroup, "kind" | "max1">, vals: readonly number[]): number {
  if (g.kind === "add") return sumOf(vals);
  if (g.kind === "replace") return vals.find((v) => Number.isFinite(v) && v > 0) ?? NaN;
  return groupFactorOf(g, vals);
}

/** The running total after one group: the one place a step is applied (the tree and the Biggest Gains what-if both call it). */
export function applyGroupStep(g: Pick<StatGroup, "kind" | "max1" | "below">, vals: readonly number[], total: number): number {
  const v = groupVal(g, vals);
  if (g.kind === "replace") return Number.isNaN(v) ? total : v;
  if (g.kind !== "add") return total * v;
  if (g.below === undefined) return total + v;
  return total < g.below ? Math.min(g.below, total + v) : total;
}

/** The value a zeroed (class-gated, say) source takes in a group of this kind. */
export const neutralValue = (kind: GroupKind): number => (kind === "mult" ? 1 : 0);

/** The shape note a group's node shows. */
export function groupNote(g: Pick<StatGroup, "kind" | "max1" | "below">): string {
  switch (g.kind) {
    case "add":
      return g.below === undefined ? "+ Σ" : `+ Σ (only below ${g.below}, capped at ${g.below})`;
    case "replace":
      return "replaces the total";
    case "pct":
      return "× (1 + Σ/100)";
    case "raw":
      return "× (1 + Σ)";
    case "min4":
      return "× (1 + min(4, Σ))";
    default:
      return g.max1 ? "× max(1, Π)" : "× Π";
  }
}
