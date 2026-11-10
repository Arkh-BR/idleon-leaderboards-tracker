// Task 2 (EXP plan): the edges of the sub-cases this task ported for ExpMulti(0), on a synthetic envelope (no real save, so CI runs them):
// GamingStatType MSA_Bonus 4, Windwalker TotalTitanKills, Holes B_UPG 47, Breeding PetArenaCrucBonus (and CalcTalentMAP "arenaCruc"),
// MenagerieStuff BoostQTY, Thingies DancingCoralBonus / CoralKidUpgBonus 2 / FriendBonusStatz 1, Spelunk BigFishBonuses, WorkbenchStuff
// AdditionExtraEXPnDR. Only the keys a test sets are in the save; every other block is answered from the Ctx cache (`seed`).
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { NotPorted } from "@/lib/game/errors";
import { Number2Letter, RANDOlist, Research, Spelunky } from "@/lib/game/data";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { Windwalker } from "@/lib/game/njs/Windwalker";
import { Holes } from "@/lib/game/njs/Holes";
import { Breeding } from "@/lib/game/njs/Breeding";
import { DNSM_CalcTalentMAP } from "@/lib/game/njs/TalentCalc";
import { MenagerieStuff } from "@/lib/game/njs/MenagerieStuff";
import { Thingies } from "@/lib/game/njs/Thingies";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";

