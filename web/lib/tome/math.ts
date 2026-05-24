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
