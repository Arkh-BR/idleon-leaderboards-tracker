// Task 9 (Damage plan): the Damage adapter (lib/game/trackers/damage.ts), DamageDealed("Max") and ("Mastery") turned into the page's tree.
//
// - the display config moved to lib/damage/layers (Ruling B), lib/arkh re-exporting the very same objects; the tracker registry;
// - on a synthetic envelope (CI): the tree's shape, the recombination guard (TreeTotalMismatch), the arena's tree, a dungeon map (Ruling Y:
//   the normal Max with the assumed: note in the tree) and the forms' runtime: notes;
// - on every real save, character and map (251, the arena 43, the Clamworks 306, the readings' 150 and the dungeon 40): the total and
//   Mastery against lib/arkh (a difference closed by the KNOWN propagation of njs/damage.test.ts, support/damageProof), every source leaf
//   against lib/arkh's, the steps recombining as lib/arkh's own math (the page's Biggest Gains) does, the size (Ruling L, at most 2x lib/arkh's
//   nodes) and every runtime: / assumed: note of the full trace kept;
// - the tree on real saves: names, formats and notes equal to lib/arkh's; the 4 Damage readings in the game's display format.
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as arkhDef from "@/lib/arkh/stats/defs/damage";
import { computeArkhDamage } from "@/lib/arkh/computeDamage";
import * as layers from "@/lib/damage/layers";
import { damageGainsModel } from "@/lib/damage/gains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { asNum } from "@/lib/game/attr";
import { makeCtx, withPlayer, type TraceNode } from "@/lib/game/ctx";
import { MissingSaveKey, TreeTotalMismatch } from "@/lib/game/errors";
import { ClassStatTypes } from "@/lib/game/data";
import { DAMAGE_REFUSABLE } from "@/lib/diagnose/characterize";
import { DamageDealed } from "@/lib/game/njs/DamageDealed";
import { ReturnClasses } from "@/lib/game/njs/ReturnClasses";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { computeGameDamage, damageTree, gameDamage } from "@/lib/game/trackers/damage";
import { formatGameValue, normalizeGameText, parseGameValue } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatResult } from "@/lib/statTracker/config";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhDamage, arkhDamageLeaves, type ArkhStat } from "../support/arkhOracle";
import { DAMAGE_REFUSALS, EXPECT_TOTAL_KNOWN, clearDamageProofs, damageProof, damageProvedCtx, hasDamageKnown } from "../support/damageProof";
import { stubbed } from "../support/damageStub";

type Node = StatResult["tree"];
const { DMG_KEYS, DMG_LAYERS, DMG_MASTERY, DMG_NODES, DMG_RAT, DMG_ROOT, DMG_RULES } = layers;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const noSaves = GOLDEN_SAVES.length === 0;
const IDS = [...DMG_LAYERS.flatMap((l) => l.steps.flatMap((s) => ("sources" in s ? s.sources : []))), ...DMG_RAT.sources, ...DMG_MASTERY.sources];
const count = (n: Node): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
const FLAG = /^(runtime|assumed):/;
const flagsOfTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(flagsOfTrace)];
const flagsOfTree = (n: Node): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(flagsOfTree)];
const byName = (n: Node, name: string): Node => {
  const c = n.children?.find((k) => k.name === name);
  if (!c) throw new Error(`no "${name}" under "${n.name}"`);
  return c;
};
/** Every source node of a tree by id: its layer and step from DMG_LAYERS, the arena and Mastery as root children of their own. */
function sourcesOf(tree: Node): Record<string, Node> {
  const out: Record<string, Node> = {};
  for (const l of DMG_LAYERS) {
    const layer = tree.children!.find((c) => c.name === l.node);
    if (!layer) continue; // the arena's tree has no layer
    l.steps.forEach((s, si) => {
      if ("sources" in s) s.sources.forEach((id, k) => (out[id] = layer.children![si].children![k]));
    });
  }
  DMG_RAT.sources.forEach((id, k) => (out[id] = byName(tree, DMG_RAT.name).children![k]));
  byName(tree, DMG_MASTERY.name).children?.forEach((n, k) => (out[DMG_MASTERY.sources[k]] = n));
  return out;
}
/** The root's own children, as lib/arkh's tree has them (the layers, the arena, Mastery): what comes after are the head guards' traces. */
const ROOT_CHILDREN = [DMG_NODES.base, DMG_NODES.pct, DMG_NODES.mult, DMG_RULES.rat, DMG_NODES.mastery];

