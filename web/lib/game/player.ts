// The game's per-character attributes that the cloud loader assembles from scratch keys instead of mapping one save key to one
// attribute (SAVE_ATTRS leaves them out), and the walk over `PlayerDATABASE`.
import type { Ctx } from "./ctx";
import { asNumber } from "./attr";
import { InvalidSaveValue, MissingSaveKey } from "./errors";
import { charKey, opt } from "./state";

/**
 * `SkillLevels[i]` (the talent levels) of character `player`: the cloud load @19925600 zero-fills the character's SkillLevels, then writes
 * every entry of the map `SL_<player>` into it (`SkillLevels[key | 0] = value`). An index the map does not have is that zero; one past the
 * list is `undefined`, which every reader takes through `c.asNumber` (0) too. `PlayerDATABASE[name].SkillLevels` is the same for another
 * character. A save without the key is refused (Ruling E).
 */
export function skillLevel(ctx: Ctx, i: number, player: number = ctx.player): number {
  const key = charKey("SL", player);
  const map = opt(ctx.state, key);
  if (map === undefined) throw new MissingSaveKey(key);
  if (map === null || typeof map !== "object") throw new InvalidSaveValue(key, "a map", map);
  return asNumber((map as Record<string, unknown>)[i | 0]);
}

/** `D.mapCount(PlayerDATABASE)`: one entry per character, in character order (the keys are the names, inserted by the load). */
export const playerCount = (ctx: Ctx): number => ctx.state.charNames.length;
