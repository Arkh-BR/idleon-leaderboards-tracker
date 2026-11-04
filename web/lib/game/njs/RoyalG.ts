import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { ArmoryUpg } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/** N.js `_customBlock_RoyalG(d, b, e)` @11222521: one function, a chain of named sub-cases. Only the sub-cases the character stats reach. */
export const RoyalG = block("RoyalG", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @11226771: Armory upgrade b, its level RoyalG[2][b] times its per-level value ArmoryUpg[b][5]
    case "ArmoryUpgBonus": {
      const row = (ArmoryUpg as unknown as readonly (readonly unknown[])[])[b | 0];
      // the game indexes ArmoryUpg[b][5] directly and would throw on an upgrade it does not have
      if (!row) throw new RangeError(`RoyalG ArmoryUpgBonus: no upgrade ${b} in ArmoryUpg`);
      listAt(ctx, "RoyalG", 2); // the game indexes RoyalG[2][b] directly
      return asNum(ctx, "RoyalG", 2, b | 0) * asNumber(row[5]);
    }
    default:
      throw new NotPorted("RoyalG", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { ArmoryUpgBonus: true };
