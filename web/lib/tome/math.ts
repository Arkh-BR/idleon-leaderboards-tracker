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

// The game's getLOG: log10 of n clamped at 1 (Lava divides by 2.30259).
// @njs _customBlock_getLOG
export function lavaLog(n: number): number {
  return Math.log(Math.max(n, 1)) / 2.30259;
}

// The 5 curve formulas from calcPointsPercent. x2 picks which one.
// @njs TomePCT
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

// Points a task shows at quantity q: N.js TomePTS = ceil(TomePCT · Tome[3]),
// floored at 0 for a curve that went negative or non-finite.
// @njs TomePTS
function ptsAt(b: readonly [number, number, number], q: number): number {
  const pct = calcPointsPercent(b, q);
  return isFinite(pct) && pct > 0 ? Math.ceil(pct * b[2]) : 0;
}

// Returns null if quantity is null/undefined/NaN (means "no data").
export function calcTomePts(
  computeIdx: number,
  quantity: number | null | undefined
): number | null {
  const b = TOME_BONUSES[computeIdx];
  if (!b || quantity === null || quantity === undefined || Number.isNaN(quantity)) {
    return null;
  }
  return ptsAt(b, Number(quantity));
}

// The whole quantity at which a task first shows `targetPts`, searched on the
// game's own curve (ptsAt) rather than solved for: the smallest one on the
// rising curves, the largest one on the "fewer is better" curve (x2 = 3,
// which pays nothing past 5·x1). null when no finite quantity gets there.
export function quantityForPts(
  bonus: readonly [number, number, number] | undefined,
  targetPts: number
): number | null {
  if (!bonus || targetPts <= 0) return 0;
  const ok = (q: number) => ptsAt(bonus, q) >= targetPts;
  if (bonus[1] === 3) {
    let lo = 0; // ok(lo) holds throughout
    let hi = Math.floor(5 * bonus[0]);
    if (!ok(lo)) return null;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ok(mid)) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  let lo = 0; // !ok(lo) and ok(hi) hold throughout
  let hi = 1;
  while (!ok(hi)) {
    lo = hi;
    hi *= 2;
    if (!isFinite(hi)) return null;
  }
  for (;;) {
    const mid = Math.floor((lo + hi) / 2);
    if (mid <= lo || mid >= hi) return hi;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
}

// True for the inverted "fewer is better" curve (x2 = 3). Used by the UI to
// flip the +1-pt direction (need raw to DROP, not increase).
export function isInvertedCurve(
  bonus: readonly [number, number, number] | undefined
): boolean {
  return bonus?.[1] === 3;
}

// Most points a task can show: TomePTS at the top of its TomePCT curve. Curves
// 0 and 1 only approach their limits (1.7^0.7 and 2.4/2 as q grows); 2 and 4
// cap at q = x1; the fewer-is-better 3 peaks at q = 0.
export function maxPtsForBonus(
  bonus: readonly [number, number, number] | undefined
): number {
  if (!bonus) return 0;
  const [x1, x2, x3] = bonus;
  const top =
    x2 === 0 ? Math.pow(1.7, 0.7) : x2 === 1 ? 1.2 : calcPointsPercent(bonus, x2 === 3 ? 0 : x1);
  return Math.ceil(top * x3);
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
