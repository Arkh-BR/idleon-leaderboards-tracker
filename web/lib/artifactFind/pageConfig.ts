// Artifact Find page: the statTracker kit's config for N.js
// Sailing("BoatArtiMulti", 0) — the Artifact Find line of the Skill Info.

import type { StatPageConfig } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { ARTI_GROUPS, ARTI_ROOT, ARTI_VOTE_NAME } from "@/lib/arkh/stats/defs/artifact-find";
import { formatArtifactFind } from "./format";
import { TOP_ARTI_GENERATED_AT, TOP_ARTI_PLAYERS_SCANNED } from "./topArtifactFind.meta";

export const ARTIFACT_PAGE: StatPageConfig = {
  statName: "Artifact Find",
  gainLabel: "Artifact Find",
  emoji: "🏺",
  calculatorTitle: "Artifact Find Calculator",
  subtitle:
    "Computes your Sailing Artifact Find multiplier from your save — the number in the Skill Info. Select a character. All processing local in your browser.",
  totalLabel: "Total Artifact Find",
  mapTitle: "Artifact Find doesn't depend on a map",
  noMap: true,
  errPrefix: "Artifact Find compute failed",
  storage: {
    save: "artifact-find-tracker.last-upload.v1",
    name: "artifact-find-tracker.playerName",
    snapshots: "artifact-find-tracker.v1",
    collapse: "artifact-find.snapshot-section.collapsed.v1",
    exportPrefix: "artifact-find-snapshots",
    exportLabel: "artifact-find-tracker",
  },
  compute: (save, charIdx) =>
    import("@/lib/arkh/computeArtifactFind").then((m) => m.computeArkhArtifactFind(save, charIdx)),
  formatTotal: formatArtifactFind,
  gains: groupedGainsModel(ARTI_ROOT, ARTI_GROUPS, { skip: [ARTI_VOTE_NAME] }),
  loadTop: () =>
    import("./topArtifactFind").then((m) => ({
      flatForClass: (classKey: string | null) => m.topArtifactFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_ARTI_GENERATED_AT, playersScanned: TOP_ARTI_PLAYERS_SCANNED },
  methodologyNote:
    "Artifact Find gain = how much your total Artifact Find would rise if this source matched the top players " +
    "(Observed Max — the best value of each source across the top players), recomputed through the game's formula. " +
    "Values are a ceiling, not a one-level step. Like the Skill Info, everything is measured on boat 0. " +
    "The weekly vote isn't ranked: it's server-wide and changes every week. " +
    "Tier-6 captains aren't counted, matching the Skill Info outside the W5 town (the game only adds them after you enter it).",
  compareTitle: "Compare every Artifact Find source against the best value observed across the top players",
  gainsTabTitle: "Rank your Artifact Find sources by how much total Artifact Find matching the top players would give",
  footer: "Artifact Find is computed locally from your save — every term of the game's Sailing formula, group by group.",
};
