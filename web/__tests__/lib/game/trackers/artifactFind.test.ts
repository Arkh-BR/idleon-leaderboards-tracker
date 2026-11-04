// Task 9: Sailing("BoatArtiMulti", 0) and the Artifact Find adapter (lib/game/trackers/artifactFind.ts).
//
// BoatArtiMulti is one expression of the ported blocks; the adapter turns the ONE traced call into the page's tree. The file tests:
// - the expression: N.js's text token for token, its calls, the boat argument, the strict Boats row, the tracker registry;
// - the display config moved to lib/artifactFind/groups, and that no file under lib/game imports lib/arkh (the data re-exports aside);
// - the totals against lib/arkh over every real save and character (minus KNOWN_ARKH_DIFFS), each source leaf against lib/arkh's, the
//   groups recombining to the total (display and value agree), and the pinned Ruling E refusals (pre-migration saves throw);
// - the page's tree stays within 2x of lib/arkh's node count and keeps every runtime:/assumed: note of the full trace (Ruling L);
// - the tree on the 2026-11-01 save: shape, names/formats/notes equal to lib/arkh's, the trace children, the recombination guard
//   (TreeTotalMismatch), and the number the game showed for it (167Q);
// - switching character: only the per-character terms move.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import * as arkhDef from "@/lib/arkh/stats/defs/artifact-find";
import { applyGroupStep, groupVal } from "@/lib/arkh/stats/defs/grouped";
import { ARTI_GROUPS, ARTI_ROOT, ARTI_VOTE_NAME } from "@/lib/artifactFind/groups";
import { formatArtifactFind } from "@/lib/artifactFind/format";
import { asNum } from "@/lib/game/attr";
import { makeCtx, withPlayer, type TraceNode } from "@/lib/game/ctx";
import { MissingSaveKey, OLDEST_GATE, TreeTotalMismatch, UNPORTED_STEPS } from "@/lib/game/errors";
import { Companions } from "@/lib/game/njs/Companions";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Sailing } from "@/lib/game/njs/Sailing";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";
import { computeGameArtifactFind, gameArtifactFind } from "@/lib/game/trackers/artifactFind";
import { TRACKERS } from "@/lib/game/trackers";
import type { StatResult } from "@/lib/statTracker/config";
import { callDiff, njsCalls, njsFunction, njsNamedBlocks, traceCalls } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";
import { ARTIFACT_FIND_REFUSABLE } from "@/lib/diagnose/characterize";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, UNPORTED_REFUSALS, arkhArtifactLeaf, arkhArtifactTree, gameCtx } from "../support/arkhOracle";

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const relErr = (got: number, want: number) => Math.abs(got - want) / Math.max(1, Math.abs(want));
const IDS = ARTI_GROUPS.flatMap((g) => g.sources);
const noSaves = GOLDEN_SAVES.length === 0;
const noNjs = !existsSync("scripts/updater/.cache/N.new.js");
const ARKHE_11_01 = "scripts/updater/golden/.cache/arkhe-live-2026-11-01.json";
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];

// One GameState per save, shared by all its characters: the adapter makes a Ctx (cache, trace) of its own for each one.
const states = new Map<string, { state: GameState; chars: number }>();
afterAll(() => states.clear()); // the built states of the real saves are big: not kept past this file (a full run keeps its workers alive)
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const env = JSON.parse(readFileSync(path, "utf8"));
    states.set(path, (s = { state: buildGameState(env as GameEnvelope), chars: env.charNames.length }));
  }
  return s;
}

/** The node of source `id` in a tree the adapter built: its group by ARTI_GROUPS, then its place in the group. */
const sourceNode = (tree: StatResult["tree"], id: string) => {
  const gi = ARTI_GROUPS.findIndex((g) => g.sources.includes(id));
  return tree.children![gi].children![ARTI_GROUPS[gi].sources.indexOf(id)];
};

const count = (n: StatResult["tree"]): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);

/** What the loops keep of one (save, character): the numbers, not the trace (1163 trees with their traces would be a lot of memory). */
type Light = { total: number; root: number; groups: number[]; vals: Record<string, number>; nodes: number };
const lights = new Map<string, Light | { refused: string }>();
afterAll(() => lights.clear()); // the built states of the real saves are big: not kept past this file (a full run keeps its workers alive)
/** The adapter's result for a pair, or the key the save lacks (Ruling E: a MissingSaveKey is a refusal, anything else is a bug). */
function run(path: string, ci: number): Light | { refused: string } {
  const key = `${path}#${ci}`;
  let l = lights.get(key);
  if (!l) {
    try {
      const { tree, total } = gameArtifactFind(stateOf(path).state, ci);
      l = { total, root: tree.val, groups: tree.children!.map((g) => g.val), vals: Object.fromEntries(IDS.map((id) => [id, sourceNode(tree, id).val])), nodes: count(tree) };
    } catch (e) {
      if (!(e instanceof MissingSaveKey)) throw e; // IncompleteTome is one too
      l = { refused: e.key };
    }
    lights.set(key, l);
  }
  return l;
}

