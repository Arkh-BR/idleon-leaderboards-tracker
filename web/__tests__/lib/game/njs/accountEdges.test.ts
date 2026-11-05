// Task 7 (Damage plan): the edges of the account-system sub-cases this task ported, on a synthetic envelope (no real save, so CI runs them):
// only the keys a test sets are in the save; every other read is seeded in the Ctx cache. Values come from the data tables.
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { GrimoireUpg, MapDetails, NinjaInfo, RandoListo2, SummonUPG } from "@/lib/game/data";
import { Summoning } from "@/lib/game/njs/Summoning";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";

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
