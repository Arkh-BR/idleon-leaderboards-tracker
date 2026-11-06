// Task 4 (AFK plan): the AFK Gains adapter (lib/game/trackers/afkGains.ts), AFKgainrates("Fighting") turned into the page's tree.
//
// - the display config moved to lib/afkGains/layers (Ruling B), lib/arkh re-exporting the very same objects; the tracker registry;
// - on a synthetic envelope (CI): the tree's shape, the recombination guard (TreeTotalMismatch), decision A9's notes (a map with nothing to
//   fight, a skill target), the Cove, the Clamworks, Ruling V's saved target;
// - on every real save, character and map (251, 306, 216, 0, 33, 6 and the dungeon 40): the total against lib/arkh (a difference is a KNOWN
//   row of the pair, or the saved AFK target the game keeps, Ruling V; njs/afkGains.test.ts proves the exact values), every source leaf
//   against lib/arkh's, the page's Biggest Gains model giving the total back from the flat tree, the size (Ruling L, at most 2x lib/arkh's
//   nodes) and every runtime: / assumed: note of the full trace kept;
// - the tree on real saves: names, formats and notes equal to lib/arkh's; the AFK readings in the game's display format (skipped until
//   fixtures/readings.json has an afkGains entry, Ruling AA).
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as arkhDef from "@/lib/arkh/stats/defs/afk-gains";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import * as layers from "@/lib/afkGains/layers";
import { afkGainsModel } from "@/lib/afkGains/pageConfig";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { afkTarget } from "@/lib/game/afkTarget";
import { MapAFKtarget } from "@/lib/game/data";
import { makeCtx, type TraceNode } from "@/lib/game/ctx";
import { MissingSaveKey, TreeTotalMismatch } from "@/lib/game/errors";
import { AFKgainrates } from "@/lib/game/njs/AFKgainrates";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { afkFightRate, afkTree, computeGameAfkGains } from "@/lib/game/trackers/afkGains";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatResult } from "@/lib/statTracker/config";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhAfkLeaves, arkhAfkRate } from "../support/arkhOracle";
import { synth, type Seeds } from "../support/afkStub";

type Node = StatResult["tree"];
const { AFK_NODES, AFK_POOLS, AFK_ROOT } = layers;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const noSaves = GOLDEN_SAVES.length === 0;
const POOL_IDS = [...AFK_POOLS[0].sources, ...AFK_POOLS[1].sources];
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
/** The root's own children, in lib/arkh's order. */
const ROOT_CHILDREN = [AFK_NODES.pool, AFK_NODES.arcane, AFK_NODES.etc92, AFK_NODES.clam, AFK_NODES.cove, AFK_NODES.type];
const target = (m: number) => (MapAFKtarget as unknown as string[])[m];

// ── the display config and the registry ─────────────────────────────────────────────────────────
describe("the display config and the registry", () => {
  it("lives in lib/afkGains/layers and lib/arkh's def re-exports the very same objects (Ruling B)", () => {
    expect(arkhDef.AFK_ROOT).toBe(layers.AFK_ROOT);
    expect(arkhDef.AFK_NODES).toBe(layers.AFK_NODES);
    expect(arkhDef.AFK_VOTE_NAME).toBe(layers.AFK_VOTE_NAME);
    expect(arkhDef.AFK_POOLS).toBe(layers.AFK_POOLS);
    expect(arkhDef.afkRate).toBe(layers.afkRate);
    expect(POOL_IDS).toHaveLength(38);
    expect(new Set(POOL_IDS).size).toBe(POOL_IDS.length);
  });

  it("TRACKERS.afkGains is afkFightRate (the AFKgainrates call, 0 where the target has nothing to fight)", () => {
    expect(TRACKERS.afkGains!(synth({}, { seeds: { 'DNSM.FamBonusQTYs["8"]': 60 } }))).toBeCloseTo(1, 12);
    expect(TRACKERS.afkGains!(synth({}, { seeds: { 'DNSM.FamBonusQTYs["8"]': 60 }, map: 0 }))).toBe(0);
  });
});

