import { describe, expect, it } from "vitest";
import { expRateCore, MASTERY_COEF, masteryExpReq, purpleTotal, sourceBase, yellowTotal, type MasteryInputs } from "@/lib/cookingMastery/mastery";
import { makeCtx } from "@/lib/game/ctx";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { Summoning2 } from "@/lib/game/njs/Summoning2";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

const INP: MasteryInputs = {
  rank: 10,
  exp: 0,
  ladles: 1000,
  totalCookingLv: 1500,
  divorceCakeLv: 100,
  totalRibbonRanks: 7,
  purple: [1, 2, 3, 4, 5, 6],
  comp87: 1.5,
  evShop54: true,
  jelly13: 1,
  jelly5: 2,
  researchGridYellow: 4,
  externalMulti: 1,
};

describe("Cooking Mastery math", () => {
  it("reads the coefficients from RandoListo2[8]", () => {
    expect(MASTERY_COEF).toEqual([200, 1, 30, 10, 2, 20]);
  });

  it("pools: 7.5 from a stage-2 Companion 87 rounds with the rest, and only Yellow gets the research grid", () => {
    expect(purpleTotal(INP)).toBe(Math.round(10 + 1 + 7.5 + 5 + 1));
    expect(yellowTotal(INP)).toBe(Math.round(10 + 1 + 7.5 + 5 + 2 + 4));
  });

  it("the core skips upgrade 3 and starts at 2", () => {
    const none = { ...INP, purple: [0, 0, 0, 9, 0, 0] };
    expect(expRateCore(none)).toBe(2);
    expect(sourceBase(1, INP)).toBe(500);
    expect(sourceBase(2, INP)).toBe(25);
    expect(sourceBase(5, INP)).toBe(11);
  });

  it("the rank requirement grows faster past rank 40", () => {
    expect(masteryExpReq(0)).toBe(100);
    expect(masteryExpReq(41) / masteryExpReq(40)).toBeCloseTo(2.5 * 5, 9);
  });
});

describe('Summoning2("BonusAmountcook")', () => {
  const envelope = {
    charNames: ["a", "b"],
    companion: null,
    guildData: {},
    serverVars: null,
    tournament: {},
    accountCreateTime: 0,
    lastUpdated: 0,
    data: {
      CSver: CURRENT_CSVER,
      CookMaster: JSON.stringify([[0], [10, 0, 0, 1000], [1, 2, 3, 4, 5, 6]]),
      Meals: JSON.stringify([Array.from({ length: 74 }, (_, i) => (i === 73 ? 100 : 0))]),
      Ribbon: JSON.stringify([...Array(28).fill(0), 3, 4]),
      Lv0_0: JSON.stringify([...Array(10).fill(0), 800]),
      Lv0_1: JSON.stringify([...Array(10).fill(0), 700]),
    },
  } as unknown as GameEnvelope;
  const ctx = makeCtx(buildGameState(envelope), { player: 0, map: 0 });
  const bonus = (b: number, e = 99) => Summoning2(ctx, "BonusAmountcook", b, e);

  it("is coefficient x points without the 99", () => {
    expect(bonus(1, 0)).toBe(1 * 2);
    expect(bonus(5, 0)).toBe(20 * 6);
  });

  it("scales each upgrade by what the game names", () => {
    expect(bonus(1)).toBe(500 * 2); // Σ Lv0[10] over both characters - 1000
    expect(bonus(2)).toBe(25 * 90); // Meals[0][73] - 75
    expect(bonus(3)).toBe(250 * (40 / 65));
    expect(bonus(4)).toBe(7 * 10); // Σ Ribbon[28+]
    expect(bonus(5)).toBe(11 * 120); // rank + 1
  });
});