type Data = Record<string, unknown>;
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
const synth = (data: Data): Ctx =>
  makeCtx(
    buildGameState({
      data,
      charNames: ["c0"],
      companion: null,
      guildData: {},
      serverVars: null,
      tournament: {},
      accountCreateTime: 1,
      lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map: 251 }
  );
const optl = (set: Record<number, unknown>): unknown[] => {
  const o = Array<unknown>(700).fill(0);
  for (const [i, v] of Object.entries(set)) o[Number(i)] = v;
  return o;
};
const rows = (n: number, fill = 0): number[] => Array<number>(n).fill(fill);
const letter = (bit: number) => String((Number2Letter as unknown as readonly string[])[bit]);
const gaming = (bits: number[]): unknown[] => {
  const g = Array<unknown>(13).fill(0);
  g[12] = bits.map(letter).join("");
  return g;
};

describe("MSA_Bonus(4): 1.12 x the totem waves / 10 with the Super Bit 11, MSA_Bonus(0) with the Super Bit 7 (synthetic, runs in CI)", () => {
  const save = (bits: number[]): Data => ({ Gaming: gaming(bits), TotemInfo: [[100, 135, 0], [], []] });
  it("the waves are TotemInfo[0] summed: floor(235 / 10) = 23", () => {
    expect(GamingStatType(synth(save([11])), "MSA_Bonus", 4, 0)).toBeCloseTo(1.12 * 23, 12);
    expect(GamingStatType(synth(save([7])), "MSA_Bonus", 0, 0)).toBe(23);
  });
  it("is 0 without the bonus's own Super Bit (7 does not give 4, 11 does not give 0), and the other bonuses are not ported", () => {
    expect(GamingStatType(synth(save([7])), "MSA_Bonus", 4, 0)).toBe(0);
    expect(GamingStatType(synth(save([11])), "MSA_Bonus", 0, 0)).toBe(0);
    expect(() => GamingStatType(synth(save([11])), "MSA_Bonus", 1, 0)).toThrow(NotPorted);
  });
});

describe("Windwalker TotalTitanKills counts the Compass[1] entries equal to 1 (synthetic, runs in CI)", () => {
  it("1s count; 0, 2 and an empty list do not", () => {
    expect(Windwalker(synth({ Compass: [[], [1, 0, 1, 2, 1, 0]] }), "TotalTitanKills", 0, 0)).toBe(3);
    expect(Windwalker(synth({ Compass: [[], []] }), "TotalTitanKills", 0, 0)).toBe(0);
  });
});

describe("Holes B_UPG(47) is 25 x Holes[11][26] once the upgrade is bought (synthetic, runs in CI)", () => {
  const holes = (bought: number, level: number): unknown[] => {
    const h: unknown[][] = Array.from({ length: 16 }, () => rows(100));
    h[13][47] = bought;
    h[11][26] = level;
    return h;
  };
  it("bought: 25 per level; not bought (Holes[13][47] = 0): 0", () => {
    expect(Holes(synth({ Holes: holes(1, 4) }), "B_UPG", 47, 0)).toBe(100);
    expect(Holes(synth({ Holes: holes(0, 4) }), "B_UPG", 47, 0)).toBe(0);
  });
});

describe("Breeding PetArenaCrucBonus: the Crucible waves cleared (CalcTalentMAP arenaCruc) pass e, with the Menagerie unlock 8 (synthetic, runs in CI)", () => {
  const waves = RANDOlist[115] as unknown as readonly string[];
  const save = (unlock: number, best: number): Data => ({
    Menagerie: [rows(10), [], [...rows(8), unlock, ...rows(21)], rows(30)],
    OptLacc: optl({ 628: best }),
  });
  it("the best wave at the 6th threshold clears 6 waves: e = 5 is 1, e = 6 is 0", () => {
    const c = synth(save(1, Number(waves[5])));
    expect(DNSM_CalcTalentMAP(c, "arenaCruc")).toBe(6);
    expect(Breeding(c, "PetArenaCrucBonus", "0", 5, 0)).toBe(1);
    expect(Breeding(c, "PetArenaCrucBonus", "0", 6, 0)).toBe(0);
  });
  it("stops at the first threshold the best wave misses, and is 0 without the Menagerie unlock 8", () => {
    expect(DNSM_CalcTalentMAP(synth(save(1, Number(waves[0]) - 1)), "arenaCruc")).toBe(0);
    const locked = synth(save(0, Number(waves[5])));
    expect(DNSM_CalcTalentMAP(locked, "arenaCruc")).toBe(0);
    expect(Breeding(locked, "PetArenaCrucBonus", "0", 0, 0)).toBe(0);
  });
});

describe("MenagerieStuff BoostQTY is Research[58][b] x Menagerie[3][b] (synthetic, runs in CI)", () => {
  it("boost 23: its CustomLists value times its level", () => {
    const boosts = rows(30);
    boosts[23] = 4;
    const c = synth({ Menagerie: [rows(10), [], rows(30), boosts] });
    expect(MenagerieStuff(c, "BoostQTY", 23, 0)).toBe(Number((Research as unknown as string[][])[58][23]) * 4);
  });
});

describe("Thingies DancingCoralBonus / CoralKidUpgBonus 2 / FriendBonusStatz 1 (synthetic, runs in CI)", () => {
  const coral = Number((Spelunky as unknown as string[][])[24][3]);
  it("DancingCoralBonus(3, 999) is Spelunky[24][3]; otherwise it times the levels TowerInfo[21] is past 200 (none below)", () => {
    const tower = rows(60);
    tower[21] = 250;
    expect(Thingies(synth({ Tower: tower }), "DancingCoralBonus", 3, 999)).toBe(coral);
    expect(Thingies(synth({ Tower: tower }), "DancingCoralBonus", 3, 0)).toBe(coral * 50);
    tower[21] = 150;
    expect(Thingies(synth({ Tower: tower }), "DancingCoralBonus", 3, 0)).toBe(0);
  });
  it("CoralKidUpgBonus(2) is 20 x o / (25 + o), o = OptionsListAccount[429]; an unported upgrade throws", () => {
    expect(Thingies(synth({ OptLacc: optl({ 429: 25 }) }), "CoralKidUpgBonus", 2, 0)).toBe(10);
    expect(Thingies(synth({ OptLacc: optl({ 429: 0 }) }), "CoralKidUpgBonus", 2, 0)).toBe(0);
    expect(() => Thingies(synth({ OptLacc: optl({}) }), "CoralKidUpgBonus", 4, 0)).toThrow(NotPorted);
  });
  it("FriendBonusStatz(1): the friend with stat 1, FriendBonusQTY(1, level) x the extra multi; stats of 18 or more and other stats do not count; 4 is not ported", () => {
    const c = synth({ OptLacc: optl({ 476: "1,12000;3,5;18,100" }) });
    seed(c, "Thingies", ["FriendBonusSlots", 0, 0], 3);
    seed(c, "Thingies", ["FriendBonusXtraMulti", 0, 0], 2);
    // FriendBonusQTY(1, 12000): 30 x min(1.5, .25 + 12000 / (12000 + 12000) x 1.5) = 30
    expect(Thingies(c, "FriendBonusStatz", 1, 0)).toBe(60);
    expect(Thingies(c, "FriendBonusStatz", 0, 0)).toBe(0);
    expect(() => Thingies(c, "FriendBonusStatz", 4, 0)).toThrow(NotPorted);
    // a friend past the slots is ignored
    const narrow = synth({ OptLacc: optl({ 476: "3,5;1,12000" }) });
    seed(narrow, "Thingies", ["FriendBonusSlots", 0, 0], 1);
    seed(narrow, "Thingies", ["FriendBonusXtraMulti", 0, 0], 1);
    expect(Thingies(narrow, "FriendBonusStatz", 1, 0)).toBe(0);
  });
});

describe("Spelunk BigFishBonuses: level / (100 + level) x the third field of the Big Fish row (synthetic, runs in CI)", () => {
  const field = (g: number) => Number(String((Spelunky as unknown as string[][])[18][g]).split(",")[2]);
  it("Big Fish 4 at level 100 is half its field; at level 0 it is 0; a Big Fish past the list throws", () => {
    const lv = rows(30);
    lv[4] = 100;
    const c = synth({ Spelunk: Array.from({ length: 50 }, (_, i) => (i === 11 ? lv : [])) });
    expect(Spelunk(c, "BigFishBonuses", 4, 0)).toBe((100 / 200) * field(4));
    expect(Spelunk(c, "BigFishBonuses", 3, 0)).toBe(0);
    expect(() => Spelunk(c, "BigFishBonuses", 40, 0)).toThrow(RangeError);
  });
});

describe("WorkbenchStuff AdditionExtraEXPnDR is 1 + the best talent 328 x getLOG(OptionsListAccount[139]) / 100 (synthetic, runs in CI)", () => {
  it("talent 50 and 1000 of the statistic: 1 + 50 x 3 / 100; no talent: 1", () => {
    const c = synth({ OptLacc: optl({ 139: 1000 }) });
    seed(c, "getbonus2", [1, 328, -1], 50);
    expect(WorkbenchStuff(c, "AdditionExtraEXPnDR", 0, 0)).toBeCloseTo(2.5, 3); // getLOG(1000) is a hair under 3 (the game's constant)
    const none = synth({ OptLacc: optl({ 139: 1000 }) });
    seed(none, "getbonus2", [1, 328, -1], 0);
    expect(WorkbenchStuff(none, "AdditionExtraEXPnDR", 0, 0)).toBe(1);
  });
});
