// The EtcBonuses and set rows of the Drop Rate V1 tree (lib/dropRate/explain/equipment.ts) and the chip toggle: on a synthetic save every other block is a seed (ZeroCache), so the numbers are worked out by hand. On the newest real save, the
// parts add up to the game's EtcBonuses and the toggle matches what lib/arkh does (user decision 09/11: the newest saves only; loaded inside `it`).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES, goldenSaves } from "../../game/support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareV1 } from "../../game/support/v1Compare";
import { newestSaves } from "@/lib/diagnose/characterize";
import type { ArkhNode } from "@/lib/dropRate/node";
import { EXPLAINERS } from "@/lib/dropRate/explain";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { stateOf } from "@/lib/game/trackers/page";
import { computeGameDropRateV1, dropRateV1Tree, forceTrophyChip } from "@/lib/game/trackers/dropRateV1";
import { type Data, type Seeds, synth, WB } from "../../game/support/expStub";

const kid = (n: ArkhNode | undefined, name: string): ArkhNode => {
  const k = n?.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n?.name}": ${n?.children?.map((c) => c.name)}`);
  return k;
};
const names = (n: ArkhNode) => (n.children ?? []).map((c) => c.name);
const top = (rows: ArkhNode[], name: string) => kid({ name: "", val: 0, children: rows }, name);

const blanks = (n: number, at: Record<number, string> = {}) => Array.from({ length: n }, (_, i) => at[i] ?? "Blank");
const spelunk = (at: Record<number, unknown[]>) => Array.from({ length: 60 }, (_, i) => at[i] ?? []);
const placed = (n: number, at: Record<number, number>) => Array.from({ length: n }, (_, i) => at[i] ?? 0);
const worn = (first: Record<number, string> = {}, tools: Record<number, string> = {}) => [blanks(16, first), blanks(8, tools)];
const BARE: Data = { EquipOrder_0: worn(), EMmLENGTH0_0: 16, EMmLENGTH1_0: 8, EMm0_0: {}, EMm1_0: {}, ObolEqO0_0: [], ObolEqO1: [], ObolEqMAP_0: {}, ObolEqMAPz1: {}, Spelunk: spelunk({}) };
const OUTSIDE: Seeds = { "Dungon[]": -1 };
const ctx = (data: Data = {}, seeds: Seeds = {}, real: string[] = []) => synth({ ...BARE, ...data }, { seeds: { ...OUTSIDE, ...seeds }, real });
const parts = (c: Ctx, id: string) => EXPLAINERS[`etc${id}`](c, 0);

