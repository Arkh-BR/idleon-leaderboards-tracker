import { block, type Ctx } from "../ctx";
import { playerCount, skillLevel } from "../player";
import { talentCurveAt } from "./GetTalentNumber";
import { allTalentLV, RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_getbonus2(d, b, e)` @7987852: talent `b`'s curve `d` for character `e`, at that character's level of it. With
 * `e == -1`, the highest over every character (DNSM.GurtBonuzzDN); there, a talent from 100 on that the character has learned also gets
 * the "all talent levels" bonus for that character (`AllTalentLVz`, "b|g"). The ids below 100 never do.
 */
export const getbonus2 = block("getbonus2", (ctx, d: number, b: number, e: number) => {
  if (-1 == e) {
    let best = 0; // DNSM.GurtBonuzzDN
    for (let g = 0, n = playerCount(ctx); g < n; g++) {
      const level = skillLevel(ctx, b | 0, g);
      const value = // DNSM.GurtBonuzzDN2
        100 <= b && 0 < level ? talentCurveAt(ctx, d, b, level + RunCodeOfTypeXforThingY(ctx, "AllTalentLVz", `${b}|${g}`)) : talentCurveAt(ctx, d, b, level);
      if (value > best) best = value;
    }
    return best;
  }
  return talentCurveAt(ctx, d, b, skillLevel(ctx, b | 0, e | 0));
});

/**
 * `getbonus2(d, b, -1)` as the game computes it while `TalentCalc(-3)` rebuilds DNSM.FamBonusQTYs: the same, but the "all talent levels"
 * of each character read the half-built map's key 68 (`fam68`). Not a `block`, for the reason talentNumberDuringFamRebuild gives.
 */
export function bestTalentDuringFamRebuild(ctx: Ctx, d: number, b: number, fam68: () => number): number {
  let best = 0;
  for (let g = 0, n = playerCount(ctx); g < n; g++) {
    const level = skillLevel(ctx, b | 0, g);
    const value = 100 <= b && 0 < level ? talentCurveAt(ctx, d, b, level + allTalentLV(ctx, "AllTalentLVz", `${b}|${g}`, fam68)) : talentCurveAt(ctx, d, b, level);
    if (value > best) best = value;
  }
  return best;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
