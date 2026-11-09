// The cards, companions, food and small account rows of the Drop Rate V1 tree (lib/dropRate/explain/collections.ts). On a synthetic save every block is a seed (ZeroCache), so the numbers are worked out by hand; on the newest real save the
// tree matches lib/arkh's path by path (user decision 09/11: the newest saves only; loaded inside `it`).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES, goldenSaves } from "../../game/support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareV1, PENDING } from "../../game/support/v1Compare";
import { newestSaves } from "@/lib/diagnose/characterize";
import type { ArkhNode } from "@/lib/dropRate/node";
import { EXPLAINERS } from "@/lib/dropRate/explain";
import { AlchemyDescription, CardStuff, CompanionDB, IDforCardBonus, ITEMS, NinjaInfo, PetStats, PrayerInfo, RANDOlist, SigilDesc } from "@/lib/game/data";
import { type Data, type Seeds, synth } from "../../game/support/expStub";

const SOURCES = ["card10", "card101", "mini5a", "anni4", "luckEvent", "comp3", "comp50", "comp22", "comp158", "comp111", "comp132", "comp132x", "comp168x", "comp26", "comp160", "comp50x", "goldFood", "stampA38", "bubble", "starSigns", "prayer7", "shiny0", "sigil11"];
const names = (rows: ArkhNode[]) => rows.map((r) => r.name);
const filled = (n: number, set: Record<number, number>) => Object.assign(Array<number>(n).fill(0), set);
const num = (v: unknown) => Number(v);
type Table = readonly (readonly unknown[])[];
/** The synthetic Ctx with the account's companion list (the game asks the server for it: the envelope's `companion.l`, entries "id,x,x,x,stage2"). */
function ctx(data: Data = {}, seeds: Seeds = {}, companions?: string[]) {
  const c = synth({ Lv0_0: filled(30, { 0: 100, 18: 19 }), ...data }, { seeds });
  if (!companions) return c;
  return { ...c, state: Object.assign(Object.create(Object.getPrototypeOf(c.state)), c.state, { companion: { l: companions } }) } as typeof c;
}
const run = (id: string, c: ReturnType<typeof ctx>, val = 0) => EXPLAINERS[id](c, val);

describe("every source of the family has rows", () => {
  it("is registered, and not pending (the two card sets are leaves, as lib/arkh's)", () => {
    for (const id of SOURCES) expect(EXPLAINERS[id], id).toBeTypeOf("function");
    for (const id of [...SOURCES, "cardSet5", "cardSet6"]) expect(PENDING.has(id), id).toBe(false);
  });
});

