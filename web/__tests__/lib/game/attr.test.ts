import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { LOADER_DEFAULTS, RUNTIME_ATTRS, SAVE_ATTRS, asNum, asNumber, attr } from "@/lib/game/attr";
import { block, makeCtx, withPlayer } from "@/lib/game/ctx";
import { InvalidSaveValue, MissingSaveKey, NotPorted, UnknownAttribute } from "@/lib/game/errors";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { traceCalls } from "@/lib/diagnose/njsCalls";

const env = (data: Record<string, unknown>): GameEnvelope => ({
  data,
  charNames: ["Arkhe", "Markhe"],
  companion: null,
  guildData: { id: null, stats: null, members: [], points: null },
  serverVars: null,
  tournament: { user: null, match: null, global: null, leaderboard: [] },
  accountCreateTime: 1_600_000_000_000,
  lastUpdated: 1_700_000_000_000,
});

const ctxOf = (data: Record<string, unknown>, player = 0, trace = false) =>
  makeCtx(buildGameState(env(data)), { player, map: 0, trace });

describe("SAVE_ATTRS", () => {
  it("maps the attribute name to the save key the N.js loader reads it from", () => {
    expect(SAVE_ATTRS.OptionsListAccount).toEqual({ key: "OptLacc", perPlayer: false });
    expect(SAVE_ATTRS.StampLevel).toEqual({ key: "StampLv", perPlayer: false }); // the names differ
  });

  it("marks a `<Key>_<player>` key perPlayer, whatever attribute the loader stores it in", () => {
    expect(SAVE_ATTRS.Lv0).toEqual({ key: "Lv0", perPlayer: true });
    expect(SAVE_ATTRS.EquipmentOrder).toEqual({ key: "EquipOrder", perPlayer: true });
    // loaded as "CardEquip_" + player, and LoadPlayerInfo copies it into element 2 of Cards
    expect(SAVE_ATTRS["Cards[2]"]).toEqual({ key: "CardEquip", perPlayer: true });
    expect(Object.values(SAVE_ATTRS).filter((a) => a.key === "CardEquip").every((a) => a.perPlayer)).toBe(true);
  });

  it("names an element that has its own key `Attr[i]`", () => {
    expect(SAVE_ATTRS["Tasks[2]"]).toEqual({ key: "TaskZZ2", perPlayer: false });
    expect(SAVE_ATTRS["PostOfficeInfo[0]"]).toEqual({ key: "PostOfficeInfo0", perPlayer: false });
    expect(SAVE_ATTRS["EquipmentMap[1]"]).toEqual({ key: "EMm1", perPlayer: true });
  });

  it("holds no scratch attribute and not the live map", () => {
    expect(Object.keys(SAVE_ATTRS).filter((k) => /^Dummy/.test(k))).toEqual([]);
    expect(SAVE_ATTRS).not.toHaveProperty("CurrentMap");
  });
});

