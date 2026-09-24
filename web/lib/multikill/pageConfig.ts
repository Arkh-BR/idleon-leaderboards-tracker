// Multikill page: the statTracker kit's config for N.js
// WorkbenchStuff("MultiKillTOTAL") — the AFK Info panel's MULTIKILL line.

import type { StatPageConfig } from "@/lib/statTracker/config";
import { formatMultikill } from "./format";
import { multikillGainsModel } from "./gains";
import { TOP_MULTIKILL_GENERATED_AT, TOP_MULTIKILL_PLAYERS_SCANNED } from "./topMultikill.meta";

export const MULTIKILL_PAGE: StatPageConfig = {
  statName: "Multikill",
  gainLabel: "Multikill",
  emoji: "💥",
  calculatorTitle: "Multikill Calculator",
  subtitle:
    "Computes every character's AFK multikill from your save — the MULTIKILL line of the in-game AFK Info panel. Select character & map. All processing local in your browser.",
  totalLabel: "Total Multikill",
  mapTitle:
    "The map sets the Death Note page, the W7 soft cap and ×5 tier ladder, the target's HP and the Crystal Glunko Cove",
  errPrefix: "Multikill compute failed",
  storage: {
    save: "multikill-tracker.last-upload.v1",
    name: "multikill-tracker.playerName",
    snapshots: "multikill-tracker.v1",
    collapse: "multikill.snapshot-section.collapsed.v1",
    exportPrefix: "multikill-snapshots",
    exportLabel: "multikill-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeMultikill").then((m) => m.computeArkhMultikill(save, charIdx, mapIdx)),
  formatTotal: formatMultikill,
  unit: "%",
  // The total is already the game's floored percent; the tooltip adds separators.
  totalTitle: (x) => (Number.isFinite(x) ? Math.floor(x).toLocaleString("en-US") + "%" : "—"),
  gains: multikillGainsModel,
  loadTop: () =>
    import("./topMultikill").then((m) => ({
      flatForClass: (classKey: string | null) => m.topMultikillFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_MULTIKILL_GENERATED_AT, playersScanned: TOP_MULTIKILL_PLAYERS_SCANNED },
  methodologyNote:
    "Multikill gain = how much your Multikill would rise if this source matched the top players " +
    "(Observed Max), recomputed through the game's formula ⌊Base + Tier × Per Tier⌋. Values are a ceiling, " +
    "not a one-level step. The top players are measured on map 251 (World 6, every endgame character at " +
    "the tier-51 cap), so the Death Note row is only compared on a World 6 map and the damage tier only " +
    "outside World 7. \"+1 damage tier\" is a step, not a reference: it needs ×2 more max damage (×5 in World 7).",
  compareTitle: "Compare every Multikill source against the best value observed across the top players",
  gainsTabTitle: "Rank your Multikill sources by how much Multikill matching the top players would give",
  footer:
    "Multikill is computed locally from your save — every term of the game's multikill formula, base and per damage tier.",
};
