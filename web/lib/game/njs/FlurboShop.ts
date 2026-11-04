import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { DungPassiveStats2 } from "../data";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_FlurboShop(d)` @7882638: `DNSM.FlurboStats[d]`, the map the game fills on the first call (and keeps for the session):
 * for each of the 8 Flurbo shop upgrades g, the curve DungPassiveStats2[g][3] of its constants [1] and [2] at its level DungUpg[5][g]
 * (ArbitraryCode5Inputs). Only the entry asked is computed here; a `d` outside the 8 is absent from the map (undefined in the game).
 */
export const FlurboShop = block("FlurboShop", (ctx, d: number) => {
  listAt(ctx, "DungUpg", 5); // the game indexes DungUpg[5][g] directly
  const row = (DungPassiveStats2 as unknown as readonly (readonly unknown[])[])[d];
  if (!(0 <= d && d < 8) || !row) throw new RangeError(`FlurboShop: no upgrade ${d} in DNSM.FlurboStats`);
  return ArbitraryCode5Inputs(ctx, hString(row[3]), asNumber(row[1]), asNumber(row[2]), asNum(ctx, "DungUpg", 5, d), 0, 0);
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
