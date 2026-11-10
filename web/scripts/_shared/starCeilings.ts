import { charKey, opt } from "../../lib/game/state";
import { stateOf } from "../../lib/game/trackers/page";

// Star talent skill-index range (the "Special Talent" / Star tabs).
export const STAR_MIN = 615;
export const STAR_MAX = 658;

/**
 * The saved per-char cap (`SM_<ci>[id]`) of each star talent, the max over the given chars. 625 (Toilet Paper Postage) is the live cauldron-liquid count,
 * a per-account value with no fixed ceiling, so it is skipped. A save the state refuses contributes nothing.
 */
export function starCeilingsOf(save: unknown, charIdxs: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  try {
    const state = stateOf(save);
    for (const ci of charIdxs) {
      for (let id = STAR_MIN; id <= STAR_MAX; id++) {
        if (id === 625) continue;
        const v = Number(opt(state, charKey("SM", ci), id)) || 0;
        if (v > (out[id] || 0)) out[id] = v;
      }
    }
  } catch {
    return {};
  }
  return out;
}
