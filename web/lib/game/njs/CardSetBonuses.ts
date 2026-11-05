import { attr } from "../attr";
import { block } from "../ctx";
import { IDforCardSETbonus } from "../data";
import { InvalidSaveValue } from "../errors";
import { hString } from "../hstring";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_CardSetBonuses(c, b)` @7764461: the card set bonus `IDforCardSETbonus[b]` as the character's equipped set (Cards[3],
 * CSetEq of the character: one entry, set text -> value) has it, else 0. `c` is not read. The value is returned raw, as N.js does (no `c.asNumber`;
 * the callers add it as it is).
 */
export const CardSetBonuses = block("CardSetBonuses", (ctx, _c: number, b: string) => {
  const set = attr(ctx, "Cards", 3);
  if (set === null || typeof set !== "object") throw new InvalidSaveValue("Cards[3]", "a map", set);
  const key = hString((IDforCardSETbonus as Readonly<Record<string, string>>)[b]);
  return Object.hasOwn(set, key) ? (set as Record<string, number>)[key] : 0;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