describe("the cards", () => {
  const type10 = (CardStuff as unknown as Table[]).flat().filter((r) => r[3] === (IDforCardBonus as Record<string, string>)["10"]);
  const per = (key: string) => num(type10.find((r) => r[0] === key)![4]);
  const data = { Cards0: { Crystal0: 100, mimicA: 50 }, CardEquip_0: ["Crystal0", "B", "mimicA", "B", "B", "B", "B", "B", "B", "B"] };
  const seeds: Seeds = {
    'RunCodeOfTypeXforThingY["CardLv","Crystal0"]': 3, 'RunCodeOfTypeXforThingY["CardLv","mimicA"]': 2, 'Thingies["LegendPTS_bonus",21,0]': 50, 'chipBonuses["card1"]': 1,
    'RiftStuff["5starCards",0]': 1, 'Spelunk["6starCards",0,0]': 0,
  };
  it("each equipped card: level x value per level, the legend talent factor, the chip; then the others as 0 references and the legend row", () => {
    const rows = run("card10", ctx(data, seeds));
    expect(rows[0]).toMatchObject({ name: "Crystal Carrot (Card Crystal0)", fmt: "+" });
    expect(rows[0].val).toBe(2 * 1.5 * 3 * per("Crystal0")); // the card1 chip doubles the first slot
    expect(rows[0].children).toEqual([
      { name: "Card Qty", val: 100, fmt: "raw" },
      { name: "Star Lv", val: 3, fmt: "raw", note: "max 5 stars" },
      { name: "Bonus/Star", val: per("Crystal0"), fmt: "raw" },
      { name: "Rift 5th Star", val: 1, fmt: "raw" },
      { name: "Spelunk 6th Star", val: 0, fmt: "raw" },
      { name: "Chip ×2", val: 2, fmt: "x", note: "card1" },
    ]);
    expect(rows[1].val).toBe(1.5 * 2 * per("mimicA")); // the third slot has no chip: no row for it
    expect(rows[1].children!.map((r) => r.name)).not.toContain("Chip ×2");
    const refs = rows.slice(2, -1);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(r).toMatchObject({ val: 0, fmt: "+", note: "not equipped" });
    expect(names(refs)).not.toContain("Crystal Carrot (Card Crystal0)");
    expect(rows.at(-1)).toEqual({ name: "Flopping a Full House (Legend 21) ×", val: 1.5, fmt: "x", children: [{ name: "Legend PTS", val: 50, fmt: "raw" }] });
  });
  it("has no legend row while the factor is 1, and every card is a reference with no card worn", () => {
    const rows = run("card10", ctx({ Cards0: {}, CardEquip_0: Array<string>(10).fill("B") }, { 'RiftStuff["5starCards",0]': 0 }));
    expect(rows.every((r) => r.note === "not equipped" && r.val === 0)).toBe(true);
    expect(names(rows)).not.toContain("Flopping a Full House (Legend 21) ×");
  });
  it("the card multi type (101) lists its own cards", () => {
    const rows = run("card101", ctx({ Cards0: {}, CardEquip_0: Array<string>(10).fill("B") }));
    expect(rows.length).toBeGreaterThan(0);
    expect(names(rows)).not.toContain("Crystal Carrot (Card Crystal0)");
  });
  it("a card read on its own: min(per star x level, cap), capped or not", () => {
    const c = ctx({ Cards0: { mini5a: 1611640, anni4Event1: 28 } }, { 'RunCodeOfTypeXforThingY["CardLv","mini5a"]': 7, 'RunCodeOfTypeXforThingY["CardLv","anni4Event1"]': 3 });
    expect(run("mini5a", c, 10)).toEqual([{ name: "Card Qty", val: 1611640, fmt: "raw" }, { name: "Card Lv", val: 7, fmt: "raw" }, { name: "Per Star", val: 1.5, fmt: "raw" }, { name: "Cap", val: 10, fmt: "raw" }, { name: "CAPPED", val: 10, fmt: "raw" }]);
    expect(run("anni4", c, 6).map((r) => [r.name, r.val])).toEqual([["Card Qty", 28], ["Card Lv", 3], ["Per Star", 2], ["Cap", 20], ["Uncapped", 6]]);
  });
  it("refuses rows that do not give the block's number (the game's constants moved)", () => {
    const rows = run("anni4", ctx({ Cards0: {} }, { 'RunCodeOfTypeXforThingY["CardLv","anni4Event1"]': 3 }), 9);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toMatch(/^not read: the rows give 6, the block 9/);
  });
});