describe("attr", () => {
  const data = {
    OptLacc: [10, 20, [7, 8]],
    Lv0_0: [1, 2],
    Lv0_3: [30, 40],
    TaskZZ2: [[5, 6], [7]],
    Cards0: { Boss3A: 4 },
    CardEquip_3: ["B", "C"],
    Gone: null,
  };

  it("reads the save key behind the attribute, then the indices", () => {
    const ctx = ctxOf(data);
    expect(attr(ctx, "OptionsListAccount")).toEqual([10, 20, [7, 8]]);
    expect(attr(ctx, "OptionsListAccount", 1)).toBe(20);
    expect(attr(ctx, "OptionsListAccount", 2, 1)).toBe(8);
    expect(attr(ctx, "Cards", 0, "Boss3A")).toBe(4);
  });

  it("reads `<Key>_<ctx.player>` for a per-player attribute, so withPlayer switches character", () => {
    expect(attr(ctxOf(data, 0), "Lv0", 1)).toBe(2);
    expect(attr(ctxOf(data, 3), "Lv0", 1)).toBe(40);
    expect(attr(withPlayer(ctxOf(data, 0), 3), "Lv0", 0)).toBe(30);
    expect(attr(ctxOf(data, 3), "Cards", 2, 1)).toBe("C");
  });

  it("takes the first index of an attribute loaded element by element as the element", () => {
    const ctx = ctxOf(data);
    expect(attr(ctx, "Tasks", 2)).toEqual([[5, 6], [7]]);
    expect(attr(ctx, "Tasks", 2, 0, 1)).toBe(6);
  });

  it("returns undefined for an index the save does not have", () => {
    const ctx = ctxOf(data);
    expect(attr(ctx, "OptionsListAccount", 99)).toBeUndefined();
    expect(attr(ctx, "OptionsListAccount", 99, 0)).toBeUndefined();
    expect(attr(ctx, "Cards", 0, "NoSuchCard")).toBeUndefined();
  });

  it("throws UnknownAttribute for a name outside the map", () => {
    const ctx = ctxOf(data);
    expect(() => attr(ctx, "NoSuchAttribute")).toThrow(UnknownAttribute);
    expect(() => attr(ctx, "NoSuchAttribute")).toThrow("NoSuchAttribute");
    expect(() => attr(ctx, "constructor")).toThrow(UnknownAttribute); // never an Object.prototype member
    expect(() => attr(ctx, "Tasks", 9)).toThrow("Tasks[9]"); // an element the loader has no key for
  });

  it("tells an attribute loaded element by element which elements there are", () => {
    const ctx = ctxOf(data);
    expect(() => attr(ctx, "Tasks")).toThrow(UnknownAttribute);
    expect(() => attr(ctx, "Tasks")).toThrow("Tasks is loaded per element: Tasks[0..5]");
    expect(() => attr(ctx, "Tasks", 9)).toThrow("Tasks[9]: Tasks is loaded per element: Tasks[0..5]");
    expect(() => attr(ctx, "Cards")).toThrow("Cards[0..3]");
    expect(() => attr(ctx, "NoSuchAttribute")).not.toThrow("loaded per element");
  });

  it("says why a runtime-only attribute is not here", () => {
    const ctx = ctxOf(data);
    expect(() => attr(ctx, "CurrentMap")).toThrow(/ctx\.map/);
    expect(() => attr(ctx, "NONdummies")).toThrow(UnknownAttribute);
    expect(() => attr(ctx, "DNSM")).toThrow(UnknownAttribute);
    expect(() => attr(ctx, "DNSM")).toThrow(/^DNSM: session runtime/);
    expect(() => attr(ctx, "DNSM", "StarSigns")).toThrow(/^DNSM: session runtime/);
    expect(() => attr(ctx, "DNSM")).toThrow(expect.objectContaining({ attribute: "DNSM" }));
  });

  it("throws MissingSaveKey, naming the save key, when the save lacks it", () => {
    const ctx = ctxOf(data);
    expect(() => attr(ctx, "Boats")).toThrow(MissingSaveKey);
    expect(() => attr(ctx, "Boats", 0)).toThrow("Boats");
    expect(() => attr(ctxOf(data, 5), "Lv0")).toThrow("Lv0_5");
    expect(() => attr(ctxOf({ OptLacc: null }), "OptionsListAccount")).toThrow(MissingSaveKey); // null is absent
  });

  it("still refuses a value of the wrong shape on the way", () => {
    expect(() => attr(ctxOf({ Boats: 5 }), "Boats", 0)).toThrow(InvalidSaveValue);
  });
});

