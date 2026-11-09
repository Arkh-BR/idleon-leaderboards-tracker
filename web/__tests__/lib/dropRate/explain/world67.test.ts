// The farming, Holes and late-world rows of the Drop Rate V1 tree (lib/dropRate/explain/world67.ts). On a synthetic save every block is a seed (ZeroCache), so the numbers are worked out by hand; on the newest real save the tree matches
// lib/arkh's path by path (user decision 09/11: the newest saves only; loaded inside `it`).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES, goldenSaves } from "../../game/support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareV1, PENDING } from "../../game/support/v1Compare";
import { newestSaves } from "@/lib/diagnose/characterize";
import type { ArkhNode } from "@/lib/dropRate/node";
import { EXPLAINERS } from "@/lib/dropRate/explain";
import { talentLevelRows } from "@/lib/dropRate/explain/talent";
import { AlchemyDescription } from "@/lib/game/data";
import { type Data, type Seeds, synth } from "../../game/support/expStub";

const WORLD67 = ["rank9", "cropSC7", "exotic59", "hole46", "hole82", "meas15", "monument", "caveDR", "grimoire44", "spelunk50", "legend1", "emperor11", "grid173", "glimbo", "minehead0", "menagerie24", "pristine3", "rog", "vial"];
const kid = (n: ArkhNode | undefined, name: string): ArkhNode => {
  const k = n?.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n?.name}": ${n?.children?.map((c) => c.name)}`);
  return k;
};
const names = (rows: ArkhNode[]) => rows.map((r) => r.name);
const at = (rows: ArkhNode[], name: string) => kid({ name: "", val: 0, children: rows }, name);
const lists = (n: number, set: Record<number, unknown[]>) => Array.from({ length: n }, (_, i) => set[i] ?? []);
const filled = (n: number, set: Record<number, number>) => Object.assign(Array<number>(n).fill(0), set);
const optLacc = (set: Record<number, number>) => filled(700, set);
const ctx = (data: Data = {}, seeds: Seeds = {}) => synth({ Spelunk: lists(60, {}), Research: lists(60, {}), Holes: lists(30, {}), ...data }, { seeds });
const run = (id: string, c: ReturnType<typeof ctx>, val = 0) => EXPLAINERS[id](c, val);

describe("every source of the family has rows", () => {
  it("is registered", () => {
    for (const id of WORLD67) expect(EXPLAINERS[id], id).toBeTypeOf("function");
    for (const id of WORLD67) expect(PENDING.has(id), id).toBe(false);
  });
});

