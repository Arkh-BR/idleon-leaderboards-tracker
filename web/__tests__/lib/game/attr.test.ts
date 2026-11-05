import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { RUNTIME_ATTRS, SAVE_ATTRS, asNum, asNumber, attr } from "@/lib/game/attr";
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
    expect(new NotPorted("ArcadeBonus", "b=66").message).toBe('ArcadeBonus: sub-case "b=66" is not ported');
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