// ── the display config and the registry ─────────────────────────────────────────────────────────
describe("the display config and the registry", () => {
  it("lives in lib/damage/layers and lib/arkh's def re-exports the very same objects (Ruling B)", () => {
    expect(arkhDef.DMG_LAYERS).toBe(DMG_LAYERS);
    expect(arkhDef.DMG_NODES).toBe(DMG_NODES);
    expect(arkhDef.DMG_RULES).toBe(DMG_RULES);
    expect(arkhDef.DMG_ROOT).toBe(DMG_ROOT);
    expect(arkhDef.DMG_RAT).toBe(DMG_RAT);
    expect(arkhDef.DMG_KEYS).toBe(DMG_KEYS);
    expect(arkhDef.DMG_MASTERY).toBe(DMG_MASTERY);
    expect(IDS).toHaveLength(155);
    expect(new Set(IDS).size).toBe(IDS.length);
  });

  it("TRACKERS.damage is DamageDealed(ctx, 'Max')", () => {
    const c = stubbed({ "ArcadeBonus[0]": 30 });
    expect(TRACKERS.damage!(c)).toBe(DamageDealed(stubbed({ "ArcadeBonus[0]": 30 }), "Max"));
    expect(TRACKERS.damage!(c)).toBe(30);
  });

  it("TRACKERS has the Player Info stats the Damage readings carry, each its N.js block (lib/readings/compute dispatches on it)", () => {
    const calls = { maxHp: "PlayerHPmax[]", maxMp: "PlayerMPmax[]", accuracy: "PlayerAccTot[]", str: 'TotalStats["STR"]', agi: 'TotalStats["AGI"]', wis: 'TotalStats["WIS"]', luk: 'TotalStats["LUK"]' } as const;
    Object.entries(calls).forEach(([stat, call], i) => expect(TRACKERS[stat as keyof typeof calls]!(stubbed({ [call]: 7 + i })), stat).toBe(7 + i));
    expect(Object.keys(TRACKERS).sort()).toEqual(["accuracy", "afkGains", "agi", "artifactFind", "damage", "expMulti", "luk", "maxHp", "maxMp", "str", "wis"]);
  });

  it("characterize accepts exactly the refusals the real-save loops pin (DAMAGE_REFUSABLE)", () => {
    for (const f of DAMAGE_REFUSALS) expect(DAMAGE_REFUSABLE(f.slice(f.indexOf(": ") + 2)), f).toBe(true);
  });
});

