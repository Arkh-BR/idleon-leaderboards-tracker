import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { Research as ResearchLists } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/** N.js `_customBlock_JellyOperation(d, b, e)` @5164037. Only the sub-cases the Artifact Find port reaches. */
export const JellyOperation = block("JellyOperation", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @5168369: Research upgrade b is on while Research[7][9] is past b (or the game asks with e == 99); its value is Research list 47
    case "RoG_BonusQTY": {
      listAt(ctx, "Research", 7); // the game indexes Research[7][9] directly
      return asNum(ctx, "Research", 7, 9) > b || 99 == e ? asNumber((ResearchLists[47] as readonly unknown[])[b | 0]) : 0;
    }
    default:
      throw new NotPorted("JellyOperation", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { RoG_BonusQTY: true };
