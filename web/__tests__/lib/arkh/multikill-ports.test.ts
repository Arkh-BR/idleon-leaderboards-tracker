// Synthetic saves for the Multikill ports (spec M6). This file never loads a
// real save: the arkh state is a singleton and loadSaveData doesn't reset
// every field, so each envelope spells out what it relies on.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { overkillQTY } from "@/lib/arkh/stats/systems/coin/gambit";
import { saltLick } from "@/lib/arkh/stats/systems/exp/saltLick";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("overkillQTY — the Death Note pages", () => {
  it("7 = the minibosses: table 7842 over the first 10 Ninja[105] entries (NinjaInfo[30])", () => {
    const ninja: unknown[] = [];
    ninja[105] = [99, 100, 250, 1e3, 5e3, 25e3, 1e5, 1e6, 0, 0, 1e9, 1e9];
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Ninja: ninja } });
    expect(overkillQTY(7, saveData)).toBe(0 + 1 + 2 + 3 + 4 + 5 + 7 + 10);
  });

  it("a world page without kills is 0", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {} } });
    expect(overkillQTY(0, saveData)).toBe(0);
  });
});

describe("saltLick(i) — N.js SaltLick", () => {
  it("is the level × SaltLicks[i][3]", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, SaltLick: [0, 0, 0, 5, 0, 0, 0, 0, 7] } });
    expect(saltLick(8, saveData)).toBe(21); // 3 per level
    expect(saltLick(3, saveData)).toBeCloseTo(1, 12); // .2 per level (EXP's term)
    expect(saltLick(0, saveData)).toBe(0);
  });
});