// ── the tree on a synthetic envelope (CI) ───────────────────────────────────────────────────────
// Every block DamageDealed calls is answered from the Ctx cache (support/damageStub), so the tree's own logic is what is under test.
describe("the tree on a synthetic envelope (runs in CI)", () => {
  const SET = { "ArcadeBonus[0]": 30, 'GetBribeBonus["30"]': 50, 'WorkbenchStuff["AdditionExtraDMG",0,0]': 2, 'EtcBonuses["21"]': 10 };
  const tree = (map = 251, set: Record<string, number> = SET) => damageTree(stubbed(set, { map, trace: true }));

  it("has lib/arkh's shape: the three layers with their steps and sources, the arena, Mastery; then the forms' traces", () => {
    const { tree: t, total } = tree();
    expect(total).toBe(30 * 1.5 * 2);
    expect(t).toMatchObject({ name: DMG_ROOT, val: total, fmt: "raw", note: "Min ~ Max · Min = Max × Mastery" });
    expect(t.children!.slice(0, 5).map((c) => c.name)).toEqual(ROOT_CHILDREN);
    DMG_LAYERS.forEach((l, li) => {
      expect(t.children![li].children!.map((s) => s.name)).toEqual(l.steps.map((s) => s.name));
      l.steps.forEach((s, si) => {
        if ("sources" in s) expect(t.children![li].children![si].children!.length, s.key).toBe(s.sources.length);
      });
    });
    expect(Object.keys(sourcesOf(t)).sort()).toEqual([...IDS].sort());
    expect(byName(t, DMG_NODES.mastery).val).toBe(DamageDealed(stubbed(SET), "Mastery"));
    expect(byName(t, DMG_NODES.mastery).val).toBeCloseTo(0.45, 12);
    // after the root's own children, only the head guards DamageDealed passes before Max: the three masterclass forms (runtime 0s)
    expect(t.children!.slice(5).map((c) => c.name)).toEqual(['Summoning("GrimoireWraith", 0, 0)', 'Windwalker("CompassTempest", 0, 0)', 'ArcaneType("TesseractArcanist", 0, 0)']);
    for (const f of t.children!.slice(5)) expect(flagsOfTree(f)).toEqual(["runtime: masterclass form, not counted|0"]);
    // a source carries the call it stands for: block and arguments, its value
    const s = sourcesOf(t);
    expect(s.arcade0.children).toEqual([{ name: "ArcadeBonus(0)", val: 30, fmt: "raw", note: "cached" }]);
    expect(s.buff108.children![0]).toMatchObject({ name: "GetBuffBonuses(108, 2)", val: 0 });
    expect(flagsOfTree(s.buff108)).toEqual(["runtime: active buff, not counted|0"]);
    expect(s.ratDmg).toMatchObject({ name: "Rat Damage (Royal Guardian arena)", val: 0 });
    expect(s.map306.val).toBe(1);
  });

  it("the soft caps and the Reliquarium show what they did, and the layers give the total", () => {
    const set = { "ArcadeBonus[0]": 20000, 'WorkbenchStuff["AdditionExtraDMG",0,0]': 1000, 'Thingies["ReliquariumInPosession",0,0]': 1 };
    const { tree: t, total } = damageTree(stubbed(set, { trace: true, data: { OptLacc: Object.assign([], { 473: 3 }) } }));
    const base = byName(t, DMG_NODES.base);
    const capped = 4e3 + Math.pow(20000 - 4e3, 0.91);
    expect(byName(base, DMG_RULES.capBase)).toMatchObject({ fmt: "x", note: `20000 → ${+capped.toFixed(3)}` });
    expect(byName(base, DMG_RULES.capBase).val).toBeCloseTo(capped / 20000, 12);
    const relic = byName(byName(t, DMG_NODES.mult), DMG_RULES.relic);
    expect(relic).toMatchObject({ val: 4 / 8, fmt: "raw" });
    const l2 = Math.pow(100 + Math.pow(1000 - 100, 0.86), 4 / 8);
    expect(byName(t, DMG_NODES.mult).val).toBeCloseTo(l2, 9);
    expect(total).toBeCloseTo(capped * l2, 6);
  });

  // The sources redo some of DamageDealed's arithmetic, and the page's Biggest Gains rebuilds the total from the tree's numbers. If one copy
  // goes stale the tree must not be shown (spec section 4).
  it("throws TreeTotalMismatch when the layers no longer give the call's total (a constant changed in one place only)", () => {
    const real = TRACKERS.damage!;
    try {
      TRACKERS.damage = (ctx) => real(ctx) * 1.001;
      let caught: unknown;
      try {
        tree();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(TreeTotalMismatch);
      expect((caught as TreeTotalMismatch).total / (caught as TreeTotalMismatch).rebuilt).toBeCloseTo(1.001, 9);
      TRACKERS.damage = (ctx) => real(ctx) * (1 + 1e-12); // float noise is not a mismatch
      expect(() => tree()).not.toThrow();
    } finally {
      TRACKERS.damage = real;
    }
  });

  it("map 43: the arena replaces Max before anything else is computed, so the tree is the arena and Mastery (fixed .2)", () => {
    const { tree: t, total } = tree(43, { ...SET, 'RoyalG["RatDMG",0,0]': 77 });
    expect(total).toBe(77);
    expect(t.children!.slice(0, 2).map((c) => c.name)).toEqual([DMG_RULES.rat, DMG_NODES.mastery]);
    expect(byName(t, DMG_RULES.rat)).toMatchObject({ val: 77, note: "replaces the total" });
    expect(byName(t, DMG_RULES.rat).children![0].children![0]).toMatchObject({ name: 'RoyalG("RatDMG", 0, 0)', val: 77 });
    expect(byName(t, DMG_NODES.mastery)).toMatchObject({ val: 0.2, note: "fixed 0.2 on map 43" });
    // the page's Biggest Gains sees the replacement and ranks nothing
    expect(damageGainsModel.replacedBy!(flattenTree(t))).toBe(DMG_RAT.name);
    expect(damageGainsModel.totalFromFlat(flattenTree(t))).toBe(77);
  });

  it("map 306 divides the multipliers by 100^Menagerie[5][2], shown as the Map step's factor", () => {
    const { tree: t, total } = damageTree(stubbed(SET, { map: 306, trace: true, data: { Menagerie: [[], [], [], [], [], [0, 0, 2]] } }));
    expect(total).toBeCloseTo((30 * 1.5 * 2) / 1e4, 15);
    expect(total).toBeGreaterThan(0);
    const map = sourcesOf(t).map306;
    expect(map.val).toBe(1e-4);
    expect(map.children).toEqual([{ name: "Menagerie[5][2]", val: 2, fmt: "raw", note: "a plain read of the save, not an N.js call" }]);
  });

  // Ruling Y (user decision 2026-11-05): a dungeon map shows the normal Max with a warning. The warning is Dungon's assumed: leaf, which the
  // tree keeps; the number is the plain map's (every block is answered the same here, so only the dungeon branches could move it)
  it("a dungeon map gives the plain map's Max and Mastery, with the assumption in the tree", () => {
    const plain = tree(251);
    for (const map of [39, 40, 70, 71, 118, 119]) {
      const { tree: t, total } = tree(map);
      expect(total, `map ${map}`).toBe(plain.total);
      expect(byName(t, DMG_NODES.mastery).val, `map ${map}`).toBe(byName(plain.tree, DMG_NODES.mastery).val);
      const dungeon = t.children!.find((c) => c.name === "Dungon")!;
      expect(dungeon, `map ${map}`).toMatchObject({ val: -1 });
      expect(flagsOfTree(dungeon)).toEqual(["assumed: outside a dungeon (the dungeon run's own stats are not counted)|-1"]);
    }
    expect(plain.tree.children!.some((c) => c.name === "Dungon")).toBe(false);
  });

  it("no lib/game module tests the dungeon maps itself: every dungeon branch goes through Dungon, so its stand-in covers them all", async () => {
    const { readdirSync } = await import("node:fs");
    // a dungeon map compared with the map (either side, == or ===, != too) or listed in an array the map is looked up in
    const D = "(?:39|40|70|71|118|119)";
    const M = "\\w+\\.map\\b(?!\\s*\\()";
    const test = new RegExp(`\\b${D}\\s*[!=]==?\\s*${M}|${M}\\s*[!=]==?\\s*${D}\\b|\\[[^\\]]*\\b${D}\\b[^\\]]*\\]\\.includes\\(\\s*${M}`);
    for (const s of ["40 == ctx.map", "ctx.map === 118", "c.map != 71", "119 !== ctx.map", "[39, 70].includes(ctx.map)", "[1, 40, 2].includes(c.map)"]) expect(test.test(s), s).toBe(true);
    for (const s of ["43 == ctx.map", "ctx.map === 306", "[43, 306].includes(ctx.map)", "140 == ctx.map", "ctx.map == 400", "[40].map(f)"]) expect(test.test(s), s).toBe(false);
    const files = readdirSync("lib/game", { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".ts") && !/(^|[\\/])Dungon\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(50); // the walk reached lib/game's modules
    expect(files.filter((f) => test.test(readFileSync(`lib/game/${f}`, "utf8")))).toEqual([]);
  });
});

// ── every real save, character and map ──────────────────────────────────────────────────────────
/** The maps: map 251, the Royal Guardian arena, the Clamworks, the readings' map and a dungeon (Ruling Y: the normal Max, as lib/arkh's). */
const MAPS = [251, 43, 306, 150, 40] as const;
const MAIN: Record<string, ArkhStat> = { STR: "str", AGI: "agi", WIS: "wis", LUK: "luk" };
/** The stats a source is built on (the INHERIT tables of the family tests): a KNOWN row of the stat explains the source's difference. */
const READS: Record<string, (primary: ArkhStat) => (ArkhStat | "speed")[]> = {
  statType: (p) => [p], statPow: (p) => [p], statWpFloor: (p) => [p], artifact25: (p) => [p],
  talent86: () => ["maxHp"], bubbleHP: () => ["maxHp"], talent446: () => ["maxMp"], bubbleMP: () => ["maxMp"], talent290: () => ["speed"], bubbleSPD: () => ["speed"],
  bubbleW5: () => ["str", "luk"], bubbleA5: () => ["agi"], bubbleM5: () => ["wis"],
};

const states = new Map<string, GameState>();
afterAll(() => {
  states.clear();
  clearDamageProofs();
});
function stateOf(path: string): GameState {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
}

describe.skipIf(noSaves)("computeGameDamage against lib/arkh on every real save, character and map", () => {
  for (const map of MAPS) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const leafMismatches: string[] = [];
      const display: string[] = [];
      const lost: string[] = [];
      const refused = new Set<string>();
      const known = { max: 0, mastery: 0 };
      let pairs = 0;
      let leafKnown = 0;
      let flags = 0;
      let worst = 0;
      for (const path of GOLDEN_SAVES) {
        const file = basename(path);
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map, trace: true });
          let r: StatResult;
          try {
            r = damageTree(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${file}: ${e.key}`);
            continue;
          }
          pairs++;
          const tree = r.tree;
          const mastery = byName(tree, DMG_NODES.mastery).val;
          // the total and Mastery are lib/arkh's, or the pair's KNOWN causes close the difference (njs/damage.test.ts's propagation)
          const want = arkhDamage(path, ci, map);
          for (const [what, got] of [["max", r.total], ["mastery", mastery]] as const) {
            if (rel(got, want[what])) continue;
            const at = `${file}#${ci}@${map} ${what}: game ${got}, arkh ${want[what]}`;
            const proof = damageProof(path, ci);
            if (!proof.reasons.length) {
              mismatches.push(at);
              continue;
            }
            const proved = DamageDealed(damageProvedCtx(path, ci, map, proof, state), what === "max" ? "Max" : "Mastery");
            expect(rel(proved, got), `${at}: the proof changed nothing`).toBe(false);
            if (rel(proved, want[what])) known[what]++;
            else mismatches.push(`${at}, with ${proof.reasons.join(" ")} ${proved}`);
          }
          // every source leaf is lib/arkh's, except where the pair has a KNOWN row of the leaf or of a stat it is built on
          const leaves = sourcesOf(tree);
          const arkhLeaves = arkhDamageLeaves(path, ci, map);
          const c = withPlayer(makeCtx(state, { player: 0, map }), ci);
          const primary = MAIN[`${ClassStatTypes[`${ReturnClasses(asNum(c, "CharacterClass"))[0]}`][0]}`];
          for (const [id, n] of Object.entries(leaves)) {
            if (rel(n.val, arkhLeaves[id])) continue;
            const reads = READS[id]?.(primary) ?? [];
            const covered = KNOWN_ARKH_DIFFS.some((d) => d.save === file && (d.ci ?? ci) === ci && ((d.stat === "damage" && d.source === id) || reads.includes(d.stat as ArkhStat)));
            if (covered) leafKnown++;
            else leafMismatches.push(`${file}#${ci}@${map} ${id}: game ${n.val}, arkh ${arkhLeaves[id]}`);
          }
          // display and value agree: the page's Biggest Gains (lib/arkh's dmgMax over the flat tree) gives the total back
          const fromFlat = damageGainsModel.totalFromFlat(flattenTree(tree));
          worst = Math.max(worst, Math.abs(fromFlat - r.total) / Math.max(1, Math.abs(r.total)));
          if (!rel(fromFlat, r.total)) display.push(`${file}#${ci}@${map}: the flat tree gives ${fromFlat}, the call ${r.total}`);
          if (tree.val !== r.total) display.push(`${file}#${ci}@${map}: root ${tree.val} is not the total ${r.total}`);
          // every runtime: / assumed: note of the full trace (the same traced Ctx) is in the tree (Ruling L trims only the rest)
          const full = flagsOfTrace(ctx.trace!).sort();
          flags += full.length;
          if (JSON.stringify(flagsOfTree(tree).sort()) !== JSON.stringify(full)) lost.push(`${file}#${ci}@${map}: full trace ${full.length} notes, page tree ${flagsOfTree(tree).length}`);
        }
      }
      console.info(
        `[damage adapter @${map}] ${pairs} pairs, known max ${known.max} / mastery ${known.mastery}, ${leafKnown} known leaves, ${mismatches.length} total and ${leafMismatches.length} leaf mismatches, ${flags} flagged notes, worst flat-tree error ${worst.toExponential(2)}, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`
      );
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(leafMismatches.slice(0, 20)).toEqual([]);
      expect(display.slice(0, 20)).toEqual([]);
      expect(lost.slice(0, 20)).toEqual([]);
      expect(pairs).toBeGreaterThan(1000);
      // not vacuous: the forms' three runtime notes in every trace, and leaves that differ where a KNOWN row says so (the arena computes neither)
      if (map !== 43) expect(flags).toBeGreaterThan(3 * pairs);
      if (map !== 43) expect(leafKnown).toBeGreaterThan(0);
      expect(known, "KNOWN pairs").toEqual(EXPECT_TOTAL_KNOWN[map] ?? EXPECT_TOTAL_KNOWN[251]);
      // the arena reads only its rat damage, so HourZero (whose stats read the Tome) is not refused there
      expect([...refused].sort()).toEqual(map === 43 ? [] : DAMAGE_REFUSALS);
    }, 1_800_000);
  }
});

