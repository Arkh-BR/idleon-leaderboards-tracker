// Task 7: account upgrades of Sailing("BoatArtiMulti", 0): arcade32, arcade66, bUpg55, sticker2add, sticker2mult, grid109,
// grid106, monument1_2, exotic45. Each term is the expression as BoatArtiMulti uses it (before the /100 of a `pct` group),
// compared with lib/arkh over every real save and every character; then one synthetic edge at a time on a real envelope.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, UNPORTED_REFUSALS, arkhArtifactLeaf, gameCtx } from "../support/arkhOracle";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "@/lib/game/errors";
import { HoleFountUPG, MarketExoticInfo, Research, ResGridSquares } from "@/lib/game/data";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { Companions } from "@/lib/game/njs/Companions";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Summoning } from "@/lib/game/njs/Summoning";
import { callDiff, njsCalls, njsFunction, njsNamedBlocks, njsSlice, traceCalls } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";

// The terms, written the way BoatArtiMulti writes them.
type Term = { term: (c: Ctx) => number; minSeen: number };
const TERMS: Record<string, Term> = {
  arcade32: { term: (c) => ArcadeBonus(c, 32), minSeen: 5 },
  arcade66: { term: (c) => ArcadeBonus(c, 66), minSeen: 5 },
  bUpg55: { term: (c) => Holes(c, "B_UPG", 55, 0), minSeen: 5 },
  sticker2add: { term: (c) => FarmingStuffs(c, "StickerBonus", 2, 99), minSeen: 5 },
  sticker2mult: { term: (c) => FarmingStuffs(c, "StickerBonus", 2, 100), minSeen: 0 }, // 0 on every real save (none owns Menagerie unlock 22): the forced-unlock loop below covers it
  grid109: { term: (c) => ResearchStuff(c, "Grid_Bonus", 109, 0), minSeen: 5 },
  grid106: { term: (c) => ResearchStuff(c, "Grid_Bonus", 106, 0), minSeen: 5 },
  monument1_2: { term: (c) => Holes(c, "MonumentROGbonuses", 1, 2), minSeen: 5 },
  exotic45: { term: (c) => FarmingStuffs(c, "ExoticBonusQTY", 45, 0), minSeen: 5 },
};

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

const csverOf = (file: string): number => JSON.parse(readFileSync(GOLDEN_SAVES.find((p) => basename(p) === file)!, "utf8")).data.CSver;

// One GameState per save, shared by all its characters (withPlayer) and by the tests.
const states = new Map<string, { ctx: Ctx; chars: number }>();
afterAll(() => states.clear()); // the built states of the real saves are big: not kept past this file (a full run keeps its workers alive)
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const save = JSON.parse(readFileSync(path, "utf8"));
    states.set(path, (s = { ctx: gameCtx(save, 0), chars: save.charNames.length }));
  }
  return s;
}

// Ruling E: a save missing a key the current N.js loader maps stays a strict MissingSaveKey. An older save is read after the game's own load
// steps (lib/game/migrations: Menagerie below CSver 34, the Spelunk lists of DoOnceREAL 380 and 395...), so the refusals are the saves older
// than the steps ported, the same for every term (UNPORTED_REFUSALS), all below the current CSver (checked in the loop).
const CURRENT_CSVER = 34.05;

describe.skipIf(GOLDEN_SAVES.length === 0)("lib/game account-upgrade terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const { term, minSeen } = TERMS[id];
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      const seen = new Set<number>();
      let pairs = 0;
      for (const path of GOLDEN_SAVES) {
        const { ctx, chars } = stateOf(path);
        for (let ci = 0; ci < chars; ci++) {
          if (KNOWN_ARKH_DIFFS.some((d) => d.save === basename(path) && (d.ci ?? ci) === ci && d.source === id)) continue;
          let got: number;
          try {
            got = term(withPlayer(ctx, ci));
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          const want = arkhArtifactLeaf(path, ci, id);
          pairs++;
          seen.add(want);
          if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[account ${id}] ${pairs} pairs checked, ${mismatches.length} mismatches, ${refused.size} save/key refusals, ${seen.size} distinct values, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches).toEqual([]);
      expect(pairs).toBeGreaterThan(100); // a loop over nothing would pass
      expect(seen.size).toBeGreaterThan(minSeen); // nor would a term that is the same number everywhere
      expect([...refused].sort()).toEqual(UNPORTED_REFUSALS);
      for (const r of refused) expect(csverOf(r.split(": ")[0]), `${r} is pre-migration`).toBeLessThan(CURRENT_CSVER);
    }, 120_000);
  }
});

// ── synthetic saves: one edge each, on top of a real envelope ───────────────────────────────────
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];
type Data = Record<string, unknown>;
const json = (d: Data, k: string): any => (typeof d[k] === "string" ? JSON.parse(d[k] as string) : structuredClone(d[k]));

/** A fresh copy of BASE with `edit` applied to its `data` (and `env` to the envelope around it): never a shared object. */
function variant(edit: (d: Data) => void, o: { ci?: number; trace?: boolean; env?: (e: any) => void } = {}): Ctx {
  const env = JSON.parse(readFileSync(BASE, "utf8"));
  edit(env.data);
  o.env?.(env);
  return gameCtx(env, o.ci ?? 0, o.trace);
}
const setIn = (d: Data, key: string, fn: (v: any) => void) => {
  const v = json(d, key);
  fn(v);
  d[key] = v;
};
const noNjs = !existsSync("scripts/updater/.cache/N.new.js");

