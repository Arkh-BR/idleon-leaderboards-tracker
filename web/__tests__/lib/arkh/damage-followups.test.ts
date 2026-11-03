import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeSkillEfficiency } from "@/lib/arkh/stats/systems/common/derived-stats";
import { computeFamBonusQTYs } from "@/lib/arkh/stats/systems/common/stats";
import { formulaEval } from "@/lib/arkh/formulas";
import { computeCardLv } from "@/lib/arkh/stats/systems/common/cards";
import { mainframeBonus, mainframeBonusRaw } from "@/lib/arkh/stats/systems/w4/lab";
import { mapKillReq } from "@/lib/arkh/stats/data/common/maps";
import { damageStatType } from "@/lib/arkh/stats/systems/common/derived-damage";
import { computeShrine } from "@/lib/arkh/stats/systems/w3/construction";
import { votingBonusz } from "@/lib/arkh/stats/systems/w2/voting";
import { computeArtifactBonus } from "@/lib/arkh/stats/systems/w5/sailing";
import { playerBuildSpd } from "@/lib/arkh/stats/systems/w3/construction";

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

// N.js CardLv (@4083568): a card in OLA[603] below 7 stars reads 7, then one
// in OLA[155] below 6 reads 6.
describe("CardLv honours the OLA[603] upgrade list", () => {
  const lv = (ola603: string, ola155: string) => {
    const ola: string[] = [];
    ola[155] = ola155;
    ola[603] = ola603;
    loadSaveData({ charNames: ["A"], data: { Cards0: JSON.stringify({ w7a11: 1 }), OptLacc: ola } });
    return computeCardLv("w7a11", saveData);
  };

  it("1 card is Lv 1, 7 when listed in 603, 6 when only in 155", () => {
    expect(lv("0", "0")).toBe(1);
    expect(lv("0,w7a11", "0,w7a11")).toBe(7);
    expect(lv("0", "0,w7a11")).toBe(6);
  });
});

// N.js TalentCalc(-7) (@4511431) builds LabMFbonuses, then multiplies
// "114" by ⌊(Σ kitchen speed/fire/luck levels + .5)/25⌋ (kitchens in order,
// up to the first unbuilt) and "9" by ⌊green mushroom account kills / 1e6⌋.
describe("Lab mainframe 9 and jewel 114 carry their LabMFbonuses multipliers", () => {
  const load = () => {
    const lab: number[][] = [];
    lab[14] = Array(30).fill(1); // every jewel unlocked
    const kla: number[][] = [];
    kla[1] = [mapKillReq(1) - 5.5e6]; // 5.5M kills on mushG (map 1)
    const kitchens = [[1, 0, 0, 0, 0, 0, 10, 10, 10], [1, 0, 0, 0, 0, 0, 10, 10, 9], [0, 0, 0, 0, 0, 0, 99, 99, 99]];
    loadSaveData({ charNames: ["A"], data: { Lab: JSON.stringify(lab), KLA_0: JSON.stringify(kla), Cooking: JSON.stringify(kitchens) } });
  };

  it("114 × ⌊(30 + 29 + .5)/25⌋ = × 2 (the unbuilt third kitchen doesn't count)", () => {
    load();
    expect(mainframeBonusRaw(114, saveData)).toBeGreaterThan(0);
    expect(mainframeBonus(114, saveData)).toBeCloseTo(2 * mainframeBonusRaw(114, saveData), 10);
  });

  it("9 × ⌊5.5M / 1M⌋ = × 5", () => {
    load();
    expect(mainframeBonusRaw(9, saveData)).toBeGreaterThan(0);
    expect(mainframeBonus(9, saveData)).toBeCloseTo(5 * mainframeBonusRaw(9, saveData), 10);
  });
});

