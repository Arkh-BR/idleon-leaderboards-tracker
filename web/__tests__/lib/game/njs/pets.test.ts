// Task 5: pets and companions of Sailing("BoatArtiMulti", 0): shiny21, comp154, comp43, comp56, nightmariner.
// Each term is the expression as BoatArtiMulti uses it (before the /100 of the additive pool; the whole
// factor for a factor group), compared with lib/arkh over every real save and every character.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhArtifactLeaf, gameCtx } from "../support/arkhOracle";
import { withPlayer, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "@/lib/game/errors";
import { Breeding } from "@/lib/game/njs/Breeding";
import { CompLV2 } from "@/lib/game/njs/CompLV2";
import { Companions } from "@/lib/game/njs/Companions";
import { MenagerieStuff } from "@/lib/game/njs/MenagerieStuff";
import { callDiff, njsCalls, njsFunction, njsNamedBlocks, traceCalls } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";

// The terms, written the way BoatArtiMulti writes them. `want` turns lib/arkh's leaf into the same term:
// the leaf of a `max1` group is the raw factor (the group clamps it), and a `raw` group's leaf lacks the 1.
type Term = { term: (c: Ctx) => number; want?: (leaf: number) => number; minSeen: number };
const TERMS: Record<string, Term> = {
  shiny21: { term: (c) => Breeding(c, "ShinyBonusS", "Nah", 21, -1), minSeen: 5 },
  comp154: { term: (c) => Math.max(1, Math.min(2, 1 + 2 * Companions(c, 154)) + CompLV2(c, 154)), want: (l) => Math.max(1, l), minSeen: 1 },
  comp43: { term: (c) => 1 + Companions(c, 43), want: (l) => 1 + l, minSeen: 1 },
  comp56: { term: (c) => Math.max(1, Companions(c, 56) / 5), want: (l) => Math.max(1, l), minSeen: 2 },
  nightmariner: { term: (c) => MenagerieStuff(c, "NightmarinerBon", 0, 0), minSeen: 5 },
};

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

// One GameState per save, shared by all its characters (withPlayer) and by the tests.
const states = new Map<string, { ctx: Ctx; chars: number }>();
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const save = JSON.parse(readFileSync(path, "utf8"));
    states.set(path, (s = { ctx: gameCtx(save, 0), chars: save.charNames.length }));
  }
  return s;
}

describe.skipIf(GOLDEN_SAVES.length === 0)("lib/game pets and companions terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const { term, want: toWant = (l: number) => l, minSeen } = TERMS[id];
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused: string[] = [];
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
            refused.push(`${basename(path)}#${ci}: ${e.key}`);
            continue;
          }
          const want = toWant(arkhArtifactLeaf(path, ci, id));
          pairs++;
          seen.add(want);
          if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[pets ${id}] ${pairs} pairs checked, ${mismatches.length} mismatches, ${refused.length} refused, ${seen.size} distinct values, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches).toEqual([]);
      expect(pairs).toBeGreaterThan(100); // a loop over nothing would pass
      expect(seen.size).toBeGreaterThan(minSeen); // nor would a term that is the same number everywhere
      // strict mode: a save the game never gave this key (CSver < 2x: no Menagerie) is refused, not read as 0
      expect(new Set(refused.map((r) => r.split(": ")[1]))).toEqual(REFUSED_KEYS[id]);
    }, 120_000);
  }
});

// Which keys a save can lack (Ruling E): companions need only the envelope and OptionsListAccount, so no save is refused;
// the Nightmariner and the shiny levels read Menagerie[2] (unlocks 13 and 11), which older saves do not have.
const REFUSED_KEYS: Record<string, Set<string>> = {
  shiny21: new Set(["Menagerie"]),
  comp154: new Set(),
  comp43: new Set(),
  comp56: new Set(),
  nightmariner: new Set(["Menagerie"]),
};

// ── synthetic saves: one edge each, on top of a real envelope ───────────────────────────────────
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];
type Data = Record<string, unknown>;
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
/** The account owns exactly `list` ("id,flag,_,_,lv2" entries) and holds the Pet-Bonus Tokens `tokens` (OptionsListAccount[606]). */
const withCompanions = (list: string[], tokens: string | number = "", more: (d: Data) => void = () => {}) =>
  variant((d) => { setIn(d, "OptLacc", (o) => (o[606] = tokens)); more(d); }, { env: (e) => (e.companion = { l: list }) });

