import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeSkillEfficiency } from "@/lib/arkh/stats/systems/common/derived-stats";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// N.js AllEfficiencies adds RiftStuff("RiftSkillETC",2) (@4197760): 7, plus 5
// per skill (bar 0/2/3/5/6/8) past mastery rank 4 once Rift[0] ≥ 15.
describe("AllEfficiencies reads RiftSkillETC(2), not a stub 0", () => {
  // Every skill at 500 → rank 5 on the 12 skills b = 2 counts: 7 + 60 = 67.
  const allEff = (rift: number) => {
    loadSaveData({ charNames: ["A"], data: { Rift: [rift], Lv0_0: Array(19).fill(500) } });
    return computeSkillEfficiency("Mining", 0, { saveData, charIdx: 0 }).children!.find((c) => c.name === "All Efficiencies")!.val;
  };

  it("is ×1.07 before Rift 15 and ×1.67 from it", () => {
    expect(allEff(15) / allEff(0)).toBeCloseTo(1.67 / 1.07, 10);
  });
});
