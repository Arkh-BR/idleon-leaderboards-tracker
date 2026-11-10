// Task 7 (Damage plan): the edges of the account-system sub-cases this task ported, on a synthetic envelope (no real save, so CI runs them):
// only the keys a test sets are in the save; every other read is seeded in the Ctx cache. Values come from the data tables.
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { GodsInfo, GrimoireUpg, MapDetails, NinjaInfo, RANDOlist, RandoListo2, SpelunkUpg, SummonUPG } from "@/lib/game/data";
import { Summoning } from "@/lib/game/njs/Summoning";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { Thingies } from "@/lib/game/njs/Thingies";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { RiftStuff } from "@/lib/game/njs/RiftStuff";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { Divinity } from "@/lib/game/njs/Divinity";
import { Breeding } from "@/lib/game/njs/Breeding";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { NotPorted } from "@/lib/game/errors";

type Data = Record<string, unknown>;
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
/** A synthetic envelope with `chars` characters and the server's vote categories `votes` (null: no server answer). */
const synth = (data: Data, o: { chars?: number; votes?: unknown[] | null; trace?: boolean } = {}): Ctx =>
  makeCtx(
    buildGameState({
      data,
      charNames: Array.from({ length: o.chars ?? 1 }, (_, i) => `c${i}`),
      companion: null,
      guildData: {},
      serverVars: o.votes === null ? null : { voteCategories: o.votes ?? [] },
      tournament: {},
      accountCreateTime: 1,
      lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map: 0, trace: o.trace }
  );
const cell = (list: unknown, ...idx: number[]) => Number(idx.reduce<unknown>((v, i) => (v as unknown[])[i], list));
/** A KillsLeft2Advance list where map m has `left[m]` kills left (0 everywhere else). */
const kla = (left: Record<number, number> = {}) => Array.from({ length: 320 }, (_, m) => [left[m] ?? 0]);

describe("Task 7 Summoning edges on a synthetic save (run in CI)", () => {
  it("GrimoireUpgBonus: a plain upgrade is level x value, every other one times 1 + upgrade 36 / 100", () => {
    const grimoire = Array<number>(60).fill(0);
    grimoire[9] = 4;
    grimoire[35] = 7;
    const c = synth({ Grimoire: grimoire });
    seed(c, "Summoning", ["GrimoireUpgBonus", 36, 0], 50);
    expect(Summoning(c, "GrimoireUpgBonus", 9, 0)).toBe(4 * cell(GrimoireUpg, 9, 5));
    expect(Summoning(c, "GrimoireUpgBonus", 35, 0)).toBeCloseTo(7 * cell(GrimoireUpg, 35, 5) * 1.5, 12);
  });

  it("VaultKillzTotal sums every character's kills per map; 4..7 and 11 are floor(getLOG) of them (4..7: 0 below 10 kills)", () => {
    const need = (m: number) => cell(MapDetails, m, 0, 0);
    // character 0 has 5 kills on map 24 and character 1 has 3 more: 8 < 10, so entry 5 is 0; map 13 gets 1000 kills
    const at = (extra24: number) => {
      const c = synth(
        {
          KLA_0: kla({ 14: need(14), 24: need(24) - 5, 13: need(13) - 600, 8: need(8), 101: need(101) - 1 }),
          KLA_1: kla({ 14: need(14), 24: need(24) - 3 - extra24, 13: need(13) - 400, 8: need(8), 101: need(101) }),
          TaskZZ3: [[1, 0, 1], [1], [0], [1, 1]],
          CauldronInfo: [{ 0: 150, 1: 20, length: 2 }, [3], [0], [100]],
        },
        { chars: 2 }
      );
      return (b: number) => Summoning(c, "VaultKillzTotal", b, 0);
    };
    const v = at(0);
    expect(v(1)).toBe(8);
    expect(v(5)).toBe(0);
    expect(v(2)).toBe(1000);
    expect(v(6)).toBe(Math.floor(getLOG(synth({}), 1000))); // getLOG's constant makes this 2, not 3
    expect(v(8)).toBe(5); // the Tasks[3] entries equal to 1 (2 + 1 + 0 + 2), one running count
    expect(v(9)).toBe(100 + 20 + 3 + 0 + 100); // min(100, level), a cloud map read by its "length"
    expect(v(10)).toBe(1);
    expect(v(11)).toBe(0); // floor(getLOG(1))
    expect(at(92)(5)).toBe(1); // 100 kills: floor(getLOG(100)), just under 2
    expect(() => v(12)).toThrow(RangeError);
  });

  it("SummUpgBonus: 1 x level x value; 2 + max(0, talent 597 / 100 - 1) + upgrade 78 / 100 when Holes[28] lists it; times 1 + the stone trial when SummonUPG[b][10] is 1", () => {
    const rows = SummonUPG as unknown as unknown[][];
    const b = rows.findIndex((r) => Number(r[10]) === 1);
    const other = rows.findIndex((r) => Number(r[10]) !== 1);
    const summon = [Array<number>(rows.length).fill(3)];
    const at = (b: number, holes28: number[], trial: number) => {
      const c = synth({ Summon: summon, Holes: Array.from({ length: 29 }, (_, i) => (i === 28 ? holes28 : [])), KRbest: { [`SummzTrz${Number(rows[b][2])}`]: trial } });
      seed(c, "getbonus2", [1, 597, -1], 250);
      seed(c, "Summoning", ["SummUpgBonus", 78, 0], 40);
      return Summoning(c, "SummUpgBonus", b, 0);
    };
    const base = (b: number) => 3 * Number(rows[b][6]);
    expect(at(b, [], 0)).toBe(base(b));
    expect(at(b, [b], 0)).toBeCloseTo((2 + (2.5 - 1) + 0.4) * base(b), 12);
    expect(at(b, [], 2)).toBe(3 * base(b));
    expect(at(other, [], 2)).toBe(base(other)); // the trial counts only where SummonUPG[b][10] is 1
  });

  it("TomeBonus 0 and 6 are powers of the Tome score times the Grimoire 17 + TROLL boost; 6 needs Event Shop item 0", () => {
    const at = (owned: number) => {
      const c = synth({});
      seed(c, "DNSM.TomeQTYtot", [], 12345);
      seed(c, "Summoning", ["GrimoireUpgBonus", 17, 0], 10);
      seed(c, "GetSetBonus", ["TROLL_SET", "Bonus", 0, 0], 15);
      seed(c, "Summoning", ["EventShopOwned", 0, 0], owned);
      return c;
    };
    expect(Summoning(at(0), "TomeBonus", 0, 0)).toBeCloseTo(10 * Math.pow(123, 0.7) * 1.25, 9);
    expect(Summoning(at(1), "TomeBonus", 6, 0)).toBeCloseTo(4 * Math.pow(12, 0.4) * 1.25, 9);
    expect(Summoning(at(0), "TomeBonus", 6, 0)).toBe(0);
  });

  it("VotingBonusz 1 counts while it is in force or while the character has not reached the world the vote in force asks for", () => {
    const req = (v: number) => Number((NinjaInfo[38] as unknown[])[2 + 3 * v]);
    const vote = (votes: unknown[] | null, left: Record<number, number>) => {
      const c = synth({ KLA_0: kla(left) }, { votes });
      seed(c, "Summoning", ["VotingBonuszMulti", 0, 0], 2);
      return Summoning(c, "VotingBonusz", 1, 0);
    };
    const v1 = 2 * Number((NinjaInfo[38] as unknown[])[4]);
    const all = {}; // every portal's kills used up: 7 worlds
    expect(vote([1], all)).toBe(v1);
    const other = Array.from({ length: 33 }, (_, i) => i + 2).find((v) => req(v) > 1)!; // a vote asking for a world past the first
    expect(vote([other], all)).toBe(0); // 7 worlds reached: not below the requirement
    // portals of maps 0, 50, ... still have kills left: the character is in world 1
    expect(vote([other], { 0: 5, 50: 5, 100: 5, 150: 5, 200: 5, 250: 5 })).toBe(v1);
    expect(vote(null, all)).toBe(0); // no server answer: no vote known to be in force
  });

  it("GrimoireWraith is a runtime 0 (the masterclass form is not counted)", () => {
    const c = synth({}, { trace: true });
    expect(Summoning(c, "GrimoireWraith", 0, 0)).toBe(0);
    expect(JSON.stringify(c.trace)).toContain("runtime: masterclass form, not counted");
  });
});

describe("Task 7 Holes edges on a synthetic save (run in CI)", () => {
  /** Holes with upgrade 57 and 84 bought (`bought`), Holes[9][1] = `h91` and Holes[11][55] = `h1155`. */
  const holes = (bought: number, h91: number, h1155: number) => {
    const h: unknown[][] = Array.from({ length: 30 }, () => []);
    h[9] = [0, h91];
    h[11] = Object.assign(Array<number>(60).fill(0), { 55: h1155 });
    h[13] = Object.assign(Array<number>(100).fill(0), { 57: bought, 84: bought });
    return synth({ Holes: h });
  };
  it("B_UPG 57 is 20 x floor(getLOG(Holes[9][1])), 84 is e x Holes[11][55], both 0 until bought (Holes[13][b])", () => {
    const c = holes(1, 12345, 7);
    expect(Holes(c, "B_UPG", 57, 0)).toBe(20 * Math.floor(getLOG(c, 12345)));
    expect(Holes(c, "B_UPG", 84, 100)).toBe(700);
    expect(Holes(holes(0, 12345, 7), "B_UPG", 57, 0)).toBe(0);
    expect(Holes(holes(0, 12345, 7), "B_UPG", 84, 100)).toBe(0);
  });
  it("Cglunko_upgBon b is OptionsListAccount[630 + b] x RandoListo2[13][b]", () => {
    const ola = Array<number>(700).fill(0);
    ola[649] = 3;
    expect(Holes2(synth({ OptLacc: ola }), "Cglunko_upgBon", 19, 0)).toBe(3 * cell(RandoListo2, 13, 19));
  });
});

describe("Task 7 Thingies, Workbench, Rift, Farming, Gaming, Divinity, Breeding and Spelunk edges on a synthetic save (run in CI)", () => {
  const ola = (at: Record<number, unknown>) => Object.assign(Array<unknown>(700).fill(0), at);
  it("CoralKidUpgBonus 11 is round(OptionsListAccount[621]); the Reliquarium is Quest105 in the current inventory", () => {
    expect(Thingies(synth({ OptLacc: ola({ 621: 4.6 }) }), "CoralKidUpgBonus", 11, 0)).toBe(5);
    expect(Thingies(synth({ InventoryOrder_0: ["Copper", "Quest105"] }), "ReliquariumInPosession", 0, 0)).toBe(1);
    expect(Thingies(synth({ InventoryOrder_0: ["Copper"] }), "ReliquariumInPosession", 0, 0)).toBe(0);
  });

  it("FriendBonusStatz: the first FriendBonusSlots friends, a stat below 18, a later friend of the same stat replacing it, times the extra multi", () => {
    const at = (list: string, slots: number, b: number) => {
      const c = synth({ OptLacc: ola({ 476: list }) });
      seed(c, "Thingies", ["FriendBonusSlots", 0, 0], slots);
      seed(c, "Thingies", ["FriendBonusXtraMulti", 0, 0], 2);
      return Thingies(c, "FriendBonusStatz", b, 0);
    };
    const qty = (lv: number) => 100 * Math.min(1.5, 0.25 + (Math.min(3e4, lv) / (Math.min(3e4, lv) + 12e3)) * 1.5);
    expect(at("0,1000;0,6000", 2, 0)).toBeCloseTo(2 * qty(6000), 12); // the second friend replaces the first
    expect(at("0,1000;0,6000", 1, 0)).toBeCloseTo(2 * qty(1000), 12); // one slot: only the first
    expect(at("18,1000", 2, 0)).toBe(0); // stat 18 and up is not a friend bonus
    expect(at("0", 2, 0)).toBe(0);
    expect(Thingies(synth({}), "FriendBonusQTY", 7, 100)).toBe(0); // past the seven bonuses
  });

  it("DeathNoteRank: the e == 7842 table and the other one, 20 only past 1e9 kills with the Rift bonus 3", () => {
    const rank = (kills: number, rift: number, e = 0) => WorkbenchStuff(synth({ Rift: [rift] }), "DeathNoteRank", kills, e);
    expect([0, 25e3, 1e5, 25e4, 5e5, 1e6, 5e6, 1e8].map((k) => rank(k, 0))).toEqual([0, 1, 2, 3, 4, 5, 7, 10]);
    expect(rank(2e9, 19)).toBe(10);
    expect(rank(2e9, 20)).toBe(20);
    expect([99, 100, 250, 1e3, 5e3, 25e3, 1e5, 1e6].map((k) => rank(k, 0, 7842))).toEqual([0, 1, 2, 3, 4, 5, 7, 10]);
  });

  it("ConstMasteryBonus: 0 below Rift 40; 1 is 2 x floor((towers - 750) / 10), 2 is 5 x floor((towers - 1250) / 10), at least 0", () => {
    const at = (rift: number, each: number, b: number) => WorkbenchStuff(synth({ Rift: [rift], Tower: Array<number>(27).fill(each) }), "ConstMasteryBonus", b, 0);
    expect(at(39, 100, 1)).toBe(0);
    expect(at(40, 100, 1)).toBe(2 * Math.floor((2700 - 750) / 10));
    expect(at(40, 100, 2)).toBe(5 * Math.floor((2700 - 1250) / 10));
    expect(at(40, 10, 1)).toBe(0);
    expect(() => at(40, 10, 3)).toThrow(NotPorted);
  });

  it("RiftSkillETC 0 is 7 + 5 per skill (but 0, 2, 3, 5, 6, 8) whose account rank is above 2; RiftSkillBonus is 0 below Rift 15", () => {
    const lv0 = Array<number>(30).fill(0);
    lv0[2] = 400; // skill 1: rank 4
    lv0[3] = 400; // skill 2: rank 4, but skill 2 does not count
    expect(RiftStuff(synth({ Rift: [15], Lv0_0: lv0 }), "RiftSkillETC", 0)).toBe(7 + 5);
    expect(RiftStuff(synth({ Rift: [14], Lv0_0: lv0 }), "RiftSkillETC", 0)).toBe(7);
  });

  it("CropSCbonus 0 is 20 x the crops found x the multi once Emporium 27 is owned; StickerDMGmulti is 1 until grid 47 has a level", () => {
    const crop = (owned: number) => {
      const c = synth({ FarmCrop: { 0: 5, 1: 9, 2: 1 } });
      seed(c, "Ninja", ["EmporiumBonus", 27, 0], owned);
      seed(c, "FarmingStuffs", ["CropSCbonMulti", 0, 0], 1.5);
      return FarmingStuffs(c, "CropSCbonus", 0, 0);
    };
    expect(crop(1)).toBe(20 * 3 * 1.5);
    expect(crop(0)).toBe(0);
    const sticker = (grid: number) => {
      const c = synth({ Research: [[], [], [], [], [], [], [], [], [], [3, 4.6, 2]] });
      seed(c, "ResearchStuff", ["Grid_Bonus", 47, 0], grid);
      return FarmingStuffs(c, "StickerDMGmulti", 0, 0);
    };
    expect(sticker(0)).toBe(1);
    expect(sticker(2)).toBeCloseTo(1 + (2 * Math.round(Math.round(3 + 4.6) + 2)) / 100, 12);
  });

  it("MSA_Bonus 0 is floor(the totem waves / 10) once Super Bit 7 is owned", () => {
    const at = (bit: number) => {
      const c = synth({ TotemInfo: [[12, 30, 5]] });
      seed(c, "GamingStatType", ["SuperBitType", 7, 0], bit);
      return GamingStatType(c, "MSA_Bonus", 0, 0);
    };
    expect(at(1)).toBe(4);
    expect(at(0)).toBe(0);
  });

  it("BlesssBonus is Divinity[28 + b] x GodsInfo[b][14] x (1 + .05 x Emporium 33 x max(0, Divinity[25] - 10)); b == 2 has a rule of its own (skillStats.test.ts)", () => {
    const div = Array<number>(45).fill(0);
    div[25] = 14;
    div[35] = 3;
    const c = synth({ Divinity: div });
    seed(c, "Ninja", ["EmporiumBonus", 33, 0], 1);
    expect(Divinity(c, "BlesssBonus", 7, 0)).toBeCloseTo(3 * cell(GodsInfo, 7, 14) * (1 + 0.05 * 4), 12);
  });

  it("PetArenaBonus is 1 once the arena waves cleared in a row (OptionsListAccount[89] against RANDOlist[53]) pass e", () => {
    const req = (g: number) => cell(RANDOlist, 53, g);
    const c = synth({ OptLacc: ola({ 89: req(2) }) }); // clears waves 0, 1, 2: 3
    expect(Breeding(c, "PetArenaBonus", "0", 2, 0)).toBe(1);
    expect(Breeding(c, "PetArenaBonus", "0", 3, 0)).toBe(0);
  });

  it("Spelunk ShopUpgBonus: e == 1 is SpelunkUpg[b][4] x max(0, level); the table then fixes entries (25 is 1 + its value)", () => {
    const n = (SpelunkUpg as unknown as unknown[]).length;
    const spelunk: unknown[][] = Array.from({ length: 50 }, () => []);
    spelunk[5] = Array<number>(n).fill(2);
    spelunk[4] = Array<number>(10).fill(1);
    const c = synth({ Spelunk: spelunk, Lv0_0: Array<number>(25).fill(0) });
    expect(Spelunk(c, "ShopUpgBonus", 64, 1)).toBe(cell(SpelunkUpg, 64, 4) * 2);
    expect(Spelunk(c, "ShopUpgBonus", 64, 0)).toBe(cell(SpelunkUpg, 64, 4) * 2);
    expect(Spelunk(c, "ShopUpgBonus", 25, 0)).toBe(1 + cell(SpelunkUpg, 25, 4) * 2);
    expect(Spelunk(c, "ShopUpgBonus", 0, 0)).toBe(0); // times every character's Lv0[19], 0 here
  });
});
