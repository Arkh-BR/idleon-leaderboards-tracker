// Task 8: the W7 systems and the DNSM caches of Sailing("BoatArtiMulti", 0): button3, sushi7, jelly19, mainframe14, loreEpi3, pristine2,
// palette5, spelunkBit26, starSign61, vialTurtle. Each term is the expression as BoatArtiMulti @10700072 uses it (before the /100 of a
// `pct` group), compared with lib/arkh over every real save and every character; then one synthetic edge at a time on a real envelope.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, UNPORTED_REFUSALS, arkhArtifactLeaf, gameCtx } from "../support/arkhOracle";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { IncompleteTome, InvalidSaveValue, MissingSaveKey, NotPorted } from "@/lib/game/errors";
import { ChipDesc as ChipDescData, LabMainBonus, NinjaInfo, Number2Letter, Spelunky, UpgradeVault } from "@/lib/game/data";
const ChipDesc = ChipDescData as unknown as string[][];
import { listAt } from "@/lib/game/lists";
import { Breeding } from "@/lib/game/njs/Breeding";
import { CauldronStats } from "@/lib/game/njs/CauldronStats";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { Companions } from "@/lib/game/njs/Companions";
import { DNSM_AlchVials, DNSM_StarSigns, DNSM_TomeQTYtot } from "@/lib/game/njs/DNSM";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { Minehead } from "@/lib/game/njs/Minehead";
import { Ninja } from "@/lib/game/njs/Ninja";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { RiftStuff } from "@/lib/game/njs/RiftStuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Summoning } from "@/lib/game/njs/Summoning";
import { Summoning2 } from "@/lib/game/njs/Summoning2";
import { Thingies } from "@/lib/game/njs/Thingies";
import { callDiff, njsCalls, njsFunction, njsNamedBlocks, njsNumericBranch, njsSlice, traceCalls } from "@/lib/diagnose/njsCalls";
import { computeTome } from "@/lib/tome/compute";
import { loadNjs } from "@/scripts/njs-calls";

