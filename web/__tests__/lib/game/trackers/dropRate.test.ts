// Task 4 (DR plan): the Drop Rate adapter (lib/game/trackers/dropRate.ts), TotalStats("Drop_Rarity") turned into the page's tree.
//
// - the display config in lib/dropRateV2/layers (Ruling B); the tracker registry;
// - on a synthetic envelope (CI): the tree's shape, the sources' values, the chip (an `add` group under 5) and the Cove (a `replace` group), the
//   recombination guard (TreeTotalMismatch), the page's Biggest Gains model giving the total back, the refToggle group path still resolving;
// - on every real save, character and map (251, 216, 150, 40, 33): the total is the one TotalStats("Drop_Rarity") call, one tree node per group,
//   the page's Biggest Gains model giving the total back from the flat tree, and every runtime: / assumed: note of the full trace kept;
// - the Drop Rate readings in the game's display format (skipped until fixtures/readings.json has a dropRateV2 entry, Ruling MM).
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { GOLDEN_SAVES } from "../support/saves";
import * as layers from "@/lib/dropRateV2/layers";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { makeCtx, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { MissingSaveKey, TreeTotalMismatch } from "@/lib/game/errors";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { computeGameDropRate, dropRateTree } from "@/lib/game/trackers/dropRate";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatResult } from "@/lib/statTracker/config";
import { type Data, type Seeds, synth, WB } from "../support/expStub";

// the guard test makes the block disagree with its own sources once: the real block otherwise (a hook, not vi.fn: vi.fn keeps every call's arguments,
// a Ctx with its trace, which the real-save loops below would pile up past the heap)
const hook = vi.hoisted(() => ({ once: null as null | ((real: (c: Ctx, d: string) => number, c: Ctx, d: string) => number) }));
vi.mock("@/lib/game/njs/TotalStats", async (orig) => {
  const actual = await orig<typeof import("@/lib/game/njs/TotalStats")>();
  return {
    ...actual,
    TotalStats: (c: Ctx, d: string) => {
      const f = "Drop_Rarity" === d ? hook.once : null;
      if (f) hook.once = null;
      return f ? f(actual.TotalStats as never, c, d) : (actual.TotalStats as (c: Ctx, d: string) => number)(c, d);
    },
  };
});
import { TotalStats } from "@/lib/game/njs/TotalStats";

type Node = StatResult["tree"];
const { DR2_GROUPS, DR2_ROOT } = layers;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const noSaves = GOLDEN_SAVES.length === 0;
const count = (n: Node): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
const FLAG = /^(runtime|assumed):/;
const flagsOfTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(flagsOfTrace)];
const flagsOfTree = (n: Node): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(flagsOfTree)];
const ALL_IDS = DR2_GROUPS.flatMap((g) => g.sources);
const gi = (key: string) => DR2_GROUPS.findIndex((g) => g.key === key);
const noMigrated = (note?: string) => note?.replace(/^migrated from an older game version \(\d+ load steps?\)$/, "") || undefined;

// ── the display config and the registry ─────────────────────────────────────────────────────────
describe("the display config and the registry", () => {
  it("lives in lib/dropRateV2/layers: 79 distinct sources (Ruling B)", () => {
    expect(ALL_IDS).toHaveLength(79);
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
  });

  it("the page's Biggest Gains model reads the same config and leaves the weekly vote out", () => {
    const base = `${DR2_ROOT} / ${DR2_GROUPS[gi("base")].name}`;
    const yours: Record<string, number> = { [`${base} / ${layers.DR2_VOTE_NAME}`]: 0 };
    const ref: Record<string, number> = { [`${base} / ${layers.DR2_VOTE_NAME}`]: 30 };
    expect(DR2_PAGE.gains.sources(yours, ref)).toEqual([]);
  });

  it("TRACKERS.dropRateV2 is TotalStats(\"Drop_Rarity\") (the Drop Rate line of Player Info)", () => {
    expect(TRACKERS.dropRateV2!(synth({ Dream: Array<number>(20).fill(0) }, { seeds: WB, real: REAL }))).toBe(1);
  });
});