// ── the tree's size (Ruling L) ──────────────────────────────────────────────────────────────────
// The page persists flattenTree(tree) in every snapshot (localStorage, writes dropped silently on quota), so the tree may not outgrow
// lib/arkh's by more than 2x. The Task 8 probe measured 301 trimmed trace nodes against lib/arkh's 1332: this is that measure, committed.
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
          game = count(gameDamage(state, ci, 251).tree);
        } catch (e) {
          if (e instanceof MissingSaveKey) continue;
          throw e;
        }
        const arkh = count(computeArkhDamage(structuredClone(env), ci, 251).tree);
        pairs++;
        if (game / arkh > worst.ratio) worst = { ratio: game / arkh, at: `${basename(path)}#${ci}`, game, arkh };
        if (game > 2 * arkh) over.push(`${basename(path)}#${ci}: ${game} nodes against ${arkh}`);
      }
    }
    console.info(`[damage adapter] tree size: ${pairs} pairs, worst ratio ${worst.ratio.toFixed(2)} at ${worst.at} (${worst.game} nodes against ${worst.arkh})`);
    expect(over).toEqual([]);
    expect(pairs).toBeGreaterThan(1000);
  }, 1_800_000);
});

// ── the tree on real saves: lib/arkh's names ────────────────────────────────────────────────────
const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");
const ARLONG = GOLDEN_SAVES.find((p) => basename(p) === "Arlong.json"); // Menagerie[5][2] > 0: map 306 really divides

