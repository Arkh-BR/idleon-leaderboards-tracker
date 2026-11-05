import { asNumber, attr } from "../attr";
import { block } from "../ctx";
import { BribeDescriptions } from "../data";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_GetBribeBonus(d)` @5061911: the value of bribe `d` (a number given as text, "34") when it is bought,
 * `BribeStatus[d] == 1` (loose), else 0. The value is BribeDescriptions[d][5].
 */
export const GetBribeBonus = block("GetBribeBonus", (ctx, d: string) => {
  const i = Math.round(asNumber(d));
  if (1 != attr(ctx, "BribeStatus", i)) return 0;
  const row = BribeDescriptions[i];
  // the game indexes BribeDescriptions[d][5] directly and would throw on a bribe it does not have
  if (!row) throw new RangeError(`GetBribeBonus: no bribe ${d} in BribeDescriptions`);
  return asNumber(row[5]);
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
