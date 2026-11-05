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
 * the buff runs, else 0. Ported: 94 (STR), 273 (move speed), 288 (accuracy); 195, 420 and 585 (read by the masterclass forms Wraith,
 * Tempest and Tesseract) and 615 (read by the dungeon branch) by the generic rule, except that 615 is 1, not a talent number
 * (`615 == c ? 1`); 108 and 124 as not counted. 46 has a rule of its own and is not ported. The forms and the dungeon are not counted
 * by the Damage page, in the functions that read these buffs.
 */
export const GetBuffBonuses = block("GetBuffBonuses", (ctx, c: number, b: number) => {
  // a product decision of the Damage page (the plan's Global Constraints): the active buffs 108 and 124 are not counted
  if (108 === c || 124 === c) return runtime(ctx, `GetBuffBonuses(${c})`, "active buff, not counted");
  if (!COUNTED.includes(c)) throw new NotPorted("GetBuffBonuses", `c=${c}`);
  if (615 === c) return contains(buffIDsOn(ctx), c) ? 1 : 0; // @4279371
  return contains(buffIDsOn(ctx), c) ? GetTalentNumber(ctx, b, c) : 0;
});

/** The buffs ported to the generic rule. */
const COUNTED = [94, 273, 288, 195, 420, 585, 615];

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [...COUNTED, 108, 124];
