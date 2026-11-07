import { asNum, asNumber } from "../attr";
import { block, withPlayer, type Ctx } from "../ctx";
import { SpelunkRocks, SpelunkUpg, Spelunky } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { getLOG } from "./getLOG";
import type { Ported } from "../ported";

/** N.js `_customBlock_Spelunk(d, b, e)` @11099923. Only the sub-cases the Artifact Find port reaches. */
export const Spelunk: (ctx: Ctx, d: string, b: number, e: number) => number = block("Spelunk", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @11100719: lore note b of the first Spelunking list is found (Spelunk[0][b] >= 1)
    case "DoWeHaveLoreN1":
      listAt(ctx, "Spelunk", 0); // the game indexes Spelunk[0][b] directly
      return 1 <= asNum(ctx, "Spelunk", 0, b | 0) ? 1 : 0;
    // @11100450: the sixth card star, from the third lore note (Spelunk[0][2] >= 1)
    case "6starCards":
      listAt(ctx, "Spelunk", 0); // the game indexes Spelunk[0][2] directly
      return 1 <= asNum(ctx, "Spelunk", 0, 2) ? 1 : 0;
    case "ShopUpgBonus":
      return shopUpgBonus(ctx, b, e);
    // @11126462: the grand discoveries, Spelunk[44] over the SpelunkRocks, summed (rounded at each step)
    case "GrandDiscoveries_Total": {
      listAt(ctx, "Spelunk", 44); // the game indexes Spelunk[44][g] directly
      let total = 0; // DNSM.SpelunkyGrD
      for (let f = 0; f < SpelunkRocks.length; f++) total = Math.round(total + asNum(ctx, "Spelunk", 44, f));
      return total;
    }
    // @11132738: entry b of DNSM.BigFishBon, the table the game builds on the first call of the session (and when b == -1; here it is built
    // from the save each time): for each Big Fish g of Spelunky[18], its level Spelunk[11][g] over (100 + level), times the third field of its row
    case "BigFishBonuses": {
      listAt(ctx, "Spelunk", 11); // the game indexes Spelunk[11][g] directly
      const fish = (Spelunky as unknown as readonly (readonly unknown[])[])[18];
      const table: number[] = [];
      for (let g = 0; g < fish.length; g++)
        table.push((asNum(ctx, "Spelunk", 11, g) / (100 + asNum(ctx, "Spelunk", 11, g))) * asNumber(hString(fish[g]).split(",")[2]));
      const v = table[Math.max(0, b) | 0];
      // the game answers undefined past the table, which the caller would turn into NaN
      if (v === undefined) throw new RangeError(`Spelunk BigFishBonuses: no Big Fish ${b} in Spelunky[18]`);
      return v;
    }
    default:
      throw new NotPorted("Spelunk", d);
  }
});

/**
 * `ShopUpgBonus` @11112825. With e == 1, shop upgrade b's raw value: SpelunkUpg[b][4] x max(0, its level Spelunk[5][b]). Otherwise entry b of
 * DNSM.SpelunkyUpgTOT, a table the game builds on the first call of the session (and when b == -1; here it is built from the save each time):
 * every upgrade's raw value, then these entries adjusted, in this order: 0 x and 8 x (1 + /100) every character's Lv0[19] summed; 1 and 10 x
 * (1 + 5 x Spelunk[6].length / 100); 2 x (2 + /100) and 9 x (1 + /100) Spelunk[1] summed; 3 x (1 + 3 x /100) the ceil(getLOG) of
 * Spelunk[2] summed; 7 = 15 + 45 x v / (250 + v); 19 = max(10, 50 - v); 25 = 1 + v; 38 = 20 + v; 44..46 x the grand discoveries; 54..56 x
 * (1 + 5 x /100) Spelunk[47] summed over Spelunk[1]'s length; 59..61 x Spelunk[4][8]. The sums round at each step, as the game's.
 */
function shopUpgBonus(ctx: Ctx, b: number, e: number): number {
  const upg = SpelunkUpg as unknown as readonly (readonly unknown[])[];
  if (1 == e) {
    const row = upg[b | 0];
    // the game indexes SpelunkUpg[b][4] and Spelunk[5][b] directly
    if (!row) throw new RangeError(`Spelunk ShopUpgBonus: no upgrade ${b} in SpelunkUpg`);
    listAt(ctx, "Spelunk", 5);
    return asNumber(row[4]) * Math.max(0, asNum(ctx, "Spelunk", 5, b | 0));
  }
  const tot: number[] = []; // DNSM.SpelunkyUpgTOT
  for (let g = 0; g < upg.length; g++) tot.push(Spelunk(ctx, "ShopUpgBonus", g, 1));
  let dn = 0; // DNSM.SpelunkyUpgDN
  for (let g = 0, n = ctx.state.charNames.length; g < n; g++) dn = Math.round(dn + Math.max(0, asNum(withPlayer(ctx, g), "Lv0", 19)));
  tot[0] = asNumber(tot[0]) * dn;
  tot[8] = asNumber(tot[8]) * (1 + dn / 100);
  const caves = listAt(ctx, "Spelunk", 6).length;
  tot[1] = asNumber(tot[1]) * (1 + (5 * caves) / 100);
  tot[10] = asNumber(tot[10]) * (1 + (5 * caves) / 100);
  const s1 = listAt(ctx, "Spelunk", 1);
  dn = 0;
  for (let g = 0; g < s1.length; g++) dn = Math.round(dn + asNum(ctx, "Spelunk", 1, g));
  tot[2] = asNumber(tot[2]) * (2 + dn / 100);
  tot[9] = asNumber(tot[9]) * (1 + dn / 100);
  const s2 = listAt(ctx, "Spelunk", 2);
  dn = 0;
  for (let g = 0; g < s2.length; g++) dn = Math.round(dn + Math.ceil(getLOG(ctx, asNum(ctx, "Spelunk", 2, g))));
  tot[3] = asNumber(tot[3]) * (1 + (3 * dn) / 100);
  tot[7] = 15 + 45 * (asNumber(tot[7]) / (250 + asNumber(tot[7])));
  tot[19] = Math.max(10, 50 - asNumber(tot[19]));
  tot[25] = 1 + asNumber(tot[25]);
  tot[38] = 20 + asNumber(tot[38]);
  for (const g of [44, 45, 46]) tot[g] = asNumber(tot[g]) * Spelunk(ctx, "GrandDiscoveries_Total", 0, 0);
  listAt(ctx, "Spelunk", 47); // the game indexes Spelunk[47][g] directly
  dn = 0;
  for (let g = 0; g < s1.length; g++) dn = Math.round(dn + asNum(ctx, "Spelunk", 47, g));
  for (const g of [54, 55, 56]) tot[g] = asNumber(tot[g]) * (1 + (5 * dn) / 100);
  listAt(ctx, "Spelunk", 4); // the game indexes Spelunk[4][8] directly
  for (const g of [59, 60, 61]) tot[g] = asNumber(tot[g]) * asNum(ctx, "Spelunk", 4, 8);
  const i = Math.max(0, b) | 0; // b == -1 (the rebuild) answers entry 0
  // the game answers undefined past the table, which the caller would turn into NaN
  if (!(i < tot.length)) throw new RangeError(`Spelunk ShopUpgBonus: no upgrade ${b} in SpelunkUpg`);
  return asNumber(tot[i]);
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { DoWeHaveLoreN1: true, "6starCards": true, ShopUpgBonus: true, GrandDiscoveries_Total: true, BigFishBonuses: true };
