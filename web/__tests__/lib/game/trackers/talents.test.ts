// The /talents-level tree on lib/game (lib/game/trackers/talents.ts): the plain talents, the presets and the path-by-path comparison against lib/arkh.
//
// - on a synthetic envelope (CI): an unknown id, a talent the character does not have, the star caps, the preset envelope;
// - on the newest real save (user decision 09/11: the newest save only): compareTalent for every non-pending talent of each character's class, both presets.
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, goldenSaves } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareTalent, compared as comparedIds, resetCompared, PENDING_BOOSTERS, PENDING_WRAPS } from "../support/talentCompare";
import { newestSaves } from "@/lib/diagnose/characterize";
import type { ArkhNode } from "@/lib/dropRate/node";
import { maxBookLv } from "@/lib/dropRate/explain/talent";
import { computeGameTalent, presetState } from "@/lib/game/trackers/talents";
import { stateOf } from "@/lib/game/trackers/page";
import { getCharClassKey } from "@/lib/talentsLevel/charClass";
import { TALENT_TABS_BY_CLASS } from "@/lib/talentsLevel/talentTabs.gen";
import { BASE, synth } from "../support/expStub";
import { asNumber } from "@/lib/game/attr";
import { TaskShopDesc } from "@/lib/game/data";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { capBoosterRow } from "@/lib/talentsLevel/explain/capBoosters";
import { plainTalent } from "@/lib/talentsLevel/explain/plain";
import { applyWrap, readCounter, TALENT_WRAPS, WRAP_COUNTER_PENDING } from "@/lib/talentsLevel/wraps";
import { talentCurveAt } from "@/lib/game/njs/GetTalentNumber";
import type { TraceNode } from "@/lib/game/trace";

const SPELUNK = Array.from({ length: 60 }, (_, i) => (18 === i || 45 === i ? Array<number>(10).fill(0) : []));
const envelope = (data: Record<string, unknown> = {}, chars = 1) =>
  ({
    data: { ...BASE, CurrentMap_0: -1, PlayerStuff_0: [0, 0], SL_0: {}, SM_0: {}, SLpre_0: { 24: 7 }, Spelunk: SPELUNK, ...data },
    charNames: Array.from({ length: chars }, (_, i) => `c${i}`), companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
  }) as never;
const kid = (n: ArkhNode, name: string): ArkhNode => {
  const k = n.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n.name}": ${n.children?.map((c) => c.name)}`);
  return k;
};