describe("the worn items", () => {
  const data = { EquipOrder_0: worn({ 3: "EquipmentPendant18", 15: "EquipmentGown5" }, { 0: "EquipmentTools15" }), EMm0_0: { 3: { UQ1val: 2 } } };
  const seeds = { 'chipBonuses["pend"]': 1, 'ResearchStuff["Grid_Bonus",172,0]': 76.875 };
  it("a row per slot: (3 + 2 rolled) doubled by the chip, and a tool", () => {
    const eq = top(parts(ctx(data, seeds), "2"), "Equipment Bonuses");
    expect(eq).toMatchObject({ val: 20, fmt: "+", note: "equipment 2" });
    expect(kid(eq, "Strung Steamy")).toEqual({
      name: "Strung Steamy",
      val: 10,
      fmt: "+",
      note: "Equipped — R0 S3",
      children: [
        { name: "Item Bonus (raw)", val: 5, fmt: "+", note: "Stat value built into the item before any boosters" },
        { name: "Pendant Doubler (Lab Chip)", val: 2, fmt: "x", note: "Lab chip in this character's slot doubles this stat" },
      ],
    });
    expect(kid(eq, "Destroyer of the Mollo Gomme")).toEqual({ name: "Destroyer of the Mollo Gomme", val: 10, fmt: "+", note: "Equipped — R1 S0" });
  });
  it("Well Dressed multiplies the attire slot: 50 x (1 + 76.875 / 100)", () => {
    const uniform = kid(top(parts(ctx(data, seeds), "99"), "Equipment Bonuses"), "Corsair Uniform");
    expect(uniform).toMatchObject({ val: 88.4375, note: "Equipped — R0 S15" });
    expect(uniform.children![1]).toEqual({ name: "Well Dressed (Grid 172)", val: 1.76875, fmt: "x", note: "Grid M4 — multiplies the first MISC bonus on Attire by 1 + 76.88/100" });
  });
  it("the catalog lists what is not worn, grouped and by value, and leaves the kinds other rows show", () => {
    const catalog = kid(top(parts(ctx(data, seeds), "2"), "Equipment Bonuses"), "Available DR Items (not equipped)");
    expect(catalog).toMatchObject({ val: 0, fmt: "+", note: "Every item in the game with this DR stat type; equip any to add its bonus" });
    expect(kid(catalog, "Pendants — 1 item").children).toEqual([{ name: "Chaotic Amarok Pendant", val: 0, fmt: "+", note: "Not equipped — would grant +5 drop rate" }]);
    expect(names(kid(catalog, "Helmets — 4 items"))).toEqual(["Emperor Kabuto", "Crown of the Gods", "Skulled Helmet of the Divine", "Efaunt Helmet"]);
    expect(kid(kid(catalog, "Keychains — 1 item"), "Relic Chain").note).toBe("Not equipped — would grant +0 drop rate");
    const groups = names(catalog);
    expect(groups).toEqual([...groups].sort());
    expect(groups.some((g) => /Obols|Trophies|Nametags|Premium/.test(g))).toBe(false);
  });
  it("the Gallery's, Hatrack's and Cape Vine's slots stop counting while those are on, and the catalog stops offering capes", () => {
    const gear = { EquipOrder_0: worn({ 8: "EquipmentHats81", 10: "Trophy2", 12: "EquipmentCape7", 14: "EquipmentNametag3" }) };
    const off = top(parts(ctx(gear, { 'chipBonuses["troph"]': 1 }), "2"), "Equipment Bonuses");
    expect(off.val).toBe(10 + 2 * 7 + 30 + 40);
    expect(kid(off, "Lucky Lad").children![1].name).toBe("Trophy Doubler (Lab Chip)");
    expect(names(kid(off, "Available DR Items (not equipped)"))).toContain("Capes — 2 items");
    const on = top(parts(ctx(gear, { 'Gallery["GalleryBonusSystemON",0,0]': 1, 'Gallery["PremHatBonusesSystemON",0,0]': 1, 'Gallery["CapevineBonusesSystemON",0,0]': 1 }), "2"), "Equipment Bonuses");
    expect(on.val).toBe(0);
    expect(names(on)).toEqual(["Available DR Items (not equipped)"]);
    expect(names(on.children![0]).some((g) => g.startsWith("Capes"))).toBe(false);
  });
});

describe("the obols", () => {
  const obol = parts(
    ctx({ ObolEqO0_0: ["ObolSilverPop", "Blank", "ObolSilverPop", "ObolLocked1", "ObolHyperB0", "ObolFrog"], ObolEqMAP_0: { 2: { UQ1val: 1 } }, ObolEqO1: ["ObolPinkLuck", "ObolPinkLuck"] }),
    "2"
  ).find((p) => p.name === "Obol Bonuses")!;
  it("grouped by kind, biggest first, with the slots under each", () => {
    expect(obol).toMatchObject({ val: 18 + 30, fmt: "+", note: "obol 2" });
    const personal = kid(obol, "Personal");
    expect(personal.val).toBe(18);
    expect(names(personal)).toEqual(["Hyper Obol of Rare Drops (Square)", "Silver Obol of Pop Pop (Circle) × 2", "Grumpy Obol of the Grandfrogger (Square)"]);
    expect(kid(personal, "Silver Obol of Pop Pop (Circle) × 2").children).toEqual([{ name: "Slot 0", val: 3, fmt: "+" }, { name: "Slot 2", val: 4, fmt: "+" }]); // 3, 3 + 1 rolled
    expect(kid(kid(obol, "Family"), "Dementia Obol of Infinisixes (Sparkle) × 2").val).toBe(30);
  });
  it("the catalog is by shape, without the slotted kinds", () => {
    const catalog = kid(obol, "Available DR Obols (not equipped)");
    expect(names(catalog)).toEqual(["Circle Obols — 2 types", "Hexagon Obols — 3 types", "Sparkle Obols — 1 type", "Square Obols — 4 types"]);
    expect(kid(catalog, "Sparkle Obols — 1 type").children).toEqual([{ name: "Dementia Obol of Pop Pop Pop Pop", val: 0, fmt: "+", note: "Not equipped — would grant +9 per slot" }]);
  });
});

