// Task 3 (Coin plan): ArbitraryCode("MonsterCash") (N.js @4047005 raw) against lib/arkh's Coin Multi total on every real save and character, on maps 301
// (the Observed Max reference), 251 (plain), 150 (a town) and 40 (a dungeon, Ruling Y). A pair whose total differs must be closed by the KNOWN entries of
// its leaves (`stat: "coin"` rows, njs/coinTerms.test.ts), each on its narrow cause: the stat snapshots on lib/arkh's side (its envelope gets lib/game's
// live TotalStats in PVStatList, only the bubble that reads it is resolved again and put back through the groups: a whole lib/arkh tree per pair is about
// 1 s), the others on lib/game's (a save patch, or lib/arkh's number for the cause seeded into a fresh Ctx). A reason counts only if the pair stops closing
// without it, so one that moves no total is no explanation (DR's glimboUnleveled lesson). Exact counts, per reason too. statues and godshard never show
// here: they are on HourZero, which the total refuses, so only the per-leaf loop reaches them.
// Map 33's target has no monster definition: N.js itself throws there, so the block refuses instead of answering.
// A describe body never reads a save.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhCoinLeaf, arkhCoinLeaves, arkhCoinMulti, damageReasonSeeds, patchLukSnapshot, type Seed } from "../support/arkhOracle";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";
import { InvalidSaveValue, MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { applyGroupStep } from "@/lib/statTracker/groups";

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"]; // Ruling E: the Tome refusal behind TotalStats("STR"), the block's first read (coinTerms.test.ts)
const STATS = ["STR", "AGI", "WIS"] as const;
const SNAPSHOT = new Set<string>(STATS.map((s) => `snapshot${s}`));
const cash = (c: Ctx) => ArbitraryCode(c, "MonsterCash");
/** lib/arkh's combine() over its leaves: asserted equal to its own total on every pair it is used on. */
const recombine = (leaves: Record<string, number>) => COIN_GROUPS.reduce((t, g) => applyGroupStep(g, g.sources.map((id) => leaves[id]), t), 1);

/** The pairs each reason explains on every map (the per-leaf counts of coinTerms.test.ts, less HourZero and INERT). */
const EVERY_MAP = { snapshotSTR: 1126, snapshotAGI: 1120, snapshotWIS: 1129, fam68: 9, pray6: 43, gfoodCap: 308, gfoodSign69: 11, comp0: 1 };
/** Per map: the pairs whose total the KNOWN entries close and how many of them each reason really explains. signsDmg is the multikill tier of big_guy69123 #7 and #9, on the maps where it crosses one. */
const MAPS: Record<number, { known: number; byReason: Record<string, number> }> = {
  301: { known: 1140, byReason: { ...EVERY_MAP, signsDmg: 2 } },
  251: { known: 1139, byReason: EVERY_MAP },
  150: { known: 1139, byReason: EVERY_MAP },
  40: { known: 1140, byReason: { ...EVERY_MAP, signsDmg: 2 } },
};
const PAIRS = 1153; // 106 saves x characters (1163), less HourZero's 10
const NO_MONSTER = 'AFKtarget: expected a MonsterDefinitions key, got string "Z"'; // MapAFKtarget[33]
/**
 * Listed on the pair, but the pair closes without them on every map, so they explain nothing there. gfoodVote26: seeding lib/arkh's weekly vote 26 leaves the total where it is on all 308.
 * snapshotAGI: Glaives #0, where the gfoodSign69 seed moves lib/game's live AGI (960010 to 960572) into the 250-step of the snapshot (960681), so that bubble agrees unpatched.
 */
const INERT = { gfoodVote26: 308, snapshotAGI: 1 };

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(GOLDEN_SAVES.length === 0)('ArbitraryCode("MonsterCash") against lib/arkh on every real save and character', () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      const byReason: Record<string, number> = {};
      const inert: Record<string, number> = {};
      let pairs = 0;
      let known = 0;
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map });
          let got: number;
          try {
            got = cash(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          pairs++;
          const want = arkhCoinMulti(path, ci, map);
          if (rel(got, want)) continue;
          const reasons = [...new Set(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "coin" && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true)).map((d) => d.reason!))];
          if (!reasons.length) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
            continue;
          }
          const leaves = arkhCoinLeaves(path, ci, map);
          expect(rel(recombine(leaves), want), `${basename(path)}#${ci}@${map}: the groups recombined are not lib/arkh's total`).toBe(true);
          const arkhEnv = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
          const resolved = new Map<string, number>();
          /** lib/arkh's Cash bubble of `s` with its PVStatList snapshot set to `live`. */
          const bubble = (s: (typeof STATS)[number], live: number) => {
            const key = `${s}|${live}`;
            if (!resolved.has(key)) {
              patchLukSnapshot(arkhEnv.data as Record<string, unknown>, ci, live, STATS.indexOf(s));
              resolved.set(key, arkhCoinLeaf(arkhEnv, ci, map, `bubble${s}`));
            }
            return resolved.get(key)!;
          };
          /** Both totals with the causes of `rs` applied, lib/game's and lib/arkh's. */
          const prove = (rs: readonly string[]): [number, number] => {
            const causes = rs.filter((x) => !SNAPSHOT.has(x));
            const seeds: Seed[] = causes.flatMap((r) => damageReasonSeeds(path, ci, r)); // a patch reason has no seeds
            const patches = causes.filter((r) => PROOF_PATCHES[r]);
            const patchEnv = patches.length ? (JSON.parse(readFileSync(path, "utf8")) as GameEnvelope) : undefined;
            for (const r of patches) PROOF_PATCHES[r](patchEnv!.data as Record<string, unknown>, ci, state.charNames.length);
            // negative control: a seed is never the cache key of the call under test (the proof would hold by construction)
            for (const [name, args] of seeds) expect(`${name}${JSON.stringify(args)}`).not.toBe('ArbitraryCode["MonsterCash"]');
            const c = causes.length ? makeCtx(patchEnv ? buildGameState(patchEnv) : state, { player: ci, map }) : ctx;
            for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
            const arkh = { ...leaves };
            for (const s of STATS) {
              // a stat with no entry has the snapshot's floor (coinTerms): it only follows a seed that moves lib/game's live stat (fam68 through the talents), and
              // that re-patch stands on its own only if the snapshot is the unseeded stat's floor
              const moved = Math.floor(TotalStats(c, s) / 250) !== Math.floor(TotalStats(ctx, s) / 250);
              if (moved && !reasons.includes(`snapshot${s}`)) {
                const snap = (JSON.parse(readFileSync(path, "utf8")) as { data: Record<string, unknown> }).data[`PVStatList_${ci}`];
                const list = (typeof snap === "string" ? JSON.parse(snap) : snap) as number[];
                expect(Math.floor(list[STATS.indexOf(s)] / 250), `${basename(path)}#${ci}@${map}: the snapshot's ${s} floor is not the unseeded stat's`).toBe(Math.floor(TotalStats(ctx, s) / 250));
              }
              const patch = reasons.includes(`snapshot${s}`) ? rs.includes(`snapshot${s}`) : moved;
              if (patch) arkh[`bubble${s}`] = bubble(s, TotalStats(c, s));
            }
            return [cash(c), recombine(arkh)];
          };
          const [proved, wantProved] = prove(reasons);
          if (!rel(proved, wantProved)) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with ${reasons.join("+")} game ${proved}, arkh ${wantProved}`);
            continue;
          }
          known++;
          for (const r of reasons) {
            const [g, a] = reasons.length > 1 ? prove(reasons.filter((x) => x !== r)) : [got, want];
            if (rel(g, a)) inert[r] = (inert[r] ?? 0) + 1;
            else byReason[r] = (byReason[r] ?? 0) + 1;
          }
        }
      }
      console.info(`[coinMulti @${map}] ${pairs} pairs, ${known} known ${JSON.stringify(byReason)}, inert ${JSON.stringify(inert)}, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(known, "KNOWN pairs, literally (a stale entry or a new difference fails)").toBe(MAPS[map].known);
      expect(byReason, "per reason").toEqual(MAPS[map].byReason);
      expect(inert, "listed reasons that explain nothing on this map").toEqual(INERT);
      expect(pairs, "saves x characters").toBe(PAIRS);
      expect([...refused].sort()).toEqual(HOURZERO);
    }, 3_600_000);
  }

  it("map 33: no monster on its target, so every character is refused and none gets a value", () => {
    const invalid = new Set<string>();
    const refused = new Set<string>();
    let threw = 0;
    const answered: string[] = [];
    for (const path of GOLDEN_SAVES) {
      const state = stateOf(path);
      for (let ci = 0; ci < state.charNames.length; ci++) {
        try {
          answered.push(`${basename(path)}#${ci}: ${cash(makeCtx(state, { player: ci, map: 33 }))}`);
        } catch (e) {
          if (e instanceof InvalidSaveValue) {
            threw++;
            invalid.add(e.message);
          } else if (e instanceof MissingSaveKey) refused.add(`${basename(path)}: ${e.key}`);
          else throw e;
        }
      }
    }
    console.info(`[coinMulti @33] ${threw} refused (InvalidSaveValue) ${JSON.stringify([...invalid])}, ${refused.size} refused for other reasons, ${answered.length} answered`);
    expect(answered.slice(0, 20)).toEqual([]);
    expect([...invalid], "the cause: map 33's AFK target, not any other bad value").toEqual([NO_MONSTER]);
    expect(threw).toBe(1153);
    expect([...refused].sort()).toEqual(HOURZERO);
  }, 1_800_000);
});
