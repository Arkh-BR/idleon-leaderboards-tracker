// ===== VOTING MULTI =====
// A leaf module, like flurbo.ts and roo.ts: the accuracy in derived-damage
// reads VotingBonusz(3) and must not go through coin.ts (coin → overkill →
// damage → derived-damage). coin.ts re-exports it for Coin, EXP, AFK, DR2 and
// Artifact Find.
import type { SystemCtx } from "../../registry";
import { dreamData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { legendPTSbonus, computePaletteBonus } from "../w7/spelunking";
import { computeMeritocBonusz } from "../w7/meritoc";
import { computeWinBonus } from "../w6/summoning";
import { cosmoBonus } from "../w5/hole";
import { companions } from "../common/companions";
import { sushiRoG } from "../w7/sushi";

/** N.js Summoning("VotingBonuszMulti") (@10954376): the multi of every
 *  VotingBonusz(b), which is 0 unless b is the account's active vote. */
export function votingMulti(ctx: SystemCtx): number {
  const s = ctx.saveData;
  const es = (n: number) => eventShopOwned(n, s.cachedEventShopStr || "");
  const inner =
    companions(41, s) + (Number((dreamData as any[])[13]) || 0) + cosmoBonus(s, 2, 3) +
    computeWinBonus(22, null, s) + 17 * es(7) + 13 * es(16) + companions(19, s) +
    computePaletteBonus(32, s) + legendPTSbonus(22, s) +
    (Number(sushiRoG.resolve(50, ctx as any).val) || 0);
  return (1 + companions(161, s) / 100) * (1 + computeMeritocBonusz(9, s) / 100) * (1 + inner / 100);
}
