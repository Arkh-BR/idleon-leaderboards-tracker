// The talent rows of the Drop Rate V1 tree (lib/dropRate/explain/talent.ts) on a synthetic save: every block is a seed (ZeroCache), so the numbers below are worked out by hand.
import { describe, expect, it } from "vitest";
import type { ArkhNode } from "@/lib/dropRate/node";
import { EXPLAINERS } from "@/lib/dropRate/explain";
import { talentLevelRows } from "@/lib/dropRate/explain/talent";
import { type Data, type Seeds, synth } from "../../game/support/expStub";

const kid = (n: ArkhNode | undefined, name: string): ArkhNode => {
  const k = n?.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n?.name}": ${n?.children?.map((c) => c.name)}`);
  return k;
};
const names = (n: ArkhNode) => n.children!.map((c) => c.name);
const rowOf = (rows: ArkhNode[], name: string) => kid({ name: "", val: 0, children: rows }, name);

// the Max Book Lv Cap, by hand: round(125 + 175 + 89.271 + 10 + 5 + 20 + 10) = 434
const CAP: Seeds = { 'Sailing["ArtifactBonus",21,0]': 175, 'Summoning["WinBonus",19,0]': 89.271, 'AchieveStatus[145]': 1, "SaltLick[4]": 20 };
const SAVE: Data = {
  Atoms: Object.assign(Array<number>(8).fill(0), { 7: 72 }),
  SaltLick: Object.assign(Array<number>(6).fill(0), { 4: 10 }),
  TaskZZ2: [[], [], [0, 0, 5]],
  Sailing: [[], [], [], Object.assign(Array<number>(40).fill(0), { 21: 7 })],
  Summon: [[], []],
  GemItemsPurchased: Array<number>(20).fill(0),
  PlayerStuff_0: [0, 0],
  Spelunk: Array.from({ length: 60 }, () => [] as number[]),
  Dream: Object.assign(Array<number>(20).fill(0), { 12: 10 }),
  SL_0: {},
};
const ctx = (data: Data = {}, seeds: Seeds = {}, o: { chars?: number; player?: number; real?: string[] } = {}) => synth({ ...SAVE, ...data }, { seeds: { ...CAP, ...seeds }, ...o });

describe("a talent the character has no level in", () => {
  const rows = talentLevelRows(ctx(), 279);
  const eff = rowOf(rows, "Effective Level");
  it("is inactive and still says the levels it would read", () => {
    expect(rows.map((r) => r.name)).toEqual(["Active", "Effective Level"]);
    expect(rows[0]).toEqual({ name: "Active", val: 0, fmt: "raw" });
    expect(eff).toMatchObject({ val: 10, fmt: "raw", note: "Base + Bonus" }); // Dream[12], the only bonus level set
    expect(names(eff)).toEqual(["Base Level", "Bonus Levels"]);
    expect(kid(eff, "Base Level")).toMatchObject({ val: 0, fmt: "raw", note: "min(invested, cap) — owner: c0" });
    expect(kid(kid(eff, "Base Level"), "Points Invested")).toEqual({ name: "Points Invested", val: 0, fmt: "raw", note: "actual save — owner: c0" });
    expect(kid(eff, "Bonus Levels")).toMatchObject({ val: 10, fmt: "+" });
    expect(kid(eff, "Bonus Levels").note).toBeUndefined();
  });
  it("lists only the bonus rows that give levels", () => {
    expect(names(kid(eff, "Bonus Levels"))).toEqual(["Equinox Symbols (Dream 10)"]);
    const equinox = kid(kid(eff, "Bonus Levels"), "Equinox Symbols (Dream 10)");
    expect(equinox).toMatchObject({ val: 10, fmt: "raw" });
    expect(names(equinox)).toEqual(["Base Max", "Summoning WinBonus 24", "SuperBit 35 (×10)", "Cloud 30 (×4)"]);
    expect(kid(equinox, "Base Max")).toEqual({ name: "Base Max", val: 5, fmt: "raw", note: "DreamUpg[10][2] game constant" });
  });
  it("the book cap's rows are the game's sum (WorkbenchStuff maxBookLv)", () => {
    const cap = kid(kid(eff, "Base Level"), "Max Book Lv Cap");
    expect(cap).toMatchObject({ val: 434, fmt: "raw", note: "N.js maxBookLv" });
    expect(cap.children!.map((c) => [c.name, c.val])).toEqual([
      ["Base Level (N.js literal)", 100],
      ["Talent Book Library Base", 25],
      ["Salt Lick 4", 20],
      ["W3 Merit Shop Unlock", 10],
      ["Checkout Takeout Achievement", 5],
      ["Lv 1 Oxygen Atom", 10],
      ["Sovereign Fury Relic", 175],
      ["Summoning Winner Bonus 19", 89.271],
    ]);
    expect(kid(cap, "Salt Lick 4").children).toEqual([{ name: "Salt Lick 4 Lv", val: 10, fmt: "raw" }, { name: "Per Lv", val: 2, fmt: "raw" }]);
    expect(kid(cap, "W3 Merit Shop Unlock").children).toEqual([{ name: "W3 Merit Points Spent", val: 5, fmt: "raw" }, { name: "Per Point", val: 2, fmt: "raw" }]);
    expect(kid(cap, "Lv 1 Oxygen Atom").children).toEqual([{ name: "Atom 7 Lv", val: 72, fmt: "raw" }]);
    expect(kid(cap, "Sovereign Fury Relic").children).toEqual([{ name: "Artifact 21 Base", val: 25, fmt: "raw" }, { name: "Artifact 21 Tier", val: 7, fmt: "raw" }]);
  });
});

