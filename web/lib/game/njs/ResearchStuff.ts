import { asNum, asNumber, attr } from "../attr";
import { assumed, block, type Ctx } from "../ctx";
import { Research as CustomResearch, ResGridSquares } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { Companions } from "./Companions";
import { Dreamstuff } from "./Dreamstuff";
import { Minehead } from "./Minehead";
import { SushiStuff } from "./SushiStuff";
import type { Ported } from "../ported";

/** N.js `_customBlock_ResearchStuff(d, b, e)` @11163957: the sub-cases in PORTED below (Grid_Bonus for every square and e, Ruling NN); any other throws NotPorted. */
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
    // @11184522: the sticker damage of grid square 47 is unlocked once the square has a level
    case "FarmingStickerDMG_unlocked":
      return 1 <= ResearchStuff(ctx, "Grid_Bonus", 47, 0) ? 1 : 0;
    // @11164079: the occurrences the current character can find, from its Research level L = Lv0[20]: 0 below 1, 1 while Research[2][0]
    // is 0 (the raw element, loosely), else min(43, 5 floor((L + 10) / 10) - floor(L / 20) - floor(L / 30) - floor(L / 50))
    case "OccurrencesToBeFound": {
      if (1 > asNum(ctx, "Lv0", 20)) return 0;
      listAt(ctx, "Research", 2); // the game indexes Research[2][0] directly
      if (0 == attr(ctx, "Research", 2, 0)) return 1;
      const lv = asNum(ctx, "Lv0", 20);
      return Math.min(43, 5 * Math.floor((lv + 10) / 10) - Math.floor(lv / 20) - Math.floor(lv / 30) - Math.floor(lv / 50));
    }
    // @11164493: the occurrences found, the first OccurrencesToBeFound entries of Research[2] that are at least 1
    case "TotalOccurrencesFound":
      return occurrences(ctx, 2, () => 1, "DNSM.TotOccFnd", "occurrences found");
    // @11164996: the observations' levels, the first OccurrencesToBeFound entries of Research[4] that are at least 1, summed
    case "TotalObsLVs":
      return occurrences(ctx, 4, (lv) => lv, "DNSM.TotOccLVz", "observation levels");
    default:
      throw new NotPorted("ResearchStuff", d);
  }
});

/**
 * The session counters TotalOccurrencesFound (DNSM.TotOccFnd) and TotalObsLVs (DNSM.TotOccLVz): over the first OccurrencesToBeFound
 * (truncated) entries g of Research[row], each one at least 1 adds `add(entry)`. The game fills each once per session (and again from the
 * Research UI, `b == -1` @13177121, @13177190, @13199612), and OccurrencesToBeFound reads the Research level of the character that asks
 * first: here it is built for the current character each time, so the game shows this value only if that first read was on this character
 * (stated as an assumption under `name`, the session counter).
 */
function occurrences(ctx: Ctx, row: number, add: (entry: number) => number, name: string, what: string): number {
  let total = 0;
  const n = ResearchStuff(ctx, "OccurrencesToBeFound", 0, 0) | 0;
  if (n > 0) listAt(ctx, "Research", row); // the game indexes Research[row][g] directly
  for (let g = 0; g < n; g++) if (1 <= asNum(ctx, "Research", row, g)) total = total + add(asNum(ctx, "Research", row, g));
  return assumed(ctx, name, `${what} counted for this character (the game counts them once a session, for the first character that asks)`, total, `${name} is filled once per session (and from the Research UI, @13177121, @13177190, @13199612) with OccurrencesToBeFound of the character that reads it first; built here for the current character`);
}

/**
 * `Grid_Bonus` @11177849, grid square `b`. `1 == e` is the square's level itself (Research[0][b]); `2 == e` has a branch per
 * square: 31 = 25 x its level; 67, 68 and 107 = the value x the number of Research[11] entries; 94 = the value x TotalObsLVs; 112 = the
 * value x TotalOccurrencesFound; 151 = OptionsListAccount[500] (the raw element, as a number here); 168 = the value x floor(Minehead
 * GlimboTotalTrades / 100); any other square its value. Every other `e` (the calls pass 0) is the square's own value: ResGridSquares[b][2]
 * x level, times 1 + CustomLists.Research[5][selector] / 100 when the square has a selector (Research[1][b], -1 for none), times
 * max(1, Grid_Bonus_Allmulti).
 */
function gridBonus(ctx: Ctx, b: number, e: number): number {
  if (1 == e) return Math.round(asNum(ctx, "Research", 0, b | 0));
  if (2 == e) {
    if (31 == b) return 25 * asNum(ctx, "Research", 0, b | 0);
    if (67 == b || 68 == b || 107 == b) return ResearchStuff(ctx, "Grid_Bonus", b, 0) * listAt(ctx, "Research", 11).length;
    if (94 == b) return ResearchStuff(ctx, "Grid_Bonus", b, 0) * ResearchStuff(ctx, "TotalObsLVs", 0, 0);
    if (112 == b) return ResearchStuff(ctx, "Grid_Bonus", b, 0) * ResearchStuff(ctx, "TotalOccurrencesFound", 0, 0);
    if (151 == b) return asNum(ctx, "OptionsListAccount", 500);
    if (168 == b) return ResearchStuff(ctx, "Grid_Bonus", b, 0) * Math.floor(Minehead(ctx, "GlimboTotalTrades", 0, 0) / 100);
    return ResearchStuff(ctx, "Grid_Bonus", b, 0);
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

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  Grid_Bonus: true, Grid_Bonus_Allmulti: true, FarmingStickerDMG_unlocked: true, OccurrencesToBeFound: true, TotalOccurrencesFound: true, TotalObsLVs: true,
};
