// Biggest Gains — pure ranking core for the Drop Rate Tracker.
//
// Given the player's flat DR tree (`flattenTree` output) and a top-player
// reference (`topDrFlatForClass`), rank the *systems* — the direct children of
// the two pools `Drop Rate / Additive Pool` and `Drop Rate / Post-Processing` —
// by how much TOTAL Drop Rate the player would gain by closing the gap to the
// Observed Max on that system.
//
// Math (verified against the engine on the zArkhe anchor save):
//   Total DR = TotalSum × Post-Processing product
//   TotalSum  = 1 + AdditivePool_pp / 100   (+ a small luck term we ignore here)
//
//   Additive lever (system contributes `S` percentage points; raising it to
//   `S'` adds (S'−S)/100 to TotalSum):
//       DR_gain% = ((S' − S) / 100) / TotalSum × 100
//     → additive systems share one sensitivity, so they rank by raw pp gap.
//
//   Multiplier lever (factor `f`, raising yours→ref scales the whole total):
//       DR_gain% = (ref / yours − 1) × 100
//
// No engine re-run is required: everything comes from the existing flat tree +
// reference. The two pools' node paths are the slash-joined scheme produced by
// `nodePath`/`flattenTree`.

import type { FlatTree } from "./treeFlatten";

export const ADDITIVE_POOL_PATH = "Drop Rate / Additive Pool";
export const POST_PROCESSING_PATH = "Drop Rate / Post-Processing";

/** Gains below this percentage are "minor" and hidden behind a toggle.
 *  Tuned from the zArkhe anchor: ~30 additive systems sit in rounding noise. */
export const MINOR_GAIN_THRESHOLD_PCT = 0.05;

/** Systems excluded from the ranking by full path. These are not actionable
 *  upgrades: `🔹 Other` is a generic catch-all bucket (its reference came back
 *  as `1.00× → Infinity×`), and `🗺️ Arcane Map` is a situational AFK-map bonus
 *  that depends on the selected map, not something the player "levels up". */
export const DENYLIST_PATHS: ReadonlySet<string> = new Set<string>([
  `${POST_PROCESSING_PATH} / 🔹 Other`,
  `${POST_PROCESSING_PATH} / 🗺️ Arcane Map`,
]);

export type LeverType = "additive" | "multiplier";

export interface GainRow {
  /** Full flat-tree path of the system (its denylist key). */
  path: string;
  /** Leaf label of the system, e.g. `🖼️ Gallery`. */
  system: string;
  type: LeverType;
  /** Player's current contribution (pp for additive, factor for multiplier). */
  you: number;
  /** Observed-max reference contribution. */
  max: number;
  /** Total Drop Rate gained (%) if this system matched the reference. > 0. */
  drGainPct: number;
}

export interface BiggestGainsResult {
  /** Positive-gain levers, sorted by `drGainPct` descending. */
  rows: GainRow[];
  /** 1 + AdditivePool/100 — the additive sensitivity denominator. */
  totalSum: number;
  /** Levers with a finite, computable gain of any sign (post-denylist). Used to
   *  tell "you're at the ceiling" (>0 comparable, no rows) apart from "no
   *  comparable system" (0 comparable). */
  comparableSystems: number;
}

/** Direct children of `poolPath` across both flats (union), as full paths. */
function directChildPaths(
  yoursFlat: FlatTree,
  refFlat: Record<string, number>,
  poolPath: string
): string[] {
  const prefix = `${poolPath} / `;
  const seen = new Set<string>();
  for (const flat of [yoursFlat, refFlat]) {
    for (const p of Object.keys(flat)) {
      if (!p.startsWith(prefix)) continue;
      if (p.slice(prefix.length).includes(" / ")) continue; // direct child only
      seen.add(p);
    }
  }
  return [...seen];
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function computeBiggestGains(
  yoursFlat: FlatTree,
  refFlat: Record<string, number>
): BiggestGainsResult {
  const totalSum = 1 + (Number(yoursFlat[ADDITIVE_POOL_PATH]) || 0) / 100;

  const rows: GainRow[] = [];
  let comparableSystems = 0;

  const consider = (path: string, type: LeverType) => {
    if (DENYLIST_PATHS.has(path)) return;
    const max = refFlat[path];
    if (!isFiniteNumber(max)) return; // no comparable reference
    const you = Number(yoursFlat[path]) || 0;

    let drGainPct: number;
    if (type === "multiplier") {
      if (you === 0) return; // division by zero — non-finite ratio
      drGainPct = (max / you - 1) * 100;
    } else {
      drGainPct = ((max - you) / 100 / totalSum) * 100;
    }
    if (!Number.isFinite(drGainPct)) return; // safety net

    comparableSystems++;
    if (drGainPct > 0) {
      const system = path.slice(path.lastIndexOf(" / ") + 3);
      rows.push({ path, system, type, you, max, drGainPct });
    }
  };

  for (const p of directChildPaths(yoursFlat, refFlat, ADDITIVE_POOL_PATH)) {
    consider(p, "additive");
  }
  for (const p of directChildPaths(yoursFlat, refFlat, POST_PROCESSING_PATH)) {
    consider(p, "multiplier");
  }

  rows.sort((a, b) => b.drGainPct - a.drGainPct);
  return { rows, totalSum, comparableSystems };
}

/** Partition rows into major (≥ threshold) and minor (< threshold) gains. */
export function splitByThreshold(
  rows: GainRow[],
  threshold: number = MINOR_GAIN_THRESHOLD_PCT
): { major: GainRow[]; minor: GainRow[] } {
  const major: GainRow[] = [];
  const minor: GainRow[] = [];
  for (const r of rows) (r.drGainPct >= threshold ? major : minor).push(r);
  return { major, minor };
}