describe("LOADER_DEFAULTS: an attribute the loader replaces only from a save version (the game fills it itself otherwise)", () => {
  const OLD = { CSver: 33.05, OptLacc: [1] }; // below the Menagerie gate, no Menagerie key
  const ROWS = [20, 50, 50, 50, 14, 9, 17, 17]; // the lists initialize4 @6336662 pushes
  const NOTE = "absent: loader default Menagerie (CSver < 34) @6586152, filled @6336662";
  const leaves = (data: Record<string, unknown>, f: (c: ReturnType<typeof ctxOf>) => unknown) => {
    const ctx = ctxOf(data, 0, true);
    block("F", (c) => (f(c), 1))(ctx); // a block returns a number
    return ctx.trace!.children[0].children;
  };

  it("holds Menagerie, with the N.js offsets of its start, its fill and its CSver gate", () => {
    expect(Object.keys(LOADER_DEFAULTS)).toEqual(["Menagerie"]);
    const { init, ...offsets } = LOADER_DEFAULTS.Menagerie;
    expect(offsets).toEqual({ minCSver: 34, initAt: 6586152, fillAt: 6336662, gateAt: 19945057 });
    expect((init as number[][]).map((r) => r.length)).toEqual(ROWS);
    expect((init as number[][]).every((r) => r.every((v) => v === 0))).toBe(true);
  });

  it("gives a save below the gate that lacks the key the lists of zeros the game fills in, and indexes into them like any attribute", () => {
    const ctx = ctxOf(OLD);
    expect((attr(ctx, "Menagerie") as unknown[][]).map((r) => r.length)).toEqual(ROWS);
    expect(attr(ctx, "Menagerie", 2)).toEqual(Array(50).fill(0));
    expect(attr(ctx, "Menagerie", 2, 22)).toBe(0); // no unlock owned
    expect(attr(ctx, "Menagerie", 2, 50)).toBeUndefined(); // past the list, like any index
    expect(attr(ctx, "Menagerie", 9)).toBeUndefined();
    expect(asNum(ctx, "Menagerie", 2, 22)).toBe(0);
    expect(attr(ctxOf({ ...OLD, CSver: 33.99 }), "Menagerie", 2, 13)).toBe(0); // 34 <= 33.99 is false
    expect(attr(ctxOf({ ...OLD, CSver: "33.05" }), "Menagerie", 2, 13)).toBe(0); // c.asNumber of a string
  });

  it("returns a fresh copy on every call", () => {
    const ctx = ctxOf(OLD);
    (attr(ctx, "Menagerie") as unknown[][])[2][13] = 1;
    expect(attr(ctx, "Menagerie", 2, 13)).toBe(0);
    expect((LOADER_DEFAULTS.Menagerie.init as number[][])[2][13]).toBe(0);
  });

  it("leaves one (absent) leaf per read that names the default, the gate and the N.js offsets", () => {
    expect(leaves(OLD, (c) => attr(c, "Menagerie"))).toEqual([{ block: "(absent)", args: ["Menagerie"], value: 0, children: [], note: NOTE }]);
    expect(leaves(OLD, (c) => asNum(c, "Menagerie", 2, 22)).map((n) => [n.block, n.args, n.note])).toEqual([["(absent)", ["Menagerie[2][22]"], NOTE]]);
    // an index past the list is absent on top of that, as in any attribute
    expect(leaves(OLD, (c) => asNum(c, "Menagerie", 2, 60)).map((n) => [n.args[0], n.note])).toEqual([
      ["Menagerie[2][60]", NOTE],
      ["Menagerie[2][60]", "absent: asNumber(null) = 0"],
    ]);
  });

  it("is no N.js call for the call diff, and says nothing when it is not tracing", () => {
    const ctx = ctxOf(OLD, 0, true);
    block("F", (c) => (attr(c, "Menagerie"), 1))(ctx);
    expect(traceCalls(ctx.trace!)).toEqual([{ block: "F" }]);
    expect(ctxOf(OLD).trace).toBeNull();
    expect(attr(ctxOf(OLD), "Menagerie", 2, 22)).toBe(0);
  });

  it("still throws for a save at or above the gate that lacks the key (a real gap)", () => {
    for (const CSver of [34, 34.05, 40]) {
      expect(() => attr(ctxOf({ CSver }), "Menagerie")).toThrow(MissingSaveKey);
      expect(() => attr(ctxOf({ CSver }), "Menagerie", 2)).toThrow("Menagerie");
    }
  });

  it("does not take a missing CSver for a low one: it throws, naming the attribute's key", () => {
    expect(() => attr(ctxOf({ OptLacc: [1] }), "Menagerie")).toThrow(expect.objectContaining({ name: "MissingSaveKey", key: "Menagerie" }));
    expect(() => attr(ctxOf({ CSver: null }), "Menagerie")).toThrow(MissingSaveKey);
  });

  it("reads the key when the save has it, whatever the version, without a leaf", () => {
    const m = [[], [], [1]];
    expect(attr(ctxOf({ CSver: 33.05, Menagerie: m }), "Menagerie", 2, 0)).toBe(1);
    expect(attr(ctxOf({ CSver: 34.05, Menagerie: m }), "Menagerie", 2, 0)).toBe(1);
    expect(leaves({ CSver: 34.05, Menagerie: m }, (c) => attr(c, "Menagerie", 2, 0))).toEqual([]);
  });

  it("gives no other attribute a default: Boats stays a MissingSaveKey on an old save", () => {
    expect(() => attr(ctxOf(OLD), "Boats")).toThrow(MissingSaveKey);
    expect(() => attr(ctxOf(OLD), "Lv0")).toThrow("Lv0_0");
  });

  // The table is hand-listed from the loader, so it is read back from the game's own code.
  const NJS = "scripts/updater/.cache/N.new.js";
  describe.skipIf(!existsSync(NJS))("against the live N.js", () => {
    const src = existsSync(NJS) ? readFileSync(NJS, "utf8") : "";
    const inside = (from: number, text: string, at: number, what: string) => {
      expect(from, `${what}: N.js moved`).toBeLessThanOrEqual(at);
      expect(at, `${what}: N.js moved`).toBeLessThan(from + text.length);
    };

    for (const [name, d] of Object.entries(LOADER_DEFAULTS)) {
      it(`${name}: the game starts it empty (initAt)`, () => {
        const m = new RegExp(`(\\w)=\\[\\];\\w+\\.gameAttributes\\.h\\.${name}=\\1[;}]`).exec(src);
        expect(m, `no ${name} = [] init in N.js`).not.toBeNull();
        inside(m!.index, m![0], d.initAt, "initAt");
      });

      it(`${name}: the loader reads it only when ${d.minCSver} <= CSver (gateAt), nowhere else, and runs initialize1 right after`, () => {
        const m = new RegExp(`(\\d+)<=u\\.getLoad\\("CSver"\\)&&\\(\\w+=a\\.engine,\\w+=u\\.getLoadJsonList\\("${name}"\\),\\w+\\.gameAttributes\\.h\\.${name}=\\w+\\)\\}v\\._customBlock_initialize1\\(\\)`).exec(src);
        expect(m, `no CSver-gated load of ${name} in N.js`).not.toBeNull();
        expect(Number(m![1])).toBe(d.minCSver);
        inside(m!.index, m![0], d.gateAt, "gateAt");
        expect(src.split(`getLoadJsonList("${name}")`).length - 1, "another load of the key").toBe(1);
      });

      it(`${name}: initialize1 runs on to initialize4, which fills the empty list with lists of zeros ${JSON.stringify((d.init as unknown[][]).map((r) => r.length))} long (fillAt)`, () => {
        // initialize1 -> 2 -> 3 -> 4, each the last call of the one before
        for (const k of [1, 2, 3]) expect(src, `initialize${k}`).toContain(`v._customBlock_initialize${k + 1}()};v._customBlock_initialize${k + 1}=function`);
        const guard = `if(0==a.engine.getGameAttribute("${name}").length){`;
        const start = src.indexOf(guard, src.indexOf("_customBlock_initialize4=function"));
        const end = src.indexOf("v._customBlock_", start);
        expect(start, `initialize4 has no fill of ${name}`).toBeGreaterThan(0);
        const fill = src.slice(start, end);
        expect(src.indexOf(guard, start + 1), "another fill of the attribute").toBe(-1);
        inside(start, fill, d.fillAt, "fillAt");
        // the lists as the game builds them: `push(0)` once each, or a `for` of n of them; each list is then pushed onto the attribute
        const lists = fill
          .split(`getGameAttribute("${name}").push(`)
          .slice(0, -1)
          .map((chunk) => {
            const own = chunk.slice(chunk.lastIndexOf("gameAttributes.h.DummyList2="));
            const loop = /for\(e=0;(\d+)>e;\)e\+\+,[^;]*;/g;
            return [...own.matchAll(loop)].reduce((n, m) => n + Number(m[1]), 0) + (own.replace(loop, "").match(/"DummyList2"\)\.push\(0\)/g) ?? []).length;
          });
        expect(lists).toEqual((d.init as unknown[][]).map((r) => r.length));
      });
    }
  });
});