// Gallery Bonus Multi by hand: 1 + (3 x 10 + 3 + 5 + min(20, 25) + min(12, 10) + 50 + 1) / 100 = 2.19, and 2.29 with the chip's 10
const MULTI: Seeds = {
  'Gallery["GalleryBonusSystemON",0,0]': 1,
  'Thingies["ClamWorkBonus",7,0]': 1,
  'RandomEvent["KillroyBonuses",3,0]': 5,
  'DNSM.AlchBubbles["Y13"]': 25,
  'RunCodeOfTypeXforThingY["CardLv","w7a11"]': 12,
  "Companions[49]": 50,
  'SushiStuff["RoG_BonusQTY",54,0]': 1,
  'Gallery["PodiumsOwned_Lv4",0,0]': 3,
};
const REAL_MULTI = ['Gallery["GalleryBonusMulti"', 'chipBonuses["troph"]'];
const lab = (chip: boolean) => ({ Lab: [[], [chip ? 16 : -1, -1, -1, -1, -1, -1, -1]] });
const GALLERY = { Spelunk: spelunk({ 13: [0, 0, 0, 0, 10], 16: placed(52, { 2: 2, 50: 24 }), 17: placed(8, { 3: 6 }) }) };
const gallery = (chip: boolean, force?: boolean, data: Data = GALLERY) => {
  const c = synth({ ...BARE, ...data, ...lab(chip) }, { seeds: { ...OUTSIDE, ...MULTI }, real: REAL_MULTI, trace: true });
  forceTrophyChip(c, force);
  return c;
};