// N.js TalentCalc's bubble class gate (@4493650): below class 7 it zeroes
// W1/A1/A5/M5 but none of W6/A6/M6; 7–17 drops A6/M6, 18–29 W6/M6, 30+ W6/A6.
describe("DamageDealtSTATtype keeps W6/A6/M6 below class 7", () => {
  const sixes = (cls: number) => {
    const levels = Array.from({ length: 4 }, () => Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i, 100])));
    loadSaveData({ charNames: ["A"], data: { CharacterClass_0: cls, Lv0_0: [100], CauldronInfo: JSON.stringify(levels) } });
    const r = damageStatType(0, { saveData, charIdx: 0 });
    return [r.W6, r.A6, r.M6].map((v) => v > 0);
  };

  it("class 6 counts all three; 7, 18 and 30 only their own", () => {
    expect(sixes(6)).toEqual([true, true, true]);
    expect(sixes(7)).toEqual([true, false, false]);
    expect(sixes(18)).toEqual([false, true, false]);
    expect(sixes(30)).toEqual([false, false, true]);
  });
});

// N.js Shrine(i) (@7828132): a shrine counts with Artifact 0 owned, on its own
// map, or with Mainframe 5 in its world; the map defaults to the saved one.
describe("Shrines count only where N.js's gate lets them", () => {
  const shrine = (artifact0: number, map?: number) => {
    const sailing: number[][] = [[], [], [], [artifact0]];
    loadSaveData({ charNames: ["A"], data: { Shrine: JSON.stringify([[200, 0, 0, 10]]), Sailing: JSON.stringify(sailing), CurrentMap_0: 150 } });
    return computeShrine(0, 0, { saveData, mapIdx: map });
  };

  it("a W5 shrine (map 200) is off in W4, on in W5 (Mainframe 5), on everywhere with Artifact 0", () => {
    expect(shrine(0, 150)).toBe(0);
    expect(shrine(0)).toBe(0); // the saved map, 150
    expect(shrine(0, 210)).toBe(shrine(0, 200));
    expect(shrine(0, 200)).toBeGreaterThan(0);
    expect(shrine(1, 150)).toBe(shrine(0, 200));
  });
});

// N.js VotingBonusz (@10953438): vote 1 (25, damage) counts while it's the
// active vote, or while the character's portal world (GenINFO[58]) is under
// the world the active vote asks for (vote 25: World 6).
describe("Vote 1 also counts below the active vote's world", () => {
  const vote1 = (active: number, opened: number) => {
    const kla: number[][] = [];
    for (let k = 0; k < 6; k++) kla[50 * k] = [k < opened ? 0 : 100]; // town portals 0, 50, … 250
    loadSaveData({ charNames: ["A"], data: { KLA_0: JSON.stringify(kla) }, serverVars: { voteCategories: [active] } });
    return votingBonusz(1, 2, saveData, 0);
  };

  it("active vote 1: 25 × multi", () => expect(vote1(1, 6)).toBe(50));
  it("vote 25 (World 6) with 3 portals open (world 4): counts", () => expect(vote1(25, 3)).toBe(50));
  it("vote 25 with every portal open (world 7): doesn't", () => expect(vote1(25, 6)).toBe(0));
  it("vote 27 (no world asked): doesn't", () => expect(vote1(27, 0)).toBe(0));
});

// N.js Sailing("ArtifactBonus",8) (@10718371): base 6 × getLOG(Σ every player's
// WorkbenchStuff("PlayerBuildSpd")), which starts at 3 × (Construction lv/2 + .7)^1.6.
describe("Artifact 8 scales with the account's build speed", () => {
  it("two bare builders at Construction 100 and 200: 6 × getLOG(3·50.7^1.6 + 3·100.7^1.6)", () => {
    const sailing: number[][] = [[], [], [], []];
    sailing[3][8] = 1;
    loadSaveData({ charNames: ["A", "B"], data: { Sailing: JSON.stringify(sailing), Lv0_0: [1, 0, 0, 0, 0, 0, 0, 0, 100], Lv0_1: [1, 0, 0, 0, 0, 0, 0, 0, 200] } });
    const ctx = { saveData, charIdx: 0 };
    const [a, b] = [3 * Math.pow(50.7, 1.6), 3 * Math.pow(100.7, 1.6)];
    expect(playerBuildSpd(0, 0, ctx)).toBeCloseTo(a, 8);
    expect(playerBuildSpd(1, 0, ctx)).toBeCloseTo(b, 8);
    expect(computeArtifactBonus(8, 0, ctx)).toBeCloseTo((6 * Math.log(a + b)) / 2.30259, 10);
  });
});
