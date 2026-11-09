// Task 4 (Multikill plan): the Multikill adapter (lib/game/trackers/multikill.ts), WorkbenchStuff("MultiKillTOTAL") turned into the page's tree.
//
// - the display config and the page's pure formula moved to lib/multikill/layers (Ruling B), lib/arkh re-exporting the very same objects; the tracker registry;
// - on a synthetic envelope (CI): the tree's shape, the sources' values, the tier's rows (the curses, the clam), the rule rows (the soft cap, the Cove), the status row and its guarded reads,
//   the `assumed:` leaves kept on the page, the recombination guard (TreeTotalMismatch), the page's model giving the total back and its levers resolving;
// - on every real save, character and map (251, 301, 306, 216, 14, 150, 40 and 33: the maps of njs/multikill.test.ts): the total is the one call (that test proves it against lib/arkh, pair by pair, with
//   the exact KNOWN proofs; here a total that differs from lib/arkh's must be covered by a KNOWN row of the pair, and the count is the one that test asserts), every source and every diagnostic row against
//   lib/arkh's, the names, formats and notes equal to lib/arkh's, the page's model giving the total back from the flat tree, the size (Ruling L, at most 2x lib/arkh's nodes), and every runtime: / assumed:
//   note of the full trace kept;
// - the Multikill readings in the game's display format (skipped until fixtures/readings.json has a multikill entry, Ruling MM).
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhMkLeaves, arkhMkShape, arkhMultikill, type MkShape } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import * as arkhDef from "@/lib/arkh/stats/defs/multikill";
import * as layers from "@/lib/multikill/layers";
import { multikillGainsModel, partsFromFlat } from "@/lib/multikill/gains";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { makeCtx, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { MapDetails, MONSTERS } from "@/lib/game/data";
import { InvalidSaveValue, MissingSaveKey, TreeTotalMismatch } from "@/lib/game/errors";
import { Holes } from "@/lib/game/njs/Holes";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { computeGameMultikill, multikillTree } from "@/lib/game/trackers/multikill";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatResult } from "@/lib/statTracker/config";
import { type Data, type Seeds, synth } from "../support/expStub";

// the guard test makes the block disagree with its own halves once: the real block otherwise (a hook, not vi.fn: vi.fn keeps every call's arguments, a Ctx with its trace, which the real-save loops would pile up past the heap)
type Wb = (c: Ctx, d: string, b: number, e: number) => number;
const hook = vi.hoisted(() => ({ once: null as null | ((real: Wb, c: Ctx, b: number, e: number) => number) }));
vi.mock("@/lib/game/njs/WorkbenchStuff", async (orig) => {
  const actual = await orig<typeof import("@/lib/game/njs/WorkbenchStuff")>();
  return {
    ...actual,
    WorkbenchStuff: (c: Ctx, d: string, b: number, e: number) => {
      const f = "MultiKillTOTAL" === d ? hook.once : null;
      if (f) hook.once = null;
      return f ? f(actual.WorkbenchStuff as Wb, c, b, e) : (actual.WorkbenchStuff as Wb)(c, d, b, e);
    },
  };
});
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";

type Node = StatResult["tree"];
const { MK_NODES, MK_POOLS, MK_ROOT, MK_RULES, mkHalves } = layers;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const noSaves = GOLDEN_SAVES.length === 0;
const count = (n: Node): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
const FLAG = /^(runtime|assumed):/;
const flagsOfTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(flagsOfTrace)];
const flagsOfTree = (n: Node): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(flagsOfTree)];
const noMigrated = (note?: string) => note?.replace(/ · migrated from an older game version \(\d+ load steps?\)$/, "");
const kid = (n: Node, name: string) => {
  const k = n.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n.name}": ${n.children?.map((c) => c.name)}`);
  return k;
};

// ── the display config and the registry ─────────────────────────────────────────────────────────
describe("the display config and the registry", () => {
  it("lives in lib/multikill/layers and lib/arkh re-exports the very same objects (Ruling B)", () => {
    expect(arkhDef.MK_ROOT).toBe(layers.MK_ROOT);
    expect(arkhDef.MK_NODES).toBe(layers.MK_NODES);
    expect(arkhDef.MK_RULES).toBe(layers.MK_RULES);
    expect(arkhDef.MK_POOLS).toBe(layers.MK_POOLS);
    expect(arkhDef.mkSoftCap).toBe(layers.mkSoftCap);
    expect(arkhDef.mkHalves).toBe(layers.mkHalves);
    expect(arkhDef.mkTotal).toBe(layers.mkTotal);
    expect(MK_POOLS.base).toHaveLength(9);
    expect(MK_POOLS.perTier).toHaveLength(18);
  });

  it('TRACKERS.multikill is WorkbenchStuff("MultiKillTOTAL")', () => {
    expect(TRACKERS.multikill!(synth(DATA, { seeds: { ...SET, 'WorkbenchStuff["MultiKillTOTAL",0,0]': 7 } }))).toBe(7);
    expect(TRACKERS.multikill!(ctxOf())).toBe(tree().total);
  });
});

