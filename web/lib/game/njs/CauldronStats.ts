import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { AlchemyDescription, Number2Letter } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listOrMapAt } from "../lists";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { ArcaneType } from "./ArcaneType";
import { MainframeBonus } from "./MainframeBonus";
import { Summoning } from "./Summoning";
import { Summoning2 } from "./Summoning2";
import type { Ported } from "../ported";

type Row = readonly unknown[];

/** N.js `_customBlock_CauldronStats(d, b, e, f)` @5107757. Only the sub-cases the Artifact Find port and the character stats reach. */
export const CauldronStats: (ctx: Ctx, d: string, b: number, e: number, f: number) => number = block("CauldronStats", (ctx, d: string, b: number, e: number, _f: number) => {
  switch (d) {
    case "VialBonus":
      return vialBonus(ctx, b, e);
    // @5107805: bubble `e` of cauldron `b`: its curve (AlchemyDescription[b][e], name [3], constants [1] and [2]) at its level
    // CauldronInfo[b][e]; a Prisma bubble (isBubbleSuperr) times max(1, the Prisma multiplier)
    case "BubbleBonus": {
      const row = (AlchemyDescription as unknown as Row[][])[b | 0]?.[e | 0];
      // the game indexes AlchemyDescription[b][e][3] directly and would throw on a bubble it does not have
      if (!row) throw new RangeError(`CauldronStats BubbleBonus: no bubble (${b}, ${e}) in AlchemyDescription`);
      listOrMapAt(ctx, "CauldronInfo", b | 0); // the game indexes CauldronInfo[b][e] directly
      const curve = () => ArbitraryCode5Inputs(ctx, hString(row[3]), asNumber(row[1]), asNumber(row[2]), asNum(ctx, "CauldronInfo", b | 0, e | 0), 0, 0);
      return 1 == CauldronStats(ctx, "isBubbleSuperr", b, e, 0) ? Math.max(1, ArcaneType(ctx, "PrismaBonusMult", 0, 0)) * curve() : curve();
    }
    // @5108674: the bubble is a Prisma bubble, its letter and number ("_3,") in OptionsListAccount[384]
    case "isBubbleSuperr":
      return -1 != hString(attr(ctx, "OptionsListAccount", 384)).indexOf(`${hString(Number2Letter[b | 0])}${Math.round(e)},`) ? 1 : 0;
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

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { VialBonus: true, BubbleBonus: true, isBubbleSuperr: true };
