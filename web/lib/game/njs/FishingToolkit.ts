import { asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { FishToolkitInfo } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { charKey, opt } from "../state";
import type { Ported } from "../ported";

/**
 * `PersonalValuesMap.FishingToolkit` of the current player: the choice in each toolkit slot. The cloud load @19924016 reads it as a list from
 * `PVFishingToolkit_<player>` (getLoadList). The key is not in SAVE_ATTRS (a dynamic key of the loader's loop), so it is read here.
 */
function toolkitChoices(ctx: Ctx): readonly unknown[] {
  const key = charKey("PVFishingToolkit", ctx.player);
  const v = opt(ctx.state, key);
  if (v === undefined) throw new MissingSaveKey(key);
  if (!Array.isArray(v)) throw new InvalidSaveValue(key, "an array", v);
  return v;
}

/**
 * N.js `_customBlock_FishingToolkit(d)` @5080069. It first rebuilds DNSM.FishTKdl, seven 0s plus, for the two toolkit slots k, FishToolkitInfo[k][choice k][e + 1]
 * at e; "POW" (@5083903) is FishTKdl[6]. Only "POW" is ported (the stats after it read the fishing spot and the efficiency).
 */
export const FishingToolkit = block("FishingToolkit", (ctx, d: string) => {
  if ("POW" != d) throw new NotPorted("FishingToolkit", d);
  const info = FishToolkitInfo as unknown as readonly (readonly (readonly unknown[])[])[];
  const choices = toolkitChoices(ctx);
  let pow = 0; // DNSM.FishTKdl[6]
  for (let k = 0; k < 2; k++) {
    const row = info[k][asNumber(choices[k]) | 0];
    // the game indexes FishToolkitInfo[k][choice][7] directly and would throw on a choice the table does not have
    if (!row) throw new RangeError(`FishingToolkit: no choice ${choices[k]} in FishToolkitInfo[${k}]`);
    pow = pow + asNumber(row[7]);
  }
  return pow;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { POW: true };
