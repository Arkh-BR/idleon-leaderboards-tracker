// Which term explains the readings: for each candidate term, the factor every
// reading needs on it to match the game. A real missing factor needs the same
// value in every reading even when the soft caps and the term's share differ
// between them, so hypotheses rank by how much the factors disagree.

import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { elasticities, requiredFactor, totalWith, type TotalFromFlat } from "./sensitivity";

/** One reading as the model sees it: the site's flat tree and total, the game's number. */
export type DiagReading = { flat: FlatTree; total: number; game: number; totalFromFlat: TotalFromFlat };

/** `factors[i]`: what reading i needs on the leaf; NaN when reading i already
 *  matches and the leaf can't move its total (it doesn't constrain the term).
 *  `spread`: max − min of ln factor, the relative disagreement (0 = consistent). */
export type Hypothesis = { path: string; factors: number[]; spread: number };

export type PairHypothesis = { paths: [string, string]; factors: [number, number]; rms: number };

/** game / site, exactly 1 when they're equal (0 / 0 included). */
export const ratio = (game: number, site: number): number => (game === site ? 1 : game / site);

const matches = (r: DiagReading) => Math.abs(r.game - r.total) <= 1e-12 * Math.abs(r.total);
const NO_CHANGE = 1e-9; // |ln factor| below this is "nothing to explain"
const changes = (fs: number[]) => fs.some((f) => Math.abs(Math.log(f)) > NO_CHANGE);
const maxAbsLn = (fs: number[]) => Math.max(0, ...fs.filter(Number.isFinite).map((f) => Math.abs(Math.log(f))));
// Spreads/residuals inside 1e-9 tie, then the smallest correction wins; exact
// ties (two pure multipliers) keep the paths' order.
const bucket = (x: number) => Math.round(x * 1e9);

/** 1-parameter hypotheses (one leaf each), most consistent first. A path some
 *  mismatched reading can't reach is dropped, and so is a path that needs no
 *  change anywhere — when site = game everywhere, nothing is ranked. */
export function rankHypotheses(readings: DiagReading[], paths: string[]): Hypothesis[] {
  const out: Hypothesis[] = [];
  const base = readings.map((r) => (matches(r) ? r.totalFromFlat(r.flat) : NaN));
  next: for (const path of paths) {
    const factors: number[] = [];
    for (const [i, r] of readings.entries()) {
      let f: number | null;
      if (matches(r)) f = r.flat[path] && totalWith(r.flat, r.totalFromFlat, [[path, 2]]) !== base[i] ? 1 : NaN;
      else f = requiredFactor(r.flat, r.totalFromFlat, path, r.game);
      if (f === null) continue next;
      factors.push(f);
    }
    if (!changes(factors)) continue;
    const ln = factors.filter(Number.isFinite).map(Math.log);
    out.push({ path, factors, spread: Math.max(...ln) - Math.min(...ln) });
  }
  return out.sort((a, b) => bucket(a.spread) - bucket(b.spread) || bucket(maxAbsLn(a.factors)) - bucket(maxAbsLn(b.factors)));
}

/** 2-parameter hypotheses (`--pairs`): for every pair of paths, the factors
 *  minimizing Σ ln(total / game)² over the readings, ranked by the rms of
 *  what's left. Least squares on the log ratios with the Jacobian frozen at
 *  the site's tree (the elasticities, computed once per path), iterated
 *  through totalFromFlat so the soft caps still bend the fit. A pair the
 *  readings can't tell apart (collinear elasticities) is dropped. It takes
 *  ≥ 3 readings to rank pairs: 2 unknowns fit 2 readings exactly. */
export function rankPairs(readings: DiagReading[], paths: string[]): PairHypothesis[] {
  const rs = readings.filter((r) => r.game > 0 && Number.isFinite(r.game));
  if (rs.every(matches)) return [];
  const E = rs.map((r) => elasticities(r.flat, r.totalFromFlat, paths).map((x) => x.e));
  const out: PairHypothesis[] = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const fit = fitPair(rs, [paths[i], paths[j]], E.map((e) => e[i]), E.map((e) => e[j]));
      if (fit && changes(fit.factors)) out.push({ paths: [paths[i], paths[j]], ...fit });
    }
  }
  return out.sort((a, b) => bucket(a.rms) - bucket(b.rms) || bucket(maxAbsLn(a.factors)) - bucket(maxAbsLn(b.factors)));
}

const clamp = (x: number) => Math.min(Math.log(1e6), Math.max(Math.log(1e-3), x));

function fitPair(rs: DiagReading[], [a, b]: [string, string], ja: number[], jb: number[]) {
  let saa = 0, sab = 0, sbb = 0;
  rs.forEach((_, k) => ((saa += ja[k] * ja[k]), (sab += ja[k] * jb[k]), (sbb += jb[k] * jb[k])));
  const det = saa * sbb - sab * sab;
  if (!(det > 1e-9 * saa * sbb)) return null; // a zero column, collinear or NaN
  const res = (xa: number, xb: number) =>
    rs.map((r) => Math.log(totalWith(r.flat, r.totalFromFlat, [[a, Math.exp(xa)], [b, Math.exp(xb)]]) / r.game));
  let xa = 0;
  let xb = 0;
  let e = res(0, 0);
  for (let it = 0; it < 50; it++) {
    let ga = 0, gb = 0;
    rs.forEach((_, k) => ((ga += ja[k] * e[k]), (gb += jb[k] * e[k])));
    const da = -(sbb * ga - sab * gb) / det;
    const db = -(saa * gb - sab * ga) / det;
    xa = clamp(xa + da);
    xb = clamp(xb + db);
    e = res(xa, xb);
    if (Math.abs(da) + Math.abs(db) < 1e-12) break;
  }
  const rms = Math.sqrt(e.reduce((s, x) => s + x * x, 0) / e.length);
  return Number.isFinite(rms) ? { factors: [Math.exp(xa), Math.exp(xb)] as [number, number], rms } : null;
}
