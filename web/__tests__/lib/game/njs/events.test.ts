// Task 6: events, shops and votes of Sailing("BoatArtiMulti", 0): fractal3, bribe34, vault63, killroy, slugs, win3, vote20.
// Each term is the expression as BoatArtiMulti uses it (before the /100 of the additive pool; the whole factor for a factor
// group), compared with lib/arkh over every real save and every character. The synthetic tests below pin each edge on top of one
// real envelope, and the cross-family callees (the Winner and Voting bonuses reach Ninja, Arcade, Gaming, Holes, Sushi...) too.
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, UNPORTED_REFUSALS, arkhArtifactLeaf, gameCtx } from "../support/arkhOracle";
import { withPlayer, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { hString } from "@/lib/game/hstring";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "@/lib/game/errors";
import { ArcaneUpg, BribeDescriptions, CosmoUpgrades, EmperorBon, EquipmentSets, GamingPalette, GrimoireUpg, LegendTalents, NinjaInfo, NjEQ, Number2Letter, Research as ResearchLists, SummonEnemies, UpgradeVault } from "@/lib/game/data";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ArbitraryCode5Inputs } from "@/lib/game/njs/ArbitraryCode5Inputs";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { Companions } from "@/lib/game/njs/Companions";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { GetBribeBonus } from "@/lib/game/njs/GetBribeBonus";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Holes } from "@/lib/game/njs/Holes";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { Ninja } from "@/lib/game/njs/Ninja";
import { RandomEvent } from "@/lib/game/njs/RandomEvent";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { Stuff2 } from "@/lib/game/njs/Stuff2";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Summoning, SUMMONING_OWN_NAMES } from "@/lib/game/njs/Summoning";
import { Summoning2 } from "@/lib/game/njs/Summoning2";
import { Thingies } from "@/lib/game/njs/Thingies";
import { callDiff, njsCalls, njsFunction, njsNamedBlocks, traceCalls } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";

// ── the terms, written the way BoatArtiMulti writes them ────────────────────────────────────────
// `want` turns lib/arkh's leaf into the same term (the leaf of a `max1` group is the raw factor, the group clamps it).
// Ruling E: an older save is read after the game's load steps (lib/game/migrations), so a term refuses only the saves older than the steps
// ported (UNPORTED_REFUSALS), and only when it reads the save at all: `needs` says when (the vote is lazy: nothing of its multi is read
// unless vote 20 is in force).
type Data = Record<string, any>;
type Term = {
  term: (c: Ctx) => number;
  want?: (leaf: number) => number;
  minSeen: number;
  needs?: (env: any) => boolean;
};
const TERMS: Record<string, Term> = {
  fractal3: { term: (c) => 20 * RandomEvent(c, "FractalIslandBonus", 3, 999), minSeen: 2 },
  bribe34: { term: (c) => GetBribeBonus(c, "34"), minSeen: 1 },
  vault63: { term: (c) => Summoning(c, "VaultUpgBonus", 63, 0), minSeen: 5 },
  killroy: { term: (c) => Math.max(1, RandomEvent(c, "KillroyBonuses", 0, 0)), want: (l) => Math.max(1, l), minSeen: 5 },
  slugs: { term: (c) => Math.max(1, Math.pow(1.5, Stuff2(c, "PurpleChestSlugsOwned", 0, 0))), want: (l) => Math.max(1, l), minSeen: 2 },
  // the Winner Bonus reads Arcane (Emperor bonus 8). BundlesReceived (ban_i) is no gap: an absent key is an account that never bought a
  // bundle, read as the loader's empty map (Ruling H)
  win3: { term: (c) => Summoning(c, "WinBonus", 3, 0), minSeen: 5 },
  // the vote reads its multi only while vote 20 is the one in force; the Palette then reads Spelunk[9] and Spelunk[49]
  vote20: {
    term: (c) => Summoning(c, "VotingBonusz", 20, 0),
    minSeen: 2,
    needs: (env) => env.serverVars?.voteCategories?.[0] == 20,
  },
};

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

// One GameState per save, shared by all its characters (withPlayer) and by the tests.
const states = new Map<string, { ctx: Ctx; chars: number; env: any }>();
afterAll(() => states.clear()); // the built states of the real saves are big: not kept past this file (a full run keeps its workers alive)
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const save = JSON.parse(readFileSync(path, "utf8"));
    states.set(path, (s = { ctx: gameCtx(save, 0), chars: save.charNames.length, env: save }));
  }
  return s;
}

describe.skipIf(GOLDEN_SAVES.length === 0)("lib/game events, shops and votes terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const { term, want: toWant = (l: number) => l, minSeen, needs = () => true } = TERMS[id];
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      const expectedRefused = new Set<string>();
      const seen = new Set<number>();
      let pairs = 0;
      for (const path of GOLDEN_SAVES) {
        const { ctx, chars, env } = stateOf(path);
        const unported = UNPORTED_REFUSALS.find((r) => r.startsWith(`${basename(path)}: `));
        if (unported && needs(env)) expectedRefused.add(unported);
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
          const want = toWant(arkhArtifactLeaf(path, ci, id));
          pairs++;
          seen.add(want);
          if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[events ${id}] ${pairs} pairs checked, ${mismatches.length} mismatches, ${refused.size} saves refused, ${seen.size} distinct values (${[...seen].sort((a, b) => a - b).slice(0, 6).map((v) => +v.toPrecision(6)).join(", ")}${seen.size > 6 ? ", …" : ""}), ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches).toEqual([]);
      expect(pairs).toBeGreaterThan(100); // a loop over nothing would pass
      expect(seen.size).toBeGreaterThanOrEqual(minSeen); // nor would a term that is the same number everywhere
      expect([...refused].sort()).toEqual([...expectedRefused].sort());
      if (id === "win3" || id === "vote20") expect([...seen].some((v) => v > 0)).toBe(true);
    }, 300_000);
  }
});

// ── synthetic saves: one edge each, on top of a real envelope ───────────────────────────────────
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];
const json = (d: Data, k: string): any => (typeof d[k] === "string" ? JSON.parse(d[k] as string) : structuredClone(d[k]));

/** A fresh copy of BASE with `edit` applied to its `data` (and `env` to the envelope around it). */
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
const num = (x: unknown) => Number(x);
/** The addresses of the (absent) leaves in a trace: the reads where the game's c.asNumber(null) = 0 stood in for an index the save lacks. */
const absentLeaves = (n: TraceNode): string[] => [...(n.block === "(absent)" ? [String(n.args[0])] : []), ...n.children.flatMap(absentLeaves)];

