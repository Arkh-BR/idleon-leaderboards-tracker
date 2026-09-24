import { describe, it, expect, beforeAll } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeAllTalentLVz, talent } from "@/lib/arkh/stats/systems/common/talent";
import { divinityMinorSum } from "@/lib/arkh/stats/systems/coin/divinityMinor";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

function find(n: ArkhNode, re: RegExp): ArkhNode | null {
  if (re.test(n.name)) return n;
  for (const c of n.children || []) {
    const hit = find(c, re);
    if (hit) return hit;
  }
  return null;
}

// N.js only sets an "ACTIVE" bubble key (BIG_P = Y2ACTIVE) when Sheepie
// (companion 4) is owned or CauldronBubbles[char] holds
// Number2Letter[cauldron] + index. Number2Letter starts "_abc", so BIG_P
// (cauldron 3, bubble 21) is "c21"; "d21" is no bubble at all. No Sheepie
// here, so the equipped code alone decides.
const BIG_P_LV = 60; // decayMulti(0.5, 60) → ×1.25
const DIV_LV = 60; // Lv0[14]: 60 / (60 + 60) = 0.5
const ARCTIS = 1; // GodsInfo[1], minor type 2 (All Talent LV), x1 = GodsInfo[2][3] = 15

beforeAll(() => {
  const cauldronInfo: number[][] = [[], [], [], []];
  cauldronInfo[3][21] = BIG_P_LV;
  const divinity: number[] = [];
  divinity[12] = ARCTIS; // char 0's linked god
  divinity[13] = ARCTIS; // char 1's linked god
  const lv0 = Array(15).fill(0);
  lv0[14] = DIV_LV;
  loadSaveData({
    charNames: ["WearsC21", "WearsD21"],
    data: {
      CauldronInfo: cauldronInfo,
      CauldronBubbles: [["c21"], ["d21"]],
      Divinity: divinity,
      Lv0_0: lv0,
      Lv0_1: lv0,
    },
  });
});

describe("BIG_P counts only when equipped as c21 (no Sheepie)", () => {
  it("divinity minor sum: the active char's c21 lifts both linked chars", () => {
    // 2 linked chars × max(1, Y2ACTIVE) × 0.5 × 15
    expect(divinityMinorSum(2, 0, saveData)).toBeCloseTo(2 * 1.25 * 7.5, 10);
    expect(divinityMinorSum(2, 1, saveData)).toBeCloseTo(2 * 7.5, 10);
  });

  it("all talent levels: Arctis gives ceil(1.25 × 7.5) with c21, ceil(7.5) with d21", () => {
    expect(computeAllTalentLVz(100, 0, undefined, saveData)).toBe(10);
    expect(computeAllTalentLVz(100, 1, undefined, saveData)).toBe(8);
  });

  it("the talent breakdown tree agrees", () => {
    const arctis = (ci: number) =>
      find(talent.resolve(100, { saveData, charIdx: ci }), /^Divinity Minor 2/)!;
    expect(arctis(0).val).toBe(10);
    expect(find(arctis(0), /^Bubble Y2 Active/)?.val).toBeCloseTo(1.25, 10);
    expect(arctis(1).val).toBe(8);
    expect(find(arctis(1), /^Bubble Y2 Active/)?.val).toBe(0);
  });
});
