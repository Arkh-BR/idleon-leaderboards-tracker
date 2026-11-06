// Task 3 (AFK plan): AFKgainrates("Fighting") (N.js @4443869) with its map rules, and the page's rate (afkFightRate), against lib/arkh's
// `arkhAfkRate` on every real save and character, on maps 251 (plain), 306 (Clamworks, x0.2), 216 (the Cove's map; the Cove itself needs
// cavern 17: the synthetic clone below) and two maps whose AFK target is not a fight (6 mining, 33 no monster). A pair whose total differs
// must be closed by the KNOWN entries of its leaves (`stat: "afk"` rows, njs/afkTerms.test.ts): the narrow causes are seeded into a fresh
// Ctx, and the total then equals lib/arkh's. The exact count of such pairs is asserted. A describe body never reads a save.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhAfkLeaves, arkhAfkRate, arkhStatSeeds } from "../support/arkhOracle";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { AFK_POOLS, afkRate } from "@/lib/arkh/stats/defs/afk-gains";
import { afkTarget } from "@/lib/game/afkTarget";
import { MONSTERS, MapAFKtarget } from "@/lib/game/data";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { AFKgainrates, afkFightRate } from "@/lib/game/njs/AFKgainrates";

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"]; // Ruling E: the Tome refusal behind the talents (afkTerms.test.ts)

/**
 * Per map: the pairs whose total the KNOWN entries close (exact), the pairs the game's saved AFK target moves (below), what is refused and
 * how many pairs are 0. A map with nothing to fight is 0 and refuses nothing: the target is checked before the rate is computed.
 *  251 plain, 306 Clamworks, 216 "Nothing" (0 unless the character's saved target is kept there), 0 "Nothing", 33 no monster, 6 mining (a skill
 *  target shows the Fighting rate, as lib/arkh does).
 */
const MAPS: Record<number, { known: number; retargeted: number; refused: string[]; zero: "none" | "all" | "some" }> = {
  251: { known: 338, retargeted: 0, refused: HOURZERO, zero: "none" },
  306: { known: 338, retargeted: 0, refused: HOURZERO, zero: "none" },
  216: { known: 21, retargeted: 124, refused: HOURZERO, zero: "some" },
  0: { known: 0, retargeted: 0, refused: [], zero: "all" },
  33: { known: 0, retargeted: 0, refused: [], zero: "all" },
  6: { known: 338, retargeted: 0, refused: HOURZERO, zero: "none" },
};

/** lib/arkh's own rule for a target (afk.ts `afkType`): nothing to fight (no definition, "Nothing", "Paying_Respect") is 0, anything else 1. */
const arkhType = (target: string): number => {
  const t = (MONSTERS as unknown as Record<string, { AFKtype?: string } | undefined>)[target]?.AFKtype;
  return t === undefined || t === "Nothing" || t === "Paying_Respect" ? 0 : 1;
};
/**
 * lib/arkh's rate with the AFK target the game would have. lib/arkh always takes the map's default target (MapAFKtarget); the game keeps
 * the character's saved target on the map it stands on (N.js scene load @15291900, Ruling V: lib/game/afkTarget.ts). Only R3 changes.
 */
