// SkillStats("FishingEfficiency") (talent 202's counter) and the sub-cases its closure reaches that lib/game did not have: each on a synthetic Ctx where
// every other block answers 0 unless seeded (support/expStub), the expected value written from the N.js expression at the cited offset.
import { describe, expect, it } from "vitest";
import { synth, type Data, type Seeds } from "../support/expStub";
import type { TraceNode } from "@/lib/game/trace";
import { FishToolkitInfo, GodsInfo, JewelDesc } from "@/lib/game/data";
import { asNumber } from "@/lib/game/attr";
import { curve5 } from "@/lib/game/njs/ArbitraryCode5Inputs";
import { talentCurves } from "@/lib/game/njs/GetTalentNumber";
import { SkillStats } from "@/lib/game/njs/SkillStats";
import { FishingToolkit } from "@/lib/game/njs/FishingToolkit";
import { TalentEnh } from "@/lib/game/njs/TalentEnh";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { DNSM_CalcTalentMAP43 } from "@/lib/game/njs/TalentCalc";
import { DNSM_AlchBubbles } from "@/lib/game/njs/DNSM";
import { RiftStuff } from "@/lib/game/njs/RiftStuff";
import { Summoning } from "@/lib/game/njs/Summoning";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { Divinity } from "@/lib/game/njs/Divinity";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { Thingies } from "@/lib/game/njs/Thingies";
import { Holes } from "@/lib/game/njs/Holes";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";

const LOG = (n: number) => Math.log(Math.max(n, 1)) / 2.30259; // getLOG @4461003
const ctx = (data: Data, seeds: Seeds = {}, real: string[] = [], o: { chars?: number; player?: number; trace?: boolean } = {}) => synth(data, { map: 0, seeds, real, ...o });
const find = (n: TraceNode, pred: (t: TraceNode) => boolean): TraceNode | undefined => (pred(n) ? n : n.children.map((k) => find(k, pred)).find(Boolean));
const ola = (m: Record<number, unknown>) => Object.assign(Array<unknown>(700).fill(0), m);

