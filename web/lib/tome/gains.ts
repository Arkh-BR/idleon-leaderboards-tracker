// Pure tome-score enrichment + "Biggest Gains" ranking.
//
// This module owns the per-task enrichment math that used to live inline in
// the BestTomePanel `useMemo` (gap-to-top, effective classification,
// auto-Capped, +1-pt cost) plus the actionable ranking the Biggest Gains tab
// adds on top. Both the Best Tome panel and the Biggest Gains panel consume
// it, so the numbers stay identical and the math lives in exactly one place.
//
// Everything here is pure (no React, no localStorage) so it is trivially
// unit-testable on real saves. The top-player snapshot and the per-task
// default classifications are injectable for tests, defaulting to the bundled
// data the app ships.

import type { TomeRow } from "./compute";
import {
  calcPointsPercent,
  isInvertedCurve,
  maxPtsForBonus,
  quantityForPts,
} from "./math";
import { tierForPct, type TomeTier } from "./tier";
import { TOP_PLAYERS, type TopPlayerEntry } from "./topPlayers";
import { DEFAULT_CLASSIFICATIONS } from "./defaultClassifications";

// Classification ID auto-assigned when the task is fully maxed. The user can
// never pick it; it is reserved for the auto-rule below.
export const CAPPED_ID = 12;

// Classifications hidden by the "actionable" filter — you cannot push these
// right now (Time / Lucky / Update gated).
export const GATED_IDS: readonly number[] = [4, 5, 9];

// Baseline pts snapshot (taskName → pts captured at savedAt). Drives the Δ
// column in the Best Tome panel.
export type PtsSnapshot = {
  savedAt: string; // ISO timestamp
  pts: Record<string, number>;
};

export type EnrichedRow = TomeRow & {
  pct: number | null;
  tier: TomeTier;
  maxPts: number; // theoretical curve ceiling
  rawForNextPt: number | null; // raw value needed to reach pts+1
  rawForMaxPts: number | null; // raw value needed to reach maxPts
  ptsGapToMax: number; // gap to theoretical max
  top: TopPlayerEntry | null; // best observed player snapshot
  ptsGapToTop: number; // gap to top player's pts (>=0)
  classification: number | null; // effective classification (user choice OR auto-Capped)
  userClassification: number | null; // raw user pick (no auto-override)
  cappedByMax: boolean; // true when forced to Capped by pts >= maxPts
  snapshotPts: number | null; // saved baseline pts for this task (null if no snapshot)
  ptsDelta: number | null; // current pts - snapshot pts (null if no baseline)
};

export type EnrichOpts = {
  /** Top-player snapshot map. Defaults to the bundled TOP_PLAYERS. */
  topPlayers?: Readonly<Record<string, TopPlayerEntry>>;
  /** Per-task default classifications. Defaults to DEFAULT_CLASSIFICATIONS. */
  defaultClassifications?: Readonly<Record<string, number | null>>;
};

// Enrich one computed tome row with derived fields. 1:1 port of the
// BestTomePanel useMemo body — keep them identical.
export function enrichRow(
  r: TomeRow,
  userClass: Record<string, number>,
  snapshot: PtsSnapshot | null,
  opts: EnrichOpts = {}
): EnrichedRow {
  const topPlayers = opts.topPlayers ?? TOP_PLAYERS;
  const defaults = opts.defaultClassifications ?? DEFAULT_CLASSIFICATIONS;

  const maxPts = maxPtsForBonus(r.bonus);
  const pct =
    r.bonus && r.rawValue !== null
      ? calcPointsPercent(r.bonus, Number(r.rawValue))
      : null;
  const tier = tierForPct(pct);
  const currentPts = r.pts ?? 0;
  const rawForNextPt = quantityForPts(r.bonus, currentPts + 1);
  const rawForMaxPts = quantityForPts(r.bonus, maxPts);
  const ptsGapToMax = Math.max(0, maxPts - currentPts);
  const top = topPlayers[r.task] ?? null;
  const ptsGapToTop =
    top && top.pts !== null ? Math.max(0, top.pts - currentPts) : 0;
  // Auto-Capped ONLY when the user is at (or above) the theoretical maximum
  // points for the task's curve — the blue tier (99.9%) is NOT enough.
  const cappedByMax = currentPts > 0 && maxPts > 0 && currentPts >= maxPts;

  // Default classification: prefer the hand-curated DEFAULT_CLASSIFICATIONS
  // override when present, fall back to the snapshot value from the sheet. We
  // never use 12 (Capped) as a default — Capped is reserved for the auto-rule.
  const overridePick = defaults[r.task];
  const snapshotDefault =
    overridePick !== undefined
      ? overridePick === CAPPED_ID
        ? null
        : overridePick
      : top && top.classification !== null && top.classification !== CAPPED_ID
        ? top.classification
        : null;

  const rawUserPick = userClass[r.task]; // undefined | 0 | 1/3/4/5/9
  // userPick semantics:
  //   undefined → user never touched → use snapshot default
  //   0         → user explicitly cleared → no chip
  //   1/3/4/5/9 → user's pick
  const effectiveUserPick =
    rawUserPick === undefined
      ? snapshotDefault
      : rawUserPick === 0
        ? null
        : rawUserPick;

  const classification = cappedByMax ? CAPPED_ID : effectiveUserPick;
  const snapshotPts =
    snapshot && r.task in snapshot.pts ? snapshot.pts[r.task] : null;
  const ptsDelta =
    snapshotPts !== null && r.pts !== null ? r.pts - snapshotPts : null;

  return {
    ...r,
    pct,
    tier,
    maxPts,
    rawForNextPt,
    rawForMaxPts,
    ptsGapToMax,
    top,
    ptsGapToTop,
    classification,
    userClassification: effectiveUserPick,
    cappedByMax,
    snapshotPts,
    ptsDelta,
  };
}