describe("the Gallery", () => {
  it("a nametag: tier x multi x base, named by the item, the level under it", () => {
    const tag = kid(top(parts({ ...gallery(true), trace: null }, "2"), "Nametag Bonuses"), "Balling Nametag");
    expect(tag.val).toBeCloseTo(2.5 * 2.29 * 40, 12);
    expect(tag).toMatchObject({ fmt: "+", note: "gallery level 6" });
    expect(names(tag)).toEqual(["Level", "Tier", "Gallery Bonus Multi", "Base"]);
    expect(kid(tag, "Tier")).toEqual({ name: "Tier", val: 2.5, fmt: "x" });
    expect(kid(tag, "Base")).toEqual({ name: "Base", val: 40, fmt: "raw" });
    const multi = kid(tag, "Gallery Bonus Multi");
    expect(multi.val).toBeCloseTo(2.29, 12);
    expect(multi.children!.map((r) => [r.name, r.val, r.fmt])).toEqual([
      ["Gallery Level", 30, "raw"],
      ["Silkrode Motherboard (Chip 16)", 10, "raw"],
      ["Glasstic Brain (Clam Work 7)", 3, "raw"],
      ["Skull Shop Tier 3 (Killroy 3)", 5, "raw"],
      ["Codfrey Rulz OK (Bubble Y13, capped 20)", 20, "raw"],
      ["Coralcave Crab (Card w7a11, capped 10)", 10, "raw"],
      ["Bubba The Seal (Companion 49)", 50, "raw"],
      ["Dulce Vitiri (Sushi Tier 55) — Gallery Bonus Multi (RoG Bonus 54)", 1, "raw"],
    ]);
    expect(kid(multi, "Gallery Level")).toMatchObject({ note: "3 per level", children: [{ name: "Level", val: 10, fmt: "raw" }] });
    expect(kid(multi, "Bubba The Seal (Companion 49)").children).toEqual([{ name: "Owned", val: 1, fmt: "raw" }, { name: "Bonus", val: 50, fmt: "raw" }]);
  });
  it("a trophy: 0.3 before slot 48, its podium's after", () => {
    const c = { ...gallery(true), trace: null };
    const lad = kid(top(parts(c, "2"), "Trophy Bonuses"), "Lucky Lad");
    expect(lad.val).toBeCloseTo(0.3 * 2.29 * 7, 12);
    expect(lad.note).toBe("gallery slot 2");
    expect(lad.children!.slice(0, 2)).toEqual([{ name: "Slot", val: 2, fmt: "raw" }, { name: "Tier", val: 0.3, fmt: "x" }]);
    const dart = kid(top(parts(c, "91"), "Trophy Bonuses"), "Nine Dart Finish");
    expect(dart.val).toBeCloseTo(2.5 * 2.29 * 9, 12);
    expect(kid(dart, "Slot").val).toBe(50);
  });
  it("what is not placed follows at 0, the highest base first", () => {
    const c = { ...gallery(true), trace: null };
    const trophy = top(parts(c, "2"), "Trophy Bonuses");
    expect(names(trophy)).toEqual(["Lucky Lad", "Luckiest Lad", "Luckier Lad", "One of the Divine", "Ultra Unboxer"]);
    expect(kid(trophy, "Luckiest Lad")).toEqual({ name: "Luckiest Lad", val: 0, fmt: "+", note: "Not in gallery — base +777, scales with Tier × Gallery Bonus Multi" });
  });
  it("an empty trophy case and nametag rack are catalog rows at 0; so is a Gallery still closed, whatever is placed", () => {
    const empty = parts({ ...gallery(true, undefined, { Spelunk: spelunk({ 13: [0, 0, 0, 0, 10] }) }), trace: null }, "2");
    expect(top(empty, "Nametag Bonuses")).toMatchObject({ val: 0, note: "nametag 2" });
    expect(top(empty, "Trophy Bonuses").val).toBe(0);
    for (const n of top(empty, "Nametag Bonuses").children!) expect(n.note).toMatch(/^Not in gallery/);
    const closed = parts(synth({ ...BARE, ...GALLERY, ...lab(true) }, { seeds: { ...OUTSIDE, ...MULTI, 'Gallery["GalleryBonusSystemON",0,0]': 0 }, real: REAL_MULTI }), "2");
    expect(top(closed, "Nametag Bonuses").val).toBe(0);
    expect(kid(top(closed, "Nametag Bonuses"), "Balling Nametag").note).toMatch(/^Not in gallery/);
  });
});

