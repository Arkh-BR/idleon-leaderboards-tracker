// Drop Rate V1's star-sign term counts only the signs active in StarSignsDL
// (N.js _customBlock_StarSigns: Drop += 5 only with sign 14 in the list, += 12
// only with 76). It used to add +5 and +12 for every character.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { starSign } from "@/lib/arkh/stats/systems/common/starSign";
import { StarSigns } from "@/lib/arkh/stats/data/game/customlists.js";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const load = (signs: string, extra: Record<string, unknown> = {}) =>
  loadSaveData({ charNames: ["A"], data: { PVtStarSign_0: signs, Lv0_0: [120], StarSg: {}, ...extra } });
const drop = () => starSign.resolve("drop", { saveData, charIdx: 0 });
const names = StarSigns as unknown as string[][];

describe("V1 Drop Rate star-sign term", () => {
  it("is 0 for a character with neither Pirate Booty (14) nor Druipi Major (76) active", () => {
    load("12,3");
    const n = drop();
    expect(n.val).toBe(0);
    expect(n.children).toBeUndefined();
  });

  it("counts +5 with sign 14 only, +12 with sign 76 only, 17 with both", () => {
    load("14");
    expect(drop().val).toBe(5);
    load("76");
    expect(drop().val).toBe(12);
    load("14,76");
    const n = drop();
    expect(n.val).toBe(17);
    expect(n.children?.map((c) => c.name)).toEqual(["Pirate Booty (Star Sign 14)", "Druipi Major (Star Sign 76)"]);
  });

  it("multiplies by Seraph only when Seraph_Cosmos is unlocked", () => {
    load("14,76");
    expect(drop().children?.some((c) => c.name === "Seraph Multiplier")).toBe(false);
    load("14,76", { StarSg: { Seraph_Cosmos: 1 } }); // Seraph 1.1 (no Arcane 40, summoning level 0)
    const n = drop();
    expect(n.val).toBeCloseTo(17 * 1.1, 12);
    expect(n.children?.find((c) => c.name === "Seraph Multiplier")?.val).toBeCloseTo(1.1, 12);
    load("12", { StarSg: { Seraph_Cosmos: 1 } });
    expect(drop().val).toBe(0); // Seraph multiplies a positive total only
  });

  it("counts an infinite star sign (unlocked, inside the enabled range) like an equipped one", () => {
    const breeding: number[][] = [];
    breeding[22] = [];
    breeding[22][1] = 1e15; // maxed World 1 shiny Squirrel: enabled signs = 5 + 40 = 45
    load("", { Rift: [10], Breeding: breeding, StarSg: { [names[14][0]]: 1 } });
    expect(drop().val).toBe(5);
    load("", { Rift: [10], Breeding: breeding, StarSg: { [names[14][0]]: 1, [names[76][0]]: 1 } });
    expect(drop().val).toBe(5); // sign 76 sits past the 45 enabled slots
  });
});
