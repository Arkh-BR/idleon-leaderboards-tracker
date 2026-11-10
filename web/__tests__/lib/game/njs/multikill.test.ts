// Task 3 (Multikill plan): WorkbenchStuff("MultiKillTOTAL") (N.js @7810403 raw) against lib/arkh's Multikill total on every real save and character, on maps 251 (the Observed Max
// reference), 301 and 306 (the W7 ladder; 306 is Clamworks), 216 (the Cove: real characters in cavern 17), 14, 150 (a town) and 40 (a dungeon, Ruling Y). Two floors of a pair can differ
// only if a KNOWN entry of a leaf (`stat: "mk"`, njs/mkTerms.test.ts) closes it, on its narrow cause on lib/game's side (a save patch, or lib/arkh's number for the cause seeded into a
// fresh Ctx), never by waiving the character: a reason counts only if the pair stops closing without it. Exact counts, per reason too. Map 33's target has no monster definition:
// N.js itself throws there, so the block refuses instead of answering. A describe body never reads a save.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhMultikill, damageReasonSeeds, type Seed } from "../support/arkhOracle";
import { attr } from "@/lib/game/attr";
import { InvalidSaveValue, MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";

const OWN = 'WorkbenchStuff["MultiKillTOTAL",0,0]';
const total = (c: Ctx) => WorkbenchStuff(c, "MultiKillTOTAL", 0, 0);
const HOURZERO: string[] = []; // HourZero, the one save lib/tome could not score, is out of the parity corpus (PARITY_EXCLUDED, support/arkhOracle.ts): nothing is refused
const NO_MONSTER = 'AFKtarget: expected a MonsterDefinitions key, got string "Z"'; // MapAFKtarget[33]
const PAIRS = 1153; // the parity corpus: 105 saves x characters (HourZero is out, PARITY_EXCLUDED)

/** Per map: the pairs whose total the KNOWN entries close, and how many each reason really explains. */
const MAPS: Record<number, { known: number; byReason: Record<string, number> }> = {
  251: { known: 4, byReason: { signsDmg: 3, "signs@wis": 1 } },
  301: { known: 2, byReason: { signsDmg: 2 } },
  306: { known: 0, byReason: {} },
  216: { known: 2, byReason: { signsDmg: 2 } },
  14: { known: 3, byReason: { signsDmg: 3 } },
  150: { known: 2, byReason: { signsDmg: 2 } },
  40: { known: 5, byReason: { signsDmg: 5, gfoodSign69: 1 } }, // big_guy69123 #0 takes both to cross tier 49
};
const COVES = 123; // the characters in cavern 17: the Cove's pairs on map 216

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

/** The total with the causes `reasons` applied: the save patches on one fresh state, lib/arkh's seeds in its cache. */
function proved(path: string, ci: number, map: number, reasons: readonly string[]): number {
  const patches = reasons.filter((r) => PROOF_PATCHES[r]);
  let state = stateOf(path);
  if (patches.length) {
    const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
    for (const r of patches) PROOF_PATCHES[r](env.data as Record<string, unknown>, ci, state.charNames.length);
    state = buildGameState(env);
  }
  const seeds: Seed[] = reasons.filter((r) => !PROOF_PATCHES[r]).flatMap((r) => damageReasonSeeds(path, ci, r));
  // negative control: a seed is never the cache key of the call under test (the proof would hold by construction)
  for (const [name, args] of seeds) expect(`${name}${JSON.stringify(args)}`).not.toBe(OWN);
  const c = makeCtx(state, { player: ci, map });
  for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
  return total(c);
}

describe.skipIf(GOLDEN_SAVES.length === 0)('WorkbenchStuff("MultiKillTOTAL") against lib/arkh on every real save and character', () => {
  for (const map of Object.keys(MAPS).map(Number)) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const refused = new Set<string>();
      const byReason: Record<string, number> = {};
      const inert: Record<string, number> = {};
      let pairs = 0;
      let known = 0;
      let coves = 0;
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map });
          let got: number;
          try {
            got = total(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          pairs++;
          if (216 == map && 17 == attr(ctx, "Holes", 0, ci)) coves++;
          const want = arkhMultikill(path, ci, map);
          if (got === want) continue;
          const reasons = [...new Set(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "mk" && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true)).map((d) => d.reason!))];
          if (!reasons.length) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
            continue;
          }
          const closed = proved(path, ci, map, reasons);
          if (closed !== want) {
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with ${reasons.join("+")} ${closed}`);
            continue;
          }
          known++;
          for (const r of reasons) {
            const without = reasons.length > 1 ? proved(path, ci, map, reasons.filter((x) => x !== r)) : got;
            if (without === want) inert[r] = (inert[r] ?? 0) + 1;
            else byReason[r] = (byReason[r] ?? 0) + 1;
          }
        }
      }
      console.info(`[multikill @${map}] ${pairs} pairs, ${coves} in the Cove, ${known} known ${JSON.stringify(byReason)}, inert ${JSON.stringify(inert)}, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      for (const m of mismatches.slice(0, 40)) console.info(`[multikill @${map}] ${m}`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(known, "KNOWN pairs, literally (a stale entry or a new difference fails)").toBe(MAPS[map].known);
      expect(byReason, "per reason").toEqual(MAPS[map].byReason);
      expect(inert, "a listed reason that explains nothing").toEqual({});
      expect(pairs, "saves x characters").toBe(PAIRS);
      expect([...refused].sort()).toEqual(HOURZERO);
      if (216 == map) expect(coves, "the characters in cavern 17").toBe(COVES);
    }, 7_200_000);
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
          answered.push(`${basename(path)}#${ci}: ${total(makeCtx(state, { player: ci, map: 33 }))}`);
        } catch (e) {
          if (e instanceof InvalidSaveValue) {
            threw++;
            invalid.add(e.message);
          } else if (e instanceof MissingSaveKey) refused.add(`${basename(path)}: ${e.key}`);
          else throw e;
        }
      }
    }
    console.info(`[multikill @33] ${threw} refused (InvalidSaveValue) ${JSON.stringify([...invalid])}, ${refused.size} refused for other reasons, ${answered.length} answered`);
    expect(answered.slice(0, 20)).toEqual([]);
    expect([...invalid], "the cause: map 33's AFK target, not any other bad value").toEqual([NO_MONSTER]);
    expect(threw).toBe(PAIRS);
    expect([...refused].sort()).toEqual(HOURZERO);
  }, 1_800_000);
});
