// Task 4 (EXP plan): the EXP Multi adapter (lib/game/trackers/expMulti.ts), ExpMulti(0) turned into the page's tree.
//
// - the display config moved to lib/expMulti/layers (Ruling B), lib/arkh re-exporting the very same objects; the tracker registry;
// - on a synthetic envelope (CI): the tree's shape, the sources' values, the medallion gate (Ruling II), the recombination guard
//   (TreeTotalMismatch), the page's Biggest Gains model giving the total back;
// - on every real save, character and map (251, 1, 33, 150 and the dungeon 40, the maps of njs/expMulti.test.ts): the total against lib/arkh (a
//   difference is a KNOWN row of the pair; njs/expMulti.test.ts proves the exact values), every source leaf against lib/arkh's, the page's Biggest
//   Gains model giving the total back from the flat tree, the size (Ruling L, at most 2x lib/arkh's nodes), and every runtime: / assumed: note of the
//   full trace kept;
// - the tree's names, formats and notes equal to lib/arkh's; the EXP readings in the game's display format (skipped until fixtures/readings.json
//   has an expMulti entry, Ruling HH).
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import * as arkhDef from "@/lib/arkh/stats/defs/exp-multi";
import * as arkhExp from "@/lib/arkh/stats/systems/exp/exp";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import * as layers from "@/lib/expMulti/layers";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { MapAFKtarget } from "@/lib/game/data";
import { makeCtx, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { MissingSaveKey, TreeTotalMismatch } from "@/lib/game/errors";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { computeGameExpMulti, expTree } from "@/lib/game/trackers/expMulti";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatResult } from "@/lib/statTracker/config";
import { synth, WB, type Seeds } from "../support/expStub";

// the guard test makes ExpMulti disagree with its own sources once: the real block otherwise (a hook, not vi.fn: vi.fn keeps every call's
// arguments, a Ctx with its trace, which the real-save loops below would pile up past the heap)
const hook = vi.hoisted(() => ({ once: null as null | ((real: (c: Ctx, d: number) => number, c: Ctx, d: number) => number) }));
vi.mock("@/lib/game/njs/ExpMulti", async (orig) => {
  const actual = await orig<typeof import("@/lib/game/njs/ExpMulti")>();
  return {
    ...actual,
    ExpMulti: (c: Ctx, d: number) => {
      const f = hook.once;
      hook.once = null;
      return f ? f(actual.ExpMulti, c, d) : actual.ExpMulti(c, d);
    },
  };
});
import { ExpMulti } from "@/lib/game/njs/ExpMulti";

type Node = StatResult["tree"];
const { EXP_GROUPS, EXP_ROOT } = layers;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const noSaves = GOLDEN_SAVES.length === 0;
const count = (n: Node): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
const FLAG = /^(runtime|assumed):/;
const flagsOfTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(flagsOfTrace)];
const flagsOfTree = (n: Node): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(flagsOfTree)];
const byName = (n: Node, name: string): Node => {
  const c = n.children?.find((k) => k.name === name);
  if (!c) throw new Error(`no "${name}" under "${n.name}"`);
  return c;
};
const shape = (n: Node) => ({ name: n.name, fmt: n.fmt, note: n.note });
const ALL_IDS = EXP_GROUPS.flatMap((g) => g.sources);
/** The sources whose note lib/arkh builds from the save (the workbench's log term, the star talent's decay): the tree keeps their name and format. */
const DYNAMIC_NOTE = new Set(["workbench", "talent632"]);
const idAt = (gi: number, k: number) => EXP_GROUPS[gi].sources[k];
const target = (m: number) => (MapAFKtarget as unknown as string[])[m];
const noMigrated = (note?: string) => note?.replace(/^migrated from an older game version \(\d+ load steps?\)$/, "") || undefined;