describe("the plain talents on a synthetic envelope (runs in CI)", () => {
  it("a talent with no formula data is a leaf saying so, not an error", () => {
    expect(computeGameTalent(envelope(), 0, 99999)).toEqual({ name: "Talent 99999", val: 0, note: "no formula data" });
  });

  it("a talent the character has not got: Active 0, and a Super Levels row with its own Active 0 and what it would give", () => {
    const t = computeGameTalent(envelope(), 0, 24);
    expect(t.name).toMatch(/\(Talent 24\)$/);
    expect(t.val).toBe(0);
    expect(kid(t, "Active").val).toBe(0);
    const lv = kid(t, "Effective Level");
    expect(lv.note).toBe("Base + Bonus + Super");
    expect(lv.children!.map((c) => c.name)).toEqual(["Base Level", "Bonus Levels", "Super Levels"]);
    const sup = kid(lv, "Super Levels");
    expect(sup.val).toBe(0);
    expect(sup.note).toMatch(/^Spelunk Super Talent — inactive \(would give \+\d+ if super-talented on this preset\)$/);
    expect(kid(sup, "Active").val).toBe(0);
  });

  it("forceSuperActive counts the super levels of a talent the preset does not list", () => {
    const t = computeGameTalent(envelope({ SL_0: { 24: 5 } }), 0, 24, { forceSuperActive: true });
    const sup = kid(kid(t, "Effective Level"), "Super Levels");
    expect(sup.val).toBeGreaterThanOrEqual(50);
    expect(kid(sup, "Active").val).toBe(1);
    expect(kid(t, "Effective Level").val).toBe(5 + sup.val + kid(kid(t, "Effective Level"), "Bonus Levels").val);
  });

  it("star 627: Max Level is 5 x (Tasks[2][0][3] + 1) over a lower saved SM", () => {
    const data = { SL_0: { 627: 3 }, SM_0: { 627: 10 }, TaskZZ2: [[0, 0, 0, 7]] };
    expect(kid(computeGameTalent(envelope(data), 0, 627), "Max Level").val).toBe(40);
  });

  it("star 641: Max Level is the live maxBookLv over a lower saved SM", () => {
    const c = synth({ SL_0: { 641: 3 }, SM_0: { 641: 1 }, TaskZZ2: [[0, 0, 0], [0, 0, 0], [0, 0, 6]], Atoms: Array<number>(20).fill(0), SaltLick: Array<number>(20).fill(0), Sailing: [[], [], [], Array<number>(40).fill(0)], Summon: [[], []], GemItemsPurchased: Array<number>(40).fill(0), Spelunk: SPELUNK, PlayerStuff_0: [0, 0] }, { map: 0 });
    const live = maxBookLv(c);
    expect(live).toBeGreaterThanOrEqual(125 + 6 * asNumber(TaskShopDesc[2][2][11]));
    expect(kid(plainTalent(c, 641), "Max Level").val).toBe(live);
  });

  it("the other preset is another state: SL is SLpre, the source and stateOf's answer stay as they were", () => {
    const save = envelope({ SL_0: { 24: 3 } });
    const before = JSON.stringify(save);
    const active = stateOf(save);
    const other = presetState(save, 0, 1);
    expect(other).not.toBe(active);
    expect(other.get("SL_0")).toEqual({ 24: 7 });
    expect((other.get("PlayerStuff_0") as number[])[1]).toBe(1);
    expect(JSON.stringify(save)).toBe(before);
    expect(stateOf(save)).toBe(active);
    expect(active.get("SL_0")).toEqual({ 24: 3 });
    expect(presetState(save, 0, 0)).toBe(active); // the active preset is the cached state
    // asking the other, then the active one: the first answer again
    const opts = { forceSuperActive: true };
    const pointsOf = (t: ArkhNode) => kid(kid(kid(t, "Effective Level"), "Base Level"), "Points Invested").val;
    expect(pointsOf(computeGameTalent(save, 0, 24, { ...opts, presetIdx: 1 }))).toBe(7);
    expect(pointsOf(computeGameTalent(save, 0, 24, { ...opts, presetIdx: 0 }))).toBe(3);
    expect(pointsOf(computeGameTalent(save, 0, 24, opts))).toBe(3);
  });

  it("a save without SLpre_0 reads the other preset as level 0, not an error", () => {
    const save = envelope({ SL_0: { 24: 3 } });
    delete (save as { data: Record<string, unknown> }).data.SLpre_0;
    expect(kid(computeGameTalent(save, 0, 24, { presetIdx: 1 }), "Active").val).toBe(0);
  });

  it("save values may be JSON strings", () => {
    const save = envelope({ SL_0: JSON.stringify({ 24: 3 }), PlayerStuff_0: JSON.stringify([0, 0]), SLpre_0: JSON.stringify({ 24: 9 }) });
    expect(presetState(save, 0, 1).get("SL_0")).toEqual({ 24: 9 });
    expect(presetState(save, 0, 1).get("PlayerStuff_0")).toEqual([0, 1]);
  });
});