// ── the tree on a synthetic envelope (CI) ───────────────────────────────────────────────────────
// Every block the block calls answers 0 unless seeded (expStub's ZeroCache); `REAL` lists the ones left to their code: the block itself and Dungon.
const REAL = ['TotalStats["Drop_Rarity"]', "Dungon["];
const CHIP = 'chipBonuses["dr"]';
const COVE = 'Holes2["Cglunko_DR",0,0]';
describe("the tree on a synthetic envelope (runs in CI)", () => {
  const SET: Seeds = {
    ...WB, "GetTalentNumber[1,279]": 50, 'EtcBonuses["99"]': 20, 'Companions[168]': 1, 'Companions[26]': 0.2, 'Companions[160]': 1, 'Companions[50]': 25, 'EtcBonuses["91"]': 10,
    'RunCodeOfTypeXforThingY["CardLv","caveC"]': 20, 'RunCodeOfTypeXforThingY["CardLv","caveD"]': 5, "GetTalentNumber[1,239]": 2, 'RoyalG["TotalStatz",0,0]': 30,
    'TotalStats["LUK"]': 500, 'Minehead["GlimboDRmulti",0,0]': 0.5, 'ArcaneType["ArcaneMapMulti_bon",0,0]': 40,
  };
  const dream = Object.assign(Array<number>(20).fill(0), { 10: 2 });
  const tree = (data: Data = {}, seeds: Seeds = {}, o: { map?: number } = {}) =>
    dropRateTree(synth({ Dream: dream, ...data }, { ...o, seeds: { ...SET, ...seeds }, real: REAL, trace: true }));
  const val = (t: Node, group: string, id: string) => t.children![gi(group)].children![DR2_GROUPS[gi(group)].sources.indexOf(id)].val;

  it("has the page's shape: the groups in DR2_GROUPS order, each with its sources in order", () => {
    const { tree: t, total } = tree();
    expect(t).toMatchObject({ name: DR2_ROOT, val: total, fmt: "x" });
    expect(noMigrated(t.note)).toBeUndefined();
    expect(t.children!.map((c) => c.name)).toEqual(DR2_GROUPS.map((g) => g.name));
    DR2_GROUPS.forEach((g, i) => expect(t.children![i].children, g.key).toHaveLength(g.sources.length));
    // the group nodes: the shape note (+ the group's own), and the format by kind
    expect(t.children!.map((g) => g.fmt)).toEqual(DR2_GROUPS.map((g) => (g.kind === "add" ? "+" : g.kind === "replace" ? "raw" : "x")));
    expect(t.children![gi("base")].note).toBe(`× (1 + Σ/100) · ${DR2_GROUPS[gi("base")].note}`);
    expect(t.children![gi("chip")].note).toBe("+ Σ (only below 5, capped at 5)");
    expect(t.children![gi("glimbo")].note).toBe("× max(1, Π)");
    expect(t.children![gi("cove")].note).toBe("replaces the total");
    // the sources: percentage points in the pct groups, factors in the mult ones
    const luk = 140 * ((Math.pow(501, 0.37) - 1) / 40);
    expect(val(t, "base", "luk")).toBe(luk);
    expect(val(t, "base", "talent279")).toBe(50);
    expect(val(t, "base", "caveCards")).toBe(100); // min(4 x 20 + 6 x 5, 100)
    expect(val(t, "base", "talent239")).toBe(60); // 2 x (30 / 1)
    expect(val(t, "base", "dream10")).toBe(10); // 5 x Dream[10]
    expect(val(t, "base", "comp50")).toBe(25); // the first Companions(50) call, not the factor's
    expect(val(t, "etc99", "etc99")).toBe(20);
    expect(val(t, "arcane", "arcane")).toBe(40);
    expect(val(t, "comp168", "comp168x")).toBe(1.3);
    expect(val(t, "comp26x160", "comp26")).toBe(Math.min(1.3, 1.2));
    expect(val(t, "comp26x160", "comp160")).toBe(1.5);
    expect(val(t, "comp50", "comp50x")).toBe(Math.min(1.01, 1 + 25 / 2500)); // the second Companions(50) call
    expect(val(t, "glimbo", "glimbo")).toBe(0.5); // inside max(1, ·): the group is 1
    expect(t.children![gi("glimbo")].val).toBe(1);
    expect(val(t, "bunP", "bunP")).toBe(1); // no bundle
    // a source carries the call it stands for: block and arguments, its value
    expect(t.children![gi("etc99")].children![0].children).toEqual([{ name: 'EtcBonuses("99")', val: 20, fmt: "raw", note: "cached" }]);
    // the page's Biggest Gains model gives the total back from the flat tree
    expect(DR2_PAGE.gains.totalFromFlat(flattenTree(t))).toBeCloseTo(total, 12);
  });

  it("the chip is an `add` group under 5: it shows its value even when the block did not call it, and applies only below 5", () => {
    const hi = tree({}, { [CHIP]: 50, "GetTalentNumber[1,279]": 500 }); // total 6.x: chipBonuses is never called
    expect(hi.tree.children![gi("chip")].children![0].val).toBe(0.5);
    expect(hi.tree.children![gi("chip")].children![0].children).toBeUndefined();
    expect(hi.total).toBeGreaterThan(5);
    const flat0 = { "GetTalentNumber[1,279]": 100, 'EtcBonuses["99"]': 0, "Companions[168]": 0, "Companions[160]": 0, "Companions[26]": 0, "Companions[50]": 0, 'EtcBonuses["91"]': 0, 'ArcaneType["ArcaneMapMulti_bon",0,0]': 0 };
    const lo = tree({}, { ...flat0, [CHIP]: 50 });
    expect(lo.tree.children![gi("chip")].children![0]).toMatchObject({ val: 0.5, children: [{ name: 'chipBonuses("dr")', val: 50 }] }); // called: the call is its child
    expect(lo.total).toBeLessThan(5);
    expect(lo.total - tree({}, { ...flat0, [CHIP]: 0 }).total).toBeCloseTo(0.5, 9); // the chip added, then nothing else moves it
  });

  it("at a total of 5 or more the chip is read on its own: a read that fails is a noted 0 leaf and the page still computes (Ruling PP)", () => {
    // chipBonuses left to its code; talent 279 at 500 puts the total over 5, so the block never calls it
    const run = (data: Data) => dropRateTree(synth({ Dream: dream, ...data }, { seeds: { ...SET, "GetTalentNumber[1,279]": 500 }, real: [...REAL, "chipBonuses["], trace: true }));
    const chip = (r: StatResult) => r.tree.children![gi("chip")].children![0];
    const ok = run({ Lab: [[], [3, -1, -1, -1, -1, -1, -1]] }); // chip 3, Grounded Processor: "dr" 60
    expect(ok.total).toBeGreaterThan(5);
    expect(chip(ok).val).toBe(0.6); // the read succeeds
    expect(chip(ok).children).toBeUndefined();
    // no Lab row for the character (MissingSaveKey), and a chip ChipDesc does not have (RangeError): the game never reads either here
    for (const data of [{}, { Lab: [[], [9999, -1, -1, -1, -1, -1, -1]] }]) {
      const r = run(data);
      expect(r.total).toBe(ok.total);
      expect(chip(r)).toMatchObject({ val: 0, children: [{ name: 'chipBonuses("dr")', val: 0, fmt: "raw" }] });
      expect(chip(r).children![0].note).toMatch(/^not read: .+ \(the game makes no chip call at a total of 5 or more\)$/);
    }
  });

  it("the six base-group companions carry the \"Not owned\" note with CompanionDB[id][2], and an owned one none", () => {
    const { tree: t } = tree({}, { "Companions[22]": 15 });
    const note = (id: string) => t.children![gi("base")].children![DR2_GROUPS[gi("base")].sources.indexOf(id)].note;
    expect(note("comp3")).toBe("Not owned — would grant +100");
    expect(note("comp50")).toBeUndefined(); // seeded 25 in SET: owned
    expect(note("comp22")).toBeUndefined();
    expect(note("comp158")).toBe("Not owned — would grant +15");
    expect(note("comp111")).toBe("Not owned — would grant +100");
    expect(note("comp132")).toBe("Not owned — would grant +100");
  });

  it("the Cove replaces the total on map 216 for a character in cavern 17, and its source is 0 elsewhere", () => {
    const rest = { [COVE]: 0.5 };
    const inCove = tree({ Holes: [[17]] }, rest, { map: 216 });
    expect(inCove.total).toBe(0.5);
    expect(inCove.tree.children![gi("cove")]).toMatchObject({ val: 0.5, fmt: "raw", note: "replaces the total" });
    expect(val(inCove.tree, "cove", "cove")).toBe(0.5);
    expect(inCove.tree.children![gi("cove")].children![0].note).toBe("Map 216 (The Hole), cavern 17 (The Cove): replaces the whole Drop Rate");
    expect(inCove.tree.children![gi("cove")].children![0].children).toEqual([{ name: 'Holes2("Cglunko_DR", 0, 0)', val: 0.5, fmt: "raw", note: "cached" }]);
    expect(DR2_PAGE.gains.totalFromFlat(flattenTree(inCove.tree))).toBe(0.5);
    for (const [data, map] of [[{ Holes: [[16]] }, 216], [{ Holes: [[17]] }, 215]] as const) {
      const out = tree(data, rest, { map });
      expect(out.total, `map ${map}`).toBeGreaterThan(1);
      expect(val(out.tree, "cove", "cove")).toBe(0);
      expect(out.tree.children![gi("cove")].children![0].note).toMatch(/ · inactive: not map 216 in cavern 17$/);
    }
  });

  it("the total is the one TotalStats(\"Drop_Rarity\") call: the tree adds no second computation", () => {
    const c = synth({ Dream: dream }, { seeds: SET, real: REAL, trace: true });
    const { total } = dropRateTree(c);
    expect(total).toBe(TotalStats(synth({ Dream: dream }, { seeds: SET, real: REAL }), "Drop_Rarity"));
    expect(c.trace!.children.filter((n) => n.block === "TotalStats" && n.args[0] === "Drop_Rarity" && n.note !== "cached")).toHaveLength(1);
    // the tree is read from the trace: a Ctx without one is refused
    expect(() => dropRateTree(synth({ Dream: dream }, { seeds: SET, real: REAL }))).toThrow(/no trace|has none/);
  });

  // The sources redo none of the block's arithmetic, but the page's Biggest Gains rebuilds the total from the tree's numbers. If the sources no
  // longer give the call's total the tree must not be shown (spec section 4): here the call's answer moves and its sources do not.
  it("throws TreeTotalMismatch when the tree no longer gives the call's total", () => {
    hook.once = (real, c, d) => 2 * real(c, d);
    let caught: unknown;
    try {
      tree();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TreeTotalMismatch);
    expect((caught as TreeTotalMismatch).rebuilt * 2).toBeCloseTo((caught as TreeTotalMismatch).total, 9);
    expect(() => tree()).not.toThrow();
  });

  it("the refToggle group path (root / the Arcane group) resolves to the Arcane source in the flat tree", () => {
    const { tree: t } = tree();
    const flat = flattenTree(t);
    const path = DR2_PAGE.refToggle!.groupPath;
    expect(path).toBe(`${DR2_ROOT} / ${DR2_GROUPS[gi("arcane")].name}`);
    expect(Object.keys(flat).filter((p) => p.startsWith(`${path} / `) && !p.slice(path.length + 3).includes(" / "))).toEqual([`${path} / Arcane Map Bonus: Drop Rate`]);
    // dropping the group's subtree and replaying the root, as the kit does, is the total without the Arcane factor
    const without = Object.fromEntries(Object.entries(flat).filter(([p]) => p !== path && !p.startsWith(`${path} / `)));
    expect(DR2_PAGE.gains.totalFromFlat(without)).toBeCloseTo(t.val / 1.4, 9);
  });

  it("a map the block cannot read the Holes of is refused as the block refuses it (Ruling E)", () => {
    expect(() => tree({ Holes: undefined }, {}, { map: 216 })).toThrow(MissingSaveKey);
  });
});