// ── the display config and the registry ─────────────────────────────────────────────────────────
describe("the display config and the registry", () => {
  it("lives in lib/expMulti/layers and lib/arkh re-exports the very same objects (Ruling B)", () => {
    expect(arkhDef.EXP_ROOT).toBe(layers.EXP_ROOT);
    expect(arkhDef.EXP_GROUPS).toBe(layers.EXP_GROUPS);
    expect(arkhDef.EXP_VOTE_NAME).toBe(layers.EXP_VOTE_NAME);
    expect(arkhExp.EXP_CIRCUMSTANTIAL_SOURCE_NAMES).toBe(layers.EXP_CIRCUMSTANTIAL_SOURCE_NAMES);
    expect(ALL_IDS).toHaveLength(98);
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    expect(layers.EXP_CIRCUMSTANTIAL_SOURCE_NAMES).toHaveLength(6);
  });

  it("the page's Biggest Gains model reads the same config (it skips the circumstantial sources and the vote)", () => {
    const G10 = `${EXP_ROOT} / ${EXP_GROUPS.find((g) => g.key === "g10")!.name}`;
    const yours: Record<string, number> = { [`${G10} / ${layers.EXP_VOTE_NAME}`]: 0, [`${G10} / ${layers.NOOBIE_GAINS_NAME}`]: 0 };
    const ref: Record<string, number> = { [`${G10} / ${layers.EXP_VOTE_NAME}`]: 30, [`${G10} / ${layers.NOOBIE_GAINS_NAME}`]: 30 };
    expect(EXP_PAGE.gains.sources(yours, ref)).toEqual([]);
  });

  it("TRACKERS.expMulti is ExpMulti(0) (the Class EXP line of Player Info)", () => {
    expect(TRACKERS.expMulti!(synth({}, { seeds: { ...WB, 'EtcBonuses["4"]': 100 } }))).toBe(2);
  });
});

