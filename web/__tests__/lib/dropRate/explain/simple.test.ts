// The rows of the remaining sources of the Drop Rate V1 tree (lib/dropRate/explain/simple.ts). On a synthetic save every block is a seed (ZeroCache), so the numbers are worked out by hand; on the newest real save
// the whole tree matches lib/arkh's path by path (user decision 09/11: the newest saves only; loaded inside `it`).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES, goldenSaves } from "../../game/support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareV1, PENDING } from "../../game/support/v1Compare";
import { newestSaves } from "@/lib/diagnose/characterize";
import { EXPLAINERS } from "@/lib/dropRate/explain";
import { SIMPLE_EXPLAINERS } from "@/lib/dropRate/explain/simple";
import { ChipDesc, NinjaInfo, PostOffUpgradeInfo, Research, SummonEnemies, UpgradeVault } from "@/lib/game/data";
import { type Data, type Seeds, synth } from "../../game/support/expStub";

const filled = (n: number, set: Record<number, number>) => Object.assign(Array<number>(n).fill(0), set);
const num = (v: unknown) => Number(v);
type Table = readonly (readonly unknown[])[];
const ctx = (data: Data = {}, seeds: Seeds = {}) => synth({ Lv0_0: filled(30, { 0: 100 }), ...data }, { seeds });
const run = (id: string, c: ReturnType<typeof ctx>, val = 0) => EXPLAINERS[id](c, val);
const shape = (rows: { name: string; val: number; fmt?: string; note?: string }[]) => rows.map((r) => [r.name, r.val, r.fmt, r.note]);

const IDS = ["lukScaling", "shrine4", "arcade27", "guild10", "postOffice11", "win9", "tome2", "dream10", "ach377", "ach381", "owl4", "vote27", "vault18", "friend3", "chip", "bunV", "ola232", "bunP", "arcane", "statue1", "family32", "tome7", "cloud69"];
describe("every remaining source has rows", () => {
  it("is registered, and nothing is pending", () => {
    for (const id of IDS) expect(SIMPLE_EXPLAINERS[id], id).toBeTypeOf("function");
    expect(PENDING.size).toBe(0);
  });
});

describe("LUK Scaling", () => {
  it("the character's LUK and the curve it goes through, below and above 1000", () => {
    const lo = run("lukScaling", ctx({}, { 'TotalStats["LUK"]': 500 }), 0.25);
    expect(shape(lo)).toEqual([["🍀 Total LUK", 500, "raw", undefined], ["Sub-1000 curve", 0.25, "raw", "(pow(500+1, 0.37)-1)/40"]]);
    const hi = run("lukScaling", ctx({}, { 'TotalStats["LUK"]': 20000 }), 0.8);
    expect(shape(hi)[1]).toEqual(["Over-1000 curve", 0.8, "raw", "(20000-1000)/(20000+2500)*0.5+0.297"]);
  });
});