export function enrichRows(
  rows: TomeRow[],
  userClass: Record<string, number>,
  snapshot: PtsSnapshot | null,
  opts: EnrichOpts = {}
): EnrichedRow[] {
  return rows.map((r) => enrichRow(r, userClass, snapshot, opts));
}

// Absolute raw delta to gain +1 pt. For inverted "Fastest Time" curves the
// player needs to DROP raw (improve time); for everything else they need to
// INCREASE raw. Sign is always positive — the caller decides how to label it.
export function nextPtCost(r: EnrichedRow): number | null {
  if (r.rawValue === null || r.rawForNextPt === null) return null;
  return isInvertedCurve(r.bonus)
    ? Number(r.rawValue) - r.rawForNextPt
    : r.rawForNextPt - Number(r.rawValue);
}

// Strips the trailing "(in Seconds)" annotation the IT data carries on
// fastest-time tasks. Redundant in the UI (the inverted hint explains the
// direction).
export function displayTaskName(name: string): string {
  return name.replace(/\s*\(in Seconds\)$/i, "");
}

// The realistic gain still on the table for this task: gap to the top observed
// player when we have a snapshot, otherwise the gap to the theoretical max
// (defensive fallback — the bundled snapshot covers all 118 tasks today).
export function gainPts(r: EnrichedRow): number {
  return r.top && r.top.pts !== null ? r.ptsGapToTop : r.ptsGapToMax;
}

// Time / Lucky / Update gated — you cannot push these right now.
export function isGated(r: EnrichedRow): boolean {
  return r.classification !== null && GATED_IDS.includes(r.classification);
}

// A task the player can push right now: has a gain, is not gated, is not
// capped/maxed. Unclassified tasks count as actionable (inclusive filter).
export function isActionable(r: EnrichedRow): boolean {
  return gainPts(r) > 0 && !r.cappedByMax && !isGated(r);
}

// Rank tasks by gain desc. With includeGated off, only actionable tasks are
// returned (the default Biggest Gains view); with it on, gated tasks join the
// ranking too (capped/zero-gain stay out — they have nothing to gain).
export function rankGains(
  enriched: EnrichedRow[],
  opts: { includeGated: boolean }
): EnrichedRow[] {
  const visible = enriched.filter((r) => {
    if (gainPts(r) <= 0 || r.cappedByMax) return false;
    if (!opts.includeGated && isGated(r)) return false;
    return true;
  });
  // Sort by gain desc; idx asc tiebreak keeps the order deterministic.
  return visible.sort((a, b) => {
    const d = gainPts(b) - gainPts(a);
    return d !== 0 ? d : a.idx - b.idx;
  });
}

// The single biggest ACTIONABLE lever — the hero recommendation. Independent
// of the gated toggle, so peeking at gated tasks never changes the advice.
export function heroGain(enriched: EnrichedRow[]): EnrichedRow | null {
  return rankGains(enriched, { includeGated: false })[0] ?? null;
}

// Immediate next-point move for the "Next point" column. "maxed" when there is
// no reachable next point (capped, or the curve asymptote is already hit).
export type NextPoint =
  | { kind: "maxed" }
  | { kind: "step"; drop: boolean; cost: number; target: number };

export function describeNextPoint(r: EnrichedRow): NextPoint {
  const cost = nextPtCost(r);
  if (r.cappedByMax || r.rawForNextPt === null || cost === null) {
    return { kind: "maxed" };
  }
  return {
    kind: "step",
    drop: isInvertedCurve(r.bonus),
    cost,
    target: r.rawForNextPt,
  };
}