// ── the tree on a synthetic envelope (CI) ───────────────────────────────────────────────────────
describe("the tree on a synthetic envelope (runs in CI)", () => {
  const SET: Seeds = {
    ...WB, "Companions[37]": 1, "Companions[128]": 0.6, "CompLV2[128]": 1, "Companions[50]": 25, 'EtcBonuses["84"]': 50, 'EtcBonuses["4"]': 40, 'EtcBonuses["78"]': 10,
    "GetTalentNumber[1,632]": 12, "AchieveStatus[357]": 1, "prayersReal[9,1]": 5, "prayersReal[2,0]": 8, 'Summoning["VotingBonusz",15,0]': 30, "getbonus2[1,55,-1]": 3,
  };
  const tree = (data: Record<string, unknown> = {}, o: { map?: number; seeds?: Seeds; chars?: number } = {}) => expTree(synth(data, { seeds: SET, ...o, trace: true }));

  it("has lib/arkh's shape: the 10 groups in EXP_GROUPS order, each with its sources in order", () => {
    const { tree: t, total } = tree();
    expect(t).toMatchObject({ name: EXP_ROOT, val: total, fmt: "x" });
    expect(noMigrated(t.note)).toBeUndefined(); // lib/arkh's root has no note (the synthetic envelope is an older save: the migrated note only)
    expect(t.children!.map((c) => c.name)).toEqual(EXP_GROUPS.map((g) => g.name));
    EXP_GROUPS.forEach((g, i) => expect(t.children![i].children, g.key).toHaveLength(g.sources.length));
    expect(t.children!.map((g) => g.note)).toEqual(EXP_GROUPS.map((g) => (g.kind === "pct" ? "× (1 + Σ/100)" : g.max1 ? "× max(1, Π)" : "× Π")));
    // the sources: factors in the mult groups, % points in the pct ones
    const val = (gi: number, id: string) => t.children![gi].children![EXP_GROUPS[gi].sources.indexOf(id)].val;
    expect(val(3, "comp37")).toBe(10); // 1 + 9 x 1
    expect(val(3, "comp128")).toBe(1 + (Math.min(0.5, 0.6) + 0.25)); // 1 + (min(.5, c) + .25 x lv2)
    expect(val(3, "comp50")).toBe(Math.max(1, Math.min(1.01, 1 + 25 / 2500)));
    expect(val(4, "etc84")).toBe(1.5);
    expect(val(8, "etc78")).toBe(10);
    expect(val(9, "etc4")).toBe(40);
    expect(val(9, "ach357")).toBe(20); // x 20
    expect(val(9, "prayer9")).toBe(-5); // the curse is shown negative
    expect(val(9, "vote15")).toBe(30);
    expect(val(9, "talent632")).toBe(12);
    expect(val(9, "comp50add")).toBe(25); // the second Companions(50) call, not the first
    expect(val(9, "comp128add")).toBe(0.6);
    // the groups: pct = 1 + Σ/100, mult = Π (g04 under max(1, ·))
    expect(t.children![8].val).toBe(1.1);
    expect(t.children![3].val).toBeCloseTo(10 * 1.75 * 1.01, 12);
    // the page's Biggest Gains model gives the total back from the flat tree
    expect(EXP_PAGE.gains.totalFromFlat(flattenTree(t))).toBeCloseTo(total, 12);
    // a source carries the call it stands for: block and arguments, its value
    expect(byName(t.children![4], "Bonus Class EXP (Equipment)").children).toEqual([{ name: 'EtcBonuses("84")', val: 50, fmt: "raw", note: "cached" }]);
  });

  it("a branch the game skips has no call: its source is 0 (a factor 1 in mult groups) and keeps its name", () => {
    const { tree: t } = tree();
    const g10 = t.children![9];
    // Lv0 = 100: no cardSet0 / mealClexp / newbie; one character: it is its own lowest, but Tasks[2][0][2] = 0 skips the loop
    for (const id of ["cardSet0", "mealClexp", "newbie", "merit3", "vault12"]) expect(g10.children![EXP_GROUPS[9].sources.indexOf(id)].val, id).toBe(0);
    expect(t.children![0].children![0].val).toBe(1); // the workbench
    expect(t.children![2].children![0].val).toBe(1); // the medallion gate is shut
  });

  it("the level ladders and the lowest-level bonus read the game's branches", () => {
    const { tree: t } = tree({ Lv0_0: [20, 0], TaskZZ2: [[0, 0, 4]], WeeklyBoss: { c: 400 } }, { seeds: { ...SET, 'Summoning["VaultUpgBonus",12,0]': 8, "CardSetBonuses[0,\"0\"]": 7 } });
    const v = (id: string) => t.children![9].children![EXP_GROUPS[9].sources.indexOf(id)].val;
    expect(v("merit3")).toBe(12);
    expect(v("vault12")).toBe(8);
    expect(v("cardSet0")).toBe(7);
    expect(v("newbie")).toBe(100); // 10 <= 20 < 30
    expect(v("weeklyBoss")).toBe(150); // min(150, c)
    expect(byName(t.children![9], "Newbie Bracket").children).toEqual([{ name: "Class Level", val: 20, fmt: "raw", note: "a plain read of the save, not an N.js call" }]);
  });

  // Ruling II: the medallion of the map's monster (MapAFKtarget[map]), never the character's saved AFK target.
  it("the Shiny Medallion gate is the medallion of the map's monster (Ruling II), shut on a no-monster map or a town, and the saved target is not read", () => {
    expect(target(1)).toBe("mushG");
    const owned = { Compass: [[], [], [], ["mushG"]] };
    const seeds = { ...SET, "getbonus2[1,429,-1]": 3 };
    const open = tree(owned, { map: 1, seeds });
    const g03 = open.tree.children![2].children![0];
    expect(g03).toMatchObject({ val: 3, fmt: "x", note: "Map 1 · mushG" });
    expect(open.total).toBeCloseTo(tree({}, { map: 1, seeds }).total * 3, 12);
    // a sub-1 talent never lowers it (max(1, ·))
    expect(tree(owned, { map: 1, seeds: { ...SET, "getbonus2[1,429,-1]": 0.5 } }).tree.children![2].children![0].val).toBe(1);
    // a map whose target is no monster / a town: the gate never opens, nothing throws, the formula runs
    for (const map of [33, 150]) {
      const shut = tree(owned, { map, seeds }); // the account holds a medallion, but not of this map's target
      expect(shut.tree.children![2].children![0], `map ${map}`).toMatchObject({ val: 1, note: `Map ${map} · ${target(map)}` });
      expect(shut.tree.children).toHaveLength(10);
    }
    // the character's saved AFK target (Ruling V keeps it on the map it stands on) does not open the gate on another map's monster
    const saved = tree({ ...owned, AFKtarget_0: "mushG", CurrentMap_0: 251 }, { map: 251, seeds });
    expect(saved.tree.children![2].children![0].val).toBe(1);
  });

  it("the total is the one ExpMulti(0) call: the tree adds no second computation", () => {
    const c = synth({}, { seeds: SET, trace: true });
    const { total } = expTree(c);
    expect(total).toBe(ExpMulti(synth({}, { seeds: SET }), 0));
    expect(c.trace!.children.filter((n) => n.block === "ExpMulti" && n.note !== "cached")).toHaveLength(1);
    // the tree is read from the trace: a Ctx without one is refused
    expect(() => expTree(synth({}, { seeds: SET }))).toThrow(/no trace|has none/);
  });

  // The sources redo none of ExpMulti's arithmetic, but the page's Biggest Gains rebuilds the total from the tree's numbers. If the sources no
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

  it("a save without the weekly boss is refused (Ruling E), as the block refuses it", () => {
    expect(() => expTree(synth({ WeeklyBoss: undefined }, { seeds: SET, trace: true }))).toThrow(MissingSaveKey);
  });
});

