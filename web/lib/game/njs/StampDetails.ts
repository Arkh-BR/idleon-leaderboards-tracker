import { hString } from "../hstring";
import { itemDef } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_StampDetails(c)` @4427254: stamp `c` (its tab floor(c / 1000), its index the rest): its item's `desc_line1`
 * ("Stamp" + A/B/C + (index + 1)) split on commas. A list, so a plain function.
 */
export function StampDetails(c: number): string[] {
  const tab = Math.floor(c / 1e3);
  return hString(itemDef(`Stamp${0 == tab ? "A" : 1 == tab ? "B" : "C"}${Math.round(c - 1e3 * tab + 1)}`).desc_line1).split(",");
}

/** What this module covers (lib/game/ported.ts): the whole function, for any stamp. */
export const PORTED: Ported = "generic";
