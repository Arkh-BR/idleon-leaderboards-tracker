// The /talents-level tracker: one talent of one character as the page's tree, on lib/game. The rows are lib/talentsLevel/explain's; this file only picks the state and the Ctx they read.
//
// The page shows both talent presets. A character's other preset is another save: SL_<i> replaced by SLpre_<i> and PlayerStuff_<i>[1] by the preset, which is where N.js AllTalentLV looks for the super talents
// (Spelunk[20 + i + 12 x preset]). That envelope is built fresh from a copy of the source and its state is not registered in `stateOf`'s cache: asking for the other preset must not change what the active one answers.
import type { ArkhNode } from "@/lib/dropRate/node";
import { plainTalent } from "@/lib/talentsLevel/explain/plain";
import { makeCtx } from "../ctx";
import { buildGameState, type GameEnvelope, type GameState } from "../state";
import { stateOf } from "./page";

export type TalentOpts = {
  /** Which preset to read (0 = Preset 1, 1 = Preset 2). Undefined: the character's active one. */
  presetIdx?: 0 | 1;
  /** Count the talent as a super talent whatever the preset lists (the Hypothetical tab). */
  forceSuperActive?: boolean;
};

/** A save value that is a JSON string in a cloud save and already parsed in a test envelope; null when it is neither. */
function parsed(v: unknown): unknown {
  if ("string" !== typeof v) return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** The preset a character has active: `PlayerStuff_<i>[1]`, 0 when the save does not say. */
function activePreset(data: Record<string, unknown>, charIdx: number): 0 | 1 {
  const stuff = parsed(data[`PlayerStuff_${charIdx}`]);
  return Array.isArray(stuff) && 1 === stuff[1] ? 1 : 0;
}

/**
 * The GameState a character's talents are read on, with `presetIdx` as its active preset. The active one is `stateOf(save)`; the other is derived from a copy of the envelope and never kept. A save without
 * `SLpre_<i>` has no talents on the other preset: it reads as empty.
 */
export function presetState(save: unknown, charIdx: number, presetIdx: 0 | 1): GameState {
  const env = save as GameEnvelope;
  const data = (env?.data ?? {}) as Record<string, unknown>;
  if (presetIdx === activePreset(data, charIdx)) return stateOf(save);
  const stuff = parsed(data[`PlayerStuff_${charIdx}`]);
  const derived = {
    ...data,
    [`SL_${charIdx}`]: parsed(data[`SLpre_${charIdx}`]) ?? {},
    [`PlayerStuff_${charIdx}`]: Object.assign([], Array.isArray(stuff) ? stuff : [], { 1: presetIdx }),
  };
  return buildGameState({ ...env, data: derived } as GameEnvelope); // the state clones what it keeps: the source is not touched
}

/** `computeTalentEffective`'s tree on lib/game: the talent `talentId` of character `charIdx` of a save envelope. The page has no map: the Ctx is on map 0. */
export function computeGameTalent(save: unknown, charIdx: number, talentId: number, opts: TalentOpts = {}): ArkhNode {
  const state = undefined === opts.presetIdx ? stateOf(save) : presetState(save, charIdx, opts.presetIdx);
  return plainTalent(makeCtx(state, { player: charIdx, map: 0 }), talentId, { forceSuper: !!opts.forceSuperActive });
}
