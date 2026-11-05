// The game's per-character attributes that the cloud loader assembles from scratch keys instead of mapping one save key to one
// attribute (SAVE_ATTRS leaves them out), the walk over `PlayerDATABASE`, and the inventory actor's item count.
import type { Ctx } from "./ctx";
import { asNum, asNumber } from "./attr";
import { InvalidSaveValue, MissingSaveKey } from "./errors";
import { hString } from "./hstring";
import { listAt } from "./lists";
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

/**
 * `ActorEvents_29._ItemsOwnedMap[item]`: the current character's inventory (InventoryOrder) summed by name over ItemQuantity, which the
 * inventory actor builds when it starts (@7075609) and again on every change (CountInventory @7042726). The game reads it with c.asNumber.
 */
export function itemsOwned(ctx: Ctx, item: string): number {
  let n = 0;
  const order = listAt(ctx, "InventoryOrder");
  for (let e = 0; e < order.length; e++) if ("Blank" != order[e] && item == hString(order[e])) n = n + asNum(ctx, "ItemQuantity", e);
  return n;
}