describe("the additive pool", () => {
  it("Clover Shrine: the level's step and the Boss3B card's factor; nothing while the shrine does not count", () => {
    const shrines = [[], [], [], [], [0, 0, 0, 38]];
    const seeds: Seeds = { 'RunCodeOfTypeXforThingY["CardLv","Boss3B"]': 7, 'RiftStuff["5starCards",0]': 1, 'Spelunk["6starCards",0,0]': 0 };
    const rows = run("shrine4", ctx({ Shrine: shrines, Cards0: { Boss3B: 1089 } }, seeds), 1.35 * (37 * 3 + 15));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Shrine Level 38", val: 37 * 3 + 15, fmt: "+", note: "15 base + 3/level" });
    expect(rows[1]).toMatchObject({ name: "Chaotic Chizoar (Card Boss3B)", val: 1.35, fmt: "x" });
    expect(shape(rows[1].children!)).toEqual([["Card Qty", 1089, "raw", undefined], ["Card Lv", 7, "raw", undefined], ["Max Stars", 5, "raw", undefined]]);
    expect(run("shrine4", ctx({ Shrine: shrines }), 0)).toEqual([]);
    expect(run("shrine4", ctx({ Shrine: shrines, Cards0: {} }, seeds), 5)[0].note).toMatch(/^not read: the rows give/);
  });

  it("Arcade: level, the curve's value, the Super / Omega factor and Companion 27's ×2", () => {
    const c = ctx({ ArcadeUpg: filled(60, { 27: 101 }) }, { "Companions[27]": 1 });
    const rows = run("arcade27", c, 60);
    expect(shape(rows.slice(0, 3))).toEqual([["Level", 101, "raw", undefined], ["Raw Value", 15, "raw", undefined], ["Maxed Bonus", 2, "x", "Super (level 101)"]]);
    expect(rows[3]).toMatchObject({ name: "Spirit Reindeer (Companion 27)", val: 2, fmt: "x", note: "companion 27" });
    const omega = run("arcade27", ctx({ ArcadeUpg: filled(60, { 27: 102 }) }), 12);
    expect(shape(omega.slice(0, 3))).toEqual([["Level", 102, "raw", undefined], ["Raw Value", 2, "raw", undefined], ["Maxed Bonus", 6, "x", "Omega (level 102)"]]);
    expect(run("arcade27", ctx({ ArcadeUpg: filled(60, {}) }))).toEqual([]);
  });

  it("Guild and Post Office: the points and the curve at them", () => {
    expect(shape(run("guild10", ctx({ Guild: [filled(20, { 10: 50 })] }), 20))).toEqual([["Guild Points", 50, "raw", undefined], ["Formula Result", 20, "raw", "decay(40,50,50)"]]);
    expect(run("guild10", ctx({ Guild: [filled(20, {})] }))).toEqual([]);
    const box = num((PostOffUpgradeInfo as unknown as Table)[11][1]);
    expect(shape(run("postOffice11", ctx({ POu_0: filled(40, { 11: 400 }) }), 33.3))).toEqual([["Points Invested", 400, "raw", undefined], ["Formula Result", 33.3, "raw", `decay(${box},200,400)`]]);
    expect(run("postOffice11", ctx({ POu_0: filled(40, {}) }))).toEqual([]);
  });

  it("Equinox Symbols, the two achievements and Cloud 69", () => {
    expect(shape(run("dream10", ctx({ Dream: filled(20, { 10: 80 }) }), 400))).toEqual([["Dream Upgrade Level", 80, "raw", undefined], ["Per Level", 5, "raw", undefined]]);
    expect(shape(run("ach377", ctx({}, { "AchieveStatus[377]": 1 }), 6))).toEqual([["Completed", 1, "raw", undefined], ["Bonus", 6, "+", undefined]]);
    expect(shape(run("ach381", ctx(), 0))).toEqual([["Not completed", 0, "raw", undefined], ["Would grant", 4, "+", "once completed"]]);
    expect(shape(run("cloud69", ctx({}, { 'Dreamstuff["CloudBonus",69]': 1 }), 5))).toEqual([["Completed", 1, "raw", undefined], ["Coefficient", 5, "raw", undefined]]);
  });

  it("Tome: the score, how far past the threshold, the base and the Grimoire / Troll factor; not unlocked says so", () => {
    const seeds: Seeds = { 'Summoning["GrimoireUpgBonus",17,0]': 150, 'GetSetBonus["TROLL_SET","Bonus",0,0]': 25, "DNSM.TomeQTYtot[]": 55295 };
    const score = 55295;
    const c = ctx({ OptLacc: filled(700, { 197: 1 }) }, seeds);
    const rows = run("tome2", c, 2 * 2.75 * Math.pow(472, 0.7));
    expect(rows.map((r) => r.name)).toEqual(["Tome Score", "Scaled", "Base", "Tome Multi"]);
    expect(rows[1]).toMatchObject({ val: Math.floor((score - 8000) / 100), note: "floor((pts-8000)/100)" });
    expect(rows[3]).toMatchObject({ val: 2.75, fmt: "x" });
    expect(shape(rows[3].children!)).toEqual([["Grey Tome Book (Grimoire 17)", 150, "raw", undefined], ["Troll Set", 25, "raw", undefined]]);
    expect(run("tome2", ctx(), 0)).toEqual([{ name: "Not Unlocked", val: 0, fmt: "raw" }]);
    expect(run("tome7", ctx({}, { 'Summoning["EventShopOwned",27,0]': 1, ...seeds }), 1)[1].note).toBe("floor((pts)/1000)");
  });

  it("Voting: base and multi in the week of vote 27; otherwise which vote is in force", () => {
    const base = num((NinjaInfo as unknown as Table)[38][1 + 3 * 27]);
    const on = synth({}, { serverVars: { voteCategories: [27, 1] } });
    expect(shape(EXPLAINERS.vote27(on, base * 8))).toEqual([["Base", base, "raw", undefined], ["Voting Multi", 8, "x", undefined]]);
    const off = synth({}, { serverVars: { voteCategories: [3] } });
    expect(shape(EXPLAINERS.vote27(off, 0))).toEqual([["Not active vote", 0, "raw", "active=3"]]);
  });

  it("Vault 18: level, value per level and the mastery vault's factor only while it has levels", () => {
    const per = num((UpgradeVault as unknown as Table)[18][5]);
    const rows = run("vault18", ctx({ UpgVault: filled(100, { 18: 85, 32: 97 }) }, { 'Summoning["VaultUpgBonus",32,0]': 97 }));
    expect(shape(rows.slice(0, 2))).toEqual([["Level", 85, "raw", undefined], ["Per Level", per, "raw", undefined]]);
    expect(rows[2]).toMatchObject({ name: "Mastery", val: 1.97, fmt: "x" });
    expect(rows[2].children).toEqual([{ name: "Mastery Lv", val: 97, fmt: "raw" }]);
    expect(run("vault18", ctx({ UpgVault: filled(100, { 18: 85 }) })).map((r) => r.name)).toEqual(["Level", "Per Level"]);
  });

  it("Owl 4: the upgrades bought, Legend 26, Companion 51 and the megafeathers", () => {
    const seeds: Seeds = { 'Thingies["LegendPTS_bonus",26,0]': 10, "Companions[51]": 2, 'Summoning["OwlMegafeather",1,0]': 1, 'Summoning["OwlMegafeather",3,0]': 1, 'Summoning["OwlMegafeather",9,0]': 3 };
    const all = 100 + 100 + 100 + 50 * 2;
    const rows = run("owl4", ctx({ OptLacc: filled(700, { 255: 44, 262: 12 }) }, seeds), 1 * 1.1 * 3 * (1 + all / 100) * 7);
    expect(rows.map((r) => r.name)).toEqual(["Base Per Owl", "Owl Count", "Furry Friends Forever (Legend 26)", "Santas Little Helper (Companion 51)", "Megafeather Bonus"]);
    expect(rows[0].val).toBeCloseTo(1, 12);
    expect(rows[1]).toMatchObject({ val: 7, note: "OLA[255]=44" });
    expect(rows[4]).toMatchObject({ val: 1 + all / 100, note: "OLA[262]=12" });
    expect(shape(rows[4].children!)).toEqual([["Feather 1", 100, "raw", undefined], ["Feather 3", 100, "raw", undefined], ["Feather 9", 100, "raw", undefined], ["Feather 9+ (×50 ea)", 100, "raw", undefined]]);
    expect(run("owl4", ctx({ OptLacc: filled(700, {}) }))).toEqual([]);
  });

  it("Friend Bonus: the last friend with stat 3 within the slots, then the companions' factors", () => {
    const seeds: Seeds = { 'Thingies["FriendBonusSlots",0,0]': 2, 'Thingies["FriendBonusQTY",3,500]': 10, 'Thingies["FriendBonusQTY",3,20]': 7, "Companions[30]": 1.5, "CompLV2[44]": 1 };
    const list = (text: string) => ({ OptLacc: Object.assign(filled(700, {}), { 476: text }) });
    // the game: 10 x (1 + (100 x 1.5 + 25 x 1) / 100) = 10 x 2.75 = 27.5 (the Pet1 row is 2.5, Companion 44 adds 0.25)
    const rows = run("friend3", ctx(list("1,10,Ann;3,500,Bob;3,20,Cy"), seeds), 27.5);
    expect(rows.map((r) => [r.name, r.val, r.fmt, r.note])).toEqual([
      ["Bob", 10, "+", undefined],
      ["Mr Pig (Companion 30)", 2.5, "x", "companion 30 — stage 2 (LV2)"],
      ["Companion 44 — Stage 2 (LV2)", 0.25, "+", "+25% Friend Bonus multi, added to Companion 30's multi (N.js sums them)"],
    ]);
    // Companion 44 alone is a factor of 1.25; Companion 30 alone is its row
    expect(run("friend3", ctx(list("3,500,Bob"), { ...seeds, "Companions[30]": 0 }), 12.5).map((r) => [r.name, r.val, r.fmt])).toEqual([["Bob", 10, "+"], ["Companion 44 — Stage 2 (LV2)", 1.25, "x"]]);
    expect(run("friend3", ctx(list("3,500,Bob"), { ...seeds, "CompLV2[44]": 0 }), 25)[1].val).toBe(2.5);
    expect(run("friend3", ctx(list("3,500,Bob"), seeds), 30)[0].note).toMatch(/^not read: the rows give 27.5, the block 30/);
    expect(rows[0].children).toEqual([{ name: "Score", val: 500, fmt: "raw" }]);
    expect(run("friend3", ctx(list("0"), seeds), 0)).toEqual([]);
  });
});

