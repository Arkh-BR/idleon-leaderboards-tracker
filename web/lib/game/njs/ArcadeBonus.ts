import { asNum, asNumber, attr } from "../attr";
import { block } from "../ctx";
import { ArcadeShopInfo } from "../data";
import { hString } from "../hstring";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { Companions } from "./Companions";

/**
 * N.js `_customBlock_ArcadeBonus(d)` @7881530: the bonus of Arcade upgrade `d`, one function for every upgrade. Its curve is
 * ArcadeShopInfo[d][3] with constants [1] and [2], at the upgrade's level ArcadeUpg[d]. The level 101 doubles it and 102
 * makes it 6 times; Companion 27 doubles it again. The game keeps the multiplier in the scratch `DNSM.ArcadBonDNz`; here it is a local.
 */
export const ArcadeBonus = block("ArcadeBonus", (ctx, d: number) => {
  const info = ArcadeShopInfo[d | 0];
  // the game indexes ArcadeShopInfo[d][3] directly and would throw on an upgrade it does not have
  if (!info) throw new RangeError(`ArcadeBonus: no upgrade ${d} in ArcadeShopInfo`);
  let multi = 1;
  // N.js `101 == ArcadeUpg[d|0]`: loose equality on the raw element
  const level = attr(ctx, "ArcadeUpg", d | 0);
  if (101 == level) multi = 2 * multi;
  else if (102 == level) multi = 6 * multi;
  if (1 == Companions(ctx, 27)) multi = 2 * multi;
  return multi * ArbitraryCode5Inputs(ctx, hString(info[3]), asNumber(info[1]), asNumber(info[2]), asNum(ctx, "ArcadeUpg", d | 0), 0, 0);
});
