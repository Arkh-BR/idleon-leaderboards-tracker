// Site-wide number format for the DR / Coin Multi tree and tables — one
// format so the same kind of value reads the same everywhere (tree rows,
// bucket rows, per-world rows, Biggest Gains, snapshot history). Always 3
// decimals; K/M/B/T/Q/QQ/QQQ, then E-notation past 1e24.
//
// Page TOTALS keep the game's own display (formatIdleon / formatCoinMulti in
// lib/format.ts and lib/coinMulti/format.ts) on purpose — this module is not
// used there.

export type NumParts = { sign: string; num: string; suffix: string };

const TIERS: { threshold: number; suffix: string }[] = [
  { threshold: 1e21, suffix: "QQQ" },
  { threshold: 1e18, suffix: "QQ" },
  { threshold: 1e15, suffix: "Q" },
  { threshold: 1e12, suffix: "T" },
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" },
  { threshold: 1e3, suffix: "K" },
];

function fixed3(n: number): string {
  return n.toFixed(3);
}

/** Mantissa + exponent for |v| >= 1e24, 3-decimal mantissa in [1, 10). */
function eNotationParts(abs: number): { num: string; suffix: string } {
  let exp = Math.floor(Math.log10(abs));
  let mantissa = abs / 10 ** exp;
  // Math.log10 can be one exponent off for huge values due to float error —
  // self-correct from the mantissa rather than trusting log10 blindly.
  if (mantissa >= 10) {
    mantissa /= 10;
    exp += 1;
  } else if (mantissa < 1) {
    mantissa *= 10;
    exp -= 1;
  }
  // Rounding the mantissa itself can spill to 10.000 (e.g. 9.9996 → bump).
  if (Number(fixed3(mantissa)) >= 10) {
    mantissa /= 10;
    exp += 1;
  }
  return { num: fixed3(mantissa), suffix: `E${exp}` };
}

/** Split a finite number into sign / 3-decimal digits / suffix. Rounding
 *  promotes: a value that would display as "1000.000" at one step renders as
 *  "1.000" of the next step up instead (999.9996 → 1.000K, and the same at
 *  the top of QQQ → E, or a mantissa that rounds to 10.000 → bump the
 *  exponent). Returns null for non-finite input. */
export function numParts(v: number): NumParts | null {
  if (!Number.isFinite(v)) return null;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);

  if (abs >= 1e24) return { sign, ...eNotationParts(abs) };

  for (let i = 0; i < TIERS.length; i++) {
    const { threshold, suffix } = TIERS[i];
    if (abs < threshold) continue;
    const scaled = abs / threshold;
    if (Number(fixed3(scaled)) < 1000) return { sign, num: fixed3(scaled), suffix };
    // Rounds up to the next tier (or into E-notation past QQQ).
    const next = TIERS[i - 1];
    if (next) return { sign, num: fixed3(abs / next.threshold), suffix: next.suffix };
    return { sign, ...eNotationParts(abs) };
  }

  // Plain range (< 1e3), with the same promotion guard.
  if (Number(fixed3(abs)) >= 1000) return { sign, num: fixed3(abs / 1e3), suffix: "K" };
  return { sign, num: fixed3(abs), suffix: "" };
}

/** Plain-string rendering of numParts — for `title` attributes and
 *  text-only spots that can't host the highlighted-suffix `<Num>` span. */
export function formatNum(
  v: number,
  opts: { plus?: boolean; unit?: string } = {}
): string {
  const p = numParts(v);
  if (!p) return "—";
  const sign = p.sign || (opts.plus ? "+" : "");
  return `${sign}${p.num}${p.suffix}${opts.unit ?? ""}`;
}