// ── every real save, character and map ──────────────────────────────────────────────────────────
/**
 * The maps of njs/expMulti.test.ts: plain, a medallion map (mushG), a no-monster map (Z), a town (Nothing, where the saved skill target is kept)
 * and the dungeon 40 (Ruling Y). `explained`: pairs whose total differs from lib/arkh's and is closed by a KNOWN row of the pair
 * (njs/expMulti.test.ts proves the exact values with the same pairs); `leafKnown`: leaves of those pairs that differ from lib/arkh's and are covered by
 * a KNOWN row of that source.
 */
const MAPS: Record<number, { explained: number; leafKnown: number; fmtless: number }> = {
  251: { explained: 510, leafKnown: 1723, fmtless: 219 }, 1: { explained: 510, leafKnown: 1723, fmtless: 219 }, 33: { explained: 510, leafKnown: 1715, fmtless: 219 },
  150: { explained: 510, leafKnown: 1715, fmtless: 219 }, 40: { explained: 510, leafKnown: 1723, fmtless: 219 },
};
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"]; // Ruling E (njs/expTerms.test.ts)

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(noSaves)("computeGameExpMulti against lib/arkh on every real save, character and map", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const leafMismatches: string[] = [];
      const shapeMismatches: string[] = [];
      const display: string[] = [];
      const lost: string[] = [];
      const over: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let explained = 0;
      let leafKnown = 0;
      let entryLeaves = 0; // leaves a KNOWN row covers: every one must really differ (leafKnown), or the row is stale
      let fmtless = 0;
      let flags = 0;
      let dungeon = 0;
      let worst = 0;
      let worstRatio = 0;
      let open = 0;
      for (const path of GOLDEN_SAVES) {
        const file = basename(path);
        const state = stateOf(path);
        const env = JSON.parse(readFileSync(path, "utf8"));
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map, trace: true });
          let r: StatResult;
          try {
            r = expTree(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${file}: ${e.key}`);
            continue;
          }
          pairs++;
          const tree = r.tree;
          const at = `${file}#${ci}@${map}`;
          const arkh = computeArkhExpMulti(structuredClone(env), ci, map);
          // the size (Ruling L): at most 2x lib/arkh's nodes
          worstRatio = Math.max(worstRatio, count(tree) / count(arkh.tree));
          if (count(tree) > 2 * count(arkh.tree)) over.push(`${at}: ${count(tree)} nodes against ${count(arkh.tree)}`);
          // the total is the call's (the adapter adds nothing), and lib/arkh's, or a KNOWN row of the pair explains the difference
          if (r.total !== TRACKERS.expMulti!(makeCtx(state, { player: ci, map }))) mismatches.push(`${at}: the tree's total is not ExpMulti(0)'s`);
          const known = KNOWN_ARKH_DIFFS.some((d) => d.stat === "exp" && d.save === file && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
          if (!rel(r.total, arkh.total)) {
            if (!known) mismatches.push(`${at}: game ${r.total}, arkh ${arkh.total}`);
            else explained++;
          }
          const full = flagsOfTrace(ctx.trace!).sort();
          flags += full.length;
          if (full.some((f) => f.includes("outside a dungeon"))) dungeon++;
          if (JSON.stringify(flagsOfTree(tree).sort()) !== JSON.stringify(full)) lost.push(`${at}: full trace ${full.length} notes, page tree ${flagsOfTree(tree).length}`);
          // names, formats, notes: lib/arkh's (the Observed Max data is keyed by them), and every source leaf is lib/arkh's except where the pair has a KNOWN row of that source
          if (JSON.stringify(shape({ ...tree, note: noMigrated(tree.note) })) !== JSON.stringify(shape(arkh.tree))) shapeMismatches.push(`${at}: root ${JSON.stringify(shape(tree))}`);
          if (tree.children!.length !== EXP_GROUPS.length) shapeMismatches.push(`${at}: ${tree.children!.length} children (extras: ${tree.children!.slice(EXP_GROUPS.length).map((c) => c.name)})`);
          EXP_GROUPS.forEach((g, gi) => {
            const mine = tree.children![gi];
            const theirs = arkh.tree.children![gi];
            if (JSON.stringify(shape(mine)) !== JSON.stringify(shape(theirs))) shapeMismatches.push(`${at}: group ${g.key} ${JSON.stringify(shape(mine))} vs ${JSON.stringify(shape(theirs))}`);
            g.sources.forEach((id, k) => {
              const m = mine.children![k];
              const a = theirs.children![k];
              const s1 = shape(m);
              const s2 = shape(a);
              if (DYNAMIC_NOTE.has(id)) (s1 as { note?: string }).note = (s2 as { note?: string }).note = undefined;
              // a lib/arkh node that is a renamed copy of a system node (friend, hole upgrades) can carry no format of its own: the tree gives it its group's
              // (the tree's format is the group's, which this asserts: "x" in a mult group, "+" in the others)
              if (s2.fmt === undefined) {
                fmtless++;
                if (s1.fmt !== (g.kind === "mult" ? "x" : "+")) shapeMismatches.push(`${at}: ${id} format ${s1.fmt}, its group's is ${g.kind === "mult" ? "x" : "+"}`);
                (s1 as { fmt?: string }).fmt = undefined;
              }
              if (JSON.stringify(s1) !== JSON.stringify(s2)) shapeMismatches.push(`${at}: ${id} ${JSON.stringify(s1)} vs ${JSON.stringify(s2)}`);
              if (id === "medallion429" && (m.note ?? "").startsWith(`Map ${map} · `) === false) shapeMismatches.push(`${at}: medallion note ${m.note}`);
              const covered = KNOWN_ARKH_DIFFS.some((d) => d.stat === "exp" && d.save === file && (d.ci ?? ci) === ci && d.source === id && (d.maps?.includes(map) ?? true));
              if (covered) entryLeaves++;
              if (rel(m.val, a.val)) return;
              if (covered) {
                leafKnown++;
                return;
              }
              leafMismatches.push(`${at} ${id}: game ${m.val}, arkh ${a.val}`);
            });
          });
          if (tree.children![2].children![0].val > 1) open++;
          // display and value agree: the page's Biggest Gains model gives the total back from the flat tree
          const fromFlat = EXP_PAGE.gains.totalFromFlat(flattenTree(tree));
          worst = Math.max(worst, Math.abs(fromFlat - r.total) / Math.max(1, Math.abs(r.total)));
          if (!rel(fromFlat, r.total)) display.push(`${at}: the flat tree gives ${fromFlat}, the call ${r.total}`);
          if (tree.val !== r.total) display.push(`${at}: root ${tree.val} is not the total ${r.total}`);
        }
      }
      states.clear(); // 106 states (each a deep clone) kept across the five maps would pass the heap
      console.info(
        `[exp adapter @${map}] ${pairs} pairs, ${explained} explained, ${leafKnown} known leaves (${entryLeaves} covered), ${fmtless} format-less lib/arkh nodes, ${mismatches.length} total, ${leafMismatches.length} leaf and ${shapeMismatches.length} shape mismatches, ${flags} flagged notes (${dungeon} pairs with the dungeon stand-in), worst flat-tree error ${worst.toExponential(2)}, worst size ratio ${worstRatio.toFixed(2)}, medallion open on ${open}, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`
      );
      expect(over).toEqual([]);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(leafMismatches.slice(0, 20)).toEqual([]);
      expect(shapeMismatches.slice(0, 20)).toEqual([]);
      expect(display.slice(0, 20)).toEqual([]);
      expect(lost.slice(0, 20)).toEqual([]);
      expect(pairs).toBeGreaterThan(1000);
      expect(explained, "pairs whose total differs from lib/arkh's and a KNOWN row closes").toBe(MAPS[map].explained);
      expect(leafKnown, "leaves that differ from lib/arkh's and a KNOWN row of that source covers").toBe(MAPS[map].leafKnown);
      expect(leafKnown, "KNOWN leaves vs leaves the rows cover (a stale row is one that no longer differs)").toBe(entryLeaves);
      expect(fmtless, "lib/arkh nodes with no format (hole upgrades 47 and 83 of big_guy69123, friend bonus)").toBe(MAPS[map].fmtless);
      // the Tome refusal behind the talents (Ruling E): HourZero on every map (EXP has no no-value map, Ruling DD does not apply)
      expect([...refused].sort()).toEqual(HOURZERO);
      // not vacuous: the medallion gate is open on a medallion map and shut on a no-monster map
      if (map === 33) expect(open).toBe(0);
      if (map === 1) expect(open).toBeGreaterThan(0);
      // Ruling Y: a dungeon map reads Dungon's assumed: leaf in every tree (inside a talent), and no other map does
      expect(dungeon, "pairs with the dungeon stand-in").toBe(map === 40 ? pairs : 0);
    }, 1_800_000);
  }
});

// ── the game's own text ─────────────────────────────────────────────────────────────────────────
// No EXP in-game reading is recorded yet (the controller records them, Ruling HH): the test skips cleanly while fixtures/readings.json has no
// expMulti entry, and runs the day one is added. A row listing "expMulti" in `knownGaps` keeps the exact assert and runs through it.fails.
describe("the EXP readings, through the adapter (the Class EXP line of Player Info)", () => {
  const rows = loadReadings().filter((r) => r.stat === "expMulti");
  if (rows.length === 0) it.skip("no expMulti reading in fixtures/readings.json yet (Ruling HH)", () => {});
  for (const r of rows) {
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("expMulti") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const { total } = computeGameExpMulti(readingSave(r), r.charIdx, r.map);
      const site = formatGameValue("expMulti", { value: total });
      console.info(`[exp adapter] ${r.id}: game ${r.game}, ours ${site}`);
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
  }
});
