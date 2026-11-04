import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { Research as CustomResearch, ResGridSquares } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { Companions } from "./Companions";
import { Dreamstuff } from "./Dreamstuff";
import { SushiStuff } from "./SushiStuff";

/** N.js `_customBlock_ResearchStuff(d, b, e)` @11163957. Only the sub-cases the Artifact Find port reaches. */
export const ResearchStuff: (ctx: Ctx, d: string, b: number, e: number) => number = block("ResearchStuff", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "Grid_Bonus":
      return gridBonus(ctx, b, e);
    // @11179174: the multiplier every grid square gets (at least 1 where it is used)
    case "Grid_Bonus_Allmulti":
      listAt(ctx, "Research", 0); // the game indexes Research[0][173] directly
      return (
        1 +
        (Companions(ctx, 55) +
          (5 * Math.min(1, asNum(ctx, "Research", 0, 173) * Companions(ctx, 0)) +
            (Dreamstuff(ctx, "CloudBonus", 71) + (Dreamstuff(ctx, "CloudBonus", 72) + (Dreamstuff(ctx, "CloudBonus", 76) + SushiStuff(ctx, "RoG_BonusQTY", 53, 0)))))) /
          100
      );
    default:
      throw new NotPorted("ResearchStuff", d);
  }
});

/**
 * `Grid_Bonus` @11177849, grid square `b`. `1 == e` is the square's level itself (Research[0][b]); `2 == e` has a branch per
 * square, of which 67, 68 and 107 (the value x the number of Research[11] entries) are ported; every other `e` (the calls pass 0) is
 * the square's own value: ResGridSquares[b][2] x level, times 1 + CustomLists.Research[5][selector] / 100 when the square has a
 * selector (Research[1][b], -1 for none), times max(1, Grid_Bonus_Allmulti).
 */
function gridBonus(ctx: Ctx, b: number, e: number): number {
  if (1 == e) return Math.round(asNum(ctx, "Research", 0, b | 0));
  if (2 == e) {
    if (67 == b || 68 == b || 107 == b) return ResearchStuff(ctx, "Grid_Bonus", b, 0) * listAt(ctx, "Research", 11).length;
    throw new NotPorted("ResearchStuff", `Grid_Bonus:e=2,b=${b}`);
  }
  const square = (ResGridSquares as unknown as readonly (readonly unknown[])[])[b | 0];
  // the game indexes ResGridSquares[b][2] directly
  if (!square) throw new RangeError(`ResearchStuff Grid_Bonus: no grid square ${b} in ResGridSquares`);
  listAt(ctx, "Research", 0); // the game indexes Research[0][b] and Research[1][b] directly
  listAt(ctx, "Research", 1);
  // N.js tests the raw selector, `-1 == Research[1][b|0]` (loose): a null one is not -1 and reads CustomLists.Research[5][0]
  if (-1 == attr(ctx, "Research", 1, b | 0)) return asNumber(square[2]) * asNum(ctx, "Research", 0, b | 0) * Math.max(1, ResearchStuff(ctx, "Grid_Bonus_Allmulti", 0, 0));
  const pct = (CustomResearch as unknown as readonly (readonly unknown[])[])[5][asNum(ctx, "Research", 1, b | 0) | 0];
  return asNumber(square[2]) * asNum(ctx, "Research", 0, b | 0) * (1 + asNumber(pct) / 100) * Math.max(1, ResearchStuff(ctx, "Grid_Bonus_Allmulti", 0, 0));
}
