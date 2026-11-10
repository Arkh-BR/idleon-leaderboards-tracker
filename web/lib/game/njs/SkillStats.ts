import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { ArbitraryCode } from "./ArbitraryCode";
import { Breeding } from "./Breeding";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { chipBonuses } from "./chipBonuses";
import { Companions } from "./Companions";
import { minigameHiscore } from "./DamageDealed";
import { Divinity } from "./Divinity";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { Dreamstuff } from "./Dreamstuff";
import { EtcBonuses } from "./EtcBonuses";
import { FishingToolkit } from "./FishingToolkit";
import { GamingStatType } from "./GamingStatType";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { GetSetBonus } from "./GetSetBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { GuildBonuses } from "./GuildBonuses";
import { Holes } from "./Holes";
import { MainframeBonus } from "./MainframeBonus";
import { MealBonus } from "./MealBonus";
import { prayersReal } from "./prayersReal";
import { RiftStuff } from "./RiftStuff";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Sailing } from "./Sailing";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import { DNSM_CalcTalentMAP43 } from "./TalentCalc";
import { Thingies } from "./Thingies";
import { equipMap, itemDef, TotalStats } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_SkillStats(d)` @4197008, the skills' stats. Ported: "AllEfficiencies" and "AllBaseSkillEff" (the factor and the base every
 * efficiency shares, which return before the function's cache and its DN reset) and "FishingEfficiency" (talent 202's counter, Grimoire_CRITPCT
 * @10888848). The game keeps a skill stat in DNSM.TotStatSkMAP (@4201005) for the session; the `block` cache stands for it.
 */
export const SkillStats: (ctx: Ctx, d: string) => number = block("SkillStats", (ctx, d: string) => {
  switch (d) {
    // @4197048
    case "AllEfficiencies": {
      // min(quests / 10, talent 617): with the talent at 0 it is 0 whatever the count (never below 0), so the count (the Tome's) is read only when it has a level
      const t617 = GetTalentNumber(ctx, 1, 617);
      const quests = 0 >= t617 ? t617 : Math.min(0.1 * ArbitraryCode(ctx, "TotalQuestsComplete"), t617);
      return (
        (1 + (DNSM_FamBonusQTYs(ctx, "42") + (EtcBonuses(ctx, "48") + DNSM_AlchVials(ctx, "6SkillEff") + (Sailing(ctx, "ArtifactBonus", 15, 0) + quests))) / 100) *
        (1 +
          (MealBonus(ctx, "Seff") +
            GetTalentNumber(ctx, 1, 646) +
            (Summoning(ctx, "TomeBonus", 1, 0) + GamingStatType(ctx, "PaletteBonus", 10, 0)) +
            (chipBonuses(ctx, "toteff") + (3 * RunCodeOfTypeXforThingY(ctx, "CardLv", "Crystal4") + Thingies(ctx, "FriendBonusStatz", 2, 0))) +
            (RiftStuff(ctx, "RiftSkillETC", 2) + (Holes(ctx, "B_UPG", 49, 15) + asNum(ctx, "OptionsListAccount", 422)) + asNum(ctx, "OptionsListAccount", 180) * Dreamstuff(ctx, "AllShimmerBonuses", 0))) /
            100) *
        (1 + (CardBonusREAL(ctx, 84) + Companions(ctx, 5)) / 100) *
        (1 + Summoning(ctx, "WinBonus", 14, 0) / 100) *
        (1 + (GuildBonuses(ctx, 6) + (CardSetBonuses(ctx, 0, "2") + prayersReal(ctx, 1, 0))) / 100) *
        Math.max(1 - (GetBuffBonuses(ctx, 40, 2) + prayersReal(ctx, 17, 1)) / 100, 0.01)
      );
    }
    // @4198330
    case "AllBaseSkillEff":
      return (
        Breeding(ctx, "ShinyBonusS", "Nah", 22, -1) +
        StampBonusOfTypeX(ctx, "BaseAllEff") +
        Divinity(ctx, "BlesssBonus", 2, 0) +
        DNSM_BoxRewards(ctx, "20b") +
        chipBonuses(ctx, "eff") +
        (GetTalentNumber(ctx, 1, 636) + MainframeBonus(ctx, 112))
      );
    // @4219909
    case "FishingEfficiency": {
      const dn = fishingPower(ctx);
      const str = TotalStats(ctx, "STR");
      return (
        (Math.pow(dn, 1.3) + (Math.pow(str, 0.6) * (1 + GetTalentNumber(ctx, 1, 142) / 100) + (StampBonusOfTypeX(ctx, "BaseFishEff") + SkillStats(ctx, "AllBaseSkillEff")))) *
        (1 + asNum(ctx, "Lv0", 4) / 200) *
        (1 +
          Math.pow(str / 100, 0.35) *
            (1 +
              (GetTalentNumber(ctx, 1, 142) +
                (10 * RiftStuff(ctx, "RiftSkillBonus,3", 1) + (Summoning(ctx, "VotingBonusz", 8, 0) + GetSetBonus(ctx, "PLATINUM_SET", "Bonus", 0, 0))) +
                15 * GetBribeBonus(ctx, "29") +
                StampBonusOfTypeX(ctx, "FishEffPerLv") * asNum(ctx, "Lv0", 4)) /
                100)) *
        (1 + (DNSM_BoxRewards(ctx, "FishEffPct") + DNSM_CalcTalentMAP43(ctx, 3)) / 100) *
        (1 + dn / 100) *
        SkillStats(ctx, "AllEfficiencies") *
        GoldFoodBonuses(ctx, "FishingEff") *
        (1 + (CardBonusREAL(ctx, 30) + DNSM_AlchVials(ctx, "FishEff") + (EtcBonuses(ctx, "19") + Summoning(ctx, "RooBonuses", 0, 0))) / 100) *
        (1 + GetTalentNumber(ctx, 1, 85) / 100) *
        (1 + DNSM_StarSigns(ctx, "FishEff") / 100)
      );
    }
    default:
      throw new NotPorted("SkillStats", d);
  }
});

/**
 * DN.SkillStatsDN of a "Fishing…" stat, @4218273 (reset to 0 @4201005): the fishing rod's power (EquipmentOrder[1][2], its definition's Weapon_Power
 * plus its own one when it has it; nothing for "Blank"), times 1 + the ToolW bubble / 100, plus 3 + the toolkit's power, then plus the Fishing_Power
 * total and min(the fishing minigame's best, talent 116's second curve). Nothing the FishingEfficiency expression calls writes it back.
 */
function fishingPower(ctx: Ctx): number {
  let dn = 0;
  const rod = attr(ctx, "EquipmentOrder", 1, 2);
  if ("Blank" != rod) {
    const def = itemDef(hString(rod));
    const own = equipMap(ctx, 1, 2);
    dn = Object.hasOwn(own, "Weapon_Power") ? dn + (asNumber(def.Weapon_Power) + asNumber(own.Weapon_Power)) : dn + asNumber(def.Weapon_Power);
  }
  dn = dn * (1 + DNSM_AlchBubbles(ctx, "ToolW") / 100) + (3 + FishingToolkit(ctx, "POW"));
  return dn + (TotalStats(ctx, "Fishing_Power") + Math.min(minigameHiscore(ctx, 1), GetTalentNumber(ctx, 2, 116)));
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { AllEfficiencies: true, AllBaseSkillEff: true, FishingEfficiency: true };
