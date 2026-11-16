import { formatGap } from "./format";
import type { MetaMetric, RankEntry } from "./types";

export type Climb =
  | { kind: "top" }
  | { kind: "tied-top"; ties: number }
  | { kind: "gap"; delta: number; pct: number; toRank: number }
  | { kind: "unknown" };

const pctOf = (delta: number, value: number) => Math.abs(delta) / Math.max(Math.abs(value), 1e-9);

export function climbOne(e: RankEntry, lowerIsBetter: boolean): Climb {
  if (e.r === 1) return e.t > 1 ? { kind: "tied-top", ties: e.t } : { kind: "top" };
  if (e.nr === undefined || e.nv === undefined) return { kind: "unknown" };
  const delta = lowerIsBetter ? e.v - e.nv : e.nv - e.v;
  return { kind: "gap", delta, pct: pctOf(delta, e.v), toRank: e.nr };
}

export function gapToCutoff(
  value: number,
  rank: number,
  cutoff: number | undefined,
  cutoffRank: 10 | 100,
  lowerIsBetter: boolean,
): { kind: "inside" } | { kind: "unknown" } | { kind: "gap"; delta: number; pct: number } {
  if (rank <= cutoffRank) return { kind: "inside" };
  if (cutoff === undefined) return { kind: "unknown" };
  const delta = lowerIsBetter ? value - cutoff : cutoff - value;
  return { kind: "gap", delta, pct: pctOf(delta, value) };
}

// A gap is printable only when positive (cutoffs come from yesterday's snapshot while rank/value are live),
// for seconds boards when the stored per-hour rate is positive (3600/0 = Infinity), and when its rendered
// magnitude has a non-zero digit (a "+0" or "+0.0000x" gap says nothing). `to` is the target's stored value.
export const printable = (delta: number, m: MetaMetric, e: RankEntry, to: number) =>
  delta > 0 && (m.notation !== "seconds" || e.v > 0) && /[1-9]/.test(formatGap(e.v, to, m.notation));