// ── BoatArtiMulti itself ────────────────────────────────────────────────────────────────────────
describe.skipIf(noSaves)("Sailing BoatArtiMulti (N.js @10700072) and the tracker registry", () => {
  const ctx = (trace = false) => gameCtx(JSON.parse(readFileSync(BASE, "utf8")), 0, trace);

  it("TRACKERS.artifactFind is Sailing(ctx, 'BoatArtiMulti', 0, 0)", () => {
    expect(TRACKERS.artifactFind).toBeTypeOf("function");
    expect(TRACKERS.artifactFind!(ctx())).toBe(Sailing(ctx(), "BoatArtiMulti", 0, 0));
  });

  // The port is the game's text with the calls spelled the way lib/game spells them: same factors, same order, same parentheses, so the
  // floats are the game's. Whitespace aside, the only differences are the call syntax and the six raw reads below.
  it.skipIf(noNjs)("is N.js's expression token for token (calls and reads spelled as lib/game spells them)", () => {
    const fn = njsFunction(loadNjs(), "Sailing")!;
    const njs = njsNamedBlocks(fn.body, "BoatArtiMulti")[0]
      .replace(/^return /, "")
      .replace(/;$/, "")
      .replace(/[mpq]\._customBlock_(\w+)\(/g, "$1(ctx,")
      .replace('c.asNumber(a.engine.getGameAttribute("Boats")[b|0][0])', "boatCaptain(ctx,b)")
      .replace('c.asNumber(a.engine.getGameAttribute("NONdummies")[60])', "NONdummies60(ctx)")
      .replace('c.asNumber(a.engine.getGameAttribute("DNSM").h.StarSigns.h["61"])', 'DNSM_StarSigns(ctx,"61")')
      .replace('c.asNumber(a.engine.getGameAttribute("DNSM").h.AlchVials.h["6turtle"])', 'DNSM_AlchVials(ctx,"6turtle")')
      .replace('a.engine.getGameAttribute("Spelunk")[6].length', 'listAt(ctx,"Spelunk",6).length');
    const src = readFileSync("lib/game/njs/Sailing.ts", "utf8").replace(/\r/g, "");
    const body = src.slice(src.indexOf("function boatArtiMulti"));
    const port = body.slice(body.indexOf("return ") + "return ".length, body.indexOf(");\n}") + 1).replace(/\s+/g, "");
    expect(port).toBe(njs.replace(/\s+/g, ""));
  });

  it.skipIf(noNjs)("calls what N.js calls", () => {
    const fn = njsFunction(loadNjs(), "Sailing")!;
    const expected = njsCalls(njsNamedBlocks(fn.body, "BoatArtiMulti").join("\n"));
    const c = ctx(true);
    Sailing(c, "BoatArtiMulti", 0, 0);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);

  it("the boat is the argument: boat 1 reads Boats[1][0] for the captain and Davey Jones of boat 1", () => {
    const c = ctx(true);
    Sailing(c, "BoatArtiMulti", 1, 0);
    const boat = c.trace!.children[0];
    expect(boat).toMatchObject({ block: "Sailing", args: ["BoatArtiMulti", 1, 0] });
    const capt = boat.children.find((n) => n.block === "CaptBonusCalc")!;
    expect(capt.args).toEqual([3, asNum(c, "Boats", 1, 0)]);
    expect(boat.children.some((n) => n.block === "Sailing" && n.args[0] === "DaveyJonesBonus" && n.args[1] === 1)).toBe(true);
  });

  // The game reads `Boats[b|0][0]` as the argument of CaptBonusCalc, right after ArtifactBonus, and a missing row is a TypeError there. A
  // lenient read (asNumber(null) = 0) would go on and fail later on some other Boats read, so the proof is where the call stops.
  it("the game indexes Boats[b] directly: a missing row stops BoatArtiMulti at the captain's argument, it is not read as captain 0", () => {
    const boats: unknown[] = (() => {
      const raw = JSON.parse(readFileSync(BASE, "utf8")).data.Boats;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    })();
    const stopsAfter = (rows: unknown[], b: number) => {
      const env = JSON.parse(readFileSync(BASE, "utf8"));
      env.data.Boats = rows;
      const c = gameCtx(env, 0, true);
      let key: unknown = "no error";
      try {
        Sailing(c, "BoatArtiMulti", b, 0);
      } catch (e) {
        key = e instanceof MissingSaveKey ? e.key : e;
      }
      return { key, calls: c.trace!.children[0].children.map((n) => n.block) };
    };
    expect(stopsAfter([], 0)).toEqual({ key: "Boats[0]", calls: ["Sailing"] }); // only ArtifactBonus ran
    expect(stopsAfter([boats[0]], 1)).toEqual({ key: "Boats[1]", calls: ["Sailing"] });
    expect(stopsAfter(boats, 1).key).toBe("no error"); // with the rows there, boat 1 is read
  });
});

// ── the display config moved out of lib/arkh ────────────────────────────────────────────────────
describe("the display config", () => {
  it("lives in lib/artifactFind/groups and lib/arkh's def re-exports the very same objects", () => {
    expect(arkhDef.ARTI_GROUPS).toBe(ARTI_GROUPS);
    expect(arkhDef.ARTI_ROOT).toBe(ARTI_ROOT);
    expect(arkhDef.ARTI_VOTE_NAME).toBe(ARTI_VOTE_NAME);
    expect(ARTI_GROUPS).toHaveLength(24);
    expect(IDS).toHaveLength(35);
  });

  // lib/game must be able to outlive lib/arkh: no file under it imports lib/arkh (by alias or by a relative path), except the two data
  // re-exports that say so themselves ("The files still live under lib/arkh; a later plan moves them here"). What this does not check is
  // the transitive reach: DNSM.TomeQTYtot calls lib/tome's computeTome (Ruling K), and lib/tome imports about 20 lib/arkh modules. That
  // is the one known exception, until the Tome moves to lib/game (the next test names it).
  it("no file under lib/game imports lib/arkh, except the data re-exports", () => {
    const ALLOWED = ["lib/game/data/index.ts", "lib/game/data/maps.ts"];
    const files = readdirSync("lib/game", { recursive: true })
      .map((f) => `lib/game/${String(f).replace(/\\/g, "/")}`)
      .filter((f) => /\.tsx?$/.test(f));
    const imports: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)) {
        const spec = m[1];
        if (/^@\/lib\/arkh(\/|$)/.test(spec) || (spec.startsWith(".") && /(^|\/)arkh(\/|$)/.test(spec))) imports.push(`${f}: ${spec}`);
      }
    }
    expect(files.length).toBeGreaterThan(40); // the scan found the engine
    expect(imports.filter((i) => !ALLOWED.some((a) => i.startsWith(`${a}:`)))).toEqual([]);
    expect(imports.some((i) => i.startsWith("lib/game/data/index.ts:"))).toBe(true); // the exception list is not stale
  });

  // What the test above does not check: the transitive reach. DNSM.TomeQTYtot calls lib/tome's computeTome (Ruling K) and lib/tome imports
  // lib/arkh modules of its own, so a run of lib/game still reaches lib/arkh through it. That is the one known exception, until the Tome
  // moves to lib/game; this pins it (the call exists, the reach is lib/tome's), so a second path cannot appear unseen.
  it("lib/tome is the known transitive exception: lib/game calls it, and it imports lib/arkh", () => {
    expect(readFileSync("lib/game/njs/DNSM.ts", "utf8")).toMatch(/from "@\/lib\/tome\/compute"/);
    const tomeArkh = readdirSync("lib/tome", { recursive: true })
      .filter((f) => /\.tsx?$/.test(String(f)))
      .flatMap((f) => [...readFileSync(`lib/tome/${f}`, "utf8").matchAll(/from\s*["'](@\/lib\/arkh[^"']*|[./]+\/arkh[^"']*)["']/g)].map((m) => m[1]));
    expect(new Set(tomeArkh).size).toBeGreaterThan(10);
  });
});

// ── the totals ──────────────────────────────────────────────────────────────────────────────────
// Ruling E: a save missing a key the current N.js loader maps stays a strict MissingSaveKey, so the adapter refuses it (it throws; Task 10
// decides what the page shows). An older save is computed after the game's own load steps (lib/game/migrations, Task 12): the 31 saves below
// CSver 34.05 lacked Menagerie, Spelunk[49] (and [47..48]), the Royal Guardian lists of the Tome, or (5OhTree, HourZero) Sushi, Research,
// Spelunk, Arcane..., which the load gives them. No real save is refused any more (UNPORTED_REFUSALS is empty).
const CURRENT_CSVER = 34.05;
/** The real saves below the current CSver that compute now, through the load steps (Task 12): all 31 names (33 files). */
// every save from before the load step DoOnceREAL < 399 (the Cape Vine list, Spelunk[54]) runs it: all but the newest
const MIGRATED = ["01010111001.json","0celot8.json","0xEXCEED.json","100Cotton.json","1st_Giri.json","21ucky4u.json","24632463.json","26515665165165.json","5OhTree.json","ARKHE.json","AoDCthulhu.json","Arlong.json","Ash_EB.json","AvacadoSqueeze.json","Azza2Bad.json","B0schi.json","Baker333.json","Bangada.json","BopeBrancis.json","Brokami.json","Bubbafrumps.json","Chalalaa.json","Cheap_Jokes_ok.json","Crezar.json","Dandy2009.json","Dasvidanya.json","Dragami.json","Dragonlzl.json","Drukez.json","Einyen.json","Exrom.json","F1N4L_1.json","Fanmail.json","FenrirAdra.json","Flipper143.json","FlipsyThEVicti.json","Fluffle_Puff.json","Frans813.json","Frostymart.json","FrozenBody.json","GIM_SSS.json","Glaives.json","GoddessFreia.json","Grandesz.json","HourZero.json","Hyucan.json","Jrod11.json","Koweabooo.json","MarleyLongbott.json","Maspoofio.json","MeatyLock.json","Norton_Goldman.json","Pepega777.json","PerkOne.json","Pontinhas.json","PulseIRL.json","Riltin.json","Rinkzate.json","Scotchz.json","Seavik.json","Shadow_x_Vanish.json","Shironee.json","Skvimpan.json","Snowyzxd.json","TheSpease.json","TinTim.json","TomerBuff.json","WarSkepp.json","Yosh6400.json","airbolt.json","arkhe-2026-09-23.json","arkhe-it-profile-2026-09-24.json","arkhe-live-2026-09-23.json","arkhe-live-2026-09-24.json","arkhe-live-2026-10-30.json","arkhe-live-2026-11-01.json","astarm.json","big_guy69123.json","biggums3.json","blickter.json","bluestar3112.json","breakinbrad.json","dida123.json","enilyn.json","haki34.json","hellzd4nt3.json","jobenty.json","joelok.json","kONYYY.json","liiiiiiiiiiiig.json","lunaonline.json","ryujinsan.json","suk69.json","xBlackpearl.json","zadavi.json"];
const csverOf = (file: string): number => JSON.parse(readFileSync(GOLDEN_SAVES.find((p) => basename(p) === file)!, "utf8")).data.CSver;

describe.skipIf(noSaves)("computeGameArtifactFind against lib/arkh on every real save and character", () => {
  it("the total, every source leaf and the group display agree with lib/arkh (and with itself)", () => {
    const t0 = performance.now();
    const mismatches: string[] = [];
    const leafMismatches: string[] = [];
    const display: string[] = [];
    const refused = new Set<string>();
    const migrated = new Set<string>();
    const seenTotals = new Set<number>();
    let pairs = 0;
    let known = 0;
    let refusedPairs = 0;
    let worst = 0;
    for (const path of GOLDEN_SAVES) {
      const file = basename(path);
      for (let ci = 0; ci < stateOf(path).chars; ci++) {
        const r = run(path, ci);
        if ("refused" in r) {
          refused.add(`${file}: ${r.refused}`);
          refusedPairs++;
          continue;
        }
        if (stateOf(path).state.migrations.length) migrated.add(file);
        // display and value agree: the groups recombine, the way lib/arkh combines them (its own groupVal / applyGroupStep), to the call's total
        let rebuilt = 1;
        ARTI_GROUPS.forEach((g, gi) => {
          const vals = g.sources.map((id) => r.vals[id]);
          if (!rel(r.groups[gi], groupVal(g, vals))) display.push(`${file}#${ci}: group ${g.key} shows ${r.groups[gi]}, its sources give ${groupVal(g, vals)}`);
          rebuilt = applyGroupStep(g, vals, rebuilt);
        });
        if (!rel(rebuilt, r.total)) display.push(`${file}#${ci}: groups give ${rebuilt}, the call ${r.total}`);
        if (r.root !== r.total) display.push(`${file}#${ci}: root ${r.root} is not the total ${r.total}`);
        // the leaf of each source is lib/arkh's leaf (the page's Biggest Gains and Observed Max work on those), except the known rows
        for (const id of IDS) {
          if (KNOWN_ARKH_DIFFS.some((d) => d.save === file && (d.ci ?? ci) === ci && d.source === id)) continue;
          const want = arkhArtifactLeaf(path, ci, id);
          if (!rel(r.vals[id], want)) leafMismatches.push(`${file}#${ci} ${id}: game ${r.vals[id]}, arkh ${want}`);
        }
        if (KNOWN_ARKH_DIFFS.some((d) => d.save === file && (d.ci ?? ci) === ci)) {
          known++;
          continue; // the total differs from lib/arkh's where N.js proves lib/arkh wrong
        }
        const want = arkhArtifactTree(path, ci).val;
        pairs++;
        seenTotals.add(r.total);
        worst = Math.max(worst, relErr(r.total, want));
        if (!rel(r.total, want)) mismatches.push(`${file}#${ci}: game ${r.total}, arkh ${want}`);
      }
    }
    const refusals = [...refused].sort();
    console.info(
      `[artifactFind] ${pairs} totals compared (worst relative difference ${worst.toExponential(2)}), ${known} known-diff pairs, ${refusedPairs} refused pairs in ${refused.size} saves, ${seenTotals.size} distinct totals, ${Math.round(performance.now() - t0)} ms`
    );
    expect(mismatches).toEqual([]);
    expect(leafMismatches).toEqual([]);
    expect(display).toEqual([]);
    expect(pairs).toBeGreaterThan(500); // a loop over nothing would pass
    expect(seenTotals.size).toBeGreaterThan(100); // nor would one number everywhere
    expect(known).toBeGreaterThan(0);
    expect(refusals).toEqual(UNPORTED_REFUSALS);
    for (const f of refusals) expect(csverOf(f.split(": ")[0]), `${f} is pre-migration`).toBeLessThan(CURRENT_CSVER);
    // the older saves the load steps make computable, and characterize accepts only the refusals left
    expect([...migrated].sort()).toEqual(MIGRATED);
    for (const f of refusals) expect(ARTIFACT_FIND_REFUSABLE(f.slice(f.indexOf(": ") + 2)), f).toBe(true);
  }, 600_000);

  it("an older save is computed after the game's load steps, and the root of its tree says which ran", () => {
    const path = GOLDEN_SAVES.find((p) => basename(p) === "arkhe-live-2026-09-23.json"); // CSver 33.05, DoOnceREAL 389.1
    expect(path).toBeDefined();
    const steps = [
      "Menagerie = [] (loader: CSver < 34 @19944986, init @6586152)", "Menagerie filled (initialize4 @6336662)", "OnPlayStart4 DoOnceREAL < 395 @6465133",
      "OnPlayStart4 DoOnceREAL < 399 @6468343",
    ];
    expect(stateOf(path!).state.migrations).toEqual(steps);
    const { tree } = gameArtifactFind(stateOf(path!).state, 0);
    expect(tree.note).toBe("migrated from an older game version (4 load steps)"); // a count in words, not the step ids (they are state.migrations)
    // a save from just before the Cape Vine runs its one step
    expect(gameArtifactFind(stateOf(ARKHE_11_01).state, 0).tree.note).toBe("migrated from an older game version (1 load step)");
    const current = GOLDEN_SAVES.find((p) => basename(p) === "arkhe-live-2026-11-01-postupdate.json"); // DoOnceREAL 399.1
    if (current) expect(gameArtifactFind(stateOf(current).state, 0).tree.note).toBeUndefined(); // a current save: nothing ran
  });

  it("a refused save throws instead of answering a number", () => {
    // no real save is refused now: one older than the load steps ported (DoOnceREAL < OLDEST_GATE) stands in
    const env = JSON.parse(readFileSync(BASE, "utf8"));
    env.data.DoOnceREAL = OLDEST_GATE - 1;
    expect(() => computeGameArtifactFind(env, 0)).toThrow(MissingSaveKey);
    expect(() => computeGameArtifactFind(env, 0)).toThrow(UNPORTED_STEPS);
  });
});

// ── the tree stays small (Ruling L) ─────────────────────────────────────────────────────────────
// The page persists flattenTree(tree) in every snapshot (localStorage, writes dropped silently on quota), so the tree may not outgrow
// lib/arkh's by more than 2x. Each source keeps the N.js call(s) it stands for; below them only the branches that lead to a `runtime:` /
// `assumed:` note stay (spec section 5 wants those visible). The whole trace is a traced Ctx away.
const FLAG = /^(runtime|assumed):/;
const countTrace = (n: TraceNode): number => 1 + n.children.reduce((a, c) => a + countTrace(c), 0);
const flagsOfTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(flagsOfTrace)];
const flagsOfTree = (n: StatResult["tree"]): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(flagsOfTree)];

