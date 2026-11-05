// Task 7 (Damage plan): the account-system terms DamageDealed("Max") reads (Summoning, Holes, Farming, Spelunk, Divinity, Workbench, Rift,
// Gaming, Thingies, Sailing, Breeding, Minehead, Research and the already-ported systems' leaves). Each is compared with lib/arkh's leaf of
// the same id over every real save and character (relative 1e-9, map 251 unless the term reads the map); N.js is the truth, so a difference
// is a KNOWN entry with its evidence and a seeded proof, or a mismatch. A describe body never reads a save: states load lazily inside `it`.
import { afterAll, afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhDamageLeaf } from "../support/arkhOracle";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";
import { Labb } from "@/lib/game/njs/Labb";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena
type Seed = [name: string, args: (string | number)[], value: number];
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

/** The lib/game term of each lib/arkh leaf, as DamageDealed uses it (the leaf of a factor source is the factor). Offsets: DamageDealed @4105019. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // @4124114: x (1 + min(100, TotalGreenSigils x Grid_Bonus(127)) / 100)
  greenSigils: (c) => 1 + Math.min(100, Labb(c, "TotalGreenSigils", "0", 0, 0) * ResearchStuff(c, "Grid_Bonus", 127, 0)) / 100,
};

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be (the proof would hold by construction). */
const OWN: Record<string, string[]> = {
  greenSigils: ['Labb["TotalGreenSigils","0",0,0]', 'ResearchStuff["Grid_Bonus",127,0]'],
};
Object.freeze(OWN);

/** The KNOWN pairs each leaf has, exactly (a stale entry or a new difference fails). */
const EXPECT_KNOWN: Record<string, number> = { greenSigils: 1 };

/** What each term refuses (Ruling E), as `<file>: <key>`. */
const REFUSED: Record<string, string[]> = {};

/** The maps a term is compared on (map 251 when absent). */
const MAPS: Record<string, (c: Ctx) => number[]> = {};

/** The seeds that prove a KNOWN reason on one pair: lib/arkh's number for the cause, on the narrowest block it names. */
const SEEDS: Record<string, (path: string, ci: number) => Seed[]> = {
  // COMPANION_0_GATE: lib/arkh counts Companions(0) below Lv0[14] = 2, where N.js @10799980 is 0
  comp0: () => [["Companions", [0], 1]],
};

const states = new Map<string, GameState>();
const ctxs = new Map<string, Ctx>();
afterEach(() => ctxs.clear()); // a leaf's cached blocks are not the next one's: keeps the worker's memory flat
afterAll(() => {
  states.clear();
  ctxs.clear();
});
function stateOf(path: string): GameState {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
}
function ctxOf(path: string, map: number): Ctx {
  const k = `${path}|${map}`;
  let c = ctxs.get(k);
  if (!c) ctxs.set(k, (c = makeCtx(stateOf(path), { player: 0, map })));
  return c;
}

describe.skipIf(GOLDEN_SAVES.length === 0)("account-system terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      let pairs = 0;
      let nonZero = 0;
      let known = 0;
      let direct = 0; // pairs a KNOWN entry covers: each must really differ, or the entry is stale
      let directClosed = 0;
      const refused = new Set<string>();
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          for (const map of (MAPS[id] ?? (() => [MAP]))(ctxOf(path, MAP))) {
            let got: number;
            try {
              got = TERMS[id](withPlayer(ctxOf(path, map), ci));
            } catch (e) {
              if (!(e instanceof MissingSaveKey)) throw e;
              refused.add(`${basename(path)}: ${e.key}`);
              continue;
            }
            const want = arkhDamageLeaf(path, ci, map, id);
            pairs++;
            if (Math.abs(want) > 1e-12 && Math.abs(want - 1) > 1e-12) nonZero++; // neither 0 (a % term) nor 1 (a factor)
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci);
            if (entries.length) direct++;
            if (rel(got, want)) continue;
            // a KNOWN difference is proved, not skipped: lib/arkh's number for the cause it names, put in a fresh Ctx, closes the gap
            const seeds: Seed[] = [];
            for (const r of entries.map((d) => d.reason!)) {
              const s = SEEDS[r];
              if (!s) throw new Error(`accountSystems.test: no seed for reason ${r}`);
              seeds.push(...s(path, ci));
            }
            if (!seeds.length) {
              mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
              continue;
            }
            // negative controls: a seed is never the cache key of the leaf under test, and the seeds do something
            for (const [name, args] of seeds) expect(OWN[id], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
            const ctx = makeCtx(state, { player: ci, map });
            for (const [name, args, v] of seeds) ctx.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
            const seeded = TERMS[id](ctx);
            expect(rel(seeded, got), `${id} ${basename(path)}#${ci}: the seeds changed nothing`).toBe(false);
            if (rel(seeded, want)) {
              known++;
              if (entries.length) directClosed++;
              continue;
            }
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, seeded ${seeded}`);
          }
        }
      }
      console.info(`[account ${id}] ${pairs} pairs, ${nonZero} not neutral, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(directClosed, "pairs a KNOWN entry covers vs those that differ and are closed (a stale entry no longer differs)").toBe(direct);
      expect(known, "KNOWN pairs").toBe(EXPECT_KNOWN[id] ?? 0);
      expect([...refused].sort()).toEqual(REFUSED[id] ?? []);
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 900_000);
  }
});
