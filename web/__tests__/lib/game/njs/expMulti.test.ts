// Task 3 (EXP plan): ExpMulti(0) (N.js @4260536 raw, the Class EXP multiplier) with its map rules, against lib/arkh's `arkhExpMulti` on every real
// save and character, on maps 251 (plain), 1 (a medallion map: the Shiny Medallion gate), 33 (no monster), 150 (a town) and 40 (a dungeon, Ruling Y).
// A pair whose total differs must be closed by the KNOWN entries of its leaves (`stat: "exp"` rows, njs/expTerms.test.ts): the narrow causes are
// proved the way expTerms proves them (a save patch, or lib/arkh's number seeded into a fresh Ctx; lukSnapshot on lib/arkh's side), and the total
// then equals lib/arkh's. The exact count of such pairs is asserted. A describe body never reads a save.
//
// Ruling II: the Shiny Medallion uses N.js's static MapAFKtarget[CurrentMap], never the character's saved AFK target. Every pair whose saved
// target is kept on the map (afkTarget(ctx) != the map's default) is recomputed with the default forced; the total must not move (`keptMoved` = 0).
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhExpLeaves, arkhExpMulti, damageReasonSeeds, patchLukSnapshot, type Seed } from "../support/arkhOracle";
import { afkTarget } from "@/lib/game/afkTarget";
import { MapAFKtarget } from "@/lib/game/data";
import { attr } from "@/lib/game/attr";
import { contains } from "@/lib/game/lists";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { ExpMulti, lukCurve } from "@/lib/game/njs/ExpMulti";
import { TotalStats } from "@/lib/game/njs/TotalStats";

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"]; // Ruling E: the Tome refusal behind the talents (expTerms.test.ts)

/**
 * Per map: the pairs whose total the KNOWN entries close (exact), the pairs where the character's saved AFK target is kept on the map (`kept`;
 * the total must not move when the default is forced: `keptMoved` is 0 on every map), and what is refused.
 * 251 plain, 1 a medallion map (the account holds the medallion of MapAFKtarget[1]), 33 no monster ("Z": nothing to hold a medallion of),
 * 150 a town, 40 a dungeon (Dungon assumes -1, Ruling Y).
 */
const MAPS: Record<number, { known: number; kept: number; refused: string[]; pairs: number }> = {
  251: { known: 510, kept: 0, refused: HOURZERO, pairs: 1153 },
  1: { known: 510, kept: 0, refused: HOURZERO, pairs: 1153 },
  33: { known: 510, kept: 0, refused: HOURZERO, pairs: 1153 },
  150: { known: 510, kept: 206, refused: HOURZERO, pairs: 1153 },
  40: { known: 510, kept: 0, refused: HOURZERO, pairs: 1153 },
};

