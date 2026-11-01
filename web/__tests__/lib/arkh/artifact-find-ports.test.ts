// Synthetic SaveData for the Artifact Find ports (sailing, plus the remaining terms).
import { describe, it, expect } from "vitest";
import { saveData, type SaveData } from "@/lib/arkh/state";
import { assignSaveData } from "@/lib/arkh/save/data";
import { getLOG } from "@/lib/arkh/formulas";
import { stickerBonus, stickerBonusSlot } from "@/lib/arkh/stats/systems/exp/sticker";
import { starSignBonusReal, getEnabledStarSigns } from "@/lib/arkh/stats/systems/common/starSign";
import {
  fractalIslandBonus,
  killroyBonus0,
  nightmarinerBon0,
  holesBUpg55,
  loreEpiBon,
} from "@/lib/arkh/stats/systems/artifact/terms";
import { StarSigns } from "@/lib/arkh/stats/data/game/customlists.js";
import {
  captBonusCalc,
  captainsOfType6,
  nightmarinerTotLv,
  daveyJonesBonus,
} from "@/lib/arkh/stats/systems/w5/sailing";
import { legendPTSbonus } from "@/lib/arkh/stats/systems/w7/spelunking";

const sd = (o: Record<string, unknown>) => ({ ...saveData, ...o }) as SaveData;
/** A save plus OptionsListAccount (a main-thread global, set through assignSaveData). */
const sdOla = (ola: Record<number, number>, o: Record<string, unknown> = {}) => {
  const arr: number[] = [];
  for (const [k, v] of Object.entries(ola)) arr[Number(k)] = v;
  assignSaveData({ optionsListData: arr });
  return sd(o);
};
/** Menagerie lists with Unlock `b` bought (Menagerie[2][b] = 1) or not. */
const menagerie = (bought: number[]) => {
  const unlocks: number[] = [];
  for (const b of bought) unlocks[b] = 1;
  return [[], [], unlocks];
};

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