describe("SkillStats", () => {
  it("FishingEfficiency: the rod's power, the toolkit, Fishing_Power and the minigame into DN, then the product (@4218273, @4219909)", () => {
    const c = ctx(
      { EquipOrder_0: [[], ["Blank", "Blank", "FishingRod2"]], EMm1_0: [{}, {}, { Weapon_Power: 2 }], EMmLENGTH1_0: 8, Lv0_0: [100, 0, 0, 0, 50], FamValMinigameHiscores: [0, 30] },
      {
        'DNSM.AlchBubbles["ToolW"]': 50, 'FishingToolkit["POW"]': 4, 'TotalStats["Fishing_Power"]': 10, "GetTalentNumber[2,116]": 20,
        'TotalStats["STR"]': 400, "GetTalentNumber[1,142]": 10, 'StampBonusOfTypeX["BaseFishEff"]': 5, 'SkillStats["AllBaseSkillEff"]': 7,
        'RiftStuff["RiftSkillBonus,3",1]': 1, 'Summoning["VotingBonusz",8,0]': 2, 'GetSetBonus["PLATINUM_SET","Bonus",0,0]': 3, 'GetBribeBonus["29"]': 1, 'StampBonusOfTypeX["FishEffPerLv"]': 0.2,
        'DNSM.BoxRewards["FishEffPct"]': 4, "DNSM.CalcTalentMAP43[3]": 6, 'SkillStats["AllEfficiencies"]': 2.5, 'GoldFoodBonuses["FishingEff"]': 1.3,
        "CardBonusREAL[30]": 8, 'DNSM.AlchVials["FishEff"]': 9, 'EtcBonuses["19"]': 11, 'Summoning["RooBonuses",0,0]': 12, "GetTalentNumber[1,85]": 13, 'DNSM.StarSigns["FishEff"]': 14,
      },
      ["SkillStats["]
    );
    // DN: (8 + 2) x (1 + 50 / 100) + (3 + 4), then + (10 + min(30, 20))
    const dn = 10 * 1.5 + 7 + (10 + 20);
    const want =
      (Math.pow(dn, 1.3) + (Math.pow(400, 0.6) * (1 + 10 / 100) + (5 + 7))) *
      (1 + 50 / 200) *
      (1 + Math.pow(400 / 100, 0.35) * (1 + (10 + (10 * 1 + (2 + 3)) + 15 * 1 + 0.2 * 50) / 100)) *
      (1 + (4 + 6) / 100) *
      (1 + dn / 100) *
      2.5 *
      1.3 *
      (1 + (8 + 9 + (11 + 12)) / 100) *
      (1 + 13 / 100) *
      (1 + 14 / 100);
    expect(SkillStats(c, "FishingEfficiency")).toBeCloseTo(want, 9);
  });

  it("FishingEfficiency with no rod: DN is the toolkit and the powers only", () => {
    const c = ctx({ EquipOrder_0: [[], ["Blank", "Blank", "Blank"]], Lv0_0: [100], FamValMinigameHiscores: [0, 30] }, { 'FishingToolkit["POW"]': 4, 'SkillStats["AllEfficiencies"]': 1, 'GoldFoodBonuses["FishingEff"]': 1 }, ["SkillStats["]);
    const dn = 0 + 7 + (0 + Math.min(30, 0));
    expect(SkillStats(c, "FishingEfficiency")).toBeCloseTo(Math.pow(dn, 1.3) * (1 + dn / 100), 9);
  });

  it("AllBaseSkillEff (@4198330): the flat sum", () => {
    const c = ctx({}, { 'Breeding["ShinyBonusS","Nah",22,-1]': 1, 'StampBonusOfTypeX["BaseAllEff"]': 2, 'Divinity["BlesssBonus",2,0]': 3, 'DNSM.BoxRewards["20b"]': 4, 'chipBonuses["eff"]': 5, "GetTalentNumber[1,636]": 6, "MainframeBonus[112]": 7 }, ["SkillStats["]);
    expect(SkillStats(c, "AllBaseSkillEff")).toBe(28);
  });

  it("AllEfficiencies (@4197048): six factors, the last one at least .01", () => {
    const seeds: Seeds = {
      'DNSM.FamBonusQTYs["42"]': 1, 'EtcBonuses["48"]': 2, 'DNSM.AlchVials["6SkillEff"]': 3, 'Sailing["ArtifactBonus",15,0]': 4, 'ArbitraryCode["TotalQuestsComplete"]': 300, "GetTalentNumber[1,617]": 20,
      'MealBonus["Seff"]': 5, "GetTalentNumber[1,646]": 6, 'Summoning["TomeBonus",1,0]': 7, 'GamingStatType["PaletteBonus",10,0]': 8, 'chipBonuses["toteff"]': 9, 'RunCodeOfTypeXforThingY["CardLv","Crystal4"]': 2,
      'Thingies["FriendBonusStatz",2,0]': 10, 'RiftStuff["RiftSkillETC",2]': 11, 'Holes["B_UPG",49,15]': 12, 'Dreamstuff["AllShimmerBonuses",0]': 3,
      "CardBonusREAL[84]": 13, "Companions[5]": 14, 'Summoning["WinBonus",14,0]': 15, "GuildBonuses[6]": 16, 'CardSetBonuses[0,"2"]': 17, "prayersReal[1,0]": 18, "GetBuffBonuses[40,2]": 19, "prayersReal[17,1]": 20,
    };
    const want =
      (1 + (1 + (2 + 3 + (4 + Math.min(0.1 * 300, 20)))) / 100) *
      (1 + (5 + 6 + (7 + 8) + (9 + (3 * 2 + 10)) + (11 + (12 + 21) + 22 * 3)) / 100) *
      (1 + (13 + 14) / 100) *
      (1 + 15 / 100) *
      (1 + (16 + (17 + 18)) / 100) *
      Math.max(1 - (19 + 20) / 100, 0.01);
    expect(SkillStats(ctx({ OptLacc: ola({ 422: 21, 180: 22 }) }, seeds, ["SkillStats["]), "AllEfficiencies")).toBeCloseTo(want, 12);
    // the buff's and the prayer's cut is floored at x .01
    expect(SkillStats(ctx({}, { "GetBuffBonuses[40,2]": 150 }, ["SkillStats["]), "AllEfficiencies")).toBeCloseTo(0.01, 12);
  });
});

