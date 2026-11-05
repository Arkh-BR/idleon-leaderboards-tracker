import { asNum } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";
import { Summoning } from "./Summoning";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/** N.js `_customBlock_Stuff2(d, b, e)` @10982106. Only the sub-cases the Artifact Find port reaches. */
export const Stuff2 = block("Stuff2", (ctx, d: string, _b: number, _e: number) => {
  switch (d) {
    // @10989439: the Purple Chest Slugs are Event Shop item 48
    case "PurpleChestSlugsOwned":
      return Math.round(Summoning(ctx, "EventShopOwned", 48, 0));
    // @10990303: the golden cape vines, 1 + OptionsListAccount[669] + 3 with the Bundle ban_o
    case "GoldCapeVinesOwned":
      return Math.round(1 + (asNum(ctx, "OptionsListAccount", 669) + 3 * Thingies(ctx, "Have_ban_o", 0, 0)));
    default:
      throw new NotPorted("Stuff2", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { PurpleChestSlugsOwned: true, GoldCapeVinesOwned: true };
