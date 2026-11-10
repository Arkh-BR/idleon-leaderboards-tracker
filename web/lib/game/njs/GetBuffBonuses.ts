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
 * the buff runs, else 0. Ported: 94 (STR), 273 (move speed), 288 (accuracy), 45, 46 and 469 (Multikill), 40 (SkillStats AllEfficiencies); 195, 420 and 585
 * (read by the masterclass forms Wraith, Tempest and Tesseract) and 615 (read by the dungeon branch) by the generic rule, except that 615 is 1, not a
 * talent number (`615 == c ? 1`), and 46 counts only on the classes 4 and 5 while the buff 45 runs (`46 == c ? (4 == CharacterClass || ...`);
 * 108 and 124 as not counted. The forms and the dungeon are not counted by the Damage page, in the functions that read these buffs.
 */
export const GetBuffBonuses: (ctx: Ctx, c: number, b: number) => number = block("GetBuffBonuses", (ctx, c: number, b: number) => {
  // a product decision of the Damage page (the plan's Global Constraints): the active buffs 108 and 124 are not counted
  if (108 === c || 124 === c) return runtime(ctx, `GetBuffBonuses(${c})`, "active buff, not counted");
  if (!COUNTED.includes(c)) throw new NotPorted("GetBuffBonuses", `c=${c}`);
  if (!contains(buffIDsOn(ctx), c)) return 0; // @4279371
  if (615 === c) return 1;
  if (46 === c) return (4 == (attr(ctx, "CharacterClass") as number) || 5 == (attr(ctx, "CharacterClass") as number)) && 0 < GetBuffBonuses(ctx, 45, 1) ? GetTalentNumber(ctx, b, c) : 0;
  return GetTalentNumber(ctx, b, c);
});

/** The buffs ported (46 and 615 with their own rule). */
const COUNTED = [94, 273, 288, 195, 420, 585, 615, 45, 46, 469, 40];

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [...COUNTED, 108, 124];
