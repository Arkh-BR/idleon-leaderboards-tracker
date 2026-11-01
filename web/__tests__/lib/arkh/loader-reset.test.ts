// The arkh state is a process-wide singleton. A save loaded after another one
// must not inherit the fields it lacks (Research, companions, tome points,
// StarSg, serverVars, TimeAway, tournament) — the Observed Max collectors load
// dozens of saves per process, and the site re-loads on an account switch.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import * as data from "@/lib/arkh/save/data";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const grid = new Array(240).fill(0);
grid[149] = 5;
grid[169] = 5;

const FULL = {
  charNames: ["A"],
  companion: { l: ["24,0,0,0,0", "38,0,0,0,0", "45,0,0,0,0"] },
  serverVars: { A_ResXP: 1.5 },
  tournament: { global: { T: 12 } },
  extraData: { totalTomePoints: 20000 },
  data: {
    Research: [grid],
    StarSg: { Activelius: 1 },
    TimeAway: { GlobalTime: 1_700_000_000 },
  },
};
const EMPTY = { charNames: ["A"], data: {} };

describe("loadSaveData resets the state between saves", () => {
  it("an empty save after a full one computes like a fresh empty save", () => {
    expect(computeArkhCoinMulti(FULL, 0, 301).total).toBeGreaterThan(1);
    expect(computeArkhCoinMulti(EMPTY, 0, 301).total).toBe(1);

    expect(saveData.research).toBeNull();
    expect(saveData.gridLevels[149]).toBe(0);
    expect(saveData.companionIds.size).toBe(0);
    expect(saveData.totalTomePoints).toBe(0);
    expect(saveData.starSignsUnlocked).toEqual({});
    expect(saveData.serverVarResXP).toBe(1.01);
    expect(data.saveGlobalTime).toBe(0);
    expect(data.tournamentDay).toBe(0);
  });

  it("the loaded save still wins over the defaults", () => {
    loadSaveData(FULL);
    expect(saveData.gridLevels[149]).toBe(5);
    expect(saveData.companionIds.has(24)).toBe(true);
    expect(saveData.totalTomePoints).toBe(20000);
    expect(saveData.starSignsUnlocked).toEqual({ Activelius: 1 });
    expect(data.tournamentDay).toBe(12);
  });
});
