// Per-class gating of the top-DR reference.
//
// A few DR talents are CLASS-SPECIFIC (not account-wide, not on every class's
// star tabs): Robbing Hood (279, Archer chain) and Curse of Mr Looty Booty
// (24, Journeyman chain). No single character has both, so the global
// best-per-path reference shows talents the selected character's class can
// never have. We gate them: each class only sees the class-specific talents
// its tabs actually include. Account-wide talents (328, 207) propagate to
// every char and universal star talents (655) are on every class, so neither
// is gated.

import dropRateDesc from "../../lib/corgan/stats/defs/drop-rate";
import { TALENT_TABS_BY_CLASS } from "../../lib/talentsLevel/talentTabs.gen";
import { isAccountWideTalent } from "../../lib/corgan/stats/data/common/account-wide-talents";

export const SEP = " / ";

export type GatedTalent = { id: number; owners: Set<string> };

/** DR-pool talents that are class-specific: not account-wide (those
 *  propagate) and not owned by every class (those are universal star
 *  talents). Returns each with the set of class keys whose tabs include it. */
export function deriveGatedTalents(): GatedTalent[] {
  const ids = new Set<number>();
  for (const pool of Object.values(dropRateDesc.pools)) {
    for (const s of pool as Array<{ system: string; id?: unknown }>) {
      if (s.system === "talent" && typeof s.id === "number") ids.add(s.id);
    }
  }
  const classKeys = Object.keys(TALENT_TABS_BY_CLASS);
  const out: GatedTalent[] = [];
  for (const id of ids) {
    if (isAccountWideTalent(id)) continue;
    const owners = new Set<string>();
    for (const c of classKeys) {
      const tabs = (TALENT_TABS_BY_CLASS as any)[c]?.tabs ?? [];
      if (
        tabs.some((t: any) => t.talents.some((x: any) => x.id === id))
      ) {
        owners.add(c);
      }
    }
    if (owners.size === 0 || owners.size === classKeys.length) continue;
    out.push({ id, owners });
  }
  return out;
}

export function allClassKeys(): string[] {
  return Object.keys(TALENT_TABS_BY_CLASS);
}

/** Profile key for a set of owned gated-talent ids — "base" when none. */
export function profileKey(ownedIds: number[]): string {
  return ownedIds.length
    ? "t" + [...ownedIds].sort((a, b) => a - b).join("_")
    : "base";
}

/** Shallowest flat-map path whose final segment ends with "(Talent <id>)" —
 *  i.e. the talent's top-level DR source node (not a nested reference). */
export function findTalentNodePath(
  flat: Record<string, number>,
  id: number
): string | null {
  const suffix = `(Talent ${id})`;
  let best: string | null = null;
  let bestDepth = Infinity;
  for (const p of Object.keys(flat)) {
    const segs = p.split(SEP);
    if (segs[segs.length - 1].endsWith(suffix) && segs.length < bestDepth) {
      best = p;
      bestDepth = segs.length;
    }
  }
  return best;
}

/** Every flat-map key at or under a node path. */
export function subtreePaths(
  flat: Record<string, number>,
  nodePathStr: string
): string[] {
  const pre = nodePathStr + SEP;
  return Object.keys(flat).filter((k) => k === nodePathStr || k.startsWith(pre));
}