describe("the companions", () => {
  const db = (id: number, at: number) => num((CompanionDB[id] as readonly unknown[])[at]);
  it("owned: the bonus, and at stage 2 the value it is read from", () => {
    const c = ctx({}, {}, ["3,0,0,0,1", "158,0,0,0,0"]);
    expect(run("comp3", c, db(3, 11))).toEqual([{ name: "Owned", val: 1, fmt: "raw" }, { name: "Bonus", val: db(3, 11), fmt: "+", note: "stage 2 (LV2) value — CompanionDB[id][11]" }]);
    expect(run("comp158", c, db(158, 2))).toEqual([{ name: "Owned", val: 1, fmt: "raw" }, { name: "Bonus", val: db(158, 2), fmt: "+" }]);
  });
  it("not owned: what it would grant", () => {
    expect(run("comp22", ctx({}, {}, ["3,0,0,0,1"]))).toEqual([{ name: "Not owned", val: 0, fmt: "raw" }, { name: "Would grant", val: db(22, 2), fmt: "+", note: "if owned" }]);
    expect(run("comp22", ctx())[0]).toEqual({ name: "Not owned", val: 0, fmt: "raw" }); // the envelope has no companion list at all
  });
  it("a multiplier: the raw bonus, the cap, the stage 2 bonus outside it and the result", () => {
    const c = ctx({}, { "CompLV2[132]": 1 }, ["132,0,0,0,1"]);
    expect(run("comp132x", c, 1.7)).toEqual([
      { name: "Raw bonus", val: db(132, 11), fmt: "+", note: "stage 2 (LV2) value" },
      { name: "Cap", val: 1.5, fmt: "x" },
      { name: "Stage 2 (LV2) bonus", val: 0.2, fmt: "+", note: "added outside the cap" },
      { name: "Result", val: 1.7, fmt: "x" },
    ]);
  });
  it("a multiplier with no cap shows none; one divided (Santa Snake) and one capped (Mallay)", () => {
    const owned = ["168,0,0,0,0", "50,0,0,0,0", "26,0,0,0,0"];
    const c = ctx({}, {}, owned);
    expect(names(run("comp168x", c, 1 + 0.3 * db(168, 2)))).toEqual(["Raw bonus", "Result"]);
    expect(run("comp50x", c, Math.min(1.01, 1 + db(50, 2) / 2500)).map((r) => [r.name, r.val])).toEqual([["Raw bonus", db(50, 2)], ["Cap", 1.01], ["Result", 1.01]]);
    expect(run("comp26", c, Math.min(1.3, 1 + db(26, 2))).map((r) => r.name)).toEqual(["Raw bonus", "Cap", "Result"]);
  });
  it("a multiplier not owned: one row saying so, and what it would grant", () => {
    expect(run("comp160", ctx(), 1)).toEqual([{ name: "Not owned — no contribution", val: 0, fmt: "raw", note: `Would grant +${db(160, 2)} raw if owned` }]);
  });
});

describe("golden food", () => {
  // the multiplier: (1 + SECRET_SET / 100) x (max(family 66, 1) + (Talent 99 + Stamp + Achievement 37 + Jelly 10) / 100) = 1.25 x (1.5 + 2.41)
  const seeds: Seeds = { 'GetSetBonus["SECRET_SET","Bonus",0,0]': 25, 'DNSM.FamBonusQTYs["66"]': 1.5, 'GetTalentNumber[1,99]': 40, 'StampBonusOfTypeX["GFood"]': 100, "AchieveStatus[37]": 1, 'JellyOperation["RoG_BonusQTY",10,0]': 100 };
  const exact = 1.25 * (1.5 + 241 / 100);
  const em = (NinjaInfo as unknown as Table)[29];
  const emporiumIndex = Array.from({ length: Math.floor(em.length / 3) }, (_, e) => e).find((e) => String(em[2 + 3 * e]) === "FoodG13")!;
  const data = {
    FoodSlO_0: 2, EquipOrder_0: [[], [], { 0: "Blank", 1: "FoodG13" }], EquipQTY_0: [[], [], { 0: 0, 1: 999 }],
    Ninja: Object.assign(Array.from({ length: 110 }, () => [] as number[]), { 104: filled(30, { [emporiumIndex]: 2 }) }),
  };
  const lg: Seeds = { "getLOG[1000]": 3, "getLOG[100001]": 5, 'Ninja["EmporiumBonus",1,0]': 1 };
  const amount = num((ITEMS as unknown as Record<string, { Amount: unknown }>).FoodG13.Amount);
  const worn = amount * exact * 0.05 * 3 * (1 + 3 / 2.14);
  const stored = amount * exact * 0.05 * 5 * (1 + 5 / 2.14);
  it("the multiplier term by term, then the worn food and the Emporium's", () => {
    const rows = run("goldFood", ctx(data, { ...seeds, ...lg }), worn + stored);
    expect(names(rows)).toEqual(["GFood Multi", "Equipped: FoodG13", "Emporium: FoodG13"]);
    expect(rows[0]).toMatchObject({ val: exact, fmt: "x", note: "SECRET_SET × (Family + Σ sources ÷ 100)" });
    expect(rows[0].children!.map((r) => [r.name, r.val])).toEqual([["Family Bonus 66", 1.5], ["Sources ÷ 100", 2.41], ["SECRET_SET multi", 1.25]]);
    expect(rows[0].children![1].children!.map((r) => [r.name, r.val])).toEqual([
      ["Talent 99 (Hungry For Gold)", 40], ["Stamp Golden Food", 100], ["Achievement 37 (Nutty Crafter)", 1],
      ["Spinine (Jelly Obstruction 11) — total Golden Food bonus (Jelly Bonus 10)", 100],
    ]);
    expect(rows[1].val).toBeCloseTo(worn, 12);
    expect(rows[1].children).toEqual([{ name: "Base Amount", val: amount, fmt: "raw" }, { name: "Quantity", val: 999, fmt: "raw" }, { name: "Log Factor", val: 3, fmt: "raw" }]);
    expect(rows[2].children).toEqual([{ name: "Base Amount", val: amount, fmt: "raw" }, { name: "Emporium Lv", val: 2, fmt: "raw" }, { name: "Eff Qty", val: 1e5, fmt: "raw" }]);
  });
  it("has no rows while the food gives nothing, and no SECRET_SET row while that multiplier is 1", () => {
    expect(run("goldFood", ctx(data, seeds), 0)).toEqual([]);
    const rows = run("goldFood", ctx({ ...data, FoodSlO_0: 0 }, { ...lg, 'DNSM.FamBonusQTYs["66"]': 1 }), 5);
    expect(names(rows[0].children!)).toEqual(["Family Bonus 66", "Sources ÷ 100"]);
  });
});

