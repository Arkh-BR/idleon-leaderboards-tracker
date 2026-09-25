// Biggest Gains for the Multikill page (spec M3, EXP D10): a what-if over the
// flat tree through the same mkTotal the tree uses (M14). The sources are the
// 27 of the character's own save (the Death Note row carries its world, so it
// only meets a same-world reference — M11); the damage tier ranks against the
// reference only on the ×2 ladder (a W7 tier is named apart — M12); "+1 damage
// tier" is a lever the model computes itself (M13).

import { directChildren, type GainRow } from "@/lib/statTracker/biggestGains";
import type { GainSource, GainsModel } from "@/lib/statTracker/config";
import { MK_NODES, MK_ROOT, MK_RULES, mkTotal, type MkParts } from "@/lib/arkh/stats/defs/multikill";
import { formatNum } from "@/lib/numberFormat";

const pathOf = (name: string) => `${MK_ROOT} / ${name}`;
const HALVES = [MK_NODES.base, MK_NODES.perTier] as const;

/** A half's sources and rule rows, read back from the flat tree. */
function half(flat: Record<string, number>, name: string) {
  const parent = pathOf(name);
  const out = { sum: 0, soft: false, cove: null as number | null, sources: [] as string[] };
  for (const p of directChildren(parent, flat)) {
    const leaf = p.slice(parent.length + 3);
    if (leaf === MK_RULES.softCap) out.soft = true;
    else if (leaf === MK_RULES.cove) out.cove = Number(flat[p]) || 0;
    else {
      out.sum += Number(flat[p]) || 0;
      out.sources.push(p);
    }
  }
  return out;
}

/** The damage tier's path: ×2 ladder below map 300, ×5 in W7. */
function tierPath(flat: Record<string, number>): string | null {
  for (const name of [MK_NODES.tier, MK_NODES.tierW7]) if (typeof flat[pathOf(name)] === "number") return pathOf(name);
  return null;
}

/** A target without HP (a map whose AFK target isn't a monster) pins the tier
 *  at 1: its next threshold reads 0 and no damage moves it. */
const tierCanMove = (flat: Record<string, number>, tp: string) => Number(flat[`${tp} / Next tier at`]) > 0;

/** mkTotal's inputs from a flat tree: B and P are the direct children minus
 *  the rule rows; the soft cap applies when its row exists; the Cove row's
 *  value replaces its half. */
function partsFromFlat(flat: Record<string, number>): MkParts {
  const b = half(flat, MK_NODES.base);
  const p = half(flat, MK_NODES.perTier);
  const tp = tierPath(flat);
  return {
    base: b.sum,
    perTier: p.sum,
    tier: tp ? Number(flat[tp]) || 1 : 1,
    softCap: b.soft,
    cove: b.cove !== null ? { base: b.cove, perTier: p.cove ?? 0 } : null,
  };
}

export const multikillGainsModel: GainsModel = {
  sources(yoursFlat) {
    const out: GainSource[] = [];
    // In the Crystal Glunko Cove the cavern replaces both sums (M19): none of
    // their sources moves the total there, so none is offered.
    if (half(yoursFlat, MK_NODES.base).cove === null)
      for (const g of HALVES) {
        const gp = pathOf(g);
        for (const p of half(yoursFlat, g).sources) out.push({ path: p, group: g, source: p.slice(gp.length + 3), display: "pct" });
      }
    const tp = tierPath(yoursFlat);
    // Only reachable below tier 51 (computeGains drops a gainPct <= 0 row, and
    // the reference tier is always 51) — same estimate caveat as the tree node
    // (spec M17): arkh's max damage isn't reconciled with the game yet.
    if (tp === pathOf(MK_NODES.tier) && tierCanMove(yoursFlat, tp))
      out.push({ path: tp, group: `${MK_NODES.tier} · estimate`, source: MK_NODES.tier, display: "raw" });
    return out;
  },
  totalFromFlat: (flat) => mkTotal(partsFromFlat(flat)),
  levers(yoursFlat): GainRow[] {
    const p = partsFromFlat(yoursFlat);
    const tp = tierPath(yoursFlat);
    const now = mkTotal(p);
    if (!tp || p.tier >= 51 || !(now > 0) || !tierCanMove(yoursFlat, tp)) return [];
    const E = Number(yoursFlat[`${tp} / Exponent`]) || 2;
    const next = Number(yoursFlat[`${tp} / Next tier at`]);
    const maxDmg = Number(yoursFlat[`${tp} / Max Damage`]) || 0;
    // What the next tier really asks for: next / max, anywhere in (1, E].
    const need = maxDmg > 0 && next > maxDmg ? next / maxDmg : E;
    return [
      {
        path: `${tp} / +1`,
        // Only reachable below tier 51 (the guard above): same estimate caveat.
        group: `needs ×${Number(need.toFixed(2))} more max damage (next tier at ${formatNum(next)}) · estimate`,
        source: "+1 damage tier",
        display: "raw",
        you: p.tier,
        max: p.tier + 1,
        gainPct: (mkTotal({ ...p, tier: p.tier + 1 }) / now - 1) * 100,
      },
    ];
  },
};
