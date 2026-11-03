import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeSkillEfficiency } from "@/lib/arkh/stats/systems/common/derived-stats";
import { computeFamBonusQTYs } from "@/lib/arkh/stats/systems/common/stats";
import { formulaEval } from "@/lib/arkh/formulas";

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

// N.js FamBonusQTYs (@4498476): keys "24" and "44" take × (1 +
// getbonus2(1,144,-1)/100) for whoever sets them, not only the active char.
describe("Family bonuses 24 and 44 carry the account's best Family Guy", () => {
  // A Lv 500 Divine Knight (active, no 144) and a beginner with 144 at Lv 100 (20%).
  const fam = () => {
    loadSaveData({
      charNames: ["DK", "Guy"],
      data: { CharacterClass_0: 12, Lv0_0: [500], CharacterClass_1: 1, Lv0_1: [10], SL_1: JSON.stringify({ 144: 100 }) },
    });
    return computeFamBonusQTYs(0, saveData);
  };

  it("24 is decay(50,150) at Lv 500 − 69, × 1.2", () => {
    expect(fam()[24]).toBeCloseTo(formulaEval("decay", 50, 150, 431) * 1.2, 10);
  });
});