describe("the chip and the steps of Post-Processing", () => {
  it("the chip: one row per lab slot holding a Drop Rate chip", () => {
    const index = (ChipDesc as unknown as Table).findIndex((d) => "dr" === String(d[10]));
    const lab = [[], [index, -1, index, -1, -1, -1, -1]];
    const rows = run("chip", ctx({ Lab: lab }));
    expect(rows.map((r) => [r.name.startsWith("Slot "), r.val, r.fmt, r.note])).toEqual([[true, num((ChipDesc as unknown as Table)[index][11]), "+", `chip ${index}`], [true, num((ChipDesc as unknown as Table)[index][11]), "+", `chip ${index}`]]);
    expect(rows.map((r) => r.name.slice(0, 6))).toEqual(["Slot 0", "Slot 2"]);
    expect(run("chip", ctx({ Lab: [[], [-1, -1, -1, -1, -1, -1, -1]] }))).toEqual([]);
  });

  it("the bundles: owned or not; the Sneaking Mastery level, its threshold and its bonus", () => {
    expect(run("bunV", ctx({ BundlesReceived: { bun_v: 1 } }))).toEqual([{ name: "Owned", val: 1, fmt: "raw" }]);
    expect(run("bunP", ctx({ BundlesReceived: {} }))).toEqual([{ name: "Not owned", val: 0, fmt: "raw" }]);
    expect(shape(run("ola232", ctx({ OptLacc: filled(700, { 232: 8 }) })))).toEqual([["OLA[232]", 8, "raw", undefined], ["Threshold", 1, "raw", "met"], ["Bonus", 0.3, "raw", undefined]]);
    expect(run("ola232", ctx())[1].note).toBe("not met");
  });

  it("Arcane Map Bonus: the kills on the map, the bonus they give, the cap and the capped value", () => {
    const seeds: Seeds = { 'ArcaneType["ArcaneMapMulti",4708,0]': 2.8, 'ArcaneType["ArcaneMapMulti_bonMAX",0,0]': 60 };
    const mapBon = Array.from({ length: 300 }, () => [0, 0, 0]);
    mapBon[251] = [4708, 0, 0];
    expect(shape(run("arcane", ctx({ MapBon: mapBon }, seeds), 2.8))).toEqual([["Map Kills", 4708, "raw", undefined], ["Raw Bonus", 2.8, "+", undefined], ["Cap", 60, "raw", undefined], ["Capped Bonus", 2.8, "+", undefined]]);
  });

  it("Royal Statue 1: the level, the base, the step per level and Armory 45's boost; not built says so", () => {
    const r = Research as unknown as Table;
    const rows = run("statue1", ctx({ RoyalG: [[0, 2], [], []] }, { 'RoyalG["ArmoryUpgBonus",45,0]': 4 }), 57.2);
    expect(shape(rows)).toEqual([["Level", 2, "raw", undefined], ["Base", num(r[41][1]), "raw", undefined], ["Per Level", num(r[42][1]), "raw", "× (level − 1)"], ["Royal Reverence (Armory 45)", 4, "+", "% boost to every Royal Statue"]]);
    expect(shape(run("statue1", ctx({ RoyalG: [[0, 0], [], []] })))).toEqual([["Level", 0, "raw", "not built"]]);
  });

  it("Royal Guardian family bonus: the best level of the class, the curve's constants and The Family Guy's share", () => {
    const seeds: Seeds = { 'FamilyBonsuesREAL[16,0,2019]': 7 };
    const c = ctx({ CharacterClass_0: 16, Lv0_0: filled(30, { 0: 2019 }) }, seeds);
    const rows = run("family32", c, 7);
    expect(shape(rows)).toEqual([["Best Royal Guardian Lv", 2019, "raw", "max across account"], ["Lv Offset", expect.any(Number), "raw", undefined], ["Formula x1", 10, "raw", undefined], ["Formula x2", 800, "raw", undefined]]);
    expect(run("family32", c, 8.5).at(-1)).toEqual({ name: "The Family Guy (Talent 144)", val: 1.5, fmt: "+", note: "active character's own family bonus × (1 + talent 144 / 100)" });
  });

  it("Winner Bonus 9: the bucket, 3.5, the charm, the gem shop and the winners' boosts; refused when they do not give the block's number", () => {
    const names = (SummonEnemies as unknown as Table)[0];
    const bucket = (SummonEnemies as unknown as Table)[5];
    const mob = String(names[bucket.findIndex((b) => 10 === num(b))]);
    const seeds: Seeds = { 'Ninja["PristineBon",8,0]': 30, "AchieveStatus[379]": 1, 'Sailing["ArtifactBonus",32,0]': 150, 'GetSetBonus["GODSHARD_SET","Bonus",0,0]': 15, 'Summoning["WinBonus",31,0]': 5 };
    const data = { Sailing: [[], [], [], filled(40, { 32: 6 })], Summon: [[], [mob]], GemItemsPurchased: filled(20, { 11: 5 }), TaskZZ2: [[], [], [], [], [], [0, 0, 0, 0, 10]] };
    const boosts = 1 + (150 + 10 + 1 + 0 + 5 + 0 + 15) / 100;
    const value = 3.5 * num((SummonEnemies as unknown as Table)[7][bucket.findIndex((b) => 10 === num(b))]) * 1.3 * 1.5 * boosts;
    const rows = run("win9", ctx(data, seeds), value);
    if (rows.length === 1) throw new Error(String(rows[0].note));
    expect(rows.map((r) => r.name)).toEqual(["Win Bonus Raw", "Base Multiplier", "Crystal Comb (Pristine 8)", "Gem Shop Bonus", "Winner Multi"]);
    expect(rows[2]).toMatchObject({ val: 1.3, note: "Equipped" });
    expect(rows[3]).toMatchObject({ val: 1.5, note: "items=5" });
    expect(rows[4].val).toBeCloseTo(boosts, 12);
    expect(rows[4].children![0]).toEqual({ name: "Artifact 32", val: 150, fmt: "raw", note: "rarity=6" });
    expect(rows[4].children!.map((r) => r.name)).not.toContain("Bundle ban_i"); // only while the bundle is owned
    expect(run("win9", ctx(data, seeds), value * 2)[0].note).toMatch(/^not read: the rows give/);
    expect(run("win9", ctx(data, seeds), 0)).toEqual([]);
  });
});

describe("a save the rows cannot read", () => {
  it("is one noted leaf, never a thrown error", () => {
    const rows = run("guild10", synth({ Guild: undefined }), 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Gold Charm (Guild 10)", val: 0 });
    expect(rows[0].note).toMatch(/^not read: /);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("on the newest save (user decision 09/11)", () => {
  it("the tree matches lib/arkh's, path by path, but for V1_KNOWN", () => {
    const env = JSON.parse(readFileSync(newestSaves(goldenSaves(), 1)[0], "utf8")) as { charNames: unknown[] };
    for (const ci of [0, 8]) for (const map of [251, 301, 216, 150]) expect(compareV1(env, ci, map), `${ci}/${map}`).toEqual({ missing: [], extra: [], value: [], meta: [] });
  }, 300_000);
});