describe("the stamp, the bubble and the sigil", () => {
  const stampData = { StampLv: [filled(60, { 37: 230 }), [], []], Compass: [filled(100, { 76: 13 }), [], [], [], ["_37"]], Spelunk: Object.assign(Array.from({ length: 30 }, () => [] as number[]), { 9: filled(30, { 23: 78 }) }), Research: Array.from({ length: 60 }, () => [] as number[]), FarmUpg: filled(100, {}) };
  const stampSeeds: Seeds = {
    "StampOverLevel[37]": 230, 'ArbitraryCode5Inputs["decay",20,80,230,0,0]': 14.5, 'Windwalker["StampDoubler",0,0]': 205, 'AtomCollider["AtomBonuses",12,0]': 72, 'Ninja["PristineBon",20,0]': 20, 'Windwalker["CompassBonus",76,0]': 13,
    "MainframeBonus[7]": 2, 'Ninja["PristineBon",17,0]': 25,
  };
  it("Golden Sixes Stamp: the level, the curve, the exalted doubler with its terms, and the lab and Pristine multipliers", () => {
    const rows = run("stampA38", ctx(stampData, stampSeeds));
    expect(names(rows)).toEqual(["Stamp Level", "Formula Result", "Exalted ×", "Certified Stamp Book ×", "Liqorice Rolle ×"]);
    expect(rows[0].val).toBe(230);
    expect(rows[1]).toEqual({ name: "Formula Result", val: 14.5, fmt: "raw", note: "decay(20,80,230)" });
    expect(rows[2]).toMatchObject({ val: 1 + 205 / 100, fmt: "x" });
    const doubler = rows[2].children![0];
    expect(doubler).toMatchObject({ name: "StampDoubler", val: 205 });
    expect(doubler.children!.slice(0, 4).map((r) => [r.name, r.val])).toEqual([["Base Doubler", 100], ["Aluminium - Stamp Supercharger (Atom 12)", 72], ["Jellypick (Pristine 20)", 20], ["Abomination Slayer XVII (Compass 76)", 13]]);
    expect(doubler.children![3].children).toEqual([{ name: "Compass Level", val: 13, fmt: "raw" }]);
    expect(doubler.children![6]).toMatchObject({ name: "Palette 23", children: [{ name: "Palette Level", val: 78, fmt: "raw" }] });
    expect(doubler.children!.at(-1)!.name).toMatch(/^Fancy Facet \(Jelly Obstruction 51\)/);
    expect(rows[3]).toEqual({ name: "Certified Stamp Book ×", val: 2, fmt: "x", note: "Lab node 7" });
    expect(rows[4]).toEqual({ name: "Liqorice Rolle ×", val: 1.25, fmt: "x", note: "Pristine 17" });
  });
  it("a stamp that is not exalted says so, with the doubler it would have; at level 0 there are no rows", () => {
    const rows = run("stampA38", ctx({ ...stampData, Compass: [filled(100, { 76: 13 }), [], [], [], []] }, { ...stampSeeds, "MainframeBonus[7]": 0, 'Ninja["PristineBon",17,0]': 0 }));
    expect(names(rows)).toEqual(["Stamp Level", "Formula Result", "Exalted"]);
    expect(rows[2]).toMatchObject({ val: 0, fmt: "raw", note: "inactive" });
    expect(rows[2].children![0].name).toBe('Not exalted (Compass[4] missing key "_37")');
    expect(rows[2].children![1]).toMatchObject({ name: "StampDoubler (if exalted)" });
    expect(run("stampA38", ctx({ ...stampData, StampLv: [[], [], []] }))).toEqual([]);
  });

  const bubble = (AlchemyDescription as unknown as Table[][])[3][1];
  const curve = { [`ArbitraryCode5Inputs["${String(bubble[3])}",${num(bubble[1])},${num(bubble[2])},500,0,0]`]: 40 };
  it("the bubble: its level, its curve, and the Prisma multiplier when it is a Prisma bubble", () => {
    const data = { CauldronInfo: [[], [], [], filled(40, { 1: 500 })] };
    expect(run("bubble", ctx(data, curve))).toEqual([{ name: "Bubble Level", val: 500, fmt: "raw" }, { name: "Base Value", val: 40, fmt: "raw" }]);
    expect(run("bubble", ctx(data, { ...curve, 'CauldronStats["isBubbleSuperr",3,1,0]': 1, 'ArcaneType["PrismaBonusMult",0,0]': 4.5 }))[2]).toEqual({ name: "Prisma Bonus", val: 4.5, fmt: "x", note: "cap 5" });
    expect(run("bubble", ctx({ CauldronInfo: [[], [], [], filled(40, {})] }, curve))).toEqual([]);
  });

  const sigil = (SigilDesc as unknown as Table)[11];
  it("the sigil: its tier, the base the tier gives, Artifact 16 and Meritoc 21", () => {
    const seeds = { 'Sailing["ArtifactBonus",16,0]': 7, 'Summoning2["MeritocBonusz",21,0]': 50 };
    const rows = run("sigil11", ctx({ CauldronP2W: [[], [], [], [], filled(60, { 23: 4 })] }, seeds));
    expect(rows).toEqual([
      { name: "Sigil Level", val: 4, fmt: "raw" }, { name: "Base Bonus", val: num(sigil[12]), fmt: "raw" },
      { name: "Artifact 16 Bonus", val: 8, fmt: "x", note: "artifact 16" }, { name: "Meritoc 21", val: 1.5, fmt: "x" },
    ]);
    expect(run("sigil11", ctx({ CauldronP2W: [[], [], [], [], filled(60, { 23: 3 })] }, seeds))[1].val).toBe(num(sigil[10]));
    expect(run("sigil11", ctx({ CauldronP2W: [[], [], [], [], filled(60, { 23: -1 })] }, seeds))).toEqual([]);
  });
});