describe("farming", () => {
  // the talent 207 rows read the characters' talents and the book cap (talent.test.ts builds them the same way)
  const TALENTS = { Atoms: filled(8, { 7: 72 }), SaltLick: filled(6, { 4: 10 }), TaskZZ2: [[], [], [0, 0, 5]], Sailing: [[], [], [], filled(40, { 21: 7 })], Summon: [[], []], GemItemsPurchased: filled(20, {}), PlayerStuff_0: [0, 0], Dream: filled(20, { 12: 10 }), SL_0: {} };
  const rankData = { ...TALENTS, FarmRank: [[], [], filled(20, { 9: 76 })], FarmUpg: filled(100, { 34: 11857, 60: 9900, 79: 1000 }), Spelunk: lists(60, { 50: [14] }) };
  it("the crop rank: level x ninja base, the best talent 207 and Exotic 14", () => {
    const rows = run("rank9", ctx(rankData, { "getbonus2[1,207,-1]": 2.6, 'FarmingStuffs["ExoticBonusQTY",14,0]': 100 }));
    expect(names(rows)).toEqual(["Rank Level", "Ninja Base", "Dank Ranks (Talent 207)", "Pommelyon Seed (Exotic 14) Bonus"]);
    expect(rows[0]).toEqual({ name: "Rank Level", val: 76, fmt: "raw" });
    expect(rows[1]).toEqual({ name: "Ninja Base", val: 10, fmt: "raw" });
    expect(rows[2]).toMatchObject({ val: 2.6, fmt: "+" });
    expect(rows[2].children).toEqual(talentLevelRows(ctx(rankData), 207, { best: true })); // the chain itself is talent.test.ts's
    expect(rows[3]).toEqual({ name: "Pommelyon Seed (Exotic 14) Bonus", val: 2, fmt: "x", note: "Level 11857 · Menagerie doubler ×2" });
  });
  it("has no rows while the rank is 0", () => {
    expect(run("rank9", ctx({ ...rankData, FarmRank: [[], [], filled(20, {})] }))).toEqual([]);
  });

  const crops = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`crop${i}`, 1]));
    const depot = { FarmCrop: crops, FarmUpg: rankData.FarmUpg };
  const owned: Seeds = { 'Ninja["EmporiumBonus",38,0]': 1 };
  it("the crop depot: the crops past 100 and the scientist's multi, term by term", () => {
    const rows = run(
      "cropSC7",
      ctx(depot, { ...owned, 'FarmingStuffs["CropSCbonMulti",0,0]': 2.5, "MainframeBonus[17]": 46, 'Summoning["GrimoireUpgBonus",22,0]': 10, 'FarmingStuffs["ExoticBonusQTY",40,0]': 30, 'Summoning["VaultUpgBonus",79,0]': 20 })
    );
    expect(names(rows)).toEqual(["Crop Count", "Excess", "Multi"]);
    expect(rows[0].val).toBe(130);
    expect(rows[1]).toEqual({ name: "Excess", val: 30, fmt: "raw", note: "crops - 100" });
    expect(rows[2]).toMatchObject({ val: 2.5, fmt: "x" });
    expect(rows[2].children!.map((r) => [r.name, r.val, r.note])).toEqual([
      ["Depot Studies PhD (Mainframe 17)", 46, undefined],
      ["Superior Crop Research (Grimoire 22)", 10, undefined],
      ["Scienterrific (Exotic 40)", 30, "Level 9900"],
      ["Properly Funded Research (Vault 79)", 20, undefined],
    ]);
  });
  it("says so while the Emporium item is not owned, and has no rows with no crop past 100", () => {
    expect(run("cropSC7", ctx(depot))).toEqual([{ name: "Emporium not unlocked", val: 0, fmt: "raw" }]);
    expect(run("cropSC7", ctx({ ...depot, FarmCrop: { a: 1 } }, owned))).toEqual([]);
  });

  it("Pommelion Seed: the curve at the level, before the Menagerie doubler", () => {
    const doubled = run("exotic59", ctx({ ...rankData, Spelunk: lists(60, { 50: [59] }) }), 25);
    expect(doubled).toEqual([
      { name: "Level", val: 1000, fmt: "raw" },
      { name: "Formula Result", val: 12.5, fmt: "raw", note: "decay(25,1000,1000)" },
      { name: "Menagerie Exotic Doubler", val: 2, fmt: "x", note: "doubler placed (Spelunk[50])" },
    ]);
    expect(at(run("exotic59", ctx(rankData), 12.5), "Menagerie Exotic Doubler")).toEqual({ name: "Menagerie Exotic Doubler", val: 1, fmt: "x", note: "no doubler" });
    expect(run("exotic59", ctx({ ...rankData, FarmUpg: filled(100, {}) }))).toEqual([]);
  });
});