// ── the tree on a synthetic envelope (CI) ───────────────────────────────────────────────────────
describe("the tree on a synthetic envelope (runs in CI)", () => {
  const SET: Seeds = { 'DNSM.FamBonusQTYs["8"]': 60, "GetTalentNumber[1,88]": 10, "Companions[6]": 7, 'Summoning["EventShopOwned",5,0]': 1, 'ArcaneType["ArcaneMapMulti_bon",2,0]': 100, 'EtcBonuses["92"]': 50 };
  const tree = (data: Record<string, unknown> = {}, o: { map?: number; at?: number; seeds?: Seeds } = {}) => afkTree(synth(data, { seeds: SET, ...o, trace: true }));

  it("has lib/arkh's shape: the pool of 38 sources in AFK_POOLS order, the two multipliers, the three rules", () => {
    const { tree: t, total } = tree({ BundlesReceived: { bun_u: 1 }, TaskZZ2: [[], [0, 0, 1]] });
    // (.4 + (60 + 10 + 7 + 20 + 2 merit + 30 bun_u)/100) x (1 + 100/100) x (1 + 50/100)
    expect(total).toBeCloseTo((0.4 + 1.29) * 2 * 1.5, 12);
    expect(t).toMatchObject({ name: AFK_ROOT, val: total, fmt: "x", note: "max(1%, ·)" });
    expect(t.children!.slice(0, 6).map((c) => c.name)).toEqual(ROOT_CHILDREN);
    expect(t.children).toHaveLength(6); // nothing runtime / assumed on this path
    const pool = byName(t, AFK_NODES.pool);
    expect(pool.children).toHaveLength(38);
    expect(pool.val).toBeCloseTo(1.69 + 0.4 - 0.4, 12);
    const val = (name: string) => byName(pool, name).val;
    expect(val("Base fighting rate (40%)")).toBe(40);
    expect(val("Voidwalker Family Bonus")).toBe(60);
    expect(val("Idle Brawling (Talent 88)")).toBe(10);
    expect(val("Bored Bean (Companion 6)")).toBe(7);
    expect(val("Sleepy Joe Armstrong (Event Shop 5)")).toBe(20); // 20 x the call
    expect(val("Merit: AFK Gains for First Characters")).toBe(2);
    expect(val("AFK Bundle")).toBe(30);
    expect(byName(t, AFK_NODES.arcane)).toMatchObject({ val: 2, fmt: "x" });
    expect(byName(t, AFK_NODES.etc92)).toMatchObject({ val: 1.5, fmt: "x" });
    // a source carries the call it stands for: block and arguments, its value
    expect(byName(pool, "Voidwalker Family Bonus").children).toEqual([{ name: 'DNSM.FamBonusQTYs("8")', val: 60, fmt: "raw", note: "cached" }]);
    expect(byName(pool, "Merit: AFK Gains for First Characters").children).toEqual([{ name: "Tasks[2][1][2]", val: 1, fmt: "raw", note: "Merit level" }]);
    // the page's Biggest Gains model rebuilds the total from the flat tree
    expect(afkGainsModel.totalFromFlat(flattenTree(t))).toBeCloseTo(total, 12);
  });

  it("the curse is shown negative and subtracted", () => {
    const { tree: t, total } = afkTree(synth({}, { seeds: { 'DNSM.FamBonusQTYs["8"]': 60, "prayersReal[12,1]": 20 }, trace: true }));
    expect(byName(byName(t, AFK_NODES.pool), "Ruck Sack curse (Prayer 12)").val).toBe(-20);
    expect(total).toBeCloseTo(0.4 + 0.4, 12);
  });

  // The sources redo none of AFKgainrates's arithmetic, but the page's Biggest Gains rebuilds the total from the tree's numbers. If the
  // sources no longer give the call's total the tree must not be shown (spec section 4). The only way a fixed engine gets there: the Cove
  // replaces the rate with Holes2's value, and afkRate (the one copy of the shape) takes it only when it is above 0, while the game floors it.
  it("throws TreeTotalMismatch when the tree no longer gives the call's total", () => {
    const cove = { Holes: [[17]] };
    const seeds = { ...SET, 'Holes2["Cglunko_AFKgains",0,0]': 0 };
    let caught: unknown;
    try {
      afkTree(synth(cove, { seeds, map: 216, trace: true }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TreeTotalMismatch);
    expect((caught as TreeTotalMismatch).total).toBe(0.01); // the game's floor
    expect((caught as TreeTotalMismatch).rebuilt).toBeGreaterThan(1); // the pool's rate: the Cove's 0 is no replacement
    // a Cove above 0 is fine
    expect(() => afkTree(synth(cove, { seeds: { ...seeds, 'Holes2["Cglunko_AFKgains",0,0]': 0.5 }, map: 216, trace: true }))).not.toThrow();
  });

  // Decision A9 (spec 2026-09-24-afk-gains-page-design.md:53): a skill target shows the Fighting rate with a note, Nothing / Paying_Respect /
  // a target with no definition give 0. The tree says why, in the type node and in an assumed: leaf under it.
  it("map 251 (a monster): the plain fight, no A9 leaf", () => {
    const { tree: t, total } = tree();
    expect(total).toBeGreaterThan(1);
    expect(target(251)).toBe("w6a1");
    expect(byName(t, AFK_NODES.type)).toEqual({ name: AFK_NODES.type, val: 1, fmt: "x", note: "Map 251 · w6a1 · FIGHTING" });
  });

  it("a target of type Nothing (map 0) and a target with no definition (map 33) give 0, with the A9 note, and the sources still show", () => {
    for (const [map, why] of [[0, "(Nothing) has nothing to fight"], [33, "has no monster to fight"]] as const) {
      const { tree: t, total } = tree({}, { map });
      expect(total, `map ${map}`).toBe(0);
      expect(t.val).toBe(0);
      const type = byName(t, AFK_NODES.type);
      expect(type.val).toBe(0);
      expect(type.note).toBe(`Map ${map} · ${target(map)} · ${map === 0 ? "Nothing" : "no definition"}`);
      expect(type.children).toHaveLength(1);
      expect(type.children![0]).toMatchObject({ name: "AFK target", val: 0 });
      expect(type.children![0].note).toMatch(/^assumed: /);
      expect(type.children![0].note).toContain(why);
      expect(type.children![0].note).toContain("this page shows 0");
      // lib/arkh's tree shows every source on such a map: so does this one (and its pool still gives a rate)
      expect(byName(byName(t, AFK_NODES.pool), "Voidwalker Family Bonus").val).toBe(60);
      expect(afkGainsModel.totalFromFlat(flattenTree(t))).toBe(0);
      expect(flagsOfTree(t)).toEqual([`${type.children![0].note}|0`]);
    }
  });

  it("a skill target (map 6, mining) shows the Fighting rate, with the note and an assumed: leaf of value 1", () => {
    const { tree: t, total } = tree({}, { map: 6 });
    expect(total).toBeCloseTo(tree().total, 12);
    const type = byName(t, AFK_NODES.type);
    expect(type).toMatchObject({ val: 1, note: `Map 6 · ${target(6)} · MINING — skill target: this page shows the fighting rate` });
    expect(type.children).toHaveLength(1);
    expect(type.children![0]).toMatchObject({ name: "AFK target", val: 1 });
    expect(type.children![0].note).toMatch(/^assumed: the AFK target .* is a MINING skill, whose own rate the game shows: this page shows the Fighting rate$/);
    expect(flagsOfTree(t)).toEqual([`${type.children![0].note}|1`]);
  });

  it("the saved AFK target is kept on the map the character stands on (Ruling V): Nothing there is 0, a monster is the rate", () => {
    const nothing = afkTree(synth({ AFKtarget_0: "Nothing" }, { seeds: SET, at: 251, trace: true }));
    expect(nothing.total).toBe(0);
    expect(byName(nothing.tree, AFK_NODES.type).note).toBe("Map 251 · Nothing · Nothing");
    const fight = afkTree(synth({ AFKtarget_0: "w6a1" }, { seeds: SET, at: 251, trace: true }));
    expect(fight.total).toBeGreaterThan(1);
  });

  it("map 306 (the Clamworks) shows its factor 0.2 and the tree gives a fifth of the plain rate", () => {
    const plain = tree();
    const clam = tree({}, { map: 306 });
    expect(clam.total).toBeCloseTo(plain.total / 5, 12);
    expect(byName(clam.tree, AFK_NODES.clam)).toMatchObject({ val: 0.2, note: "×0.2 on map 306 · Clamworks: AFK gains are 1/5" });
    expect(byName(plain.tree, AFK_NODES.clam)).toMatchObject({ val: 1, note: "×0.2 on map 306 · map 251: no effect" });
  });

  it("map 216 in cavern 17: the Cove replaces the rate (type FIGHTING whatever the target), bundle x1.3; elsewhere the Cove node is inactive", () => {
    const seeds = { ...SET, 'Holes2["Cglunko_AFKgains",0,0]': 0.5 };
    expect(target(216)).toBe("Nothing");
    const on = afkTree(synth({ Holes: [[17]], BundlesReceived: { bun_u: 1 } }, { seeds, map: 216, trace: true }));
    expect(on.total).toBeCloseTo(0.65, 12);
    const cove = byName(on.tree, AFK_NODES.cove);
    expect(cove).toMatchObject({ val: 0.65, fmt: "x" });
    expect(cove.children!.map((c) => c.name)).toEqual(["The character's cavern", 'Holes2("Cglunko_AFKgains", 0, 0)', "AFK Bundle"]);
    expect(cove.children![0].val).toBe(17);
    expect(cove.children![2].val).toBe(1);
    expect(byName(on.tree, AFK_NODES.type)).toEqual({ name: AFK_NODES.type, val: 1, fmt: "x", note: "Map 216 · Crystal Glunko Cove · FIGHTING" });
    expect(afkGainsModel.totalFromFlat(flattenTree(on.tree))).toBeCloseTo(0.65, 12);
    // another cavern: map 216's own target (Nothing) gives 0, the Cove node is inactive
    const off = afkTree(synth({ Holes: [[16]] }, { seeds, map: 216, trace: true }));
    expect(off.total).toBe(0);
    expect(byName(off.tree, AFK_NODES.cove)).toEqual({
      name: AFK_NODES.cove,
      val: 0,
      fmt: "x",
      note: "Map 216 (The Hole), cavern 17 (The Cove); replaces the whole rate · inactive: not map 216 in cavern 17",
    });
  });

  it("the total is the one AFKgainrates call: afkFightRate on a fresh Ctx gives it back, the tree adds no second computation", () => {
    for (const map of [251, 306, 6, 0]) {
      const c = synth({}, { seeds: SET, map, trace: true });
      const { total } = afkTree(c);
      expect(total, `map ${map}`).toBe(afkFightRate(synth({}, { seeds: SET, map })));
      expect(c.trace!.children.filter((n) => n.block === "AFKgainrates" && n.note !== "cached")).toHaveLength(1);
    }
    // the tree is read from the trace: a Ctx without one is refused
    expect(() => afkTree(synth({}, { seeds: SET }))).toThrow(/no trace|has none/);
  });
});

// ── every real save, character and map ──────────────────────────────────────────────────────────
/**
 * The maps: the plain fight, the Clamworks, the Cove's map (Nothing), a Nothing map, a no-monster map, a skill map and a dungeon (Ruling Y).
 * `explained`: pairs whose total differs from lib/arkh's and has an explanation (a KNOWN row of the pair, or the saved target the game keeps:
 * njs/afkGains.test.ts proves the exact values with the same pairs: 338 KNOWN on the fight maps, the 79 pairs the saved target moves on map 216);
 * the pairs with nothing to fight are 0 on both sides.
 */
const MAPS: Record<number, { explained: number }> = {
  251: { explained: 338 }, 306: { explained: 338 }, 216: { explained: 79 }, 0: { explained: 0 }, 33: { explained: 0 }, 6: { explained: 338 }, 40: { explained: 338 },
};
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"]; // Ruling E (njs/afkTerms.test.ts)

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(noSaves)("computeGameAfkGains against lib/arkh on every real save, character and map", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const leafMismatches: string[] = [];
      const display: string[] = [];
      const lost: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let explained = 0;
      let leafKnown = 0;
      let flags = 0;
      let dungeon = 0;
      let worst = 0;
      for (const path of GOLDEN_SAVES) {
        const file = basename(path);
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map, trace: true });
          let r: StatResult;
          try {
            r = afkTree(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${file}: ${e.key}`);
            continue;
          }
          pairs++;
          const tree = r.tree;
          const at = `${file}#${ci}@${map}`;
          // the total is lib/arkh's, or the pair's KNOWN rows / the saved target the game keeps explain the difference
          const want = arkhAfkRate(path, ci, map);
          if (!rel(r.total, want)) {
            const kept = afkTarget(ctx) !== target(map);
            const known = KNOWN_ARKH_DIFFS.some((d) => d.stat === "afk" && d.save === file && (d.ci ?? ci) === ci);
            if (!kept && !known) mismatches.push(`${at}: game ${r.total}, arkh ${want}`);
            else {
              explained++;
              // the adapter adds nothing to the number: a fresh Ctx's afkFightRate gives the same
              if (r.total !== afkFightRate(makeCtx(state, { player: ci, map }))) mismatches.push(`${at}: the tree's total is not afkFightRate's`);
            }
          }
          // every source leaf is lib/arkh's, except where the pair has a KNOWN row of that source
          const leaves = tree.children![0].children!;
          const arkhLeaves = arkhAfkLeaves(path, ci, map);
          const mine: Record<string, number> = {
            arcaneMapAfk: tree.children![1].children![0].val,
            etc92: tree.children![2].children![0].val,
            clamworks306: tree.children![3].val,
            cglunkoCove: tree.children![4].val,
          };
          POOL_IDS.forEach((id, k) => (mine[id] = leaves[k].val));
          for (const [id, v] of Object.entries(mine)) {
            if (rel(v, arkhLeaves[id])) continue;
            const covered = KNOWN_ARKH_DIFFS.some((d) => d.stat === "afk" && d.save === file && (d.ci ?? ci) === ci && d.source === id);
            if (covered) leafKnown++;
            else leafMismatches.push(`${at} ${id}: game ${v}, arkh ${arkhLeaves[id]}`);
          }
          // display and value agree: the page's Biggest Gains model gives the total back from the flat tree
          const fromFlat = afkGainsModel.totalFromFlat(flattenTree(tree));
          worst = Math.max(worst, Math.abs(fromFlat - r.total) / Math.max(1, Math.abs(r.total)));
          if (!rel(fromFlat, r.total)) display.push(`${at}: the flat tree gives ${fromFlat}, the call ${r.total}`);
          if (tree.val !== r.total) display.push(`${at}: root ${tree.val} is not the total ${r.total}`);
          // every runtime: / assumed: note of the full trace (the same traced Ctx) is in the tree (Ruling L trims only the rest)
          const full = flagsOfTrace(ctx.trace!).sort();
          flags += full.length;
          if (full.some((f) => f.includes("outside a dungeon"))) dungeon++;
          if (JSON.stringify(flagsOfTree(tree).sort()) !== JSON.stringify(full)) lost.push(`${at}: full trace ${full.length} notes, page tree ${flagsOfTree(tree).length}`);
        }
      }
      console.info(
        `[afk adapter @${map}] ${pairs} pairs, ${explained} explained, ${leafKnown} known leaves, ${mismatches.length} total and ${leafMismatches.length} leaf mismatches, ${flags} flagged notes (${dungeon} pairs with the dungeon stand-in), worst flat-tree error ${worst.toExponential(2)}, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`
      );
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(leafMismatches.slice(0, 20)).toEqual([]);
      expect(display.slice(0, 20)).toEqual([]);
      expect(lost.slice(0, 20)).toEqual([]);
      expect(pairs).toBeGreaterThan(1000);
      expect(explained, "pairs whose total differs from lib/arkh's and is explained").toBe(MAPS[map].explained);
      // the Tome refusal behind the talents (Ruling E): the tree reads the sources on every map, so the maps with nothing to fight refuse it too
      expect([...refused].sort()).toEqual(HOURZERO);
      // not vacuous: a map with nothing to fight still has its A9 leaf in the tree
      if (map === 0 || map === 33) expect(flags).toBeGreaterThanOrEqual(pairs);
      // Ruling Y: a dungeon map reads Dungon's assumed: leaf in every tree (inside a talent), and no other map does
      expect(dungeon, "pairs with the dungeon stand-in").toBe(map === 40 ? pairs : 0);
    }, 1_800_000);
  }
});

