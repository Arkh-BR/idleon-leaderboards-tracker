// Task 12: the game's load steps replayed on an older save (lib/game/migrations).
//
// - synthetic saves: each step's gate and what it writes, the order, the strictness (absent keys, no CSver / DoOnceREAL, the refusal of a
//   save older than the steps ported), the assumptions and their trace leaves, and that the caller's envelope is untouched and the
//   result frozen;
// - the live N.js: the loader gates and ClearLocalData's resets, every fill read back statement by statement, the pads and every ported
//   block pinned whole by its gate (never its offset), the load chain, and the set of blocks a save from OLDEST_GATE on can run (a new one
//   from a game update fails here until it is examined);
// - the real saves: which steps run on which, the assumptions they show, and the loader gates an older one is below.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { attr } from "@/lib/game/attr";
import { block, makeCtx, type TraceNode } from "@/lib/game/ctx";
import { MapAFKtarget } from "@/lib/game/data";
import { InvalidSaveValue, MissingSaveKey, OLDEST_GATE, UNPORTED_STEPS } from "@/lib/game/errors";
import { DROP_RATE_RECORD, MIGRATIONS, migrate } from "@/lib/game/migrations";
import { DNSM_TomeQTYtot } from "@/lib/game/njs/DNSM";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { gameArtifactFind } from "@/lib/game/trackers/artifactFind";
import type { StatResult } from "@/lib/statTracker/config";
import { GOLDEN_SAVES } from "./support/arkhOracle";
import { compact, njsBlock, runFill } from "./support/njsBlocks";
import { PORTED_BLOCKS } from "./support/portedBlocks";

const env = (data: Record<string, unknown>): GameEnvelope => ({
  data,
  charNames: ["A"],
  companion: null,
  guildData: { id: null, stats: null, members: [], points: null },
  serverVars: null,
  tournament: { user: null, match: null, global: null, leaderboard: [] },
  accountCreateTime: 1,
  lastUpdated: 1,
});
const zeros = (n: number) => Array<number>(n).fill(0);
const lists = (...lengths: number[]) => lengths.map(zeros);
const MENAGERIE = lists(20, 50, 50, 50, 14, 9, 17, 17);
/** A save at DoOnceREAL 389.1 (the newest of the real older saves), with what the 395 block reads. */
const at389 = (extra: Record<string, unknown> = {}) => ({
  CSver: 34.05,
  DoOnceREAL: 389.1,
  Ninja: Array.from({ length: 104 }, () => []),
  OptLacc: zeros(701),
  Spelunk: Array.from({ length: 49 }, () => [1]),
  Menagerie: lists(20, 50),
  ...extra,
});
const ids = (name: string) => MIGRATIONS.map((s) => s.id).filter((id) => id.includes(name));
const step = (id: string) => {
  const s = MIGRATIONS.find((m) => m.id.startsWith(id));
  if (!s) throw new Error(`no step ${id}`);
  return s;
};
/** Runs one step on `d` as migrate would (no corrupt keys, `players` characters). */
const runStep = (id: string, d: Record<string, unknown>, players = 0) => step(id).run({ d, corrupt: {}, players } as never);
/** The `(assumed)` leaves under a trace node, as [key, note]. */
const assumedLeaves = (n: TraceNode): [unknown, string][] => n.children.filter((c) => c.block === "(assumed)").map((c) => [c.args[0], c.note!]);
const notes = (n: StatResult["tree"]): string[] => [...(n.note ? [n.note] : []), ...(n.children ?? []).flatMap(notes)];