describe("the chip toggle", () => {
  const balling = (c: Ctx) => kid(top(parts({ ...c, trace: null }, "2"), "Nametag Bonuses"), "Balling Nametag").val;
  const chipRow = (c: Ctx) => names(kid(kid(top(parts({ ...c, trace: null }, "2"), "Nametag Bonuses"), "Balling Nametag"), "Gallery Bonus Multi")).includes("Silkrode Motherboard (Chip 16)");
  const said = (c: Ctx) => c.trace!.children.filter((n) => n.note?.startsWith("assumed:")).map((n) => [n.block, n.value, n.note]);

  it("automatic reads the character's chips and says nothing", () => {
    expect(balling(gallery(true))).toBeCloseTo(229, 9);
    expect(balling(gallery(false))).toBeCloseTo(219, 9);
    expect(chipRow(gallery(true))).toBe(true);
    expect(chipRow(gallery(false))).toBe(false);
    expect(said(gallery(true))).toEqual([]);
  });
  it("forced the other way, it moves the rows and is stated as assumed", () => {
    const on = gallery(false, true);
    expect(balling(on)).toBeCloseTo(229, 9);
    expect(chipRow(on)).toBe(true);
    expect(said(on)).toEqual([["Silkrode Motherboard (Chip 16)", 1, "assumed: the page's chip toggle forces it on: this character does not have it in its lab"]]);
    const off = gallery(true, false);
    expect(balling(off)).toBeCloseTo(219, 9);
    expect(chipRow(off)).toBe(false);
    expect(said(off)).toEqual([["Silkrode Motherboard (Chip 16)", 0, "assumed: the page's chip toggle forces it off: this character has it in its lab"]]);
  });
  it("forced the way the save already is, nothing changes and nothing is said", () => {
    expect(balling(gallery(true, true))).toBeCloseTo(229, 9);
    expect(said(gallery(true, true))).toEqual([]);
    expect(balling(gallery(false, false))).toBeCloseTo(219, 9);
    expect(said(gallery(false, false))).toEqual([]);
  });
  it("the seed is that compute's: another Ctx on the same state reads the save", () => {
    const off = gallery(true, false);
    expect(chipBonuses(off, "troph")).toBe(0);
    expect(chipBonuses(makeCtx(off.state, { player: 0, map: off.map }), "troph")).toBe(1);
  });
  it("it moves the total: 2.5 x 10 / 100 x 40 is 10 points of the additive pool", () => {
    const REAL = ['TotalStats["Drop_Rarity"]', "Dungon[", 'EtcBonuses["2"]', "Gallery[", 'chipBonuses["troph"]'];
    const KLA = Array.from({ length: 300 }, (_, i) => [250 === i ? 0 : 1]);
    const run = (chip: boolean, force?: boolean) => {
      const { 'Gallery["GalleryBonusSystemON",0,0]': _open, "Dungon[]": _dungeon, ...seeds } = { ...OUTSIDE, ...MULTI };
      const c = synth({ ...BARE, Spelunk: spelunk({ 13: [0, 0, 0, 0, 10], 17: placed(8, { 3: 6 }) }), ...lab(chip), Dream: placed(20, {}), SL_0: {}, KLA_0: KLA }, { seeds: { ...WB, ...seeds, 'TotalStats["LUK"]': 500 }, real: REAL, trace: true });
      forceTrophyChip(c, force);
      return dropRateV1Tree(c);
    };
    expect(run(true).total - run(false).total).toBeCloseTo(0.1, 9);
    expect(run(false, true).total).toBeCloseTo(run(true).total, 9);
    expect(run(true, false).total).toBeCloseTo(run(false).total, 9);
    const forced = run(true, false).tree;
    expect(forced.children!.at(-1)).toEqual({ name: "Silkrode Motherboard (Chip 16)", val: 0, fmt: "raw", note: "assumed: the page's chip toggle forces it off: this character has it in its lab" });
  });
});

describe("the Hatrack and the Cape Vine", () => {
  const HAT: Seeds = { 'Gallery["PremHatBonusesSystemON",0,0]': 1, "Companions[31]": 15, 'Summoning["EventShopOwned",30,0]': 1, 'Minehead["BonusQTY",21,0]': 2, 'SushiStuff["RoG_BonusQTY",36,0]': 1 };
  const hats = ctx({ Spelunk: spelunk({ 46: ["EquipmentHats81", "EquipmentHats102", "EquipmentHats96"] }) }, HAT, ['Gallery["HatrackBonusMulti"']);
  it("a hat is 1 + (3 + 15 + 10 + 2 + 1) / 100 times its base, only for its own stat", () => {
    const rack = top(parts(hats, "2"), "Hatrack Bonuses");
    expect(rack).toMatchObject({ fmt: "+", note: "premhat 2" });
    expect(names(rack)).toEqual(["Siege Captain Cap"]);
    expect(rack.val).toBeCloseTo(13.1, 12);
    expect(kid(rack, "Siege Captain Cap").note).toBeUndefined();
    const multi = kid(kid(rack, "Siege Captain Cap"), "Hatrack Bonus Multi");
    expect(multi.val).toBeCloseTo(1.31, 12);
    expect(multi.children!.map((r) => [r.name, r.val, r.note])).toEqual([
      ["Hats Owned", 3, undefined],
      ["Wild Boar (Companion 31)", 15, "Hat Rack Bonus Multi"],
      ["Hatrack Boutique Bonus (Event Shop 30)", 10, undefined],
      ["Hatrack Floor Bonus (Minehead 21)", 2, undefined],
      ["Abalone Sashimi (Sushi Tier 37) — Hat Rack Multi (RoG Bonus 36)", 1, undefined],
    ]);
    expect(names(top(parts(hats, "91"), "Hatrack Bonuses"))).toEqual(["Fanned Blossomage", "Bamboo Hat"]);
  });
  it("no row while the Hatrack gives nothing", () => {
    expect(parts(ctx(), "2").map((p) => p.name)).not.toContain("Hatrack Bonuses");
  });
  const CAPE: Seeds = { 'Gallery["CapevineBonusesSystemON",0,0]': 1, "Companions[105]": 10, 'Stuff2["GoldCapeVinesOwned",0,0]': 1 };
  it("a golden vine counts whole and the others a quarter of 1 + (2 + 10) / 100", () => {
    const vine = top(parts(ctx({ Spelunk: spelunk({ 54: ["EquipmentCape23", "EquipmentCape7"] }) }, CAPE, ['Gallery["CapevineBonusMulti"']), "2"), "Cape Vine Bonuses");
    expect(vine).toMatchObject({ fmt: "+", note: "capevine 2" });
    expect(vine.val).toBeCloseTo(280 + 8.4, 12);
    const golden = kid(vine, "Lovely Balloon");
    expect(golden.val).toBeCloseTo(280, 12);
    expect(golden.note).toBe("Golden Vine slot 1");
    expect(names(kid(golden, "Cape Vine Bonus Multi"))).toEqual(["Capes in the Vine", "Catherine (Companion 105)"]);
    const regular = kid(vine, "Molten Cloak");
    expect(regular.note).toBe("Vine slot 2");
    expect(kid(regular, "Cape Vine Bonus Multi").val).toBeCloseTo(0.28, 12);
    expect(kid(kid(regular, "Cape Vine Bonus Multi"), "Regular Vine")).toEqual({ name: "Regular Vine", val: 0.25, fmt: "x", note: "Only Golden Vine slots give the full bonus" });
    expect(kid(kid(regular, "Cape Vine Bonus Multi"), "Capes in the Vine")).toEqual({ name: "Capes in the Vine", val: 2, fmt: "raw", note: "+1% each" });
  });
});