function arkhRateWithTarget(path: string, ci: number, map: number, target: string): number {
  const l = arkhAfkLeaves(path, ci, map);
  const sum = [...AFK_POOLS[0].sources, ...AFK_POOLS[1].sources].reduce((a, id) => a + l[id], 0);
  return afkRate({ sum, arcane: l.arcaneMapAfk, etc92: l.etc92, clam: l.clamworks306, cove: l.cglunkoCove, type: arkhType(target) });
}

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(GOLDEN_SAVES.length === 0)("afkFightRate against lib/arkh on every real save and character", () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let nonZero = 0;
      let known = 0;
      let retargeted = 0;
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map });
          let got: number;
          try {
            got = afkFightRate(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          pairs++;
          if (got !== 0) nonZero++;
          // the character stands on this map with a saved target other than its default: the game keeps it (Ruling V), lib/arkh does not
          const target = afkTarget(ctx);
          const kept = target !== (MapAFKtarget as unknown as string[])[map];
          if (kept) retargeted++;
          const want = kept ? arkhRateWithTarget(path, ci, map, target) : arkhAfkRate(path, ci, map);
          if (rel(got, want)) continue;
          // a KNOWN difference is proved, not skipped: lib/arkh's number for each cause the pair's leaves name, seeded into a fresh Ctx
          const reasons = [...new Set(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "afk" && d.save === basename(path) && (d.ci ?? ci) === ci).map((d) => d.reason!))];
          if (!reasons.length) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
            continue;
          }
          const c = makeCtx(state, { player: ci, map });
          const seeds = arkhStatSeeds(path, ci, reasons, "str");
          // negative control: a seed is never the cache key of the call under test (the proof would hold by construction)
          for (const [name, args] of seeds) expect(`${name}${JSON.stringify(args)}`).not.toBe('AFKgainrates["Fighting"]');
          for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
          const seeded = afkFightRate(c);
          expect(rel(seeded, got), `${basename(path)}#${ci}@${map}: the seeds changed nothing`).toBe(false);
          if (rel(seeded, want)) known++;
          else mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with lib/arkh's ${reasons.join("+")} ${seeded}`);
        }
      }
      console.info(`[afkGains @${map}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${retargeted} retargeted, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(pairs).toBeGreaterThan(500);
      expect(known, "KNOWN pairs (a stale entry or a new difference fails)").toBe(MAPS[map].known);
      expect(retargeted, "pairs whose saved AFK target the game keeps").toBe(MAPS[map].retargeted);
      expect([...refused].sort()).toEqual(MAPS[map].refused);
      // not vacuous: a map with something to fight has rates, one without has none
      const z = MAPS[map].zero;
      if (z === "all") expect(nonZero).toBe(0);
      else if (z === "none") expect(nonZero).toBe(pairs);
      else expect(nonZero).toBeGreaterThan(0);
    }, 1_800_000);
  }
});

// The Cove: the game reads cavern 17 from Holes[0][character]; the real saves hold few or none, so ARKHE's is set to 17 on a clone.
const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");
describe.skipIf(!ARKHE || !existsSync(ARKHE))("the Crystal Glunko Cove (map 216, cavern 17) and the Clamworks on ARKHE", () => {
  it("the Cove replaces the rate; lib/game equals lib/arkh's rate and total", () => {
    const env = JSON.parse(readFileSync(ARKHE!, "utf8")) as GameEnvelope & { data: Record<string, unknown> };
    const raw = env.data.Holes;
    const holes = (typeof raw === "string" ? JSON.parse(raw) : structuredClone(raw)) as number[][];
    const ci = 0;
    expect(holes[0][ci], "the cavern the save has is not 17 (else this proves nothing)").not.toBe(17);
    holes[0][ci] = 17;
    env.data.Holes = typeof raw === "string" ? JSON.stringify(holes) : holes;
    const state = buildGameState(env);
    const cove = makeCtx(state, { player: ci, map: 216 });
    const leaves = arkhAfkLeaves(structuredClone(env), ci, 216);
    expect(leaves.cglunkoCove).toBeGreaterThan(0);
    const rate = AFKgainrates(cove, "Fighting");
    expect(rate).toBeCloseTo(leaves.cglunkoCove, 12);
    expect(afkFightRate(cove)).toBe(rate);
    expect(rate).toBe(arkhAfkRate(structuredClone(env), ci, 216));
    expect(rate).toBe(computeArkhAfkGains(structuredClone(env), ci, 216).total);
    // another map is not the Cove: its rate is the plain one
    expect(AFKgainrates(makeCtx(state, { player: ci, map: 251 }), "Fighting")).not.toBe(rate);
  });

  it("the Clamworks multiplier is 0.2 on map 306 and 1 on 251", () => {
    expect(arkhAfkLeaves(ARKHE!, 0, 306).clamworks306).toBe(0.2);
    expect(arkhAfkLeaves(ARKHE!, 0, 251).clamworks306).toBe(1);
    const state = stateOf(ARKHE!);
    expect(AFKgainrates(makeCtx(state, { player: 0, map: 306 }), "Fighting")).toBeCloseTo(arkhAfkRate(ARKHE!, 0, 306), 9);
    expect(AFKgainrates(makeCtx(state, { player: 0, map: 251 }), "Fighting")).toBeCloseTo(arkhAfkRate(ARKHE!, 0, 251), 9);
  });
});