describe("the preamble's blocks", () => {
  it('TotalStats("Fishing_Power") (@4188943): the fishing tool slot\'s power, statue 8 and the W2 and W7 bubbles', () => {
    const c = ctx(
      { EquipOrder_0: [Array(16).fill("Blank"), ["Blank", "Blank", "FishingRod2", "Blank", "Blank", "Blank", "Blank", "Blank"]], EMm0_0: [], EMm1_0: [{}, {}, { Weapon_Power: 2 }], EMmLENGTH0_0: 16, EMmLENGTH1_0: 8, ObolEqO0_0: [], ObolEqO1: [] },
      { "Dungon[]": -1, 'ArbitraryCode["StatueBonusGiven8"]': 5, 'DNSM.AlchBubbles["W2"]': 6, 'DNSM.AlchBubbles["W7"]': 7 },
      ["TotalStats["]
    );
    expect(TotalStats(c, "Fishing_Power")).toBe(8 + 2 + (5 + (6 + 7)));
  });

  it('FishingToolkit("POW") (@5080069, @5083903): the two toolkit slots\' FishToolkitInfo[slot][choice][7]', () => {
    const info = FishToolkitInfo as unknown as readonly (readonly (readonly unknown[])[])[];
    const c = ctx({ PVFishingToolkit_0: [2, 3] }, {}, ["FishingToolkit"]);
    expect(FishingToolkit(c, "POW")).toBe(asNumber(info[0][2][7]) + asNumber(info[1][3][7]));
    expect(FishingToolkit(c, "POW")).toBe(1 + 2);
  });

  it("TalentEnh(43) (@10798746): 1 once the account's best talent 49 is 175", () => {
    expect(TalentEnh(ctx({}, { "getbonus2[1,49,-1]": 175 }, ["TalentEnh"]), 43)).toBe(1);
    expect(TalentEnh(ctx({}, { "getbonus2[1,49,-1]": 174.9 }, ["TalentEnh"]), 43)).toBe(0);
  });

  it('CalcTalentMAP["43"][g] (@4468426): talent 43 of the last class 3..5 character, where the current one is behind; doubled on that character with TalentEnh(43)', () => {
    const t = talentCurves(43);
    const at = (lv: number) => curve5(String(t[2]), asNumber(t[0]), asNumber(t[1]), lv);
    const data = { CharacterClass_0: 14, CharacterClass_1: 4, SL_0: {}, SL_1: { 43: 10 }, Lv0_0: [100, 5, 5, 5, 5, 5, 5, 5, 5, 5], Lv0_1: [100, 9, 1, 9, 9, 1, 1, 1, 1, 1] };
    const REAL = ["DNSM.CalcTalentMAP43", "ArbitraryCode5Inputs"];
    const other = ctx(data, {}, REAL, { chars: 2 });
    expect(at(10)).toBeGreaterThan(0);
    expect(DNSM_CalcTalentMAP43(other, 3)).toBeCloseTo(at(10), 12); // Lv0[4]: 5 < 9
    expect(DNSM_CalcTalentMAP43(other, 1)).toBe(0); // Lv0[2]: 5 >= 1
    expect(DNSM_CalcTalentMAP43(ctx(data, { "TalentEnh[43]": 1 }, REAL, { chars: 2, player: 1 }), 1)).toBeCloseTo(2 * at(10), 12);
    expect(DNSM_CalcTalentMAP43(ctx(data, { "TalentEnh[43]": 0 }, REAL, { chars: 2, player: 1 }), 3)).toBe(0);
    expect(DNSM_CalcTalentMAP43(ctx({ ...data, CharacterClass_1: 7 }, {}, REAL, { chars: 2 }), 3)).toBe(0); // no class 3..5 character
  });

  it("the MinEff and ChopEff bubbles times getLOG of max HP / max MP (@4483715, @4484031), stated as assumed", () => {
    const cauldron = [[0, 0, 3], [], [0, 0, 4], []];
    const data = { CauldronInfo: cauldron, CauldronBubbles: [[]], Cards1: [], CharacterClass_0: 1, KLA_0: [] };
    const seeds = { 'CauldronStats["BubbleBonus",0,2,0]': 50, 'CauldronStats["BubbleBonus",2,2,0]': 20, "PlayerHPmax[]": 1000, "PlayerMPmax[]": 100 };
    const c = ctx(data, seeds, ["DNSM.AlchBubbles", "getLOG"], { trace: true });
    expect(DNSM_AlchBubbles(c, "MinEff")).toBeCloseTo(50 * LOG(1000), 12);
    expect(DNSM_AlchBubbles(c, "ChopEff")).toBeCloseTo(20 * LOG(100), 12);
    expect(find(c.trace!, (n) => /^assumed: /.test(n.note ?? "") && /HP/.test(n.note ?? ""))).toBeDefined();
  });
});