/** The EXP LUK curve (ExpMulti @4260536) of a LUK total. */

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(GOLDEN_SAVES.length === 0)("ExpMulti(0) against lib/arkh on every real save and character", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let known = 0;
      let entryPairs = 0; // pairs some KNOWN entry covers whose total really differs: the entry is not stale
      let kept = 0;
      let keptMoved = 0;
      let medallion = 0; // pairs where the gate is open (the account holds the medallion of this map's monster)
      const dirs: Record<string, number> = {};
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map });
          let got: number;
          try {
            got = ExpMulti(ctx, 0);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          pairs++;
          if (contains(attr(ctx, "Compass", 3), (MapAFKtarget as unknown as readonly unknown[])[map])) medallion++;
          const want = arkhExpMulti(path, ci, map);
          // Ruling II: the saved AFK target the game keeps on this map is not read by ExpMulti
          const target = afkTarget(ctx);
          if (target !== (MapAFKtarget as unknown as readonly string[])[map]) {
            kept++;
            const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope & { data: Record<string, unknown> };
            const forced = { ...env, data: { ...env.data, [`AFKtarget_${ci}`]: (MapAFKtarget as unknown as readonly unknown[])[map], [`CurrentMap_${ci}`]: map } };
            if (!rel(ExpMulti(makeCtx(buildGameState(forced), { player: ci, map }), 0), got)) keptMoved++;
          }
          const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "exp" && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
          if (rel(got, want)) {
            dirs.same = (dirs.same ?? 0) + 1;
            continue;
          }
          const reasons = [...new Set(entries.map((d) => d.reason!))];
          if (!reasons.length) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
            continue;
          }
          entryPairs++;
          // a KNOWN difference is proved: lukSnapshot on lib/arkh's side (its envelope gets lib/game's LUK total), the others on lib/game's
          // (a save patch, or lib/arkh's number for the cause seeded into a fresh Ctx), and the totals must then agree
          const seeds: Seed[] = [];
          let proofState = state;
          const patchEnv = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope; // one envelope for every patch reason of the pair
          let patched = false;
          for (const r of reasons.filter((x) => x !== "lukSnapshot")) {
            if (r === "signsExp") {
              // at the total the Main EXP sign is seeded (the leaf test proves it by a save patch, which would also move every other sign effect of the pair)
              seeds.push(["DNSM.StarSigns", ["MainXP"], arkhExpLeaves(path, ci, map).starSignMainXP]);
            } else if (PROOF_PATCHES[r]) {
              PROOF_PATCHES[r](patchEnv.data as Record<string, unknown>, ci, state.charNames.length);
              patched = true;
            } else seeds.push(...damageReasonSeeds(path, ci, r));
          }
          if (patched) proofState = buildGameState(patchEnv);
          const c = makeCtx(proofState, { player: ci, map });
          // negative control: a seed is never the cache key of the call under test (the proof would hold by construction)
          for (const [name, args] of seeds) expect(`${name}${JSON.stringify(args)}`).not.toBe("ExpMulti[0]");
          for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
          // lukSnapshot on lib/arkh's side: its envelope gets the LUK total lib/game has once the other causes are applied (the leaf test proves the patch moves the leaf; on the total it is
          // ~1e-9 of it, so it may sit inside the tolerance)
          let wantProved = want;
          // (also when a seed moves the live LUK, e.g. sign 69 through the golden food: lib/arkh's snapshot is the game's own, unseeded, total and does not follow)
          const lukMoved = TotalStats(c, "LUK") !== TotalStats(ctx, "LUK");
          if (lukMoved && !reasons.includes("lukSnapshot")) {
            // the re-patch stands on its own: lib/arkh's saved snapshot gives the game's unseeded LUK curve (the luk leaf's own 1e-9 tolerance; a snapshot can be stale by a few LUK, which the curve absorbs)
            const snap = (JSON.parse(readFileSync(path, "utf8")) as { data: Record<string, unknown> }).data[`PVStatList_${ci}`];
            const list = (typeof snap === "string" ? JSON.parse(snap) : snap) as number[];
            expect(rel(lukCurve(list[3]), lukCurve(TotalStats(ctx, "LUK"))), `${basename(path)}#${ci}@${map}: the snapshot is not the unseeded LUK`).toBe(true);
          }
          if (reasons.includes("lukSnapshot") || lukMoved) {
            const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
            patchLukSnapshot(env.data as Record<string, unknown>, ci, TotalStats(c, "LUK"));
            wantProved = arkhExpMulti(env, ci, map);
          }
          const proved = ExpMulti(c, 0);
          if (seeds.length || reasons.some((r) => PROOF_PATCHES[r])) expect(rel(proved, got), `${basename(path)}#${ci}@${map}: the proof changed nothing`).toBe(false);
          if (rel(proved, wantProved)) {
            known++;
            continue;
          }
          mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with ${reasons.join("+")} game ${proved}, arkh ${wantProved}`);
        }
      }
      console.info(`[expMulti @${map}] ${pairs} pairs, ${known} known (${entryPairs} entry pairs), ${kept} kept (${keptMoved} moved), ${mismatches.length} mismatches, ${refused.size} refused, ${medallion} medallion, ${JSON.stringify(dirs)}, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover").toBe(entryPairs);
      expect(known, "KNOWN pairs, literally (a stale entry or a new difference fails)").toBe(MAPS[map].known);
      expect(pairs, "saves x characters").toBe(MAPS[map].pairs);
      expect(kept, "pairs whose saved AFK target is kept on the map").toBe(MAPS[map].kept);
      // not vacuous: the Shiny Medallion gate is open for the pairs of a medallion map and never on a map with no monster
      if (map === 1) expect(medallion).toBeGreaterThan(0);
      if (map === 33) expect(medallion).toBe(0);
      expect(keptMoved, "pairs where the kept target moves the total (Ruling II: none)").toBe(0);
      expect([...refused].sort()).toEqual(MAPS[map].refused);
    }, 1_800_000);
  }
});