describe("the loader: an attribute it reads only from a save version keeps its init below, and initialize3 or 4 fills it", () => {
  it("Menagerie below CSver 34: the eight lists of zeros, the steps named in the state", () => {
    const s = buildGameState(env({ CSver: 33.05 }));
    expect(s.data.Menagerie).toEqual(MENAGERIE);
    expect(s.migrations).toEqual(["Menagerie = [] (loader: CSver < 34 @19944986, init @6586152)", "Menagerie filled (initialize4 @6336662)"]);
    expect(s.assumed).toEqual([]);
  });
  it("RoyalG and RoyalMaps below CSver 33: their starting lists", () => {
    const s = buildGameState(env({ CSver: 32.05 }));
    expect(s.data.RoyalG).toEqual([...lists(8, 80, 99, 20, 160, 160), ...lists(...zeros(16)), ...lists(50, 15)]);
    const maps = s.data.RoyalMaps as number[][];
    expect(maps).toHaveLength(400);
    expect(maps[1]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0, 211111111, 0]);
    expect(maps.filter((m) => m.length === 0)).toHaveLength(399);
    expect(s.migrations.filter((m) => m.startsWith("Royal"))).toEqual([...ids("RoyalG = []"), ...ids("RoyalMaps = []"), ...ids("RoyalG filled"), ...ids("RoyalMaps filled")]);
  });
  it("Sushi below CSver 30 (not reset by ClearLocalData): assumed empty, then initialize3's starting lists, and the state names the assumption", () => {
    const s = buildGameState(env({ CSver: 29.05 }));
    const sushi = s.data.Sushi as number[][];
    expect(sushi.map((l) => l.length)).toEqual([120, 120, 50, 15, 20, 100, 100, 100]);
    expect(sushi[1].slice(48, 72)).toEqual([-1, -1, 0, 0, 0, 0, 0, ...Array(10).fill(-1), 0, 0, 0, 0, 0, -1, -1]);
    expect(s.migrations.filter((m) => m.startsWith("Sushi"))).toEqual(["Sushi = [] assumed (loader: CSver < 30 @19944518; no ClearLocalData reset)", "Sushi filled (initialize3 @6326856)"]);
    expect(s.assumed.map((a) => a.key)).toEqual(["Sushi"]);
    expect(s.assumed[0].note).toBe("Sushi counted as empty on a save this old (the game's own default is not in its code)"); // what a page shows
    expect(s.assumed[0].detail).toMatch(/^Sushi: the loader reads it only from CSver 30 .* game\.mbs \(outside N\.js\), assumed empty/); // the debugging detail
  });
  it("below CSver 24, every gated attribute an older save needs: Compass, Arcane, MapBon (assumed), Spelunk, Bubba, Research, Sushi (assumed)", () => {
    const s = buildGameState(env({ CSver: 23.05, OptLacc: zeros(401), Lv0_0: zeros(25) }));
    expect(s.assumed.map((a) => a.key)).toEqual(["MapBon", "Sushi"]);
    const compass = s.data.Compass as unknown[][];
    expect(compass).toHaveLength(5);
    expect(compass[0].length).toBeGreaterThan(70); // padded to CompassUpg
    expect(s.data.Arcane).toEqual(zeros(100));
    const mapBon = s.data.MapBon as number[][];
    expect(mapBon).toHaveLength(MapAFKtarget.length);
    mapBon.forEach((e, i) => expect(e, `map ${i}`).toEqual(["Nothing", "Z"].includes(MapAFKtarget[i] as string) ? [0] : [0, 0, 0]));
    expect((s.data.Spelunk as unknown[]).length).toBe(55);
    expect((s.data.Spelunk as unknown[][])[9]).toEqual([...zeros(17), 1, 1, 1, ...zeros(17)]);
    expect((s.data.Bubba as unknown[][]).map((l) => l.length)).toEqual([20, 28, 28, 6, 8, 5]);
    const research = s.data.Research as unknown[][];
    expect(research.map((l) => l.length)).toEqual([240, 240, 80, 80, 80, 0, 0, 20, 50, 12, 36, 0, 40, 150, 180, 10, 10, 100, 0]);
    expect(research[7].slice(0, 3)).toEqual([0, 75, 3]);
    // the fills' writes to every character and the account
    expect((s.data.Lv0_0 as number[]).slice(19, 21)).toEqual([0, 1]);
    expect((s.data.OptLacc as number[])[478]).toBe(0);
  });
  it("ignores the save's key below the gate, as the loader never reads it there", () => {
    expect(buildGameState(env({ CSver: 33.05, Menagerie: [[1], [1], [1]] })).data.Menagerie).toEqual(MENAGERIE);
    expect((buildGameState(env({ CSver: 29.05, Sushi: [[1]] })).data.Sushi as unknown[]).length).toBe(8);
  });
  it("compares the CSver as JavaScript does: a string is its number, 33.99 is below 34", () => {
    expect(buildGameState(env({ CSver: "33.05" })).data.Menagerie).toEqual(MENAGERIE);
    expect(buildGameState(env({ CSver: 33.99 })).data.Menagerie).toEqual(MENAGERIE);
  });
  it("at or above the gate the save's key is read: absent, it stays absent (a real gap, refused by the reads)", () => {
    for (const CSver of [34, 34.05]) {
      const s = buildGameState(env({ CSver }));
      expect(s.migrations).toEqual([]);
      expect(() => s.get("Menagerie")).toThrow(MissingSaveKey);
    }
  });
  it("runs no loader step on a save without a CSver (synthetic: every real save has one)", () => {
    expect(buildGameState(env({})).migrations).toEqual([]);
    expect(buildGameState(env({ CSver: null })).migrations).toEqual([]);
  });
  it("fills an empty list at any version, as initialize4 runs on every load, and leaves a non-empty one alone", () => {
    const s = buildGameState(env({ CSver: 34.05, Menagerie: [] }));
    expect(s.data.Menagerie).toEqual(MENAGERIE);
    expect(s.migrations).toEqual(["Menagerie filled (initialize4 @6336662)"]);
    expect(buildGameState(env({ CSver: 34.05, Menagerie: [[1]] })).data.Menagerie).toEqual([[1]]);
    expect(buildGameState(env({ CSver: 34.05, Menagerie: "[]" })).data.Menagerie).toEqual(MENAGERIE); // a JSON string is parsed first
  });
  it("pads MapBon to MapAFKtarget on any save, and completes a monster map's 1-long list; a full one is left alone", () => {
    const short = buildGameState(env({ CSver: 34.05, MapBon: [[5], [7]] }));
    const mapBon = short.data.MapBon as number[][];
    expect(mapBon).toHaveLength(MapAFKtarget.length);
    expect(mapBon[0]).toEqual(MapAFKtarget[0] === "Nothing" ? [5] : [5, 0, 0]);
    expect(mapBon[1]).toEqual([7, 0, 0]); // mushG
    expect(short.migrations).toEqual(["MapBon padded to MapAFKtarget (initialize3 @6297857)"]);
    const full = MapAFKtarget.map((m) => (["Nothing", "Z"].includes(m as string) ? [0] : [1, 2, 3]));
    expect(buildGameState(env({ CSver: 34.05, MapBon: full })).migrations).toEqual([]);
  });
});