describe("the other blocks' new sub-cases", () => {
  it('RiftStuff("RiftSkillBonus,3", 1) (@10796299): fishing\'s account rank above 1, from Rift 15', () => {
    const lv = (n: number) => ({ Lv0_0: [100, 0, 0, 0, n] });
    expect(RiftStuff(ctx({ Rift: [15], ...lv(400) }, {}, ["RiftStuff"]), "RiftSkillBonus,3", 1)).toBe(1);
    expect(RiftStuff(ctx({ Rift: [15], ...lv(199) }, {}, ["RiftStuff"]), "RiftSkillBonus,3", 1)).toBe(0);
    expect(RiftStuff(ctx({ Rift: [14], ...lv(400) }, {}, ["RiftStuff"]), "RiftSkillBonus,3", 1)).toBe(0);
  });

  it('RiftStuff("RiftSkillETC", 2) (@10796692): 7 + 5 per skill rank above 4, skills 0, 2, 3, 5, 6 and 8 left out', () => {
    const c = ctx({}, { 'RiftStuff["RiftSkillBonus,1",4]': 1, 'RiftStuff["RiftSkillBonus,2",4]': 1, 'RiftStuff["RiftSkillBonus,17",4]': 1 }, ['RiftStuff["RiftSkillETC"']);
    expect(RiftStuff(c, "RiftSkillETC", 2)).toBe(7 + 5 + 5);
  });

  it('Summoning("TomeBonus", 1) (@10911815): 4 x floor(max(0, Tome - 4000) / 100)^.7 x the Grimoire/Troll boost while OLA[196] is 1', () => {
    const seeds = { "DNSM.TomeQTYtot[]": 9000, 'Summoning["GrimoireUpgBonus",17,0]': 10, 'GetSetBonus["TROLL_SET","Bonus",0,0]': 5 };
    expect(Summoning(ctx({ OptLacc: ola({ 196: 1 }) }, seeds, ['Summoning["TomeBonus"']), "TomeBonus", 1, 0)).toBeCloseTo(4 * Math.pow(50, 0.7) * 1.15, 12);
    expect(Summoning(ctx({ OptLacc: ola({ 196: 0 }) }, seeds, ['Summoning["TomeBonus"']), "TomeBonus", 1, 0)).toBe(0);
  });

  it("GetBuffBonuses(40, 2) (@4279371): talent 40's second curve while its buff runs", () => {
    expect(GetBuffBonuses(ctx({ BuffsActive_0: [[40, 100, 200]] }, { "Dungon[]": -1, "GetTalentNumber[2,40]": 12 }, ["GetBuffBonuses"]), 40, 2)).toBe(12);
    expect(GetBuffBonuses(ctx({ BuffsActive_0: [] }, { "Dungon[]": -1, "GetTalentNumber[2,40]": 12 }, ["GetBuffBonuses"]), 40, 2)).toBe(0);
  });

  it('Divinity("BlesssBonus", 2) (@10758393): the blessing times min(1.8, max(.1, 4 x (.01 x (DN + 1e4) / max(10 DN + 10, 1))^2))', () => {
    const seeds = { 'SkillStats["AllEfficiencies"]': 2, 'DNSM.AlchBubbles["MinEff"]': 300, 'DNSM.AlchBubbles["ChopEff"]': 100, 'TotalStats["STR"]': 300, 'TotalStats["AGI"]': 300, 'TotalStats["WIS"]': 300 };
    const div = (lv: number) => Object.assign(Array<number>(40).fill(0), { 30: lv });
    const dn = Math.max(1, 2 + Math.pow(400 / 100, 2) + Math.pow(900 / 3, 0.5) / 7);
    const want = 3 * asNumber((GodsInfo as unknown as readonly (readonly unknown[])[])[2][14]) * Math.min(1.8, Math.max(0.1, 4 * Math.pow(0.01 * ((dn + 1e4) / Math.max(10 * dn + 10, 1)), 2)));
    expect(Divinity(ctx({ Divinity: div(3) }, seeds, ["Divinity"]), "BlesssBonus", 2, 0)).toBeCloseTo(want, 12);
    expect(Divinity(ctx({ Divinity: div(0) }, seeds, ["Divinity"]), "BlesssBonus", 2, 0)).toBe(0);
  });

  it("MainframeBonus 111, 114, 115 (@7990420): the jewel times bonus 8; 114 then times floor((kitchen levels + .5) / 25) (TalentCalc(-7) @4512086); 112 doubled when 111, 113, 114 and 115 are on (@7993392)", () => {
    const jewel = (j: number) => asNumber((JewelDesc as unknown as readonly (readonly unknown[])[])[j][12]);
    const lab = (owned: number[]) => Object.assign(Array<unknown>(20).fill([]), { 14: Object.assign(Array<number>(30).fill(0), Object.fromEntries(owned.map((j) => [j, 1]))) });
    const kitchen = (a: number) => [[1, 0, 0, 0, 0, 0, a, 2, 3], [0]];
    const mf = (owned: number[], cook: number) => ctx({ Lab: lab(owned), Cooking: kitchen(cook) }, { "MainframeBonus[8]": 2 }, ["MainframeBonus"]);
    const all = mf([11, 12, 13, 14, 15], 45); // 45 + 2 + 3 = 50 kitchen levels: floor(50.5 / 25) = 2
    expect(MainframeBonus(all, 111)).toBe(jewel(11) * 2);
    expect(MainframeBonus(all, 115)).toBe(jewel(15) * 2);
    expect(MainframeBonus(all, 114)).toBe(jewel(14) * 2 * 2);
    expect(MainframeBonus(all, 112)).toBe(2 * jewel(12) * 2);
    expect(MainframeBonus(mf([11, 12, 13, 15], 45), 112)).toBe(jewel(12) * 2); // 114 not owned
    // under 25 kitchen levels the stored 114 is 0, but 112 checks 114 before TalentCalc(-7) multiplies it
    const low = mf([11, 12, 13, 14, 15], 5);
    expect(MainframeBonus(low, 114)).toBe(0);
    expect(MainframeBonus(low, 112)).toBe(2 * jewel(12) * 2);
  });

  it("CardBonusREAL(30), a fishing key: every Fishing card's CardLv x row[4] with Rift skill bonus 3 (@4502652, @4506958), else the equipped cards", () => {
    const lv = { 'RunCodeOfTypeXforThingY["CardLv","Fish2"]': 2, 'RunCodeOfTypeXforThingY["CardLv","Fish5"]': 3, 'RunCodeOfTypeXforThingY["CardLv","Fish10"]': 1 };
    const cards = { CardEquip_0: ["Fish5", "B", "B", "B", "B", "B", "B", "B", "B", "B"] };
    // the table (CardStuff): Fish2 5, Fish5 8, Fish10 12 per level
    expect(CardBonusREAL(ctx(cards, { ...lv, 'RiftStuff["RiftSkillBonus,3",2]': 1 }, ["CardBonusREAL"]), 30)).toBe(2 * 5 + 3 * 8 + 1 * 12);
    expect(CardBonusREAL(ctx(cards, { ...lv, 'Thingies["LegendPTS_bonus",21,0]': 10 }, ["CardBonusREAL"]), 30)).toBeCloseTo(1.1 * 3 * 8, 12);
  });

  it('Thingies("FriendBonusStatz", 2) (@10960432): the friend with stat 2', () => {
    const seeds = { 'Thingies["FriendBonusSlots",0,0]': 5, 'Thingies["FriendBonusQTY",2,50]': 7, 'Thingies["FriendBonusQTY",3,10]': 9, 'Thingies["FriendBonusXtraMulti",0,0]': 1.5 };
    expect(Thingies(ctx({ OptLacc: ola({ 476: "2,50;3,10" }) }, seeds, ['Thingies["FriendBonusStatz"']), "FriendBonusStatz", 2, 0)).toBe(7 * 1.5);
  });

  it('Holes("B_UPG", 49, 15) (@10997439): 15 x (Holes[11][1] + [3] x B_UPG 50 + [5] x B_UPG 79 + [7] x B_UPG 98); those three are their `e`', () => {
    const holes = (bought: number[]) => Object.assign(Array<unknown>(20).fill([]), { 11: [0, 1, 0, 2, 0, 3, 0, 4], 13: Object.assign(Array<number>(100).fill(0), Object.fromEntries(bought.map((b) => [b, 1]))) });
    const c = ctx({ Holes: holes([49, 50, 79, 98]) }, {}, ["Holes"]);
    expect(Holes(c, "B_UPG", 50, 1)).toBe(1);
    expect(Holes(c, "B_UPG", 79, 1)).toBe(1);
    expect(Holes(c, "B_UPG", 98, 1)).toBe(1);
    expect(Holes(c, "B_UPG", 49, 15)).toBe(15 * (1 + 2 + 3 + 4));
    expect(Holes(ctx({ Holes: holes([49, 79]) }, {}, ["Holes"]), "B_UPG", 49, 15)).toBe(15 * (1 + 3));
  });
});
