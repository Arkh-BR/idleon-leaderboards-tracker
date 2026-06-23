// Pure comparison logic for the golden harness. No I/O — fed summaries and
// truth/baseline objects, returns structured mismatches.

export type EngineSummary = {
  /** Tome points per task (compute-index order), for per-task ground-truth. */
  tomeByTask: number[];
  /** Sum of tomeByTask, for regression. */
  tomeTotal: number;
  /** Arkh DR multiplier for the reference char. */
  drTotal: number;
  /** Cooking Mastery exp-rate (expRateTree.val). */
  cookingExp: number;
  /** Sum of effective levels over a fixed talent probe set. */
  talentsTotal: number;
};

export type GroundTruth = { tomePoints?: number[]; dropRate?: number };
export type Mismatch = { kind: "tome" | "dr" | "regression"; key: string; expected: number; actual: number };

const pctDiff = (a: number, b: number): number =>
  b === 0 ? (a === 0 ? 0 : Infinity) : (Math.abs(a - b) / Math.abs(b)) * 100;

/** Ground-truth: per-task Tome vs extraData.tomePoints (exact within tomeTol),
 *  DR vs extraData.dropRate (within drTolPct percent — looser, save↔read desync). */
export function compareGroundTruth(
  save: string,
  got: EngineSummary,
  truth: GroundTruth,
  opts: { tomeTol: number; drTolPct: number },
): Mismatch[] {
  const out: Mismatch[] = [];
  if (Array.isArray(truth.tomePoints)) {
    const n = Math.min(got.tomeByTask.length, truth.tomePoints.length);
    for (let i = 0; i < n; i++) {
      if (Math.abs((got.tomeByTask[i] ?? 0) - truth.tomePoints[i]) > opts.tomeTol) {
        out.push({ kind: "tome", key: `task#${i}`, expected: truth.tomePoints[i], actual: got.tomeByTask[i] ?? 0 });
      }
    }
  }
  if (typeof truth.dropRate === "number" && pctDiff(got.drTotal, truth.dropRate) > opts.drTolPct) {
    out.push({ kind: "dr", key: save, expected: truth.dropRate, actual: got.drTotal });
  }
  return out;
}

export type Baseline = Record<string, { tomeTotal: number; drTotal: number; cookingExp: number; talentsTotal: number }>;

/**
 * Regression: summary values vs a versioned baseline (within tolPct percent).
 *
 * Intentionally NOT wired into run.ts: the orchestrator's reference saves are
 * fetched from the IT profiles API and drift as players play, so a committed
 * baseline of their totals would be perpetual noise. Retained (and unit-tested)
 * as library API for a future regression mode over LOCAL, non-drifting saves.
 */
export function compareRegression(save: string, got: EngineSummary, baseline: Baseline, tolPct: number): Mismatch[] {
  const base = baseline[save];
  if (!base) return [];
  const out: Mismatch[] = [];
  const keys: (keyof typeof base)[] = ["tomeTotal", "drTotal", "cookingExp", "talentsTotal"];
  for (const k of keys) {
    if (pctDiff(got[k], base[k]) > tolPct) {
      out.push({ kind: "regression", key: k, expected: base[k], actual: got[k] });
    }
  }
  return out;
}
