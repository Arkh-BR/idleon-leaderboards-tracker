import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { ArmoryUpg, Research } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/** N.js `_customBlock_RoyalG(d, b, e)` @11222521: one function, a chain of named sub-cases. Only the sub-cases the character stats, Damage and Drop Rate reach. */
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
    // @11244222: entry b of DNSM.TotKngdSt, a map the game fills key by key when a key is absent (key 0 is dropped when a grade rises,
    // @5537808); 0 is the resource-node grades, RoyalG[5] summed, and 4 (@11245708) the outposts built, the RoyalMaps entries of 3 fields
    // or more (they only read save data, so here they are computed from the save each time)
    case "TotalStatz": {
      let total = 0; // DNSM.TKnS_DN
      if (0 == b) for (let r = 0, n = listAt(ctx, "RoyalG", 5).length; r < n; r++) total = total + asNum(ctx, "RoyalG", 5, r);
      else if (4 == b) {
        for (let r = 0, n = listAt(ctx, "RoyalMaps").length; r < n; r++) {
          const fields = (attr(ctx, "RoyalMaps", r) as { length?: unknown } | null | undefined)?.length; // the game reads RoyalMaps[r].length
          if (3 <= (fields as number)) total = total + 1;
        }
      } else throw new NotPorted("RoyalG", `TotalStatz:b=${b}`);
      return total;
    }
    default:
      throw new NotPorted("RoyalG", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { ArmoryUpgBonus: true, StatueBon: true, RatDMG: true, TotalStatz: [0, 4] };