describe.skipIf(GOLDEN_SAVES.length === 0)("getLOG (N.js @4461003)", () => {
  const log = (a: number) => getLOG(variant(() => {}), a);
  it("is ln(max(a, 1)) / 2.30259", () => {
    expect(log(50)).toBeCloseTo(Math.log(50) / 2.30259, 12);
    expect(log(1)).toBe(0);
  });
  it("is 0 below 1 (the max clamps a, so no negative log)", () => {
    expect(log(0.5)).toBe(0);
    expect(log(0)).toBe(0);
    expect(log(-7)).toBe(0);
  });
  it("the game's constant is a hair above ln 10, so an exact power of ten floors one below: floor(getLOG(1000)) is 2", () => {
    expect(Math.floor(log(1000))).toBe(2); // log10 would say 3
    expect(Math.floor(log(1001))).toBe(3);
    expect(Math.floor(log(10))).toBe(0);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("Holes B_UPG 55 (N.js @10996050)", () => {
  // Holes[13][55] = the upgrade is bought; Holes[9][11] = the amount the upgrade counts the digits of
  const bupg = (o: { bought?: unknown; amount?: number; cut9?: number; cut13?: number; empty?: boolean; trace?: boolean }) =>
    variant(
      (d) => {
        if (o.empty) return void (d.Holes = []);
        setIn(d, "Holes", (h) => {
          if ("bought" in o) h[13][55] = o.bought;
          if (o.amount !== undefined) h[9][11] = o.amount;
          if (o.cut9 !== undefined) h[9].length = o.cut9;
          if (o.cut13 !== undefined) h.length = o.cut13;
        });
      },
      { trace: o.trace }
    );
  const term = (c: Ctx) => Holes(c, "B_UPG", 55, 0);

  it("is 10 x floor(getLOG(Holes[9][11])) once bought; getLOG's constant makes 1e30 floor to 29, not 30", () => {
    expect(term(bupg({ bought: 1, amount: 1e30 }))).toBe(290);
    expect(term(bupg({ bought: 1, amount: 1e31 }))).toBe(300); // 31 x (1 - 2.1e-6) floors to 30
    expect(term(bupg({ bought: 1, amount: 5 }))).toBe(0);
  });
  it("is 0 when not bought, whatever the amount", () => {
    expect(term(bupg({ bought: 0, amount: 1e30 }))).toBe(0);
  });
  it("an empty Holes list is 0 (the head guard `0 == Holes.length`)", () => {
    expect(term(bupg({ empty: true }))).toBe(0);
  });
  it("a null flag is not 0 in N.js (loose ==): the upgrade counts", () => {
    expect(term(bupg({ bought: null, amount: 1e30 }))).toBe(290);
  });
  it("an amount the save has no entry for is asNumber(null) = 0, shown in the trace", () => {
    const c = bupg({ bought: 1, cut9: 11, trace: true });
    expect(term(c)).toBe(0);
    expect(JSON.stringify(c.trace)).toContain("Holes[9][11]");
  });
  it("a Holes list without the flags row, or without the amounts row, is refused (the game indexes both)", () => {
    expect(() => term(bupg({ cut13: 13 }))).toThrow(MissingSaveKey);
    const noAmounts = variant((d) => setIn(d, "Holes", (h) => ((h[13][55] = 1), (h[9] = null))));
    expect(() => term(noAmounts)).toThrow(MissingSaveKey);
    expect(() => term(variant((d) => delete d.Holes))).toThrow(MissingSaveKey);
  });
  it("other upgrades: the head guard answers for any b, the rest is not ported", () => {
    const at = (b: number, flag: number) => variant((d) => setIn(d, "Holes", (h) => (h[13][b] = flag)));
    expect(Holes(at(54, 0), "B_UPG", 54, 0)).toBe(0); // the guard returns before the chain
    for (const b of [14, 45, 54, 56]) expect(() => Holes(at(b, 1), "B_UPG", b, 0), `b=${b}`).toThrow(NotPorted);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const expected = njsCalls(njsSlice(njsFunction(loadNjs(), "Holes")!, ["B_UPG", 55])!);
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = bupg({ bought: 1, amount: 1e30, trace: true });
    term(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("Holes2 Fountain_BonTOT / Fountain_MarbleBon (N.js @11045841, @11055213)", () => {
  // the fountain upgrade (b, e): round(marble bonus x Holes[31][b][e] x HoleFountUPG[b][e][6])
  const fountain = (b: number, e: number, o: { level?: number; amount?: number; cutRows?: number; trace?: boolean } = {}) =>
    variant(
      (d) =>
        setIn(d, "Holes", (h) => {
          if (o.level !== undefined) h[32][b][e] = o.level;
          if (o.amount !== undefined) h[31][b][e] = o.amount;
          if (o.cutRows !== undefined) h[31].length = o.cutRows;
        }),
      { trace: o.trace }
    );
  const upg6 = (b: number, e: number) => Number((HoleFountUPG as any)[b][e][6]);

  it("MarbleBon is 1 at level 0, else 1.5 + 0.5 x level", () => {
    expect(Holes2(fountain(1, 13, { level: 0 }), "Fountain_MarbleBon", 1, 13)).toBe(1);
    expect(Holes2(fountain(1, 13, { level: 4 }), "Fountain_MarbleBon", 1, 13)).toBe(3.5);
    expect(Holes2(fountain(0, 0, { level: 1 }), "Fountain_MarbleBon", 0, 0)).toBe(2);
  });
  it("MarbleBon: a level the save has no entry for is not 0 in N.js (loose ==), so 1.5 + 0.5 x asNumber(null) = 1.5", () => {
    const c = variant((d) => setIn(d, "Holes", (h) => (h[32][1].length = 13)));
    expect(Holes2(c, "Fountain_MarbleBon", 1, 13)).toBe(1.5);
  });
  it("BonTOT is round(MarbleBon x Holes[31][b][e] x HoleFountUPG[b][e][6])", () => {
    expect(upg6(1, 13)).toBe(1);
    expect(Holes2(fountain(1, 13, { level: 4, amount: 10 }), "Fountain_BonTOT", 1, 13)).toBe(35);
    expect(Holes2(fountain(1, 13, { level: 4, amount: 11 }), "Fountain_BonTOT", 1, 13)).toBe(39); // 38.5 rounds up
    expect(Holes2(fountain(1, 13, { level: 0, amount: 100 }), "Fountain_BonTOT", 1, 13)).toBe(100);
    expect(Holes2(fountain(2, 19, { level: 0, amount: 7 }), "Fountain_BonTOT", 2, 19)).toBe(Math.round(7 * upg6(2, 19)));
  });
  it("an amount the save has no entry for is asNumber(null) = 0", () => {
    const c = variant((d) => setIn(d, "Holes", (h) => (h[31][1].length = 13)));
    expect(Holes2(c, "Fountain_BonTOT", 1, 13)).toBe(0);
  });
  it("a missing row of Holes[31] or Holes[32] is refused whichever entry is asked (the cache fill indexes all 3 fountains)", () => {
    expect(() => Holes2(fountain(2, 0, { cutRows: 2 }), "Fountain_BonTOT", 2, 0)).toThrow(MissingSaveKey);
    expect(() => Holes2(fountain(0, 0, { cutRows: 2 }), "Fountain_BonTOT", 0, 0)).toThrow(MissingSaveKey); // row 2 is not the one asked
    const noMarbles = variant((d) => setIn(d, "Holes", (h) => (h[32].length = 2)));
    expect(() => Holes2(noMarbles, "Fountain_BonTOT", 1, 13)).toThrow(MissingSaveKey);
  });
  it("only the 3 fountains x 20 upgrades the cache fill covers; the cache rebuild (b == -1) and the rest throw NotPorted", () => {
    const c = variant(() => {});
    for (const [b, e] of [[-1, 0], [3, 0], [0, 20], [0, -1], [1.5, 2]]) expect(() => Holes2(c, "Fountain_BonTOT", b, e), `(${b}, ${e})`).toThrow(expect.objectContaining({ name: "NotPorted", sub: `Fountain_BonTOT:b=${b},e=${e}` }));
    expect(() => Holes2(c, "JarRupieTypeGiven", 0, 0)).toThrow(NotPorted);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const expected = njsCalls(njsNamedBlocks(njsFunction(loadNjs(), "Holes2")!.body, "Fountain_BonTOT").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = fountain(1, 13, { level: 4, amount: 10, trace: true });
    Holes2(c, "Fountain_BonTOT", 1, 13);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("Holes MonumentROGbonuses (N.js @11014436)", () => {
  // The monument (b, e): HolesInfo[37][10b + e] picks the shape; Holes[15][10b + e] is its level; the multiplier is
  // 1 + (monument (b, 9) + Cosmo upgrade (0, 0)) / 100, times the fountain 1 + F(b, 13) / 100 for b < 3. HolesInfo[37] (static):
  // [0]='2' [9]='250' [12]='500' [19]='250' [29]='250'.
  const monument = (o: { h15?: Record<number, number>; fountain?: Record<number, number>; cosmo?: number; trace?: boolean }) =>
    variant(
      (d) =>
        setIn(d, "Holes", (h) => {
          h[4][0] = o.cosmo ?? 0;
          for (const [i, v] of Object.entries(o.h15 ?? {})) h[15][Number(i)] = v;
          for (const b of [0, 1, 2]) {
            h[32][b][13] = 0; // marble bonus 1
            h[31][b][13] = o.fountain?.[b] ?? 0;
          }
        }),
      { trace: o.trace }
    );
  const term = (c: Ctx, b = 1, e = 2) => Holes(c, "MonumentROGbonuses", b, e);

  it("(1, 9) alone is the soft-capped shape .1 x ceil(10 x L/(250+L) x 250 x max(1, 1 + F/100))", () => {
    expect(term(monument({ h15: { 19: 250 }, fountain: { 1: 100 } }), 1, 9)).toBeCloseTo(250, 9); // .1 x ceil(10 x .5 x 250 x 2)
    expect(term(monument({ h15: { 19: 250 }, fountain: { 1: 0 } }), 1, 9)).toBeCloseTo(125, 9); // .1 x ceil(10 x .5 x 250 x 1)
  });
  it("(1, 2): the multiplier is 1 + (1,9)/100, then x (1 + F(1,13)/100); the result is .1 x ceil(10 x L/(250+L) x 500 x that)", () => {
    // (1,9) = 250 -> 1 + 2.5 = 3.5; x 2 = 7; .1 x ceil(10 x .5 x 500 x 7) = 1750
    expect(term(monument({ h15: { 19: 250, 12: 250 }, fountain: { 1: 100 } }))).toBeCloseTo(1750, 9);
    // F = 50: (1,9) = .1 x ceil(10 x .5 x 250 x 1.5) = 187.5 -> 2.875; x 1.5 = 4.3125; .1 x ceil(10781.25) = 1078.2
    expect(term(monument({ h15: { 19: 250, 12: 250 }, fountain: { 1: 50 } }))).toBeCloseTo(1078.2, 9);
  });
  it("adds the Cosmo upgrade (0, 0) / 100 to the multiplier before the fountain", () => {
    // Holes[4][0] = 4 -> floor(25 x 4) = 100 -> +1: 3.5 + 1 = 4.5; x 2 = 9; .1 x ceil(10 x .5 x 500 x 9) = 2250
    expect(term(monument({ h15: { 19: 250, 12: 250 }, fountain: { 1: 100 }, cosmo: 4 }))).toBeCloseTo(2250, 9);
  });
  it("(0, 0) takes the small-shape branch (HolesInfo[37][0] = 2 < 30): level x 2 x max(1, multiplier)", () => {
    expect(term(monument({ h15: { 0: 7, 9: 0 } }), 0, 0)).toBe(14);
    // with a fountain: (0,9) = 0, so the multiplier is 1 and then x (1 + F/100): 7 x 2 x 2
    expect(term(monument({ h15: { 0: 7, 9: 0 }, fountain: { 0: 100 } }), 0, 0)).toBe(28);
  });
  it("each monument b < 3 uses its own fountain column F(b, 13)", () => {
    expect(term(monument({ h15: { 29: 250 }, fountain: { 2: 100 } }), 2, 9)).toBeCloseTo(250, 9);
    expect(term(monument({ h15: { 29: 250 }, fountain: { 1: 100 } }), 2, 9)).toBeCloseTo(125, 9); // the fountain of another b does not count
  });
  it("a level the save has no entry for is asNumber(null) = 0", () => {
    const c = variant((d) => setIn(d, "Holes", (h) => (h[15].length = 12)));
    expect(term(c, 1, 2)).toBe(0); // .1 x ceil(0)
  });
  it("a save without Holes[15] is refused", () => {
    expect(() => term(variant((d) => setIn(d, "Holes", (h) => (h[15] = null))))).toThrow(MissingSaveKey);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const expected = njsCalls(njsNamedBlocks(njsFunction(loadNjs(), "Holes")!.body, "MonumentROGbonuses").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = monument({ h15: { 19: 250, 12: 250 }, fountain: { 1: 100 }, trace: true });
    term(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("ArcadeBonus 32 and 66 (N.js @7881530)", () => {
  // both are `decay` curves: 50 x L / (L + 100) and 60 x L / (L + 100)
  // OLA[606] holds Pet-Bonus Tokens that would activate companions: empty it
  const noTokens = (d: Data) => setIn(d, "OptLacc", (o) => (o[606] = ""));
  const at = (d: number, level: number, companions: string[] = [], trace = false) =>
    variant((x) => (setIn(x, "ArcadeUpg", (a) => (a[d] = level)), noTokens(x)), { env: (e) => (e.companion = { l: companions }), trace });

  it("32 and 66 are 50 and 60 x L / (L + 100) at level L", () => {
    expect(ArcadeBonus(at(32, 100), 32)).toBeCloseTo(25, 12);
    expect(ArcadeBonus(at(66, 100), 66)).toBeCloseTo(30, 12);
    expect(ArcadeBonus(at(32, 0), 32)).toBe(0);
  });
  it("level 101 doubles it, 102 makes it x 6 (the raw element is compared, loosely)", () => {
    expect(ArcadeBonus(at(32, 101), 32)).toBeCloseTo((2 * 50 * 101) / 201, 12);
    expect(ArcadeBonus(at(66, 102), 66)).toBeCloseTo((6 * 60 * 102) / 202, 12);
  });
  it("Companion 27 doubles it again, and only an owned one does", () => {
    expect(ArcadeBonus(at(32, 100, ["27,1,0,5,0"]), 32)).toBeCloseTo(50, 12);
    expect(ArcadeBonus(at(32, 101, ["27,1,0,5,0"]), 32)).toBeCloseTo((4 * 50 * 101) / 201, 12);
    expect(Companions(at(32, 100, ["43,1,0,5,0"]), 27)).toBe(0);
    expect(ArcadeBonus(at(32, 100, ["43,1,0,5,0"]), 32)).toBeCloseTo(25, 12);
  });
  it("an upgrade level the list has no entry for is asNumber(null) = 0", () => {
    const c = variant((x) => (setIn(x, "ArcadeUpg", (a) => (a.length = 32)), noTokens(x)), { env: (e) => (e.companion = { l: [] }) });
    expect(ArcadeBonus(c, 32)).toBe(0);
  });
  it.skipIf(noNjs)("calls what N.js calls (the whole function: Companions 27 and the curve)", () => {
    const expected = njsCalls(njsFunction(loadNjs(), "ArcadeBonus")!.body);
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = at(32, 100, [], true);
    ArcadeBonus(c, 32);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("Dreamstuff CloudBonus (N.js @10810155)", () => {
  const cloud = (v: unknown, b = 71) => Dreamstuff(variant((d) => setIn(d, "WeeklyBoss", (w) => (w[`d_${b}`] = v))), "CloudBonus", b);
  it("is 1 while the cloud's boss is undefeated (-1), else 0", () => {
    expect(cloud(-1)).toBe(1);
    expect(cloud(62)).toBe(0);
    expect(cloud(0)).toBe(0);
  });
  it("compares loosely, like `-1 == x`", () => {
    expect(cloud("-1")).toBe(1);
  });
  it("a boss the map has no entry for is 0", () => {
    const c = variant((d) => setIn(d, "WeeklyBoss", (w) => delete w.d_72));
    expect(Dreamstuff(c, "CloudBonus", 72)).toBe(0);
  });
  it("reads d_<b> for the b asked", () => {
    const c = variant((d) => setIn(d, "WeeklyBoss", (w) => ((w.d_71 = -1), (w.d_76 = 3))));
    expect(Dreamstuff(c, "CloudBonus", 71)).toBe(1);
    expect(Dreamstuff(c, "CloudBonus", 76)).toBe(0);
  });
  it("a save without WeeklyBoss is refused", () => {
    expect(() => Dreamstuff(variant((d) => delete d.WeeklyBoss), "CloudBonus", 71)).toThrow(MissingSaveKey);
  });
  it("the other sub-cases are not ported", () => {
    for (const d of ["CloudX", "UpgUnlocked", "Nope"]) expect(() => Dreamstuff(variant(() => {}), d, 1), d).toThrow(NotPorted);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("ResearchStuff Grid_Bonus, e == 0 (N.js @11177849) and Grid_Bonus_Allmulti (@11179174)", () => {
  /** The grid square b at level `lv`, with upgrade selector `sel` (Research[1][b]); the multi's inputs are set apart. */
  const grid = (b: number, lv: number, sel: unknown, o: { r173?: number; lv14?: number; bosses?: [number, number, number]; companions?: string[]; trace?: boolean } = {}) =>
    variant(
      (d) => {
        setIn(d, "Research", (r) => ((r[0][b] = lv), (r[1][b] = sel), (r[0][173] = o.r173 ?? 0)));
        setIn(d, "WeeklyBoss", (w) => ((w.d_71 = o.bosses?.[0] ?? 7), (w.d_72 = o.bosses?.[1] ?? 7), (w.d_76 = o.bosses?.[2] ?? 7)));
        setIn(d, "OptLacc", (x) => (x[606] = ""));
        setIn(d, "Lv0_0", (l) => (l[14] = o.lv14 ?? 5));
      },
      { env: (e) => (e.companion = { l: o.companions ?? [] }), trace: o.trace }
    );
  const square = (b: number) => Number((ResGridSquares as any)[b][2]);
  const multi = (c: Ctx) => ResearchStuff(c, "Grid_Bonus_Allmulti", 0, 0);

  it("Allmulti is 1 + (Companions 55 + 5 x min(1, Research[0][173] x Companions 0) + the clouds 71, 72, 76 + Sushi 53) / 100", () => {
    const quiet = grid(109, 1, -1);
    const base = 1 + SushiStuff(quiet, "RoG_BonusQTY", 53, 0) / 100;
    expect(multi(quiet)).toBeCloseTo(base, 12);
    // each undefeated cloud boss (-1) adds 1
    expect(multi(grid(109, 1, -1, { bosses: [-1, 7, 7] }))).toBeCloseTo(base + 1 / 100, 12);
    expect(multi(grid(109, 1, -1, { bosses: [-1, -1, -1] }))).toBeCloseTo(base + 3 / 100, 12);
    // Companion 55 adds its bonus
    const c55 = grid(109, 1, -1, { companions: ["55,1,0,5,0"] });
    expect(multi(c55)).toBeCloseTo(base + Companions(c55, 55) / 100, 12);
    expect(Companions(c55, 55)).toBeGreaterThan(0);
  });
  it("the grid-173 term is 5 x min(1, level x Companions 0): 0 without the companion, capped at 5 with it", () => {
    const base = multi(grid(109, 1, -1));
    expect(multi(grid(109, 1, -1, { r173: 3 }))).toBeCloseTo(base, 12); // Companions(0) = 0: not owned
    const owned = grid(109, 1, -1, { r173: 3, companions: ["0,1,0,5,0"] });
    expect(Companions(owned, 0)).toBeGreaterThan(0);
    expect(multi(owned)).toBeCloseTo(base + 5 / 100, 12); // min(1, 3 x C0) = 1 when 3 x C0 >= 1
    // Companion 0 also needs the character at Lv0[14] >= 2 (Companions @10799980): at 1 the term is gone
    const young = grid(109, 1, -1, { r173: 3, companions: ["0,1,0,5,0"], lv14: 1 });
    expect(Companions(young, 0)).toBe(0);
    expect(multi(young)).toBeCloseTo(base, 12);
  });
  it("selector -1: square value x level x max(1, Allmulti)", () => {
    const c = grid(109, 4, -1);
    expect(square(109)).toBe(25);
    expect(ResearchStuff(c, "Grid_Bonus", 109, 0)).toBeCloseTo(25 * 4 * Math.max(1, multi(c)), 9);
    expect(ResearchStuff(grid(109, 0, -1), "Grid_Bonus", 109, 0)).toBe(0);
  });
  it("any other selector k also multiplies by 1 + CustomLists.Research[5][k] / 100", () => {
    const pct = (k: number) => Number((Research as any)[5][k]);
    expect(pct(3)).toBe(20);
    const c = grid(106, 4, 3);
    expect(ResearchStuff(c, "Grid_Bonus", 106, 0)).toBeCloseTo(square(106) * 4 * (1 + 20 / 100) * Math.max(1, multi(c)), 9);
  });
  it("a null selector is not -1 in N.js (loose ==): it reads Research[5][asNumber(null)] = Research[5][0]", () => {
    const c = grid(106, 4, null);
    expect(ResearchStuff(c, "Grid_Bonus", 106, 0)).toBeCloseTo(square(106) * 4 * (1 + 25 / 100) * Math.max(1, multi(c)), 9);
  });
  it("the e == 1 path (the level itself) is untouched, and e == 0 and e == 1 are different numbers", () => {
    const c = grid(109, 4, -1);
    expect(ResearchStuff(c, "Grid_Bonus", 109, 1)).toBe(4);
    expect(ResearchStuff(c, "Grid_Bonus", 109, 0)).not.toBe(4);
  });
  it("e == 2 for the grid squares 67, 68, 107 is the e == 0 value x Research[11].length", () => {
    for (const b of [67, 68, 107]) {
      const c = variant((d) => setIn(d, "Research", (r) => ((r[0][b] = 2), (r[1][b] = -1), (r[11] = [1, 2, 3, 4, 5, 6, 7]))));
      expect(ResearchStuff(c, "Grid_Bonus", b, 2), `b=${b}`).toBeCloseTo(ResearchStuff(c, "Grid_Bonus", b, 0) * 7, 9);
    }
    const c = variant((d) => setIn(d, "Research", (r) => (r[11] = null)));
    expect(() => ResearchStuff(c, "Grid_Bonus", 68, 2)).toThrow(MissingSaveKey); // the game reads .length of it
  });
  it("e == 2 for every other square is not ported (31, 94, 112, 151, 168 have formulas of their own)", () => {
    for (const b of [31, 94, 112, 151, 168, 109]) expect(() => ResearchStuff(variant(() => {}), "Grid_Bonus", b, 2), `b=${b}`).toThrow(NotPorted);
  });
  it("a square the game's data does not have throws, as ResGridSquares[b][2] would", () => {
    expect(() => ResearchStuff(variant(() => {}), "Grid_Bonus", 99999, 0)).toThrow(RangeError);
  });
  it("a save without the selectors row, or without Research, is refused", () => {
    expect(() => ResearchStuff(variant((d) => setIn(d, "Research", (r) => (r[1] = null))), "Grid_Bonus", 109, 0)).toThrow(MissingSaveKey);
    expect(() => ResearchStuff(variant((d) => delete d.Research), "Grid_Bonus", 109, 0)).toThrow(MissingSaveKey);
  });
  it("the sub-cases only the other squares reach are not ported", () => {
    for (const d of ["TotalObsLVs", "TotalOccurrencesFound", "OccurrencesToBeFound", "AFKgainsRatePCT"]) expect(() => ResearchStuff(variant(() => {}), d, 0, 0), d).toThrow(NotPorted);
  });
  it.skipIf(noNjs)("calls what N.js calls (Grid_Bonus e == 0 path, and Allmulti)", () => {
    const fn = njsFunction(loadNjs(), "ResearchStuff")!;
    const whole = njsNamedBlocks(fn.body, "Grid_Bonus").join("\n");
    const tail = whole.slice(whole.indexOf('-1==a.engine.getGameAttribute("Research")[1]')); // the e == 0 path: the end of the chain
    const expected = njsCalls(tail);
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = grid(109, 4, -1, { trace: true });
    ResearchStuff(c, "Grid_Bonus", 109, 0);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
    const expectedMulti = njsCalls(njsNamedBlocks(fn.body, "Grid_Bonus_Allmulti").join("\n"));
    expect(expectedMulti.length).toBeGreaterThan(0);
    expect(callDiff(expectedMulti, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("FarmingStuffs StickerBonus (N.js @10819923)", () => {
  // StickerBonus(b, e) = (1 + (Grid 68,2 + 30 x EventShop 37) / 100) x (1 + 20 x SuperBit 62 / 100) x Research[9][b] x CustomLists.Research[25][b],
  // but 0 for b = 1 or 2 in the slot the Menagerie unlock 22 does not choose: e = 99 without the unlock, e = 100 with it.
  const sticker = (unlock22: number | null, o: { slot?: number[]; r9?: number; grid68?: number; trace?: boolean; noMenagerie?: boolean } = {}) =>
    variant(
      (d) => {
        if (o.noMenagerie) delete d.Menagerie;
        else if (unlock22 !== null) setIn(d, "Menagerie", (m) => (m[2][22] = unlock22));
        setIn(d, "Research", (r) => {
          for (const b of [0, 1, 2]) r[9][b] = o.r9 ?? 3;
          if (o.grid68 !== undefined) r[0][68] = o.grid68;
        });
      },
      { trace: o.trace }
    );
  const sticker2 = (c: Ctx, e: number, b = 2) => FarmingStuffs(c, "StickerBonus", b, e);
  /** The three factors, computed by the ported callees: the combination is what is tested here. */
  const factor = (c: Ctx) => (1 + (ResearchStuff(c, "Grid_Bonus", 68, 2) + 30 * Summoning(c, "EventShopOwned", 37, 0)) / 100) * (1 + (20 * GamingStatType(c, "SuperBitType", 62, 0)) / 100);
  const research25 = (b: number) => Number((Research as any)[25][b]);

  it("sticker 2 sits in exactly one slot: 99 without Menagerie unlock 22, 100 with it, never both", () => {
    const without = sticker(0);
    expect(sticker2(without, 99)).toBeGreaterThan(0);
    expect(sticker2(without, 100)).toBe(0);
    const owned = sticker(1);
    expect(sticker2(owned, 99)).toBe(0);
    expect(sticker2(owned, 100)).toBeGreaterThan(0);
    for (const c of [sticker(0), sticker(1), sticker(2)]) expect([99, 100].filter((e) => sticker2(c, e) > 0)).toHaveLength(1);
  });
  it("the slot holds factor x Research[9][2] x CustomLists.Research[25][2]", () => {
    const c = sticker(0, { r9: 3 });
    expect(research25(2)).toBe(15);
    expect(sticker2(c, 99)).toBeCloseTo(factor(c) * 3 * 15, 9);
    const owned = sticker(1, { r9: 3 });
    expect(sticker2(owned, 100)).toBeCloseTo(factor(owned) * 3 * 15, 9);
  });
  it("the Boony Crowns grid square (68, e = 2) lifts the factor by its value", () => {
    const flat = sticker(0, { grid68: 0 });
    const lifted = sticker(0, { grid68: 5 });
    expect(ResearchStuff(lifted, "Grid_Bonus", 68, 2)).toBeGreaterThan(0);
    expect(sticker2(lifted, 99) / sticker2(flat, 99)).toBeCloseTo(factor(lifted) / factor(flat), 9);
    expect(sticker2(lifted, 99)).toBeGreaterThan(sticker2(flat, 99));
  });
  it("an empty Menagerie list reads as unlock 0 (slot 99)", () => {
    const c = variant((d) => (d.Menagerie = []));
    expect(sticker2(c, 99)).toBeGreaterThan(0);
    expect(sticker2(c, 100)).toBe(0);
  });
  it("a save below CSver 34 has no Menagerie: the game's own lists give unlock 0 (slot 99), and the state says which load steps ran", () => {
    const c = variant((d) => { delete d.Menagerie; d.CSver = 33.05; });
    expect(sticker2(c, 99)).toBeGreaterThan(0);
    expect(sticker2(c, 100)).toBe(0);
    expect(c.state.migrations).toEqual(["Menagerie = [] (loader: CSver < 34 @19944986, init @6586152)", "Menagerie filled (initialize4 @6336662)"]);
  });
  it("sticker 1 follows the same rule; any other sticker (b = 0) has no slot rule", () => {
    const c = sticker(0);
    expect(sticker2(c, 99, 1)).toBeGreaterThan(0);
    expect(sticker2(c, 100, 1)).toBe(0);
    expect(sticker2(sticker(1), 99, 1)).toBe(0);
    expect(sticker2(c, 99, 0)).toBeGreaterThan(0);
    expect(sticker2(c, 100, 0)).toBeCloseTo(sticker2(c, 99, 0), 12);
  });
  it("an e that is neither 99 nor 100 is not a slot: the value", () => {
    const c = sticker(1);
    expect(sticker2(c, 5)).toBeCloseTo(factor(c) * 3 * 15, 9);
  });
  it("the unlock is only read when the slot rule needs it (&& short-circuits), as in N.js", () => {
    const noMenagerie = sticker(null, { noMenagerie: true });
    expect(sticker2(noMenagerie, 99, 0)).toBeGreaterThan(0); // b = 0: no slot rule
    expect(sticker2(noMenagerie, 5)).toBeGreaterThan(0); // e is no slot
    expect(() => sticker2(noMenagerie, 99)).toThrow(MissingSaveKey);
    expect(() => sticker2(noMenagerie, 100)).toThrow(MissingSaveKey);
  });
  it("a Research[9] entry the save lacks is asNumber(null) = 0", () => {
    const c = variant((d) => setIn(d, "Research", (r) => (r[9].length = 2)));
    expect(sticker2(c, 99)).toBe(0);
    expect(() => sticker2(variant((d) => setIn(d, "Research", (r) => (r[9] = null))), 99)).toThrow(MissingSaveKey);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const expected = njsCalls(njsNamedBlocks(njsFunction(loadNjs(), "FarmingStuffs")!.body, "StickerBonus").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = sticker(0, { trace: true });
    sticker2(c, 99);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("FarmingStuffs ExoticBonusQTY (N.js @10830602)", () => {
  // the market upgrade e, with F = FarmUpg[20 + e]: MarketExoticInfo[e][3] x F / (1000 + F) when [e][4] is 1, else [e][3] x F;
  // doubled when Spelunk[50] lists e; the upgrade 39 is capped at 50
  const exotic = (e: number, o: { f?: number; spelunk50?: unknown; cutFarm?: number; trace?: boolean } = {}) =>
    variant(
      (d) => {
        setIn(d, "FarmUpg", (f) => {
          if (o.f !== undefined) f[20 + e] = o.f;
          if (o.cutFarm !== undefined) f.length = o.cutFarm;
        });
        if ("spelunk50" in o) setIn(d, "Spelunk", (s) => (s[50] = o.spelunk50));
      },
      { trace: o.trace }
    );
  const term = (c: Ctx, e = 45) => FarmingStuffs(c, "ExoticBonusQTY", e, 0);
  const info = (e: number) => (MarketExoticInfo as any)[e] as string[];

  it("the 5 Leaf Clover (45) is 30 x F / (1000 + F)", () => {
    expect(info(45).slice(3, 5)).toEqual(["30", "1"]);
    expect(term(exotic(45, { f: 1000, spelunk50: [] }))).toBeCloseTo(15, 12);
    expect(term(exotic(45, { f: 0, spelunk50: [] }))).toBe(0);
    expect(term(exotic(45, { f: 3000, spelunk50: [] }))).toBeCloseTo(22.5, 12);
  });
  it("doubles when Spelunk[50] lists the upgrade (loose ==), and only then", () => {
    expect(term(exotic(45, { f: 1000, spelunk50: [3, 45, 9] }))).toBeCloseTo(30, 12);
    expect(term(exotic(45, { f: 1000, spelunk50: ["45"] }))).toBeCloseTo(30, 12); // "45" == 45
    expect(term(exotic(45, { f: 1000, spelunk50: [3, 46] }))).toBeCloseTo(15, 12);
  });
  it("Spelunk[50] missing from the list is nothing listed (D.contains(null) is false)", () => {
    expect(term(exotic(45, { f: 1000, spelunk50: null }))).toBeCloseTo(15, 12);
    const short = variant((d) => setIn(d, "Spelunk", (s) => ((s.length = 40), setIn(d, "FarmUpg", (f) => (f[65] = 1000)))));
    expect(term(short)).toBeCloseTo(15, 12);
  });
  it("an upgrade whose [4] is not 1 is linear: MarketExoticInfo[e][3] x F", () => {
    expect(info(41).slice(3, 5)).toEqual(["1", "0"]);
    expect(term(exotic(41, { f: 7, spelunk50: [] }), 41)).toBe(7);
    expect(term(exotic(41, { f: 7, spelunk50: [41] }), 41)).toBe(14);
  });
  it("the upgrade 39 is capped at 50 after the doubling", () => {
    expect(term(exotic(39, { f: 1e6, spelunk50: [39] }), 39)).toBe(50); // 2 x 30 x 1e6/1001000 = 59.9
    expect(term(exotic(39, { f: 1e6, spelunk50: [] }), 39)).toBeCloseTo((30 * 1e6) / 1001000, 12); // under the cap
  });
  it("a FarmUpg entry the save lacks is asNumber(null) = 0, shown in the trace", () => {
    const c = exotic(45, { cutFarm: 65, spelunk50: [], trace: true });
    expect(term(c)).toBe(0);
    expect(JSON.stringify(c.trace)).toContain("FarmUpg[65]");
  });
  it("saves without FarmUpg or Spelunk are refused", () => {
    expect(() => term(variant((d) => delete d.FarmUpg))).toThrow(MissingSaveKey);
    expect(() => term(variant((d) => delete d.Spelunk))).toThrow(MissingSaveKey);
  });
  it("only the 80 upgrades the cache fill makes; the total (99), the rebuild (-1) and the rest throw NotPorted", () => {
    const c = variant(() => {});
    for (const b of [99, -1, 80, 45.5]) expect(() => term(c, b), `b=${b}`).toThrow(NotPorted);
    expect(() => FarmingStuffs(c, "GrowthReq", 0, 0)).toThrow(NotPorted);
  });
});

// ── the sticker slot forced on every save ───────────────────────────────────────────────────────
// No real save owns Menagerie unlock 22, so the real loop above sees sticker2mult = 0 everywhere and never the slot swap. Here the unlock
// is forced on a fresh clone of every save that has a Menagerie, and the game is compared with lib/arkh on that same forced object.
describe.skipIf(GOLDEN_SAVES.length === 0)("Menagerie unlock 22 forced on every real save, against lib/arkh", () => {
  it("sticker2add falls to 0 and sticker2mult takes the value", () => {
    const t0 = performance.now();
    const mismatches: string[] = [];
    const seenMult = new Set<number>();
    let pairs = 0;
    let swapped = 0;
    const refusedForced: string[] = [];
    for (const path of GOLDEN_SAVES) {
      const env = JSON.parse(readFileSync(path, "utf8"));
      if (env.data.Menagerie === undefined) continue; // pre-34: the game ignores the key there, there is no unlock to force
      setIn(env.data, "Menagerie", (m) => (m[2][22] = 1));
      const ctx = gameCtx(env, 0);
      for (let ci = 0; ci < env.charNames.length; ci++) {
        const c = withPlayer(ctx, ci);
        for (const [id, e] of [["sticker2add", 99], ["sticker2mult", 100]] as const) {
          if (KNOWN_ARKH_DIFFS.some((d) => d.save === basename(path) && (d.ci ?? ci) === ci && d.source === id)) continue;
          let got: number;
          try {
            got = FarmingStuffs(c, "StickerBonus", 2, e);
          } catch (err) {
            if (!(err instanceof MissingSaveKey)) throw err;
            refusedForced.push(`${basename(path)}: ${err.key}`);
            continue;
          }
          const want = arkhArtifactLeaf(env, ci, id);
          pairs++;
          if (id === "sticker2mult") seenMult.add(want);
          if (id === "sticker2add" && got === 0) swapped++;
          if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci} ${id}: game ${got}, arkh ${want}`);
        }
      }
    }
    console.info(`[account sticker slot forced] ${pairs} pairs checked, ${mismatches.length} mismatches, ${seenMult.size} distinct sticker2mult, ${swapped} sticker2add at 0, ${Math.round(performance.now() - t0)} ms`);
    expect(mismatches).toEqual([]);
    expect(pairs).toBeGreaterThan(1000); // a loop over nothing would pass
    expect(seenMult.size).toBeGreaterThan(5); // nor would a value that is the same everywhere
    expect(swapped).toBeGreaterThan(500); // sticker2add really is the slot that went to 0
    expect(refusedForced).toEqual([]); // every save that has a Menagerie has what the sticker reads
  }, 300_000);
});

// ── the proven lib/arkh difference (KNOWN_ARKH_DIFFS) ───────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("Koweabooo#10: Companions(0) needs Lv0[14] >= 2 (N.js @10799980), lib/arkh has no such gate", () => {
  const path = GOLDEN_SAVES.find((p) => basename(p) === "Koweabooo.json");
  /** Koweabooo as saved (lv null) or with the character's Lv0[14] set to `lv`. */
  const at = (lv: number | null) => {
    const env = JSON.parse(readFileSync(path!, "utf8"));
    if (lv !== null) setIn(env.data, "Lv0_10", (l) => (l[14] = lv));
    return gameCtx(env, 10);
  };
  it.skipIf(!path)("the character is at Lv0[14] = 1, where the game's Companion 0 is 0", () => {
    expect(Companions(at(null), 0)).toBe(0);
    expect(Companions(at(2), 0)).toBeGreaterThan(0);
  });
  it.skipIf(!path)("with Lv0[14] raised to 2 the terms equal lib/arkh's, which ignores it; as saved, the game is lower", () => {
    const c = at(2);
    expect(rel(ResearchStuff(c, "Grid_Bonus", 109, 0), arkhArtifactLeaf(path!, 10, "grid109"))).toBe(true);
    expect(rel(ResearchStuff(c, "Grid_Bonus", 106, 0), arkhArtifactLeaf(path!, 10, "grid106"))).toBe(true);
    expect(rel(FarmingStuffs(c, "StickerBonus", 2, 99), arkhArtifactLeaf(path!, 10, "sticker2add"))).toBe(true);
    expect(ResearchStuff(at(null), "Grid_Bonus", 109, 0)).toBeLessThan(arkhArtifactLeaf(path!, 10, "grid109"));
  });
});

describe("ports stay on their boundary", () => {
  const c = () => gameCtx({ data: {}, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 }, 0);
  it("Holes / Holes2 / FarmingStuffs / Dreamstuff / ResearchStuff: only the ported sub-cases", () => {
    expect(() => Holes(c(), "VillagersOwned", 0, 0)).toThrow(NotPorted);
    expect(() => Holes2(c(), "JarRupieTypeGiven", 0, 0)).toThrow(NotPorted);
    expect(() => FarmingStuffs(c(), "GrowthReq", 0, 0)).toThrow(NotPorted);
    expect(() => Dreamstuff(c(), "CloudX", 1)).toThrow(NotPorted);
    expect(() => ResearchStuff(c(), "AFKgainsRatePCT", 0, 0)).toThrow(NotPorted);
    expect(() => ResearchStuff(c(), "Grid_Bonus", 168, 2)).toThrow(NotPorted);
  });
  // variant() edits a real save, so this needs the private saves (absent in CI)
  it.skipIf(!BASE)("InvalidSaveValue is the answer for a list that is not a list", () => {
    const bad = variant((d) => (d.Holes = 5));
    expect(() => Holes(bad, "B_UPG", 55, 0)).toThrow(InvalidSaveValue);
  });
});
