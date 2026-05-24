// Math helpers and the 5 tome-points formulas. 1:1 port of v7.9 .gs.

import { TOME_BONUSES } from "./tasks";

// JSON value type used throughout the extractors. The IT raw save is a giant
// object where each field can be a number, string, array, or nested object;
// many fields arrive as JSON-encoded strings and get parsed by
// preparseLavaStrings before the extractors run.
export type Raw = unknown;
export type RawObj = Record<string, Raw>;

export function arrSum(a: Raw): number {
  if (!Array.isArray(a)) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Number(a[i]) || 0;
  return s;
}

export function arrMax(a: Raw): number {
  if (!Array.isArray(a) || a.length === 0) return 0;
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = Number(a[i]) || 0;
    if (v > m) m = v;
  }
  return m === -Infinity ? 0 : m;
}

// Lava's base-e log clamped at 1 (matches IT's lavaLog).
export function lavaLog(n: number): number {
  return Math.log(Math.max(n, 1)) / 2.30259;
}

// The 5 curve formulas from calcPointsPercent. x2 picks which one.
export function calcPointsPercent(
  b: readonly [number, number, number] | undefined,
  q: number
): number {
  if (!b) return 0;
  const x1 = b[0];
  const x2 = b[1];
  if (x2 === 0) {
    if (q < 0) return 0;
    return Math.pow((1.7 * q) / (q + x1), 0.7);
  } else if (x2 === 1) {
    return (2.4 * lavaLog(q)) / (2 * lavaLog(q) + x1);
  } else if (x2 === 2) {
    return Math.min(1, q / x1);
  } else if (x2 === 3) {
    if (q > 5 * x1) return 0;
    return Math.pow((1.2 * (6 * x1 - q)) / (7 * x1 - q), 5);
  } else if (x2 === 4) {
    const mv = Math.min(x1, q);
    return Math.pow((2 * mv) / (mv + x1), 0.7);
  }
  return 0;
}

// Wraps calcPointsPercent: returns ceil(pct * x3) clamped to >= 0.
// Returns null if quantity is null/undefined/NaN (means "no data").
export function calcTomePts(
  computeIdx: number,
  quantity: number | null | undefined
): number | null {
  const b = TOME_BONUSES[computeIdx];
  if (!b || quantity === null || quantity === undefined || Number.isNaN(quantity)) {
    return null;
  }
  const pct = calcPointsPercent(b, Number(quantity));
  if (!isFinite(pct) || pct < 0) return 0;
  return Math.ceil(pct * b[2]);
}

// Inverse of calcPointsPercent: given a target pct, return the minimum
// quantity needed to reach (or exceed) it. Returns null when the target is
// mathematically unreachable for that curve (asymptote, capped at 1, etc.)
// or when the resulting quantity would be negative / non-finite.
//
// Adapted from IT's getRequiredQuantitiesEfficient (parsers/world-4/tome.ts).
export function quantityForPct(
  b: readonly [number, number, number] | undefined,
  targetPct: number
): number | null {
  if (!b || !isFinite(targetPct) || targetPct <= 0) return 0;
  const x1 = b[0];
  const x2 = b[1];

  if (x2 === 0) {
    // pct = ((1.7q)/(q+x1))^0.7  →  base = pct^(1/0.7),  q = (base·x1)/(1.7-base)
    const base = Math.pow(targetPct, 1 / 0.7);
    if (1.7 - base <= 0) return null; // asymptote (max pct ≈ 1.7^0.7 ≈ 1.44)
    return (base * x1) / (1.7 - base);
  }

  if (x2 === 1) {
    // pct = (2.4·lavaLog(q))/(2·lavaLog(q)+x1)
    const denom = 2 * targetPct - 2.4;
    if (denom === 0) return null;
    const logQ = (-targetPct * x1) / denom;
    return Math.pow(10, logQ);
  }

  if (x2 === 2) {
    // pct = min(1, q/x1)  →  q = pct·x1, capped at 1
    if (targetPct > 1) return null;
    return targetPct * x1;
  }

  if (x2 === 3) {
    // pct = ((1.2·(6x1-q))/(7x1-q))^5 (inverted curve)
    const base = Math.pow(targetPct, 1 / 5);
    const denom = 1.2 - base;
    if (denom === 0) return null;
    const q = (1.2 * 6 * x1 - base * 7 * x1) / denom;
    if (q > 5 * x1 || q < 0) return null;
    return q;
  }

  if (x2 === 4) {
    // pct = ((2·min(x1,q))/(min(x1,q)+x1))^0.7
    if (targetPct >= 1) return x1;
    const base = Math.pow(targetPct, 1 / 0.7);
    const denom = 2 - base;
    if (denom === 0) return null;
    const q = (base * x1) / denom;
    if (q > x1) return null;
    return q;
  }

  return null;
}

// Convenience: given current pts, returns the minimum raw quantity that lands
// at `pts + N`. Returns null when unreachable (already capped, etc.).
export function quantityForPts(
  bonus: readonly [number, number, number] | undefined,
  targetPts: number
): number | null {
  if (!bonus || targetPts <= 0) return 0;
  const targetPct = targetPts / bonus[2];
  const q = quantityForPct(bonus, targetPct);
  if (q === null || !isFinite(q) || q < 0) return null;
  // calcTomePts uses Math.ceil(pct·x3), so the threshold for ceil(x) is the
  // smallest q where pct·x3 > (targetPts - 1). Round up to integer for display.
  return Math.ceil(q);
}

// Theoretical maximum pts for this curve, derived from the asymptote of
// each formula. Used by the Best Tome panel to show "max possible".
export function maxPtsForBonus(
  bonus: readonly [number, number, number] | undefined
): number {
  if (!bonus) return 0;
  const x2 = bonus[1];
  const x3 = bonus[2];
  // Curve asymptotes (from getMaxPointsForBonus in IT's tome.ts):
  //   x2=0 → 1.7^0.7 ≈ 1.4314 (asymptote of type-0 curve)
  //   x2=1 → 1.2 (log curve approaches 1.2)
  //   x2=2 → 1 (linear, capped at 1)
  //   x2=3 → ~1.1513 (peak of type-3 curve at q → 0)
  //   x2=4 → 1 (capped at 1)
  let maxPct: number;
  if (x2 === 0) maxPct = Math.pow(1.7, 0.7);
  else if (x2 === 1) maxPct = 1.2;
  else if (x2 === 2) maxPct = 1;
  else if (x2 === 3) maxPct = 1.1512569953;
  else if (x2 === 4) maxPct = 1;
  else maxPct = 0;
  return Math.ceil(maxPct * x3);
}

// Many fields in the Lava save come in as JSON-encoded strings (e.g.
// "[[1,2],[3,4]]"). Walk the object and JSON.parse any string whose first
// char is "[" or "{". Mutates the object in place AND returns it.
export function preparseLavaStrings(o: Raw): Raw {
  if (!o || typeof o !== "object") return o;
  const obj = o as RawObj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) {
      const c = v.charAt(0);
      if (c === "[" || c === "{") {
        try {
          obj[k] = JSON.parse(v);
        } catch {
          // leave the original string if it's not valid JSON
        }
      }
    }
  }
  return obj;
}
