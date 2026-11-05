import { attr } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";
import { Sailing } from "./Sailing";
import type { Ported } from "../ported";

/** N.js `_customBlock_Dreamstuff(d, b)` @10809949. Only the sub-cases the Artifact Find port reaches. */
export const Dreamstuff = block("Dreamstuff", (ctx, d: string, b: number) => {
  switch (d) {
    // @10810155: cloud b's bonus is on while its weekly boss is undefeated (`WeeklyBoss.h["d_" + b] == -1`, loose)
    case "CloudBonus":
      return -1 == attr(ctx, "WeeklyBoss", `d_${b}`) ? 1 : 0;
    // @10810042: the Shimmer bonuses' multiplier, 1 + Artifact 31, between 1 and 4
    case "AllShimmerBonuses":
      return Math.max(1, Math.min(4, 1 + (100 * Sailing(ctx, "ArtifactBonus", 31, 0)) / 100));
    default:
      throw new NotPorted("Dreamstuff", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { CloudBonus: true, AllShimmerBonuses: true };