describe("the sources' edges", () => {
  it("the Efaunt set says whether it counts", () => {
    expect(EXPLAINERS.efaunt(ctx(), 25)).toEqual([{ name: "Unlocked", val: 1, fmt: "raw" }]);
    expect(EXPLAINERS.efaunt(ctx(), 0)).toEqual([{ name: "Unlocked", val: 0, fmt: "raw" }]);
  });
  it("nothing to show is the row V1 drops; a part the save cannot answer is a noted leaf", () => {
    expect(parts(ctx(), "102")).toEqual([{ name: "No active sources", val: 0, fmt: "+", note: "No items on the current character grant this stat" }]);
    const c = synth({ Spelunk: spelunk({}) }, { seeds: OUTSIDE });
    expect(top(parts(c, "2"), "Equipment Bonuses")).toMatchObject({ val: 0, note: expect.stringMatching(/^not read: /) });
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("on the newest save (user decision 09/11)", () => {
  const load = () => JSON.parse(readFileSync(newestSaves(goldenSaves(), 1)[0], "utf8")) as { charNames: unknown[] };
  it("the parts add up to the game's EtcBonuses", () => {
    const env = load();
    for (let ci = 0; ci < env.charNames.length; ci++) {
      const c = makeCtx(stateOf(env), { player: ci, map: 251 });
      for (const id of ["2", "91", "99"]) {
        const v = EtcBonuses(c, id);
        expect(parts(c, id).reduce((a, r) => a + r.val, 0), `${ci}/${id}`).toBeCloseTo(v, 9);
      }
    }
  }, 300_000);
  it("the toggle matches lib/arkh's rows, moves the total only when it differs from the save, and leaves no trace in the next compute", () => {
    const env = load();
    for (const ci of [0, 8]) {
      const auto = computeGameDropRateV1(env, ci, 251).total;
      const has = 0 < chipBonuses(makeCtx(stateOf(env), { player: ci, map: 251 }), "troph");
      for (const on of [true, false]) {
        expect(compareV1(env, ci, 251, { chipGalleryActive: on }), `${ci}/${on}`).toEqual({ missing: [], extra: [], value: [], meta: [] });
        const forced = computeGameDropRateV1(env, ci, 251, { chipGalleryActive: on }).total;
        if (on === has) expect(forced).toBe(auto);
        else expect(forced).not.toBe(auto);
        expect(computeGameDropRateV1(env, ci, 251).total).toBe(auto);
      }
    }
  }, 300_000);
});