// ── the tree's size (Ruling L) ──────────────────────────────────────────────────────────────────
// The page persists flattenTree(tree) in every snapshot (localStorage, writes dropped silently on quota), so the tree may not outgrow
// lib/arkh's by more than 2x.
describe.skipIf(noSaves)("the page's tree stays small", () => {
  it("has at most 2x the nodes of lib/arkh's tree on every real save and character (map 251)", () => {
    const over: string[] = [];
    let worst = { ratio: 0, at: "", game: 0, arkh: 0 };
    let pairs = 0;
    for (const path of GOLDEN_SAVES) {
      const state = stateOf(path);
      const env = JSON.parse(readFileSync(path, "utf8"));
      for (let ci = 0; ci < state.charNames.length; ci++) {
        let game: number;
        try {
          game = count(afkTree(makeCtx(state, { player: ci, map: 251, trace: true })).tree);
        } catch (e) {
          if (e instanceof MissingSaveKey) continue;
          throw e;
        }
        const arkh = count(computeArkhAfkGains(structuredClone(env), ci, 251).tree);
        pairs++;
        if (game / arkh > worst.ratio) worst = { ratio: game / arkh, at: `${basename(path)}#${ci}`, game, arkh };
        if (game > 2 * arkh) over.push(`${basename(path)}#${ci}: ${game} nodes against ${arkh}`);
      }
    }
    console.info(`[afk adapter] tree size: ${pairs} pairs, worst ratio ${worst.ratio.toFixed(2)} at ${worst.at} (${worst.game} nodes against ${worst.arkh})`);
    expect(over).toEqual([]);
    expect(pairs).toBeGreaterThan(1000);
  }, 1_800_000);
});

