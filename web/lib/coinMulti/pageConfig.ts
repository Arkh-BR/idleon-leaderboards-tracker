// Coin Multi page: the statTracker kit's config for N.js ArbitraryCode("MonsterCash"). It computes on lib/game (trackers/coinMulti.ts); the Observed Max
// collector (scripts/update-top-coin.ts) stays on lib/arkh.

import type { StatPageConfig } from "@/lib/statTracker/config";
import { withPageErrors } from "@/lib/statTracker/pageErrors";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { COIN_GROUPS, COIN_ROOT, COIN_VOTE_NAME } from "./layers";
import { formatCoinMulti } from "./format";
import { TOP_COIN_GENERATED_AT, TOP_COIN_PLAYERS_SCANNED } from "./topCoinMulti.meta";

export const COIN_PAGE: StatPageConfig = {
  statName: "Coin Multi",
  readingStat: "coinMulti",
  gainLabel: "Coin",
  emoji: "🪙",
  calculatorTitle: "Coin Multi Calculator",
  subtitle:
    "Computes every character's monster coin multiplier from your save. Select character & map. All processing local in your browser.",
  totalLabel: "Total Coin Multi",
  mapTitle: "The map sets the guild bonus world and Coins For Charon's multikill tier",
  errPrefix: "Coin multi compute failed",
  storage: {
    save: "coin-multi-tracker.last-upload.v1",
    name: "coin-multi-tracker.playerName",
    snapshots: "coin-multi-tracker.v1",
    collapse: "coin-multi.snapshot-section.collapsed.v1",
    legacyValueKey: "computedCoinMulti",
    exportPrefix: "coin-multi-snapshots",
    exportLabel: "coin-multi-tracker",
  },
  compute: withPageErrors("Coin Multi", (save, charIdx, mapIdx) =>
    import("@/lib/game/trackers/coinMulti").then((m) => m.computeGameCoinMulti(save, charIdx, mapIdx))
  ),
  formatTotal: formatCoinMulti,
  gains: groupedGainsModel(COIN_ROOT, COIN_GROUPS, { skip: [COIN_VOTE_NAME] }),
  loadTop: () =>
    import("./topCoinMulti").then((m) => ({
      flatForClass: (classKey: string | null) => m.topCoinFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_COIN_GENERATED_AT, playersScanned: TOP_COIN_PLAYERS_SCANNED },
  methodologyNote:
    "Coin gain = how much your total Coin Multi would rise if this source matched the Observed Max — the best value " +
    "of each source among the top players. The Cash Bubbles scale with STR, AGI and WIS, so they're measured within " +
    "your class family (warrior, archer, mage or beginner line). Every group multiplies the total, so a source's gain is its group's new factor " +
    "over the current one. Values are a ceiling, not a one-level step. The top-player reference is " +
    "measured on map 301 (World 7), so the Guild and Coins For Charon rows reflect that map choice too. " +
    "The weekly vote isn't ranked: it's server-wide and changes every week. " +
    "The Observed Max values themselves are still computed by the previous engine, so for a few sources they can differ slightly " +
    "from your own numbers until they are recomputed.",
  compareTitle: "Compare every coin source against the best value observed across the top players (Cash Bubbles: within your class family)",
  gainsTabTitle: "Rank your coin sources by how much Coin Multi matching the top players would give",
  footer: "Coin Multi is computed locally from your save — every term of the game's coin formula, group by group.",
};