describe("asNumber (N.js c.asNumber @1688426)", () => {
  it("gives 0 for null, a number as it is, 1 or 0 for a boolean, and parseFloat for a string", () => {
    expect(asNumber(null)).toBe(0);
    expect(asNumber(undefined)).toBe(0);
    expect(asNumber(7.5)).toBe(7.5);
    expect(asNumber(-2)).toBe(-2);
    expect(asNumber(true)).toBe(1);
    expect(asNumber(false)).toBe(0);
    expect(asNumber("1.5")).toBe(1.5);
    expect(asNumber("12abc")).toBe(12);
    expect(asNumber("")).toBeNaN();
    expect(asNumber("abc")).toBeNaN();
  });

  it("leaves a list or a map NaN, as N.js does (parseFloat of '[…]' / '{…}')", () => {
    expect(asNumber([1, 2])).toBeNaN();
    expect(asNumber({ a: 1 })).toBeNaN();
  });
});

describe("asNum", () => {
  const data = { Lv0_0: [10, true, "3.5", null], OptLacc: [4] };

  it("is asNumber of the attribute value", () => {
    const ctx = ctxOf(data);
    expect(asNum(ctx, "Lv0", 0)).toBe(10);
    expect(asNum(ctx, "Lv0", 1)).toBe(1);
    expect(asNum(ctx, "Lv0", 2)).toBe(3.5);
    expect(asNum(ctx, "OptionsListAccount", 0)).toBe(4);
  });

  it("gives 0 for an absent index (c.asNumber(null)), and leaves an (absent) leaf in the trace", () => {
    const ctx = ctxOf(data, 0, true);
    const f = block("F", (c) => asNum(c, "Lv0", 9) + asNum(c, "Lv0", 3) + 1);
    expect(f(ctx)).toBe(1);
    const [fNode] = ctx.trace!.children;
    expect(fNode.children).toEqual([
      { block: "(absent)", args: ["Lv0[9]"], value: 0, children: [], note: "absent: asNumber(null) = 0" },
      { block: "(absent)", args: ["Lv0[3]"], value: 0, children: [], note: "absent: asNumber(null) = 0" }, // a null in the save too
    ]);
    // it is not an N.js call, so the call diff does not count it
    expect(traceCalls(ctx.trace!)).toEqual([{ block: "F" }]);
  });

  it("says nothing when it is not tracing", () => {
    const ctx = ctxOf(data);
    expect(ctx.trace).toBeNull();
    expect(asNum(ctx, "Lv0", 9)).toBe(0);
  });

  it("writes the address with every index, and the player when it differs", () => {
    const ctx = ctxOf({ TaskZZ2: [[1]], Lv0_1: [2] }, 0, true);
    asNum(ctx, "Tasks", 2, 0, 5);
    asNum(withPlayer(ctx, 1), "Lv0", 7);
    expect(ctx.trace!.children.map((n) => [n.block, n.args, n.player])).toEqual([
      ["(absent)", ["Tasks[2][0][5]"], undefined],
      ["(absent)", ["Lv0[7]"], 1],
    ]);
  });

  it("does not turn a missing save key into 0", () => {
    expect(() => asNum(ctxOf(data), "Boats", 0)).toThrow(MissingSaveKey);
    expect(() => asNum(ctxOf(data), "NoSuchAttribute", 0)).toThrow(UnknownAttribute);
  });
});

