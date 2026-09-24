import { describe, it, expect, beforeAll } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeAllTalentLVz, talent } from "@/lib/arkh/stats/systems/common/talent";
import { divinityMinorSum } from "@/lib/arkh/stats/systems/coin/divinityMinor";
import { getPrismaBonusMult } from "@/lib/arkh/stats/systems/w2/alchemy";
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

// N.js CauldronStats("BubbleBonus") @5083802 multiplies a Prisma bubble
// (OptionsListAccount[384] holds N2L[cauldron] + index + ",") by
// max(1, PrismaBonusMult), and TalentCalc(-2) stores that value as
// AlchBubbles.Y2ACTIVE. So a Prisma BIG_P lifts every Y2ACTIVE reader,
// still only for a char that has it on (no Sheepie here).
const BIG_P_LV = 60; // decayMulti(0.5, 60) → ×1.25
const DIV_LV = 60; // Lv0[14]: 60 / (60 + 60) = 0.5
const ARCTIS = 1; // GodsInfo[1], minor type 2 (All Talent LV), x1 = 15
const PRISMA = 2.1; // PrismaBonusMult: base 2 + W6 trophy 10/100
const Y2 = 1.25 * PRISMA; // 2.625

beforeAll(() => {
  const cauldronInfo: number[][] = [[], [], [], []];
  cauldronInfo[3][21] = BIG_P_LV;
  const divinity: number[] = [];
  divinity[12] = ARCTIS; // char 0's linked god
  divinity[13] = ARCTIS; // char 1's linked god
  const lv0 = Array(15).fill(0);
  lv0[14] = DIV_LV;
  const ola: string[] = [];
  ola[384] = "c21,"; // BIG_P is Prisma
  loadSaveData({
    charNames: ["WearsC21", "NoBigP"],
    data: {
      CauldronInfo: cauldronInfo,
      CauldronBubbles: [["c21"], []],
      Divinity: divinity,
      Lv0_0: lv0,
      Lv0_1: lv0,
      OptLacc: ola,
      // Off the ×2 base, so a hardcoded 2 can't pass.
      Cards1: ["Trophy23"],
    },
  });
});

describe("a Prisma BIG_P multiplies Y2ACTIVE by max(1, PrismaBonusMult)", () => {
  it("the save's Prisma multiplier is 2.1", () => {
    expect(Math.max(1, getPrismaBonusMult(saveData))).toBeCloseTo(PRISMA, 10);
  });

  it("divinity minor sum: 2 linked chars × 2.625 × 0.5 × 15, and no Prisma without BIG_P on", () => {
    expect(divinityMinorSum(2, 0, saveData)).toBeCloseTo(39.375, 10);
    expect(divinityMinorSum(2, 1, saveData)).toBeCloseTo(15, 10);
  });

  it("all talent levels: Arctis gives ceil(2.625 × 7.5) = 20, ceil(7.5) = 8 without BIG_P", () => {
    expect(computeAllTalentLVz(100, 0, undefined, saveData)).toBe(20);
    expect(computeAllTalentLVz(100, 1, undefined, saveData)).toBe(8);
  });

  it("the talent breakdown tree agrees", () => {
    const arctis = find(talent.resolve(100, { saveData, charIdx: 0 }), /^Divinity Minor 2/)!;
    expect(arctis.val).toBe(20);
    expect(find(arctis, /^Bubble Y2 Active/)?.val).toBeCloseTo(Y2, 10);
  });
});
