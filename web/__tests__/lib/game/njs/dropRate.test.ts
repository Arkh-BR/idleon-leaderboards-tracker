// Task 3 (DR plan): TotalStats("Drop_Rarity") (N.js @4190432 raw, the Player Info "Drop Rate") with its map rules, against lib/arkh's `arkhDropRate`
// on every real save and character, on maps 251 (plain), 216 (the Cove: a character in cavern 17 gets Holes2("Cglunko_DR")), 150 (a town), 40 (a
// dungeon, Ruling Y) and 33 (no monster). A pair whose total differs must be closed by the KNOWN entries of its leaves (`stat: "dr"` rows,
// njs/drTerms.test.ts), each proved on its narrow cause: lukSnapshot and holesLoad251 on lib/arkh's side (its envelope gets lib/game's LUK total, the
// Holes[22] the load step leaves), the others on lib/game's (a save patch, or lib/arkh's number for the cause seeded into a fresh Ctx), and the
// totals then agree. glimboUnleveled never moves the total (its factor is max(1, ·): checked, not seeded). The exact count of such pairs is
// asserted. A describe body never reads a save.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhDrLeaves, arkhDropRate, damageReasonSeeds, patchLukSnapshot, type Seed } from "../support/arkhOracle";
import { attr } from "@/lib/game/attr";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { listAt } from "@/lib/game/lists";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { Minehead } from "@/lib/game/njs/Minehead";
import { dropRateLuk, TotalStats } from "@/lib/game/njs/TotalStats";

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const HOURZERO: string[] = []; // HourZero, the one save lib/tome could not score, is out of the parity corpus (PARITY_EXCLUDED, support/arkhOracle.ts): nothing is refused

/**
 * Per map: the pairs whose total the KNOWN entries close (exact), the pairs in the Cove (map 216 with the character in cavern 17), the differing
 * pairs whose glimboUnleveled entry was checked to leave the Glimbo factor alone, what is refused, and the pairs (saves x characters, less the refused).
 */
const MAPS: Record<number, { known: number; cove: number; glimbo: number; refused: string[]; pairs: number }> = {
  251: { known: 1040, cove: 0, glimbo: 11, refused: HOURZERO, pairs: 1153 },
  216: { known: 921, cove: 123, glimbo: 11, refused: HOURZERO, pairs: 1153 },
  150: { known: 1040, cove: 0, glimbo: 11, refused: HOURZERO, pairs: 1153 },
  40: { known: 1040, cove: 0, glimbo: 11, refused: HOURZERO, pairs: 1153 },
  33: { known: 1040, cove: 0, glimbo: 11, refused: HOURZERO, pairs: 1153 },
};