describe.skipIf(!ARKHE || !ARLONG)("the tree's names, formats and notes equal lib/arkh's (the Observed Max data is keyed by them)", () => {
  const shape = (n: Node) => ({ name: n.name, fmt: n.fmt, note: n.note });
  const cases = (): [string, number, number][] => [[ARKHE!, 0, 251], [ARKHE!, 8, 251], [ARKHE!, 8, 306], [ARLONG!, 0, 306], [ARKHE!, 0, 43]];
  it("on the root, the layers, the steps and every source", () => {
    for (const [path, ci, map] of cases()) {
      const at = `${basename(path)}#${ci}@${map}`;
      const env = JSON.parse(readFileSync(path, "utf8"));
      const arkh = computeArkhDamage(structuredClone(env), ci, map).tree;
      const { tree } = computeGameDamage(env, ci, map);
      expect({ ...shape(tree), note: tree.note?.replace(/ · migrated from an older game version \(\d+ load steps?\)$/, "") }, at).toEqual(shape(arkh));
      // the root's children are lib/arkh's (on the arena only the arena and Mastery: the game computes nothing else there), then the head
      // guards' traces, each carrying a runtime: / assumed: note
      const own = tree.children!.filter((c) => ROOT_CHILDREN.includes(c.name as never));
      expect(own.map((c) => c.name), at).toEqual(map === 43 ? [DMG_RULES.rat, DMG_NODES.mastery] : ROOT_CHILDREN);
      for (const extra of tree.children!.slice(own.length)) expect(flagsOfTree(extra).length, `${at} ${extra.name}`).toBeGreaterThan(0);
      for (const n of own) {
        const a = byName(arkh, n.name);
        expect(shape(n), `${at} ${n.name}`).toEqual(shape(a));
        if (n.name === DMG_NODES.mastery && map === 43) continue; // no Mastery source on the arena
        n.children!.forEach((step, si) => {
          // a step of the layers, or a source of the arena / Mastery: name, format, note; a step's own sources too
          expect(shape(step), `${at} ${n.name} / ${step.name}`).toEqual(shape(a.children![si]));
          if (ROOT_CHILDREN.slice(0, 3).includes(n.name as never))
            step.children?.forEach((src, k) => expect(shape(src), `${at} ${step.name} / ${src.name}`).toEqual(shape(a.children![si].children![k])));
        });
      }
    }
  }, 120_000);
});