// ── every real save, character and map ──────────────────────────────────────────────────────────
/** The maps of njs/dropRate.test.ts: plain, the Cove map, a town, a dungeon (Ruling Y) and a no-monster map; `cove`: the pairs in the Cove. */
const MAPS: Record<number, { cove: number }> = { 251: { cove: 0 }, 216: { cove: 123 }, 150: { cove: 0 }, 40: { cove: 0 }, 33: { cove: 0 } };
const HOURZERO: string[] = []; // HourZero is out of the default corpus (PARITY_EXCLUDED, support/saves.ts): nothing is refused

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(noSaves)("computeGameDropRate on every real save, character and map", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const shapeMismatches: string[] = [];
      const display: string[] = [];
      const lost: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let flags = 0;
      let cove = 0;
      let worst = 0;
      for (const path of GOLDEN_SAVES) {
        const file = basename(path);
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map, trace: true });
          let r: StatResult;
          try {
            r = dropRateTree(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${file}: ${e.key}`);
            continue;
          }
          pairs++;
          const tree = r.tree;
          const at = `${file}#${ci}@${map}`;
          // the total is the call's (the adapter adds nothing)
          if (r.total !== TRACKERS.dropRateV2!(makeCtx(state, { player: ci, map }))) mismatches.push(`${at}: the tree's total is not TotalStats("Drop_Rarity")'s`);
          if (tree.children![gi("cove")].children![0].val > 0) cove++;
          const full = flagsOfTrace(ctx.trace!).sort();
          flags += full.length;
          if (JSON.stringify(flagsOfTree(tree).sort()) !== JSON.stringify(full)) lost.push(`${at}: full trace ${full.length} notes, page tree ${flagsOfTree(tree).length}`);
          if (tree.children!.length !== DR2_GROUPS.length) shapeMismatches.push(`${at}: ${tree.children!.length} children (extras: ${tree.children!.slice(DR2_GROUPS.length).map((c) => c.name)})`);
          // display and value agree: the page's Biggest Gains model gives the total back from the flat tree
          const fromFlat = DR2_PAGE.gains.totalFromFlat(flattenTree(tree));
          worst = Math.max(worst, Math.abs(fromFlat - r.total) / Math.max(1, Math.abs(r.total)));
          if (!rel(fromFlat, r.total)) display.push(`${at}: the flat tree gives ${fromFlat}, the call ${r.total}`);
          if (tree.val !== r.total) display.push(`${at}: root ${tree.val} is not the total ${r.total}`);
        }
      }
      states.clear(); // 106 states (each a deep clone) kept across the five maps would pass the heap
      console.info(
        `[dr adapter @${map}] ${pairs} pairs, ${mismatches.length} total and ${shapeMismatches.length} shape mismatches, ${flags} flagged notes, worst flat-tree error ${worst.toExponential(2)}, ${cove} in the Cove, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`
      );
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(shapeMismatches.slice(0, 20)).toEqual([]);
      expect(display.slice(0, 20)).toEqual([]);
      expect(lost.slice(0, 20)).toEqual([]);
      expect(pairs, "saves x characters, less the refused").toBe(1153);
      expect(cove, "pairs in the Cove (the Cove source is above 0)").toBe(MAPS[map].cove);
      // the Tome refusal behind TotalStats("LUK") (Ruling E): HourZero on every map
      expect([...refused].sort()).toEqual(HOURZERO);
    }, 1_800_000);
  }
});

// ── the game's own text ─────────────────────────────────────────────────────────────────────────
// No Drop Rate in-game reading is recorded yet (the controller records them, Ruling MM): the test skips cleanly while fixtures/readings.json has no
// dropRateV2 entry, and runs the day one is added. A row listing "dropRateV2" in `knownGaps` keeps the exact assert and runs through it.fails.
describe("the Drop Rate readings, through the adapter (the Drop Rate line of Player Info)", () => {
  const rows = loadReadings().filter((r) => r.stat === "dropRateV2");
  if (rows.length === 0) it.skip("no dropRateV2 reading in fixtures/readings.json yet (Ruling MM)", () => {});
  for (const r of rows) {
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("dropRateV2") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const { total } = computeGameDropRate(readingSave(r), r.charIdx, r.map);
      const site = formatGameValue("dropRateV2", { value: total });
      console.info(`[dr adapter] ${r.id}: game ${r.game}, ours ${site}`);
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
  }
});