describe("the OnPlayStart blocks: each runs when its gate is above DoOnceREAL, raises it, and runs once", () => {
  it("395: the Ninja[103] slots, OptionsListAccount[519], the Spelunk lists 49 (37 zeros) to 53, and the Menagerie flag [0][6]", () => {
    const s = buildGameState(env(at389()));
    const spelunk = s.data.Spelunk as unknown[][];
    expect(spelunk).toHaveLength(54);
    expect(spelunk[48]).toEqual([1]);
    expect(spelunk[49]).toEqual(zeros(37));
    expect(spelunk.slice(50)).toEqual([[], [], [], []]);
    expect((s.data.Ninja as unknown[][])[103]).toEqual(zeros(40));
    expect((s.data.OptLacc as number[])[519]).toBe(-1);
    expect((s.data.Menagerie as number[][])[0][6]).toBe(1);
    expect(s.data.DoOnceREAL).toBe(395.1);
    expect(s.migrations).toEqual(["OnPlayStart4 DoOnceREAL < 395 @6465133"]);
  });
  it("does not run a block whose gate is not above DoOnceREAL", () => {
    for (const DoOnceREAL of [395, 395.1, 399.1]) {
      const s = buildGameState(env(at389({ DoOnceREAL })));
      expect(s.migrations).toEqual([]);
      expect(s.data.Spelunk as unknown[]).toHaveLength(49);
    }
  });
  it("a Spelunk that already has its 50th list keeps it (`50 > Spelunk.length`), the empty ones still come", () => {
    const s = buildGameState(env(at389({ Spelunk: Array.from({ length: 50 }, () => [1]) })));
    expect((s.data.Spelunk as unknown[][]).slice(49)).toEqual([[1], [], [], [], []]);
  });
  it("from DoOnceREAL 367.1 on, the blocks run in the game's order: 371, 378, 380, 382, 395", () => {
    const s = buildGameState(env(at389({ DoOnceREAL: 367.1, OptLacc: [], Spelunk: Array.from({ length: 47 }, () => [1]), RoyalG: Array.from({ length: 23 }, () => []) })));
    expect(s.migrations).toEqual([371, 378, 380, 382, 395].map((g) => MIGRATIONS.find((m) => m.id.includes(`DoOnceREAL < ${g} `))!.id));
    const ola = s.data.OptLacc as unknown[];
    expect(ola).toHaveLength(701); // 371 pads the list, 378 and 395 write into it
    expect([ola[200], ola[606], ola[519], ola[700]]).toEqual([1, "", -1, 0]);
    const spelunk = s.data.Spelunk as unknown[][];
    expect(spelunk[47]).toEqual(zeros(15)); // 380
    expect(spelunk[48]).toEqual([]); // 380
    expect(spelunk[49]).toEqual(zeros(37)); // 395
    expect((s.data.RoyalG as unknown[][])[23]).toEqual(zeros(15)); // 382
    expect(s.data.DoOnceREAL).toBe(395.1);
    expect(s.assumed).toEqual([DROP_RATE_RECORD]); // 378 ran
  });
  it("382 adds the 24th RoyalG list only to a RoyalG of 23", () => {
    const of = (n: number) => buildGameState(env(at389({ DoOnceREAL: 381, RoyalG: Array.from({ length: n }, () => [1]) }))).data.RoyalG as unknown[];
    expect(of(23)).toHaveLength(24);
    expect(of(24)).toHaveLength(24);
  });
  it("331 caps the artifacts at tier 5 and OptionsListAccount[498] at 9 (and writes DoOnceREAL 332.1)", () => {
    const d: Record<string, unknown> = { DoOnceREAL: 330, OptLacc: [], Sailing: [[], [], [], [1, 6, 7, 5, null]] };
    expect(runStep("OnPlayStart4 DoOnceREAL < 331 ", d)).toBe(true);
    expect((d.Sailing as unknown[][])[3]).toEqual([1, 5, 5, 5, null]);
    expect(d.DoOnceREAL).toBe(332.1);
  });
  it("268 clears the permanently unlocked sets of an account that bought few gems, as the game does", () => {
    const run = (sgr: number, ola380: number) => {
      const d: Record<string, unknown> = { DoOnceREAL: 267, ServerGemsReceived: sgr, ServerGems: 0, OptLacc: Object.assign(zeros(400), { 379: "GODSHARD_SET", 380: ola380 }) };
      runStep("OnPlayStart4 DoOnceREAL < 268 ", d);
      return (d.OptLacc as unknown[]).slice(379, 381);
    };
    expect(run(100, 1)).toEqual(["null", 0]);
    expect(run(2000, 1)).toEqual(["GODSHARD_SET", 1]); // 2000 gems received
    expect(run(100, 0)).toEqual(["GODSHARD_SET", 0]);
  });
  it("reads DoOnceREAL -1 as the loader does: the init 0 stays", () => {
    expect(() => buildGameState(env(at389({ DoOnceREAL: -1 })))).toThrow(UNPORTED_STEPS);
  });
  it("runs no block on a save without DoOnceREAL (synthetic), and refuses one that is not a number", () => {
    const { DoOnceREAL: _, ...noDoOnce } = at389();
    expect(buildGameState(env(noDoOnce)).migrations).toEqual([]);
    expect(() => buildGameState(env(at389({ DoOnceREAL: "389.1" })))).toThrow(InvalidSaveValue);
  });
});

