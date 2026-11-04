import { asNum, attr } from "../attr";
import { block } from "../ctx";
import { MissingSaveKey } from "../errors";

/**
 * N.js `_customBlock_CaptBonusCalc(d, b)` @10731821: the sum, over the two bonus slots of captain `b`
 * whose type is `d`, of captain level x slot value. `b < 0` means no captain: 0.
 * The game builds the sum in the scratch `DNSM.CaptnBonuz` (zeroed at the start of every call); here it is a local.
 */
export const CaptBonusCalc = block("CaptBonusCalc", (ctx, d: number, b: number) => {
  if (0 > b) return 0;
  const i = b | 0;
  // the game indexes Captains[b] directly and would throw on a missing row
  if (attr(ctx, "Captains", i) === undefined) throw new MissingSaveKey(`Captains[${i}]`);
  let sum = 0;
  // `Captains[b][1]==d`: loose equality in N.js
  if (attr(ctx, "Captains", i, 1) == d) sum += asNum(ctx, "Captains", i, 3) * asNum(ctx, "Captains", i, 5);
  if (attr(ctx, "Captains", i, 2) == d) sum += asNum(ctx, "Captains", i, 3) * asNum(ctx, "Captains", i, 6);
  return sum;
});