describe("Winner Bonus 19's battles", () => {
  it("each one by its place in its world, beaten or not", () => {
    const eff = rowOf(talentLevelRows(ctx({ Summon: [[], ["w6d3"]] }), 279), "Effective Level");
    const battles = kid(kid(kid(kid(eff, "Base Level"), "Max Book Lv Cap"), "Summoning Winner Bonus 19"), "Summoning Battles");
    expect(battles).toMatchObject({ val: 10.5, note: "3 raw × 3.5× Base = 10.50  →  then × 1.00× Higher Bonus × 1.00× Winner = 89.27" });
    expect(kid(battles, "Cyan").children).toEqual([{ name: "Battle 14", val: 10.5, fmt: "raw", note: "1 kill × 3 per kill × 3.5 base = 10.5" }]);
    expect(kid(battles, "Teal").children).toEqual([{ name: "Battle 9", val: 0, fmt: "raw", note: "not yet defeated — would give 1 × 3.5 = 3.5" }]);
  });
});

describe("Winner Multi (combined)", () => {
  const multi = (seeds: Seeds) => {
    const cap = kid(kid(rowOf(talentLevelRows(ctx({}, seeds), 279), "Effective Level"), "Base Level"), "Max Book Lv Cap");
    return kid(kid(cap, "Summoning Winner Bonus 19"), "Winner Multi (combined)");
  };
  it("lists the bundle's 50 as a row, and its children sum to the multi, only for an owner", () => {
    const sum = (r: ReturnType<typeof multi>) => 1 + r.children!.reduce((a, c) => a + c.val, 0) / 100;
    const owner = multi({ 'Thingies["Have_ban_i",0,0]': 1 });
    expect(owner.children!.find((c) => c.name === "Bundle ban_i")).toMatchObject({ val: 50, fmt: "raw" });
    expect(sum(owner)).toBeCloseTo(owner.val, 9);
    const none = multi({});
    expect(none.children!.some((c) => c.name === "Bundle ban_i")).toBe(false);
    expect(sum(none)).toBeCloseTo(none.val, 9);
  });
});

describe("a talent at the book cap", () => {
  it("Base Level stops at the cap, Points Invested is what the save has", () => {
    const eff = rowOf(talentLevelRows(ctx({ SL_0: { 279: 500 } }), 279), "Effective Level");
    expect(eff.val).toBe(510); // the level the game reads: 500 + 10
    expect(kid(eff, "Base Level").val).toBe(434);
    expect(kid(kid(eff, "Base Level"), "Points Invested").val).toBe(500);
    expect(rowOf(talentLevelRows(ctx({ SL_0: { 279: 500 } }), 279), "Active").val).toBe(1);
  });
  it("a bonus level the game gives from another talent carries that talent's own Base Level", () => {
    const eff = rowOf(talentLevelRows(ctx({ SL_0: { 279: 1, 149: 40 } }, { "GetTalentNumber[1,149]": 3 }), 279), "Effective Level");
    const symbols = kid(kid(eff, "Bonus Levels"), "Symbols of Beyond ~R (Talent 149)");
    expect(symbols).toMatchObject({ val: 3, fmt: "raw", note: "intervalAdd(1,20,40)" });
    expect(kid(symbols, "Base Level").val).toBe(40);
    expect(eff.val).toBe(1 + 13);
  });
});

