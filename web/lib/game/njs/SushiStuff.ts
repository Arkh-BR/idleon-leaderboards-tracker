import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { Research as ResearchLists } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_SushiStuff(d, b, e)` @11205992: one function, a chain of named sub-cases. Only the sub-cases the Artifact Find
 * port reaches.
 */
export const SushiStuff: (ctx: Ctx, d: string, b: number, e: number) => number = block("SushiStuff", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @11210580
    case "MaxTier":
      return 63;
    // @11218198: DNSM.UNQ_sushi
    case "UniqueSushi":
      return uniqueSushi(ctx);
    // @11218643: Research upgrade b is on while the unique sushi are more than b (or the game asks with e == 99); its value is Research list 37
    case "RoG_BonusQTY":
      return SushiStuff(ctx, "UniqueSushi", 0, 0) > b || 99 == e ? asNumber((ResearchLists[37] as readonly unknown[])[b | 0]) : 0;
    default:
      throw new NotPorted("SushiStuff", d);
  }
});

/**
 * `UniqueSushi` @11218198: how many sushi tiers, from 0, the account has found in a row: Sushi[5][t] >= 0 up to the first one that is not
 * (at most MaxTier + 1 = 64 are looked at). The game fills DNSM.UNQ_sushi with it on the first call and keeps it for the session
 * (b == -1 refreshes it); here it is computed from the save each time.
 */
function uniqueSushi(ctx: Ctx): number {
  listAt(ctx, "Sushi", 5); // the game indexes Sushi[5][t] directly
  let found = 0;
  for (let t = 0, n = Math.round(SushiStuff(ctx, "MaxTier", 0, 0) + 1); t < n; t++) {
    if (0 <= asNum(ctx, "Sushi", 5, t)) found = t + 1;
    else break;
  }
  return Math.round(found);
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { MaxTier: true, UniqueSushi: true, RoG_BonusQTY: true };
