import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
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
  const bonus = goldFoodParts(ctx, d).bonus;
  return AS_IS.has(d) ? bonus : "Filler" == d ? bonus / 100 : 1 + bonus / 100;
});

/** The terms the golden food boosts are made of (DNSM.GfoodBonusMULTI, in the game's order), the sum of them, the family bonus and the multiplier. */
export type GoldFoodMulti = {
  set: number; // GetSetBonus("SECRET_SET")
  comp174: number;
  fam: number; // max(FamBonusQTYs["66"], 1)
  etc8: number;
  talent99: number;
  stamp: number;
  ach37: number;
  bubble: number;
  sigil14: number;
  meal: number;
  starSign69: number;
  bribe36: number;
  pristine14: number;
  ach380: number; // 2 x
  ach383: number; // 3 x
  voting26: number;
  talent209: number; // getbonus2(1, 209, -1) x DNSM.CalcTalentMAP("209")
  comp48: number;
  legend25: number;
  cropfall: number; // min(4 x CardLv, 50)
  anni5: number; // min(5 x CardLv, 50)
  comp155: number;
  comp174x: number; // 1e4 x Companion 174
  vault86: number;
  jelly10: number;
  jelly51: number;
  rest: number; // the sum of the terms from etc8 on, before / 100
  multi: number;
};

export function goldFoodMulti(ctx: Ctx): GoldFoodMulti {
  const set = GetSetBonus(ctx, "SECRET_SET", "Bonus", 0, 0);
  const comp174 = Companions(ctx, 174);
  const fam = Math.max(DNSM_FamBonusQTYs(ctx, "66"), 1);
  const etc8 = EtcBonuses(ctx, "8");
  const talent99 = GetTalentNumber(ctx, 1, 99);
  const stamp = StampBonusOfTypeX(ctx, "GFood");
  const ach37 = AchieveStatus(ctx, 37);
  const bubble = DNSM_AlchBubbles(ctx, "GFoodz");
  const sigil14 = Labb(ctx, "SigilBonus", "Blank", 14, 0);
  const meal = MealBonus(ctx, "zGoldFood");
  const starSign69 = DNSM_StarSigns(ctx, "69");
  const bribe36 = GetBribeBonus(ctx, "36");
  const pristine14 = Ninja(ctx, "PristineBon", 14, 0);
  const ach380 = 2 * AchieveStatus(ctx, 380);
  const ach383 = 3 * AchieveStatus(ctx, 383);
  const voting26 = Summoning(ctx, "VotingBonusz", 26, 0);
  const talent209 = getbonus2(ctx, 1, 209, -1) * DNSM_CalcTalentMAP(ctx, "209");
  const comp48 = Companions(ctx, 48);
  const legend25 = Thingies(ctx, "LegendPTS_bonus", 25, 0);
  const cropfall = Math.min(4 * RunCodeOfTypeXforThingY(ctx, "CardLv", "cropfallEvent1"), 50);
  const anni5 = Math.min(5 * RunCodeOfTypeXforThingY(ctx, "CardLv", "anni5Event1"), 50);
  const comp155 = Companions(ctx, 155);
  const comp174x = 1e4 * comp174;
  const vault86 = Summoning(ctx, "VaultUpgBonus", 86, 0);
  const jelly10 = JellyOperation(ctx, "RoG_BonusQTY", 10, 0);
  const jelly51 = JellyOperation(ctx, "RoG_BonusQTY", 51, 0);
  // the game nests the sum to the right: a + (b + (c + ...)), and the cards and the last companions are joined on the left
  const tail = comp155 + comp174x + (vault86 + (jelly10 + jelly51));
  const boosts = ach380 + ach383 + (voting26 + (talent209 + (comp48 + (legend25 + (cropfall + anni5 + tail)))));
  const rest = etc8 + (talent99 + (stamp + (ach37 + (bubble + (sigil14 + (meal + (starSign69 + (bribe36 + (pristine14 + boosts)))))))));
  return {
    set, comp174, fam, etc8, talent99, stamp, ach37, bubble, sigil14, meal, starSign69, bribe36, pristine14, ach380, ach383, voting26, talent209, comp48, legend25, cropfall, anni5, comp155, comp174x, vault86, jelly10, jelly51, rest,
    multi: (1 + (set + 50 * comp174) / 100) * (fam + rest / 100),
  };
}

/** A golden food that counts: its name, Amount, quantity and getLOG(1 + quantity), and what it gives (Amount x the multiplier x .05 x the log x (1 + log / 2.14)). */
export type GoldFoodUse = { item: string; amount: number; level?: number; qty: number; log: number; val: number };

/** The golden foods of effect `d`: the worn one (the last slot with that effect counts), the Emporium's (the first of its effect, when its level is above 0), and the bonus they add up to. */
export function goldFoodParts(ctx: Ctx, d: string): { multi: number; equipped: GoldFoodUse | undefined; emporium: GoldFoodUse | undefined; bonus: number } {
  const multi = goldFoodMulti(ctx).multi; // DNSM.GfoodBonusMULTI
  let bonus = 0; // DNSM.GfoodBonus
  let equipped: GoldFoodUse | undefined;
  let emporium: GoldFoodUse | undefined;
  // FoodSlotsOwned is read raw (`|0`, no asNumber in N.js)
  for (let f = 0, g = (attr(ctx, "FoodSlotsOwned") as number) | 0; f < g; f++) {
    const name = attr(ctx, "EquipmentOrder", 2, f);
    if ("Blank" == name) continue;
    const food = itemDef(hString(name)); // DNSM.GfoodMap
    if ("GOLDEN_FOOD" == food.Type && d == food.Effect) {
      const qty = asNum(ctx, "EquipmentQuantity", 2, f);
      const log = getLOG(ctx, 1 + qty);
      bonus = asNumber(food.Amount) * multi * 0.05 * getLOG(ctx, 1 + qty) * (1 + getLOG(ctx, 1 + qty) / 2.14);
      equipped = { item: hString(name), amount: asNumber(food.Amount), qty, log, val: bonus };
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
        const log = getLOG(ctx, 1 + qty);
        const val = asNumber(food.Amount) * multi * 0.05 * getLOG(ctx, 1 + qty) * (1 + getLOG(ctx, 1 + qty) / 2.14);
        bonus = bonus + val;
        emporium = { item: hString(list[2 + 3 * e]), amount: asNumber(food.Amount), level: asNum(ctx, "Ninja", 104, e), qty, log, val };
      }
      break;
    }
  }
  return { multi, equipped, emporium, bonus };
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