describe("a bonus that depends on the class", () => {
  const LEVELS = { Lv0_0: [1923], Lv0_1: [1000], Lv0_2: [1923], CharacterClass_0: 34, CharacterClass_1: 16, CharacterClass_2: 34, SL_0: { 279: 1 }, SL_1: { 279: 1 }, SL_2: { 279: 1 }, PlayerStuff_1: [0, 0], PlayerStuff_2: [0, 0] };
  const seeds = { 'DNSM.FamBonusQTYs["68"]': 16.7, "FamilyBonsuesREAL[34,0,1923]": 12 };
  const row = (player: number) => {
    const rows = talentLevelRows(ctx(LEVELS, seeds, { chars: 3, player }), 279);
    return kid(rowOf(rows, "Effective Level"), "Bonus Levels").children?.find((c) => c.name === "Family Bonus 68 (Mage)");
  };
  it("Family Bonus 68 is the block's number and lists the classes that give it", () => {
    const r = row(1)!;
    expect(r).toMatchObject({ val: 16, fmt: "raw", note: "floor(decay × Family Guy Multi if active)" }); // floor of the seed
    expect(kid(r, "Best Mage Lv")).toMatchObject({ val: 1923, note: "max across account — 2 mage chars" });
    expect(names(kid(r, "Best Mage Lv"))).toEqual(["Char 0 Lv", "Char 2 Lv"]);
    expect(kid(kid(r, "Best Mage Lv"), "Char 0 Lv")).toEqual({ name: "Char 0 Lv", val: 1923, fmt: "raw", note: "c0 — elemental sorcerer (cls 34)" });
  });
  it("the character who holds the value gets the buff; a second one on the same level does not", () => {
    const talent = { ...LEVELS, SL_0: { 144: 50 }, SL_2: { 144: 50 } };
    const buffed = (player: number) => kid(rowOf(talentLevelRows(ctx(talent, seeds, { chars: 3, player, real: ["ArbitraryCode5Inputs"] }), 144), "Effective Level"), "Bonus Levels").children!.find((c) => c.name === "Family Bonus 68 (Mage)")!;
    expect(buffed(0).note).toBe("floor(decay × Family Guy Multi if active) — buffed by The Family Guy (Talent 144)");
    expect(buffed(2).note).toBe("floor(decay × Family Guy Multi if active)");
    expect(kid(buffed(0), "Family Guy Multi (×) — potential buff").val).toBeCloseTo(1 + (40 * 72) / 172 / 100, 12); // decay(40,100,50 + 12 + 10): the family bonus 68 and Dream[12]
  });
  it("Family Guy Multi: Base + Bonus, the cap is the book's with its notes", () => {
    const talent = { ...LEVELS, SL_1: { 144: 7 } };
    const m = kid(row2(talent), "Family Guy Multi (×) — potential buff");
    expect(names(m)).toEqual(["Base Level", "Bonus Levels"]);
    expect(kid(m, "Base Level")).toMatchObject({ val: 7, note: "min(invested, cap)" });
    expect(kid(kid(m, "Base Level"), "Points Invested")).toEqual({ name: "Points Invested", val: 434, fmt: "raw", note: "save=7" });
    expect(kid(kid(kid(m, "Base Level"), "Max Book Lv Cap"), "Salt Lick 4").note).toBe("Lv × Per Lv");
    expect(kid(m, "Bonus Levels")).toEqual({ name: "Bonus Levels", val: 22, fmt: "+", note: "Σ ATL (unbuffed FB68, excl. super)" }); // 12 of the family bonus + Dream[12] 10
  });
  const row2 = (data: Data) =>
    kid(rowOf(talentLevelRows(ctx(data, seeds, { chars: 3, player: 1, real: ["ArbitraryCode5Inputs"] }), 144), "Effective Level"), "Bonus Levels").children!.find((c) => c.name === "Family Bonus 68 (Mage)")!;
});