describe("the Holes", () => {
  const holes = (set: Record<number, Record<number, number>>) => lists(30, Object.fromEntries(Object.entries(set).map(([k, v]) => [k, filled(100, v)])));
  it("the cavern upgrades: the level in its slot times the value per level", () => {
    const c = ctx({ Holes: holes({ 13: { 46: 1, 82: 1 }, 11: { 26: 20, 55: 43 } }) });
    expect(run("hole46", c)).toEqual([{ name: "Level", val: 20, fmt: "raw" }, { name: "Multiplier", val: 5, fmt: "x" }]);
    expect(run("hole82", c)).toEqual([{ name: "Level", val: 43, fmt: "raw" }, { name: "Multiplier", val: 20, fmt: "x" }]);
  });
  it("says so while the upgrade is not built", () => {
    expect(run("hole46", ctx({ Holes: holes({ 13: { 46: 0 }, 11: { 26: 20 } }) }))).toEqual([{ name: "Not built", val: 0, fmt: "raw" }]);
  });

  it("the measurement: base bonus (with the Cosmo upgrade) times the multi of its kind (10)", () => {
    const c = ctx(
      { Holes: holes({ 22: { 15: 299 }, 5: { 3: 4 } }) },
      { 'Holes["CosmoBonusQTY",1,3]': 100, 'Holes["MeasurementBaseBonus",15,0]': 75, 'Holes["MeasurementMulti",10,0]': 3.5, 'Holes["MeasurementQTYfound",10,0]': 5e14, 'Holes["MeasurementQTYfound",10,99]': 12.5 }
    );
    const rows = run("meas15", c);
    expect(rows.map((r) => [r.name, r.val, r.fmt, r.note])).toEqual([
      ["Measurement Level", 299, "raw", undefined],
      ["Cosmo Bonus", 100, "raw", "raw=4"],
      ["Cosmo Multiplier", 2, "x", undefined],
      ["Base Bonus", 75, "raw", "50×lv/(100+lv)×cosmo"],
      ["Meas Multi", 3.5, "x", "type 10"],
    ]);
    expect(rows[4].children).toEqual([
      { name: "Holes[11][63]", val: 5e14, fmt: "raw" },
      { name: "QTY (type 10)", val: 12.5, fmt: "raw", note: "max(0,log10(raw)-2)" },
    ]);
    expect(run("meas15", ctx({ Holes: holes({ 22: { 15: 0 } }) }))).toEqual([]);
  });

  it("the monument: its level and value, and the multiplier from the Wisdom monument, the Cosmo upgrade and the fountain", () => {
    const c = ctx(
      { Holes: holes({ 15: { 26: 66946, 29: 57510 }, 4: { 0: 4 } }) },
      { 'Holes["MonumentROGbonuses",2,9]': 311.2, 'Holes["CosmoBonusQTY",0,0]': 100, 'Holes2["Fountain_BonTOT",2,13]': 25 }
    );
    const rows = run("monument", c);
    expect(names(rows)).toEqual(["Monument Level", "Bonus Per Level", "Wisdom Multiplier"]);
    expect(rows[1].val).toBe(100);
    const multi = rows[2];
    expect(multi.val).toBeCloseTo((1 + 3.112 + 1) * 1.25, 12); // (1 + wisdom/100 + cosmo/100) x (1 + fountain/100)
    expect(multi.children).toEqual([
      { name: "Wisdom Monument", val: 311.2, fmt: "raw", note: "monument idx 29", children: [{ name: "Wisdom Level", val: 57510, fmt: "raw" }, { name: "Bonus Per Level", val: 250, fmt: "raw" }] },
      { name: "Cosmo Upgrade", val: 100, fmt: "raw", note: "cosmo 0/0", children: [{ name: "Cosmo Level", val: 4, fmt: "raw" }] },
      { name: "Fountain Wisdom Boost", val: 1.25, fmt: "x", note: "fountain[2][13]", children: [{ name: "fountainTotal(2,13)", val: 25, fmt: "+" }] },
    ]);
    expect(run("monument", ctx({ Holes: holes({ 15: { 26: 0 } }) }))).toEqual([]);
  });
});

describe("cards, Grimoire, Spelunking and the Legend talents", () => {
  it("the cave cards share the cap of 100", () => {
    const seeds = { 'RunCodeOfTypeXforThingY["CardLv","caveC"]': 3, 'RunCodeOfTypeXforThingY["CardLv","caveD"]': 5 };
    expect(run("caveDR", ctx({}, seeds), 42)).toEqual([{ name: "caveC (×4)", val: 12, fmt: "raw" }, { name: "caveD (×6)", val: 30, fmt: "raw" }, { name: "Uncapped", val: 42, fmt: "raw" }]);
    expect(at(run("caveDR", ctx({}, seeds), 100), "CAPPED (100)").val).toBe(100);
  });
  it("Grimoire 44: level x value, times 1 + upgrade 36 / 100", () => {
    const rows = run("grimoire44", ctx({ Grimoire: filled(60, { 44: 450, 36: 50 }) }, { 'Summoning["GrimoireUpgBonus",36,0]': 50 }));
    expect(rows).toEqual([
      { name: "Level", val: 450, fmt: "raw" },
      { name: "Per Level", val: 1, fmt: "raw" },
      { name: "Writhing Grimoire (Grimoire 36)", val: 1.5, fmt: "x", note: "Level 50" },
    ]);
    expect(run("grimoire44", ctx({ Grimoire: filled(60, {}) }))).toEqual([]);
  });
  it("the Spelunking shop and the Legend talent: the level and the value per level", () => {
    const spelunk = lists(60, { 5: filled(60, { 50: 253 }), 18: filled(10, { 1: 7 }) });
    expect(run("spelunk50", ctx({ Spelunk: spelunk }))).toEqual([{ name: "Shop Level", val: 253, fmt: "raw" }, { name: "Per Level", val: 1, fmt: "raw" }]);
    expect(run("legend1", ctx({ Spelunk: spelunk }), 3500)).toEqual([{ name: "Points", val: 7, fmt: "raw" }, { name: "Per Point", val: 500, fmt: "raw" }]);
    expect(run("legend1", ctx({ Spelunk: spelunk }), 0)).toEqual([]);
    expect(run("spelunk50", ctx())).toEqual([]);
  });
});

