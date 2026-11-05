import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { ArmoryUpg, Research } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/** N.js `_customBlock_RoyalG(d, b, e)` @11222521: one function, a chain of named sub-cases. Only the sub-cases the character stats and Damage reach. */
export const RoyalG: (ctx: Ctx, d: string, b: number, e: number) => number = block("RoyalG", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @11223320: Royal statue b, 0 while RoyalG[0][b] is 0, else (1 + Armory 45 / 100) x (Research[41][b] + Research[42][b] x (its level - 1))
    case "StatueBon": {
      listAt(ctx, "RoyalG", 0); // the game indexes RoyalG[0][b] directly
      if (0 == (attr(ctx, "RoyalG", 0, b | 0) as number)) return 0; // loose, as the game has it: an absent level is not 0 here
      const research = Research as unknown as readonly (readonly unknown[])[];
      return (1 + RoyalG(ctx, "ArmoryUpgBonus", 45, 0) / 100) * (asNumber(research[41][b | 0]) + asNumber(research[42][b | 0]) * Math.max(0, asNum(ctx, "RoyalG", 0, b | 0) - 1));
    }
    // @11226771: Armory upgrade b, its level RoyalG[2][b] times its per-level value ArmoryUpg[b][5]
    case "ArmoryUpgBonus": {
      const row = (ArmoryUpg as unknown as readonly (readonly unknown[])[])[b | 0];
      // the game indexes ArmoryUpg[b][5] directly and would throw on an upgrade it does not have
      if (!row) throw new RangeError(`RoyalG ArmoryUpgBonus: no upgrade ${b} in ArmoryUpg`);
      listAt(ctx, "RoyalG", 2); // the game indexes RoyalG[2][b] directly
      return asNum(ctx, "RoyalG", 2, b | 0) * asNumber(row[5]);
    }
    // @11227069: the damage of a hit in the Royal Guardian arena (map 43), where it replaces DamageDealed("Max")
    case "RatDMG":
      return (10 + RoyalG(ctx, "ArmoryUpgBonus", 35, 0)) * (1 + RoyalG(ctx, "ArmoryUpgBonus", 36, 0) / 100);
    default:
      throw new NotPorted("RoyalG", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { ArmoryUpgBonus: true, StatueBon: true, RatDMG: true };
