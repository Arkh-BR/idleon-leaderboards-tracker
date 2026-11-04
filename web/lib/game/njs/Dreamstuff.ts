import { attr } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";

/** N.js `_customBlock_Dreamstuff(d, b)` @10809949. Only the sub-cases the Artifact Find port reaches. */
export const Dreamstuff = block("Dreamstuff", (ctx, d: string, b: number) => {
  switch (d) {
    // @10810155: cloud b's bonus is on while its weekly boss is undefeated (`WeeklyBoss.h["d_" + b] == -1`, loose)
    case "CloudBonus":
      return -1 == attr(ctx, "WeeklyBoss", `d_${b}`) ? 1 : 0;
    default:
      throw new NotPorted("Dreamstuff", d);
  }
});
