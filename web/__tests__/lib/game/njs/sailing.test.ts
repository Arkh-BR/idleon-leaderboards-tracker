// Task 4: the Sailing family of Sailing("BoatArtiMulti", 0): artifact3, captain, captains6, davey.
// Each term is the expression as BoatArtiMulti uses it (before the /100 of the additive pool; the
// whole factor for Davey Jones), compared with lib/arkh over every real save and every character.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, UNPORTED_REFUSALS, arkhArtifactLeaf, gameCtx } from "../support/arkhOracle";
import { asNum } from "@/lib/game/attr";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { MissingSaveKey, NotPorted } from "@/lib/game/errors";
import { ArtifactInfo } from "@/lib/game/data";
import { CaptBonusCalc } from "@/lib/game/njs/CaptBonusCalc";
import { NONdummies60 } from "@/lib/game/njs/NONdummies";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { Sailing } from "@/lib/game/njs/Sailing";
import { Thingies } from "@/lib/game/njs/Thingies";
import { callDiff, njsCalls, njsFunction, njsNamedBlocks, traceCalls } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";

// The terms, written the way BoatArtiMulti writes them (b = 0, the boat Skill Info shows).
const TERMS: Record<string, (c: Ctx) => number> = {
  artifact3: (c) => Sailing(c, "ArtifactBonus", 3, 0),
  captain: (c) => CaptBonusCalc(c, 3, asNum(c, "Boats", 0, 0)),
  captains6: (c) => 25 * Math.min(30, NONdummies60(c)),
  davey: (c) => Sailing(c, "DaveyJonesBonus", 0, 0),
};

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

// One GameState per save, shared by all its characters (withPlayer) and by the four tests.
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

describe.skipIf(GOLDEN_SAVES.length === 0)("lib/game Sailing terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
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
            got = TERMS[id](withPlayer(ctx, ci));
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.push(`${basename(path)}#${ci}: ${e.key}`);
            continue;
          }
          const want = arkhArtifactLeaf(path, ci, id);
          pairs++;
          seen.add(want);
          if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[sailing ${id}] ${pairs} pairs checked, ${mismatches.length} mismatches, ${refused.length} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches).toEqual([]);
      expect(pairs).toBeGreaterThan(100); // a loop over nothing would pass
      expect(seen.size).toBeGreaterThan(5); // nor would a term that is the same number everywhere
      // strict mode: an older save is read after the game's load steps (lib/game/migrations); one older than the steps ported is refused
      expect([...new Set(refused.map((r) => r.replace(/#\d+: /, ": ")))].sort()).toEqual(UNPORTED_REFUSALS);
    }, 120_000);
  }
});

// ── synthetic saves: one edge each, on top of a real envelope ───────────────────────────────────
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];
type Data = Record<string, unknown>;
const json = (d: Data, k: string): any => (typeof d[k] === "string" ? JSON.parse(d[k] as string) : structuredClone(d[k]));

/** A fresh copy of BASE with `edit` applied to its `data`; lists the edit rewrites are stored parsed. */
function variant(edit: (d: Data) => void, ci = 0, trace = false): Ctx {
  const env = JSON.parse(readFileSync(BASE, "utf8"));
  edit(env.data);
  return gameCtx(env, ci, trace);
}
const setIn = (d: Data, key: string, fn: (v: any) => void) => {
  const v = json(d, key);
  fn(v);
  d[key] = v;
};

