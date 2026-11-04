import { attr } from "../attr";
import { block, runtime } from "../ctx";
import { NotPorted } from "../errors";
import { ArbitraryCode } from "./ArbitraryCode";
import { CardBonusREAL } from "./CardBonusREAL";
import { DNSM_AlchBubbles, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { Dungon } from "./Dungon";
import { EtcBonuses } from "./EtcBonuses";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { Shrine } from "./Shrine";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { TotalFoodBonuses } from "./TotalFoodBonuses";
import { TotalStats } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_PlayerHPmax()` @4147120: the character's Max HP, the product of three entries (DN.PlayerHPmaxLIST):
 *  - the base: 15, card 1, the BaseHP bubble and stamp, the HP boost foods and statue 4, the post office's baseHP, talents 0 and 642, and
 *    (total STR x (1 + talent 95 / 100))^1.05;
 *  - the %: talents 92 and 272 with the unique stat 15, shrine 1, the MaxHPpct golden food, the post office's pctHP, the active buff 108
 *    (a debuff), family bonus 18 with card 8, and the star signs' TotalHP;
 *  - 164 on the maps 20..23, else 1.
 * The masterclass forms (Grimoire Wraith, Compass Tempest) replace it with their own HP; they and buff 108 are not counted (the Damage
 * page's product decision), shown as runtime leaves. A dungeon (DungeonStat("HP")) and the beginner quest rule (class 2 without the
 * Cactolyte3 quest, which reads the inventory's Quest47 count) are not ported.
 */
export const PlayerHPmax = block("PlayerHPmax", (ctx) => {
  if (-1 != Dungon(ctx)) throw new NotPorted("PlayerHPmax", `CurrentMap=${ctx.map}`);
  if (1 == runtime(ctx, "Summoning(GrimoireWraith)", "masterclass form, not counted")) throw new Error("unreachable");
  if (1 == runtime(ctx, "Windwalker(CompassTempest)", "masterclass form, not counted")) throw new Error("unreachable");
  const boosts = TotalFoodBonuses(ctx, "HpBaseBoosts") + ArbitraryCode(ctx, "StatueBonusGiven4"); // DN.PlayerHPmaxDN
  const list = [
    15 +
      CardBonusREAL(ctx, 1) +
      DNSM_AlchBubbles(ctx, "BaseHP") +
      (StampBonusOfTypeX(ctx, "BaseHP") + boosts) +
      (DNSM_BoxRewards(ctx, "baseHP") + (GetTalentNumber(ctx, 1, 0) + GetTalentNumber(ctx, 1, 642)) + Math.pow(TotalStats(ctx, "STR") * (1 + GetTalentNumber(ctx, 1, 95) / 100), 1.05)),
    (1 + (GetTalentNumber(ctx, 1, 92) + (GetTalentNumber(ctx, 1, 272) + EtcBonuses(ctx, "15"))) / 100) *
      (1 + Shrine(ctx, 1) / 100) *
      GoldFoodBonuses(ctx, "MaxHPpct") *
      (1 + DNSM_BoxRewards(ctx, "pctHP") / 100) *
      (1 - GetBuffBonuses(ctx, 108, 1) / 100) *
      (1 + (DNSM_FamBonusQTYs(ctx, "18") + CardBonusREAL(ctx, 8)) / 100) *
      (1 + DNSM_StarSigns(ctx, "TotalHP") / 100),
    1,
  ];
  if (19 < ctx.map && 24 > ctx.map) list[2] = 164;
  if (0 == attr(ctx, "QuestComplete", "Cactolyte3") && 2 == attr(ctx, "CharacterClass")) throw new NotPorted("PlayerHPmax", "CharacterClass=2");
  return list[0] * list[1] * list[2];
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
