// Per-class gating of the Coin Multi reference: the coin formula's class
// talents (COIN_CLASS_TALENTS) count only for classes whose tabs include them.
// Mirrors classGating.deriveGatedTalents, over the coin talent list.

import { TALENT_TABS_BY_CLASS } from "../../lib/talentsLevel/talentTabs.gen";
import { isAccountWideTalent } from "../../lib/arkh/stats/data/common/account-wide-talents";
import { COIN_CLASS_TALENTS } from "../../lib/arkh/stats/systems/coin/coin";
import type { GatedTalent } from "./classGating";

export function deriveGatedCoinTalents(): GatedTalent[] {
  const classKeys = Object.keys(TALENT_TABS_BY_CLASS);
  const out: GatedTalent[] = [];
  for (const id of COIN_CLASS_TALENTS) {
    if (isAccountWideTalent(id)) continue;
    const owners = new Set<string>();
    for (const c of classKeys) {
      const tabs = (TALENT_TABS_BY_CLASS as any)[c]?.tabs ?? [];
      if (tabs.some((t: any) => t.talents.some((x: any) => x.id === id))) owners.add(c);
    }
    if (owners.size === 0 || owners.size === classKeys.length) continue;
    out.push({ id, owners });
  }
  return out;
}
