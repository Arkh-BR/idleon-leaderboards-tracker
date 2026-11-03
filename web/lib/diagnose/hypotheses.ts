// Which term explains the readings: for each candidate term, the factor every
// reading needs on it to match the game. A real missing factor needs the same
// value in every reading even when the soft caps and the term's share differ
// between them, so hypotheses rank by how much the factors disagree.

import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { elasticities, requiredFactor, totalWith, type TotalFromFlat } from "./sensitivity";

/** One reading as the model sees it: the site's flat tree and total, the game's
 *  number, and `tol`, how precisely the game's text pins that number (relative,
 *  one unit of its last digit; default 0 = exact). */
export type DiagReading = { flat: FlatTree; total: number; game: number; totalFromFlat: TotalFromFlat; tol?: number };

/** `factor`: the candidate — the geometric mean of what the differing readings
 *  need on the leaf. `factors[i]`: what reading i needs; for a reading that
 *  already matches, 1 when `factor` would move its total by more than its
 *  display shows (it pins the term), NaN when not (it doesn't constrain it).
 *  `spread`: max − min of ln factors, 0 when `factor` reproduces every reading
 *  within its display precision. */
export type Hypothesis = { path: string; factor: number; factors: number[]; spread: number };

export type PairHypothesis = { paths: [string, string]; factors: [number, number]; rms: number };

/** game / site, exactly 1 when they're equal (0 / 0 included). */
export const ratio = (game: number, site: number): number => (game === site ? 1 : game / site);

const matches = (r: DiagReading) => Math.abs(r.game - r.total) <= 1e-12 * Math.abs(r.total);
const tolOf = (r: DiagReading) => (r.tol ?? 0) + 1e-12; // + float dust
const NO_CHANGE = 1e-9; // |ln factor| below this is "nothing to explain"
const changes = (fs: number[]) => fs.some((f) => Math.abs(Math.log(f)) > NO_CHANGE);
const maxAbsLn = (fs: number[]) => Math.max(0, ...fs.filter(Number.isFinite).map((f) => Math.abs(Math.log(f))));
// Spreads/residuals inside 1e-9 tie, then the smallest correction wins; exact
// ties (two pure multipliers) keep the paths' order.
const bucket = (x: number) => Math.round(x * 1e9);

/** 1-parameter hypotheses (one leaf each), most consistent first. A path some
 *  differing reading can't reach is dropped; when site = game everywhere,
 *  nothing is ranked. */
export function rankHypotheses(readings: DiagReading[], paths: string[]): Hypothesis[] {
  if (readings.every(matches)) return [];
  const base = readings.map((r) => r.totalFromFlat(r.flat));
  // |ln(total / game)| with the factor applied, against what the reading's text can show.
  const off = (r: DiagReading, path: string, f: number, vs: number) =>
    Math.abs(Math.log(totalWith(r.flat, r.totalFromFlat, [[path, f]]) / vs));
  const out: Hypothesis[] = [];
  next: for (const path of paths) {
    const factors = readings.map(() => NaN);
    for (const [i, r] of readings.entries()) {
      if (matches(r)) continue;
      const f = requiredFactor(r.flat, r.totalFromFlat, path, r.game);
      if (f === null) continue next;
      factors[i] = f;
    }
    const factor = Math.exp(meanLn(factors));
    let fits = true;
    for (const [i, r] of readings.entries()) {
      // A NaN move (a zero total) can't be told apart either: free.
      if (matches(r)) factors[i] = off(r, path, factor, base[i]) > tolOf(r) ? ((fits = false), 1) : NaN;
      else if (!(off(r, path, factor, r.game) <= tolOf(r))) fits = false;
    }
    if (!changes(factors)) continue;
    const ln = factors.filter(Number.isFinite).map(Math.log);
    out.push({ path, factor, factors, spread: fits ? 0 : Math.max(...ln) - Math.min(...ln) });
  }
  return out.sort((a, b) => bucket(a.spread) - bucket(b.spread) || bucket(maxAbsLn(a.factors)) - bucket(maxAbsLn(b.factors)));
}

const meanLn = (fs: number[]) => {
  const ln = fs.filter(Number.isFinite).map(Math.log);
  return ln.reduce((a, b) => a + b, 0) / ln.length;
};

/** 2-parameter hypotheses (`--pairs`): for every pair of paths, the factors
 *  minimizing Σ ln(total / game)² over the readings, ranked by the rms of
 *  what's left beyond each reading's display precision. Least squares on the log ratios with the Jacobian frozen at
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
  // What's left beyond each reading's display precision.
  const left = e.map((x, k) => Math.max(0, Math.abs(x) - tolOf(rs[k])));
  const rms = Math.sqrt(left.reduce((s, x) => s + x * x, 0) / left.length);
  return Number.isFinite(rms) ? { factors: [Math.exp(xa), Math.exp(xb)] as [number, number], rms } : null;
}