/** The KNOWN reasons proved on lib/arkh's side (drTerms.test.ts's ARKH_SIDE): what each writes into lib/arkh's envelope for character `ci`, from lib/game's `c`. */
const ARKH_SIDE: Record<string, (data: Record<string, unknown>, ci: number, c: Ctx) => void> = {
  // PVStatList_<ci>[3] gets lib/game's live TotalStats("LUK") (STAT_WHY.lukSnapshot)
  lukSnapshot: (d, ci, c) => patchLukSnapshot(d, ci, TotalStats(c, "LUK")),
  // Holes[22] gets the list the game's load steps leave, which lib/game's state holds (STAT_WHY.holesLoad251)
  holesLoad251: (d, _ci, c) => {
    const holes = (typeof d.Holes === "string" ? JSON.parse(d.Holes) : d.Holes) as unknown[];
    holes[22] = [...listAt(c, "Holes", 22)];
    d.Holes = typeof d.Holes === "string" ? JSON.stringify(holes) : holes;
  },
};

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(GOLDEN_SAVES.length === 0)("TotalStats(\"Drop_Rarity\") against lib/arkh on every real save and character", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let known = 0;
      let entryPairs = 0; // pairs some KNOWN entry covers whose total really differs: the entry is not stale
      let cove = 0;
      let glimbo = 0;
      const byReason: Record<string, number> = {};
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map });
          let got: number;
          try {
            got = TotalStats(ctx, "Drop_Rarity");
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          pairs++;
          if (216 == map && 17 == attr(ctx, "Holes", 0, ci)) cove++;
          const want = arkhDropRate(path, ci, map);
          if (rel(got, want)) continue;
          const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "dr" && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
          // glimboUnleveled: lib/game's GlimboDRmulti 1 against lib/arkh's leaf 0, inside Math.max(1, ·) (@4195647): the same factor, so not a cause of a total
          if (entries.some((d) => d.reason === "glimboUnleveled")) {
            glimbo++;
            expect(Math.max(1, Minehead(ctx, "GlimboDRmulti", 0, 0)), `${basename(path)}#${ci}: the Glimbo factor`).toBe(Math.max(1, arkhDrLeaves(path, ci, map).glimbo));
          }
          const reasons = [...new Set(entries.map((d) => d.reason!))].filter((r) => r !== "glimboUnleveled");
          if (!reasons.length) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
            continue;
          }
          entryPairs++;
          for (const r of reasons) byReason[r] = (byReason[r] ?? 0) + 1;
          // lib/game's side: a save patch, or lib/arkh's number for the cause seeded into a fresh Ctx
          const seeds: Seed[] = [];
          const patchEnv = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope; // one envelope for every patch reason of the pair
          let patched = false;
          for (const r of reasons.filter((x) => !ARKH_SIDE[x])) {
            if (PROOF_PATCHES[r]) {
              PROOF_PATCHES[r](patchEnv.data as Record<string, unknown>, ci, state.charNames.length);
              patched = true;
            } else seeds.push(...damageReasonSeeds(path, ci, r));
          }
          const c = makeCtx(patched ? buildGameState(patchEnv) : state, { player: ci, map });
          // negative control: a seed is never the cache key of the call under test (the proof would hold by construction)
          for (const [name, args] of seeds) expect(`${name}${JSON.stringify(args)}`).not.toBe('TotalStats["Drop_Rarity"]');
          for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
          // lib/arkh's side: its envelope gets what lib/game reads. When a seed moves lib/game's live LUK (fam68 through the talents, the Tome), lib/arkh's
          // snapshot, the game's own unseeded total, does not follow: the re-patch stands on its own only if that snapshot is the unseeded LUK's curve
          const lukMoved = TotalStats(c, "LUK") !== TotalStats(ctx, "LUK");
          if (lukMoved && !reasons.includes("lukSnapshot")) {
            const snap = (JSON.parse(readFileSync(path, "utf8")) as { data: Record<string, unknown> }).data[`PVStatList_${ci}`];
            const list = (typeof snap === "string" ? JSON.parse(snap) : snap) as number[];
            expect(rel(dropRateLuk(list[3]), dropRateLuk(TotalStats(ctx, "LUK"))), `${basename(path)}#${ci}@${map}: the snapshot is not the unseeded LUK`).toBe(true);
          }
          let wantProved = want;
          const arkhSide = reasons.filter((r) => ARKH_SIDE[r]);
          if (arkhSide.length || lukMoved) {
            const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
            for (const r of new Set([...arkhSide, ...(lukMoved ? ["lukSnapshot"] : [])])) ARKH_SIDE[r](env.data as Record<string, unknown>, ci, c);
            wantProved = arkhDropRate(env, ci, map);
          }
          const proved = TotalStats(c, "Drop_Rarity");
          // the proof does something: a side it touches moves
          if (seeds.length || patched) expect(rel(proved, got), `${basename(path)}#${ci}@${map}: the lib/game proof changed nothing`).toBe(false);
          if (arkhSide.length && !seeds.length && !patched) expect(rel(wantProved, want), `${basename(path)}#${ci}@${map}: the lib/arkh patch changed nothing`).toBe(false);
          if (rel(proved, wantProved)) {
            known++;
            continue;
          }
          mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with ${reasons.join("+")} game ${proved}, arkh ${wantProved}`);
        }
      }
      console.info(`[dropRate @${map}] ${pairs} pairs, ${known} known (${entryPairs} entry pairs) ${JSON.stringify(byReason)}, ${cove} in the Cove, ${glimbo} glimbo checked, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover").toBe(entryPairs);
      expect(known, "KNOWN pairs, literally (a stale entry or a new difference fails)").toBe(MAPS[map].known);
      expect(pairs, "saves x characters").toBe(MAPS[map].pairs);
      expect(cove, "pairs in the Cove").toBe(MAPS[map].cove);
      expect(glimbo, "differing pairs with a glimboUnleveled entry").toBe(MAPS[map].glimbo);
      expect([...refused].sort()).toEqual(MAPS[map].refused);
    }, 1_800_000);
  }
});