// The terms, written the way BoatArtiMulti writes them. spelunkBit26 is the factor inside `Math.max(1, …)` (the group applies the
// max); its `.length` is a raw read of Spelunk[6], so a save without that list is refused.
type Term = { term: (c: Ctx) => number; minSeen: number };
const TERMS: Record<string, Term> = {
  button3: { term: (c) => Minehead(c, "Button_Bonuses", 3, 0), minSeen: 5 },
  sushi7: { term: (c) => SushiStuff(c, "RoG_BonusQTY", 7, 0), minSeen: 1 }, // 0 or 30 on every real save
  jelly19: { term: (c) => JellyOperation(c, "RoG_BonusQTY", 19, 0), minSeen: 1 }, // 0 or 20
  mainframe14: { term: (c) => MainframeBonus(c, 14), minSeen: 0 }, // 50 on every real save: every one owns the 4 Emporium items
  loreEpi3: { term: (c) => Thingies(c, "LoreEpiBon", 3, 0), minSeen: 5 },
  pristine2: { term: (c) => Ninja(c, "PristineBon", 2, 0), minSeen: 1 }, // 0 or 40
  palette5: { term: (c) => GamingStatType(c, "PaletteBonus", 5, 0), minSeen: 5 },
  spelunkBit26: { term: (c) => Math.pow(1.02, listAt(c, "Spelunk", 6).length) * GamingStatType(c, "SuperBitType", 26, 0), minSeen: 5 },
  starSign61: { term: (c) => DNSM_StarSigns(c, "61"), minSeen: 3 }, // the real saves wear or enable it nearly everywhere: 0, 15 x Seraph in a few values; the forced loops below vary it
  vialTurtle: { term: (c) => DNSM_AlchVials(c, "6turtle"), minSeen: 5 },
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
// steps (lib/game/migrations): Menagerie below CSver 34, the Spelunk lists Spelunk[47..53] (DoOnceREAL 380 and 395), the Royal Guardian
// lists of the Tome's rows 107..109 below CSver 33. So the refusals are the saves older than the steps ported, the same for every term
// (UNPORTED_REFUSALS), all below the current CSver (checked in the loop).
const CURRENT_CSVER = 34.05;

describe.skipIf(GOLDEN_SAVES.length === 0)("lib/game W7 and DNSM terms against lib/arkh on every real save and character", () => {
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
      console.info(`[w7 ${id}] ${pairs} pairs checked, ${mismatches.length} mismatches, ${refused.size} save/key refusals, ${seen.size} distinct values, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches).toEqual([]);
      expect(pairs).toBeGreaterThan(100); // a loop over nothing would pass
      expect(seen.size).toBeGreaterThan(minSeen); // nor would a term that is the same number everywhere
      expect([...refused].sort()).toEqual(UNPORTED_REFUSALS);
      for (const r of refused) expect(csverOf(r.split(": ")[0]), `${r} is pre-migration`).toBeLessThan(CURRENT_CSVER);
    }, 300_000);
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
const noTokens = (d: Data) => setIn(d, "OptLacc", (o) => (o[606] = "")); // Pet-Bonus Tokens would activate companions

// ── Minehead ─────────────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("Minehead Button_Bonuses (N.js @11204738), Button_BonusPerTime (@11204526), Button_BonusMULTI (@11204610)", () => {
  // OptionsListAccount[594] buttons pressed; press f feeds slot floor(f / 5) mod 9 with PerTime(slot) x MULTI.
  // No companions and no Research[0][125]: MULTI is 1.
  const presses = (n: unknown, o: { trace?: boolean; grid125?: number } = {}) =>
    variant(
      (d) => {
        noTokens(d);
        setIn(d, "OptLacc", (x) => (x[594] = n));
        setIn(d, "Research", (r) => (r[0][125] = o.grid125 ?? 0));
      },
      { env: (e) => (e.companion = { l: [] }), trace: o.trace }
    );
  const button = (c: Ctx, b = 3) => Minehead(c, "Button_Bonuses", b, 0);

  it("PerTime is the game's list '2 3 2 2 4 5 4 25 5'", () => {
    const c = presses(0);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((b) => Minehead(c, "Button_BonusPerTime", b, 0))).toEqual([2, 3, 2, 2, 4, 5, 4, 25, 5]);
  });
  it("MULTI is (1 + Companion 147 / 100) x (1 + Grid_Bonus(125, 0) / 100)", () => {
    const c = presses(0, { grid125: 7 });
    expect(Minehead(c, "Button_BonusMULTI", 0, 0)).toBe((1 + Companions(c, 147) / 100) * (1 + ResearchStuff(c, "Grid_Bonus", 125, 0) / 100));
    expect(ResearchStuff(c, "Grid_Bonus", 125, 0)).toBeGreaterThan(0); // the grid really takes part
    expect(Minehead(presses(0, { grid125: 0 }), "Button_BonusMULTI", 0, 0)).toBe(1);
  });
  it("a slot is PerTime x MULTI for every press that falls on it: 5 presses a slot, 9 slots, then round again", () => {
    expect(button(presses(15))).toBe(0); // slots 0..2 only
    expect(button(presses(16))).toBe(2); // press 15 is the first of slot 3
    expect(button(presses(20))).toBe(10);
    expect(button(presses(60))).toBe(10); // slot 3 is done for this round
    expect(button(presses(65))).toBe(20); // presses 60..64 are slot 3 of the next round
    expect(button(presses(40), 7)).toBe(125); // slot 7: 5 x 25
    expect(button(presses(0))).toBe(0);
  });
  it("adds press by press, so the float sum is the game's, not n x PerTime x MULTI", () => {
    const c = presses(100, { grid125: 7 });
    const multi = Minehead(c, "Button_BonusMULTI", 0, 0);
    let seq = 0;
    for (let f = 0; f < 100; f++) if (Math.floor(f / 5) % 9 === 3) seq = seq + 2 * multi;
    expect(multi).not.toBe(1);
    expect(button(c)).toBe(seq);
  });
  it("a button count the save does not have (or that is not a number) is asNumber → 0 presses", () => {
    expect(button(presses(null))).toBe(0);
    expect(button(presses("30"))).toBe(10); // asNumber("30"): presses 15..19 are slot 3
  });
  it("only slots 0..8 exist, and only the ported sub-cases", () => {
    const c = presses(10);
    for (const b of [9, -1]) expect(() => button(c, b), `b=${b}`).toThrow(RangeError);
    expect(() => Minehead(c, "GlimboTotalTrades", 0, 0)).toThrow(NotPorted);
  });
  it("a save without OptionsListAccount is refused", () => {
    expect(() => button(variant((d) => delete d.OptLacc))).toThrow(MissingSaveKey);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const expected = njsCalls(njsNamedBlocks(njsFunction(loadNjs(), "Minehead")!.body, "Button_Bonuses").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = presses(20, { trace: true });
    button(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

// ── Ninja EmporiumBonus, MainframeBonus ──────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("Ninja EmporiumBonus (N.js @10845956) and MainframeBonus 10 and 14 (@7990420)", () => {
  const letter = (i: number) => String((Number2Letter as any)[i]);
  /** The Emporium string with the letters of `owned` items, in front of everything else; `Ninja[102][9]`. */
  const emporium = (items: number[], trace = false) =>
    variant((d) => setIn(d, "Ninja", (n) => (n[102][9] = items.map(letter).join(""))), { trace });
  const mf = (c: Ctx, d = 14) => MainframeBonus(c, d);

  it("EmporiumBonus b is 1 when Number2Letter[b] is in Ninja[102][9]", () => {
    const c = emporium([8, 10]);
    expect([8, 9, 10, 11].map((b) => Ninja(c, "EmporiumBonus", b, 0))).toEqual([1, 0, 1, 0]);
  });
  it("the lab bonus 14 is the first Emporium item owned of 8..11: 50 (Artifact Attraction), 25 (Slab Sovereignty), 50, 30, or none → 0", () => {
    const row = (i: number) => Number((NinjaInfo as any)[i][5]);
    expect(mf(emporium([8, 9, 10, 11]))).toBe(row(25)); // 50
    expect(mf(emporium([9, 10, 11]))).toBe(row(26)); // item 8 missing: bonus 14 is Slab Sovereignty's row
    expect(mf(emporium([10]))).toBe(row(27));
    expect(mf(emporium([11]))).toBe(row(28));
    expect(row(25)).toBe(50);
    expect(row(26)).toBe(25);
    expect(mf(emporium([]))).toBe(0); // d >= LabMainBonus.length and 99 > d
    expect(mf(emporium([8]))).toBe(50);
  });
  it("the base list has 14 bonuses (0..13), so 14 only exists through the Emporium", () => {
    expect((LabMainBonus as any).length).toBe(14);
  });
  it("bonus 10 (My 1st Chemistry Set) is 2, bonus 14 is 50, once connected; a bonus 14 that is not on the list never reads the connection", () => {
    const c = emporium([8, 9, 10, 11], true);
    expect(mf(c, 10)).toBe(Number((LabMainBonus as any)[10][5])); // 2
    expect(mf(c, 10)).toBe(2);
    expect(mf(emporium([], true), 14)).toBe(0);
  });
  it("the connection (the Laboratory's GenINFO[92], live) is a declared assumption (Ruling J): counted as connected, an `assumed:` leaf in the trace", () => {
    const c = emporium([8], true);
    expect(mf(c)).toBe(50);
    const leaf = c.trace!.children[0].children.find((n) => n.block === "GenINFO[92][14]");
    expect(leaf).toMatchObject({ value: 1, args: [] });
    expect(leaf!.note).toBe("assumed: lab node counted as connected (the game checks it live)"); // what a page shows
    expect(leaf!.detail).toMatch(/connection walk \(ActorEvents_548 @10069277\) is not ported/); // the full reason stays on the trace
    const none = emporium([], true);
    mf(none);
    expect(JSON.stringify(none.trace)).not.toContain("assumed"); // nothing to connect
    // and it is not an N.js call: it does not show among the calls the trace makes
    expect(traceCalls(c.trace!).map((x) => x.block)).not.toContain("GenINFO[92][14]");
  });
  it("a save without Ninja[102] is refused (the game indexes Ninja[102][9])", () => {
    expect(() => mf(variant((d) => setIn(d, "Ninja", (n) => (n[102] = null))))).toThrow(MissingSaveKey);
    expect(() => mf(variant((d) => delete d.Ninja))).toThrow(MissingSaveKey);
  });
  it("only bonuses 10 and 14 are ported", () => {
    const c = emporium([8, 9, 10, 11]);
    for (const d of [0, 3, 8, 9, 11, 13, 15, 100, 114]) expect(() => mf(c, d), `d=${d}`).toThrow(NotPorted);
    expect(() => Ninja(c, "NotASubcase", 0, 0)).toThrow(NotPorted);
  });
  it("MainframeBonus 10 and 14 call nothing but the Emporium (and the connection assumption)", () => {
    const c = emporium([8], true);
    mf(c);
    expect(traceCalls(c.trace!).map((x) => x.block)).toEqual(["MainframeBonus", "Ninja", "Ninja", "Ninja", "Ninja"]); // items 8..11
    const ten = emporium([8], true);
    mf(ten, 10);
    expect(traceCalls(ten.trace!).map((x) => x.block)).toEqual(["MainframeBonus", "Ninja", "Ninja", "Ninja", "Ninja"]);
  });
  it.skipIf(noNjs)("N.js has no branch of its own for bonuses 10 and 14, so the generic path (row [5] connected, [4] not) is what they execute", () => {
    const fn = njsFunction(loadNjs(), "MainframeBonus")!;
    expect(fn.body.length).toBeGreaterThan(1000);
    expect(njsNumericBranch(fn.body, 14, fn.params)).toBeUndefined();
    expect(njsNumericBranch(fn.body, 10, fn.params)).toBeUndefined();
    // while the bonuses that do have one (0, 3, 8, 9, 11, 13, 15, 17) are found, so the check is not blind
    for (const d of [0, 3, 9, 11]) expect(njsNumericBranch(fn.body, d, fn.params), `d=${d}`).toBeDefined();
  });
});

// ── Thingies LoreEpiBon ──────────────────────────────────────────────────────────────────────────
// The formula is checked at controlled Tome scores in loreEpi.test.ts (it mocks lib/tome); here the score is lib/tome's own.
describe.skipIf(GOLDEN_SAVES.length === 0)("Thingies LoreEpiBon (N.js @10974601) and DNSM.TomeQTYtot", () => {
  // Spelunky[21][3] = '100|3000': value 100, starts at 3000 Tome points. Spelunk[13][2] is how many lore episodes are unlocked.
  const lore = (o: { unlocked?: number; trace?: boolean; env?: (e: any) => void } = {}) =>
    variant((d) => setIn(d, "Spelunk", (s) => (s[13][2] = o.unlocked ?? 10)), { trace: o.trace, env: o.env });
  const term = (c: Ctx, b = 3) => Thingies(c, "LoreEpiBon", b, 0);
  const boost = (c: Ctx) => 1 + (Summoning(c, "GrimoireUpgBonus", 17, 0) + GetSetBonus(c, "TROLL_SET", "Bonus", 0, 0)) / 100;
  const shape = (tome: number, from: number) => {
    const p = Math.pow(Math.floor(Math.max(0, tome - from) / 100), 0.7);
    return Math.max(0, p / (25 + p));
  };

  it("is (1 + (Grimoire 17 + TROLL set) / 100) x a x p / (25 + p), p = floor((Tome - b) / 100) ^ .7, for the entry 'a|b'", () => {
    expect((Spelunky as any)[21][3]).toBe("100|3000");
    const c = lore();
    const tome = DNSM_TomeQTYtot(c);
    expect(tome).toBeGreaterThan(3000);
    expect(term(c)).toBeCloseTo(boost(c) * 100 * shape(tome, 3000), 12);
    expect(term(c)).toBeGreaterThan(0);
  });
  it("is the entry b asked: 'a|b' of Spelunky[21][b]", () => {
    const c = lore();
    const [a, from] = String((Spelunky as any)[21][0]).split("|").map(Number);
    expect(term(c, 0)).toBeCloseTo(boost(c) * a * shape(DNSM_TomeQTYtot(c), from), 12);
  });
  it("is 0 for a lore episode that is not unlocked yet (Spelunk[13][2] <= b)", () => {
    expect(term(lore({ unlocked: 3 }))).toBe(0);
    expect(term(lore({ unlocked: 4 }))).toBeGreaterThan(0);
  });
  it("the Tome score is lib/tome's own computeTome on the save; what IdleonToolbox stamped on the envelope (extraData, parsedData) is never read (Ruling K)", () => {
    const plain = lore();
    const stamped = lore({
      env: (e) => {
        e.extraData = { totalTomePoints: 1 };
        e.parsedData = { totalTomePoints: 1e9, tomePoints: new Array(124).fill(1e6) };
      },
    });
    expect(DNSM_TomeQTYtot(stamped)).toBe(DNSM_TomeQTYtot(plain));
    expect(term(stamped)).toBe(term(plain));
    const env = JSON.parse(readFileSync(BASE, "utf8"));
    delete env.extraData;
    delete env.parsedData;
    setIn(env.data, "Spelunk", (s) => (s[13][2] = 10));
    expect(DNSM_TomeQTYtot(plain)).toBe(computeTome(env).totalPts);
  });
  it("the Tome score is a leaf that says where it comes from, and is no N.js call", () => {
    const c = lore({ trace: true });
    term(c);
    const leaf = c.trace!.children[0].children.find((n) => n.block === "DNSM.TomeQTYtot")!.children[0];
    expect(leaf).toMatchObject({ block: "Tome.totalPoints", value: DNSM_TomeQTYtot(c), note: "assumed: Tome score from our own Tome calculation" });
    expect(leaf.detail).toContain("Tome score from lib/tome computeTome"); // the full reason (and the row count) stays on the trace node
    expect(leaf.detail).toMatch(/\d+ of \d+ rows computed/);
    expect(traceCalls(c.trace!).map((x) => x.block)).not.toContain("Tome.totalPoints");
  });
  it("each save KNOWN_ARKH_DIFFS lists for loreEpi3 has a Tome total of lib/tome that is not IdleonToolbox's: the source differs, nothing else", () => {
    const known = KNOWN_ARKH_DIFFS.filter((d) => d.source === "loreEpi3");
    expect(known.length).toBeGreaterThan(10);
    expect(new Set(known.map((d) => d.save)).size).toBe(known.length);
    for (const d of known) {
      expect(d.why).toContain("IdleonToolbox");
      const path = GOLDEN_SAVES.find((p) => basename(p) === d.save)!;
      const env = JSON.parse(readFileSync(path, "utf8"));
      const itTotal = env.extraData?.totalTomePoints ?? env.parsedData?.totalTomePoints;
      expect(DNSM_TomeQTYtot(gameCtx(env, 0)), d.save).not.toBe(itTotal);
    }
  }, 120_000);
  it("a save with a Tome row lib/tome cannot compute is refused, naming the rows, not scored as a floor (Ruling E)", () => {
    // rows 107..109 read RoyalG and RoyalMaps (the Royal Guardian, from CSver 32): computeTome would count them as no points
    const noRoyal = () =>
      variant((d) => {
        setIn(d, "Spelunk", (sp) => (sp[13][2] = 10));
        delete d.RoyalG;
        delete d.RoyalMaps;
      });
    const c = noRoyal();
    let error: unknown;
    try {
      term(c);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(IncompleteTome);
    expect(error).toBeInstanceOf(MissingSaveKey); // refused like any pre-migration key
    expect((error as IncompleteTome).key).toBe("Tome rows 107,108,109");
    expect((error as IncompleteTome).rows.map((r) => r.task)).toEqual(["Total Royal Statue LV", "Royal Guardian Outposts Built", "Total Resource Grade"]);
    expect((error as IncompleteTome).message).toContain('#107 "Total Royal Statue LV"');
    expect(() => DNSM_TomeQTYtot(noRoyal())).toThrow(IncompleteTome);
    expect(() => DNSM_TomeQTYtot(c)).toThrow(IncompleteTome); // the same state again: the refusal is kept, not recomputed into a score
    // the same save with its Royal data is scored
    expect(() => term(lore())).not.toThrow();
    // and a term that does not read the score is not refused by it: an episode that is not unlocked answers 0 first
    expect(term(variant((d) => (setIn(d, "Spelunk", (sp) => (sp[13][2] = 0)), delete d.RoyalG)))).toBe(0);
  });
  it("a lore episode the list does not have, and the cache rebuild (-1), are not ported", () => {
    const c = lore();
    expect(() => term(c, 11)).toThrow(RangeError);
    expect(() => term(c, -1)).toThrow(NotPorted);
  });
  it("a save without Spelunk[13] is refused (the game indexes Spelunk[13][2])", () => {
    expect(() => term(variant((d) => setIn(d, "Spelunk", (s) => (s[13] = null))))).toThrow(MissingSaveKey);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const expected = njsCalls(njsNamedBlocks(njsFunction(loadNjs(), "Thingies")!.body, "LoreEpiBon").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = lore({ trace: true });
    term(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

// ── RiftStuff, chipBonuses ───────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("RiftStuff enabledStarSigns (N.js @10791380) and chipBonuses (@5163283, RecalcChipBonuses @7956839)", () => {
  const rift = (lv: number) => variant((d) => setIn(d, "Rift", (r) => (r[0] = lv)));
  it("no star sign is enabled below Rift 10; from 10 it is 5 + the Shiny bonus 3 of the Breeding", () => {
    expect(RiftStuff(rift(9), "enabledStarSigns", 0)).toBe(0);
    expect(RiftStuff(rift(0), "enabledStarSigns", 0)).toBe(0);
    const c = rift(10);
    expect(RiftStuff(c, "enabledStarSigns", 0)).toBe(5 + Breeding(c, "ShinyBonusS", "Nah", 3, -1));
    expect(RiftStuff(c, "enabledStarSigns", 0)).toBeGreaterThanOrEqual(5);
  });
  it("a Rift level the save does not have counts as 0", () => {
    expect(RiftStuff(variant((d) => setIn(d, "Rift", (r) => (r.length = 0))), "enabledStarSigns", 0)).toBe(0);
  });
  it("only enabledStarSigns is ported", () => {
    expect(() => RiftStuff(rift(10), "RiftOpen", 0)).toThrow(NotPorted);
  });

  /** The chips of character 0 in the 7 slots of Lab[1] (-1 is empty); Silkrode Nanochip (15) is the 'star' chip, worth 1. */
  const chips = (slots: number[], ci = 0) => variant((d) => setIn(d, "Lab", (l) => (l[1 + ci] = slots)), { ci });
  it("chipBonuses is the sum of ChipDesc[chip][11] over the equipped chips whose [10] is the key", () => {
    expect(chipBonuses(chips([15, -1, -1, -1, -1, -1, -1]), "star")).toBe(1);
    expect(chipBonuses(chips([15, 15, -1, -1, -1, -1, -1]), "star")).toBe(2); // the game would not allow it, the sum is still the sum
    expect(chipBonuses(chips([-1, -1, -1, -1, -1, -1, -1]), "star")).toBe(0);
    expect(chipBonuses(chips([20, 10, -1, -1, -1, -1, -1]), "star")).toBe(0);
  });
  it("another key is the sum of its own chips, and a key no chip has is 0", () => {
    expect(chipBonuses(chips([15, -1, -1, -1, -1, -1, -1]), "NoSuchChipKey")).toBe(0);
  });
  it("is read for the current character: Lab[1 + player]", () => {
    const c = variant((d) => setIn(d, "Lab", (l) => ((l[1] = [15, -1, -1, -1, -1, -1, -1]), (l[2] = [-1, -1, -1, -1, -1, -1, -1]))));
    expect(chipBonuses(c, "star")).toBe(1);
    expect(chipBonuses(withPlayer(c, 1), "star")).toBe(0);
  });
  it("an empty slot is compared loosely with -1: a null or absent slot is not empty, it reads chip 0 (Grounded Nanochip, 'def', 10), with an (absent) leaf", () => {
    // N.js `-1 != Lab[1 + p][H]` and `ChipDesc[c.asNumber(Lab[1 + p][H]) | 0]`
    expect(ChipDesc[0][10]).toBe("def");
    expect(ChipDesc[0][11]).toBe("10");
    const nul = variant((d) => setIn(d, "Lab", (l) => (l[1] = [null, -1, -1, -1, -1, -1, -1])), { trace: true });
    const leaves = (c: Ctx) => c.trace!.children.flatMap((n) => n.children).filter((n) => n.note?.startsWith("absent:")).map((n) => n.args[0]);
    expect(chipBonuses(nul, "def")).toBe(10);
    expect(leaves(nul)).toEqual(["Lab[1][0]"]);
    expect(chipBonuses(variant((d) => setIn(d, "Lab", (l) => (l[1] = [null, -1, -1, -1, -1, -1, -1]))), "star")).toBe(0);
    // a row shorter than 7: every slot past its end is absent, so each reads chip 0 (4 of them) and leaves a leaf
    const short = variant((d) => setIn(d, "Lab", (l) => (l[1] = [-1, -1, -1])), { trace: true });
    expect(chipBonuses(short, "def")).toBe(40);
    expect(leaves(short)).toEqual(["Lab[1][3]", "Lab[1][4]", "Lab[1][5]", "Lab[1][6]"]);
    // a -1 stays empty, and a real chip leaves no leaf
    const real = variant((d) => setIn(d, "Lab", (l) => (l[1] = [15, -1, -1, -1, -1, -1, -1])), { trace: true });
    expect(chipBonuses(real, "star")).toBe(1);
    expect(leaves(real)).toEqual([]);
  });
  it("a save without Lab, or without the character's row, is refused", () => {
    expect(() => chipBonuses(variant((d) => delete d.Lab), "star")).toThrow(MissingSaveKey);
    expect(() => chipBonuses(variant((d) => setIn(d, "Lab", (l) => (l[1] = null))), "star")).toThrow(MissingSaveKey);
  });
});

// ── DNSM.StarSigns ───────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("DNSM.StarSigns['61'] (the fill is _customBlock_StarSigns @6540622)", () => {
  // Character 0 and 1 of ARKHE. `equip` is PVtStarSign_<i>; the Rift is 5 (no sign enabled: ARKHE's Shiny bonus would enable all 94 at
  // Rift 10+); the Seraph multiplier is set apart (StarSg), with Arcane[40] = 0 and Lv0[18] = 19, so the base is 1.1 ^ ceil(20 / 20) = 1.1;
  // OptionsListAccount[453] = 24 keeps Meritoc 22 off.
  const signs = (o: { equip?: string[]; seraph?: boolean; rift?: number; chip?: number[]; trace?: boolean; ci?: number; arcane?: number; lv18?: number; vote?: number; extra?: (d: Data) => void } = {}) =>
    variant(
      (d) => {
        const eq = o.equip ?? ["61,_,_,", "26,49,69,"];
        eq.forEach((s, i) => (d[`PVtStarSign_${i}`] = s));
        setIn(d, "StarSg", (m) => {
          delete m.Seraph_Cosmos;
          if (o.seraph) m.Seraph_Cosmos = 1;
        });
        setIn(d, "Rift", (r) => (r[0] = o.rift ?? 5));
        setIn(d, "Arcane", (a) => (a[40] = o.arcane ?? 0));
        for (const k of ["Lv0_0", "Lv0_1"]) setIn(d, k, (l) => (l[18] = o.lv18 ?? 19));
        setIn(d, "OptLacc", (x) => (x[453] = o.vote ?? 24));
        setIn(d, "Lab", (l) => {
          l[1] = o.chip ?? [-1, -1, -1, -1, -1, -1, -1];
          l[2] = [-1, -1, -1, -1, -1, -1, -1];
        });
        o.extra?.(d);
      },
      { ci: o.ci ?? 0, trace: o.trace }
    );
  const sign = (c: Ctx) => DNSM_StarSigns(c, "61");

  it("an equipped Artifosho is +15", () => {
    expect(sign(signs())).toBe(15);
  });
  it("a character that does not wear it has nothing, on the same save", () => {
    const c = signs();
    expect(sign(withPlayer(c, 0))).toBe(15);
    expect(sign(withPlayer(c, 1))).toBe(0);
  });
  it("Seraph Cosmos multiplies it by min(5, (1.1 + min(Arcane 40, 10) / 100) ^ ceil((Lv0[18] + 1) / 20))", () => {
    expect(sign(signs({ seraph: true }))).toBeCloseTo(15 * 1.1, 12); // exponent 1
    expect(sign(signs({ seraph: true, arcane: 5, lv18: 39 }))).toBeCloseTo(15 * Math.pow(1.15, 2), 12); // exponent ceil(40 / 20) = 2
    expect(sign(signs({ seraph: true, arcane: 10, lv18: 40 }))).toBeCloseTo(15 * Math.pow(1.2, 3), 12); // ceil(41 / 20) = 3
    expect(sign(signs({ seraph: true, arcane: 99, lv18: 39 }))).toBeCloseTo(15 * Math.pow(1.2, 2), 12); // Arcane 40 caps at 10
    expect(sign(signs({ seraph: true, arcane: 99, lv18: 2000 }))).toBe(15 * 5); // min(5, 1.2 ^ 101)
  });
  it("the Meritoc 22 bonus is a factor when its vote is the one in force", () => {
    const on = signs({ seraph: true, vote: 22 });
    const m = Summoning2(on, "MeritocBonusz", 22, 0);
    expect(m).toBeGreaterThan(0);
    expect(sign(on)).toBeCloseTo(15 * 1.1 * (1 + m / 100), 12);
    expect(sign(signs({ seraph: true, vote: 24 }))).toBeCloseTo(15 * 1.1, 12);
  });
  it("the Silkrode Nanochip doubles the multiplier (up to 2) once some sign is enabled by the Rift", () => {
    const c = signs({ seraph: true, chip: [-1, -1, 15, -1, -1, -1, -1], rift: 65 });
    expect(RiftStuff(c, "enabledStarSigns", 0)).toBeGreaterThanOrEqual(5);
    expect(sign(c)).toBeCloseTo(15 * 2 * 1.1, 12); // min(2, 1 + 1 x floor((999 + enabled) / 1000)) = 2
  });
  it("with the chip and no sign enabled (Rift < 10) the equipped signs count a second time, and the chip does not double the multiplier", () => {
    const c = signs({ seraph: true, chip: [-1, 15, -1, -1, -1, -1, -1], rift: 5 });
    expect(RiftStuff(c, "enabledStarSigns", 0)).toBe(0);
    expect(sign(c)).toBeCloseTo(30 * 1.1, 12); // 15 + 15, x max(1, min(2, 1 + 1 x floor(999 / 1000) = 1))
    // two chips are not one chip: the second pass wants exactly 1
    expect(sign(signs({ seraph: true, chip: [15, 15, -1, -1, -1, -1, -1], rift: 5 }))).toBeCloseTo(15 * 1.1, 12);
    // no chip, no second pass
    expect(sign(signs({ seraph: true, rift: 5 }))).toBeCloseTo(15 * 1.1, 12);
  });
  it("without Seraph Cosmos the multiplier is not applied at all, chip or not", () => {
    expect(sign(signs({ seraph: false, chip: [15, -1, -1, -1, -1, -1, -1], rift: 65 }))).toBe(15);
    expect(sign(signs({ seraph: false }))).toBe(15);
    expect(sign(signs({ seraph: false, chip: [15, -1, -1, -1, -1, -1, -1], rift: 5 }))).toBe(30); // the second pass is the chip's, not Seraph's
  });
  it("a sign that is unlocked and among the first `enabled` is active without being worn", () => {
    // Rift 65: 5 + ARKHE's Shiny bonus 3 signs are enabled, which is more than 61, and the account has unlocked Artifosho
    const c = signs({ equip: ["26,_,_,", "26,_,_,"], rift: 65 });
    expect(RiftStuff(c, "enabledStarSigns", 0)).toBeGreaterThan(61);
    expect(sign(c)).toBe(15);
    expect(sign(signs({ equip: ["26,_,_,", "26,_,_,"], rift: 5 }))).toBe(0); // the Rift enables none
    // not unlocked: StarSg has no Artifosho
    const locked = variant((d) => {
      d.PVtStarSign_0 = "26,_,_,";
      setIn(d, "Rift", (r) => (r[0] = 65));
      setIn(d, "StarSg", (m) => delete m.Artifosho);
    });
    expect(sign(locked)).toBe(0);
  });
  it("the equipped signs are read from PVtStarSign_<player>: '' falls back to PVStarSign_<player> and '-1' to '0'", () => {
    // `"" + getLoad("PVStarSign_0")` is "61": no comma, split(",") is ["61"]
    const old = (v: number) => signs({ extra: (d) => ((d.PVtStarSign_0 = ""), (d.PVStarSign_0 = v)) });
    expect(sign(old(61))).toBe(15);
    expect(sign(old(-1))).toBe(0);
    expect(sign(old(26))).toBe(0);
    // neither key: refused
    expect(() => sign(signs({ extra: (d) => ((d.PVtStarSign_0 = ""), delete d.PVStarSign_0) }))).toThrow(MissingSaveKey);
  });
  it("a save without PVtStarSign for the character is refused", () => {
    expect(() => sign(variant((d) => delete d.PVtStarSign_0))).toThrow(MissingSaveKey);
  });
  it("a save without Rift or StarSg is refused", () => {
    expect(() => sign(variant((d) => delete d.StarSg))).toThrow(MissingSaveKey);
    expect(() => sign(variant((d) => delete d.Rift))).toThrow(MissingSaveKey);
  });
  it("only the key 61 is ported", () => {
    const c = variant(() => {});
    for (const k of ["Drop", "STR", "62"]) expect(() => DNSM_StarSigns(c, k), k).toThrow(NotPorted);
  });
  it.skipIf(noNjs)("calls what N.js calls (the header, the second pass's condition and the Seraph tail of _customBlock_StarSigns)", () => {
    const norm = loadNjs();
    const from = norm.indexOf("v._customBlock_StarSigns=function(d)");
    const end = norm.indexOf("};v._customBlock_", from + 100);
    const fn = norm.slice(from, end);
    const header = fn.slice(0, fn.indexOf('StarSignsDL,"0")'));
    const seraph = fn.slice(fn.indexOf('"Seraph_Cosmos"'));
    const expected = njsCalls(header + seraph);
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = signs({ seraph: true, chip: [-1, 15, -1, -1, -1, -1, -1], rift: 5, trace: true });
    sign(c);
    const got = traceCalls(c.trace!);
    expect(callDiff(expected, got).missing).toEqual([]);
  }, 120_000);
});

// ── CauldronStats VialBonus, DNSM.AlchVials ──────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("CauldronStats VialBonus (N.js @5108874) and DNSM.AlchVials['6turtle'] (the fill, TalentCalc(-2) @4495601)", () => {
  // Vial 74 (Turtle Tisane) is 'add' with 4 per level. Rift 34 keeps the crown boost off; Vault 42 and the Meritoc 20 bonus are set to 0.
  const vial = (o: { level?: number; rift?: number; crowns?: number[]; vault42?: number; vote?: number; trace?: boolean; array?: boolean } = {}) =>
    variant(
      (d) => {
        setIn(d, "CauldronInfo", (c) => {
          // CauldronInfo[4] is a {"0": level, …, "length": 90} map in the cloud save
          const levels: Record<string, number> = {};
          for (const k of Object.keys(c[4])) if (k !== "length") levels[k] = 0;
          levels[74] = o.level ?? 10;
          for (const i of o.crowns ?? []) levels[i] = 13;
          c[4] = o.array ? Object.assign(new Array(90).fill(0), levels) : { ...levels, length: 90 };
        });
        setIn(d, "Rift", (r) => (r[0] = o.rift ?? 34));
        setIn(d, "UpgVault", (u) => (u[42] = o.vault42 ?? 0));
        setIn(d, "OptLacc", (x) => (x[453] = o.vote ?? 24));
      },
      { trace: o.trace }
    );
  const turtle = (c: Ctx) => DNSM_AlchVials(c, "6turtle");

  it("is 2 x 4 x level (Mainframe 10 doubles the vials) with nothing else on", () => {
    expect(turtle(vial({ level: 10 }))).toBe(80);
    expect(turtle(vial({ level: 0 }))).toBe(0);
    expect(CauldronStats(vial({ level: 10 }), "VialBonus", 4, 74, 0)).toBe(80);
  });
  it("Vault 42 adds its percent to the boost, as do 2 x the Lv 13 vials from Rift 35", () => {
    const row = Number((UpgradeVault as any)[42][5]);
    expect(row).toBe(10);
    expect(turtle(vial({ level: 10, vault42: 7 }))).toBeCloseTo(80 * (1 + (7 * row) / 100), 12);
    // Rift 35 (> 34): 2 per vial at level 13, the vial's own 13 included (74 is one of them)
    expect(turtle(vial({ level: 13, rift: 35 }))).toBeCloseTo(2 * 4 * 13 * (1 + (2 * 1) / 100), 12);
    expect(turtle(vial({ level: 13, rift: 35, crowns: [0, 5, 40] }))).toBeCloseTo(2 * 4 * 13 * (1 + (2 * 4) / 100), 12);
    expect(turtle(vial({ level: 13, rift: 34, crowns: [0, 5, 40] }))).toBeCloseTo(2 * 4 * 13, 12); // not above 34: no crown boost
  });
  it("the crown count walks 86 positions that skip vial 41 (`41 > g ? g : g + 1`), so a Lv 13 vial 41 does not count", () => {
    const base = turtle(vial({ level: 13, rift: 35 }));
    expect(turtle(vial({ level: 13, rift: 35, crowns: [41] }))).toBe(base);
    expect(turtle(vial({ level: 13, rift: 35, crowns: [42] }))).toBeGreaterThan(base);
    expect(turtle(vial({ level: 13, rift: 35, crowns: [86] }))).toBeGreaterThan(base);
    expect(turtle(vial({ level: 13, rift: 35, crowns: [87] }))).toBe(base); // past the 86 positions (indices up to 86)
  });
  it("the Meritoc 20 bonus is a factor when its vote is the one in force", () => {
    const on = vial({ level: 10, vote: 20 });
    const m = Summoning2(on, "MeritocBonusz", 20, 0);
    expect(m).toBeGreaterThan(0);
    expect(turtle(on)).toBeCloseTo(80 * (1 + m / 100), 12);
  });
  it("sums the vials that share the key", () => {
    // only vial 74 has '6turtle'; any other key is the sum of its own vials, an unknown key is 0
    expect(DNSM_AlchVials(vial(), "NoSuchVialKey")).toBe(0);
  });
  it("the vial level is asNumber: an index the save does not have is level 0", () => {
    const c = variant((d) => setIn(d, "CauldronInfo", (ci) => delete ci[4][74]));
    expect(turtle(c)).toBe(0);
    // and a list kept as an array reads the same
    expect(turtle(vial({ level: 10, array: true }))).toBe(80);
  });
  it("a save without CauldronInfo, UpgVault or Rift is refused", () => {
    const key = (c: Ctx) => {
      try {
        turtle(c);
      } catch (e) {
        return e instanceof MissingSaveKey ? e.key : String(e);
      }
      return "no error";
    };
    expect(key(variant((d) => delete d.CauldronInfo))).toBe("CauldronInfo");
    expect(key(variant((d) => delete d.UpgVault))).toBe("UpgVault");
    expect(key(variant((d) => delete d.Rift))).toBe("Rift");
  });
  it("only the VialBonus sub-case is ported, and only for an item AlchemyDescription has", () => {
    expect(() => CauldronStats(vial(), "BubbleBonus", 0, 0, 0)).toThrow(NotPorted);
    expect(() => CauldronStats(vial(), "VialBonus", 4, 999, 0)).toThrow(RangeError);
  });
  it.skipIf(noNjs)("calls what N.js calls", () => {
    const norm = loadNjs();
    const fill = norm.slice(norm.indexOf("b.h.AlchVials=e;f=0;for(t="), norm.indexOf("if(-3==d)", norm.indexOf("b.h.AlchVials=e;f=0;for(t=")));
    const expectedFill = njsCalls(fill);
    expect(expectedFill.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = vial({ level: 13, rift: 35, trace: true });
    turtle(c);
    expect(callDiff(expectedFill, traceCalls(c.trace!)).missing).toEqual([]);
    const body = njsCalls(njsNamedBlocks(njsFunction(norm, "CauldronStats")!.body, "VialBonus").join("\n"));
    expect(body.length).toBeGreaterThan(0);
    expect(callDiff(body, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

// ── the proven lib/arkh difference (KNOWN_ARKH_DIFFS, found in Task 7) also reaches the Minehead button ────────
describe.skipIf(GOLDEN_SAVES.length === 0)("Koweabooo#10: Companions(0) needs Lv0[14] >= 2 (N.js @10799980) also in the Minehead presses (Grid_Bonus 125)", () => {
  const path = GOLDEN_SAVES.find((p) => basename(p) === "Koweabooo.json");
  const at = (lv: number | null) => {
    const env = JSON.parse(readFileSync(path!, "utf8"));
    if (lv !== null) setIn(env.data, "Lv0_10", (l) => (l[14] = lv));
    return gameCtx(env, 10);
  };
  it.skipIf(!path)("with Lv0[14] raised to 2 button3 equals lib/arkh's, which ignores it; as saved, the game is lower", () => {
    expect(rel(Minehead(at(2), "Button_Bonuses", 3, 0), arkhArtifactLeaf(path!, 10, "button3"))).toBe(true);
    expect(Minehead(at(null), "Button_Bonuses", 3, 0)).toBeLessThan(arkhArtifactLeaf(path!, 10, "button3"));
  });
});

// ── Spelunk[6].length and Super Bit 26 ───────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("the Spelunk discoveries factor: 1.02 ^ Spelunk[6].length x Super Bit 26", () => {
  // Super Bit 26 is owned when its letter, Number2Letter[26], is in Gaming[12]
  const bit = (own: boolean, n: unknown) =>
    variant((d) => {
      setIn(d, "Gaming", (g) => (g[12] = own ? `${String((Number2Letter as any)[26])}` : ""));
      setIn(d, "Spelunk", (s) => (s[6] = n));
    });
  it("is 1.02 to the number of discoveries when the bit is owned, 0 when not (the group then lifts it to 1)", () => {
    expect(TERMS.spelunkBit26.term(bit(true, new Array(10).fill(1)))).toBeCloseTo(Math.pow(1.02, 10), 12);
    expect(TERMS.spelunkBit26.term(bit(true, []))).toBe(1);
    expect(TERMS.spelunkBit26.term(bit(false, new Array(10).fill(1)))).toBe(0);
  });
  it("counts the length of the list, empty entries included, as `.length` does", () => {
    expect(TERMS.spelunkBit26.term(bit(true, [0, 0, null, 0]))).toBeCloseTo(Math.pow(1.02, 4), 12);
  });
  it("an absent Spelunk[6] is refused, not read as 0 discoveries (the game's `.length` would throw)", () => {
    expect(() => TERMS.spelunkBit26.term(bit(true, null))).toThrow(MissingSaveKey);
    expect(() => TERMS.spelunkBit26.term(variant((d) => delete d.Spelunk))).toThrow(MissingSaveKey);
    expect(() => TERMS.spelunkBit26.term(bit(true, 5))).toThrow(InvalidSaveValue);
  });
});

// ── variants forced on every save ────────────────────────────────────────────────────────────────
// The real saves leave some inputs constant (every one owns the Emporium items, is past Rift 34, has no ineffective star sign...).
// Each variant is applied to a fresh clone of every save and the game is compared with lib/arkh on that same clone.
type Forced = { pairs: number; mismatches: string[]; seen: Set<number>; refused: string[] };
function forced(id: string, edit: (env: any) => void, only?: (env: any) => boolean): Forced {
  const out: Forced = { pairs: 0, mismatches: [], seen: new Set(), refused: [] };
  for (const path of GOLDEN_SAVES) {
    const env = JSON.parse(readFileSync(path, "utf8"));
    if (only && !only(env)) continue;
    edit(env);
    const ctx = gameCtx(env, 0);
    for (let ci = 0; ci < env.charNames.length; ci++) {
      if (KNOWN_ARKH_DIFFS.some((d) => d.save === basename(path) && (d.ci ?? ci) === ci && d.source === id)) continue;
      let got: number;
      try {
        got = TERMS[id].term(withPlayer(ctx, ci));
      } catch (err) {
        if (!(err instanceof MissingSaveKey)) throw err;
        out.refused.push(`${basename(path)}: ${err.key}`);
        continue;
      }
      const want = arkhArtifactLeaf(env, ci, id);
      out.pairs++;
      out.seen.add(want);
      if (!rel(got, want)) out.mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
    }
  }
  return out;
}
const dataOf = (env: any) => env.data as Data;

describe.skipIf(GOLDEN_SAVES.length === 0)("variants forced on every real save, against lib/arkh", () => {
  it("Artifosho worn by every character, with the Rift as saved", () => {
    const r = forced("starSign61", (env) => env.charNames.forEach((_: string, i: number) => (dataOf(env)[`PVtStarSign_${i}`] = "61,_,_,")));
    console.info(`[w7 starSign61 worn] ${r.pairs} pairs, ${r.mismatches.length} mismatches, ${r.seen.size} distinct`);
    expect(r.mismatches).toEqual([]);
    expect(r.pairs).toBeGreaterThan(1000); // the saves without a Menagerie compute too (the load fills it in)
    expect([...new Set(r.refused)].sort()).toEqual(UNPORTED_REFUSALS);
    expect(r.seen.size).toBeGreaterThan(3);
    expect(r.seen.has(0)).toBe(false); // really worn everywhere
  }, 300_000);
  it("Artifosho worn and the Rift below 10: only the equipped signs, with the Silkrode chip's second pass", () => {
    const r = forced("starSign61", (env) => {
      env.charNames.forEach((_: string, i: number) => (dataOf(env)[`PVtStarSign_${i}`] = "61,_,_,"));
      setIn(dataOf(env), "Rift", (x) => (x[0] = 5));
    });
    console.info(`[w7 starSign61 worn, Rift 5] ${r.pairs} pairs, ${r.mismatches.length} mismatches, ${r.seen.size} distinct`);
    expect(r.mismatches).toEqual([]);
    expect(r.pairs).toBeGreaterThan(1000);
    expect(r.seen.size).toBeGreaterThan(3);
  }, 300_000);
  it("Artifosho worn, the Rift at 5 and the chip on every character: the second pass everywhere", () => {
    const r = forced("starSign61", (env) => {
      const d = dataOf(env);
      env.charNames.forEach((_: string, i: number) => (d[`PVtStarSign_${i}`] = "61,_,_,"));
      setIn(d, "Rift", (x) => (x[0] = 5));
      setIn(d, "Lab", (l) => env.charNames.forEach((_: string, i: number) => (l[1 + i] = [15, -1, -1, -1, -1, -1, -1])));
    });
    console.info(`[w7 starSign61 chip, Rift 5] ${r.pairs} pairs, ${r.mismatches.length} mismatches, ${r.seen.size} distinct`);
    expect(r.mismatches).toEqual([]);
    expect(r.pairs).toBeGreaterThan(1000);
  }, 300_000);
  it("a Rift just under the Vial crowns (34): the vial without the Gold Crown boost", () => {
    const r = forced("vialTurtle", (env) => setIn(dataOf(env), "Rift", (x) => (x[0] = 34)));
    console.info(`[w7 vialTurtle Rift 34] ${r.pairs} pairs, ${r.mismatches.length} mismatches, ${r.seen.size} distinct`);
    expect(r.mismatches).toEqual([]);
    expect(r.pairs).toBeGreaterThan(1000);
    expect(r.seen.size).toBeGreaterThan(2); // every real vial 74 is at its level 13: the values differ by Vault 42 and the Meritoc vote only
  }, 300_000);
  it("the Artifact Attraction through the Emporium: item 8 missing, then none of the four", () => {
    const strip = (items: number[]) => (env: any) =>
      setIn(dataOf(env), "Ninja", (n) => {
        n[102][9] = String(n[102][9]).replace(new RegExp(`[${items.map((i) => String((Number2Letter as any)[i])).join("")}]`, "g"), "");
      });
    const second = forced("mainframe14", strip([8]));
    expect(second.mismatches).toEqual([]);
    expect(second.pairs).toBeGreaterThan(1000);
    expect([...second.seen]).toEqual([25]);
    const none = forced("mainframe14", strip([8, 9, 10, 11]));
    expect(none.mismatches).toEqual([]);
    expect(none.pairs).toBeGreaterThan(1000);
    expect([...none.seen]).toEqual([0]);
  }, 300_000);
});

describe("ports stay on their boundary", () => {
  const c = () => gameCtx({ data: {}, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 }, 0);
  it("Minehead / MainframeBonus / Ninja / Thingies / RiftStuff / CauldronStats: only the ported sub-cases", () => {
    expect(() => Minehead(c(), "GlimboTotalTrades", 0, 0)).toThrow(NotPorted);
    expect(() => MainframeBonus(c(), 15)).toThrow(NotPorted);
    expect(() => Ninja(c(), "Nope", 0, 0)).toThrow(NotPorted);
    expect(() => Thingies(c(), "Nope", 0, 0)).toThrow(NotPorted);
    expect(() => RiftStuff(c(), "Nope", 0)).toThrow(NotPorted);
    expect(() => CauldronStats(c(), "Nope", 0, 0, 0)).toThrow(NotPorted);
    expect(() => DNSM_StarSigns(c(), "Drop")).toThrow(NotPorted);
  });
  it("an empty save is refused with MissingSaveKey, never read as zeros", () => {
    expect(() => Minehead(c(), "Button_Bonuses", 3, 0)).toThrow(MissingSaveKey);
    expect(() => DNSM_AlchVials(c(), "6turtle")).toThrow(MissingSaveKey);
    expect(() => DNSM_StarSigns(c(), "61")).toThrow(MissingSaveKey);
  });
  it("InvalidSaveValue is the answer for a list that is not a list", () => {
    const bad = variant((d) => (d.Lab = 5));
    expect(() => chipBonuses(bad, "star")).toThrow(InvalidSaveValue);
  });
});