describe.skipIf(GOLDEN_SAVES.length === 0)("Companions / CompLV2 (N.js @10799980 and @10800363; the map-load code @10650052 fills DNSM.CompanionLVz and CompanionBon)", () => {
  it("an owned companion gives CompanionDB[id][2]; the others give 0, so their factors are 1", () => {
    const c = withCompanions(["43,1,0,5,0", "56,1,0,9,0"]);
    expect(Companions(c, 43)).toBe(0.25);
    expect(Companions(c, 56)).toBe(25);
    expect(Companions(c, 154)).toBe(0);
    expect(TERMS.comp43.term(c)).toBe(1.25);
    expect(TERMS.comp56.term(c)).toBe(5);
    expect(TERMS.comp154.term(c)).toBe(1); // min(2, 1 + 0) + 0
    const none = withCompanions([]);
    expect(TERMS.comp43.term(none)).toBe(1);
    expect(TERMS.comp56.term(none)).toBe(1); // max(1, 0 / 5)
    expect(CompLV2(none, 154)).toBe(0);
  });
  it("field 4 of the entry = 1 switches an owned companion to CompanionDB[id][11], and CompLV2 says 1", () => {
    const c = withCompanions(["43,1,0,5,1", "154,1,0,5,1", "56,1,0,5,0"]);
    expect(Companions(c, 43)).toBe(0.5);
    expect(CompLV2(c, 43)).toBe(1);
    expect(Companions(c, 154)).toBe(1); // [2] = .6, [11] = 1
    expect(TERMS.comp154.term(c)).toBe(3); // min(2, 1 + 2) + 1
    expect(CompLV2(c, 56)).toBe(0);
  });
  it("a companion listed twice keeps the highest field 4; a field 4 of 2 is LV2 for CompLV2 (>= 1) but not for CompanionBon (== 1)", () => {
    expect(Companions(withCompanions(["43,1,0,5,0", "43,1,0,6,1"]), 43)).toBe(0.5);
    expect(Companions(withCompanions(["43,1,0,5,1", "43,1,0,6,0"]), 43)).toBe(0.5);
    const two = withCompanions(["43,1,0,5,2"]);
    expect(CompLV2(two, 43)).toBe(1);
    expect(Companions(two, 43)).toBe(0.25);
  });
  it("a Pet-Bonus Token (OptionsListAccount[606]) gives CompanionDB[id][2] without owning it, and overrides an owned LV2 value (the token loop runs last)", () => {
    expect(Companions(withCompanions([], "43"), 43)).toBe(0.25);
    expect(CompLV2(withCompanions([], "43"), 43)).toBe(0); // a token never gives stage 2
    expect(Companions(withCompanions(["43,1,0,5,1"], "43"), 43)).toBe(0.25);
    expect(Companions(withCompanions(["43,1,0,5,1"], "56"), 43)).toBe(0.5);
    expect(Companions(withCompanions([], "43,56"), 56)).toBe(25);
    expect(Companions(withCompanions([], 43), 43)).toBe(0.25); // a single id may be stored as a number
  });
  it("Companions(0) needs the character at Lv0[14] >= 2; Companions(918) is 0", () => {
    const at = (lv: number) => withCompanions(["0,1,0,5,0", "918,1,0,5,0"], "", (d) => setIn(d, "Lv0_0", (l) => (l[14] = lv)));
    expect(Companions(at(1), 0)).toBe(0);
    expect(Companions(at(2), 0)).toBe(1);
    expect(Companions(at(2), 918)).toBe(0);
  });
  it("is per entry, not per character: the same list gives every character the same companions", () => {
    const c = withCompanions(["43,1,0,5,0"]);
    expect(Companions(withPlayer(c, 1), 43)).toBe(Companions(c, 43));
  });
  it("no companion list in the envelope (null) is no companions, shown in the trace as not counted", () => {
    const c = variant(() => {}, { env: (e) => (e.companion = null), trace: true });
    expect(Companions(c, 43)).toBe(0);
    const notCounted = (n: TraceNode): boolean => n.children.some((x) => x.note?.startsWith("runtime:") || notCounted(x));
    expect(notCounted(c.trace!)).toBe(true);
  });
  it("an envelope companion without a list is refused, not read as none", () => {
    const c = variant(() => {}, { env: (e) => (e.companion = {}) });
    expect(() => Companions(c, 43)).toThrow(MissingSaveKey);
    expect(() => CompLV2(c, 43)).toThrow(MissingSaveKey);
  });
  it("a token outside CompanionDB is refused (the game would throw reading CompanionDB[id][2])", () => {
    expect(() => Companions(withCompanions([], "43,9999"), 43)).toThrow(InvalidSaveValue);
  });
  it("map 41 (the token clean-up of the map-load code) is not ported", () => {
    const c = withCompanions(["43,1,0,5,0"]);
    expect(() => Companions({ ...c, map: 41, cache: new Map() }, 43)).toThrow(NotPorted);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("shiny21 (Breeding ShinyBonusS, N.js @7930106; SpecialPassives Lv @7937936)", () => {
  // Shiny pets of passive 21 (RANDOlist[90]): PetStats[1][8], [2][6], [3][6]; each level counts RANDOlist[92][21] = 2.
  // Level thresholds floor((1 + (g+1)^1.6) x 1.7^(g+1)): 3, 11, 33, 85 ... (g = 0, 1, 2, 3); count > threshold gives level g + 2.
  const shiny = (counts: Record<string, number>, o: { unlock11?: number; trace?: boolean } = {}) =>
    variant((d) => {
      setIn(d, "Breeding", (b) => {
        for (const q of [22, 23, 24, 25]) b[q] = b[q].map(() => 0);
        for (const [k, n] of Object.entries(counts)) { const [q, g] = k.split(":").map(Number); b[22 + q][g] = n; }
      });
      setIn(d, "Menagerie", (m) => (m[2][11] = o.unlock11 ?? 0));
    }, { trace: o.trace });
  const term = (c: Ctx, key = 21) => Breeding(c, "ShinyBonusS", "Nah", key, -1);

  it("is 0 with no shiny pet", () => {
    expect(term(shiny({}))).toBe(0);
  });
  it("a pet with any shiny count is at level 1; each threshold crossed (count > it) adds a level; levels x 2 per passive-21 pet", () => {
    expect(term(shiny({ "1:8": 1 }))).toBe(2); // level 1
    expect(term(shiny({ "1:8": 3 }))).toBe(2); // 3 is not > 3
    expect(term(shiny({ "1:8": 4 }))).toBe(4); // level 2
    expect(term(shiny({ "1:8": 12 }))).toBe(6); // level 3 (> 11)
    expect(term(shiny({ "1:8": 12, "2:6": 4, "3:6": 3 }))).toBe(12); // 6 + 4 + 2: the sum over the pets
  });
  it("a pet of another passive does not count, and the key asked picks the passive", () => {
    expect(term(shiny({ "0:0": 50 }))).toBe(0); // PetStats[0][0] is passive 16
    expect(term(shiny({ "0:0": 50 }), 16)).toBe(Math.round(4 * 3)); // level 4 (> 33), 3 per level
  });
  it("Menagerie unlock 11 lengthens the level table from 19 to 29 steps", () => {
    const n = 1.1e9; // > 1058855861, the last threshold of the 29-step table, and far past the 19-step one
    expect(term(shiny({ "1:8": n }))).toBe(40); // level 20, the table's end
    expect(term(shiny({ "1:8": n }, { unlock11: 1 }))).toBe(60); // level 30
  });
  it("a save without the Breeding shiny rows is refused", () => {
    const c = variant((d) => setIn(d, "Breeding", (b) => (b.length = 23)));
    expect(() => term(c)).toThrow(MissingSaveKey);
  });
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("calls what N.js calls", () => {
    const fn = njsFunction(loadNjs(), "Breeding")!;
    const expected = njsCalls(njsNamedBlocks(fn.body, "ShinyBonusS").join("\n"));
    const c = shiny({ "1:8": 12 }, { trace: true });
    term(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe.skipIf(GOLDEN_SAVES.length === 0)("TotPetsFound (Breeding TotPetsFound, N.js @7932815; the breeding actor's GenINFO[110] @10102075)", () => {
  // the sum of Breeding[1][i] over i < GenINFO[71] = max(3, OptionsListAccount[117]) worlds
  const pets = (worlds: number | undefined, found: number[]) =>
    variant((d) => {
      setIn(d, "Breeding", (b) => (b[1] = found));
      setIn(d, "OptLacc", (o) => (o[117] = worlds));
    });
  const term = (c: Ctx) => Breeding(c, "TotPetsFound", "0", 0, 0);
  it("adds the pets found in the first max(3, OLA[117]) worlds", () => {
    expect(term(pets(4, [17, 17, 18, 16, 1, 0, 0, 0]))).toBe(68);
    expect(term(pets(5, [17, 17, 18, 16, 1, 0, 0, 0]))).toBe(69);
    expect(term(pets(1, [17, 17, 18, 16, 1]))).toBe(52); // never fewer than 3 worlds
    expect(term(pets(0, [17, 17, 18, 16, 1]))).toBe(52);
  });
  it("reads a world the save has no entry for as 0 (c.asNumber)", () => {
    expect(term(pets(5, [4, 5]))).toBe(9);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("nightmariner (MenagerieStuff NightmarinerBon, N.js @5184717)", () => {
  // T = sum over the 20 boats of max(0, loot upgrades + speed upgrades - 600); with unlock 13: max(1, 1 + 1999 T / (T + 1e4))
  const boats = (levels: [number, number][], unlock13 = 1, trace = false) =>
    variant((d) => {
      setIn(d, "Boats", (b) => { for (let i = 0; i < 20; i++) { b[i][3] = levels[i]?.[0] ?? 0; b[i][5] = levels[i]?.[1] ?? 0; } });
      setIn(d, "Menagerie", (m) => (m[2][13] = unlock13));
    }, { trace });
  const term = (c: Ctx) => MenagerieStuff(c, "NightmarinerBon", 0, 0);

  it("is 1 without Menagerie unlock 13, whatever the boats", () => {
    expect(term(boats([[2000, 2000]], 0))).toBe(1);
  });
  it("is 1 + 1999 T / (T + 1e4) with the unlock", () => {
    expect(term(boats([]))).toBe(1); // T = 0
    expect(term(boats([[600, 600]]))).toBeCloseTo(1 + (1999 * 600) / 10600, 9); // T = 600
    expect(term(boats([[600, 600], [100, 100], [700, 500]]))).toBeCloseTo(1 + (1999 * 1200) / 11200, 9); // a boat under 600 adds 0; 700 + 500 - 600 = 600, so T = 1200
  });
  it("sums all 20 boats and only those", () => {
    const l = Array.from({ length: 20 }, () => [300, 400] as [number, number]); // 100 each: T = 2000
    expect(term(boats(l))).toBeCloseTo(1 + (1999 * 2000) / 12000, 9);
  });
  it("a boat row missing among the first 20 is refused, as the game's Boats[e][3] would throw", () => {
    const c = variant((d) => { setIn(d, "Boats", (b) => (b.length = 19)); setIn(d, "Menagerie", (m) => (m[2][13] = 1)); });
    expect(() => term(c)).toThrow(MissingSaveKey);
  });
  it("Menagerie unlocks are Menagerie[2][i] >= 1", () => {
    const at = (v: unknown) => variant((d) => setIn(d, "Menagerie", (m) => (m[2][13] = v)));
    expect(MenagerieStuff(at(1), "UnlockOwned", 13, 0)).toBe(1);
    expect(MenagerieStuff(at(2), "UnlockOwned", 13, 0)).toBe(1);
    expect(MenagerieStuff(at(0), "UnlockOwned", 13, 0)).toBe(0);
    expect(MenagerieStuff(at(null), "UnlockOwned", 13, 0)).toBe(0);
    expect(MenagerieStuff(variant((d) => setIn(d, "Menagerie", (m) => (m[2].length = 5))), "UnlockOwned", 13, 0)).toBe(0); // past the list: asNumber(null)
    expect(() => MenagerieStuff(variant((d) => setIn(d, "Menagerie", (m) => (m[2] = null))), "UnlockOwned", 13, 0)).toThrow(MissingSaveKey);
  });
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("calls what N.js calls", () => {
    const fn = njsFunction(loadNjs(), "MenagerieStuff")!;
    const expected = njsCalls(njsNamedBlocks(fn.body, "NightmarinerBon").join("\n"));
    const c = boats([[600, 600]], 1, true);
    term(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe("ports stay on their boundary", () => {
  const c = () => gameCtx({ data: {}, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 }, 0);
  it("Breeding: only ShinyBonusS, SpecialPassives Lv and TotPetsFound", () => {
    for (const d of ["PetUpgBONUS", "ShinySpdMulti", "Nope"]) expect(() => Breeding(c(), d, "0", 0, 0)).toThrow(NotPorted);
    expect(() => Breeding(c(), "SpecialPassives", "REQ", 0, 0)).toThrow(NotPorted);
  });
  it("MenagerieStuff: only NightmarinerBon (boat 0), NightmarinerTotLV and UnlockOwned", () => {
    for (const d of ["Nope", "UnlockCost"]) expect(() => MenagerieStuff(c(), d, 0, 0)).toThrow(NotPorted);
    expect(() => MenagerieStuff(c(), "NightmarinerBon", 1, 0)).toThrow(NotPorted); // the other branch (b != 0, 499 instead of 1999) is not reached
  });
});
