import { asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { PostOffUpgradeInfo } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { hString } from "../hstring";
import { charKey, opt } from "../state";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import type { Ported } from "../ported";

/**
 * `PostOfficeInfo[3][b][0]`, the current player's level of Post Office box `b`: the load @19923540 writes `POu_<player>[B]` into it for
 * every B the save has, over a list of 36 boxes the game starts at [0] (@6194400). A box the save does not list is that 0.
 */
function boxLevel(ctx: Ctx, b: number): number {
  const key = charKey("POu", ctx.player);
  const list = opt(ctx.state, key);
  if (list === undefined) throw new MissingSaveKey(key);
  if (!Array.isArray(list)) throw new InvalidSaveValue(key, "an array", list);
  return asNumber(list[b | 0]);
}

/** N.js `_customBlock_PostOfficeINFO(d, b, e)` @5100465. Only the sub-cases the character stats reach. */
export const PostOfficeINFO = block("PostOfficeINFO", (ctx, d: string, b: number, e: string) => {
  switch (d) {
    // @5101447: bonus `e` ("0".."2") of box `b`: its curve (PostOffUpgradeInfo[b][1..3 + 4e]) at the box level, less the level the
    // bonus starts at ([13] for the second, [14] for the third), rounded; 0 while that is not above 0
    case "BonusAmount": {
      const row = (PostOffUpgradeInfo as unknown as readonly (readonly unknown[])[])[b | 0];
      // the game indexes PostOffUpgradeInfo[b][...] directly and would throw on a box it does not have
      if (!row) throw new RangeError(`PostOfficeINFO BonusAmount: no box ${b} in PostOffUpgradeInfo`);
      let level = boxLevel(ctx, b); // DNSM.PostOffInfoDN1
      if (1 == asNumber(e)) level = level - asNumber(row[13]);
      else if (2 == asNumber(e)) level = level - asNumber(row[14]);
      level = Math.round(level);
      const k = 4 * asNumber(e);
      return 0 < level ? ArbitraryCode5Inputs(ctx, hString(row[(3 + k) | 0]), asNumber(row[(1 + k) | 0]), asNumber(row[(2 + k) | 0]), level, 0, 0) : 0;
    }
    default:
      throw new NotPorted("PostOfficeINFO", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { BonusAmount: true };