describe("the other shapes", () => {
  it("a super talent on the current preset is a row of its own; on the other preset it is not", () => {
    const sp = (i: number) => Array.from({ length: 60 }, (_, k) => (k === i ? [279] : ([] as number[])));
    const seeds = { 'Thingies["SuperTalentPTS_LVgiven",0,0]': 125, 'Thingies["LegendPTS_bonus",7,0]': 50, 'Thingies["ZenithMarketBonus",5,0]': 25 };
    const eff = (i: number, preset: number) => rowOf(talentLevelRows(ctx({ Spelunk: sp(i), PlayerStuff_0: [0, preset], SL_0: { 279: 1 } }, seeds), 279), "Effective Level");
    const on = kid(kid(eff(20, 0), "Bonus Levels"), "Spelunk Super Talent");
    expect(on).toMatchObject({ val: 125, fmt: "raw" });
    expect(names(on)).toEqual(["Base", "Super Duper Talents (Yellow 2)", "Zenith Super Dupers"]);
    expect(kid(on, "Base").val).toBe(50);
    expect(eff(20, 0).val).toBe(1 + 10 + 125);
    expect(names(kid(eff(32, 0), "Bonus Levels"))).toEqual(["Equinox Symbols (Dream 10)"]); // preset 1's list, the character on preset 0
    expect(kid(eff(32, 1), "Bonus Levels").val).toBe(135);
  });

  it("a banned talent has no bonus levels", () => {
    const eff = rowOf(talentLevelRows(ctx({ SL_0: { 505: 3 } }, { 'RunCodeOfTypeXforThingY["TalentBannedforAllLV","505"]': 1 }), 505), "Effective Level");
    expect(eff.val).toBe(3);
    expect(kid(eff, "Bonus Levels").children).toBeUndefined();
  });

  it("a star talent: level and max, no book", () => {
    const rows = talentLevelRows(ctx({ SL_0: { 655: 80 }, SM_0: { 655: 100 } }), 655);
    expect(rows).toEqual([
      { name: "Active", val: 1, fmt: "raw" },
      { name: "Level", val: 80, fmt: "raw", note: "star talent — pool capped, no book lv" },
      { name: "Max Level", val: 100, fmt: "raw", note: "star talent cap (account SkillLevelsMAX)" },
    ]);
    expect(talentLevelRows(ctx({ SL_0: {} }), 655).map((r) => r.name)).toEqual(["Active", "Level"]);
  });

  it("the Royal Guardian tab caps the bonus levels at Armory 55, the super levels on top", () => {
    const eff = (talent: number) => rowOf(talentLevelRows(ctx({ SL_0: { [talent]: 1 } }, { 'RoyalG["ArmoryUpgBonus",55,0]': 4 }), talent), "Effective Level");
    const capped = kid(eff(239), "Bonus Levels");
    expect(capped.val).toBe(4);
    expect(kid(capped, "Royal Armory cap (Armory 55 — Talent Reattainment)")).toEqual({
      name: "Royal Armory cap (Armory 55 — Talent Reattainment)", val: -6, fmt: "raw", note: "All Talent LV bonuses reach Royal Guardian talents only up to 4 (was 10); super-talent levels are not capped",
    });
    expect(kid(eff(279), "Bonus Levels").val).toBe(10); // the cap is the talents 225..239's
  });

  it("the best character: Reference Character, and its own super preset", () => {
    const sp = Array.from({ length: 60 }, (_, k) => (k === 20 + 1 + 12 ? [328] : ([] as number[])));
    const seeds = { 'RunCodeOfTypeXforThingY["AllTalentLVz","328|0"]': 10, 'RunCodeOfTypeXforThingY["AllTalentLVz","328|1"]': 135, 'Thingies["SuperTalentPTS_LVgiven",0,0]': 125 };
    const rows = talentLevelRows(ctx({ Spelunk: sp, SL_0: { 328: 400 }, SL_1: { 328: 400 } }, seeds, { chars: 2, real: ["ArbitraryCode5Inputs"] }), 328, { best: true });
    expect(rows.map((r) => r.name)).toEqual(["Effective Level"]);
    const eff = rows[0];
    expect(eff).toEqual(expect.objectContaining({ val: 535, fmt: "raw" }));
    expect(eff.note).toBeUndefined();
    expect(kid(eff, "Base Level").note).toBe("min(invested, cap) — owner: c1");
    expect(names(kid(eff, "Base Level"))).toEqual(["Reference Character: c1", "Points Invested", "Max Book Lv Cap"]);
    expect(kid(kid(eff, "Bonus Levels"), "Spelunk Super Talent").val).toBe(125);
  });

  it("the best character when nobody has the talent: the Reference Character row alone", () => {
    const rows = talentLevelRows(ctx({ SL_0: {} }, {}, { real: ["ArbitraryCode5Inputs"] }), 328, { best: true });
    expect(rows).toEqual([{ name: "Reference Character: Char -1", val: 0, fmt: "raw" }]);
  });
});

