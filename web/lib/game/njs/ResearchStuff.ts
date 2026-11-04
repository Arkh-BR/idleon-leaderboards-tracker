import { asNum } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";

/** N.js `_customBlock_ResearchStuff(d, b, e)` @11163957. Only the sub-cases the Artifact Find port reaches. */
export const ResearchStuff = block("ResearchStuff", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @11177849: `Grid_Bonus`. 1==e is the grid square's level itself (Research[0][b]); the other e are not ported.
    case "Grid_Bonus":
      if (e === 1) return Math.round(asNum(ctx, "Research", 0, b | 0));
      throw new NotPorted("ResearchStuff", `Grid_Bonus:e=${e}`);
    default:
      throw new NotPorted("ResearchStuff", d);
  }
});
