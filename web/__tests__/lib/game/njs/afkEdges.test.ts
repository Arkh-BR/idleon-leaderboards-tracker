// Task 2 (AFK plan): the edges of the sub-cases this task ported, on a synthetic envelope (no real save, so CI runs them): Divinity
// Bonus_MAJOR / W7divChosen / Bonus_Minor(-1, e), ArcaneType ArcaneMapMulti(_bon, _bonMAX), Holes2 Cglunko_AFKgains and TalentCalc(650).
// Only the keys a test sets are in the save; every other block is answered from the Ctx cache (`seed`).
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { GodsInfo, RANDOlist, RandoListo2 } from "@/lib/game/data";
import { NotPorted } from "@/lib/game/errors";
import { Divinity } from "@/lib/game/njs/Divinity";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { TalentCalc } from "@/lib/game/njs/TalentCalc";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Log2 } from "@/lib/game/njs/Log2";

type Data = Record<string, unknown>;
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
const synth = (data: Data, o: { chars?: number; map?: number } = {}): Ctx =>
  makeCtx(
    buildGameState({
      data,
      charNames: Array.from({ length: o.chars ?? 1 }, (_, i) => `c${i}`),
      companion: null,
      guildData: {},
      serverVars: null,
      tournament: {},
      accountCreateTime: 1,
      lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map: o.map ?? 251 }
  );
const kind = (g: number) => Number((GodsInfo as unknown as number[][])[g][13]);
/** The first god whose kind is `k` (the Divinity("Bonus_Minor") list `BminorDivQdl.indexOf`). */
const godOfKind = (k: number) => Array.from({ length: 10 }, (_, g) => kind(g)).indexOf(k);
/** A save with the keys Bonus_MAJOR reads itself (GemItemsPurchased, the Divinity list, the World 7 god in OptLacc[425]) and character 0's skills. */
const divSave = (o: { w7?: number; divinity?: number[]; skill505?: number; gem9?: number } = {}): Data => {
  const optl = Array<number>(430).fill(0);
  optl[425] = o.w7 ?? 0;
  const gems = Array<number>(300).fill(0);
  gems[9] = o.gem9 ?? 0;
  return { OptLacc: optl, Divinity: o.divinity ?? [...Array<number>(12).fill(0), ...Array<number>(12).fill(-1), 0, 0], GemItemsPurchased: gems, SL_0: { 505: o.skill505 ?? 0 }, Lv0_0: Array<number>(20).fill(0) };
};
/** The calls Bonus_MAJOR / Bonus_Minor make before they read the save, all neutral. */
const neutral = (c: Ctx, e: number) => {
  seed(c, "Companions", [0], 0);
  seed(c, "Holes", ["PocketDivOwned", e, 0], 0);
  seed(c, "ResearchStuff", ["Grid_Bonus", 173, 0], 0);
};

describe("Divinity W7divChosen and Bonus_MAJOR (synthetic, runs in CI)", () => {
  it("W7divChosen: -1 with no god chosen, else the kind of god OptionsListAccount[425] - 1", () => {
    expect(Divinity(synth(divSave({ w7: 0 })), "W7divChosen", 0, 0)).toBe(-1);
    for (const w7 of [1, 4, 10]) expect(Divinity(synth(divSave({ w7 })), "W7divChosen", 0, 0), `w7 ${w7}`).toBe(kind(w7 - 1));
  });

  it("Bonus_MAJOR is 1 when Companion 0, a pocket god, the chosen World 7 god of that kind, the Research square 173 (kind 2) or the gem shop item 9 (kind 0) covers it", () => {
    const base = () => {
      const c = synth(divSave());
      neutral(c, 0);
      return c;
    };
    expect(Divinity(base(), "Bonus_MAJOR", 0, 0)).toBe(0); // nothing covers it, no linked god (Divinity[12] = -1)
    const comp = base();
    seed(comp, "Companions", [0], 1);
    expect(Divinity(comp, "Bonus_MAJOR", 0, 0)).toBe(1);
    const pocket = base();
    seed(pocket, "Holes", ["PocketDivOwned", 0, 0], 1);
    expect(Divinity(pocket, "Bonus_MAJOR", 0, 0)).toBe(1);
    const w7 = synth(divSave({ w7: godOfKind(0) + 1 }));
    neutral(w7, 0);
    expect(Divinity(w7, "Bonus_MAJOR", 0, 0)).toBe(1);
    const gem = synth(divSave({ gem9: 1 }));
    neutral(gem, 0);
    expect(Divinity(gem, "Bonus_MAJOR", 0, 0)).toBe(1);
    neutral(gem, 3);
    expect(Divinity(gem, "Bonus_MAJOR", 0, 3)).toBe(0); // the gem shop covers kind 0 only (and 3 has no other cover)
    const grid = synth(divSave());
    neutral(grid, 2);
    seed(grid, "ResearchStuff", ["Grid_Bonus", 173, 0], 1);
    expect(Divinity(grid, "Bonus_MAJOR", 0, 2)).toBe(1);
    neutral(grid, 0);
    seed(grid, "ResearchStuff", ["Grid_Bonus", 173, 0], 1);
    expect(Divinity(grid, "Bonus_MAJOR", 0, 0)).toBe(0); // square 173 covers kind 2 only
  });

  it("Bonus_MAJOR: the linked god (Divinity[b + 12]) counts when its kind is e; the talent 505 god counts when unlocked (below Divinity[25])", () => {
    const g = godOfKind(0);
    const linked = [...Array<number>(12).fill(0), g, ...Array<number>(11).fill(-1), 0, 0];
    const c = synth(divSave({ divinity: linked }));
    neutral(c, 0);
    expect(Divinity(c, "Bonus_MAJOR", 0, 0)).toBe(1);
    const other = synth(divSave({ divinity: linked }));
    neutral(other, 1);
    expect(Divinity(other, "Bonus_MAJOR", 0, 1)).toBe(0); // the linked god's kind is not 1, and talent 505 is 0
    // the talent 505 god is the last digit of its level, and counts only while Divinity[25] is above it
    const digit = godOfKind(0);
    const other0 = Array.from({ length: 10 }, (_, g) => g).find((g) => kind(g) !== 0)!; // a linked god of another kind
    const slots = (open: number) => [...Array<number>(12).fill(0), other0, ...Array<number>(11).fill(-1), 0, open];
    const t = synth(divSave({ divinity: slots(digit + 1), skill505: 20 + digit }));
    neutral(t, 0);
    expect(Divinity(t, "Bonus_MAJOR", 0, 0)).toBe(1);
    const locked = synth(divSave({ divinity: slots(digit), skill505: 20 + digit })); // Divinity[25] = digit: not above it
    neutral(locked, 0);
    expect(Divinity(locked, "Bonus_MAJOR", 0, 0)).toBe(0);
    // a Bonus_MAJOR for the Gen actor's kinds is not ported
    const six = synth(divSave());
    neutral(six, 6);
    expect(() => Divinity(six, "Bonus_MAJOR", 0, 6)).toThrow(NotPorted);
    neutral(six, 8);
    expect(() => Divinity(six, "Bonus_MAJOR", 0, 8)).toThrow(NotPorted);
  });
});

describe("Divinity Bonus_Minor(-1, e), the total over the 12 character slots (synthetic, runs in CI)", () => {
  const E = 5;
  const gE = godOfKind(E);
  it("with no cover, a slot counts its linked god's DivMinorBonus when that god is of kind e", () => {
    expect(gE).toBeGreaterThanOrEqual(0);
    const div = [...Array<number>(12).fill(0), gE, gE, -1, ...Array<number>(9).fill(-1), 0, 0];
    const c = synth(divSave({ divinity: div }), { chars: 3 });
    neutral(c, E);
    seed(c, "Divinity", ["DivMinorBonus", 0, gE], 10);
    seed(c, "Divinity", ["DivMinorBonus", 1, gE], 20);
    expect(Divinity(c, "Bonus_Minor", -1, E)).toBe(30); // slot 2 is -1: not linked
  });

  it("with Companion 0 (kind 5), every existing character counts the kind-e god's DivMinorBonus, the linked god or not", () => {
    const c = synth(divSave({ divinity: [...Array<number>(12).fill(0), ...Array<number>(12).fill(-1), 0, 0] }), { chars: 3 });
    neutral(c, E);
    seed(c, "Companions", [0], 1);
    for (let f = 0; f < 4; f++) seed(c, "Divinity", ["DivMinorBonus", f, gE], 7);
    expect(Divinity(c, "Bonus_Minor", -1, E)).toBe(3 * 7); // slots 0..2 exist, slot 3 does not
  });

  it("the World 7 god chosen for e + 1 (OptionsListAccount[425] = e + 1) takes the same branch as Companion 0, for kinds 3 and 5 only", () => {
    const c = synth(divSave({ w7: E + 1, divinity: [...Array<number>(12).fill(0), ...Array<number>(12).fill(-1), 0, 0] }), { chars: 2 });
    neutral(c, E);
    seed(c, "Divinity", ["DivMinorBonus", 0, gE], 4);
    seed(c, "Divinity", ["DivMinorBonus", 1, gE], 4);
    expect(Divinity(c, "Bonus_Minor", -1, E)).toBe(8);
    // kind 4 is not 3 or 5: the linked-god rule applies whatever OptionsListAccount[425] says
    const g4 = godOfKind(4);
    if (g4 >= 0) {
      const d = synth(divSave({ w7: 5, divinity: [...Array<number>(12).fill(0), ...Array<number>(12).fill(-1), 0, 0] }), { chars: 2 });
      neutral(d, 4);
      expect(Divinity(d, "Bonus_Minor", -1, 4)).toBe(0);
    }
  });
});

describe("ArcaneType ArcaneMapMulti (synthetic, runs in CI)", () => {
  const multi = (b: number) => (1 > b ? 0 : (2 * Math.max(0, getLOG(synth({}), b) - 3.5) + Math.max(0, Log2(synth({}), b) - 12)) * (getLOG(synth({}), b) / 2.5) + (Math.min(2, b / 1e3) + Math.max(5 * (getLOG(synth({}), b) - 5), 0)));
  it("ArcaneMapMulti: 0 below 1 kill, then the bonus of its kills (@11086725)", () => {
    const c = synth({});
    expect(ArcaneType(c, "ArcaneMapMulti", 0, 0)).toBe(0);
    expect(ArcaneType(c, "ArcaneMapMulti", 0.5, 0)).toBe(0);
    for (const kills of [1, 1000, 3e5, 1e9, 1e12]) {
      expect(ArcaneType(c, "ArcaneMapMulti", kills, 0), `${kills} kills`).toBe(multi(kills));
      expect(multi(kills)).toBeGreaterThan(0);
    }
  });

  it("ArcaneMapMulti_bonMAX: 100 x (getbonus2(1, 589, -1) - 1) + min(10, the Arcane upgrade 58)", () => {
    const c = synth({});
    seed(c, "getbonus2", [1, 589, -1], 1.25);
    seed(c, "ArcaneType", ["ArcaneUpgBonus", 58, 0], 12);
    expect(ArcaneType(c, "ArcaneMapMulti_bonMAX", 0, 0)).toBe(100 * 0.25 + 10);
    const d = synth({});
    seed(d, "getbonus2", [1, 589, -1], 1);
    seed(d, "ArcaneType", ["ArcaneUpgBonus", 58, 0], 4);
    expect(ArcaneType(d, "ArcaneMapMulti_bonMAX", 0, 0)).toBe(4);
  });

  it("ArcaneMapMulti_bon: slot b of the current map's MapBon row, capped; 0 when the row has fewer than 3 slots", () => {
    const rows = Array.from({ length: 300 }, () => [0, 0]);
    rows[251] = [5, 1e9, 3e5];
    rows[7] = [5, 1e9, 3e5, 9];
    const c = synth({ MapBon: rows }, { map: 251 });
    seed(c, "getbonus2", [1, 589, -1], 1);
    seed(c, "ArcaneType", ["ArcaneUpgBonus", 58, 0], 10);
    expect(ArcaneType(c, "ArcaneMapMulti_bon", 2, 0)).toBe(Math.min(10, multi(3e5)));
    expect(ArcaneType(c, "ArcaneMapMulti_bon", 1, 0)).toBe(Math.min(10, multi(1e9)));
    expect(ArcaneType(c, "ArcaneMapMulti_bon", 0, 0)).toBe(Math.min(10, multi(5)));
    expect(() => ArcaneType(c, "ArcaneMapMulti_bon", 3, 0)).toThrow(NotPorted); // ArcMultBon has three entries
    const short = synth({ MapBon: rows }, { map: 5 });
    expect(ArcaneType(short, "ArcaneMapMulti_bon", 2, 0)).toBe(0); // MapBon[5] has 2 slots
  });
});

describe("Holes2 Cglunko_AFKgains and TalentCalc(650) (synthetic, runs in CI)", () => {
  it("Cglunko_AFKgains: (10 + the Crystal Glunko upgrades 8 and 13) / 100", () => {
    const optl = Array<number>(660).fill(0);
    optl[638] = 3; // upgrade 8
    optl[643] = 2; // upgrade 13
    const c = synth({ OptLacc: optl });
    const v8 = 3 * Number((RandoListo2 as unknown as number[][])[13][8]);
    const v13 = 2 * Number((RandoListo2 as unknown as number[][])[13][13]);
    expect(Holes2(c, "Cglunko_AFKgains", 0, 0)).toBe((10 + (v8 + v13)) / 100);
    expect(Holes2(synth({ OptLacc: Array<number>(660).fill(0) }), "Cglunko_AFKgains", 0, 0)).toBe(0.1);
  });

  it("TalentCalc(650): talent 650 times the cards of RANDOlist[82..86] in Cards[1], each card once", () => {
    const lists = [82, 83, 84, 85, 86].map((i) => (RANDOlist as unknown as string[][])[i]);
    const owned = [lists[0][0], lists[2][0], lists[4][lists[4].length - 1], "NotACard"];
    const c = synth({ Cards1: owned });
    seed(c, "GetTalentNumber", [1, 650], 2.5);
    expect(TalentCalc(c, 650)).toBe(2.5 * 3);
    // a card named twice in Cards[1] counts once, an empty list gives 0
    const dup = synth({ Cards1: [lists[0][0], lists[0][0]] });
    seed(dup, "GetTalentNumber", [1, 650], 1);
    expect(TalentCalc(dup, 650)).toBe(1);
    const none = synth({ Cards1: [] });
    seed(none, "GetTalentNumber", [1, 650], 5);
    expect(TalentCalc(none, 650)).toBe(0);
  });
});
