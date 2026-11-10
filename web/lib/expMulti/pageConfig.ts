// EXP Multi page: the statTracker kit's config for N.js ExpMulti(0). It computes on lib/game (trackers/expMulti.ts); the Observed Max
// collector (scripts/update-top-exp.ts) runs the same engine.

import type { StatPageConfig } from "@/lib/statTracker/config";
import { withPageErrors } from "@/lib/statTracker/pageErrors";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { EXP_CIRCUMSTANTIAL_SOURCE_NAMES, EXP_GROUPS, EXP_ROOT, EXP_VOTE_NAME } from "./layers";
import { formatExpMulti } from "./format";
import { TOP_EXP_GENERATED_AT, TOP_EXP_PLAYERS_SCANNED } from "./topExpMulti.meta";

export const EXP_PAGE: StatPageConfig = {
  statName: "EXP Multi",
  readingStat: "expMulti",
  gainLabel: "EXP",
  emoji: "✨",
  calculatorTitle: "EXP Multi Calculator",
  subtitle:
    "Computes every character's Class EXP multiplier from your save. Select character & map. All processing local in your browser.",
  totalLabel: "Total Class EXP Multi",
  mapTitle: "The map sets the Arcane map bonus and whether Shiny Medallions applies (the medallion of the map's monster)",
  errPrefix: "EXP multi compute failed",
  storage: {
    save: "exp-multi-tracker.last-upload.v1",
    name: "exp-multi-tracker.playerName",
    snapshots: "exp-multi-tracker.v1",
    collapse: "exp-multi.snapshot-section.collapsed.v1",
    exportPrefix: "exp-multi-snapshots",
    exportLabel: "exp-multi-tracker",
  },
  compute: withPageErrors("EXP Multi", (save, charIdx, mapIdx) =>
    import("@/lib/game/trackers/expMulti").then((m) => m.computeGameExpMulti(save, charIdx, mapIdx))
  ),
  formatTotal: formatExpMulti,
  gains: groupedGainsModel(EXP_ROOT, EXP_GROUPS, { skip: [...EXP_CIRCUMSTANTIAL_SOURCE_NAMES, EXP_VOTE_NAME] }),
  loadTop: () =>
    import("./topExpMulti").then((m) => ({
      flatForClass: (classKey: string | null) => m.topExpFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_EXP_GENERATED_AT, playersScanned: TOP_EXP_PLAYERS_SCANNED },
  methodologyNote:
    "EXP gain = how much your total Class EXP Multi would rise if this source matched the Observed Max — the best value " +
    "of each source among the top players — recomputed through the game's formula. LUK Scaling and Lucky Charms scale " +
    "with LUK, so they're measured within your class family (warrior, archer, mage or beginner line). Values are a ceiling, not a one-level step. " +
    "Each top player is measured on their best EXP map (Arcane map bonus × Shiny Medallions), so those " +
    "two rows reflect that map choice too. Sources that only apply to your lowest-level character or " +
    "below a level cap aren't ranked. The weekly vote isn't ranked: it's server-wide and changes every week. " +
    "The Observed Max values are computed by the same engine as this page.",
  compareTitle: "Compare every EXP source against the best value observed across the top players (LUK Scaling and Lucky Charms: within your class family)",
  gainsTabTitle: "Rank your EXP sources by how much Class EXP Multi matching the top players would give",
  footer: "EXP Multi is computed locally from your save — every term of the game's Class EXP formula, group by group.",
};