describe("strictness: a step never guesses, and a save it cannot replay reads nothing", () => {
  it("a block that needs a key the save lacks refuses the save: buildGameState throws that MissingSaveKey, no state exists", () => {
    const { Spelunk: _, ...noSpelunk } = at389();
    expect(() => buildGameState(env(noSpelunk))).toThrow(MissingSaveKey);
    expect(() => buildGameState(env(noSpelunk))).toThrow("Spelunk");
    expect(() => buildGameState(env(at389({ Ninja: [] })))).toThrow(expect.objectContaining({ key: "Ninja[103]" }));
    expect(() => buildGameState(env(at389({ Menagerie: [] })))).not.toThrow(); // filled first (initialize4), then [0][6] is set
    expect(() => buildGameState(env(at389({ Spelunk: '[["a"' })))).toThrow(InvalidSaveValue); // a corrupt key is not read
    expect(() => buildGameState(env({ CSver: 23.05 }))).toThrow(expect.objectContaining({ key: "Lv0_0" })); // the Spelunk fill writes every character's Lv0[19]
  });
  it(`a save older than the oldest block examined (DoOnceREAL < ${OLDEST_GATE}) is refused, naming that`, () => {
    for (const DoOnceREAL of [0, 100, 247.9]) {
      expect(() => buildGameState(env(at389({ DoOnceREAL })))).toThrow(expect.objectContaining({ name: "MissingSaveKey", key: UNPORTED_STEPS }));
    }
    expect(() => buildGameState(env(at389({ DoOnceREAL: OLDEST_GATE })))).not.toThrow(UNPORTED_STEPS); // 248 itself runs from 251 on
    expect(UNPORTED_STEPS).toBe("the game's load steps for DoOnceREAL < 248");
  });
  it("leaves the caller's envelope as it was and freezes what it built; every state gets lists of its own", () => {
    const e = env(at389({ CSver: 29.05 }));
    const before = structuredClone(e);
    const a = buildGameState(e);
    const b = buildGameState(e);
    expect(e).toEqual(before);
    for (const k of ["Spelunk", "Menagerie", "RoyalG", "RoyalMaps", "OptLacc", "Sushi"]) {
      expect(Object.isFrozen(a.data[k]), k).toBe(true);
      expect(Object.isFrozen((a.data[k] as unknown[])[1]), k).toBe(true);
      expect(a.data[k], k).not.toBe(b.data[k]);
    }
    expect(Object.isFrozen(a.migrations)).toBe(true);
    expect(Object.isFrozen(a.assumed)).toBe(true);
    expect(Object.isFrozen(MIGRATIONS)).toBe(true);
    expect(Object.isFrozen(DROP_RATE_RECORD)).toBe(true);
  });
  it("migrate itself stops at the first step that cannot run and says which steps ran", () => {
    const d: Record<string, unknown> = { CSver: 33.05, DoOnceREAL: 389.1 };
    const r = migrate(d, {}, 0);
    expect(r.steps).toEqual(["Menagerie = [] (loader: CSver < 34 @19944986, init @6586152)", "Menagerie filled (initialize4 @6336662)"]);
    expect(r.refusal).toMatchObject({ key: "Ninja" });
  });
});