describe.skipIf(GOLDEN_SAVES.length === 0)("RandomEvent (N.js @10777743)", () => {
  const killroy = (p: number) => RandomEvent(variant((d) => setIn(d, "OptLacc", (o) => (o[228] = p))), "KillroyBonuses", 0, 0);
  it("Killroy upgrade 0 is 1 + P / (300 + P), P = OptionsListAccount[228] (@10780919)", () => {
    expect(killroy(0)).toBe(1);
    expect(killroy(300)).toBe(1.5);
    expect(killroy(900)).toBe(1.75);
  });
  it("Killroy upgrade 3 (the Gallery's) is 10 x P / (200 + P), P = OptionsListAccount[467]; the others are not ported", () => {
    const k3 = (p: number) => RandomEvent(variant((d) => setIn(d, "OptLacc", (o) => (o[467] = p))), "KillroyBonuses", 3, 0);
    expect(k3(0)).toBe(0);
    expect(k3(200)).toBe(5);
    for (const b of [1, 2, 7, 8]) expect(() => RandomEvent(variant(() => {}), "KillroyBonuses", b, 0)).toThrow(NotPorted);
  });
  // DNSM.FracIsBn[f] = (OptionsListAccount[184] >= GenINFO[25][f]) with the thresholds 24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4 (@11694238)
  const fractal = (points: number, b = 3) => RandomEvent(variant((d) => setIn(d, "OptLacc", (o) => (o[184] = points))), "FractalIslandBonus", b, 999);
  it("Fractal Island bonus f is 1 once OptionsListAccount[184] reaches its threshold, else 0", () => {
    expect(fractal(2499)).toBe(0);
    expect(fractal(2500)).toBe(1);
    expect(fractal(2500, 4)).toBe(0); // 1e4
    expect(fractal(10000, 4)).toBe(1);
    expect(fractal(24, 0)).toBe(1);
    expect(fractal(23, 0)).toBe(0);
    expect(fractal(6e4, 7)).toBe(1);
    expect(20 * fractal(2500)).toBe(20); // fractal3 as BoatArtiMulti writes it
  });
  it("a bonus the island does not have is refused (the game reads undefined)", () => {
    expect(() => fractal(1e9, 8)).toThrow(RangeError);
    expect(() => fractal(1e9, -1)).toThrow(RangeError);
  });
  it("a save whose OptionsListAccount[184] is missing counts 0 points (c.asNumber), shown in the trace as an (absent) leaf", () => {
    expect(fractal(undefined as unknown as number, 0)).toBe(0); // a null in the save: initialize1 makes it 0 (@6192268)
    const c = variant((d) => setIn(d, "OptLacc", (o) => (o.length = 184)), { trace: true });
    expect(RandomEvent(c, "FractalIslandBonus", 3, 999)).toBe(0);
    expect(absentLeaves(c.trace!)).toEqual(["OptionsListAccount[184]"]);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("GetBribeBonus (N.js @5061911)", () => {
  const bribe = (status: unknown) => GetBribeBonus(variant((d) => (d.BribeStatus = status)), "34");
  const value = Number(BribeDescriptions[34][5]);
  it("is the bribe's value once bought (BribeStatus[34] == 1), else 0", () => {
    expect(value).toBeGreaterThan(0);
    const list = (v: unknown) => Array.from({ length: 41 }, (_, i) => (i === 34 ? v : 0));
    expect(bribe(list(1))).toBe(value);
    expect(bribe(list(0))).toBe(0);
    expect(bribe(list(-1))).toBe(0); // only a 1 counts
    expect(bribe(list("1"))).toBe(value); // loose ==, as in N.js
  });
  it("a list that stops before bribe 34 is not bought: undefined == 1 is false", () => {
    expect(bribe([1, 1, 1])).toBe(0);
  });
  it("a save without BribeStatus is refused", () => {
    expect(() => GetBribeBonus(variant((d) => delete d.BribeStatus), "34")).toThrow(MissingSaveKey);
  });
  it("the name is a number given as text: any bribe works", () => {
    const c = variant((d) => (d.BribeStatus = Array(41).fill(1)));
    expect(GetBribeBonus(c, "0")).toBe(Number(BribeDescriptions[0][5]));
    expect(GetBribeBonus(c, "999")).toBe(0); // the status is read first: nothing at 999 is not bought
    expect(() => GetBribeBonus(variant((d) => (d.BribeStatus = Array(1000).fill(1))), "999")).toThrow(RangeError); // bought, but no such bribe
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("EventShopOwned / slugs (N.js @10899434, Stuff2 @10989439)", () => {
  const letter = Number2Letter[48];
  const shop = (items: string) => variant((d) => setIn(d, "OptLacc", (o) => (o[311] = items)));
  const owned = (c: Ctx, i: number) => Summoning(c, "EventShopOwned", i, 0);
  it("item i is owned when its letter, Number2Letter[i], is in OptionsListAccount[311]", () => {
    expect(letter).toBe("V");
    expect(owned(shop(`abc${letter}`), 48)).toBe(1);
    expect(owned(shop("abc"), 48)).toBe(0);
    expect(owned(shop("ab"), 1)).toBe(1); // a
    expect(owned(shop("a"), 2)).toBe(0); // b
    expect(owned(shop(""), 0)).toBe(0); // "_"
  });
  it("a letter past the 52 ASCII ones is a CJK character of the table", () => {
    expect(owned(shop(Number2Letter[54]), 54)).toBe(1);
    expect(owned(shop("ab"), 54)).toBe(0);
  });
  it("PurpleChestSlugsOwned is Event Shop item 48, and the factor is 1.5 to that", () => {
    expect(Stuff2(shop(letter), "PurpleChestSlugsOwned", 0, 0)).toBe(1);
    expect(Stuff2(shop("a"), "PurpleChestSlugsOwned", 0, 0)).toBe(0);
    expect(Math.max(1, Math.pow(1.5, Stuff2(shop(letter), "PurpleChestSlugsOwned", 0, 0)))).toBe(1.5);
  });
  it("an Event Shop string that is missing is read as null, which holds no letter", () => {
    const c = variant((d) => setIn(d, "OptLacc", (o) => (o[311] = undefined)));
    expect(owned(c, 48)).toBe(0);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("VaultUpgBonus (N.js @10893206)", () => {
  // vault 63 is a plain vault 61..88: level x value x (1 + VaultUpgBonus(89) / 100); vault 89 itself is plain
  const vault = (levels: Record<number, number>) => variant((d) => setIn(d, "UpgVault", (u) => { for (const [k, v] of Object.entries(levels)) u[Number(k)] = v; }));
  const row = (b: number) => num(UpgradeVault[b][5]);
  it("vault 63 is level x value x (1 + vault 89 / 100)", () => {
    expect(Summoning(vault({ 63: 10, 89: 0 }), "VaultUpgBonus", 63, 0)).toBeCloseTo(10 * row(63), 9);
    expect(Summoning(vault({ 63: 10, 89: 20 }), "VaultUpgBonus", 63, 0)).toBeCloseTo(10 * row(63) * (1 + (20 * row(89)) / 100), 9);
  });
  it("a plain vault is level x value", () => {
    expect(Summoning(vault({ 89: 20 }), "VaultUpgBonus", 89, 0)).toBeCloseTo(20 * row(89), 9);
    expect(Summoning(vault({ 61: 3 }), "VaultUpgBonus", 61, 0)).toBeCloseTo(3 * row(61), 9);
    expect(Summoning(vault({ 6: 3 }), "VaultUpgBonus", 6, 0)).toBeCloseTo(3 * row(6), 9);
  });
  it("a vault the save has no level for counts 0 (c.asNumber)", () => {
    expect(Summoning(vault({}), "VaultUpgBonus", 89, 0)).toBeGreaterThanOrEqual(0);
    expect(Summoning(variant((d) => setIn(d, "UpgVault", (u) => (u.length = 63))), "VaultUpgBonus", 63, 0)).toBe(0);
  });
  it("a vault from 89 up that is not plain is 0", () => {
    expect(Summoning(vault({ 90: 5 }), "VaultUpgBonus", 90, 0)).toBe(0);
  });
  it("the vaults below 61 that are not plain are times Vault 32 (below 32) or 61; 0 and 60 add levels past their steps", () => {
    const value = (b: number) => Number(UpgradeVault[b][5]);
    const none = { 32: 0, 61: 0, 89: 0 }; // no multiplier vaults
    expect(Summoning(vault({ ...none, 2: 10 }), "VaultUpgBonus", 2, 0)).toBeCloseTo(10 * value(2), 12);
    expect(Summoning(vault({ ...none, 2: 10, 32: 4 }), "VaultUpgBonus", 2, 0)).toBeCloseTo(10 * value(2) * (1 + (4 * value(32)) / 100), 12);
    expect(Summoning(vault({ ...none, 45: 10, 61: 4 }), "VaultUpgBonus", 45, 0)).toBeCloseTo(10 * value(45) * (1 + (4 * value(61)) / 100), 12);
    expect(Summoning(vault({ ...none, 0: 60 }), "VaultUpgBonus", 0, 0)).toBeCloseTo(60 * value(0) + 35 + 10, 12); // past 25 and 50
    expect(Summoning(vault({ ...none, 60: 0 }), "VaultUpgBonus", 60, 0)).toBe(0);
  });
  it("a vault outside UpgradeVault is refused (the game reads its row)", () => {
    expect(() => Summoning(vault({}), "VaultUpgBonus", 999, 0)).toThrow(RangeError);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("GrimoireUpgBonus (N.js @10885504)", () => {
  it("a plain grimoire upgrade is level x value; the others are times 1 + upgrade 36 / 100 (Damage Task 7)", () => {
    const c = variant((d) => setIn(d, "Grimoire", (g) => ((g[17] = 4), (g[2] = 3))));
    expect(Summoning(c, "GrimoireUpgBonus", 17, 0)).toBe(4 * num(GrimoireUpg[17][5]));
    expect(Summoning(c, "GrimoireUpgBonus", 2, 0)).toBeCloseTo(3 * num(GrimoireUpg[2][5]) * (1 + Summoning(c, "GrimoireUpgBonus", 36, 0) / 100), 9);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("AchieveStatus (N.js @7792603)", () => {
  const ach = (reg: number | null, c: number) => AchieveStatus(variant((d) => setIn(d, "AchieveReg", (a) => (a[c] = reg))), c);
  it("is 0 until the achievement is done (AchieveReg == -1)", () => {
    expect(ach(0, 379)).toBe(0);
    expect(ach(null, 379)).toBe(0);
    expect(ach(-1, 379)).toBe(1);
  });
  it("is worth 5 for a few, 10 for 108 and 20 for 99, 104, 112", () => {
    for (const c of [4, 27, 37, 44, 107, 109, 117]) expect(ach(-1, c)).toBe(5);
    expect(ach(-1, 108)).toBe(10);
    for (const c of [99, 104, 112]) expect(ach(-1, c)).toBe(20);
    expect(ach(-1, 373)).toBe(1);
  });
  it("an achievement past the end of the list is not done", () => {
    expect(AchieveStatus(variant((d) => (d.AchieveReg = [-1])), 379)).toBe(0);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("Ninja PristineBon (N.js @10871214)", () => {
  const charm = (flag: unknown, b = 8) => Ninja(variant((d) => setIn(d, "Ninja", (n) => (n[107][b] = flag))), "PristineBon", b, 0);
  it("is the charm's bonus once found (Ninja[107][b] == 1), else 0", () => {
    expect(NjEQ.NjTrP8[3]).toBe("30");
    expect(charm(1)).toBe(30);
    expect(charm(0)).toBe(0);
    expect(charm(2)).toBe(0);
    expect(charm(1, 2)).toBe(num(NjEQ.NjTrP2[3]));
  });
  it("a charm the data does not have is refused", () => {
    expect(() => charm(1, 99)).toThrow(RangeError);
  });
});

// ── Arcade ──────────────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("ArcadeBonus / ArbitraryCode5Inputs (N.js @7881530, @4101084)", () => {
  const arcade = (d: number, level: number, companions: string[] = []) =>
    ArcadeBonus(variant((x) => setIn(x, "ArcadeUpg", (a) => (a[d] = level)), { env: (e) => (e.companion = { l: companions }) }), d);
  it("upgrade 51 is the 'add' curve: 0.2 per level", () => {
    expect(arcade(51, 0)).toBe(0);
    expect(arcade(51, 10)).toBeCloseTo(2, 12);
  });
  it("upgrade 59 is the 'decay' curve: 10 x level / (level + 100)", () => {
    expect(arcade(59, 100)).toBeCloseTo(5, 12);
  });
  it("the level 101 doubles it and 102 makes it 6 times (the level itself is read as 101 or 102)", () => {
    expect(arcade(51, 101)).toBeCloseTo(0.2 * 101 * 2, 9);
    expect(arcade(51, 102)).toBeCloseTo(0.2 * 102 * 6, 9);
    expect(arcade(51, 100)).toBeCloseTo(0.2 * 100, 9);
  });
  it("Companion 27 owned (its bonus is 1) doubles it", () => {
    expect(Companions(variant(() => {}, { env: (e) => (e.companion = { l: ["27,1,0,5,0"] }) }), 27)).toBe(1);
    expect(arcade(51, 10, ["27,1,0,5,0"])).toBeCloseTo(4, 12);
    expect(arcade(51, 102, ["27,1,0,5,0"])).toBeCloseTo(0.2 * 102 * 12, 9);
  });
  it("an upgrade the data does not have is refused", () => {
    expect(() => ArcadeBonus(variant(() => {}), 9999)).toThrow(RangeError);
  });
  it("every curve of ArbitraryCode5Inputs", () => {
    const f = (a: string, b: number, c: number, lv: number) => ArbitraryCode5Inputs(variant(() => {}), a, b, c, lv, 0, 0);
    expect(f("add", 2, 0, 10)).toBe(20);
    expect(f("add", 2, 4, 10)).toBeCloseTo((((2 + 4) / 4 + 0.5 * 9) / (2 / 4)) * 10 * 2, 9);
    expect(f("addLower", 2, 3, 4)).toBe(17);
    expect(f("addDECAY", 2, 3, 100)).toBe(200);
    expect(f("addDECAY", 2, 3, 100000)).toBeCloseTo(2 * 5e4 + ((1e5 - 5e4) / (15e4 + 5e4)) * 2 * 5e4, 6);
    expect(f("decay", 10, 100, 100)).toBe(5);
    expect(f("decayLower", 10, 100, 100)).toBeCloseTo((10 * 101) / 201 - 5, 12);
    expect(f("decayMulti", 10, 100, 100)).toBe(6);
    expect(f("decayMultiLower", 10, 100, 100)).toBeCloseTo((10 * 101) / 201 - 5, 12);
    expect(f("bigBase", 2, 3, 4)).toBe(14);
    expect(f("bigBaseLower", 2, 3, 4)).toBe(3);
    expect(f("intervalAdd", 2, 5, 12)).toBe(4);
    expect(f("intervalAddLower", 2, 5, 9)).toBe(1);
    expect(f("intervalAddLower", 2, 5, 8)).toBe(0);
    expect(f("reduce", 10, 2, 3)).toBe(4);
    expect(f("reduceLower", 10, 2, 3)).toBe(2);
    expect(f("PtsSpentOnGuildBonus", 2, 4, 10)).toBeCloseTo((((2 + 4) / 4 + 0.5 * 9) / (2 / 4)) * 10 * 2 - 40, 9);
    expect(f("nothing", 2, 4, 10)).toBe(0);
  });
});

// ── Arcane, Spelunk, Holes, Jelly, Sushi, Gaming ────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("ArcaneType / Spelunk / Holes / JellyOperation / SushiStuff / GamingStatType", () => {
  it("Arcane upgrade 48 is level x value (@11084516); e == 999 asks for something else (0); the non-plain ones are not ported", () => {
    const c = variant((d) => setIn(d, "Arcane", (a) => (a[48] = 10)));
    expect(ArcaneType(c, "ArcaneUpgBonus", 48, 0)).toBe(10 * num(ArcaneUpg[48][5]));
    expect(ArcaneType(c, "ArcaneUpgBonus", 48, 999)).toBe(0);
    expect(() => ArcaneType(c, "ArcaneUpgBonus", 2, 0)).toThrow(NotPorted);
  });
  it("lore note 8 (@11100719) is found when Spelunk[0][8] >= 1", () => {
    const lore = (v: number) => Spelunk(variant((d) => setIn(d, "Spelunk", (s) => (s[0][8] = v))), "DoWeHaveLoreN1", 8, 0);
    expect(lore(1)).toBe(1);
    expect(lore(3)).toBe(1);
    expect(lore(0)).toBe(0);
  });
  it("Cosmo upgrade (2, 3) is floor(value x level) (@11002068); (2, 1) is 3 to the level", () => {
    const cosmo = (level: number, b = 2, e = 3) => Holes(variant((d) => setIn(d, "Holes", (h) => (h[4 + b][e] = level))), "CosmoBonusQTY", b, e);
    expect(CosmoUpgrades[2][3][0]).toBe("6");
    expect(cosmo(0)).toBe(0);
    expect(cosmo(2)).toBe(12);
    expect(cosmo(2.5)).toBe(15);
    expect(cosmo(3, 2, 1)).toBe(27);
    expect(cosmo(0, 2, 1)).toBe(1); // max(1, 3^0)
  });
  it("Jelly upgrade b (@5168369) is on while Research[7][9] is past b; Sushi upgrade b (@11218643) while the unique sushi are", () => {
    const jelly = (past: number, b = 28, e = 0) => JellyOperation(variant((d) => setIn(d, "Research", (r) => (r[7][9] = past))), "RoG_BonusQTY", b, e);
    const r47 = (i: number) => num(ResearchLists[47][i]);
    expect(r47(28)).toBeGreaterThan(0);
    expect(jelly(29)).toBe(r47(28));
    expect(jelly(28)).toBe(0); // not past
    expect(jelly(0, 28, 99)).toBe(r47(28)); // e == 99 asks regardless
    expect(jelly(40, 33)).toBe(r47(33));
    const sushi = (found: number, b = 50) => SushiStuff(variant((d) => setIn(d, "Sushi", (s) => (s[5] = Array.from({ length: 64 }, (_, i) => (i < found ? 1 : -1))))), "RoG_BonusQTY", b, 0);
    expect(sushi(51)).toBe(num(ResearchLists[37][50]));
    expect(sushi(50)).toBe(0);
  });
  it("UniqueSushi counts the tiers found in a row from 0 (at most MaxTier + 1 = 64)", () => {
    const unique = (list: number[]) => SushiStuff(variant((d) => setIn(d, "Sushi", (s) => (s[5] = list))), "UniqueSushi", 0, 0);
    expect(SushiStuff(variant(() => {}), "MaxTier", 0, 0)).toBe(63);
    expect(unique([0, 1, 5, -1, 3])).toBe(3); // 0 counts, the -1 stops it
    expect(unique([-1])).toBe(0);
    expect(unique([])).toBe(64); // a tier the list lacks is asNumber(null) = 0, which is >= 0
    // ... and that zero is visible: an (absent) leaf per tier read
    const c = variant((d) => setIn(d, "Sushi", (s) => (s[5] = [0, 1])), { trace: true });
    expect(SushiStuff(c, "UniqueSushi", 0, 0)).toBe(64);
    expect(absentLeaves(c.trace!)).toEqual(Array.from({ length: 62 }, (_, i) => `Sushi[5][${i + 2}]`));
    expect(unique(Array(100).fill(1))).toBe(64);
  });
  it("Super Bit b is owned when its letter is in Gaming[12]", () => {
    const bit = (g: string, b: number) => GamingStatType(variant((d) => setIn(d, "Gaming", (x) => (x[12] = g))), "SuperBitType", b, 0);
    expect(bit(Number2Letter[59], 59)).toBe(1);
    expect(bit("abc", 59)).toBe(0);
    expect(bit(Number2Letter[49], 49)).toBe(1);
  });
  // PaletteBonus b: level L = Spelunk[9][b]; shade 32 is the 'diminishing' kind (GamingPalette[32][5] == 1) with value 10
  const palette = (o: { level?: number; super49?: boolean; lore?: number; legend10?: number; spelunk49?: number; b?: number; gaming?: string } = {}, b = 32) =>
    GamingStatType(
      variant((d) => {
        setIn(d, "Spelunk", (s) => {
          s[9] = Array(37).fill(0);
          s[9][b] = o.level ?? 25;
          s[49] = Array(37).fill(0);
          s[49][b] = o.spelunk49 ?? 0;
          s[0][8] = o.lore ?? 0;
          s[18][10] = o.legend10 ?? 0;
        });
        setIn(d, "Gaming", (g) => (g[12] = o.gaming ?? ""));
      }),
      "PaletteBonus",
      b,
      0
    );
  it("Palette 32 is L / (L + 25) x 10 (@10734871)", () => {
    expect(palette({ level: 25 })).toBeCloseTo(5, 12);
    expect(palette({ level: 0 })).toBe(0);
  });
  it("times legend talent 10, Spelunk[49], lore note 8", () => {
    expect(palette({ level: 25, legend10: 4 })).toBeCloseTo(5 * (1 + (4 * num(LegendTalents[10][2])) / 100), 12);
    expect(palette({ level: 25, spelunk49: 3 })).toBeCloseTo(5 * (1 + 3 + 1), 12);
    expect(palette({ level: 25, lore: 1 })).toBeCloseTo(5 * 1.5, 12);
  });
  it("the shades Super Bit 49/51/52/54/58/61 double (2 + .5 x Super Bit 59) are 25, 13, 31, 18, 3, 12", () => {
    const shade = (g: number, lv: number) => (num(GamingPalette[g][5]) === 1 ? (lv / (lv + 25)) * num(GamingPalette[g][4]) : lv * num(GamingPalette[g][4]));
    expect(palette({ level: 25 }, 25)).toBeCloseTo(shade(25, 25), 9);
    expect(palette({ level: 25, gaming: Number2Letter[49] }, 25)).toBeCloseTo(shade(25, 25) * 2, 9);
    expect(palette({ level: 25, gaming: Number2Letter[49] + Number2Letter[59] }, 25)).toBeCloseTo(shade(25, 25) * 2.5, 9);
    expect(palette({ level: 25, gaming: Number2Letter[59] }, 25)).toBeCloseTo(shade(25, 25), 9); // Super Bit 59 alone doubles nothing
    expect(palette({ level: 25, gaming: Number2Letter[49] }, 24)).toBeCloseTo(shade(24, 25), 9); // shade 24 is not the one Super Bit 49 doubles
    for (const [bit, g] of [[51, 13], [52, 31], [54, 18], [58, 3], [61, 12]]) expect(palette({ level: 25, gaming: Number2Letter[bit] }, g), `bit ${bit}`).toBeCloseTo(shade(g, 25) * 2, 9);
  });
  it("-1 is 0, and a shade the table does not have is refused", () => {
    expect(palette({}, 32) >= 0).toBe(true);
    expect(GamingStatType(variant(() => {}), "PaletteBonus", -1, 0)).toBe(0);
    expect(GamingStatType(variant(() => {}), "PaletteBonus", 37, 0)).toBeGreaterThanOrEqual(0); // the table's 38th entry: the total level
    expect(() => GamingStatType(variant(() => {}), "PaletteBonus", 38, 0)).toThrow(RangeError);
  });
});

// ── Thingies ────────────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("Thingies (N.js @10955095)", () => {
  it("Have_ban_i is 1 once the Bundle ban_i is received (@10978278); an absent bundle is not received", () => {
    const ban = (b: Record<string, number>) => Thingies(variant((d) => (d.BundlesReceived = b)), "Have_ban_i", 0, 0);
    expect(ban({ ban_i: 1 })).toBe(1);
    expect(ban({ ban_i: 0 })).toBe(0);
    expect(ban({ ban_j: 1 })).toBe(0);
    expect(ban({})).toBe(0);
  });
  // Ruling H: the loader getLoadMap("BundlesReceived") @19927310 has no CSver gate, so a save without the key is an account that never bought
  // a bundle: the empty map, which holds no ban_i. Only this read does that; Ruling E still refuses the CSver-gated keys.
  it("a save without the BundlesReceived key is the loader's empty map: ban_i is not received, shown in the trace as an absent leaf", () => {
    const c = variant((d) => delete d.BundlesReceived, { trace: true });
    expect(Thingies(c, "Have_ban_i", 0, 0)).toBe(0);
    const leaf = (n: TraceNode): TraceNode | undefined => n.children.find((x) => x.block === "(absent)") ?? n.children.map(leaf).find(Boolean);
    expect(leaf(c.trace!)?.note).toBe('absent: getLoadMap("BundlesReceived") @19927310 → {}');
    // a present map leaves no such leaf
    const present = variant((d) => (d.BundlesReceived = { ban_i: 1 }), { trace: true });
    expect(Thingies(present, "Have_ban_i", 0, 0)).toBe(1);
    expect(leaf(present.trace!)).toBeUndefined();
  });
  it("the win3 Winner Bonus follows: no BundlesReceived key gives the bonus with ban_i at 0", () => {
    const without = variant((d) => delete d.BundlesReceived);
    const withEmpty = variant((d) => (d.BundlesReceived = {}));
    expect(Summoning(without, "WinBonus", 3, 0)).toBe(Summoning(withEmpty, "WinBonus", 3, 0));
  });
  it("other keys stay strict: a CSver-gated key (Arcane) is still refused", () => {
    expect(() => Summoning(variant((d) => delete d.Arcane), "WinBonus", 3, 0)).toThrow(MissingSaveKey);
  });
  it("ClamWorkBonus b is on while OptionsListAccount[464] is past b (@10969070)", () => {
    const clam = (v: number) => Thingies(variant((d) => setIn(d, "OptLacc", (o) => (o[464] = v))), "ClamWorkBonus", 3, 0);
    expect(clam(4)).toBe(1);
    expect(clam(3)).toBe(0);
  });
  // EmperorBon: fight g (OptionsListAccount[369] of them) gives EmperorBon[1][bucket] to bucket EmperorBon[2][g % 48]
  const emperor = (fights: number, o: { arcane?: number; arcade?: number; jelly?: number } = {}) =>
    Thingies(
      variant(
        (d) => {
          setIn(d, "OptLacc", (x) => (x[369] = fights));
          setIn(d, "Arcane", (a) => (a[48] = o.arcane ?? 0));
          setIn(d, "ArcadeUpg", (a) => (a[51] = o.arcade ?? 0));
          setIn(d, "Research", (r) => (r[7][9] = o.jelly ?? 0));
        },
        { env: (e) => (e.companion = { l: [] }) } // no Companion 27: it would double the Arcade bonus
      ),
      "EmperorBon",
      8,
      0
    );
  const bucket8 = (fights: number) => {
    let n = 0;
    for (let g = 0; g < fights; g++) if (num((EmperorBon as any)[2][g % 48]) === 8) n += num((EmperorBon as any)[1][8]);
    return n;
  };
  it("sums the gain of every fight that falls in bucket 8 (the 48-fight cycle repeats)", () => {
    expect(emperor(0)).toBe(0);
    expect(bucket8(31)).toBe(0);
    expect(emperor(31)).toBe(0);
    expect(emperor(32)).toBe(bucket8(32));
    expect(bucket8(32)).toBeGreaterThan(0);
    expect(emperor(32 + 48)).toBe(bucket8(80));
    expect(bucket8(80)).toBe(2 * bucket8(32));
  });
  it("times 1 + (Arcane 48 + Arcade 51 + Jelly 28) / 100, rounded down", () => {
    const base = bucket8(32 + 48 * 49); // 50 hits: a base big enough to see the multiplier
    expect(emperor(32 + 48 * 49)).toBe(base);
    expect(emperor(32 + 48 * 49, { arcane: 2 })).toBe(Math.floor(base * (1 + (2 * num(ArcaneUpg[48][5])) / 100)));
    expect(emperor(32 + 48 * 49, { jelly: 29 })).toBe(Math.floor(base * (1 + num(ResearchLists[47][28]) / 100)));
    expect(emperor(32 + 48 * 49, { arcade: 10 })).toBe(Math.floor(base * (1 + 2 / 100))); // 0.2 per level
    expect(emperor(32 + 48 * 49, { arcane: 2, jelly: 29, arcade: 10 })).toBe(Math.floor(base * (1 + (2 * num(ArcaneUpg[48][5]) + num(ResearchLists[47][28]) + 2) / 100)));
  });
});

// ── GetSetBonus ─────────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("GetSetBonus GODSHARD_SET (N.js @11096567)", () => {
  const SET = (EquipmentSets as any).GODSHARD_SET as string[][];
  const [armor, tools, weapons, meta] = SET;
  // EquipmentOrder_<ci> = [worn, tools, ...], each a {"0": name, …} map in the save
  const wear = (o: { worn?: string[]; tools?: string[]; unlocked?: string; ci?: number }) =>
    variant(
      (d) => {
        setIn(d, `EquipOrder_${o.ci ?? 0}`, (e) => {
          e[0] = Object.fromEntries((o.worn ?? []).map((n, i) => [`${i}`, n]));
          e[1] = Object.fromEntries((o.tools ?? []).map((n, i) => [`${i}`, n]));
        });
        setIn(d, "OptLacc", (x) => (x[379] = o.unlocked ?? "0,IRON_SET"));
      },
      { ci: o.ci }
    );
  const bonus = (c: Ctx) => GetSetBonus(c, "GODSHARD_SET", "Bonus", 0, 0);
  const whole = { worn: [...armor, weapons[0]], tools };
  it("the set's bonus (15) once every part is worn: the 4 pieces, 6 tools and a weapon", () => {
    expect(num(meta[2])).toBe(15);
    expect(GetSetBonus(wear(whole), "GODSHARD_SET", "PartsReq", 0, 0)).toBe(11);
    expect(GetSetBonus(wear(whole), "GODSHARD_SET", "PartsOn", 0, 0)).toBe(11);
    expect(bonus(wear(whole))).toBe(15);
  });
  it("a part short gives 0", () => {
    expect(bonus(wear({ worn: [...armor, weapons[0]], tools: tools.slice(1) }))).toBe(0);
    expect(bonus(wear({ worn: [...armor.slice(1), weapons[0]], tools }))).toBe(0);
    expect(bonus(wear({ worn: armor, tools }))).toBe(0); // no weapon
    expect(GetSetBonus(wear({ worn: armor, tools }), "GODSHARD_SET", "PartsOn", 0, 0)).toBe(10);
  });
  it("any of the 4 weapons completes it, and only one counts", () => {
    expect(bonus(wear({ worn: [...armor, weapons[3]], tools }))).toBe(15);
    expect(GetSetBonus(wear({ worn: [...armor, ...weapons], tools }), "GODSHARD_SET", "PartsOn", 0, 0)).toBe(11);
  });
  it("a tool counts at most [3][0] times: GODSHARD_SET allows its 6, COPPER_SET has 6 tools and a cap of 1", () => {
    expect(GetSetBonus(wear({ worn: [], tools: [...tools, ...tools] }), "GODSHARD_SET", "PartsOn", 0, 0)).toBe(6);
    const [cPieces, cTools, cWeapons, cMeta] = (EquipmentSets as any).COPPER_SET as string[][];
    expect([cTools.length, num(cMeta[0])]).toEqual([6, 1]);
    expect(GetSetBonus(wear({ worn: cPieces, tools: cTools }), "COPPER_SET", "PartsOn", 0, 0)).toBe(cPieces.length + 1);
    expect(GetSetBonus(wear({ worn: cPieces, tools: cTools }), "COPPER_SET", "PartsReq", 0, 0)).toBe(cPieces.length + 1);
    expect(GetSetBonus(wear({ worn: cPieces, tools: cTools }), "COPPER_SET", "Bonus", 0, 0)).toBe(num(cMeta[2]));
    expect(GetSetBonus(wear({ worn: cPieces, tools: [] }), "COPPER_SET", "Bonus", 0, 0)).toBe(0);
    void cWeapons;
  });
  it("the weapon of [2] counts only when [3][1] is 1: COPPER_SET's list is [\"none\"] and its flag 0", () => {
    const [, , cWeapons, cMeta] = (EquipmentSets as any).COPPER_SET as string[][];
    expect([cWeapons, num(cMeta[1])]).toEqual([["none"], 0]);
    expect(GetSetBonus(wear({ worn: ["none"], tools: [] }), "COPPER_SET", "PartsOn", 0, 0)).toBe(0);
  });
  it("being named in OptionsListAccount[379] unlocks it for good, worn or not", () => {
    expect(bonus(wear({ unlocked: "0,IRON_SET,GODSHARD_SET" }))).toBe(15);
    expect(bonus(wear({ unlocked: "0,GODSHARD_SET_2" }))).toBe(0); // the whole name, not a substring
  });
  it("is per character: another character wears another set", () => {
    const c = variant((d) => {
      setIn(d, "EquipOrder_0", (e) => ((e[0] = {}), (e[1] = {})));
      setIn(d, "EquipOrder_1", (e) => {
        e[0] = Object.fromEntries(whole.worn.map((n, i) => [`${i}`, n]));
        e[1] = Object.fromEntries(whole.tools.map((n, i) => [`${i}`, n]));
      });
      setIn(d, "OptLacc", (x) => (x[379] = "0,IRON_SET"));
    });
    expect(bonus(withPlayer(c, 1))).toBe(15);
    expect(bonus(withPlayer(c, 0))).toBe(0);
  });
  it("only the Bonus, PartsOn and PartsReq asks are ported; a set the data lacks is refused", () => {
    expect(() => GetSetBonus(wear({}), "GODSHARD_SET", "PermaUnlockAfford", 0, 0)).toThrow(NotPorted);
    expect(() => GetSetBonus(wear({}), "NO_SET", "Bonus", 0, 0)).toThrow(RangeError);
  });
});

// ── WinBonus ────────────────────────────────────────────────────────────────────────────────────
// bucket(x): the sum the game's SummWinBonus holds for Winner Bonus x, computed straight from the data tables
describe.skipIf(GOLDEN_SAVES.length === 0)("WinBonus (N.js @10927394)", () => {
  const E = SummonEnemies as unknown as string[][];
  const enemyIn = (bucket: number) => E[5].findIndex((x) => Math.round(num(x) - 1) === bucket);
  const roundsFor = (bucket: number) => E[9].findIndex((x) => Math.round(num(x) - 1) === bucket) + 1;
  /** Every Winner Bonus 0 -- the ingredients are put back one at a time. */
  const win = (
    o: { beaten?: string[]; rounds?: number; ninja8?: number; gem11?: number; art32?: number; task?: number; ach379?: boolean; ach373?: boolean; fights?: number; godshard?: boolean; ban?: number } = {},
    b = 3,
    trace = false
  ) =>
    Summoning(
      variant(
        (d) => {
          setIn(d, "Summon", (s) => (s[1] = o.beaten ?? []));
          setIn(d, "OptLacc", (x) => {
            x[319] = o.rounds ?? 0;
            x[369] = o.fights ?? 0;
            x[379] = o.godshard ? "0,GODSHARD_SET" : "0,IRON_SET";
          });
          setIn(d, "Ninja", (n) => (n[107][8] = o.ninja8 ?? 0));
          setIn(d, "GemItemsPurchased", (g) => (g[11] = o.gem11 ?? 0));
          setIn(d, "Sailing", (s) => (s[3][32] = o.art32 ?? 0));
          setIn(d, "TaskZZ2", (t) => (t[5][4] = o.task ?? 0));
          setIn(d, "AchieveReg", (a) => ((a[379] = o.ach379 ? -1 : 0), (a[373] = o.ach373 ? -1 : 0)));
          setIn(d, "Arcane", (a) => (a[48] = 0));
          setIn(d, "ArcadeUpg", (a) => (a[51] = 0));
          setIn(d, "Research", (r) => (r[7][9] = 0));
          setIn(d, "EquipOrder_0", (e) => ((e[0] = {}), (e[1] = {})));
          d.BundlesReceived = { ban_i: o.ban ?? 0 };
        },
        { trace }
      ),
      "WinBonus",
      b,
      0
    );
  const ratB = E[0][enemyIn(3)]; // a Summoning enemy whose win goes to Winner Bonus 3
  const ratBValue = num(E[7][enemyIn(3)]);
  it("the data has an enemy for Winner Bonus 3 and Endless rounds for 22 and 31", () => {
    expect(enemyIn(3)).toBeGreaterThanOrEqual(0);
    expect(roundsFor(22)).toBeGreaterThan(0);
    expect(roundsFor(31)).toBeGreaterThan(0);
    expect(ratBValue).toBeGreaterThan(0);
  });
  it("is 3.5 x the bucket when nothing boosts it", () => {
    expect(win()).toBe(0);
    expect(win({ beaten: [ratB] })).toBeCloseTo(3.5 * ratBValue, 12);
    expect(win({ beaten: [ratB, ratB] })).toBeCloseTo(3.5 * 2 * ratBValue, 12); // each win counts
  });
  it("rift enemies add nothing (the data gives them bucket 19 and a value of 0), and an enemy the table does not know changes no bucket", () => {
    // N.js skips the names starting with "rift" (0 != indexOf("rift")); with these values the skip cannot change a number, so it is not observable here
    for (const n of ["rift1", "rift2", "rift3", "rift4", "rift5"]) expect(num(E[7][E[0].indexOf(n)])).toBe(0);
    expect(win({ beaten: [ratB, "rift1", "rift_x"] })).toBeCloseTo(3.5 * ratBValue, 12);
    expect(win({ beaten: [ratB, "NotAnEnemy"] })).toBeCloseTo(3.5 * ratBValue, 12);
  });
  it("each Endless round adds its table's value to its bucket, and the tables repeat every 40 rounds", () => {
    const r = roundsFor(3);
    const sumFor = (n: number, bucket: number) => { let s = 0; for (let g = 0; g < n; g++) if (Math.round(num(E[9][g % 40]) - 1) === bucket) s += num(E[10][g % 40]); return s; };
    if (r > 0) {
      expect(win({ rounds: r })).toBeCloseTo(3.5 * sumFor(r, 3), 12);
      expect(win({ rounds: r + 80 })).toBeCloseTo(3.5 * sumFor(r + 80, 3), 12);
      expect(sumFor(r + 80, 3)).toBeGreaterThan(sumFor(r, 3));
    }
    // the buckets 22 and 31 are answered as they are
    expect(win({ rounds: roundsFor(22) }, 22)).toBe(sumFor(roundsFor(22), 22));
    expect(win({ rounds: roundsFor(31) }, 31)).toBe(sumFor(roundsFor(31), 31));
  });
  const withBase = (extra: Parameters<typeof win>[0]) => win({ beaten: [ratB], ...extra });
  const base = 3.5 * ratBValue;
  it("x (1 + the Ninja pristine charm 8 (30) / 100)", () => {
    expect(withBase({ ninja8: 1 })).toBeCloseTo(base * 1.3, 12);
  });
  it("x (1 + 10 x gem-shop purchase 11 / 100)", () => {
    expect(withBase({ gem11: 3 })).toBeCloseTo(base * 1.3, 12);
  });
  it("x (1 + (… the boosts …) / 100): Artifact 32, Tasks[2][5][4] (at most 10), the achievements, the Winner Bonus 31 bucket, ban_i, the God Shard set", () => {
    expect(withBase({ art32: 1 })).toBeCloseTo(base * (1 + 25 / 100), 12); // ArtifactInfo[32] = 25 per tier
    expect(withBase({ art32: 3 })).toBeCloseTo(base * (1 + 75 / 100), 12);
    expect(withBase({ task: 4 })).toBeCloseTo(base * (1 + 4 / 100), 12);
    expect(withBase({ task: 15 })).toBeCloseTo(base * (1 + 10 / 100), 12); // capped
    expect(withBase({ ach379: true })).toBeCloseTo(base * (1 + 1 / 100), 12);
    expect(withBase({ ach373: true, ach379: true })).toBeCloseTo(base * (1 + 2 / 100), 12);
    expect(withBase({ ban: 1 })).toBeCloseTo(base * (1 + 50 / 100), 12);
    expect(withBase({ godshard: true })).toBeCloseTo(base * (1 + 15 / 100), 12);
    expect(withBase({ rounds: roundsFor(31) })).toBeCloseTo(win({ beaten: [ratB], rounds: roundsFor(31) }), 12);
    // the bucket 31 boost is its value over 100; the rounds that fill it also fill other buckets, so compare with the 3's own growth
    const r = roundsFor(31);
    let b31 = 0, b3 = 0;
    for (let g = 0; g < r; g++) {
      const bk = Math.round(num(E[9][g % 40]) - 1);
      if (bk === 31) b31 += num(E[10][g % 40]);
      if (bk === 3) b3 += num(E[10][g % 40]);
    }
    expect(win({ beaten: [ratB], rounds: r })).toBeCloseTo(3.5 * (ratBValue + b3) * (1 + b31 / 100), 12);
  });
  it("the Emperor bonus 8 adds its fights' gain (rounded down) to the boosts", () => {
    const g = EmperorBon as any;
    let hits = 0;
    for (let i = 0; i < 80; i++) if (num(g[2][i % 48]) === 8) hits += num(g[1][8]);
    expect(withBase({ fights: 80 })).toBeCloseTo(base * (1 + Math.floor(hits) / 100), 12);
  });
  it("all together", () => {
    expect(withBase({ ninja8: 1, gem11: 1, art32: 1, task: 4, ach379: true, ach373: true, ban: 1, godshard: true })).toBeCloseTo(
      base * 1.3 * 1.1 * (1 + (25 + 4 + 1 + 1 + 50 + 15) / 100),
      12
    );
  });
  it("-1 is 0; 19 and 20..33 (but 20, 22, 24, 31) have shapes of their own, ported: 0 with no Summoning win", () => {
    expect(win({ beaten: [ratB] }, -1)).toBe(0);
    for (const b of [19, 21, 23, 25, 30, 33]) expect(win({}, b), `bonus ${b}`).toBe(0);
    expect(win({}, 20)).toBe(0);
    expect(win({}, 24)).toBe(0);
  });
  it("Tasks[2][5] missing is refused, as the game indexes Tasks[2][5][4]", () => {
    expect(() => Summoning(variant((d) => setIn(d, "TaskZZ2", (t) => (t.length = 5))), "WinBonus", 3, 0)).toThrow(MissingSaveKey);
  });
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("calls what N.js calls", () => {
    const fn = njsFunction(loadNjs(), "Summoning")!;
    const expected = njsCalls(njsNamedBlocks(fn.body, "WinBonus").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = variant(() => {}, { trace: true });
    Summoning(c, "WinBonus", 3, 0);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

// ── the vote ────────────────────────────────────────────────────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0)("VotingBonusz / VotingBonuszMulti / Meritoc (N.js @10953438, @10954376, @10932012)", () => {
  /** BASE with `active` as the server's voteCategories (and `companions` as the account's companion list, when given). */
  const vote = (active: unknown, o: { trace?: boolean; edit?: (d: Data) => void; companions?: string[] } = {}) =>
    variant((d) => o.edit?.(d), {
      trace: o.trace,
      env: (e) => {
        e.serverVars = e.serverVars ?? {};
        e.serverVars.voteCategories = active;
        if (o.companions) e.companion = { l: o.companions };
      },
    });
  const base20 = num(NinjaInfo[38][61]); // NinjaInfo[38][1 + 3 x 20]
  const v20 = (c: Ctx) => Summoning(c, "VotingBonusz", 20, 0);
  const multi = (c: Ctx) => Summoning(c, "VotingBonuszMulti", 0, 0);

  it("vote 20 in force gives base x multi; any other vote in force gives 0", () => {
    expect(base20).toBe(31);
    const c = vote([20, 24, 27, 32]);
    expect(multi(c)).toBeGreaterThan(1);
    expect(v20(c)).toBeCloseTo(base20 * multi(c), 9);
    expect(v20(vote([24, 20, 27, 32]))).toBe(0); // only the first of the server's categories is in force
    expect(v20(vote([1, 2, 3, 4]))).toBe(0);
    expect(v20(vote([21, 20]))).toBe(0);
  });
  it("the multi does not depend on which vote is in force", () => {
    expect(multi(vote([5, 20]))).toBe(multi(vote([20, 5])));
  });
  it("the vote in force is compared loosely (a server list of text works)", () => {
    expect(v20(vote(["20"]))).toBeCloseTo(base20 * multi(vote(["20"])), 9);
    expect(v20(vote(["20"]))).toBeGreaterThan(0);
  });
  it("an empty server list leaves the game's default list [1, 2, 3, 4]: vote 1 is in force, so vote 20 is 0", () => {
    expect(v20(vote([]))).toBe(0);
  });
  it("vote 1 in force counts it (its world rule is ported in Damage Task 7, accountEdges.test.ts)", () => {
    expect(Summoning(vote([1]), "VotingBonusz", 1, 0)).toBeGreaterThan(0);
  });
  it("without a server answer (serverVars null) no vote is known to be in force: 0, shown in the trace as not counted", () => {
    const c = variant(() => {}, { trace: true, env: (e) => (e.serverVars = null) });
    expect(v20(c)).toBe(0);
    const notCounted = (n: TraceNode): boolean => n.children.some((x) => x.note?.startsWith("runtime:") || notCounted(x));
    expect(notCounted(c.trace!)).toBe(true);
  });
  it("serverVars without voteCategories is refused, not read as no vote; a non-list is refused too", () => {
    expect(() => v20(variant(() => {}, { env: (e) => (e.serverVars = { other: 1 }) }))).toThrow(MissingSaveKey);
    expect(() => v20(vote("20"))).toThrow(InvalidSaveValue);
    expect(() => v20(vote({ 0: 20 }))).toThrow(InvalidSaveValue);
  });
  it("the vote's multi is not read while another vote is in force (nothing of Spelunk, which older saves lack)", () => {
    expect(v20(vote([24], { edit: (d) => delete d.Spelunk }))).toBe(0);
    expect(() => v20(vote([20], { edit: (d) => delete d.Spelunk }))).toThrow(MissingSaveKey);
  });

  // The multi with everything that feeds it zeroed, which is 1; then one ingredient at a time.
  type Meritoc = { active?: boolean; kla?: number; canVote?: number; clam?: number; legend24?: number; jelly?: number; arcade59?: number };
  type Feed = { comp?: string[]; dream?: number; shop?: string; cosmo?: number; beaten?: string[]; rounds?: number; gaming?: string; level?: number; legend22?: number; sushi?: number; meritoc?: Meritoc; edit?: (d: Data) => void };
  const multiCtx = (o: Feed = {}) =>
    vote([20], {
      companions: o.comp ?? [],
      edit: (d) => {
        setIn(d, "OptLacc", (x) => {
          x[606] = "";
          x[311] = o.shop ?? "";
          x[319] = o.rounds ?? 0;
          x[453] = o.meritoc?.active ? 9 : 0;
          x[472] = o.meritoc?.canVote ?? 0;
          x[464] = o.meritoc?.clam ?? 0;
        });
        setIn(d, "Dream", (x) => (x[13] = o.dream ?? 0));
        setIn(d, "Holes", (h) => (h[6][3] = o.cosmo ?? 0));
        setIn(d, "Summon", (s) => (s[1] = o.beaten ?? []));
        setIn(d, "Gaming", (g) => (g[12] = o.gaming ?? ""));
        setIn(d, "Spelunk", (s) => {
          s[9] = Array(37).fill(0);
          s[9][32] = o.level ?? 0;
          s[49] = Array(37).fill(0);
          s[0][8] = 0;
          s[18][10] = 0;
          s[18][22] = o.legend22 ?? 0;
          s[18][24] = o.meritoc?.legend24 ?? 0;
        });
        setIn(d, "Sushi", (s) => (s[5] = Array.from({ length: 64 }, (_, i) => (i < (o.sushi ?? 0) ? 1 : -1))));
        setIn(d, "Research", (r) => (r[7][9] = o.meritoc?.jelly ?? 0));
        setIn(d, "ArcadeUpg", (a) => (a[59] = o.meritoc?.arcade59 ?? 0));
        setIn(d, "KLA_0", (k) => (k[250][0] = o.meritoc?.kla ?? 0));
        o.edit?.(d);
      },
    });
  const multiOf = (o: Feed = {}) => multi(multiCtx(o));
  const E = SummonEnemies as unknown as string[][];
  /** Rounds that fill Winner Bonus 22 from the Endless tables, and the value they add (computed straight from the data). */
  const win22 = () => {
    const rounds = E[9].findIndex((x) => Math.round(num(x) - 1) === 22) + 1;
    let value = 0;
    for (let g = 0; g < rounds; g++) if (Math.round(num(E[9][g % 40]) - 1) === 22) value += num(E[10][g % 40]);
    return { rounds, value };
  };

  it("is 1 with nothing feeding it", () => {
    expect(multiOf()).toBe(1);
  });
  it("Dream[13] and Cosmo upgrade (2, 3), floor(6 x level), add as percents", () => {
    expect(multiOf({ dream: 31 })).toBeCloseTo(1.31, 12);
    expect(multiOf({ cosmo: 2 })).toBeCloseTo(1.12, 12);
  });
  it("17 per Event Shop item 7, 13 per item 16", () => {
    expect(multiOf({ shop: Number2Letter[7] })).toBeCloseTo(1.17, 12);
    expect(multiOf({ shop: Number2Letter[16] })).toBeCloseTo(1.13, 12);
    expect(multiOf({ shop: Number2Letter[7] + Number2Letter[16] })).toBeCloseTo(1.3, 12);
  });
  it("Palette 32, Spelunk legend talent 22 (25 per level), Sushi 50, Winner Bonus 22", () => {
    expect(multiOf({ level: 25 })).toBeCloseTo(1.05, 12);
    expect(multiOf({ legend22: 2 })).toBeCloseTo(1.5, 12);
    expect(multiOf({ sushi: 51 })).toBeCloseTo(1 + num(ResearchLists[37][50]) / 100, 12);
    const w = win22();
    expect(w.rounds).toBeGreaterThan(0);
    expect(multiOf({ rounds: w.rounds })).toBeCloseTo(1 + w.value / 100, 12);
  });
  it("Companions 41 and 19 add as percents; Companion 161 multiplies the whole", () => {
    const owns = (id: number) => Companions(multiCtx({ comp: [`${id},1,0,0,0`] }), id);
    const [c161, c41, c19] = [owns(161), owns(41), owns(19)];
    expect([c161, c41, c19].every((v) => v > 0)).toBe(true);
    expect(multiOf({ comp: ["161,1,0,0,0"] })).toBeCloseTo(1 + c161 / 100, 12);
    expect(multiOf({ comp: ["41,1,0,0,0"] })).toBeCloseTo(1 + c41 / 100, 12);
    expect(multiOf({ comp: ["19,1,0,0,0"] })).toBeCloseTo(1 + c19 / 100, 12);
    expect(multiOf({ comp: ["161,1,0,0,0", "41,1,0,0,0"], dream: 10 })).toBeCloseTo((1 + c161 / 100) * (1 + (c41 + 10) / 100), 12);
  });
  describe("Meritoc 9 (@10932012, MeritocBonuszMulti @10932455)", () => {
    // M9 = NinjaInfo[41][28] x MeritocMulti while OptionsListAccount[453] == 9, and MeritocMulti = (1 + C161 / 100) x
    // (min(1, max(.25, .25 + canVote)) + boosts / 100) once the character's KillsLeft2Advance[250][0] is used up
    const nj = num(NinjaInfo[41][28]);
    const merit = (m: Meritoc, more: Feed = {}) => multiOf({ ...more, meritoc: { active: true, ...m } });
    it("is 0 while another Meritoc bonus is in force: the multi stays 1", () => {
      expect(multiOf({ meritoc: { active: false } })).toBe(1);
    });
    it("is NinjaInfo[41][28] x 0.25 when nobody can vote and nothing boosts it", () => {
      expect(nj).toBe(100);
      expect(merit({})).toBeCloseTo(1 + (nj * 0.25) / 100, 12);
    });
    it("the vote right (OptionsListAccount[472] == 1) lifts the .25 to 1", () => {
      expect(merit({ canVote: 1 })).toBeCloseTo(1 + (nj * 1) / 100, 12);
    });
    it("the boosts add to the factor as boosts / 100 (N.js's precedence), and min(1, …) clamps only the .25 + vote part", () => {
      expect(merit({ clam: 4 })).toBeCloseTo(1 + (nj * (0.25 + 5 / 100)) / 100, 12); // Clam Work 3: 5
      expect(merit({ legend24: 2 })).toBeCloseTo(1 + (nj * (0.25 + 40 / 100)) / 100, 12); // LegendTalents[24] = 20 per level
      expect(merit({ jelly: 40 })).toBeCloseTo(1 + (nj * (0.25 + 1 / 100)) / 100, 12); // Jelly 33 = 1
      expect(merit({ canVote: 1, clam: 4 })).toBeCloseTo(1 + (nj * (1 + 5 / 100)) / 100, 12);
    });
    it("the Event Shop item 23 adds 20, Arcade 59 adds its bonus (10 x level / (level + 100))", () => {
      expect(merit({}, { shop: Number2Letter[23] })).toBeCloseTo(1 + (nj * (0.25 + 20 / 100)) / 100, 12);
      expect(merit({ arcade59: 100 })).toBeCloseTo(1 + (nj * (0.25 + 5 / 100)) / 100, 12);
    });
    it("Companion 161 multiplies the Meritoc multi too", () => {
      const c161 = Companions(multiCtx({ comp: ["161,1,0,0,0"] }), 161);
      const meritMulti = (1 + c161 / 100) * 0.25; // C161 scales the whole factor: (1 + C161 / 100) x (.25 + 0)
      expect(merit({}, { comp: ["161,1,0,0,0"] })).toBeCloseTo((1 + c161 / 100) * (1 + (nj * meritMulti) / 100), 12);
    });
    it("is 0 while the character still has kills left on map 250's portal (KillsLeft2Advance[250][0] > 0)", () => {
      expect(merit({ kla: 3 })).toBe(1);
      expect(merit({ kla: -1 })).toBeCloseTo(1 + (nj * 0.25) / 100, 12); // 0 >= -1
    });
    it("a character without KillsLeft2Advance row 250 gets the template's row on load (AddNewStuff @19916401): its portal still has kills left, so the bonus is off", () => {
      expect(merit({}, { edit: (d) => setIn(d, "KLA_0", (k) => (k.length = 250)) })).toBe(1);
    });
    it("MeritocCanVote is OptionsListAccount[472] == 1", () => {
      const can = (v: unknown) => Summoning2(variant((d) => setIn(d, "OptLacc", (o) => (o[472] = v))), "MeritocCanVote", 0, 0);
      expect(can(1)).toBe(1);
      expect(can(0)).toBe(0);
      expect(can(2)).toBe(0);
    });
  });
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("calls what N.js calls (vote 20 in force)", () => {
    const fn = njsFunction(loadNjs(), "Summoning2")!;
    const expected = njsCalls(njsNamedBlocks(fn.body, "VotingBonuszMulti").join("\n"));
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    const c = vote([20], { trace: true });
    multi(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

// ── the vote forced on every save ───────────────────────────────────────────────────────────────
// The vote20 loop above only reaches the files where the server had vote 20 in force (42 of 106), and 8 inputs of the multi are constant
// on them (Meritoc 9 is never active, for one). Here vote 20 is forced on every save, on a fresh clone per save (the oracle caches by
// identity), and the game's VotingBonusz is compared with lib/arkh's on that same forced object.
describe.skipIf(GOLDEN_SAVES.length === 0)("vote 20 forced on every real save, against lib/arkh", () => {
  it("vote20", () => {
    const t0 = performance.now();
    const mismatches: string[] = [];
    const refused = new Set<string>();
    const seen = new Set<number>();
    let pairs = 0;
    let meritocActive = 0;
    for (const path of GOLDEN_SAVES) {
      const env = JSON.parse(readFileSync(path, "utf8"));
      env.serverVars = { ...(env.serverVars ?? {}), voteCategories: [20, 24, 27, 32] };
      const ctx = gameCtx(env, 0);
      for (let ci = 0; ci < env.charNames.length; ci++) {
        if (KNOWN_ARKH_DIFFS.some((d) => d.save === basename(path) && (d.ci ?? ci) === ci && d.source === "vote20")) continue;
        const c = withPlayer(ctx, ci);
        let got: number;
        try {
          got = Summoning(c, "VotingBonusz", 20, 0);
        } catch (e) {
          if (!(e instanceof MissingSaveKey)) throw e;
          expect(e.key in env.data, `${basename(path)} has ${e.key}`).toBe(false); // refused for a key the save really lacks
          refused.add(`${basename(path)}: ${e.key}`);
          continue;
        }
        if (Summoning2(c, "MeritocBonusz", 9, 0) > 0) meritocActive++;
        const want = arkhArtifactLeaf(env, ci, "vote20");
        pairs++;
        seen.add(want);
        if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
      }
    }
    console.info(`[events vote20 forced] ${pairs} pairs checked, ${mismatches.length} mismatches, ${refused.size} saves refused, ${seen.size} distinct values, ${meritocActive} pairs with Meritoc 9 active, ${Math.round(performance.now() - t0)} ms`);
    expect(mismatches).toEqual([]);
    expect(pairs).toBeGreaterThan(1000); // a loop over nothing would pass
    expect(seen.size).toBeGreaterThan(50); // nor would a multi that is the same on every save
    expect(meritocActive).toBeGreaterThan(0); // the Meritoc 9 chain, which no real server answer reaches, is exercised on real data here
    // Ruling E: the older saves are read after the game's load steps (their Spelunk[49] included); only the two older than the steps ported are refused
    expect([...refused].sort()).toEqual(UNPORTED_REFUSALS);
  }, 300_000);
});

// ── every call the N.js sub-case makes is made by the port ──────────────────────────────────────
describe.skipIf(GOLDEN_SAVES.length === 0 || !existsSync("scripts/updater/.cache/N.new.js"))("calls what N.js calls", () => {
  // read lazily: skipIf does not stop the describe body from running, and CI has no N.js cache
  let njs = "";
  beforeAll(() => {
    njs = loadNjs();
  }, 120_000);
  const expectedOf = (fn: string, sub?: string) => {
    const f = njsFunction(njs, fn)!;
    return njsCalls(sub ? njsNamedBlocks(f.body, sub).join("\n") : f.body);
  };
  const missing = (expected: ReturnType<typeof njsCalls>, c: Ctx) => {
    expect(expected.length).toBeGreaterThan(0); // an empty expectation would pass anything
    return callDiff(expected, traceCalls(c.trace!)).missing;
  };
  const traced = () => variant(() => {}, { trace: true });
  it("VaultUpgBonus 63", () => {
    const c = traced();
    Summoning(c, "VaultUpgBonus", 63, 0);
    expect(missing(expectedOf("Summoning", "VaultUpgBonus"), c).filter((m) => m.arg0 === "VaultUpgBonus")).toEqual([]);
  });
  it("PaletteBonus", () => {
    const c = traced();
    GamingStatType(c, "PaletteBonus", 32, 0);
    expect(missing(expectedOf("GamingStatType", "PaletteBonus"), c)).toEqual([]);
  });
  it("EmperorBon", () => {
    const c = traced();
    Thingies(c, "EmperorBon", 8, 0);
    expect(missing(expectedOf("Thingies", "EmperorBon"), c)).toEqual([]);
  });
  it("ArcadeBonus (the whole function)", () => {
    const c = traced();
    ArcadeBonus(c, 51);
    expect(missing(expectedOf("ArcadeBonus"), c)).toEqual([]);
  });
  it("RoG_BonusQTY of the Sushi", () => {
    const c = traced();
    SushiStuff(c, "RoG_BonusQTY", 50, 0);
    expect(missing(expectedOf("SushiStuff", "RoG_BonusQTY"), c)).toEqual([]);
  });
  it("MeritocBonuszMulti (with the kills left used up)", () => {
    const c = variant((d) => setIn(d, "KLA_0", (k) => (k[250][0] = 0)), { trace: true });
    Summoning(c, "MeritocBonuszMulti", 0, 0);
    expect(missing(expectedOf("Summoning2", "MeritocBonuszMulti"), c)).toEqual([]);
  });
  it("MeritocBonusz 9 (in force) and the multi it brings", () => {
    const c = variant((d) => ((setIn(d, "OptLacc", (o) => (o[453] = 9))), setIn(d, "KLA_0", (k) => (k[250][0] = 0))), { trace: true });
    Summoning2(c, "MeritocBonusz", 9, 0);
    expect(missing(expectedOf("Summoning2", "MeritocBonusz"), c)).toEqual([]);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("lists the game indexes (lib/game/lists.ts)", () => {
  // N.js reads Spelunk[0][b] without checking Spelunk[0]: a missing list is a TypeError there, so it is refused here, never read as 0
  const lore = (edit: (s: any) => void) => Spelunk(variant((d) => setIn(d, "Spelunk", edit)), "DoWeHaveLoreN1", 8, 0);
  it("a list that is not there is refused (MissingSaveKey); a value that is not a list too (InvalidSaveValue)", () => {
    expect(lore((x) => (x[0] = [0, 0, 0, 0, 0, 0, 0, 0, 1]))).toBe(1);
    expect(() => lore((x) => (x[0] = null))).toThrow(MissingSaveKey);
    expect(() => lore((x) => (x[0] = 5))).toThrow(InvalidSaveValue);
  });
  it("hString prints null and undefined as \"null\", as Std.string does", () => {
    expect([hString(undefined), hString(null), hString(0), hString("a"), hString(1.5)]).toEqual(["null", "null", "0", "a", "1.5"]);
  });
});

// ── the ports stay on their boundary ────────────────────────────────────────────────────────────

describe("ports stay on their boundary", () => {
  const env = (data: Record<string, unknown>) => ({ data, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 });
  const c = () => gameCtx(env({}), 0);
  it("RandomEvent / Stuff2 / Ninja / Spelunk / Holes / Thingies / ArcaneType: only the ported sub-cases", () => {
    expect(() => RandomEvent(c(), "EventType", 0, 0)).toThrow(NotPorted);
    expect(() => Stuff2(c(), "UniqueCardsInGame", 0, 0)).toThrow(NotPorted);
    expect(() => Ninja(c(), "EmporiumCost", 0, 0)).toThrow(NotPorted);
    expect(() => Spelunk(c(), "CavesUnlocked", 0, 0)).toThrow(NotPorted);
    expect(() => Holes(c(), "VillagersOwned", 0, 0)).toThrow(NotPorted);
    expect(() => Thingies(c(), "LoreEpiBon", -1, 0)).toThrow(expect.objectContaining({ name: "NotPorted", sub: "LoreEpiBon:b=-1" })); // the cache rebuild (Task 8 ported the entries 0..10)
    expect(() => ArcaneType(c(), "Arcane_DMG", 0, 0)).toThrow(NotPorted); // TesseractArcanist is a runtime 0 since Damage Task 8
    expect(() => GamingStatType(c(), "LVupChance", 0, 0)).toThrow(NotPorted);
    expect(() => JellyOperation(c(), "SlotUnlocked", 0, 0)).toThrow(NotPorted);
    expect(() => SushiStuff(c(), "UpgLvREQ", 0, 0)).toThrow(NotPorted);
  });
  it("Summoning: a name Summoning answers itself and does not port is NotPorted('Summoning'); one it hands on and Summoning2 lacks is NotPorted('Summoning2')", () => {
    for (const d of ["UnitDMG", "Grimoire_DMG", "RooCost"]) expect(() => Summoning(c(), d, 0, 0), d).toThrow(expect.objectContaining({ name: "NotPorted", fn: "Summoning" }));
    for (const d of ["ExpReqCook", "Nope"]) expect(() => Summoning(c(), d, 0, 0), d).toThrow(expect.objectContaining({ name: "NotPorted", fn: "Summoning2" }));
    expect(() => Summoning2(c(), "ExpReqCook", 0, 0)).toThrow(NotPorted);
  });
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("Summoning's own names are the ones N.js answers in its chain", () => {
    const body = njsFunction(loadNjs(), "Summoning")!.body;
    const names = new Set([...body.matchAll(/"([A-Za-z0-9_]+)"==d/g)].map((m) => m[1]));
    expect([...SUMMONING_OWN_NAMES].sort()).toEqual([...names].sort());
    expect(names.size).toBe(71);
    for (const ported of ["VaultUpgBonus", "EventShopOwned", "GrimoireUpgBonus", "WinBonus"]) expect(names.has(ported)).toBe(true);
    for (const handed of ["VotingBonusz", "VotingBonuszMulti", "MeritocBonuszMulti"]) expect(names.has(handed)).toBe(false);
  });
  it("Summoning hands the Voting and Meritoc names to Summoning2, as the end of N.js's chain does (@10931948)", () => {
    // both routes end in the same block: the result of the call through Summoning is the call to Summoning2
    const withVote = (e: any) => gameCtx(e, 0);
    const e = { ...env({}), serverVars: { voteCategories: [24] } };
    expect(Summoning(withVote(e), "VotingBonusz", 20, 0)).toBe(Summoning2(withVote(e), "VotingBonusz", 20, 0));
  });
});

