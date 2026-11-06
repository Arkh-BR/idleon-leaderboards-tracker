import { asNum, asNumber, attr } from "../attr";
import { block, runtime, type Ctx } from "../ctx";
import { CompassUpg } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { AtomCollider } from "./AtomCollider";
import { FarmingStuffs } from "./FarmingStuffs";
import { GamingStatType } from "./GamingStatType";
import { GetSetBonus } from "./GetSetBonus";
import { JellyOperation } from "./JellyOperation";
import { Ninja } from "./Ninja";
import { Summoning } from "./Summoning";
import { SushiStuff } from "./SushiStuff";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/** N.js `_customBlock_Windwalker(d, b, e)` @11059720: one function, a chain of named sub-cases. Only the sub-cases the character stats and Damage reach. */
export const Windwalker: (ctx: Ctx, d: string, b: number, e: number) => number = block("Windwalker", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @11077842: Compass upgrade b, its level Compass[0][b] times its value CompassUpg[b][5]; the upgrades with [9] == 1 also times
    // 1 + (Compass 39 + Compass 80) / 100, and 45 doubles for every 50 levels
    case "CompassBonus": {
      const row = (CompassUpg as unknown as readonly (readonly unknown[])[])[b | 0];
      // the game indexes CompassUpg[b][...] directly and would throw on an upgrade it does not have
      if (!row) throw new RangeError(`Windwalker CompassBonus: no upgrade ${b} in CompassUpg`);
      listAt(ctx, "Compass", 0); // the game indexes Compass[0][b] directly
      const level = asNum(ctx, "Compass", 0, Math.round(b));
      if (1 == asNumber(row[9])) return (1 + (Windwalker(ctx, "CompassBonus", 39, 0) + Windwalker(ctx, "CompassBonus", 80, 0)) / 100) * level * asNumber(row[5]);
      if (45 == b) return level * asNumber(row[5]) * Math.pow(2, Math.floor(level / 50));
      return level * asNumber(row[5]);
    }
    // @11078575: the % a doubled stamp gets
    case "StampDoubler":
      return (
        100 +
        (AtomCollider(ctx, "AtomBonuses", 12, 0) +
          (Ninja(ctx, "PristineBon", 20, 0) +
            (Windwalker(ctx, "CompassBonus", 76, 0) +
              (GetSetBonus(ctx, "EMPEROR_SET", "Bonus", 0, 0) +
                (20 * Summoning(ctx, "EventShopOwned", 18, 0) +
                  (GamingStatType(ctx, "PaletteBonus", 23, 0) + (FarmingStuffs(ctx, "ExoticBonusQTY", 49, 0) + Math.round(asNum(ctx, "Spelunk", 4, 3))))))))) +
        (Thingies(ctx, "LegendPTS_bonus", 36, 0) + (SushiStuff(ctx, "RoG_BonusQTY", 17, 0) + JellyOperation(ctx, "RoG_BonusQTY", 50, 0) / 100))
      );
    // @11062351: the Compass Tempest form, `.1 <= GetBuffBonuses(420,1) ? (1 == NONdummies[67] && 100 < its BuffsActive timer ? 1 : 0) : 0`.
    // The masterclass forms are not counted (the Damage page's product decision), as in PlayerHPmax and PlayerAccTot
    case "CompassTempest":
      return runtime(ctx, "Windwalker(CompassTempest)", "masterclass form, not counted");
    // @11073453: DNSM.TotalTitanKills, the Titans killed: the entries of Compass[1] equal to 1. The game counts them on the first call and
    // keeps the number for the session; here it is counted from the save each time
    case "TotalTitanKills": {
      const titans = listAt(ctx, "Compass", 1); // the game reads Compass[1].length
      let total = 0;
      for (let l = 0; l < titans.length; l++) if (1 == attr(ctx, "Compass", 1, l)) total = total + 1;
      return total;
    }
    default:
      throw new NotPorted("Windwalker", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { CompassBonus: true, StampDoubler: true, CompassTempest: true, TotalTitanKills: true };