describe("the sources", () => {
  it("talent 655: the star rows, then what it multiplies", () => {
    const rows = EXPLAINERS.talent655(ctx({ SL_0: { 655: 100 }, SM_0: { 655: 100 }, OptLacc: Object.assign(Array<number>(700).fill(0), { 189: 5 }) }, { "GetTalentNumber[1,655]": 12.5 }), 62.5);
    expect(rows.map((r) => [r.name, r.val])).toEqual([["Active", 1], ["Level", 100], ["Max Level", 100], ["Per Skull", 12.5], ["Skulls Beaten", 5]]);
    expect(rows[4].note).toBe("OLA[189] — count of skulls beaten");
  });

  it("talent 239: the talent, then the grades", () => {
    const rows = EXPLAINERS.talent239(ctx({ SL_0: { 239: 1 } }, { "GetTalentNumber[1,239]": 2, 'RoyalG["TotalStatz",0,0]': 7, 'RoyalG["ArmoryUpgBonus",55,0]': 9 }), 14);
    expect(rows.map((r) => r.name)).toEqual(["Graded Rate (Talent 239)", "Total Resource Grades"]);
    expect(rows[0]).toMatchObject({ val: 2, fmt: "+", note: "decay(3,500,10)" }); // level 1 + the 10 bonus levels (Dream[12]) capped at the Armory's 9
    expect(rows[1]).toEqual({ name: "Total Resource Grades", val: 7, fmt: "raw", note: "Σ RoyalG[5] — every resource node's Grade, all worlds" });
  });

  it("talent 328 (the Workbench): the best character's levels, the value, the kills", () => {
    const rows = EXPLAINERS.workbench(ctx({ SL_0: { 328: 1 }, OptLacc: Object.assign(Array<number>(700).fill(0), { 139: 1000 }) }, { 'getbonus2[1,328,-1]': 6.5, 'RunCodeOfTypeXforThingY["AllTalentLVz","328|0"]': 0 }, { real: ["ArbitraryCode5Inputs"] }), 1.195);
    expect(rows.map((r) => r.name)).toEqual(["Effective Level", "Talent Value", "Plunderous Kills"]);
    expect(rows[1]).toEqual({ name: "Talent Value", val: 6.5, fmt: "raw", note: "formula(effective_lv) — coefficient" });
    expect(rows[2]).toEqual({ name: "Plunderous Kills", val: 1000, fmt: "raw", note: "OLA[139] — kills of plunderous mobs" });
  });
});

describe("a row the save cannot answer", () => {
  it("is a noted leaf, never the page's error", () => {
    const { Atoms: _a, ...noAtoms } = SAVE;
    const c = synth({ ...noAtoms, SL_0: { 279: 500 } }, { seeds: CAP });
    const eff = rowOf(talentLevelRows(c, 279), "Effective Level");
    const cap = kid(kid(eff, "Base Level"), "Max Book Lv Cap");
    expect(cap.val).toBe(0);
    expect(cap.note).toMatch(/^not read: /);
    expect(kid(eff, "Base Level").val).toBe(500); // no cap to apply
  });
  it("the Bonus Levels keep the rows that did read", () => {
    const { Spelunk: _s, ...noSpelunk } = SAVE;
    const c = synth({ ...noSpelunk, SL_0: { 279: 1 } }, { seeds: CAP });
    const bonus = kid(rowOf(talentLevelRows(c, 279), "Effective Level"), "Bonus Levels");
    expect(names(bonus)).toEqual(["Spelunk Super Talent", "Equinox Symbols (Dream 10)"]);
    expect(kid(bonus, "Spelunk Super Talent").note).toMatch(/^not read: /);
    expect(bonus.val).toBe(10);
  });
});