describe("NotPorted", () => {
  it("names the function and the sub-case", () => {
    const e = new NotPorted("Summoning", "VaultUpgBonus");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("NotPorted");
    expect(e.message).toBe('Summoning: sub-case "VaultUpgBonus" is not ported');
    expect(e.fn).toBe("Summoning");
    expect(e.sub).toBe("VaultUpgBonus");
    expect(new NotPorted("ArcadeBonus", 66).message).toBe('ArcadeBonus: sub-case 66 is not ported');
  });
});

// The attributes the Artifact Find closure reads (Task 1's inventory) against the loader (Ruling A).
const INVENTORY = "../docs/superpowers/plans/2026-11-04-artifact-find-inventory.md";
const inventoryAttrs = (): string[] => {
  const section = readFileSync(INVENTORY, "utf8").split(/^## attrs$/m)[1].split(/^## /m)[0];
  return [...section.matchAll(/^- \[[ x~]\] `(\w+)`/gm)].map((m) => m[1]);
};
/** Loaded by the N.js loader: an entry of its own, or one per element (`Tasks[0]`…). */
const isSaveAttr = (name: string) => Object.keys(SAVE_ATTRS).some((k) => k === name || k.startsWith(`${name}[`));

/** The inventory's attributes the loader really loads, plus the five the formula names itself. */
export const ARTIFACT_ATTRS: string[] = [
  ...new Set(["Boats", "Captains", "Sailing", "OptionsListAccount", "Spelunk", ...inventoryAttrs().filter(isSaveAttr)]),
];

describe("the inventory's attributes: save or runtime, never both, never neither", () => {
  const inv = inventoryAttrs();
  const runtime = new Map(RUNTIME_ATTRS.map((r) => [r.name, r.reason]));

  it("finds the inventory's attributes", () => {
    expect(inv.length).toBeGreaterThan(40);
    expect(inv).toContain("Sailing");
  });

  it("puts every one in exactly one of SAVE_ATTRS and RUNTIME_ATTRS", () => {
    const both = inv.filter((n) => isSaveAttr(n) && runtime.has(n));
    const neither = inv.filter((n) => !isSaveAttr(n) && !runtime.has(n));
    expect({ both, neither }).toEqual({ both: [], neither: [] });
  });

  it("keeps the ones the loader never loads out of SAVE_ATTRS, each with a reason", () => {
    for (const n of ["NONdummies", "DNSM", "DummyNumbersStatManager", "ItemDefinitionsGET", "CustomLists", "CurrentMap"]) {
      expect(runtime.has(n), n).toBe(true);
      expect(isSaveAttr(n), n).toBe(false);
    }
    for (const r of RUNTIME_ATTRS) expect(r.reason.length, r.name).toBeGreaterThan(10);
  });

  it("lists no runtime attribute that is not in the inventory, and none twice", () => {
    expect(RUNTIME_ATTRS.filter((r) => !inv.includes(r.name))).toEqual([]);
    expect(runtime.size).toBe(RUNTIME_ATTRS.length);
  });

  it("makes ARTIFACT_ATTRS the loaded ones", () => {
    expect(ARTIFACT_ATTRS).toEqual(expect.arrayContaining(["Boats", "Captains", "Sailing", "OptionsListAccount", "Spelunk", "Lv0", "Cards", "Tasks"]));
    expect(ARTIFACT_ATTRS.filter((n) => runtime.has(n))).toEqual([]);
  });
});

const GOLDEN = "scripts/updater/golden/.cache/arkhe-live-2026-11-03-markhe-weapon.json";
describe.skipIf(!existsSync(GOLDEN))("the golden ARKHE save", () => {
  const save = existsSync(GOLDEN) ? (JSON.parse(readFileSync(GOLDEN, "utf8")) as GameEnvelope) : null;

  it("resolves every ARTIFACT_ATTRS attribute (every element, for every character that has its own key)", () => {
    const state = buildGameState(save!);
    const failed: string[] = [];
    for (const name of ARTIFACT_ATTRS) {
      const entries = Object.entries(SAVE_ATTRS).filter(([k]) => k === name || k.startsWith(`${name}[`));
      expect(entries.length, name).toBeGreaterThan(0);
      for (const [k, e] of entries) {
        const idx = k === name ? [] : [Number(/\[(\d+)\]$/.exec(k)![1])];
        for (let ci = 0; ci < (e.perPlayer ? state.charNames.length : 1); ci++) {
          try {
            expect(attr(makeCtx(state, { player: ci, map: 0 }), name, ...idx), `${k} char ${ci}`).not.toBeUndefined();
          } catch (err) {
            failed.push(`${k} char ${ci}: ${String(err)}`);
          }
        }
      }
    }
    expect(failed).toEqual([]);
  });

  it("reads what the game reads: Sailing[3] is the artifact list, Lv0 is the character's levels", () => {
    const state = buildGameState(save!);
    const ctx = makeCtx(state, { player: 8, map: 0 });
    expect(Array.isArray(attr(ctx, "Sailing", 3))).toBe(true);
    expect(attr(ctx, "Lv0")).toEqual((state.data as Record<string, unknown>).Lv0_8);
  });
});
