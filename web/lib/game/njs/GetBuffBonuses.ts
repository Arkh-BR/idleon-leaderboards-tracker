import { attr } from "../attr";
import { block, runtime, type Ctx } from "../ctx";
import { InvalidSaveValue, NotPorted } from "../errors";
import { contains } from "../lists";
import { Dungon } from "./Dungon";
import { GetTalentNumber } from "./GetTalentNumber";
import type { Ported } from "../ported";

/**
 * `_BuffIDsOn` of the HUD actor (ActorEvents_167): the ids of the buffs the character has running. The actor's create @4931241 fills it
 * from the save's `BuffsActive` (the load @19920420; one [id, time left, duration] per buff, which leaves the list when its time runs out), after emptying
 * that list on a dungeon lobby (`Dungon() == 0`). So it is the save's list, not a value only the running game has.
 */
function buffIDsOn(ctx: Ctx): unknown[] {
  if (0 == Dungon(ctx)) return [];
  const list = attr(ctx, "BuffsActive");
  if (!Array.isArray(list)) throw new InvalidSaveValue("BuffsActive", "an array", list);
  return list.map((b) => (b !== null && typeof b === "object" ? (b as Record<string, unknown>)[0] : undefined));
}

/**
 * N.js `_customBlock_GetBuffBonuses(c, b)` @4279371: the bonus of the active buff `c` (a talent): its talent number, curve `b`, while
 * the buff runs, else 0. Only buff 94 (the STR one) is ported, and 108 and 124 as not counted; 615 and 46 have rules of their own.
 */
export const GetBuffBonuses = block("GetBuffBonuses", (ctx, c: number, b: number) => {
  // a product decision of the Damage page (the plan's Global Constraints): the active buffs 108 and 124 are not counted
  if (108 === c || 124 === c) return runtime(ctx, `GetBuffBonuses(${c})`, "active buff, not counted");
  if (94 !== c) throw new NotPorted("GetBuffBonuses", `c=${c}`);
  return contains(buffIDsOn(ctx), c) ? GetTalentNumber(ctx, b, c) : 0;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [94, 108, 124];
