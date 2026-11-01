// Drop Rate V2 page (beta): the statTracker kit's config for N.js
// TotalStats("Drop_Rarity") — the Drop Rate line of the character panel.

import type { StatPageConfig } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { DR2_GROUPS, DR2_ROOT, DR2_VOTE_NAME } from "@/lib/arkh/stats/defs/drop-rate-v2";
import { formatDropRateV2 } from "./format";
import { TOP_DR2_GENERATED_AT, TOP_DR2_PLAYERS_SCANNED } from "./topDropRateV2.meta";

// The Arcane Map multiplier is a direct child of the root, so the kit's
// refToggle can drop its subtree and replay the root through totalFromFlat.
const ARCANE_GROUP = DR2_GROUPS.find((g) => g.key === "arcane")!;

export const DR2_PAGE: StatPageConfig = {
  statName: "Drop Rate V2",
  gainLabel: "Drop Rate",
  emoji: "🎲",
  calculatorTitle: "Drop Rate V2 Calculator (beta)",
  subtitle:
    "Computes your Drop Rate from your save with the new engine (beta) — every term of the game's formula, group by group. Select character & map. All processing local in your browser.",
  totalLabel: "Total Drop Rate",
  mapTitle: "The map sets the Arcane Map multiplier and, on map 216, the Crystal Glunko Cove",
  errPrefix: "Drop Rate V2 compute failed",
  storage: {
    save: "drop-rate-v2-tracker.last-upload.v1",
    name: "drop-rate-v2-tracker.playerName",
    snapshots: "drop-rate-v2-tracker.v1",
    collapse: "drop-rate-v2.snapshot-section.collapsed.v1",
    exportPrefix: "drop-rate-v2-snapshots",
    exportLabel: "drop-rate-v2-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeDropRateV2").then((m) => m.computeArkhDropRateV2(save, charIdx, mapIdx)),
  formatTotal: formatDropRateV2,
  gains: groupedGainsModel(DR2_ROOT, DR2_GROUPS, { skip: [DR2_VOTE_NAME] }),
  loadTop: () =>
    import("./topDropRateV2").then((m) => ({
      flatForClass: (classKey: string | null) => m.topDr2FlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_DR2_GENERATED_AT, playersScanned: TOP_DR2_PLAYERS_SCANNED },
  refToggle: {
    label: "Include Arcane Map",
    title: "Include the Arcane Map multiplier in the Observed Max",
    groupPath: `${DR2_ROOT} / ${ARCANE_GROUP.name}`,
  },
  methodologyNote:
    "Drop Rate gain = how much your total Drop Rate would rise if this source matched the Observed Max — the best value " +
    "of each source among the top players of your class family (warrior, archer, mage and beginner lines are measured apart), " +
    "recomputed through the game's formula. Values are a ceiling, not a one-level step. " +
    "The weekly vote isn't ranked: it's server-wide and changes every week. " +
    "The Arcane Map multiplier depends on the map you farm, so the Include Arcane Map checkbox next to Compare vs Observed Max " +
    "can exclude it from the reference. This is the beta engine; the original Drop Rate page stays available.",
  compareTitle: "Compare every Drop Rate source against the best value observed across the top players of your class family",
  gainsTabTitle: "Rank your Drop Rate sources by how much Drop Rate matching the top players would give",
  footer: "Drop Rate V2 (beta) is computed locally from your save — every term of the game's Drop Rate formula, group by group.",
};