// ── the game's own text ─────────────────────────────────────────────────────────────────────────
describe("the Damage readings, through the adapter (Player Info's Min~Max)", () => {
  const rows = loadReadings().filter((r) => r.stat === "damage");
  it("the readings fixture has the 4 Damage readings", () => expect(rows.length).toBe(4));
  for (const r of rows) {
    // a known engine gap (fixtures/readings.json `knownGaps`) keeps the exact assert and runs through it.fails: it turns red the day it matches
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("damage") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const { tree, total } = computeGameDamage(readingSave(r), r.charIdx, r.map);
      const min = total * byName(tree, DMG_NODES.mastery).val; // what the page's headline computes
      const site = formatGameValue("damage", { value: total, min });
      console.info(`[damage adapter] ${r.id}: game ${r.game}, ours ${site}`);
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
    // it.fails passes on any throw: a known gap must also stay as small as it is (farkhe: Max and Min ~1.15e-6 under the game)
    if (r.knownGaps?.includes("damage"))
      it.skipIf(!existsSync(join(READINGS_DIR, r.saveFile)))(`${r.id}: the known gap stays below 2e-6 relative`, () => {
        const { tree, total } = computeGameDamage(readingSave(r), r.charIdx, r.map);
        const [min, max] = r.game.split("~");
        expect(Math.abs(total / parseGameValue("damage", max) - 1)).toBeLessThan(2e-6);
        expect(Math.abs((total * byName(tree, DMG_NODES.mastery).val) / parseGameValue("damage", min) - 1)).toBeLessThan(2e-6);
      });
  }
});
