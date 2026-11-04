import { asNum } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";
import { Breeding } from "./Breeding";
import type { Ported } from "../ported";

/** N.js `_customBlock_RiftStuff(d, b)` @10789971. Only the sub-cases the Artifact Find port reaches. */
export const RiftStuff = block("RiftStuff", (ctx, d: string, _b: number) => {
  switch (d) {
    // @10791380: how many star signs the Rift lets the account run without wearing them: none below Rift 10, else 5 + the Breeding's
    // Shiny bonus 3
    case "enabledStarSigns":
      return 10 > asNum(ctx, "Rift", 0) ? 0 : 5 + Breeding(ctx, "ShinyBonusS", "Nah", 3, -1);
    default:
      throw new NotPorted("RiftStuff", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { enabledStarSigns: true };
