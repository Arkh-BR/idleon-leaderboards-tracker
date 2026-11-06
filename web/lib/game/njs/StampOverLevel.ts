import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { listOrMapAt } from "../lists";
import { Ninja } from "./Ninja";
import { StampDetails } from "./StampDetails";
import type { Ported } from "../ported";

/** `StampLevel[floor(d / 1000)][d mod 1000]`, the stamp's level (the save keeps each tab as a list or a {"0": …} map). */
export function stampLevel(ctx: Ctx, d: number): number {
  const tab = Math.floor(d / 1e3);
  listOrMapAt(ctx, "StampLevel", tab); // the game indexes StampLevel[tab][i] directly
  return asNum(ctx, "StampLevel", tab, (d - 1e3 * tab) | 0);
}

/**
 * N.js `_customBlock_StampOverLevel(d)` @4427756: the level stamp `d` counts at. A stamp with a level cap by skill (details [10], the
 * Lv0 index of that skill) is held back while that skill is low, unless the Emporium item 5 is owned: past a deficit of 3 levels, its level
 * x 10 / details[4] counts only as 3 + (that - 3) x (skill level / (that - 3))^.75, back in levels, and never above the stamp's level.
 */
export const StampOverLevel = block("StampOverLevel", (ctx, d: number) => {
  const det = StampDetails(d);
  if (!(0 < asNumber(det[10]) && 0 == Ninja(ctx, "EmporiumBonus", 5, 0))) return stampLevel(ctx, d);
  let over: number; // DN.StampOverlevelNumberDUM
  if (1 < asNumber(det[4])) {
    const yourLv = asNum(ctx, "Lv0", asNumber(det[10]) | 0); // DN.StampOL_yourLv
    const stampLv = stampLevel(ctx, d) * (200 / (20 * asNumber(det[4]))); // DN.StampOL_stampLv
    const deficit = 3; // DN.StampOL_deficitcoeff
    over = stampLv > deficit ? (deficit + (stampLv - deficit) * Math.pow(yourLv / (stampLv - deficit), 0.75)) * ((20 * asNumber(det[4])) / 200) : stampLv;
  } else over = stampLevel(ctx, d);
  return Math.min(over, stampLevel(ctx, d));
});

/** What this module covers (lib/game/ported.ts): the whole function, for any stamp. */
export const PORTED: Ported = "generic";