describe("an assumption shows in the trace where it is read", () => {
  const read = (data: Record<string, unknown>) => {
    const ctx = makeCtx(buildGameState(env(data)), { player: 0, map: 0, trace: true });
    block("F", (c) => (attr(c, "Sushi", 4, 0), attr(c, "Sushi", 5), 1))(ctx);
    return assumedLeaves(ctx.trace!.children[0]);
  };
  it("a read of Sushi on a state whose Sushi was assumed empty leaves one (assumed) leaf per block; a saved Sushi leaves none", () => {
    const leaves = read({ CSver: 29.05 });
    expect(leaves).toHaveLength(1);
    expect(leaves[0][0]).toBe("Sushi");
    expect(leaves[0][1]).toBe("assumed: Sushi counted as empty on a save this old (the game's own default is not in its code)");
    expect(read({ CSver: 34.05, Sushi: [[], [], [], [], [0], [0]] })).toEqual([]);
    const off = makeCtx(buildGameState(env({ CSver: 29.05 })), { player: 0, map: 0 });
    expect(off.trace).toBeNull(); // nothing to say when not tracing
    expect(attr(off, "Sushi", 4, 0)).toBe(0);
  });
  // the Tome reads the whole save, so its score carries every assumption: block 378's reset of the highest Drop Rate among them
  const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");
  it.skipIf(!ARKHE)("the Tome score of a state where block 378 reset OptionsListAccount[200] has the assumed: leaf; one where it did not has none", () => {
    const tome = (edit: (d: Record<string, unknown>) => void) => {
      const e = JSON.parse(readFileSync(ARKHE!, "utf8"));
      edit(e.data);
      const ctx = makeCtx(buildGameState(e), { player: 0, map: 0, trace: true });
      DNSM_TomeQTYtot(ctx);
      return ctx.trace!.children[0];
    };
    const reset = tome((d) => (d.DoOnceREAL = 377));
    expect(reset.children[0].block).toBe("Tome.totalPoints"); // the score's own leaf first
    expect(reset.children.filter((c) => c.block === "(assumed)").map((c) => [c.args[0], c.value, c.note])).toEqual([
      ["OptLacc[200]", 1, `assumed: ${DROP_RATE_RECORD.note}`],
    ]);
    expect(reset.children.find((c) => c.block === "(assumed)")!.detail).toBe(DROP_RATE_RECORD.detail); // the full reason stays on the trace node
    expect(DROP_RATE_RECORD.detail).toMatch(/TomeQTY raises OptionsListAccount\[200\] to the live TotalStats\(Drop_Rarity\) first \(@5739715\), not ported/);
    expect(assumedLeaves(tome(() => {}))).toEqual([]);
  }, 60_000);
});