describe("the cap boosters on a synthetic envelope (runs in CI)", () => {
  const CAULDRON = [[0, 2], [0, 0], [0, 0], [0, 0]];
  // blocks the booster reads: the talent curve (GetTalentNumber, getbonus2, ArbitraryCode5Inputs) runs for real, every other block (AllTalentLV...) answers 0, so a talent's level is its points
  const capOf = (data: Record<string, unknown>, id: number): ArkhNode =>
    capBoosterRow(synth({ CauldronInfo: CAULDRON, Spelunk: SPELUNK, PlayerStuff_0: [0, 0], SL_0: {}, SM_0: {}, ...data }, { map: 0, real: ["GetTalentNumber", "getbonus2", "ArbitraryCode5Inputs"] }), id, 0)!;

  it("the cap is the hardcoded base plus each booster, the source tree under the source's own name", () => {
    const cap = capOf({ SL_0: { 10: 5, 81: 4 } }, 10);
    expect(cap.children!.map((k) => k.name)).toEqual(["Base Cap (hardcoded)", "Eternal STR (Tal 51 y-bonus)", "Str Summore (Tal 81 x-bonus)", "Overblown Testosterone (Tal 143 y-bonus)"]);
    const summore = kid(cap, "Str Summore (Tal 81 x-bonus)");
    expect(summore.val).toBeGreaterThan(0);
    expect(summore.note).toBe("per-char");
    expect(summore.children!.map((k) => k.name)).toEqual(["Talent 81"].map((n) => expect.stringContaining(n)));
    expect(summore.children![0].note).toBe("per-char emit — full breakdown");
    expect(summore.children![0].val).toBe(summore.val);
    expect(cap.val).toBe(cap.children!.reduce((a, k) => a + k.val, 0));
    expect(kid(cap, "Eternal STR (Tal 51 y-bonus)").note).toBe("account-wide");
  });

  it("a bubble clamp: min(raw, CauldronInfo[chapter][slot]) with the rows Booster Raw and <label> Lv", () => {
    const cap = capOf({ SL_0: { 86: 5, 129: 60 } }, 86);
    const booster = kid(cap, "Blocky Bottles (Tal 129 x-bonus)");
    const raw = kid(booster, "Booster Raw");
    expect(raw.val).toBeGreaterThan(2);
    expect(kid(booster, "Warriors Rule (W1 bubble [0][1]) Lv").val).toBe(2);
    expect(booster.val).toBe(2);
    expect(booster.note).toBe("min(raw, bubble Lv) — per-char");
    expect(cap.val).toBe(102);
  });

  it("a stat target is reassigned by the game: a saved SM above the formula changes nothing, the Saved row is information", () => {
    const base = { SL_0: { 10: 5, 81: 4 } };
    const formula = capOf(base, 10);
    expect(formula.children!.some((k) => k.name.startsWith("Saved SkillLevelsMAX"))).toBe(false);
    const over = capOf({ ...base, SM_0: { 10: formula.val + 40 } }, 10);
    expect(over.val).toBe(formula.val);
    const row = kid(over, "Saved SkillLevelsMAX (override)");
    expect(row.val).toBe(formula.val + 40);
    expect(row.note).toMatch(/the formula wins/);
    expect(row.note).not.toMatch(/using max/);
    expect(over.note).not.toMatch(/ratchets/);
    const same = capOf({ ...base, SM_0: { 10: formula.val } }, 10);
    expect(same.val).toBe(formula.val);
    expect(kid(same, "Saved SkillLevelsMAX (verified)").val).toBe(formula.val);
  });

  it("a ratcheting bubble target keeps a saved SM above the formula; 79 does not (its inner max is the literal 100)", () => {
    const formula = capOf({ SL_0: { 86: 5, 129: 60 } }, 86);
    const over = capOf({ SL_0: { 86: 5, 129: 60 }, SM_0: { 86: 150 } }, 86);
    expect(formula.val).toBe(102);
    expect(over.val).toBe(150);
    expect(kid(over, "Saved SkillLevelsMAX (override)").note).toMatch(/using max\(\)/);
    expect(capOf({ SL_0: { 79: 5, 39: 60 }, SM_0: { 79: 150 } }, 79).val).toBe(100);
  });

  it("the boosters are read as the owner of the cap (who), not the current player; an account-wide one is tab 1", () => {
    const data = { SL_0: {}, SL_1: { 10: 5, 81: 4 }, SM_1: {}, CurrentMap_1: -1, PlayerStuff_1: [0, 0], Lv0_1: [100, 0] };
    const c = synth({ CauldronInfo: CAULDRON, Spelunk: SPELUNK, PlayerStuff_0: [0, 0], SM_0: {}, ...data }, { map: 0, chars: 2, real: ["GetTalentNumber", "getbonus2", "ArbitraryCode5Inputs"] });
    expect(kid(capBoosterRow(c, 10, 1)!, "Str Summore (Tal 81 x-bonus)").val).toBeGreaterThan(0);
    expect(kid(capBoosterRow(c, 10, 0)!, "Str Summore (Tal 81 x-bonus)").val).toBe(0);
    // Eternal STR is getbonus2(1, 51, -1) whatever its kind says: the root value equals the curve of tab 1
    const eternal = capOf({ SL_0: { 10: 5, 51: 3 } }, 10);
    expect(kid(eternal, "Eternal STR (Tal 51 y-bonus)").val).toBe(getbonus2(synth({ SL_0: { 51: 3 }, Spelunk: SPELUNK, PlayerStuff_0: [0, 0], SM_0: {} }, { map: 0, real: ["getbonus2", "ArbitraryCode5Inputs"] }), 1, 51, -1));
  });

  it("a talent without a booster entry keeps the Max Book Lv Cap row", () => {
    expect(capBoosterRow(synth({ SL_0: {}, SM_0: {} }, { map: 0 }), 24, 0)).toBeNull();
    const t = computeGameTalent(envelope(), 0, 24);
    expect(kid(kid(kid(t, "Effective Level"), "Base Level"), "Max Book Lv Cap")).toBeDefined();
  });

  it("the page's tree carries the cap row of a booster target", () => {
    const t = computeGameTalent(envelope({ CauldronInfo: CAULDRON }), 0, 10);
    expect(kid(kid(kid(t, "Effective Level"), "Base Level"), "Talent Cap (base + boosters)").val).toBeGreaterThanOrEqual(100);
  });
});