// ── the tree on a synthetic envelope (CI) ───────────────────────────────────────────────────────
// Every block the halves call answers 0 unless seeded (expStub's ZeroCache); `REAL` lists the ones left to their code: the three blocks of the total and the status row.
const REAL = ['WorkbenchStuff["MultiKill', 'RunCodeOfTypeXforThingY["OverkillStuffs"'];
const HP_251 = 3e9; // MonsterDefinitions.w6a1
const SET: Seeds = {
  'DNSM.StarSigns["MultiKill"]': 15, "SaltLick[8]": 30, 'StampBonusOfTypeX["Overkill"]': 2.5, 'EtcBonuses["29"]': 1.5, "AchieveStatus[148]": 7, "AchieveStatus[122]": 1, "AchieveStatus[123]": 1, 'ArbitraryCode["StatueOnyxOwned"]': 3, "GetTalentNumber[1,654]": 4,
  'WorkbenchStuff["OverkillQTY",5,0]': 100, 'WorkbenchStuff["OverkillQTY",7,0]': 8, 'DNSM.AlchVials["Overkill"]': 5, "getbonus2[1,58,-1]": 3, "ArcadeBonus[8]": 2,
  'DamageDealed["Max"]': 1.3e10, "PlayerAccTot[]": 1e6,
};
const DATA: Data = { Tower: [0, 0, 5], OptLacc: Object.assign(Array<number>(700).fill(0), { 158: 25 }) };
const ctxOf = (extra: Data = {}, seeds: Seeds = {}, o: { map?: number; real?: string[] } = {}) => synth({ ...DATA, ...extra }, { map: o.map, seeds: { ...SET, ...seeds }, real: [...REAL, ...(o.real ?? [])], trace: true });
const tree = (extra: Data = {}, seeds: Seeds = {}, o: { map?: number; real?: string[] } = {}) => multikillTree(ctxOf(extra, seeds, o));