// ── the live N.js ───────────────────────────────────────────────────────────────────────────────
const NJS = "scripts/updater/.cache/N.new.js";
describe.skipIf(!existsSync(NJS))("against the live N.js", () => {
  const src = existsSync(NJS) ? readFileSync(NJS, "utf8") : "";
  const flat = src.replace(/\n/g, "");
  /** The text of `_customBlock_<fn>`, to the end of its body (`};v._customBlock_…`). */
  const fnText = (fn: string) => {
    const at = flat.indexOf(`_customBlock_${fn}=function`);
    return flat.slice(at, flat.indexOf("};v._customBlock_", at));
  };
  const clear = flat.slice(flat.indexOf("_customBlock_ClearLocalData=function"), flat.indexOf("_customBlock_afkAttackBonses=function"));
  const gateHead = (g: number) => {
    const ifHead = `if(${g}>a.engine.getGameAttribute("DoOnceREAL"))`;
    return flat.includes(ifHead) ? ifHead : `${g}>a.engine.getGameAttribute("DoOnceREAL")&&(`;
  };

  it("the load runs initialize1 -> 2 -> 3 -> 4 after the loader, and Play runs WhenUPressPlayButton -> OnPlayStart2 -> 3 -> 4", () => {
    expect(flat).toContain('q.gameAttributes.h.Menagerie=p)}v._customBlock_initialize1();'); // the loader's last load, then initialize1
    for (const k of [1, 2, 3]) expect(flat).toContain(`v._customBlock_initialize${k + 1}()};v._customBlock_initialize${k + 1}=function`);
    expect(flat).toContain("v._customBlock_OnPlayStart2()};v._customBlock_OnPlayStart2=function"); // the end of WhenUPressPlayButton
    expect(flat.indexOf("_customBlock_WhenUPressPlayButton=function")).toBeLessThan(flat.indexOf("_customBlock_OnPlayStart2=function"));
    expect(flat).toContain("v._customBlock_OnPlayStart3()};v._customBlock_OnPlayStart3=function");
    expect(flat).toContain("v._customBlock_OnPlayStart4();");
  });

  // [attribute, the CSver the loader reads it from, whether ClearLocalData starts it as []]
  const LOADS: [string, number, boolean][] = [
    ["Compass", 24, true], ["Arcane", 25, true], ["MapBon", 26, false], ["Spelunk", 27, true], ["Bubba", 28, true], ["Research", 29, true],
    ["Sushi", 30, false], ["RoyalG", 33, true], ["RoyalMaps", 33, true], ["Menagerie", 34, true],
  ];
  it("the loader reads each attribute only from its CSver, once; ClearLocalData starts it as [] or does not touch it, as the step says", () => {
    for (const [k, v, reset] of LOADS) {
      expect(flat, k).toMatch(new RegExp(`${v}<=u\\.getLoad\\("CSver"\\)&&\\([^;]*?getLoad\\w*\\("${k}"\\)`));
      expect(flat.split(new RegExp(`getLoad\\w*\\("${k}"\\)`)).length - 1, k).toBe(1);
      expect(new RegExp(`(\\w)=\\[\\];\\w\\.gameAttributes\\.h\\.${k}=\\1`).test(clear), k).toBe(reset);
      expect(MIGRATIONS.some((m) => m.id.startsWith(`${k} = [] ${reset ? "" : "assumed "}(loader: CSver < ${v} @`)), k).toBe(true);
    }
  });

  it("an attribute ClearLocalData does not reset has no writer but the loader and initialize3's fill or pad: an empty list is what a new account starts with", () => {
    const init3 = fnText("initialize3");
    for (const k of ["Sushi", "MapBon"]) {
      expect(flat.split(`gameAttributes.h.${k}=`).length - 1, k).toBe(1); // the loader's
      const pushes = [...flat.matchAll(new RegExp(`getGameAttribute\\("${k}"\\)\\.push\\(`, "g"))];
      expect(pushes.length, k).toBeGreaterThan(0);
      const start = flat.indexOf(init3);
      for (const p of pushes) expect(p.index! > start && p.index! < start + init3.length, `${k}.push at ${p.index}`).toBe(true);
    }
    expect(fnText("initialize3")).toContain('if(0==a.engine.getGameAttribute("Sushi").length){'); // the fill, only of an empty Sushi
    expect(fnText("initialize3")).toContain('if(a.engine.getGameAttribute("MapBon").length<a.engine.getGameAttribute("CustomLists").h.MapAFKtarget.length)');
  });

  // the fills, read back: `prefix` is what a fill writes besides its own lists (pinned as text), `random` its c.randomInt loops
  const FILLS: { fn: string; name: string; prefix?: string; random?: number }[] = [
    { fn: "initialize3", name: "Compass" }, { fn: "initialize3", name: "Arcane" },
    { fn: "initialize3", name: "Spelunk", prefix: 'e=PlayerDATABASE.h;e=Object.keys(e);g=e.length;for(d=0;d<g;)b=e[d++],PlayerDATABASE.h[""+b].h.Lv0[19]=0,PlayerDATABASE.h[""+b].h.Exp0[19]=0,PlayerDATABASE.h[""+b].h.ExpReq0[19]=25;OptionsListAccount[478]=0;' },
    { fn: "initialize3", name: "Bubba" },
    { fn: "initialize3", name: "Research", prefix: 'e=PlayerDATABASE.h;e=Object.keys(e);g=e.length;for(d=0;d<g;)b=e[d++],PlayerDATABASE.h[""+b].h.Lv0[20]=1,PlayerDATABASE.h[""+b].h.Exp0[20]=0,PlayerDATABASE.h[""+b].h.ExpReq0[20]=10;', random: 2 },
    { fn: "initialize3", name: "Sushi" }, { fn: "initialize4", name: "RoyalG" }, { fn: "initialize4", name: "RoyalMaps" }, { fn: "initialize4", name: "Menagerie" },
  ];
  for (const { fn, name, prefix, random } of FILLS) {
    it(`${fn} fills an empty ${name} with what the step gives (read back statement by statement)`, () => {
      const heads = [`if(0==a.engine.getGameAttribute("${name}").length){`, `0==a.engine.getGameAttribute("${name}").length&&(`, `if(0==a.engine.getGameAttribute("${name}").length)`];
      const form = heads.findIndex((h) => flat.includes(h));
      const whole = njsBlock(src, heads[form], `_customBlock_${fn}=function`).slice(heads[form].length);
      // `{ … }`, `&& ( … );` or a single statement
      let body = form === 0 ? whole.slice(0, -1) : form === 1 ? whole.replace(/\);?$/, "") : whole;
      if (prefix) {
        const at = body.indexOf("d=a.engine;b=[];d.gameAttributes.h.DummyList2=b");
        expect(compact(body.slice(0, at))).toBe(prefix);
        body = body.slice(at);
      }
      // a random loop keeps only its first statement, the push of the empty list (the step leaves those lists empty)
      let loops = 0;
      body = body.replace(/for\((a\.engine\.getGameAttribute\("\w+"\)\.push\(a\.engine\.getGameAttribute\("DummyList2"\)\));\d+>[^;]*;\)[^;]*c\.randomInt[^;]*;/g, (_, push) => (loops++, `${push};`));
      expect(loops).toBe(random ?? 0);
      const game = runFill(body, { [name]: [], OptionsListAccount: [] })[name];
      const d: Record<string, unknown> = { [name]: [], OptLacc: [] };
      expect(runStep(`${name} filled (${fn} @`, d)).toBe(true);
      expect(d[name]).toEqual(game);
    });
  }

  it("initialize3's pads of Compass and MapBon are the ones ported", () => {
    const init3 = "_customBlock_initialize3=function";
    expect(compact(njsBlock(src, 'for(;a.engine.getGameAttribute("Compass")[0].length<', init3))).toBe("for(;Compass[0].length<CustomLists.h.CompassUpg.length;)Compass[0].push(0);");
    expect(compact(njsBlock(src, 'for(;a.engine.getGameAttribute("Compass")[1].length<', init3))).toBe("for(;Compass[1].length<CustomLists.h.Titans.length;)Compass[1].push(0);");
    expect(compact(njsBlock(src, 'if(a.engine.getGameAttribute("MapBon").length<', init3))).toBe(
      'if(MapBon.length<CustomLists.h.MapAFKtarget.length)for(d=a.engine,b=MapBon.length,d.gameAttributes.h.DummyNumber2=b,e=0,g=Math.round(CustomLists.h.MapAFKtarget.length-MapBon.length);e<g;)f=e++,DummyList2=[],"Nothing"!=CustomLists.h.MapAFKtarget[Math.round(DummyNumber2+f)]&&"Z"!=CustomLists.h.MapAFKtarget[Math.round(DummyNumber2+f)]&&(DummyList2.push(0)x2),DummyList2.push(0),MapBon.push(DummyList2);'
    );
    expect(compact(njsBlock(src, 'for(g=a.engine.getGameAttribute("MapBon").length;e<g;)', init3))).toBe(
      'for(g=MapBon.length;e<g;)f=e++,DummyNumber2=f,null==MapBon[DummyNumber2|0]?(MapBon[DummyNumber2|0]=[],MapBon[DummyNumber2|0].push(0),MapBon[DummyNumber2|0].push(0),MapBon[DummyNumber2|0].push(0)):1==MapBon[DummyNumber2|0].length&&"Nothing"!=CustomLists.h.MapAFKtarget[DummyNumber2|0]&&"Z"!=CustomLists.h.MapAFKtarget[DummyNumber2|0]&&(MapBon[DummyNumber2|0].push(0),MapBon[DummyNumber2|0].push(0));'
    );
  });

  // each ported block, whole (compact() only shortens the attribute calls and the scratch lists); the pins are in support/portedBlocks.ts
  const once = MIGRATIONS.flatMap((m) => {
    const x = m.id.match(/^(OnPlayStart\d) DoOnceREAL < (\d+) @/);
    return x ? [{ fn: x[1], gate: Number(x[2]) }] : [];
  });
  it("every block ported has a pin, and every pin a step", () => {
    expect(once.map((o) => o.gate).sort((a, b) => a - b)).toEqual(Object.keys(PORTED_BLOCKS).map(Number).sort((a, b) => a - b));
  });
  for (const { fn, gate } of once) {
    it(`${fn}'s DoOnceREAL < ${gate} block is the one ported`, () => {
      expect(compact(njsBlock(src, gateHead(gate), `_customBlock_${fn}=function`))).toBe(PORTED_BLOCKS[gate]);
    });
  }

  it(`the blocks a save can run from DoOnceREAL ${OLDEST_GATE} on are the ported ones and the ones the file accounts for, all in OnPlayStart3 and 4, in order`, () => {
    const gates = [...flat.matchAll(/([\d.]+)>a\.engine\.getGameAttribute\("DoOnceREAL"\)/g)].map((m) => ({ g: Number(m[1]), at: m.index! }));
    const newer = gates.filter((x) => x.g > OLDEST_GATE);
    const start = flat.indexOf("_customBlock_OnPlayStart3=function");
    const end = flat.indexOf("v._customBlock_", flat.indexOf("_customBlock_OnPlayStart4=function") + 40);
    for (const x of newer) expect(x.at > start && x.at < end, `gate ${x.g}`).toBe(true);
    // a new one: examine it (port it or account for it at the end of lib/game/migrations.ts)
    expect(newer.map((x) => x.g)).toEqual([
      251, 254, 262, 263, 264, 265, 266, 267, 268, 271, 272, 273, 279, 280, 281, 282, 289, 291, 294, 295, 297, 299, 301, 302, 306, 310, 313, 314,
      315, 316, 327, 331, 333, 337, 339, 340, 351, 352, 366, 367, 369, 370, 371, 374, 375, 378, 380, 382, 384, 385, 386, 389, 390, 395, 398, 399,
    ]);
    expect(gates.some((x) => x.g === OLDEST_GATE)).toBe(true); // the block the refusal stands for exists
    const at = once.map((o) => newer.find((x) => x.g === o.gate)!.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });
});

