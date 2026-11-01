// Synthetic SaveData for the Artifact Find ports (sailing: captains, boats).
import { describe, it, expect } from "vitest";
import { saveData, type SaveData } from "@/lib/arkh/state";
import {
  captBonusCalc,
  captainsOfType6,
  nightmarinerTotLv,
  daveyJonesBonus,
} from "@/lib/arkh/stats/systems/w5/sailing";
import { legendPTSbonus } from "@/lib/arkh/stats/systems/w7/spelunking";

const sd = (o: Record<string, unknown>) => ({ ...saveData, ...o }) as SaveData;

describe("sailing ports", () => {
  it("captain bonus adds level × value for each matching slot", () => {
    const s = sd({ captainsData: [[3, 3, 0, 32, 0, 31, 43], [6, 1, 3, 10, 0, 5, 7]] });
    expect(captBonusCalc(3, 0, s)).toBe(32 * 31); // slot 1 matches
    expect(captBonusCalc(3, 1, s)).toBe(10 * 7); // slot 2 matches
    expect(captBonusCalc(3, -1, s)).toBe(0); // no captain
  });

  it("counts type-6 captains among the first 30", () => {
    expect(captainsOfType6(sd({ captainsData: [[6], [2], [6]] }))).toBe(2);
  });

  it("Nightmariner total sums upgrades above 600 over 20 boats", () => {
    expect(nightmarinerTotLv(sd({ boatsData: [[0, 0, 0, 442, 0, 442], [0, 0, 0, 100, 0, 100]] }))).toBe(284);
  });

  it("Davey Jones triples once boat upgrades reach 400 with Grid 105", () => {
    const base = sd({ boatsData: [[0, 0, 0, 200, 0, 200]], gemItemsData: { 8: 2 }, gridLevels: { 105: 1 } });
    expect(daveyJonesBonus(0, base)).toBeCloseTo((1 + (100 + legendPTSbonus(11, base)) / 100) * 3, 12);
    expect(daveyJonesBonus(0, { ...base, gridLevels: {} } as unknown as SaveData)).toBeCloseTo(
      1 + (100 + legendPTSbonus(11, base)) / 100,
      12,
    );
  });

  it("empty sailing state yields neutral values", () => {
    const s = sd({});
    expect([captBonusCalc(3, 0, s), captainsOfType6(s), nightmarinerTotLv(s)]).toEqual([0, 0, 0]);
    expect(daveyJonesBonus(0, s)).toBeGreaterThanOrEqual(1);
  });
});
