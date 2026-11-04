import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { EmperorBon, LegendTalents } from "../data";
import { NotPorted } from "../errors";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { JellyOperation } from "./JellyOperation";

/** N.js `_customBlock_Thingies(d, b, e)` @10955095. Only the sub-cases the Artifact Find port reaches. */
export const Thingies = block("Thingies", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @10970802: Spelunk legend talent `b` (talent level x the talent's per-level value, rounded)
    case "LegendPTS_bonus":
      return Math.round(asNum(ctx, "Spelunk", 18, b | 0) * asNumber(LegendTalents[b | 0][2]));
    // @10978278: the Bundle ban_i was bought
    case "Have_ban_i":
      return 1 == attr(ctx, "BundlesReceived", "ban_i") ? 1 : 0;
    // @10969070: Clam Work bonus b is on while OptionsListAccount[464] is past b
    case "ClamWorkBonus":
      return asNum(ctx, "OptionsListAccount", 464) > b ? 1 : 0;
    case "EmperorBon":
      return emperorBon(ctx, b);
    default:
      throw new NotPorted("Thingies", d);
  }
});

/**
 * `DNSM.EmperorBon`, the table `EmperorBon` fills the first time it is asked (@10979748, and when b == -1): 12 buckets; for each of the
 * OptionsListAccount[369] Emperor fights g, bucket CustomLists.EmperorBon[2][g mod 48] gains CustomLists.EmperorBon[1][that bucket].
 * Here it is built from the save each time.
 */
function emperorBonTable(ctx: Ctx): number[] {
  const table: number[] = new Array(12).fill(0);
  const [, gain, bucketOf] = EmperorBon as unknown as readonly unknown[][];
  for (let g = 0, n = asNum(ctx, "OptionsListAccount", 369) | 0; g < n; g++) {
    const bucket = asNumber(bucketOf[g - 48 * Math.floor(g / 48)]) | 0;
    table[bucket] = asNumber(table[bucket]) + asNumber(gain[bucket]);
  }
  return table;
}

/** `EmperorBon` @10979748: bucket b of that table, times 1 + (Arcane upgrade 48 + Arcade 51 + Jelly upgrade 28) / 100, rounded down. */
function emperorBon(ctx: Ctx, b: number): number {
  return Math.floor(asNumber(emperorBonTable(ctx)[b | 0]) * (1 + (ArcaneType(ctx, "ArcaneUpgBonus", 48, 0) + (ArcadeBonus(ctx, 51) + JellyOperation(ctx, "RoG_BonusQTY", 28, 0))) / 100));
}
