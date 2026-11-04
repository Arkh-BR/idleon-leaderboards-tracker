// lib/game/data/maps.ts re-exports three tables the updater does not emit. N.js builds NjEQ and EquipmentSets in code (a.h.NjTrP8 = "…".split(" "),
// a.h.GODSHARD_SET = […]), so the committed copy (from an older extractor) is compared with the live N.js entry by entry.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { EquipmentSets, NjEQ, Number2Letter } from "@/lib/game/data";
import * as DATA from "@/lib/game/data";
import { loadNjs } from "@/scripts/njs-calls";

const HAVE_NJS = existsSync("scripts/updater/.cache/N.new.js");

/** The value N.js assigns to `a.h.<key>`: the statement runs from `a.h.<key>=` to the next `;a.h.` (or the `;return a}` that ends the map), evaluated on its own. */
function assigned(njs: string, key: string): unknown {
  const start = njs.indexOf(`a.h.${key}=`);
  if (start < 0) throw new Error(`a.h.${key} is not assigned in the live N.js`);
  const end = Math.min(...[";a.h.", ";return a}"].map((t) => njs.indexOf(t, start)).filter((i) => i >= 0));
  return new Function("a", `${njs.slice(start, end)}; return a.h.${key};`)({ h: {} });
}

describe.skipIf(!HAVE_NJS)("lib/game data maps against the live N.js", () => {
  const njs = HAVE_NJS ? loadNjs() : "";
  it("NjEQ: every Pristine Charm (NjTrP<n>) is what N.js assigns", () => {
    const charms = Object.keys(NjEQ).filter((k) => /^NjTrP\d+$/.test(k));
    expect(charms.length).toBeGreaterThan(20);
    for (const k of charms) expect((NjEQ as Record<string, unknown>)[k], k).toEqual(assigned(njs, k));
  });
  it("NjEQ: the charm the Winner Bonus reads, NjTrP8, gives 30", () => {
    expect(NjEQ.NjTrP8[3]).toBe("30");
  });
  it("EquipmentSets: every set is what N.js assigns", () => {
    const sets = Object.keys(EquipmentSets);
    expect(sets).toContain("GODSHARD_SET");
    for (const k of sets) expect((EquipmentSets as Record<string, unknown>)[k], k).toEqual(assigned(njs, k));
  });
  // `Ma.<name>=function(){var a=new l;a.h["1"]=…;return a}`: run the builder with a stand-in for the game's map class
  const built = (name: string): unknown => {
    const start = njs.indexOf(`Ma.${name}=function(){`);
    if (start < 0) throw new Error(`Ma.${name} is not in the live N.js`);
    const end = njs.indexOf(";return a}", start) + ";return a}".length;
    const fn = new Function("l", `return (${njs.slice(start + `Ma.${name}=`.length, end)})`)(function (this: { h: object }) { this.h = {}; });
    return (fn() as { h: unknown }).h;
  };
  it.each(["IDforETCbonus", "IDforCardBonus", "ClassStatTypes"])("%s is what N.js builds", (name) => {
    expect((DATA as Record<string, unknown>)[name]).toEqual(built(name));
  });
});

describe("Number2Letter", () => {
  // N.js only reads this table (344 reads, no writer): there is nothing to compare it with. It is the order the saves' letter lists follow.
  it("starts with '_' and the letters a..z, A..Z, one per index", () => {
    expect(Number2Letter.slice(0, 53)).toBe("_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(Number2Letter[48]).toBe("V"); // Event Shop item 48
    expect(new Set(Number2Letter).size).toBe(Number2Letter.length); // no letter twice
  });
});
