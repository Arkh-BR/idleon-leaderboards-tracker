import type { StatPageConfig } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";

export const TEST_GROUPS = [{ key: "g1", name: "Pool", kind: "pct" as const, sources: ["a", "b"] }];

export const testConfig: StatPageConfig = {
  statName: "Test Multi",
  gainLabel: "Test",
  emoji: "🧪",
  calculatorTitle: "Test Multi Calculator",
  subtitle: "Test subtitle.",
  totalLabel: "Total Test Multi",
  mapTitle: "Test map title",
  errPrefix: "Test multi compute failed",
  storage: {
    save: "test-multi-tracker.last-upload.v1",
    name: "test-multi-tracker.playerName",
    snapshots: "test-multi-tracker.v1",
    collapse: "test-multi.snapshot-section.collapsed.v1",
    exportPrefix: "test-multi-snapshots",
    exportLabel: "test-multi-tracker",
  },
  compute: async () => {
    throw new Error("stub");
  },
  formatTotal: (x) => x.toFixed(2),
  gains: groupedGainsModel("Test Multi", TEST_GROUPS),
  loadTop: async () => ({ flatForClass: () => ({}) }),
  topMeta: { generatedAt: "2026-09-24T00:00:00.000Z", playersScanned: 3 },
  methodologyNote: "Test methodology.",
  compareTitle: "Test compare",
  gainsTabTitle: "Test gains",
  footer: "Test footer.",
};