describe("the final-bonus wraps on a synthetic envelope (runs in CI)", () => {
  // the talent curves and getLOG run for real, every other block answers 0, so a talent's level is its points and a counter is what the test seeds
  const REAL = ["GetTalentNumber", "getbonus2", "ArbitraryCode5Inputs", "getLOG", "AtomCollider"];
  const ola = (m: Record<number, number>) => Object.assign(Array<number>(700).fill(0), m);
  const wrapCtx = (data: Record<string, unknown>, seeds: Record<string, number> = {}, trace = false) =>
    synth({ Spelunk: SPELUNK, PlayerStuff_0: [0, 0], SL_0: {}, SM_0: {}, ...data }, { map: 0, real: REAL, seeds, trace });
  const LOG = (n: number) => Math.log(Math.max(n, 1)) / 2.30259;
  const find = (n: TraceNode, pred: (t: TraceNode) => boolean): TraceNode | undefined => (pred(n) ? n : n.children.map((k) => find(k, pred)).find(Boolean));

  it("a log multiplier: 1 + coefficient x log10(counter) / 100 when active, 1 and the reason when not", () => {
    const on = plainTalent(wrapCtx({ SL_0: { 178: 5 }, OptLacc: ola({ 138: 1000 }) }), 178);
    const tv = kid(on, "Talent Value").val;
    expect(tv).toBeGreaterThan(0);
    expect(on.fmt).toBe("x");
    expect(on.val).toBeCloseTo(1 + (tv * LOG(1000)) / 100, 12);
    expect(on.note).toBe(`1 + (${tv.toFixed(2)} × log10(1000)) / 100`);
    expect(kid(on, "Rememberance Orb Kills")).toMatchObject({ val: 1000, fmt: "raw", note: "OLA[138] — kills with the rememberance orb" });
    expect(on.children!.map((k) => k.name)).toEqual(["Effective Level", "Talent Value", "Rememberance Orb Kills"]);
    const off = plainTalent(wrapCtx({ SL_0: { 178: 5 } }), 178);
    expect(off.val).toBe(1);
    expect(off.note).toBe("Inactive — no Rememberance Orb Kills (OLA[138])");
    expect(kid(off, "Rememberance Orb Kills").val).toBe(0);
  });

  it("a talent the character has not got is inactive whatever the counter is", () => {
    const t = plainTalent(wrapCtx({ OptLacc: ola({ 71: 1000 }) }), 638);
    expect(t.val).toBe(0);
    expect(t.note).toBe("Inactive — talent 0");
    expect(kid(t, "Dungeon Credits").val).toBe(1000);
  });

  it("328 is the best character's: Effective Level under it, no Active, the Workbench multiplier's own coefficient", () => {
    const t = plainTalent(wrapCtx({ SL_0: { 328: 5 }, OptLacc: ola({ 139: 100 }) }), 328);
    expect(t.children!.map((k) => k.name)).toEqual(["Effective Level", "Talent Value", "Plunderous Kills"]);
    expect(t.val).toBeCloseTo(1 + (kid(t, "Talent Value").val * LOG(100)) / 100, 12);
    expect(t.val).toBeCloseTo(1 + (getbonus2(wrapCtx({ SL_0: { 328: 5 } }), 1, 328, -1) * LOG(100)) / 100, 12);
  });

  it("655 is the character's own: Per Skull times Skulls Beaten under its Level rows", () => {
    const t = plainTalent(wrapCtx({ SL_0: { 655: 3 }, SM_0: { 655: 9 }, OptLacc: ola({ 189: 40 }) }), 655);
    expect(t.children!.map((k) => k.name)).toEqual(["Active", "Level", "Max Level", "Per Skull", "Skulls Beaten"]);
    const per = kid(t, "Per Skull").val;
    expect(per).toBeGreaterThan(0);
    expect(t.val).toBeCloseTo(per * 40, 12);
    expect(t.note).toBe(`${per.toFixed(2)} per skull × 40 skulls`);
  });

  it("a wrap with the effective level: Tal 282 clamps its linear term against its tab-2 curve (wrapWithLv)", () => {
    const low = wrapCtx({ SL_0: { 282: 5 } }, { 'TotalStats["AGI"]': 500 });
    const t = plainTalent(low, 282);
    const tv = kid(t, "Talent Value").val;
    const cap = talentCurveAt(low, 2, 282, kid(t, "Effective Level").val);
    expect(cap).toBeGreaterThan(0);
    expect(tv * 2).toBeLessThan(cap);
    expect(t.val).toBeCloseTo(tv * 2, 12);
    const high = plainTalent(wrapCtx({ SL_0: { 282: 5 } }, { 'TotalStats["AGI"]': 1e9 }), 282);
    expect(high.val).toBeCloseTo(cap, 12);
    expect(TALENT_WRAPS[282].wrapWithLv).toBeDefined();
  });

  it("InvStorageOwned counts the character's inventory and the storage through assumed:, and adds the Atom 1 bonus to the power of 10", () => {
    const c = wrapCtx({ SL_0: { 101: 5 }, InventoryOrder_0: ["Copper", "Blank", "Copper"], ItemQTY_0: [1000, 0, 200], ChestOrder: ["Copper", "OakTree"], ChestQuantity: [300, 7], Atoms: [0, 3, 0] }, {}, true);
    const t = plainTalent(c, 101);
    const tv = kid(t, "Talent Value").val;
    const atom = kid(t, "Atom Bonus (Helium)").val;
    expect(atom).toBeGreaterThan(0);
    const owned = kid(t, "Copper Ore Owned (inv+storage)");
    expect(owned.val).toBe(1500);
    expect(owned.note).toMatch(/assumed:/);
    expect(t.val).toBeCloseTo(tv * (LOG(1500) + atom), 12);
    expect(find(c.trace!, (n) => /^assumed: /.test(n.note ?? "") && n.value === 1500)).toBeDefined();
  });

  it("a wrap whose counter lib/game does not have yet keeps the plain shape, and reading its counter says so", () => {
    for (const id of [31, 202, 643]) expect(WRAP_COUNTER_PENDING.has(id)).toBe(true);
    const t = plainTalent(wrapCtx({ SL_0: { 31: 5 } }), 31);
    expect(t.children!.map((k) => k.name)).toEqual(["Active", "Effective Level"]);
    expect(t.note).toMatch(/^[A-Za-z0-9_]+\(/);
    expect(() => readCounter(wrapCtx({}), TALENT_WRAPS[31].counterSource)).toThrow(/not ported/);
    expect(() => readCounter(wrapCtx({}), TALENT_WRAPS[202].counterSource)).toThrow(/not ported/);
  });

  it("Lv0 counters are the character's own levels", () => {
    const c = wrapCtx({ Lv0_0: [100, 77, 0, 0, 0, 0, 0, 55] });
    expect(readCounter(c, TALENT_WRAPS[103].counterSource)).toBe(77);
    expect(readCounter(c, TALENT_WRAPS[313].counterSource)).toBe(55);
  });

  // the root paths below are hidden from the real-save compare by TALENT_KNOWN: these assertions are what would fail if the arithmetic broke
  it("103: the talent's % is tv x (Lv0[1] / 10), with no further /100 (consumer @4202284)", () => {
    const t = plainTalent(wrapCtx({ SL_0: { 103: 5 }, Lv0_0: [100, 77] }), 103);
    const tv = kid(t, "Talent Value").val;
    expect(tv).toBeGreaterThan(0);
    expect(t.val).toBeCloseTo(tv * 7.7, 12);
  });

  it("290: a step per 15% of speed over 100%, floored (speed 1.29 is one step, @4113631)", () => {
    const t = plainTalent(wrapCtx({ SL_0: { 290: 5 } }, { "PlayerSpeedBonus[]": 1.29 }), 290);
    const tv = kid(t, "Talent Value").val;
    expect(tv).toBeGreaterThan(0);
    expect(t.val).toBeCloseTo(tv * 1, 12); // not tv x 29 / 15
    expect(plainTalent(wrapCtx({ SL_0: { 290: 5 } }, { "PlayerSpeedBonus[]": 1.14 }), 290).val).toBe(0);
    expect(plainTalent(wrapCtx({ SL_0: { 290: 5 } }, { "PlayerSpeedBonus[]": 20 }), 290).val).toBeCloseTo(tv * Math.floor(10 / 0.15), 9); // at most 1000%
  });

  it("427: every Breeding[13 + w] entry counts, the bred ones weighted by 2ndMulti while Breeding[2][3] > 0 (@11072274)", () => {
    const rows = (flag: number) => [[], [], [0, 0, 0, flag], [], [], [], [], [], [], [], [], [], [], [0, 0.4, 3, ...Array<number>(18).fill(0)], [9999], [], []];
    const second = (v: number) => Math.min(9, Math.floor(Math.pow(Math.log(Math.max(1, Math.pow(v + 1, 0.725))), 0.8)) + 1);
    expect(second(3)).toBe(2);
    expect(second(9999)).toBe(5);
    const on = plainTalent(wrapCtx({ SL_0: { 427: 5 }, Breeding: rows(1) }), 427);
    expect(kid(on, "Breeds Unlocked (WW)").val).toBe(1 + 1 + 2 + 18 + 5);
    expect(on.val).toBeCloseTo(kid(on, "Talent Value").val * 1, 12); // floor(27 / 25)
    expect(kid(plainTalent(wrapCtx({ SL_0: { 427: 5 }, Breeding: rows(0) }), 427), "Breeds Unlocked (WW)").val).toBe(21 + 1);
  });

  it("653: capped at 15 (consumer @4062188), the note says so", () => {
    const hi = plainTalent(wrapCtx({ SL_0: { 653: 1e6 }, OptLacc: ola({ 172: 1e300 }) }), 653);
    expect(kid(hi, "Talent Value").val * LOG(1e300)).toBeGreaterThan(15);
    expect(hi.val).toBe(15);
    expect(hi.note).toMatch(/\(max 15\)$/);
    const lo = plainTalent(wrapCtx({ SL_0: { 653: 1e6 }, OptLacc: ola({ 172: 10 }) }), 653);
    expect(lo.val).toBeCloseTo(Math.min(15, kid(lo, "Talent Value").val * LOG(10)), 12);
  });

  it("the inventory talents at a count of 0 still give coefficient x Atom 1 (getLOG(0) = 0, consumer @4204412)", () => {
    const t = plainTalent(wrapCtx({ SL_0: { 101: 5 }, InventoryOrder_0: [], ItemQTY_0: [], ChestOrder: [], ChestQuantity: [], Atoms: [0, 3, 0] }), 101);
    const atom = kid(t, "Atom Bonus (Helium)").val;
    expect(atom).toBeGreaterThan(0);
    expect(kid(t, "Copper Ore Owned (inv+storage)").val).toBe(0);
    expect(t.val).toBeCloseTo(kid(t, "Talent Value").val * atom, 12);
    expect(t.note).not.toMatch(/^Inactive/);
  });

  it("313 at Trapping 0 is max(1, tv) (exponent 1), 434 is pow(max(1, tv), kills)", () => {
    const t = plainTalent(wrapCtx({ SL_0: { 313: 5 }, Lv0_0: [100, 0, 0, 0, 0, 0, 0, 0] }), 313);
    expect(t.val).toBe(Math.max(1, kid(t, "Talent Value").val));
    expect(t.note).toMatch(/^pow\(max\(1,/);
    const c = wrapCtx({});
    expect(TALENT_WRAPS[434].wrap(0.5, 3, c)).toBe(1);
    expect(TALENT_WRAPS[434].wrap(2, 3, c)).toBe(8);
  });

  it("a wrap that comes out non-finite throws instead of reading 0", () => {
    const c = wrapCtx({ SL_0: { 638: 5 }, OptLacc: ola({ 71: 1000 }) });
    const spec = { ...TALENT_WRAPS[638], wrap: () => NaN };
    expect(() => applyWrap(c, spec, "x", 1, [], 0)).toThrow(/returned NaN/);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("compareTalent on the newest save (user decision 09/11)", () => {
  const path = () => newestSaves(goldenSaves(), 1)[0];
  const env = new Map<string, { charNames: string[] }>();
  afterAll(() => env.clear());

  for (const force of [false, true]) {
    it(`${force ? "forceSuperActive" : "plain"}: no difference outside PENDING and TALENT_KNOWN`, () => {
      const p = path();
      if (!env.has(p)) env.set(p, JSON.parse(readFileSync(p, "utf8")));
      const save = env.get(p)!;
      const out: string[] = [];
      resetCompared();
      let compared = 0;
      let skipped = 0;
      for (let ci = 0; ci < save.charNames.length; ci++) {
        const cls = TALENT_TABS_BY_CLASS[getCharClassKey(save, ci) ?? ""];
        if (!cls) continue;
        for (const id of cls.tabs.flatMap((t) => t.talents.map((e) => e.id))) {
          if (PENDING_WRAPS.has(id) || PENDING_BOOSTERS.has(id)) {
            skipped++;
            continue;
          }
          for (const presetIdx of [0, 1] as const) {
            const d = compareTalent(save, ci, id, { presetIdx, forceSuperActive: force });
            compared++;
            for (const [kind, list] of Object.entries(d)) for (const line of list) out.push(`${basename(p)}#${ci} talent ${id} preset ${presetIdx} ${kind}: ${line}`);
          }
        }
      }
      console.info(`[talent compare${force ? " forced" : ""}] ${compared} talents compared, ${skipped} skipped (wrap/booster), ${out.length} differences`);
      const sig = new Map<string, number>();
      for (const line of out) {
        const k = line.replace(/^\S+#\d+ talent (\d+) preset \d (\w+): /, "$1 $2: ").replace(/(\d+(\.\d+)?)/g, (m, _a, _b, off, str) => (str.slice(0, off).includes(": game") || /note|vs/.test(str.slice(0, off)) ? "N" : m));
        sig.set(k.slice(0, 260), (sig.get(k.slice(0, 260)) ?? 0) + 1);
      }
      for (const [k, n] of sig) console.info(`${n}x ${k}`);
      for (const line of out.slice(0, 30)) console.info(line);
      console.info(`[cap boosters compared, ${force ? "forced" : "plain"}] ` + [10, 11, 12, 23, 75, 79, 86, 87, 266, 267, 446, 447].map((i) => `${i}:${comparedIds.get(i) ?? 0}`).join(" "));
      const byKind = new Map<string, number[]>();
      for (const [id, spec] of Object.entries(TALENT_WRAPS)) if (!PENDING_WRAPS.has(+id) && comparedIds.has(+id)) byKind.set(spec.counterSource.kind, [...(byKind.get(spec.counterSource.kind) ?? []), +id]);
      console.info(`[wraps compared, ${force ? "forced" : "plain"}] ` + [...byKind].map(([k, ids]) => `${k}: ${ids.join(",")}`).join(" | "));
      expect(compared).toBeGreaterThan(100);
      expect(out.slice(0, 20)).toEqual([]);
    }, 900_000);
  }
});