// ── the tree on real saves: lib/arkh's names ────────────────────────────────────────────────────
const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");
const ARLONG = GOLDEN_SAVES.find((p) => basename(p) === "Arlong.json");

describe.skipIf(!ARKHE || !ARLONG)("the tree's names, formats and notes equal lib/arkh's (the Observed Max data is keyed by them)", () => {
  const cases = (): [string, number, number][] => [[ARKHE!, 0, 251], [ARKHE!, 8, 251], [ARKHE!, 0, 306], [ARKHE!, 0, 6], [ARKHE!, 0, 0], [ARKHE!, 0, 216], [ARLONG!, 0, 251], [ARLONG!, 0, 33]];
  it("on the root, the groups, every source and the rules", () => {
    for (const [path, ci, map] of cases()) {
      const at = `${basename(path)}#${ci}@${map}`;
      const env = JSON.parse(readFileSync(path, "utf8"));
      const arkh = computeArkhAfkGains(structuredClone(env), ci, map).tree;
      const { tree } = computeGameAfkGains(env, ci, map);
      expect({ ...shape(tree), note: tree.note?.replace(/ · migrated from an older game version \(\d+ load steps?\)$/, "") }, at).toEqual(shape(arkh));
      // lib/arkh's six children, in its order, then only reads that lead to a runtime: / assumed: note
      expect(tree.children!.slice(0, 6).map((c) => c.name), at).toEqual(ROOT_CHILDREN);
      for (const extra of tree.children!.slice(6)) expect(flagsOfTree(extra).length, `${at} ${extra.name}`).toBeGreaterThan(0);
      for (const name of ROOT_CHILDREN) {
        const g = byName(tree, name);
        const a = byName(arkh, name);
        // the type node's note names the target the game has (Ruling V keeps a saved one); lib/arkh's is the map's default
        if (name === AFK_NODES.type && afkTarget(makeCtx(stateOf(path), { player: ci, map })) !== target(map)) continue;
        expect(shape(g), `${at} ${name}`).toEqual(shape(a));
      }
      // every source: name, format, note (the pool's 38, the two multipliers' one each)
      const sources = (n: Node) => (n.children ?? []).map(shape);
      expect(sources(byName(tree, AFK_NODES.pool)), `${at} pool`).toEqual(sources(byName(arkh, AFK_NODES.pool)));
      expect(sources(byName(tree, AFK_NODES.arcane)), `${at} arcane`).toEqual(sources(byName(arkh, AFK_NODES.arcane)));
      expect(sources(byName(tree, AFK_NODES.etc92)), `${at} etc92`).toEqual(sources(byName(arkh, AFK_NODES.etc92)));
    }
  }, 120_000);

  it("the Cove node and the type node of a character in cavern 17 on map 216 equal lib/arkh's", () => {
    const env = JSON.parse(readFileSync(ARKHE!, "utf8")) as GameEnvelope & { data: Record<string, unknown> };
    const raw = env.data.Holes;
    const holes = (typeof raw === "string" ? JSON.parse(raw) : structuredClone(raw)) as number[][];
    holes[0][0] = 17;
    env.data.Holes = typeof raw === "string" ? JSON.stringify(holes) : holes;
    const arkh = computeArkhAfkGains(structuredClone(env), 0, 216).tree;
    const { tree, total } = computeGameAfkGains(env, 0, 216);
    for (const name of [AFK_NODES.cove, AFK_NODES.type]) expect(shape(byName(tree, name))).toEqual(shape(byName(arkh, name)));
    expect(byName(tree, AFK_NODES.cove).val).toBeCloseTo(byName(arkh, AFK_NODES.cove).val, 9);
    expect(total).toBe(computeArkhAfkGains(structuredClone(env), 0, 216).total);
    expect(total).toBe(AFKgainrates(makeCtx(buildGameState(structuredClone(env)), { player: 0, map: 216 }), "Fighting"));
  }, 120_000);
});

// ── the game's own text ─────────────────────────────────────────────────────────────────────────
// No AFK in-game reading is recorded yet (the controller records them, Ruling AA): the test skips cleanly while fixtures/readings.json has
// no afkGains entry, and runs the day one is added. The panel prints "⌊100·rate⌋%".
describe("the AFK readings, through the adapter (the AFK Info panel's AFK GAINS RATE)", () => {
  const rows = loadReadings().filter((r) => r.stat === "afkGains");
  if (rows.length === 0) it.skip("no afkGains reading in fixtures/readings.json yet (Ruling AA)", () => {});
  for (const r of rows) {
    // a known engine gap (fixtures/readings.json `knownGaps`) keeps the exact assert and runs through it.fails: it turns red the day it matches
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("afkGains") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const { total } = computeGameAfkGains(readingSave(r), r.charIdx, r.map);
      const site = formatGameValue("afkGains", { value: total });
      console.info(`[afk adapter] ${r.id}: game ${r.game}, ours ${site}`);
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
  }
});
