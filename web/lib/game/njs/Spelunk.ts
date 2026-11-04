import { asNum } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";
import { listAt } from "../lists";

/** N.js `_customBlock_Spelunk(d, b, e)` @11099923. Only the sub-cases the Artifact Find port reaches. */
export const Spelunk = block("Spelunk", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @11100719: lore note b of the first Spelunking list is found (Spelunk[0][b] >= 1)
    case "DoWeHaveLoreN1":
      listAt(ctx, "Spelunk", 0); // the game indexes Spelunk[0][b] directly
      return 1 <= asNum(ctx, "Spelunk", 0, b | 0) ? 1 : 0;
    default:
      throw new NotPorted("Spelunk", d);
  }
});
