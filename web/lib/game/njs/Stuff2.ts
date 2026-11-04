import { block } from "../ctx";
import { NotPorted } from "../errors";
import { Summoning } from "./Summoning";

/** N.js `_customBlock_Stuff2(d, b, e)` @10982106. Only the sub-cases the Artifact Find port reaches. */
export const Stuff2 = block("Stuff2", (ctx, d: string, _b: number, _e: number) => {
  switch (d) {
    // @10989439: the Purple Chest Slugs are Event Shop item 48
    case "PurpleChestSlugsOwned":
      return Math.round(Summoning(ctx, "EventShopOwned", 48, 0));
    default:
      throw new NotPorted("Stuff2", d);
  }
});
