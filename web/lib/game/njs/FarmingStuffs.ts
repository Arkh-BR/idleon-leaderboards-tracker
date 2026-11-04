import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { MarketExoticInfo, Research as CustomResearch } from "../data";
import { NotPorted } from "../errors";
import { contains, listAt } from "../lists";
import { GamingStatType } from "./GamingStatType";
import { MenagerieStuff } from "./MenagerieStuff";
import { ResearchStuff } from "./ResearchStuff";
import { Summoning } from "./Summoning";
import { range, type Ported } from "../ported";

/** N.js `_customBlock_FarmingStuffs(d, b, e)` @10817671. Only the sub-cases the Artifact Find port reaches. */
export const FarmingStuffs = block("FarmingStuffs", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "StickerBonus":
      return stickerBonus(ctx, b, e);
    case "ExoticBonusQTY":
      return exoticBonusQTY(ctx, b);
    default:
      throw new NotPorted("FarmingStuffs", d);
  }
});

/**
 * `StickerBonus` @10819923, sticker `b`: (1 + (research grid 68 (e = 2) + 30 per Event Shop 37) / 100) x (1 + 20 per Super Bit 62 / 100) x
 * Research[9][b] x CustomLists.Research[25][b]. Stickers 1 and 2 give 0 in the slot (`e`) the Menagerie unlock 22 does not
 * choose: with the unlock, slot 99 is 0 and slot 100 has the value; without it, the other way round.
 */
function stickerBonus(ctx: Ctx, b: number, e: number): number {
  const slotOff = !((1 != b && 2 != b) || !((99 == e && 1 == MenagerieStuff(ctx, "UnlockOwned", 22, 0)) || (100 == e && 0 == MenagerieStuff(ctx, "UnlockOwned", 22, 0))));
  if (slotOff) return 0;
  const lift = 1 + (ResearchStuff(ctx, "Grid_Bonus", 68, 2) + 30 * Summoning(ctx, "EventShopOwned", 37, 0)) / 100;
  const superBit = 1 + (20 * GamingStatType(ctx, "SuperBitType", 62, 0)) / 100;
  listAt(ctx, "Research", 9); // the game indexes Research[9][b] directly
  return lift * superBit * asNum(ctx, "Research", 9, b | 0) * asNumber((CustomResearch as unknown as readonly (readonly unknown[])[])[25][b | 0]);
}

/**
 * `ExoticBonusQTY` @10830602, market upgrade `b` (of 80): the game fills `DNSM.ExoticFarmBon` the first time it is asked (and when
 * b == -1), one entry per upgrade e, each independent of the others. With F = FarmUpg[20 + e] and MarketExoticInfo[e] = info:
 * info[3] x F / (1000 + F) when info[4] is 1, else info[3] x F; doubled when Spelunk[50] lists e; the upgrade 39 is capped at 50.
 * Here the one entry asked is computed from the save each time (the replay of that iteration). The total (b == 99), the rebuild
 * (b == -1) and anything past the 80 upgrades are not ported.
 */
function exoticBonusQTY(ctx: Ctx, b: number): number {
  if (!Number.isInteger(b) || b < 0 || b > 79) throw new NotPorted("FarmingStuffs", `ExoticBonusQTY:b=${b}`);
  const info = (MarketExoticInfo as unknown as readonly (readonly unknown[])[])[b];
  const farm = asNum(ctx, "FarmUpg", Math.round(20 + b));
  let v = 1 == asNumber(info[4]) ? asNumber(info[3]) * (farm / (1e3 + farm)) : asNumber(info[3]) * farm;
  if (contains(attr(ctx, "Spelunk", 50), b)) v = 2 * v;
  if (39 == b) v = Math.min(50, v);
  return v;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { StickerBonus: true, ExoticBonusQTY: range(0, 80) };