// ── the real saves ──────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("the real saves", () => {
  // only the two numbers of each save are kept (106 parsed saves would weigh on the test worker)
  const saves = GOLDEN_SAVES.map((p) => {
    const { CSver, DoOnceREAL } = JSON.parse(readFileSync(p, "utf8")).data;
    return { file: basename(p), data: { CSver, DoOnceREAL }, path: p };
  });
  const state = (file: string) => buildGameState(JSON.parse(readFileSync(saves.find((s) => s.file === file)!.path, "utf8")));

  it("a current save runs no step; each older one runs the steps of its version", () => {
    const seen = new Map<string, string[]>();
    for (const { file, data, path } of saves) {
      let s: ReturnType<typeof buildGameState>;
      try {
        s = buildGameState(JSON.parse(readFileSync(path, "utf8")));
      } catch (e) {
        if (!(e instanceof MissingSaveKey || e instanceof InvalidSaveValue)) throw e;
        const group = `refused: ${e.key}`;
        seen.set(group, [...(seen.get(group) ?? []), file].sort());
        continue;
      }
      if (data.CSver >= 34.05) {
        expect(s.migrations, file).toEqual([]);
        expect(s.assumed, file).toEqual([]);
        continue;
      }
      const group = `CSver ${data.CSver}, DoOnceREAL ${data.DoOnceREAL}: ${s.migrations.length} steps`;
      seen.set(group, [...(seen.get(group) ?? []), file].sort());
    }
    expect(Object.fromEntries(seen)).toEqual({
      "CSver 23.05, DoOnceREAL 248.3: 40 steps": ["HourZero.json"],
      "CSver 29.05, DoOnceREAL 340.1: 16 steps": ["5OhTree.json"],
      "CSver 30.05, DoOnceREAL 367.1: 11 steps": ["0celot8.json"],
      "CSver 32.05, DoOnceREAL 378.1: 9 steps": ["100Cotton.json", "100Cotton.json", "24632463.json", "Brokami.json", "Exrom.json", "GIM_SSS.json", "Pontinhas.json"],
      "CSver 33.05, DoOnceREAL 382.1: 3 steps": ["1st_Giri.json", "1st_Giri.json"],
      "CSver 33.05, DoOnceREAL 385.1: 3 steps": ["01010111001.json", "0xEXCEED.json", "26515665165165.json", "Jrod11.json", "Rinkzate.json", "arkhe-it-profile-2026-09-24.json"],
      "CSver 33.05, DoOnceREAL 389.1: 3 steps": [
        "B0schi.json", "Dragonlzl.json", "FenrirAdra.json", "Frans813.json", "Grandesz.json", "MarleyLongbott.json", "Pepega777.json", "TinTim.json",
        "arkhe-2026-09-23.json", "arkhe-live-2026-09-23.json", "arkhe-live-2026-09-24.json", "breakinbrad.json", "dida123.json", "joelok.json", "ryujinsan.json",
      ],
    });
  });

  it("the assumptions show on the page's tree: Sushi (and the reset Drop Rate record) on 5OhTree, the reset record on 0celot8, none on a current save", () => {
    const sushi = /^assumed: Sushi counted as empty on a save this old/;
    const record = `assumed: ${DROP_RATE_RECORD.note}`;
    expect(state("5OhTree.json").assumed.map((a) => a.key)).toEqual(["Sushi", "OptLacc[200]"]);
    const t5 = notes(gameArtifactFind(state("5OhTree.json"), 0).tree);
    expect(t5.some((n) => sushi.test(n))).toBe(true);
    expect(t5).toContain(record);
    expect(notes(gameArtifactFind(state("0celot8.json"), 0).tree)).toContain(record);
    expect(state("HourZero.json").assumed.map((a) => a.key)).toEqual(["MapBon", "Sushi", "OptLacc[200]"]);
    expect(notes(gameArtifactFind(state("ARKHE.json"), 0).tree).filter((n) => sushi.test(n) || n === record)).toEqual([]);
  }, 60_000);

  it.skipIf(!existsSync(NJS))("the loader gates the older saves are below give only what the steps port, and Tess, GreenStacks, CookMaster (never read)", () => {
    const flat = readFileSync(NJS, "utf8").replace(/\n/g, "");
    const loads = [...flat.matchAll(/([\d.]+)<=u\.getLoad\("CSver"\)&&\(([^;]*?)\)(?=;|\}|[\d.]+<=u)/g)].flatMap((m) =>
      [...m[2].matchAll(/getLoad\w*\("(\w+)"/g)].map((k) => ({ v: Number(m[1]), key: k[1] }))
    );
    expect(loads.length).toBeGreaterThan(20);
    const below = new Set<string>();
    for (const { data } of saves) if (data.CSver < 34.05 && data.DoOnceREAL >= OLDEST_GATE) for (const l of loads) if (l.v > data.CSver) below.add(l.key);
    const ported = [...below].filter((k) => MIGRATIONS.some((m) => m.id.startsWith(`${k} = [] `)));
    expect([...below].filter((k) => !ported.includes(k)).sort()).toEqual(["CookMaster", "GreenStacks", "Tess"]);
    expect(ported.sort()).toEqual(["Arcane", "Bubba", "Compass", "MapBon", "Menagerie", "Research", "RoyalG", "RoyalMaps", "Spelunk", "Sushi"]);
  });
});
