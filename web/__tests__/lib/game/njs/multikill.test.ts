// WorkbenchStuff("MultiKillTOTAL") (N.js @7810403 raw) on every real save and character, on map 33: its target has no monster definition, so
// N.js itself throws there and the block refuses instead of answering. A describe body never reads a save.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES } from "../support/saves";
import { InvalidSaveValue, MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
const total = (c: Ctx) => WorkbenchStuff(c, "MultiKillTOTAL", 0, 0);
const HOURZERO: string[] = []; // HourZero is out of the default corpus (PARITY_EXCLUDED, support/saves.ts): nothing is refused
const NO_MONSTER = 'AFKtarget: expected a MonsterDefinitions key, got string "Z"'; // MapAFKtarget[33]
const PAIRS = 1153; // the default corpus: 105 saves x characters (HourZero is out, PARITY_EXCLUDED)

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(GOLDEN_SAVES.length === 0)('WorkbenchStuff("MultiKillTOTAL") on every real save and character', () => {

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
