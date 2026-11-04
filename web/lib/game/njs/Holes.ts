import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { CosmoUpgrades } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";

/** N.js `_customBlock_Holes(d, b, e)` @10990457. Only the sub-cases the Artifact Find port reaches. */
export const Holes = block("Holes", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @11002068: Cosmo upgrade (b, e) of the Holes: level x value, rounded down; (2, 1) is 3 to the level, at least 1
    case "CosmoBonusQTY": {
      const level = Math.round(4 + b);
      listAt(ctx, "Holes", level); // the game indexes Holes[4 + b][e] directly
      if (2 == b && 1 == e) return Math.floor(Math.max(1, Math.pow(3, asNum(ctx, "Holes", level, e | 0))));
      const upgrade = CosmoUpgrades[b | 0]?.[e | 0];
      // the game indexes CosmoUpgrades[b][e][0] directly
      if (!upgrade) throw new RangeError(`Holes CosmoBonusQTY: no Cosmo upgrade (${b}, ${e}) in CosmoUpgrades`);
      return Math.floor(asNumber(upgrade[0]) * asNum(ctx, "Holes", level, e | 0));
    }
    default:
      throw new NotPorted("Holes", d);
  }
});
