import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { AlchemyDescription } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listOrMapAt } from "../lists";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { MainframeBonus } from "./MainframeBonus";
import { Summoning } from "./Summoning";
import { Summoning2 } from "./Summoning2";

type Row = readonly unknown[];

/** N.js `_customBlock_CauldronStats(d, b, e, f)` @5107757. Only the sub-cases the Artifact Find port reaches. */
export const CauldronStats = block("CauldronStats", (ctx, d: string, b: number, e: number, _f: number) => {
  switch (d) {
    case "VialBonus":
      return vialBonus(ctx, b, e);
    default:
      throw new NotPorted("CauldronStats", d);
  }
});

/**
 * How many vials are at level 13 or more (the "Gold Crown" vials of the Alchemy page): the alchemy actor (ActorEvents_481) counts them
 * once when it is created, into its `GenINFO[108]` @9086043. It walks AlchemyDescription[4].length - 1 positions and skips vial 41
 * (`41 > g ? g : g + 1`), so a vial 41 at level 13 does not count.
 */
function crownVials(ctx: Ctx): number {
  listOrMapAt(ctx, "CauldronInfo", 4); // the game indexes CauldronInfo[4][vial] directly
  let n = 0;
  for (let g = 0, end = (AlchemyDescription as unknown as Row[][])[4].length - 1; g < end; g++) {
    if (13 <= asNum(ctx, "CauldronInfo", 4, 41 > g ? g : g + 1)) n += 1;
  }
  return Math.round(n);
}

/**
 * `VialBonus` @5108874 for the item `e` of the Alchemy list `b` (the vials are list 4): the curve of AlchemyDescription[b][e] (name
 * [3], constants [1] and [2]) at the level CauldronInfo[b][e], times
 *  - 1 + (2 per Gold Crown vial from Rift 35, plus the Vault upgrade 42) / 100;
 *  - 1 + Meritoc bonus 20 / 100;
 *  - 2 when the lab bonus 10 (My 1st Chemistry Set) is 2, that is connected.
 * The game keeps the first term in the scratch `DNSM.CauldStatDNzz`; here it is a local.
 */
function vialBonus(ctx: Ctx, b: number, e: number): number {
  const row = (AlchemyDescription as unknown as Row[][])[b | 0]?.[e | 0];
  // the game indexes AlchemyDescription[b][e][3] directly and would throw on an item it does not have
  if (!row) throw new RangeError(`CauldronStats VialBonus: no item (${b}, ${e}) in AlchemyDescription`);
  const crowns = 34 < asNum(ctx, "Rift", 0) ? 2 * crownVials(ctx) : 0;
  const boost = crowns + Summoning(ctx, "VaultUpgBonus", 42, 0);
  listOrMapAt(ctx, "CauldronInfo", b | 0); // the game indexes CauldronInfo[b][e] directly
  const curve = () => ArbitraryCode5Inputs(ctx, hString(row[3]), asNumber(row[1]), asNumber(row[2]), asNum(ctx, "CauldronInfo", b | 0, e | 0), 0, 0);
  return 2 == MainframeBonus(ctx, 10)
    ? 2 * (1 + boost / 100) * (1 + Summoning2(ctx, "MeritocBonusz", 20, 0) / 100) * curve()
    : (1 + boost / 100) * (1 + Summoning2(ctx, "MeritocBonusz", 20, 0) / 100) * curve();
}
