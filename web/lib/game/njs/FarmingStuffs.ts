import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { MarketExoticInfo, NinjaInfo, Research as CustomResearch } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { contains, listAt } from "../lists";
import { GamingStatType } from "./GamingStatType";
import { getbonus2 } from "./getbonus2";
import { MainframeBonus } from "./MainframeBonus";
import { MenagerieStuff } from "./MenagerieStuff";
import { Ninja } from "./Ninja";
import { ResearchStuff } from "./ResearchStuff";
import { Summoning } from "./Summoning";
import { range, type Ported } from "../ported";

/** N.js `_customBlock_FarmingStuffs(d, b, e)` @10817671. Only the sub-cases the Artifact Find port reaches. */
export const FarmingStuffs: (ctx: Ctx, d: string, b: number, e: number) => number = block("FarmingStuffs", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "StickerBonus":
      return stickerBonus(ctx, b, e);
    case "ExoticBonusQTY":
      return exoticBonusQTY(ctx, b);
    // @10823067: Land Rank upgrade b, its level FarmRank[2][b] times its value NinjaInfo[36][b] (the upgrades 4, 9, 14 and 19 as it is,
    // the others 1.7 x value x level / (level + 80)), times the best talent 207 (at least 1) and 1 + Exotic 14 / 100
    case "LankRankUpgBonus": {
      listAt(ctx, "FarmRank", 2); // the game indexes FarmRank[2][b] directly
      const lv = asNum(ctx, "FarmRank", 2, b | 0);
      const value = asNumber((NinjaInfo as unknown as readonly (readonly unknown[])[])[36][b | 0]);
      const boost = Math.max(1, getbonus2(ctx, 1, 207, -1)) * (1 + FarmingStuffs(ctx, "ExoticBonusQTY", 14, 0) / 100);
      return 4 == b || 9 == b || 14 == b || 19 == b ? boost * value * lv : boost * ((1.7 * value * lv) / (lv + 80));
    }
    // @10824612: the Crop Scientist's multi, (1 + lab bonus 17 / 100) x (1 + (Grimoire 22 + Exotic 40 + vault 79) / 100)
    case "CropSCbonMulti":
      return (1 + MainframeBonus(ctx, 17) / 100) * (1 + (Summoning(ctx, "GrimoireUpgBonus", 22, 0) + (FarmingStuffs(ctx, "ExoticBonusQTY", 40, 0) + Summoning(ctx, "VaultUpgBonus", 79, 0))) / 100);
    case "CropSCbonus":
      return cropSCbonus(ctx, b);
    // @10817923: the stickers found, Research[9] summed (rounded at each step). The game caches it for the session (DNSM.TotStickrz)
    case "TotalStickers": {
      const stickers = listAt(ctx, "Research", 9); // the game reads Research[9].length
      let total = 0; // DNSM.TotStickrz
      for (let e = 0; e < stickers.length; e++) total = Math.round(total + asNum(ctx, "Research", 9, e));
      return Math.round(total);
    }
    // @10818423: 1 + grid square 47 x the stickers found / 100 once square 47 has a level, else 1
    case "StickerDMGmulti":
      return 1 == ResearchStuff(ctx, "FarmingStickerDMG_unlocked", 0, 0) ? 1 + (ResearchStuff(ctx, "Grid_Bonus", 47, 0) * FarmingStuffs(ctx, "TotalStickers", 0, 0)) / 100 : 1;
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

/**
 * `CropSCbonus` @10824845, Crop Scientist bonus `b`, from the crops found (D.mapCount(FarmCrop), the keys of the map), times
 * CropSCbonMulti: 0 = 20 x crops once the Emporium item 27 is owned; 7 = round(max(0, crops - 100)) once the Emporium item 38 is; else 0
 * (the chain's other branches need another b, so only the item of b is read). Only b = 0 and 7 are ported.
 */
function cropSCbonus(ctx: Ctx, b: number): number {
  if (0 != b && 7 != b) throw new NotPorted("FarmingStuffs", `CropSCbonus:b=${b}`);
  if (0 == b) return 1 == Ninja(ctx, "EmporiumBonus", 27, 0) ? 20 * Math.round(cropCount(ctx)) * FarmingStuffs(ctx, "CropSCbonMulti", 0, 0) : 0;
  return 1 == Ninja(ctx, "EmporiumBonus", 38, 0) ? Math.round(Math.max(0, cropCount(ctx) - 100)) * FarmingStuffs(ctx, "CropSCbonMulti", 0, 0) : 0;
}

/** `D.mapCount(FarmCrop)`: the crops found, the keys of the FarmCrop map. */
export function cropCount(ctx: Ctx): number {
  const crops = attr(ctx, "FarmCrop");
  if (crops === undefined) throw new MissingSaveKey("FarmCrop");
  if (crops === null || typeof crops !== "object") throw new InvalidSaveValue("FarmCrop", "a map", crops);
  return Object.keys(crops).length;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { StickerBonus: true, ExoticBonusQTY: range(0, 80), LankRankUpgBonus: true, CropSCbonMulti: true, CropSCbonus: [0, 7], TotalStickers: true, StickerDMGmulti: true };
