import { asNum } from "../attr";
import { block, type Ctx } from "../ctx";
import { NotPorted } from "../errors";
import type { Ported } from "../ported";

/** N.js `_customBlock_RandomEvent(d, b, e)` @10777743. Only the sub-cases the Artifact Find port reaches. */
export const RandomEvent = block("RandomEvent", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @10780919: the Killroy Skull Shop upgrade b. Upgrade 0 (Artifact Find): 1 + P / (300 + P), P = OptionsListAccount[228]
    // b == 3 (the Gallery): 10 x P / (200 + P), P = OptionsListAccount[467]
    case "KillroyBonuses": {
      if (0 == b) {
        const p = asNum(ctx, "OptionsListAccount", 228);
        return 1 + p / (300 + p);
      }
      if (3 == b) {
        const p = asNum(ctx, "OptionsListAccount", 467);
        return 10 * (p / (200 + p));
      }
      throw new NotPorted("RandomEvent", `KillroyBonuses:b=${b}`);
    }
    // @10782126: DNSM.FracIsBn[b|0]
    case "FractalIslandBonus":
      return fractalIslandBonus(ctx, b);
    default:
      throw new NotPorted("RandomEvent", d);
  }
});

/** The Fractal Island thresholds on OptionsListAccount[184]: ActorEvents_623's GenINFO[25], pushed @11693947. */
const FRACTAL_THRESHOLDS = [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4];

/**
 * `DNSM.FracIsBn` is filled once when ActorEvents_623 (the game's main actor) is created: GenINFO[25] holds the 8 Fractal
 * Island thresholds, and element f is 1 when OptionsListAccount[184] has reached threshold f, else 0 (@11694238). It is
 * what `RandomEvent("FractalIslandBonus", b)` reads. Before the actor exists the property is absent and the game answers
 * 0; a running game always has it, so this replays the fill from the save.
 */
function fractalIslandBonus(ctx: Ctx, b: number): number {
  const i = b | 0;
  if (i < 0 || i >= FRACTAL_THRESHOLDS.length) throw new RangeError(`RandomEvent FractalIslandBonus: no Fractal Island bonus ${b} (the game reads undefined)`);
  return asNum(ctx, "OptionsListAccount", 184) >= FRACTAL_THRESHOLDS[i] ? 1 : 0;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { KillroyBonuses: [0, 3], FractalIslandBonus: true };
