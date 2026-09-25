// Biggest Gains for any stat page, by what-if: swap one source for the
// Observed Max in the flat tree, ask the stat's GainsModel for the new total,
// gain = new / current − 1. Exact for every formula shape (products,
// max(1, ·), pow, caps, floors) as long as totalFromFlat mirrors the combine.

import { groupFactorOf, type StatGroup } from "@/lib/arkh/stats/defs/grouped";
import type { GainDisplay, GainSource, GainsModel } from "./config";

export const MINOR_GAIN_THRESHOLD_PCT = 0.05;

export type GainRow = GainSource & {
  you: number;
  max: number;
  /** % the stat's total rises if this source matched the Observed Max. */
  gainPct: number;
  /** A row the model computes itself (GainsModel.levers): no Observed Max. */
  lever?: true;
};

/** Paths exactly one segment below `parent`, across the given flat maps. */
export function directChildren(parent: string, ...flats: Record<string, number>[]): string[] {
  const prefix = `${parent} / `;
  const out = new Set<string>();
  for (const flat of flats) {
    for (const p of Object.keys(flat)) {
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes(" / ")) out.add(p);
    }
  }
  return [...out];
}

export function computeGains(
  model: GainsModel,
  yoursFlat: Record<string, number>,
  refFlat: Record<string, number>
): { rows: GainRow[]; comparableSources: number } {
  const base = model.totalFromFlat(yoursFlat);
  const work: Record<string, number> = { ...yoursFlat };
  const rows: GainRow[] = [];
  let comparableSources = 0;
  for (const s of model.sources(yoursFlat, refFlat)) {
    const max = refFlat[s.path];
    if (typeof max !== "number" || !Number.isFinite(max)) continue;
    const had = Object.prototype.hasOwnProperty.call(work, s.path);
    const you = Number(work[s.path]) || 0;
    work[s.path] = max;
    const gainPct = (model.totalFromFlat(work) / base - 1) * 100;
    if (had) work[s.path] = yoursFlat[s.path];
    else delete work[s.path];
    if (!Number.isFinite(gainPct)) continue;
    comparableSources++;
    if (gainPct > 0) rows.push({ ...s, you, max, gainPct });
  }
  // Model-computed steps (Multikill's "+1 damage tier"): ranked with the rows,
  // never comparable sources — they have no Observed Max.
  for (const lever of model.levers?.(yoursFlat) ?? []) {
    if (Number.isFinite(lever.gainPct) && lever.gainPct > 0) rows.push({ ...lever, lever: true });
  }
  rows.sort((a, b) => b.gainPct - a.gainPct);
  return { rows, comparableSources };
}

export function splitGains(
  rows: GainRow[],
  threshold: number = MINOR_GAIN_THRESHOLD_PCT
): { major: GainRow[]; minor: GainRow[] } {
  const major: GainRow[] = [];
  const minor: GainRow[] = [];
  for (const r of rows) (r.gainPct >= threshold ? major : minor).push(r);
  return { major, minor };
}

const DISPLAY: Record<StatGroup["kind"], GainDisplay> = { pct: "pct", raw: "raw", min4: "raw", mult: "x" };

/** GainsModel for a groupedDescriptor stat (Coin Multi, EXP Multi).
 *  `skip` names sources (by their node name, the path's last segment) that
 *  `sources()` must not rank — e.g. circumstantial sources a character can
 *  never get (lowest-level-only, level-capped). They still count in
 *  `totalFromFlat`, which sums every direct child regardless of skip. */
export function groupedGainsModel(
  root: string,
  groups: readonly StatGroup[],
  opts?: { skip?: readonly string[] }
): GainsModel {
  const groupPath = (g: StatGroup) => `${root} / ${g.name}`;
  const skip = new Set(opts?.skip ?? []);
  return {
    sources(yoursFlat, refFlat) {
      const out: GainSource[] = [];
      for (const g of groups) {
        const gp = groupPath(g);
        for (const path of directChildren(gp, yoursFlat, refFlat)) {
          const source = path.slice(gp.length + 3);
          if (skip.has(source)) continue;
          out.push({ path, group: g.name, source, display: DISPLAY[g.kind] });
        }
      }
      return out;
    },
    totalFromFlat(flat) {
      let total = 1;
      for (const g of groups) total *= groupFactorOf(g, directChildren(groupPath(g), flat).map((p) => Number(flat[p])));
      return total;
    },
  };
}
