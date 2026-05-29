// Shared post-merge reconciliation for the top-player "hypothetical max"
// collectors.
//
// The collectors take the best value PER PATH across players (granular
// merge). That maximizes every leaf, but an ACCOUNT-WIDE computed
// multiplier that is emitted under many owned items (e.g. the Gallery Bonus
// Multi, which sits under every owned nametag/trophy) can still read as
// DIFFERENT values across rows: each item path is "won" by whichever player
// happens to own that specific item, and those players have different
// account-wide multipliers. The quantity is logically singular, so it
// should read the same everywhere.
//
// reconcileSharedMultipliers() unifies every occurrence of a registered
// multiplier to ONE canonical subtree:
//   • each sub-node takes its GLOBAL max across all occurrences, and
//   • the multiplier node itself is RECOMPUTED from the global-max of its
//     direct children (the frankenstein max — best of each sub-source
//     combined — which is ≥ any single player's value).
// So the Gallery Bonus Multi becomes one consistent, maximal number wherever
// it appears, instead of inheriting a different player's value per item.
//
// NOTE: this only touches the multiplier's own subtree (at and below its
// node). A parent that consumes the multiplier as a factor (e.g. a nametag
// contribution = Tier × GBM × Base) stays at its own per-path max — those
// parents aren't recomputed here.

const SEP = " / ";

export type SharedMultiplier = {
  /** Exact node name to unify, e.g. "Gallery Bonus Multi". */
  name: string;
  /** Recompute the multiplier's value from its direct children's global-max
   *  values. Gallery/Hatrack-style "1 + Σ/100" multipliers pass
   *  `(c) => 1 + sum(c) / 100`; pure-product multipliers pass
   *  `(c) => c.reduce((a, b) => a * b, 1)`. */
  recompute: (directChildValues: number[]) => number;
};

/** Sum-style multiplier helper: `1 + Σ(children)/100` (the dominant Idleon
 *  bonus-multi shape). */
export const sumMulti = (c: number[]): number =>
  1 + c.reduce((a, b) => a + b, 0) / 100;

/**
 * Unify each registered account-wide multiplier across a flat path→value
 * map, in place. Returns the number of path values changed.
 */
export function reconcileSharedMultipliers(
  flat: Record<string, number>,
  multipliers: SharedMultiplier[]
): number {
  let changed = 0;
  for (const m of multipliers) {
    // canon[rel] = the global-max value seen for each subpath RELATIVE to
    // the multiplier node ("Gallery Bonus Multi", "Gallery Bonus Multi / X",
    // "Gallery Bonus Multi / X / Y", …). occ = every flat key that contains
    // the multiplier as a segment, paired with its relative subpath.
    const canon: Record<string, number> = {};
    const occ: { key: string; rel: string }[] = [];
    for (const key in flat) {
      const segs = key.split(SEP);
      const idx = segs.indexOf(m.name);
      if (idx < 0) continue;
      const rel = segs.slice(idx).join(SEP);
      occ.push({ key, rel });
      const v = flat[key];
      if (canon[rel] === undefined || v > canon[rel]) canon[rel] = v;
    }
    if (!occ.length) continue;
    // Direct children of the multiplier = rel of exactly two segments
    // ("<name> / <child>"). Recompute the multiplier from their global maxes.
    const directVals: number[] = [];
    for (const rel in canon) {
      if (rel.split(SEP).length === 2) directVals.push(canon[rel]);
    }
    canon[m.name] = m.recompute(directVals);
    // Stamp the canonical subtree onto every occurrence.
    for (const { key, rel } of occ) {
      const cv = canon[rel];
      if (cv !== undefined && flat[key] !== cv) {
        flat[key] = cv;
        changed++;
      }
    }
  }
  return changed;
}
