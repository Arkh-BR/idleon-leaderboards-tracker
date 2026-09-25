// EXP Multi page: the statTracker kit's config for N.js ExpMulti(0).

import type { StatPageConfig } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { EXP_GROUPS, EXP_ROOT, EXP_VOTE_NAME } from "@/lib/arkh/stats/defs/exp-multi";
import { EXP_CIRCUMSTANTIAL_SOURCE_NAMES } from "@/lib/arkh/stats/systems/exp/exp";
import { formatExpMulti } from "./format";
import { TOP_EXP_GENERATED_AT, TOP_EXP_PLAYERS_SCANNED } from "./topExpMulti.meta";

export const EXP_PAGE: StatPageConfig = {
  statName: "EXP Multi",
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
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeExp").then((m) => m.computeArkhExpMulti(save, charIdx, mapIdx)),
  formatTotal: formatExpMulti,
  gains: groupedGainsModel(EXP_ROOT, EXP_GROUPS, { skip: [...EXP_CIRCUMSTANTIAL_SOURCE_NAMES, EXP_VOTE_NAME] }),
  loadTop: () =>
    import("./topExpMulti").then((m) => ({
      flatForClass: (classKey: string | null) => m.topExpFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_EXP_GENERATED_AT, playersScanned: TOP_EXP_PLAYERS_SCANNED },
  methodologyNote:
    "EXP gain = how much your total Class EXP Multi would rise if this source matched the top players " +
    "(Observed Max), recomputed through the game's formula. Values are a ceiling, not a one-level step. " +
    "Each top player is measured on their best EXP map (Arcane map bonus × Shiny Medallions), so those " +
    "two rows reflect that map choice too. Sources that only apply to your lowest-level character or " +
    "below a level cap aren't ranked. The weekly vote isn't ranked: it's server-wide and changes every week.",
  compareTitle: "Compare every EXP source against the best value observed across the top players",
  gainsTabTitle: "Rank your EXP sources by how much Class EXP Multi matching the top players would give",
  footer: "EXP Multi is computed locally from your save — every term of the game's Class EXP formula, group by group.",
};
