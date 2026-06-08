// ===== Cooking Mastery — Purple PTS optimizer =====
// Maximises instantaneous Exp/h by allocating Purple PTS across the unlocked
// mastery upgrades. Exp/h is a product of (1 + base_b·coef_b·P_b/100) factors,
// so the marginal gain per point is strictly decreasing ⇒ greedy water-filling
// is optimal. External multipliers are Purple-independent, so they scale both
// current and optimal Exp/h equally and never change the ranking.

import {
  EXP_UPGRADE_IDS,
  MASTERY_COEF,
  MASTERY_RANK_REQ,
  UPGRADE_NAMES,
  expRateCore,
  purpleTotal,
  sourceBase,
  type MasteryInputs,
} from "../arkh/stats/systems/common/cookingMastery";

export type RoiRow = {
  id: number;
  name: string;
  unlocked: boolean;
  rankReq: number;
  base: number; // base_b (player-state quantity)
  coef: number; // RandoListo2[8][b]
  valuePerPt: number; // base·coef — pp added to factor b per point
  currentPts: number; // Purple PTS currently in this upgrade
  optimalPts: number; // Purple PTS in the optimal full-realloc
  marginalGain: number; // ΔExp/h of the next point at the CURRENT allocation
  marginalGainPct: number; // same, as % of current Exp/h
};

export type OptimizeResult = {
  pools: {
    purpleTotal: number;
    purpleSpent: number;
    purpleAvailable: number;
    yellowTotal: number;
  };
  current: { purple: number[]; expRate: number; expRateCore: number };
  optimal: { purple: number[]; expRate: number; expRateCore: number };
  gainPct: number; // optimal vs current (full realloc), %
  externalMulti: number; // Purple-independent multiplier used for absolute Exp/h
  calibrated: boolean; // true when externalMulti was backed out from an in-game Exp/h
  roi: RoiRow[]; // one row per upgrade, sorted by current marginal ROI desc
};

const num = (v: unknown): number => Number(v) || 0;

/** Upgrades that can take Purple PTS for Exp/h: unlocked by rank AND base > 0. */
export function activeUpgrades(inp: MasteryInputs): number[] {
  return EXP_UPGRADE_IDS.filter(
    (b) => inp.rank >= MASTERY_RANK_REQ[b] && sourceBase(b, inp) > 0,
  );
}

/**
 * Greedy marginal-gain allocation of `totalPts` from a zero baseline.
 * Each step puts one point in the upgrade with the largest ΔExp/h. Because
 * factor b is linear in P_b, the marginal gain ΔExpRate(b) = rate·(a_b/100)/(1+a_b·P_b/100)
 * decreases as P_b grows, so this greedy reaches the global optimum.
 */
export function optimalAllocation(inp: MasteryInputs, totalPts: number): number[] {
  const purple = new Array(6).fill(0);
  const active = activeUpgrades(inp);
  if (active.length === 0) return purple;
  const valuePerPt = active.map((b) => sourceBase(b, inp) * MASTERY_COEF[b]);
  for (let i = 0; i < totalPts; i++) {
    const rate = expRateCore(inp, purple);
    let bestB = -1;
    let bestGain = 0;
    for (let j = 0; j < active.length; j++) {
      const b = active[j];
      const a = valuePerPt[j];
      const gain = (rate * (a / 100)) / (1 + (a * purple[b]) / 100);
      if (gain > bestGain) {
        bestGain = gain;
        bestB = b;
      }
    }
    if (bestB < 0) break;
    purple[bestB]++;
  }
  return purple;
}

/**
 * Builds the full optimization result for the given mastery inputs.
 *
 * `opts.calibrateExpRate` — the Exp/h the game currently shows. Because every
 * external factor is Purple-independent, dividing it by the (faithful) current
 * core yields the exact multiplier, making every projected Exp/h exact without
 * porting the external subsystems. Falls back to the engine estimate otherwise.
 */
export function optimize(
  inp: MasteryInputs,
  opts: { calibrateExpRate?: number } = {},
): OptimizeResult {
  const total = purpleTotal(inp);
  const spent = inp.purple.reduce((s, p) => s + num(p), 0);
  const optimalPurple = optimalAllocation(inp, total);

  const currentCore = expRateCore(inp, inp.purple);
  const optimalCore = expRateCore(inp, optimalPurple);
  const calibrated = !!(opts.calibrateExpRate && opts.calibrateExpRate > 0 && currentCore > 0);
  const ext = calibrated ? (opts.calibrateExpRate as number) / currentCore : inp.externalMulti;

  const roi: RoiRow[] = [0, 1, 2, 3, 4, 5].map((b) => {
    const isExpSource = (EXP_UPGRADE_IDS as readonly number[]).includes(b);
    const base = sourceBase(b, inp);
    const coef = MASTERY_COEF[b];
    const a = base * coef;
    const unlocked = inp.rank >= MASTERY_RANK_REQ[b];
    const marginalCore =
      isExpSource && unlocked && a > 0
        ? (currentCore * (a / 100)) / (1 + (a * num(inp.purple[b])) / 100)
        : 0;
    return {
      id: b,
      name: UPGRADE_NAMES[b],
      unlocked,
      rankReq: MASTERY_RANK_REQ[b],
      base,
      coef,
      valuePerPt: a,
      currentPts: num(inp.purple[b]),
      optimalPts: optimalPurple[b],
      marginalGain: marginalCore * ext,
      marginalGainPct: currentCore > 0 ? (marginalCore / currentCore) * 100 : 0,
    };
  });
  roi.sort((x, y) => y.marginalGain - x.marginalGain);

  return {
    pools: {
      purpleTotal: total,
      purpleSpent: spent,
      purpleAvailable: Math.max(0, total - spent),
      yellowTotal: total + inp.researchGridYellow,
    },
    current: {
      purple: inp.purple.slice(),
      expRate: currentCore * ext,
      expRateCore: currentCore,
    },
    optimal: {
      purple: optimalPurple,
      expRate: optimalCore * ext,
      expRateCore: optimalCore,
    },
    gainPct: currentCore > 0 ? (optimalCore / currentCore - 1) * 100 : 0,
    externalMulti: ext,
    calibrated,
    roi,
  };
}
