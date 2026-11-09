// ===== COIN MULTI DESCRIPTOR =====
// N.js ArbitraryCode("MonsterCash") (live sha 6de681a96813): 22 multiplicative
// factors and one additive group, in game order. Every term is a source of
// the `coin` system (systems/coin/coin.ts); a group's shape lives in lib/coinMulti/layers:
//   pct → 1 + Σ/100      raw → 1 + Σ      min4 → 1 + min(4, Σ)

import type { Descriptor } from "../tree-builder";
import { groupedDescriptor, groupFactorOf } from "./grouped";

// The display config (root, vote node, groups) lives in lib/coinMulti/layers (Ruling B): re-exported, so every importer of this def keeps working.
import { COIN_GROUPS, COIN_ROOT } from "@/lib/coinMulti/layers";
export { COIN_GROUPS, COIN_ROOT, COIN_VOTE_NAME, type CoinGroup, type CoinGroupKind } from "@/lib/coinMulti/layers";
import type { CoinGroupKind } from "@/lib/coinMulti/layers";

export function groupFactor(kind: CoinGroupKind, sum: number): number {
  return groupFactorOf({ kind }, [sum]);
}

const coinMultiDesc: Descriptor = groupedDescriptor({
  id: "coin-multi",
  name: COIN_ROOT,
  scope: "character+map",
  category: "economy",
  system: "coin",
  groups: COIN_GROUPS,
});

export default coinMultiDesc;