describe("Artifact Find remaining terms", () => {
  it("Fractal Island 3 needs 2500 hours", () => {
    expect(fractalIslandBonus(3, sdOla({ 184: 2499 }))).toBe(0);
    expect(fractalIslandBonus(3, sdOla({ 184: 2500 }))).toBe(1);
    expect(fractalIslandBonus(8, sdOla({ 184: 1e9 }))).toBe(0); // no 9th threshold
  });

  it("Killroy 0 saturates toward 2", () => {
    expect(killroyBonus0(sdOla({ 228: 300 }))).toBeCloseTo(1.5, 12);
    expect(killroyBonus0(sdOla({}))).toBe(1);
  });

  it("Nightmariner needs Menagerie unlock 13, then 1 + 1999·T/(T + 1e4)", () => {
    const boats = [[0, 0, 0, 442, 0, 442]]; // T = 284 (see above)
    expect(nightmarinerBon0(sd({ boatsData: boats, menagerieData: menagerie([]) }))).toBe(1);
    expect(nightmarinerBon0(sd({ boatsData: boats, menagerieData: menagerie([13]) }))).toBeCloseTo(
      1 + (1999 * 284) / (284 + 1e4),
      12,
    );
  });

  it("B_UPG 55 is 10·⌊log Holes[9][11]⌋, gated by Holes[13][55]", () => {
    const holes = (gate: number) => {
      const h: number[][] = [];
      h[9] = [];
      h[9][11] = 5e6; // getLOG = 6.69…
      h[13] = [];
      h[13][55] = gate;
      return sd({ holesData: h });
    };
    expect(holesBUpg55(holes(1))).toBe(10 * Math.floor(getLOG(5e6)));
    expect(holesBUpg55(holes(1))).toBe(60);
    expect(holesBUpg55(holes(0))).toBe(0);
    expect(holesBUpg55(sd({ holesData: [] }))).toBe(0);
  });

  it("Sticker 2 lives in exactly one slot, chosen by Menagerie unlock 22", () => {
    const research = { 9: [0, 0, 7], 11: [] };
    const locked = sd({ research, menagerieData: menagerie([]) });
    const open = sd({ research, menagerieData: menagerie([22]) });
    expect(stickerBonus(2, locked)).toBeGreaterThan(0);
    expect(stickerBonusSlot(2, 99, locked)).toBeGreaterThan(0);
    expect(stickerBonusSlot(2, 100, locked)).toBe(0);
    expect(stickerBonusSlot(2, 99, open)).toBe(0);
    expect(stickerBonusSlot(2, 100, open)).toBeGreaterThan(0);
    // Other stickers ignore the slot.
    expect(stickerBonusSlot(3, 99, open)).toBe(stickerBonus(3, open));
  });

  describe("Lore episode bonus", () => {
    const spelunk = (episodes: number) => {
      const sp: number[][] = [];
      sp[13] = [0, 0, episodes];
      return sp;
    };
    it("is 0 without a Tome score or before the episode", () => {
      expect(loreEpiBon(3, sd({ totalTomePoints: 0, spelunkData: spelunk(9) }))).toBe(0);
      expect(loreEpiBon(3, sd({ totalTomePoints: 60000, spelunkData: spelunk(3) }))).toBe(0);
    });
    it("is a·f(tome − b), f saturating at 1 (Spelunky[21][3] = 100|3000)", () => {
      const p = Math.pow(Math.floor((60000 - 3000) / 100), 0.7);
      const s = sd({ totalTomePoints: 60000, spelunkData: spelunk(4), grimoireData: [] });
      assignSaveData({ optionsListData: [] }); // no TROLL_SET
      expect(loreEpiBon(3, s)).toBeCloseTo(100 * (p / (25 + p)), 12);
    });
    it("scales with Grey Tome Book (Grimoire 17)", () => {
      const grim: number[] = [];
      grim[17] = 10; // GrimoireUpg[17][5] = 1 per level, not multiplied by Grimoire 36
      const base = { totalTomePoints: 60000, spelunkData: spelunk(4) };
      assignSaveData({ optionsListData: [] });
      const plain = loreEpiBon(3, sd({ ...base, grimoireData: [] }));
      expect(loreEpiBon(3, sd({ ...base, grimoireData: grim }))).toBeCloseTo(plain * (1 + 10 / 100), 12);
    });
  });

  describe("Artifosho (star sign 61)", () => {
    // Needs rift ≥ 10 for any sign to be enabled; sign names come from StarSigns.
    const riftData = [10];
    it("counts when equipped", () => {
      assignSaveData({ starSignData: ["61"], optionsListData: [] });
      expect(starSignBonusReal("61", 0, sd({ riftData, starSignsUnlocked: {} })).val).toBe(15);
      assignSaveData({ starSignData: ["12"], optionsListData: [] });
      expect(starSignBonusReal("61", 0, sd({ riftData, starSignsUnlocked: {} })).val).toBe(0);
    });
    it("counts when unlocked as an infinite sign without being equipped", () => {
      // Enabled signs = 5 + shiny bonus: a 62nd sign needs shiny category 3 ≥ 57.
      const shinyExp = Array(20).fill(1e30);
      const s = sd({
        riftData,
        breedingData: Object.assign([], { 22: shinyExp, 23: shinyExp, 24: shinyExp, 25: shinyExp }),
        starSignsUnlocked: { [(StarSigns as unknown as string[][])[61][0]]: 1 },
      });
      expect(getEnabledStarSigns(s)).toBeGreaterThan(61);
      assignSaveData({ starSignData: ["12"], optionsListData: [] });
      expect(starSignBonusReal("61", 0, s).val).toBe(15);
      // Below the enabled count the unlock does nothing.
      expect(starSignBonusReal("61", 0, { ...s, breedingData: [] } as unknown as SaveData).val).toBe(0);
    });
  });
});