describe("the Emperor, the Sushi Station and the Jelly Operator", () => {
  const research = Object.assign(lists(60, {}), { 7: filled(12, { 9: 43, 4: 24 }) });
  const seeds: Seeds = {
    'SushiStuff["UniqueSushi",0,0]': 64, 'SushiStuff["RoG_BonusQTY",48,0]': 10, 'JellyOperation["RoG_BonusQTY",14,0]': 5, 'JellyOperation["RoG_BonusQTY",28,0]': 2,
    'ArcaneType["ArcaneUpgBonus",48,0]': 26, "ArcadeBonus[51]": 80.8,
  };
  it("Sushi + Jelly: the two bonuses and what unlocks them", () => {
    const rows = run("rog", ctx({ Research: research }, seeds));
    expect(rows.map((r) => [r.name, r.val, r.fmt, r.note])).toEqual([
      ["Unagi Nigiri (Sushi Tier 49) — Drop Rate (RoG Bonus 48)", 10, "+", "sushi RoG 48"],
      ["Gold Bangle (Jelly Obstruction 15) — Drop Rate (Jelly Bonus 14)", 5, "+", "jelly RoG 14"],
    ]);
    expect(rows[0].children).toEqual([{ name: "Unique Sushi", val: 64, fmt: "raw" }, { name: "RoG Value", val: 10, fmt: "raw", note: "Unlocked" }]);
    expect(rows[1].children).toEqual([{ name: "Successful Operations", val: 43, fmt: "raw" }, { name: "Bonus Value", val: 5, fmt: "raw", note: "Unlocked" }]);
    const locked = run("rog", ctx({ Research: Object.assign(lists(60, {}), { 7: filled(12, { 9: 3 }) }) }, { ...seeds, 'SushiStuff["UniqueSushi",0,0]': 10 }));
    expect(locked[0].children![1].note).toBe("Locked (need 49)");
    expect(locked[1].children![1].note).toBe("Locked (need 15 operations)");
  });
  it("Emperor 11: the fights whose slot is the bonus, the sum they give and the multi", () => {
    const rows = run("emperor11", ctx({ Research: research, OptLacc: optLacc({ 369: 180 }) }, seeds), 146);
    expect(names(rows)).toEqual(["Emperor Kills", "Slot Matches", "Raw Sum", "Arcane 48", "Emperor Bonuses Arcade Bonus (Arcade 51)", "Strabbury (Jelly Obstruction 29) — All earned Emperor Bonuses are x bigger than before! (Jelly Bonus 28)", "Multi"]);
    expect(rows.slice(0, 5).map((r) => r.val)).toEqual([180, 7, 70, 26, 80.8]);
    expect(rows[5]).toMatchObject({ val: 2, fmt: "+", note: "jelly RoG 28" });
    expect(rows[6]).toEqual({ name: "Multi", val: 1 + (26 + (80.8 + 2)) / 100, fmt: "x" });
    expect(run("emperor11", ctx({ OptLacc: optLacc({ 369: 180 }) }, seeds), 0)).toEqual([]);
  });
});

describe("the Research grid", () => {
  const research = Object.assign(lists(200, {}), { 0: filled(200, { 173: 1, 168: 1 }), 1: filled(200, { 173: 0, 168: 6 }) });
  const seeds: Seeds = {
    'ResearchStuff["Grid_Bonus",173,1]': 1, 'ResearchStuff["Grid_Bonus",168,1]': 1, 'ResearchStuff["Grid_Bonus_Allmulti",0,0]': 1.23, "Companions[55]": 15, "Companions[0]": 5,
    'Dreamstuff["CloudBonus",71]': 1, 'Dreamstuff["CloudBonus",72]': 1, 'SushiStuff["RoG_BonusQTY",53,0]': 1, 'Minehead["GlimboTotalTrades",0,0]': 2309,
  };
  it("Divine Design: level, value per level, shape and the all-multi with its terms", () => {
    const rows = run("grid173", ctx({ Research: research }, seeds));
    expect(rows.map((r) => [r.name, r.val, r.fmt, r.note])).toEqual([
      ["Grid Level", 1, "raw", undefined],
      ["Base per Level", 25, "raw", "25/level"],
      ["Shape Bonus", 1.25, "x", "shape=0"],
      ["All Multi", 1.23, "x", undefined],
    ]);
    expect(rows[3].children!.map((r) => [r.name, r.val])).toEqual([
      ["Pirate Deckhand (Companion 55)", 15],
      ["King Doot (Companion 0)", 5],
      ["Dream Challenge 71 (Cloud Bonus 71)", 1],
      ["Dream Challenge 72 (Cloud Bonus 72)", 1],
      ["Sushi Tier 54 — Research Grid All Multi (RoG Bonus 53)", 1],
    ]);
    expect(rows[3].children![0].children).toEqual([{ name: "Owned", val: 1, fmt: "raw" }, { name: "Bonus", val: 15, fmt: "raw" }]);
    expect(rows[3].children![1].children).toEqual([{ name: "Divine Design (Grid 173) Lv", val: 1, fmt: "raw" }]);
  });
  it("Glimbo: the level, the shape, the all-multi (not clamped) and the trades", () => {
    const rows = run("glimbo", ctx({ Research: research }, seeds));
    expect(names(rows)).toEqual(["Glimbo Insider Trading Secrets (Grid 168) Level", "Shape Bonus", "All Multi", "Total Trades"]);
    expect(rows[1]).toEqual({ name: "Shape Bonus", val: 1.25, fmt: "x", note: "shape=6" });
    expect(rows[3]).toEqual({ name: "Total Trades", val: 2309, fmt: "raw", note: "23 groups" });
  });
  it("have no rows while the square has no level", () => {
    const none = { 'ResearchStuff["Grid_Bonus",173,1]': 0, 'ResearchStuff["Grid_Bonus",168,1]': 0 };
    expect(run("grid173", ctx({ Research: research }, none))).toEqual([]);
    expect(run("glimbo", ctx({ Research: research }, none))).toEqual([]);
  });
});