describe.skipIf(GOLDEN_SAVES.length === 0)("captains6 (NONdummies[60], N.js @10634225)", () => {
  const withCaptains = (types: number[]) => variant((d) => (d.Captains = types.map((t) => [t, 1, 0, 10, 0, 1, 1])));
  const term = (c: Ctx) => TERMS.captains6(c);

  it("31 type-6 captains count 30: 25 x 30 = 750", () => {
    expect(term(withCaptains(Array(31).fill(6)))).toBe(750);
  });
  it("counts only the first 30 captains", () => {
    const types = [...Array(29).fill(6), 5, ...Array(5).fill(6)]; // 29 sixes, one other, then 5 sixes past the cap
    expect(NONdummies60(withCaptains(types))).toBe(29);
  });
  it("no captains give 0", () => {
    expect(term(withCaptains([]))).toBe(0);
  });
  it("ignores other types", () => {
    expect(NONdummies60(withCaptains([6, 1, 6, 2, 3]))).toBe(2);
  });
  it("a missing row below the cap throws, as the game's Captains[g][0] does; past the cap it is never read", () => {
    const row = [6, 1, 0, 10, 0, 1, 1];
    expect(() => NONdummies60(variant((d) => (d.Captains = [row, null, row])))).toThrow(MissingSaveKey);
    expect(NONdummies60(variant((d) => (d.Captains = [...Array(30).fill(row), null])))).toBe(30);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("captain (CaptBonusCalc, N.js @10731821)", () => {
  const withCaptain = (row: unknown[]) => variant((d) => (d.Captains = [row]));
  // row: [type, bonus1 type, bonus2 type, level, xp, bonus1 value, bonus2 value]
  it("adds level x value for every bonus slot of the asked type", () => {
    expect(CaptBonusCalc(withCaptain([0, 3, 3, 10, 0, 2, 5]), 3, 0)).toBe(70); // 10x2 + 10x5
    expect(CaptBonusCalc(withCaptain([0, 3, 1, 10, 0, 2, 5]), 3, 0)).toBe(20); // slot 1 only
    expect(CaptBonusCalc(withCaptain([0, 1, 3, 10, 0, 2, 5]), 3, 0)).toBe(50); // slot 2 only
    expect(CaptBonusCalc(withCaptain([0, 1, 2, 10, 0, 2, 5]), 3, 0)).toBe(0); // neither
  });
  it("no captain (index -1) gives 0", () => {
    expect(CaptBonusCalc(withCaptain([0, 3, 3, 10, 0, 2, 5]), 3, -1)).toBe(0);
  });
  it("a captain index the save has no row for throws, as the game's Captains[b] does", () => {
    expect(() => CaptBonusCalc(withCaptain([0, 3, 3, 10, 0, 2, 5]), 3, 4)).toThrow(MissingSaveKey);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("artifact3 (Sailing ArtifactBonus 3, N.js @10714975; cache written by @4515107)", () => {
  const withTier = (tier: number | null, lv = 50, ci = 0) =>
    variant((d) => {
      setIn(d, "Sailing", (s) => (tier === null ? (s[3].length = 3) : (s[3][3] = tier)));
      setIn(d, `Lv0_${ci}`, (l) => (l[13] = lv));
    }, ci);
  const art = (c: Ctx) => Sailing(c, "ArtifactBonus", 3, 0);

  it("reads base 1 per Sailing level", () => {
    expect(ArtifactInfo[3][3]).toBe("1");
    expect(art(withTier(1))).toBe(50);
  });
  it("is 0 when the artifact is not found, and when the save's list stops short (the game pads it with 0)", () => {
    expect(art(withTier(0))).toBe(0);
    expect(art(withTier(null))).toBe(0);
  });
  it("multiplies by the tier 2..7", () => {
    for (const t of [2, 3, 4, 5, 6, 7]) expect(art(withTier(t))).toBe(50 * t);
  });
  it("follows the character's own Sailing level", () => {
    expect(art(withTier(2, 70, 1))).toBe(140);
  });
  it("a null element is not 0 in N.js (loose ==): it takes the base, and 2==null is false so no multiplier (block 337 fills a loaded save's nulls with 0; this is the state that migration did not fill)", () => {
    const c = variant((d) => {
      setIn(d, "Sailing", (s) => (s[3][3] = null));
      setIn(d, "Lv0_0", (l) => (l[13] = 50));
    });
    expect(art(c)).toBe(50);
  });
  it("a tier whose text the game's data does not carry gets no multiplier (the chain tests the text)", () => {
    expect(art(withTier(8))).toBe(50);
  });
  it("plain artifacts (index 32) take base x tier from the same loop; of the ones with their own multiplier, those Damage does not read are not ported", () => {
    expect(ArtifactInfo[32][3]).toBe("25");
    const at = (tier: number) => variant((d) => setIn(d, "Sailing", (s) => (s[3][32] = tier)));
    expect(Sailing(at(0), "ArtifactBonus", 32, 0)).toBe(0);
    expect(Sailing(at(1), "ArtifactBonus", 32, 0)).toBe(25);
    const c = at(3);
    expect(Sailing(c, "ArtifactBonus", 32, 0)).toBe(75);
    for (const b of [1, 5, 11, 13, 23, -1]) { // 2, 8, 10, 18, 20, 25, 27, 29: Damage Task 7 (accountSystems.test.ts)
      expect(() => Sailing(c, "ArtifactBonus", b, 0), `artifact ${b}`).toThrow(expect.objectContaining({ name: "NotPorted", sub: `ArtifactBonus:b=${b}` }));
    }
    expect(() => Sailing(c, "ArtifactBonus", 3, 1)).toThrow(expect.objectContaining({ name: "NotPorted", sub: "ArtifactBonus:e=1" })); // the 1==e branch
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("davey (Sailing DaveyJonesBonus, N.js @10702897)", () => {
  // gem = GemItemsPurchased[8]; loot + speed = Boats[0][3] + Boats[0][5]; grid = Research[0][105]; lore = Spelunk[18][11]
  const davey = (o: { gem?: number; loot?: number; speed?: number; grid?: number; lore?: number }, trace = false) =>
    variant((d) => {
      setIn(d, "GemItemsPurchased", (g) => (g[8] = o.gem ?? 0));
      setIn(d, "Boats", (b) => ((b[0][3] = o.loot ?? 0), (b[0][5] = o.speed ?? 0)));
      setIn(d, "Research", (r) => (r[0][105] = o.grid ?? 0));
      setIn(d, "Spelunk", (s) => (s[18][11] = o.lore ?? 0));
    }, 0, trace);
  const term = (c: Ctx) => Sailing(c, "DaveyJonesBonus", 0, 0);

  it("is 1 with nothing bought and no grid level", () => {
    expect(term(davey({}))).toBe(1);
  });
  it("gems add 50 each to the first factor", () => {
    expect(term(davey({ gem: 1 }))).toBe(1.5);
  });
  it("the second factor is 1 + 2 x clamp(floor((loot + speed + 99600) / 1e5) x grid level, 0, 1)", () => {
    expect(term(davey({ gem: 1, loot: 200, speed: 200, grid: 1 }))).toBe(4.5); // floor(1) x 1 = 1 -> 3
    expect(term(davey({ gem: 1, loot: 199, speed: 200, grid: 1 }))).toBe(1.5); // floor(0.99999) = 0
    expect(term(davey({ gem: 1, loot: 200, speed: 200, grid: 0 }))).toBe(1.5); // grid level 0
    expect(term(davey({ gem: 1, loot: 400000, speed: 400000, grid: 3 }))).toBe(4.5); // capped at 1
  });
  it("adds Spelunk legend talent 11 (15 per level) to the first factor", () => {
    expect(term(davey({ lore: 2 }))).toBeCloseTo(1.3, 12); // (1 + 30/100)
  });
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("calls what N.js calls", () => {
    const fn = njsFunction(loadNjs(), "Sailing")!;
    const expected = njsCalls(njsNamedBlocks(fn.body, "DaveyJonesBonus").join("\n"));
    const c = davey({ gem: 1, loot: 200, speed: 200, grid: 1 }, true);
    term(c);
    expect(callDiff(expected, traceCalls(c.trace!)).missing).toEqual([]);
  }, 120_000);
});

describe("ports stay on their boundary", () => {
  const c = () => gameCtx({ data: {}, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 }, 0);
  it("Sailing: only the ported sub-cases", () => {
    // BoatArtiMulti is ported (trackers/artifactFind.test.ts); SlabboBonus_AllMulti with the artifacts 2/10/18/20 (Damage Task 7)
    for (const d of ["SailingExpMulti", "Nope"]) expect(() => Sailing(c(), d, 0, 0)).toThrow(NotPorted);
  });
  it("Thingies / ResearchStuff: only what the ported terms need", () => {
    expect(() => Thingies(c(), "LoreEpiBon", -1, 0)).toThrow(NotPorted); // the cache rebuild (Task 8 ported the entries 0..10)
    expect(() => ResearchStuff(c(), "AFKgainsRatePCT", 0, 0)).toThrow(NotPorted); // Grid_Bonus with e == 2 and its counters are ported since the Drop Rate plan
  });
});