describe.skipIf(noSaves)("the page's tree stays small", () => {
  it("has at most 2x the nodes of lib/arkh's tree on every real save and character", () => {
    const over: string[] = [];
    let worst = { ratio: 0, at: "", game: 0, arkh: 0 };
    let pairs = 0;
    for (const path of GOLDEN_SAVES) {
      for (let ci = 0; ci < stateOf(path).chars; ci++) {
        const r = run(path, ci);
        if ("refused" in r) continue;
        const arkh = count(arkhArtifactTree(path, ci));
        pairs++;
        const ratio = r.nodes / arkh;
        if (ratio > worst.ratio) worst = { ratio, at: `${basename(path)}#${ci}`, game: r.nodes, arkh };
        if (r.nodes > 2 * arkh) over.push(`${basename(path)}#${ci}: ${r.nodes} nodes against ${arkh}`);
      }
    }
    console.info(`[artifactFind] tree size: ${pairs} pairs, worst ratio ${worst.ratio.toFixed(2)} at ${worst.at} (${worst.game} nodes against ${worst.arkh})`);
    expect(over).toEqual([]);
    expect(pairs).toBeGreaterThan(500);
  }, 120_000);

  it("keeps every runtime: / assumed: note of the full trace (the trimmed branches hold none)", () => {
    const lost: string[] = [];
    let flags = 0;
    let pairs = 0;
    for (const path of GOLDEN_SAVES) {
      const { state, chars } = stateOf(path);
      for (let ci = 0; ci < chars; ci++) {
        if ("refused" in run(path, ci)) continue;
        const full = makeCtx(state, { player: ci, map: 0, trace: true }); // the whole trace, as a debugging caller gets it
        Sailing(full, "BoatArtiMulti", 0, 0);
        const want = flagsOfTrace(full.trace!).sort();
        const got = flagsOfTree(gameArtifactFind(state, ci).tree).sort();
        flags += want.length;
        pairs++;
        if (JSON.stringify(got) !== JSON.stringify(want)) lost.push(`${basename(path)}#${ci}: full trace ${want.length} notes, page tree ${got.length}`);
      }
    }
    console.info(`[artifactFind] flagged notes: ${flags} in ${pairs} full traces`);
    expect(lost).toEqual([]);
    expect(flags).toBeGreaterThan(0); // the lab-connection assumption is in every trace: not a comparison of two empty lists
  }, 120_000);

  // The page prints every note of the tree it gets: plain English, no offsets, rulings or file paths (those are the trace's `detail`).
  it("shows plain English notes only: no ruling, offset, file path or internal name, on a current save and on the most migrated one", () => {
    const INTERNAL = /Ruling|lib\/|@\d{4,}|game\.mbs|ActorEvents|computeTome|N\.js|DNSM|GenINFO\[|OptionsListAccount|OptLacc/;
    const saves = [BASE, GOLDEN_SAVES.find((p) => basename(p) === "HourZero.json")!, GOLDEN_SAVES.find((p) => basename(p) === "0celot8.json")!];
    const seen: string[] = [];
    const walk = (n: StatResult["tree"]) => {
      if (n.note && /^(assumed|runtime|migrated)/.test(n.note)) seen.push(n.note);
      for (const c of n.children ?? []) walk(c);
    };
    for (const path of saves) {
      walk(gameArtifactFind(stateOf(path).state, 0).tree);
    }
    expect(seen.length).toBeGreaterThan(3); // lab, Tome, migrated, the Sushi/MapBon/Drop Rate assumptions: not a pass over nothing
    expect(seen.filter((n) => INTERNAL.test(n) || n.length > 120)).toEqual([]);
    expect(seen).toContain("assumed: lab node counted as connected (the game checks it live)");
    expect(seen).toContain("assumed: Tome score from our own Tome calculation");
    // the full trace keeps the detail the page leaves out
    const full = makeCtx(stateOf(saves[0]).state, { player: 0, map: 0, trace: true });
    Sailing(full, "BoatArtiMulti", 0, 0);
    const details: string[] = [];
    const dig = (n: TraceNode) => (n.detail && details.push(n.detail), n.children.forEach(dig));
    dig(full.trace!);
    expect(details.some((d) => /ActorEvents_548 @10069277/.test(d))).toBe(true);
  });

  it("keeps the evidence of a source whose call was a memo hit, and drops the unflagged subtree below a call", () => {
    const state = stateOf(BASE).state;
    const real = TRACKERS.artifactFind!;
    try {
      // no real save has a direct call of BoatArtiMulti answered from the memo, so make one: the first Companions(154) comes before it
      TRACKERS.artifactFind = (ctx) => {
        Companions(ctx, 154);
        return real(ctx);
      };
      const glimbo = sourceNode(gameArtifactFind(state, 0).tree, "comp154");
      expect(glimbo.children!.map((c) => c.name)).toEqual(["Companions(154)", "CompLV2(154)"]);
      expect(glimbo.children![0].note).toBe("cached");
    } finally {
      TRACKERS.artifactFind = real;
    }
    // below a call: only what leads to a flagged note, and the same flagged notes the full trace has under it
    const full = makeCtx(state, { player: 0, map: 0, trace: true });
    Sailing(full, "BoatArtiMulti", 0, 0);
    const fullShiny = full.trace!.children[0].children.find((n) => n.block === "Breeding")!;
    expect(countTrace(fullShiny)).toBeGreaterThan(20); // the full trace has the whole Breeding subtree
    const shiny = sourceNode(gameArtifactFind(state, 0).tree, "shiny21");
    expect(shiny.children).toHaveLength(1);
    expect(flagsOfTree(shiny.children![0]).sort()).toEqual(flagsOfTrace(fullShiny).sort());
    expect(count(shiny)).toBeLessThan(6);
  });
});

// ── the tree ────────────────────────────────────────────────────────────────────────────────────
describe.skipIf(!existsSync(ARKHE_11_01))("the tree the adapter builds, on the 2026-11-01 save", () => {
  const env = () => JSON.parse(readFileSync(ARKHE_11_01, "utf8"));
  const markhe = () => env().charNames.indexOf("Markhe");
  const result = () => computeGameArtifactFind(env(), markhe());

  it("has lib/arkh's shape: root, one node per ARTI_GROUPS group in order, one per source in order", () => {
    const { tree, total } = result();
    expect(markhe()).toBe(8);
    expect(tree).toMatchObject({ name: ARTI_ROOT, fmt: "x", val: total });
    expect(tree.children!.map((g) => g.name)).toEqual(ARTI_GROUPS.map((g) => g.name));
    ARTI_GROUPS.forEach((g, gi) => expect(tree.children![gi].children!.map((_, si) => g.sources[si])).toEqual(g.sources));
  });

  it("names, formats and notes of every group and source equal lib/arkh's (the Observed Max data is keyed by them)", () => {
    const { tree } = result();
    const arkh = arkhArtifactTree(ARKHE_11_01, markhe());
    const shape = (n: StatResult["tree"]) => ({ name: n.name, fmt: n.fmt, note: n.note });
    // the root of lib/game's tree also says which load steps ran (this save is from before the step 399): lib/arkh has no such note
    expect({ ...shape(tree), note: tree.note === "migrated from an older game version (1 load step)" ? undefined : tree.note }).toEqual(shape(arkh));
    ARTI_GROUPS.forEach((g, gi) => {
      expect(shape(tree.children![gi]), g.key).toEqual(shape(arkh.children![gi]));
      expect(tree.children![gi].children!.length, g.key).toBe(arkh.children![gi].children!.length);
      g.sources.forEach((id, si) => expect(shape(tree.children![gi].children![si]), id).toEqual(shape(arkh.children![gi].children![si])));
    });
    expect(sourceNode(tree, "vote20").name).toBe(ARTI_VOTE_NAME);
  });

  it("every source carries the N.js trace of its term as children, named by block and arguments", () => {
    const { tree } = result();
    const art = sourceNode(tree, "artifact3");
    expect(art.children![0]).toMatchObject({ name: 'Sailing("ArtifactBonus", 3, 0)', fmt: "raw", val: art.val });
    for (const id of IDS) expect(sourceNode(tree, id).children?.length, id).toBeGreaterThan(0);
    // a trace node is a plain node: a name, a number, an optional note
    const walk = (n: StatResult["tree"]) => {
      expect(typeof n.name).toBe("string");
      expect(Number.isFinite(n.val)).toBe(true);
      n.children?.forEach(walk);
    };
    walk(tree);
  });

  it("a source made of two calls (Glimbo) carries both traces and combines them as BoatArtiMulti does", () => {
    const glimbo = sourceNode(result().tree, "comp154");
    expect(glimbo.children!.map((c) => c.name)).toEqual(["Companions(154)", "CompLV2(154)"]);
    expect(glimbo.val).toBe(Math.min(2, 1 + 2 * glimbo.children![0].val) + glimbo.children![1].val);
  });

  it("shows the discovery count of Super Bit 26 as a leaf (Spelunk[6].length is a plain read, no call to trace)", () => {
    const bit = sourceNode(result().tree, "spelunkBit26");
    const arkhBit = sourceNode(arkhArtifactTree(ARKHE_11_01, markhe()), "spelunkBit26");
    const found = bit.children!.find((c) => c.name === "Spelunk[6].length")!;
    expect(found.val).toBe(arkhBit.children!.find((c) => c.name === "Discoveries found")!.val);
    expect(found.val).toBeGreaterThan(0);
    const superBit = bit.children!.find((c) => c.name === 'GamingStatType("SuperBitType", 26, 0)')!;
    expect(bit.val).toBeCloseTo(Math.pow(1.02, found.val) * superBit.val, 12);
  });

  it("the total comes from the one BoatArtiMulti call", () => {
    const state = buildGameState(env() as GameEnvelope);
    const direct = Sailing(makeCtx(state, { player: markhe(), map: 0 }), "BoatArtiMulti", 0, 0);
    expect(gameArtifactFind(state, markhe()).total).toBe(direct);
    expect(computeGameArtifactFind(env(), markhe()).total).toBe(direct);
  });

  // Six sources redo a little of BoatArtiMulti's arithmetic (20 x, 25 x min(30, .), min(2, 1 + 2 x) + ., 1.5 ^, / 5, 1.02 ^ . x), and the
  // page's Biggest Gains rebuilds the total from the tree's numbers. If one copy goes stale the tree must not be shown (spec section 4).
  it("throws TreeTotalMismatch when the groups no longer give the call's total (a constant changed in one place only)", () => {
    const state = buildGameState(env() as GameEnvelope);
    const real = TRACKERS.artifactFind!;
    try {
      TRACKERS.artifactFind = (ctx) => real(ctx) * 1.001; // BoatArtiMulti said something the sources do not add up to
      let caught: unknown;
      try {
        gameArtifactFind(state, markhe());
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(TreeTotalMismatch);
      expect((caught as TreeTotalMismatch).total / (caught as TreeTotalMismatch).rebuilt).toBeCloseTo(1.001, 9);
      TRACKERS.artifactFind = (ctx) => real(ctx) * (1 + 1e-12); // float noise is not a mismatch
      expect(() => gameArtifactFind(state, markhe())).not.toThrow();
    } finally {
      TRACKERS.artifactFind = real;
    }
  });

  it("reads 167Q, the number the game showed for this save (2026-11-01)", () => {
    const { total } = result();
    console.info(`[artifactFind] ${ARKHE_11_01} Markhe: ${total} -> ${formatArtifactFind(total)}`);
    expect(formatArtifactFind(total)).toBe("167Q");
  });
});

// ── switching character ─────────────────────────────────────────────────────────────────────────
// Only artifact3 (x the character's Sailing level) and starSign61 (the character's own star signs) belong to the character; for a character
// whose Lv0[14] < 2 the live Companion(0)-gated terms follow (Companions(0) @10799980 is 0 below it, inside Grid_Bonus_Allmulti). button3 is
// left out: the game keeps DNSM.Button_Bonsuz for the session, built with the gate of whichever character asked first, so it is not a
// per-character value there; lib/game models it as "the cache built for the current character" (Minehead.ts), so it follows the gate here.
const PER_CHARACTER = ["artifact3", "starSign61"];
// win3 carries the God Shard set's bonus when the account has not unlocked the set for good and the character wears all of it (GetSetBonus
// "Bonus" @11098422 counts the parts in the character's EquipmentOrder): then it moves with the character too (HourZero #1 and #9)
const SET_WORN = ["win3"];
const wearsGodShard = (state: GameState, ci: number) => {
  const c = withPlayer(makeCtx(state, { player: 0, map: 0 }), ci);
  return GetSetBonus(c, "GODSHARD_SET", "PartsOn", 0, 0) >= GetSetBonus(c, "GODSHARD_SET", "PartsReq", 0, 0);
};
const COMPANION_0_GATED = ["grid109", "grid106", "sticker2add", "sticker2mult"];
const gateOf = (state: GameState, ci: number) => asNum(withPlayer(makeCtx(state, { player: 0, map: 0 }), ci), "Lv0", 14);

describe.skipIf(noSaves)("switching character on one save", () => {
  it("changes only artifact3 and starSign61, plus the Companion(0)-gated terms for a character with Lv0[14] < 2 (every real save)", () => {
    const unexpected: string[] = [];
    const plain = new Set<string>();
    const gated = new Set<string>();
    const worn = new Set<string>();
    let compared = 0;
    for (const path of GOLDEN_SAVES) {
      const { state, chars } = stateOf(path);
      const base = run(path, 0);
      if ("refused" in base) continue;
      for (let ci = 1; ci < chars; ci++) {
        const r = run(path, ci);
        if ("refused" in r) throw new Error(`${basename(path)}: character 0 is computed and ${ci} is refused: ${r.refused}`);
        const low = gateOf(state, 0) < 2 || gateOf(state, ci) < 2;
        const setDiffers = wearsGodShard(state, 0) !== wearsGodShard(state, ci);
        const changed = IDS.filter((id) => id !== "button3" && r.vals[id] !== base.vals[id]);
        compared++;
        for (const id of changed) {
          if (setDiffers && SET_WORN.includes(id)) worn.add(id);
          else (low ? gated : plain).add(id);
          if (!PER_CHARACTER.includes(id) && !(low && COMPANION_0_GATED.includes(id)) && !(setDiffers && SET_WORN.includes(id))) unexpected.push(`${basename(path)} 0 vs ${ci}: ${id}`);
        }
      }
    }
    console.info(`[artifactFind] character switches: ${compared} comparisons; moved where the gate is not involved: ${[...plain].sort()}; where it is: ${[...gated].sort()}`);
    expect(unexpected).toEqual([]);
    expect(compared).toBeGreaterThan(500);
    expect([...plain].sort()).toEqual([...PER_CHARACTER].sort()); // both really move where the gate is not involved: the check is not vacuous
    expect([...gated].filter((id) => COMPANION_0_GATED.includes(id)).length).toBeGreaterThan(0); // and the gate really bites on a real save (Koweabooo #10)
    expect([...worn]).toEqual(SET_WORN); // and the worn set too (HourZero)
  }, 120_000);

  it("a character with Lv0[14] < 2 moves the Companion(0)-gated terms (the 2026-11-01 save, character 1 edited)", () => {
    const env = JSON.parse(readFileSync(existsSync(ARKHE_11_01) ? ARKHE_11_01 : BASE, "utf8"));
    const lv = typeof env.data.Lv0_1 === "string" ? env.data.Lv0_1.split(",").map(Number) : env.data.Lv0_1;
    lv[14] = 1;
    env.data.Lv0_1 = lv;
    const state = buildGameState(env as GameEnvelope);
    const t0 = gameArtifactFind(state, 0).tree;
    const t1 = gameArtifactFind(state, 1).tree;
    const changed = IDS.filter((id) => id !== "button3" && sourceNode(t0, id).val !== sourceNode(t1, id).val);
    expect(changed.filter((id) => ![...PER_CHARACTER, ...COMPANION_0_GATED].includes(id))).toEqual([]);
    expect(changed.filter((id) => COMPANION_0_GATED.includes(id)).length).toBeGreaterThan(0); // the gate really bites
  });
});