describe("the prayer, the shiny pets and the star signs", () => {
  const prayers = (active: number[]) => ({ Prayers_0: active, PrayOwned: filled(20, { 7: 50 }) });
  it("Midas Minded: worn, its base and level factor; not worn, the level and that it is not", () => {
    const base = num((PrayerInfo as unknown as Table)[7][3]);
    const worn = run("prayer7", ctx(prayers([7, -1, -1]), {}));
    expect(worn).toEqual([{ name: "Prayer Level", val: 50, fmt: "raw" }, { name: "Equipped", val: 1, fmt: "raw" }, { name: "Base Bonus", val: base, fmt: "raw" }, { name: "Level Scaling", val: 1 + 49 / 10, fmt: "x" }]);
    expect(run("prayer7", ctx(prayers([3, -1, -1])))).toEqual([{ name: "Prayer Level", val: 50, fmt: "raw" }, { name: "NOT Equipped", val: 0, fmt: "raw" }]);
  });
  it("Midas Minded with no prayer worn and a Super Bit: the bits' share", () => {
    const rows = run("prayer7", ctx(prayers([-1, -1, -1]), { 'GamingStatType["SuperBitType",9,0]': 1, 'GamingStatType["SuperBitType",53,0]': 1 }));
    expect(rows.map((r) => [r.name, r.val])).toEqual([["Prayer Level", 50], ["Super Bits 9/39/53 (no prayer equipped)", 0.2 + 0.2], ["Base Bonus", num((PrayerInfo as unknown as Table)[7][3])], ["Level Scaling", 5.9]]);
  });

  it("the shiny pets whose passive is the drop rate: level, bonus per level and count", () => {
    const [q, g] = (PetStats as unknown as Table[]).flatMap((group, i) => group.map((p, j) => [i, j, num((RANDOlist as unknown as Table)[90][num(p[5])])] as const)).find((p) => p[2] === 0)!;
    const breeding = Array.from({ length: 30 }, () => [] as number[]);
    for (let i = 0; i < 4; i++) breeding[22 + i] = filled(40, {});
    breeding[22 + q][g] = 800793376;
    const rows = run("shiny0", ctx({ Breeding: breeding }, { [`Breeding["SpecialPassives","Lv",${q},${g}]`]: 29 }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ val: 29 * num((RANDOlist as unknown as Table)[92][0]), fmt: "+" });
    expect(rows[0].children).toEqual([{ name: "Shiny Lv", val: 29, fmt: "raw" }, { name: "Bonus/Lv", val: num((RANDOlist as unknown as Table)[92][0]), fmt: "raw" }, { name: "Shiny EXP", val: 800793376, fmt: "raw" }]);
  });

  const signs = (worn: string, unlocked: Record<string, number>) => ({ PVtStarSign_0: worn, StarSg: unlocked, Arcane: filled(60, {}) });
  it("the star signs: the active ones of the table and what Seraph Cosmos multiplies by", () => {
    const seeds: Seeds = { 'Summoning2["MeritocBonusz",22,0]': 50 };
    const rows = run("starSigns", ctx(signs("14,76,", { Seraph_Cosmos: 1 }), seeds), 17 * 1.5 * 1.1);
    expect(rows.map((r) => [r.name, r.val, r.fmt])).toEqual([["Pirate Booty (Star Sign 14)", 5, "+"], ["Druipi Major (Star Sign 76)", 12, "+"], ["Seraph Multiplier", 1.5 * 1.1, "x"]]);
    expect(names(run("starSigns", ctx(signs("76,", { Seraph_Cosmos: 1 }), seeds), 12 * 1.5 * 1.1))).toEqual(["Druipi Major (Star Sign 76)", "Seraph Multiplier"]);
  });
  it("the Silkrode chip's second pass shows what it added; without Seraph Cosmos there is no multiplier row", () => {
    const withChip = run("starSigns", ctx(signs("14,", { Seraph_Cosmos: 1 }), { 'Summoning2["MeritocBonusz",22,0]': 0 }), 10 * 1.1);
    expect(withChip.map((r) => [r.name, r.val])).toEqual([["Pirate Booty (Star Sign 14)", 5], ["Star chip: equipped signs count twice", 5], ["Seraph Multiplier", 1.1]]);
    expect(names(run("starSigns", ctx(signs("14,", {}), {}), 5))).toEqual(["Pirate Booty (Star Sign 14)"]);
    expect(run("starSigns", ctx(signs("0,", {}), {}), 0)).toEqual([]);
  });
});

describe("a save the rows cannot read", () => {
  it("is one noted leaf, never a thrown error", () => {
    const rows = run("bubble", synth({ CauldronInfo: undefined }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Droppin Loads (Bubble 3,1)", val: 0 });
    expect(rows[0].note).toMatch(/^not read: /);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("on the newest save (user decision 09/11)", () => {
  it("the tree matches lib/arkh's, path by path", () => {
    const env = JSON.parse(readFileSync(newestSaves(goldenSaves(), 1)[0], "utf8")) as { charNames: unknown[] };
    for (const ci of [0, 8]) for (const map of [251, 301, 216, 150]) expect(compareV1(env, ci, map), `${ci}/${map}`).toEqual({ missing: [], extra: [], value: [], meta: [] });
  }, 300_000);
});
