// Task 12: the game's load steps replayed on an older save (lib/game/migrations).
//
// - synthetic saves: each step's gate and what it writes, the order, the strictness (absent keys, no CSver / DoOnceREAL, the refusal of a
//   save older than the steps ported), and that the caller's envelope is untouched and the result frozen;
// - the live N.js: each ported block pinned whole by its gate (never its offset), the fills read back statement by statement, the load
//   chain, and the set of blocks a save from OLDEST_GATE on can run (a new one from a game update fails here until it is examined);
// - the real saves: which steps run on which, and the loader gates an older one is below.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { InvalidSaveValue, MissingSaveKey } from "@/lib/game/errors";
import { MIGRATIONS, OLDEST_GATE, UNPORTED_STEPS, migrate } from "@/lib/game/migrations";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { GOLDEN_SAVES } from "./support/arkhOracle";
import { compact, njsBlock, runFill } from "./support/njsBlocks";

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

describe("the loader: an attribute it reads only from a save version keeps its init [] below, and initialize4 fills it", () => {
  it("Menagerie below CSver 34: the eight lists of zeros, the steps named in the state", () => {
    const s = buildGameState(env({ CSver: 33.05 }));
    expect(s.data.Menagerie).toEqual(MENAGERIE);
    expect(s.migrations).toEqual(["Menagerie = [] (loader: CSver < 34 @19944986, init @6586152)", "Menagerie filled (initialize4 @6336662)"]);
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
  it("ignores the save's key below the gate, as the loader never reads it there", () => {
    expect(buildGameState(env({ CSver: 33.05, Menagerie: [[1], [1], [1]] })).data.Menagerie).toEqual(MENAGERIE);
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
  it("runs no loader step on a save without a CSver (what the host's getLoad gives is not in N.js)", () => {
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
  });
  it("382 adds the 24th RoyalG list only to a RoyalG of 23", () => {
    const of = (n: number) => buildGameState(env(at389({ DoOnceREAL: 381, RoyalG: Array.from({ length: n }, () => [1]) }))).data.RoyalG as unknown[];
    expect(of(23)).toHaveLength(24);
    expect(of(24)).toHaveLength(24);
  });
  it("reads DoOnceREAL -1 as the loader does: the init 0 stays", () => {
    expect(buildGameState(env(at389({ DoOnceREAL: -1 }))).refusal?.key).toBe(UNPORTED_STEPS);
  });
  it("runs no block on a save without DoOnceREAL, and refuses one that is not a number", () => {
    const { DoOnceREAL: _, ...noDoOnce } = at389();
    expect(buildGameState(env(noDoOnce)).migrations).toEqual([]);
    expect(buildGameState(env(at389({ DoOnceREAL: "389.1" }))).refusal).toBeInstanceOf(InvalidSaveValue);
  });
});

describe("strictness: a step never guesses, and a save it cannot replay reads nothing", () => {
  it("a block that needs a key the save lacks refuses the save: every read throws that MissingSaveKey", () => {
    const { Spelunk: _, ...noSpelunk } = at389();
    const s = buildGameState(env(noSpelunk));
    expect(s.refusal).toMatchObject({ name: "MissingSaveKey", key: "Spelunk" });
    expect(() => s.data).toThrow(MissingSaveKey);
    expect(() => s.get("CSver")).toThrow("Spelunk");
    expect(buildGameState(env(at389({ Ninja: [] }))).refusal?.key).toBe("Ninja[103]");
    expect(buildGameState(env(at389({ Menagerie: [] }))).refusal).toBeUndefined(); // filled first (initialize4), then [0][6] is set
    expect(buildGameState(env(at389({ Spelunk: '[["a"' }))).refusal).toBeInstanceOf(InvalidSaveValue); // a corrupt key is not read
  });
  it(`a save older than the oldest block examined (DoOnceREAL < ${OLDEST_GATE}) is refused, naming that`, () => {
    for (const DoOnceREAL of [0, 248.3, 340.1, 366.9]) {
      const s = buildGameState(env(at389({ DoOnceREAL })));
      expect(s.refusal).toMatchObject({ name: "MissingSaveKey", key: UNPORTED_STEPS });
      expect(() => s.data).toThrow(UNPORTED_STEPS);
    }
    expect(buildGameState(env(at389({ DoOnceREAL: OLDEST_GATE, RoyalG: [[]] }))).refusal).toBeUndefined(); // 367 itself runs from 369 on
    expect(UNPORTED_STEPS).toBe("the game's load steps for DoOnceREAL < 367");
  });
  it("leaves the caller's envelope as it was and freezes what it built; every state gets lists of its own", () => {
    const e = env(at389({ CSver: 32.05 }));
    const before = structuredClone(e);
    const a = buildGameState(e);
    const b = buildGameState(e);
    expect(e).toEqual(before);
    for (const k of ["Spelunk", "Menagerie", "RoyalG", "RoyalMaps", "OptLacc"]) {
      expect(Object.isFrozen(a.data[k]), k).toBe(true);
      expect(Object.isFrozen((a.data[k] as unknown[])[1]), k).toBe(true);
      expect(a.data[k], k).not.toBe(b.data[k]);
    }
    expect(Object.isFrozen(a.migrations)).toBe(true);
    expect(Object.isFrozen(MIGRATIONS)).toBe(true);
  });
  it("migrate itself stops at the first step that cannot run and says which steps ran", () => {
    const d: Record<string, unknown> = { CSver: 33.05, DoOnceREAL: 389.1 };
    const r = migrate(d, {});
    expect(r.steps).toEqual(["Menagerie = [] (loader: CSver < 34 @19944986, init @6586152)", "Menagerie filled (initialize4 @6336662)"]);
    expect(r.refusal).toMatchObject({ key: "Ninja" });
  });
});

// ── the live N.js ───────────────────────────────────────────────────────────────────────────────
const NJS = "scripts/updater/.cache/N.new.js";
describe.skipIf(!existsSync(NJS))("against the live N.js", () => {
  const src = existsSync(NJS) ? readFileSync(NJS, "utf8") : "";
  const flat = src.replace(/\n/g, "");
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

  it("the loader reads RoyalG and RoyalMaps only from CSver 33, Menagerie only from 34, once each; ClearLocalData starts them as []", () => {
    expect(flat).toContain('33<=u.getLoad("CSver")&&(q=a.engine,p=u.getLoadJsonList("RoyalG"),q.gameAttributes.h.RoyalG=p,q=a.engine,p=u.getLoadJsonList("RoyalMaps"),q.gameAttributes.h.RoyalMaps=p)');
    expect(flat).toContain('34<=u.getLoad("CSver")&&(q=a.engine,p=u.getLoadJsonList("Menagerie"),q.gameAttributes.h.Menagerie=p)');
    const clear = flat.slice(flat.indexOf("_customBlock_ClearLocalData=function"), flat.indexOf("_customBlock_afkAttackBonses=function"));
    for (const k of ["RoyalG", "RoyalMaps", "Menagerie"]) {
      expect(flat.split(`getLoadJsonList("${k}")`).length - 1, k).toBe(1);
      expect(clear, k).toMatch(new RegExp(`(\\w)=\\[\\];\\w\\.gameAttributes\\.h\\.${k}=\\1`));
    }
    // the refusal's reason: Sushi (loaded from CSver 30) is not reset by ClearLocalData, so an older save keeps the attribute default
    expect(flat).toContain('30<=u.getLoad("CSver")&&(q=a.engine,p=u.getLoadJsonList("Sushi"),q.gameAttributes.h.Sushi=p)');
    expect(clear).not.toContain("h.Sushi=");
    expect(flat.split("gameAttributes.h.Sushi=").length - 1).toBe(1); // the loader's, nowhere else
  });

  it("initialize4 fills an empty RoyalG, RoyalMaps and Menagerie with what the steps give (read back statement by statement)", () => {
    const init4 = "_customBlock_initialize4=function";
    for (const name of ["RoyalG", "RoyalMaps", "Menagerie"]) {
      const head = `if(0==a.engine.getGameAttribute("${name}").length){`;
      const fill = njsBlock(src, head, init4);
      const game = runFill(fill.slice(head.length, -1), { [name]: [] })[name];
      expect(flat.indexOf(head, flat.indexOf(init4)), name).toBeLessThan(flat.indexOf("_customBlock_WhenUPressPlayButton=function"));
      const d: Record<string, unknown> = { [name]: [] };
      expect(MIGRATIONS.find((m) => m.id.startsWith(`${name} filled (initialize4 @`))!.run(d, {})).toBe(true);
      expect(d[name], name).toEqual(game);
    }
  });

  // each ported block, whole (compact() only shortens the attribute calls and the scratch lists)
  const PORTED: Record<number, string> = {
    371: "if(371>DoOnceREAL)for(DoOnceREAL=371.1;701>OptionsListAccount.length;)OptionsListAccount.push(0);",
    378: '378>DoOnceREAL&&(DoOnceREAL=378.1,OptionsListAccount[200]=1,OptionsListAccount[606]="");',
    // ported: the Spelunk lists; not ported (no reader): the outposts' RoyalMaps [0], the LockedSlots pads (the file's end says why)
    380:
      'if(380>DoOnceREAL){DoOnceREAL=380.1;d=0;for(e=CustomLists.h.MapDetails.length;d<e;)b=d++,0==RoyalMaps[b].length&&1==m._customBlock_RoyalG("HasOutpost",b,0)&&RoyalMaps[b].push(0);' +
      "48>Spelunk.length&&(DummyList2=[],DummyList2.push(0)x15,Spelunk.push(DummyList2));49>Spelunk.length&&(DummyList2=[],Spelunk.push(DummyList2));" +
      'd=PlayerDATABASE.h;e=Object.keys(d);f=e.length;for(g=0;g<f;)if(k=e[g++],d=PlayerDATABASE.h[""+k],Object.prototype.hasOwnProperty.call(d.h,"LockedSlots"))for(;112>PlayerDATABASE.h[""+k].h.LockedSlots.length;)PlayerDATABASE.h[""+k].h.LockedSlots.push(0);for(;112>LockedSlots.length;)LockedSlots.push(0)}',
    382: "382>DoOnceREAL&&(DoOnceREAL=382.1,23==RoyalG.length&&(DummyList2=[],DummyList2.push(0)x15,RoyalG.push(DummyList2)));",
    395:
      "if(395>DoOnceREAL){for(DoOnceREAL=395.1;40>Ninja[103].length;)Ninja[103].push(0);OptionsListAccount[519]=-1;if(50>Spelunk.length){DummyList2=[];for(d=0;37>d;)d++,DummyList2.push(0);Spelunk.push(DummyList2)}" +
      "51>Spelunk.length&&(DummyList2=[],Spelunk.push(DummyList2));52>Spelunk.length&&(DummyList2=[],Spelunk.push(DummyList2));53>Spelunk.length&&(DummyList2=[],Spelunk.push(DummyList2));54>Spelunk.length&&(DummyList2=[],Spelunk.push(DummyList2));Menagerie[0][6]=1}",
  };
  for (const [g, text] of Object.entries(PORTED)) {
    it(`OnPlayStart4's DoOnceREAL < ${g} block is the one ported`, () => {
      expect(compact(njsBlock(src, gateHead(Number(g)), "_customBlock_OnPlayStart4=function"))).toBe(text);
      expect(MIGRATIONS.some((m) => m.id.startsWith(`OnPlayStart4 DoOnceREAL < ${g} @`))).toBe(true);
    });
  }

  it(`the blocks a save can run from DoOnceREAL ${OLDEST_GATE} on are the ported ones and the ones the file accounts for, all in OnPlayStart4, in order`, () => {
    const gates = [...flat.matchAll(/([\d.]+)>a\.engine\.getGameAttribute\("DoOnceREAL"\)/g)].map((m) => ({ g: Number(m[1]), at: m.index! }));
    const newer = gates.filter((x) => x.g > OLDEST_GATE);
    const start = flat.indexOf("_customBlock_OnPlayStart4=function");
    const end = flat.indexOf("v._customBlock_", start + 40);
    for (const x of newer) expect(x.at > start && x.at < end, `gate ${x.g}`).toBe(true);
    expect(newer.map((x) => x.g)).toEqual([369, 370, 371, 374, 375, 378, 380, 382, 384, 385, 386, 389, 390, 395, 398, 399]); // a new one: examine it
    expect(gates.some((x) => x.g === OLDEST_GATE)).toBe(true); // the block the refusal stands for exists
    const order = MIGRATIONS.flatMap((m) => m.id.match(/^OnPlayStart4 DoOnceREAL < (\d+) /)?.[1] ?? []).map(Number);
    expect(order).toEqual([371, 378, 380, 382, 395]);
    expect(order.map((g) => newer.find((x) => x.g === g)!.at)).toEqual(order.map((g) => newer.find((x) => x.g === g)!.at).sort((a, b) => a - b));
  });
});

// ── the real saves ──────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("the real saves", () => {
  const saves = GOLDEN_SAVES.map((p) => ({ file: basename(p), data: JSON.parse(readFileSync(p, "utf8")).data, path: p }));

  it("a current save runs no step; each older one runs the steps of its version, or is refused when older than the steps ported", () => {
    const seen = new Map<string, string[]>();
    for (const { file, data, path } of saves) {
      const s = buildGameState(JSON.parse(readFileSync(path, "utf8")));
      if (data.CSver >= 34.05) {
        expect(s.migrations, file).toEqual([]);
        continue;
      }
      const group = s.refusal ? `refused: ${s.refusal.key}` : `CSver ${data.CSver}, DoOnceREAL ${data.DoOnceREAL}: ${s.migrations.length} steps`;
      seen.set(group, [...(seen.get(group) ?? []), file].sort());
    }
    expect(Object.fromEntries(seen)).toEqual({
      [`refused: ${UNPORTED_STEPS}`]: ["5OhTree.json", "HourZero.json"],
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

  it.skipIf(!existsSync(NJS))("the loader gates an older save that is replayed is below give only RoyalG, RoyalMaps, Menagerie (ported) and GreenStacks, CookMaster (never read)", () => {
    const flat = readFileSync(NJS, "utf8").replace(/\n/g, "");
    const loads = [...flat.matchAll(/([\d.]+)<=u\.getLoad\("CSver"\)&&\(([^;]*?)\)(?=;|\}|[\d.]+<=u)/g)].flatMap((m) =>
      [...m[2].matchAll(/getLoad\w*\("(\w+)"/g)].map((k) => ({ v: Number(m[1]), key: k[1] }))
    );
    expect(loads.length).toBeGreaterThan(20);
    const below = new Set<string>();
    for (const { data } of saves) if (data.CSver < 34.05 && data.DoOnceREAL >= OLDEST_GATE) for (const l of loads) if (l.v > data.CSver) below.add(l.key);
    expect([...below].sort()).toEqual(["CookMaster", "GreenStacks", "Menagerie", "RoyalG", "RoyalMaps"]);
  });
});
