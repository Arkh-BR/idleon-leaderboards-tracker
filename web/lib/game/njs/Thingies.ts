import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { LegendTalents } from "../data";
import { NotPorted } from "../errors";

/** N.js `_customBlock_Thingies(d, b, e)` @10955095. Only the sub-cases the Artifact Find port reaches. */
export const Thingies = block("Thingies", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @10970802: Spelunk legend talent `b` (talent level x the talent's per-level value, rounded)
    case "LegendPTS_bonus":
      return Math.round(asNum(ctx, "Spelunk", 18, b | 0) * asNumber(LegendTalents[b | 0][2]));
    default:
      throw new NotPorted("Thingies", d);
  }
});