describe("the Minehead, the Menagerie, the Pristine Charm and the vial", () => {
  it("Minehead floor 0: the floor and the bonus, or the floor it needs", () => {
    const c = ctx({ Research: Object.assign(lists(60, {}), { 7: filled(12, { 4: 24 }) }) });
    expect(run("minehead0", c, 10)).toEqual([{ name: "Mine Floor", val: 24, fmt: "raw" }, { name: "Bonus Value", val: 10, fmt: "raw" }]);
    expect(run("minehead0", c, 0)).toEqual([{ name: "Mine Floor", val: 24, fmt: "raw" }, { name: "Required Floor", val: 0, fmt: "raw" }]);
  });
  it("Menagerie boost 24: its level and value", () => {
    const c = ctx({ Menagerie: lists(6, { 3: filled(30, { 24: 3 }) }) });
    expect(run("menagerie24", c)).toEqual([{ name: "Level", val: 3, fmt: "raw" }, { name: "Per Level", val: 1, fmt: "raw" }]);
  });
  it("Cotton Candy: unlocked once the charm is found", () => {
    const found = (v: number) => ctx({ Ninja: Object.assign(lists(110, {}), { 107: filled(10, { 3: v }) }) });
    expect(run("pristine3", found(1))).toEqual([{ name: "Unlocked", val: 1, fmt: "raw" }, { name: "Charm Bonus", val: 15, fmt: "raw" }]);
    expect(run("pristine3", found(0))[0]).toEqual({ name: "Locked", val: 0, fmt: "raw" });
  });
  it("the vial: each vial of the kind with a level, with its three multipliers in the note", () => {
    const g = (AlchemyDescription as unknown as unknown[][][])[4].findIndex((v) => v[11] === "7drMulto");
    const c = ctx(
      { CauldronInfo: [[], [], [], [], filled(100, { [g]: 10 })], Rift: [0] },
      { [`CauldronStats["VialBonus",4,${g},0]`]: 5.488, "MainframeBonus[10]": 2, 'Summoning["VaultUpgBonus",42,0]': 292, 'Summoning2["MeritocBonusz",20,0]': 0 }
    );
    expect(run("vial", c, 5.488)).toEqual([{ name: String((AlchemyDescription as unknown as unknown[][][])[4][g][0]), val: 5.488, fmt: "raw", note: "lab×2 riftVault×3.92 meritoc×1.00" }]);
    expect(run("vial", ctx({ CauldronInfo: [[], [], [], [], filled(100, {})], Rift: [0] }))).toEqual([]);
  });
});

describe("a save the rows cannot read", () => {
  it("is one noted leaf, never a thrown error", () => {
    const rows = run("grimoire44", synth({ Grimoire: undefined }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Skull of Major Droprate", val: 0 });
    expect(rows[0].note).toMatch(/^not read: /);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("on the newest save (user decision 09/11)", () => {
  it("the tree matches lib/arkh's, path by path", () => {
    const env = JSON.parse(readFileSync(newestSaves(goldenSaves(), 1)[0], "utf8")) as { charNames: unknown[] };
    for (const ci of [0, 8]) for (const map of [251, 301, 216, 150]) expect(compareV1(env, ci, map), `${ci}/${map}`).toEqual({ missing: [], extra: [], value: [], meta: [] });
  }, 300_000);
});