// B = 15 + 30 + 2.5 + 2 x 5 + 1.5 + min(5, 7) + 6 + 2 + 3 x 4; P = 100 + 8 + 5 + 3 x floor(25 / 5) + 2; on map 251 Max 1.3e10 reaches HP x 2 x 2 (1.2e10) and not x 2 x 4: tier 2
const B = 84;
const P = 130;
describe("the tree on a synthetic envelope (runs in CI)", () => {
  it("has lib/arkh's shape: the halves, the tier and the status, each source in MK_POOLS order and a value of its own", () => {
    const { tree: t, total } = tree();
    expect(total).toBe(B + 2 * P);
    expect(t).toMatchObject({ name: MK_ROOT, val: total, fmt: "%" });
    expect(noMigrated(t.note)).toBe("⌊B′ + T × P′⌋");
    expect(t.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    const [base, tier, perTier, active] = t.children!;
    expect(base).toMatchObject({ val: B, fmt: "+", note: "B′" });
    expect(perTier).toMatchObject({ val: P, fmt: "+", note: "P′ (× Damage Tier)" });
    expect(tier).toMatchObject({ val: 2, fmt: "raw", note: "Map 251 · w6a1" });
    expect(active.fmt).toBe("raw");
    expect(base.children).toHaveLength(9);
    expect(perTier.children).toHaveLength(18);
    expect(base.children!.map((c) => c.val)).toEqual([15, 30, 2.5, 10, 1.5, 5, 6, 2, 12]);
    expect(perTier.children!.map((c) => c.val)).toEqual([100, 8, 5, 0, 15, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(base.children![3].children).toEqual([{ name: "TowerInfo[2]", val: 5, fmt: "raw", note: "Building level" }]); // a read of the save is a leaf with a note
    expect(base.children![0].children).toEqual([{ name: 'DNSM.StarSigns("MultiKill")', val: 15, fmt: "raw", note: "cached" }]); // a source carries the call it stands for
    expect(base.children!.concat(perTier.children!).every((c) => c.fmt === "+")).toBe(true);
    // the page's model gives the total back from the flat tree
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(total);
  });

  it("the Death Note row carries the world of the map", () => {
    const row = (map: number, seeds: Seeds = {}) => kid(tree({}, seeds, { map }).tree, MK_NODES.perTier).children![0].name;
    expect(row(251)).toBe("Death Note (W6 page)");
    expect(row(40)).toBe("Death Note (W1 page)");
    expect(row(301)).toBe("Death Note (W7 page)");
  });

  it("the tier's rows: Max Damage is the call the tier used, the HP is the curses over the static HP, the thresholds follow the tier", () => {
    const c = { 'prayersReal[0,1]': 10, 'prayersReal[7,1]': 20, 'prayersReal[8,1]': 30, 'DamageDealed["Max"]': 2.1e10 };
    const t = kid(tree({}, c).tree, MK_NODES.tier);
    const hp = HP_251 * 1.6;
    expect(t.val).toBe(2); // 2.1e10 reaches HP x 4 (1.92e10), not HP x 8
    expect(t.children!.map((n) => n.name)).toEqual(["Max Damage", "Target HP", "Exponent", "Tier reached at", "Next tier at"]);
    expect(t.children![0]).toMatchObject({ val: 2.1e10, fmt: "raw" });
    expect(t.children![0].children![0].name).toBe('DamageDealed("Max")');
    expect(t.children![1]).toMatchObject({ val: hp, fmt: "raw" });
    expect(t.children![1].children!.map((n) => [n.name, n.val, n.fmt])).toEqual([["Static HP", HP_251, "raw"], ["Prayer curses", 1.6, "x"]]);
    expect(t.children![1].children![1].children!.map((n) => [n.name, n.val, n.fmt])).toEqual([["Curse: Big Brain Time (Prayer 0)", 10, "raw"], ["Curse: Midas Minded (Prayer 7)", 20, "raw"], ["Curse: Jawbreaker (Prayer 8)", 30, "raw"]]);
    expect(t.children![2].val).toBe(2);
    expect(t.children![3].val).toBeCloseTo(hp * 4, 3); // OverkillStuffs("0"): HP x E x E^(T - 1)
    expect(t.children![4].val).toBeCloseTo(hp * 8, 3); // OverkillStuffs("1"): HP x E x E^T
    // tier 1: reached at the HP itself
    expect(kid(kid(tree({}, { 'DamageDealed["Max"]': 1 }).tree, MK_NODES.tier), "Tier reached at").val).toBe(HP_251);
  });

  it("the Clamworks clam: its own HP, no curses", () => {
    const t = kid(tree({}, { 'Thingies["Clamz_HP",0,0]': 1e6, 'prayersReal[0,1]': 10 }, { map: 306 }).tree, MK_NODES.tierW7);
    expect(t.note).toBe("Map 306 · w7a6");
    expect(kid(t, "Target HP").val).toBe(1e6);
    expect(kid(t, "Target HP").children).toHaveLength(1);
    expect(kid(t, "Target HP").children![0]).toMatchObject({ name: "Clamworks HP", val: 1e6, fmt: "raw", note: "1e16 × 30^OLA[464]" });
  });

  it("the Rift's monster: the static HP is the call the block made", () => {
    const t = kid(tree({ CurrentMap_0: 251, AFKtarget_0: "riftAll" }, { 'RiftStuff["mobHP",0]': 77 }).tree, MK_NODES.tier);
    expect(kid(kid(t, "Target HP"), "Static HP").val).toBe(77);
    expect(kid(kid(t, "Target HP"), "Static HP").children![0].name).toBe('RiftStuff("mobHP", 0)');
  });

  it("the W7 soft cap: a rule row in each half, the tier named by its ladder, and the page's model agrees exactly", () => {
    const { tree: t, total } = tree({}, { 'WorkbenchStuff["OverkillQTY",6,0]': 100, 'DamageDealed["Max"]': 1 }, { map: 301 });
    expect(t.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tierW7, MK_NODES.perTier, MK_NODES.active]);
    const [base, tier, perTier] = t.children!;
    expect(tier.val).toBe(1);
    expect(kid(tier, "Exponent").val).toBe(5);
    expect(base.children).toHaveLength(10);
    expect(base.children![9].name).toBe(MK_RULES.softCap);
    // 84 falls in [50, 100): 47.3 + 34 / 1.5; 130 in [100, 150): 80.6 + 30 / 5
    expect(base.val).toBeCloseTo(47.3 + 34 / 1.5, 12);
    expect(base.children![9]).toMatchObject({ val: base.val, fmt: "+", note: "Σ 84.00 → 69.967 · reduced by ~17%" });
    expect(perTier.val).toBeCloseTo(86.6, 12);
    expect(perTier.children![18]).toMatchObject({ val: perTier.val, fmt: "+", note: "Σ 130.00 → 86.600 · reduced by ~33%" });
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(total);
  });

  it("the Crystal Glunko Cove: each half's value is the Cove's, with a rule row saying what it replaced", () => {
    const seeds = { 'DamageDealed["Max"]': 170, 'WorkbenchStuff["OverkillQTY",4,0]': 100, 'Holes2["Cglunko_MKbase",0,0]': 3800, 'Holes2["Cglunko_MKtier",0,0]': 46 };
    const { tree: t, total } = tree({ Holes: [[17]] }, seeds, { map: 216 });
    const [base, , perTier] = t.children!;
    expect(base.val).toBe(3800);
    expect(perTier.val).toBe(46);
    expect(total).toBe(3800 + 2 * 46);
    expect(base.children![9]).toEqual({ name: MK_RULES.cove, val: 3800, fmt: "+", note: "replaces Σ 84.00 (map 216, cavern 17)" });
    expect(perTier.children![18]).toEqual({ name: MK_RULES.cove, val: 46, fmt: "+", note: "replaces Σ 130.00 (map 216, cavern 17)" });
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(total);
    // another cavern: no row, no replacement
    const off = tree({ Holes: [[16]] }, seeds, { map: 216 }).tree;
    expect(off.children![0].children).toHaveLength(9);
  });

  it("the status row: the game's three gates, and the note of each outcome", () => {
    const active = (extra: Data = {}, seeds: Seeds = {}) => kid(tree(extra, seeds).tree, MK_NODES.active);
    const on = active();
    expect(on).toMatchObject({ val: 1, note: "the AFK Info shows the MULTIKILL line" });
    expect(on.children!.map((c) => [c.name, c.val, c.note])).toEqual([
      ["Max damage vs target HP", 1, "maxDamage ≥ HP × E (E = the Exponent row)"],
      ["Death Note built", 1, "TowerInfo[2] > 0.5"],
      ["Accuracy beats the target's Defence", 1, "Accuracy > 1.5 × target Defence"],
    ]);
    const defence = (MONSTERS as unknown as Record<string, { Defence: number }>).w6a1.Defence;
    expect(kid(on, "Accuracy beats the target's Defence").children!.map((c) => [c.name, c.val])).toEqual([["Accuracy", 1e6], ["Target Defence", defence]]);
    // each gate alone turns it off
    expect(active({}, { 'DamageDealed["Max"]': HP_251 })).toMatchObject({ val: 0, note: "inactive: the game applies no multikill" });
    expect(kid(active({}, { 'DamageDealed["Max"]': HP_251 }), "Max damage vs target HP").val).toBe(0);
    expect(kid(active({ Tower: [0, 0, 0] }), "Death Note built").val).toBe(0);
    expect(active({ Tower: [0, 0, 0] }).val).toBe(0);
    expect(kid(active({}, { "PlayerAccTot[]": defence * 1.5 }), "Accuracy beats the target's Defence").val).toBe(0);
    expect(active({}, { "PlayerAccTot[]": defence * 1.5 }).val).toBe(0);
    // a target that is no fight: on, and the line is hidden
    const mine = active({ CurrentMap_0: 251, AFKtarget_0: "Copper" });
    expect((MONSTERS as unknown as Record<string, { AFKtype: string }>).Copper.AFKtype).toBe("MINING");
    expect(mine).toMatchObject({ val: 1, note: "the AFK Info hides the MULTIKILL line (Copper is MINING)" });
  });

  it("a status read that throws is a noted 0, its flagged notes kept: the block computed, so the page does not fail", () => {
    // PlayerAccTot left to its code: this envelope has no CharacterClass_0, so it throws after its masterclass check (a `runtime:` leaf), and OverkillStuffs("3") with it (its first two gates pass)
    const { "PlayerAccTot[]": _seeded, ...seeds } = SET;
    const c = synth(DATA, { seeds: { ...seeds, "Dungon[]": -1 }, real: [...REAL, "PlayerAccTot[", 'Summoning["GrimoireWraith"'], trace: true });
    const { tree: t, total } = multikillTree(c);
    expect(total).toBe(B + 2 * P);
    const active = kid(t, MK_NODES.active);
    const accuracy = kid(kid(active, "Accuracy beats the target's Defence"), "Accuracy");
    expect(accuracy.val).toBe(0);
    expect(accuracy.note).toMatch(/^not read: /);
    expect(active.val).toBe(0);
    expect(active.note).toMatch(/^not read: /);
    expect(active.children).toHaveLength(3);
    expect(kid(active, "Accuracy beats the target's Defence").val).toBe(0);
    expect(flagsOfTree(accuracy)).toEqual(["runtime: masterclass form, not counted|0"]);
    expect(flagsOfTree(t).sort()).toEqual(flagsOfTrace(c.trace!).sort());
  });

  it("the `assumed:` leaves stay on the page, inside the row whose call reaches them", () => {
    // OverkillQTY left to its code says it read the table as after its build (DNSM.OKqtyZZ): the Death Note row of map 40 keeps that note
    const kla = Array.from({ length: (MapDetails as unknown as unknown[]).length }, () => [0]);
    const ninja = Array.from({ length: 110 }, () => Array<number>(20).fill(0));
    const { tree: t } = tree({ KLA_0: kla, Ninja: ninja }, {}, { map: 40, real: ['WorkbenchStuff["OverkillQTY",0'] });
    const row = kid(kid(t, MK_NODES.perTier), "Death Note (W1 page)");
    expect(flagsOfTree(row)).toHaveLength(1);
    expect(flagsOfTree(row)[0]).toMatch(/^assumed: the Death Note table built from the save/);
    expect(flagsOfTree(t)).toEqual(flagsOfTree(row)); // and nowhere else
  });

  it("the page's levers read the tier's rows by name", () => {
    const flat = flattenTree(tree().tree);
    const [lever] = multikillGainsModel.levers!(flat);
    // next tier at HP x 2 x 2^2 = 2.4e10, against a Max of 1.3e10
    expect(lever).toMatchObject({ source: "+1 damage tier", you: 2, max: 3, display: "raw" });
    expect(lever.group).toContain("needs ×1.85 more max damage");
    expect(flat[`${MK_ROOT} / ${MK_NODES.tier} / Exponent`]).toBe(2);
    // the Biggest Gains sources are the halves' rows, without the rule rows
    const w7 = flattenTree(tree({}, { 'DamageDealed["Max"]': 1 }, { map: 301 }).tree);
    const names = multikillGainsModel.sources(w7, {}).map((s) => s.source);
    expect(names).toHaveLength(27);
    expect(names).not.toContain(MK_RULES.softCap);
    expect(MULTIKILL_PAGE.gains).toBe(multikillGainsModel);
  });

  it('the total is the one WorkbenchStuff("MultiKillTOTAL") call: the tree adds no second computation', () => {
    const c = ctxOf();
    const { total } = multikillTree(c);
    expect(c.trace!.children.filter((n) => n.block === "WorkbenchStuff" && n.args[0] === "MultiKillTOTAL" && n.note !== "cached")).toHaveLength(1);
    expect(total).toBe(WorkbenchStuff(synth(DATA, { seeds: SET, real: REAL }), "MultiKillTOTAL", 0, 0));
    expect(() => multikillTree(synth(DATA, { seeds: SET, real: REAL }))).toThrow(/has none/);
  });

  // The page's Biggest Gains rebuilds the total from the tree's numbers: if the halves no longer give the call's total, the tree must not be shown (spec section 4).
  it("throws TreeTotalMismatch when the tree no longer gives the call's total (one point is enough: the total is a floored integer)", () => {
    hook.once = (real, c, b, e) => real(c, "MultiKillTOTAL", b, e) + 1;
    let caught: unknown;
    try {
      tree();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TreeTotalMismatch);
    expect((caught as TreeTotalMismatch).rebuilt).toBe((caught as TreeTotalMismatch).total - 1);
    expect(() => tree()).not.toThrow();
  });

  // N.js nests its additions and the page's model adds left to right: these ten per-tier terms are 176.49999999999997 the first way and 176.5 the other, so 10 + 2 x P floors to 362 and 363 with every term right.
  it("a floor that differs only by the order of the additions does not fire the guard", () => {
    const seeds: Seeds = {
      "SaltLick[8]": 10,
      'WorkbenchStuff["OverkillQTY",5,0]': 13.1, 'WorkbenchStuff["OverkillQTY",7,0]': 18.7, 'DNSM.AlchVials["Overkill"]': 16.5, "GetBuffBonuses[46,2]": 12.6, "getbonus2[1,58,-1]": 23.8,
      "ArcadeBonus[8]": 7, 'Sailing["ArtifactBonus",26,0]': 27.8, "GetBuffBonuses[469,2]": 20.2, 'chipBonuses["mkill"]': 15.8, 'EtcBonuses["71"]': 21,
      'DamageDealed["Max"]': 1.3e10, "PlayerAccTot[]": 1e6,
    };
    const { tree: t, total } = multikillTree(synth({ Tower: [0, 0, 0], OptLacc: Object.assign(Array<number>(700).fill(0), { 158: 5 }) }, { seeds, real: REAL, trace: true }));
    expect(total).toBe(362);
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(363);
    expect(kid(t, MK_NODES.perTier).val).toBe(176.49999999999997);
  });

  it.each([["base", "ach123"], ["perTier", "arcade8"]] as const)("a source the %s half lost (%s) throws TreeTotalMismatch: the call's half no longer matches the tree's", (half, id) => {
    const pools = MK_POOLS as Record<string, readonly string[]>;
    const whole = pools[half];
    pools[half] = whole.filter((x) => x !== id);
    try {
      expect(() => tree()).toThrow(TreeTotalMismatch);
    } finally {
      pools[half] = whole;
    }
    expect(() => tree()).not.toThrow();
  });

  it("a map with no monster on its target is refused, as the block refuses it", () => {
    expect(() => tree({}, {}, { map: 33 })).toThrow(InvalidSaveValue);
  });
});

// ── every real save, character and map ──────────────────────────────────────────────────────────
/**
 * Exact, per map: `known`, the pairs whose total differs from lib/arkh's and a KNOWN row closes (njs/multikill.test.ts's figure, which proves each); `motherlode`, the pairs whose Target Defence row differs because
 * N.js @6516949 gives the Motherlode's four targets Holes("MotherlodeEffBase", i, 0) as their Defence (the fish's / 4) and lib/arkh's overkillActive reads the table's: each is checked to be exactly those two numbers below.
 */
const MAPS: Record<number, { known: number; motherlode: number }> = {
  251: { known: 4, motherlode: 0 },
  301: { known: 2, motherlode: 0 },
  306: { known: 0, motherlode: 0 },
  216: { known: 2, motherlode: 24 },
  14: { known: 3, motherlode: 0 },
  150: { known: 2, motherlode: 0 },
  40: { known: 5, motherlode: 0 },
};
const MOTHERLODE = ["Motherlode", "Bug14", "MotherlodeTREE", "MotherlodeFISH"];
const PAIRS = 1153;
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"]; // Ruling E (njs/multikill.test.ts)
/** The rows whose number differs between the engines for causes proved elsewhere (the Damage KNOWN rows, lib/arkh's accuracy) or below (the Motherlode's Defence), not for anything of this adapter's. */
const OWN_NUMBER = new Set(["Max Damage", "Accuracy", "Target Defence"]);

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

/** Names, formats, notes (and, with `vals`, the numbers) of a tree against lib/arkh's. A row lib/arkh gives no children keeps the calls Ruling L hangs under it. */
function compare(mine: Node, theirs: MkShape, at: string, shapes: string[], values: string[], vals: boolean): void {
  const s = (n: { name: string; fmt?: string; note?: string }) => JSON.stringify([n.name, n.fmt, n.note]);
  if (s(mine) !== s(theirs)) shapes.push(`${at}: ${s(mine)} vs ${s(theirs)}`);
  if (vals && !OWN_NUMBER.has(mine.name) && !rel(mine.val, theirs.val)) values.push(`${at} ${mine.name}: game ${mine.val}, arkh ${theirs.val}`);
  if (!theirs.children) return;
  if (mine.children?.length !== theirs.children.length) {
    shapes.push(`${at} ${mine.name}: ${mine.children?.length} children vs ${theirs.children.length}: ${mine.children?.map((c) => c.name)}`);
    return;
  }
  theirs.children.forEach((c, i) => compare(mine.children![i], c, at, shapes, values, vals));
}

describe.skipIf(noSaves)("computeGameMultikill against lib/arkh on every real save, character and map", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const leafMismatches: string[] = [];
      const shapeMismatches: string[] = [];
      const valueMismatches: string[] = [];
      const display: string[] = [];
      const lost: string[] = [];
      const over: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let known = 0;
      let leafKnown = 0;
      let motherlode = 0;
      let floorFlips = 0;
      let flags = 0;
      let worstRatio = 0;
      let nodes = 0;
      let arkhNodes = 0;
      for (const path of GOLDEN_SAVES) {
        const file = basename(path);
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map, trace: true });
          let r: StatResult;
          try {
            r = multikillTree(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${file}: ${e.key}`);
            continue;
          }
          pairs++;
          const tree = r.tree;
          const at = `${file}#${ci}@${map}`;
          const arkh = arkhMkShape(path, ci, map);
          // the size (Ruling L): at most 2x lib/arkh's nodes
          nodes += count(tree);
          arkhNodes += arkh.nodes;
          worstRatio = Math.max(worstRatio, count(tree) / arkh.nodes);
          if (count(tree) > 2 * arkh.nodes) over.push(`${at}: ${count(tree)} nodes against ${arkh.nodes}`);
          // the total is the call's (the adapter adds nothing), and lib/arkh's, or a KNOWN row of the pair explains the difference
          if (r.total !== TRACKERS.multikill!({ ...ctx, trace: null })) mismatches.push(`${at}: the tree's total is not MultiKillTOTAL's`);
          const rows = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "mk" && d.save === file && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
          const want = arkhMultikill(path, ci, map);
          if (r.total !== want) {
            if (!rows.length) mismatches.push(`${at}: game ${r.total}, arkh ${want}`);
            else known++;
          }
          // every flagged note of the full trace is on the page
          const full = flagsOfTrace(ctx.trace!).sort();
          flags += full.length;
          if (JSON.stringify(flagsOfTree(tree).sort()) !== JSON.stringify(full)) lost.push(`${at}: full trace ${full.length} notes, page tree ${flagsOfTree(tree).length}`);
          // names, formats, notes, values: lib/arkh's (the Observed Max data is keyed by them). The migrated note is lib/game's alone. A pair whose tier a KNOWN row explains has its thresholds on another step: its numbers are not compared.
          const myTier = tree.children![1];
          compare({ ...tree, note: noMigrated(tree.note) }, arkh.shape, at, shapeMismatches, valueMismatches, !rows.length);
          const myDefence = kid(kid(tree.children![3], "Accuracy beats the target's Defence"), "Target Defence").val;
          const theirDefence = arkh.shape.children![3].children![2].children![1].val;
          if (!rel(myDefence, theirDefence)) {
            const target = myTier.note!.split(" · ")[1];
            const i = MOTHERLODE.indexOf(target);
            const table = (MONSTERS as unknown as Record<string, { Defence: number }>)[target].Defence;
            if (0 <= i && theirDefence === table && myDefence === Holes({ ...ctx, trace: null }, "MotherlodeEffBase", i, 0) / (3 === i ? 4 : 1)) motherlode++;
            else valueMismatches.push(`${at} Target Defence: game ${myDefence}, arkh ${theirDefence}, target ${target}`);
          }
          const leaves = arkhMkLeaves(path, ci, map);
          const check = (id: string, mine: number) => {
            if (rel(mine, leaves[id])) return;
            if (rows.some((d) => d.source === id)) leafKnown++;
            else leafMismatches.push(`${at} ${id}: game ${mine}, arkh ${leaves[id]}`);
          };
          MK_POOLS.base.forEach((id, k) => check(id, tree.children![0].children![k].val));
          MK_POOLS.perTier.forEach((id, k) => check(id, tree.children![2].children![k].val));
          check("tier", myTier.val);
          check("active", tree.children![3].val);
          check("softCap", tree.children![0].children![9]?.name === MK_RULES.softCap ? 1 : 0);
          check("cove", tree.children![0].children![9]?.name === MK_RULES.cove ? 1 : 0);
          // display and value agree: the page's model gives the total back from the flat tree, and the levers read the tier's rows
          const flat = flattenTree(tree);
          // the page's own model: the same total, or a floor one apart only when the halves agree (N.js nests its additions, the model adds left to right)
          const fromFlat = multikillGainsModel.totalFromFlat(flat);
          const halves = mkHalves(partsFromFlat(flat));
          if (fromFlat !== r.total) floorFlips++;
          if (Math.abs(fromFlat - r.total) > 1 || !rel(halves.base, tree.children![0].val) || !rel(halves.perTier, tree.children![2].val)) display.push(`${at}: the flat tree gives ${fromFlat} (halves ${halves.base}, ${halves.perTier}), the call ${r.total}`);
          if (tree.val !== r.total) display.push(`${at}: root ${tree.val} is not the total ${r.total}`);
          for (const row of ["Exponent", "Next tier at", "Max Damage"]) if (typeof flat[`${MK_ROOT} / ${myTier.name} / ${row}`] !== "number") display.push(`${at}: no ${row} row`);
          if (kid(myTier, "Max Damage").val !== TRACKERS.damage!({ ...ctx, trace: null })) display.push(`${at}: Max Damage is not DamageDealed("Max")`);
        }
      }
      states.clear(); // the states (each a deep clone) kept across the maps would pass the heap
      console.info(
        `[multikill adapter @${map}] ${pairs} pairs, ${known} known, ${leafKnown} known leaves, ${motherlode} Motherlode defences, ${floorFlips} floor flips, ${mismatches.length} total, ${leafMismatches.length} leaf, ${shapeMismatches.length} shape and ${valueMismatches.length} value mismatches, ${flags} flagged notes, size ${nodes} nodes against ${arkhNodes} (worst ratio ${worstRatio.toFixed(2)}), ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`
      );
      for (const m of [...mismatches.slice(0, 5), ...leafMismatches.slice(0, 10), ...shapeMismatches.slice(0, 10), ...valueMismatches.slice(0, 10)]) console.info(`[multikill adapter @${map}] ${m}`);
      expect(over).toEqual([]);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(leafMismatches.slice(0, 20)).toEqual([]);
      expect(shapeMismatches.slice(0, 20)).toEqual([]);
      expect(valueMismatches.slice(0, 20)).toEqual([]);
      expect(display.slice(0, 20)).toEqual([]);
      expect(lost.slice(0, 20)).toEqual([]);
      expect(pairs, "saves x characters, less the refused").toBe(PAIRS);
      expect(known, "pairs whose total differs from lib/arkh's and a KNOWN row closes (njs/multikill.test.ts's figure)").toBe(MAPS[map].known);
      expect(leafKnown, "the tier leaves those pairs differ on").toBe(MAPS[map].known);
      expect(motherlode, "pairs whose Target Defence is the Motherlode's and lib/arkh's the table's").toBe(MAPS[map].motherlode);
      expect([...refused].sort()).toEqual(HOURZERO);
    }, 3_600_000);
  }

  it("map 33: no monster on its target, so the tracker refuses every character as the block does", () => {
    const invalid = new Set<string>();
    const refused = new Set<string>();
    const answered: string[] = [];
    let threw = 0;
    for (const path of GOLDEN_SAVES) {
      const state = stateOf(path);
      for (let ci = 0; ci < state.charNames.length; ci++) {
        try {
          answered.push(`${basename(path)}#${ci}: ${multikillTree(makeCtx(state, { player: ci, map: 33, trace: true })).total}`);
        } catch (e) {
          if (e instanceof InvalidSaveValue) {
            threw++;
            invalid.add(e.message);
          } else if (e instanceof MissingSaveKey) refused.add(`${basename(path)}: ${e.key}`);
          else throw e;
        }
      }
    }
    console.info(`[multikill adapter @33] ${threw} refused (InvalidSaveValue) ${JSON.stringify([...invalid])}, ${refused.size} refused for other reasons, ${answered.length} answered`);
    expect(answered.slice(0, 20)).toEqual([]);
    expect([...invalid], "the cause: map 33's AFK target, not any other bad value").toEqual(['AFKtarget: expected a MonsterDefinitions key, got string "Z"']); // MapAFKtarget[33]
    expect(threw).toBe(PAIRS);
    expect([...refused].sort()).toEqual(HOURZERO);
  }, 1_800_000);
});

// ── the game's own text ─────────────────────────────────────────────────────────────────────────
// No Multikill in-game reading is recorded yet (the controller records them, Ruling MM): the test skips cleanly while fixtures/readings.json has no multikill entry, and runs the day one is added.
describe("the Multikill readings, through the adapter (the MULTIKILL line of the AFK Info)", () => {
  const rows = loadReadings().filter((r) => r.stat === "multikill");
  if (rows.length === 0) it.skip("no multikill reading in fixtures/readings.json yet (Ruling MM)", () => {});
  for (const r of rows) {
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("multikill") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const { total } = computeGameMultikill(readingSave(r), r.charIdx, r.map);
      const site = formatGameValue("multikill", { value: total });
      console.info(`[multikill adapter] ${r.id}: game ${r.game}, ours ${site}`);
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
  }
});
