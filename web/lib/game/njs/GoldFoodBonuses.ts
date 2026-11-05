import { asNum, asNumber, attr } from "../attr";
import { block } from "../ctx";
import { NinjaInfo } from "../data";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { AchieveStatus } from "./AchieveStatus";
import { Companions } from "./Companions";
import { DNSM_AlchBubbles, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { EtcBonuses } from "./EtcBonuses";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetSetBonus } from "./GetSetBonus";
import { getbonus2 } from "./getbonus2";
import { getLOG } from "./getLOG";
import { GetTalentNumber } from "./GetTalentNumber";
import { JellyOperation } from "./JellyOperation";
import { Labb } from "./Labb";
import { MealBonus } from "./MealBonus";
import { Ninja } from "./Ninja";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import { DNSM_CalcTalentMAP } from "./TalentCalc";
import { Thingies } from "./Thingies";
import { itemDef } from "./TotalStats";
import type { Ported } from "../ported";

/** The effects whose answer is the bonus itself (the rest answer 1 + bonus / 100, "Filler" bonus / 100), @5059936. */
const AS_IS = new Set(["BaseDamage", "Defence", "SkillExp", "BaseAcc", "AllStatz", "SailAFKz", "GamerAFKz", "MonsterCash", "ClassEXPz", "AllAFK", "DropRatez", "SpelunkEXPz", "ShrineEffect"]);

/**
 * N.js `_customBlock_GoldFoodBonuses(d)` @5056708: the golden food bonus of effect `d`. The multiplier (DNSM.GfoodBonusMULTI) is
 * (1 + (the Secret set + 50 x Companion 174) / 100) x (max(family bonus 66, 1) + the golden food boosts / 100). Then each food slot
 * (FoodSlotsOwned of EquipmentOrder[2]) holding a GOLDEN_FOOD of effect `d` sets the bonus to its Amount x the multi x .05 x
 * getLOG(1 + its quantity) x (1 + that log / 2.14): the last such slot is the one that counts, not a sum, as the game has it. With the
 * Emporium item 1, the first golden food of the Emporium (NinjaInfo[29]) of effect `d` adds the same of 1000 x 10^Ninja[104][e] when
 * that level is above 0.
 */
export const GoldFoodBonuses = block("GoldFoodBonuses", (ctx, d: string) => {
  const multi = // DNSM.GfoodBonusMULTI
    (1 + (GetSetBonus(ctx, "SECRET_SET", "Bonus", 0, 0) + 50 * Companions(ctx, 174)) / 100) *
    (Math.max(DNSM_FamBonusQTYs(ctx, "66"), 1) +
      (EtcBonuses(ctx, "8") +
        (GetTalentNumber(ctx, 1, 99) +
          (StampBonusOfTypeX(ctx, "GFood") +
            (AchieveStatus(ctx, 37) +
              (DNSM_AlchBubbles(ctx, "GFoodz") +
                (Labb(ctx, "SigilBonus", "Blank", 14, 0) +
                  (MealBonus(ctx, "zGoldFood") +
                    (DNSM_StarSigns(ctx, "69") +
                      (GetBribeBonus(ctx, "36") +
                        (Ninja(ctx, "PristineBon", 14, 0) +
                          (2 * AchieveStatus(ctx, 380) +
                            3 * AchieveStatus(ctx, 383) +
                            (Summoning(ctx, "VotingBonusz", 26, 0) +
                              (getbonus2(ctx, 1, 209, -1) * DNSM_CalcTalentMAP(ctx, "209") +
                                (Companions(ctx, 48) +
                                  (Thingies(ctx, "LegendPTS_bonus", 25, 0) +
                                    (Math.min(4 * RunCodeOfTypeXforThingY(ctx, "CardLv", "cropfallEvent1"), 50) +
                                      Math.min(5 * RunCodeOfTypeXforThingY(ctx, "CardLv", "anni5Event1"), 50) +
                                      (Companions(ctx, 155) +
                                        1e4 * Companions(ctx, 174) +
                                        (Summoning(ctx, "VaultUpgBonus", 86, 0) + (JellyOperation(ctx, "RoG_BonusQTY", 10, 0) + JellyOperation(ctx, "RoG_BonusQTY", 51, 0)))))))))))))))))))) /
        100);
  let bonus = 0; // DNSM.GfoodBonus
  // FoodSlotsOwned is read raw (`|0`, no asNumber in N.js)
  for (let f = 0, g = (attr(ctx, "FoodSlotsOwned") as number) | 0; f < g; f++) {
    const name = attr(ctx, "EquipmentOrder", 2, f);
    if ("Blank" == name) continue;
    const food = itemDef(hString(name)); // DNSM.GfoodMap
    if ("GOLDEN_FOOD" == food.Type && d == food.Effect) {
      const qty = asNum(ctx, "EquipmentQuantity", 2, f);
      bonus = asNumber(food.Amount) * multi * 0.05 * getLOG(ctx, 1 + qty) * (1 + getLOG(ctx, 1 + qty) / 2.14);
    }
  }
  if (1 == Ninja(ctx, "EmporiumBonus", 1, 0)) {
    const list = (NinjaInfo as unknown as readonly (readonly unknown[])[])[29];
    for (let e = 0, n = Math.floor(list.length / 3); e < n; e++) {
      const food = itemDef(hString(list[2 + 3 * e]));
      if (d != food.Effect) continue;
      listAt(ctx, "Ninja", 104); // the game indexes Ninja[104][e] directly
      if (0 < asNum(ctx, "Ninja", 104, e)) {
        const qty = 1e3 * Math.pow(10, asNum(ctx, "Ninja", 104, e));
        bonus = bonus + asNumber(food.Amount) * multi * 0.05 * getLOG(ctx, 1 + qty) * (1 + getLOG(ctx, 1 + qty) / 2.14);
      }
      break;
    }
  }
  return AS_IS.has(d) ? bonus : "Filler" == d ? bonus / 100 : 1 + bonus / 100;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
