import { attr } from "../attr";
import { block, runtime } from "../ctx";
import { ClassStatTypes } from "../data";
import { ArbitraryCode } from "./ArbitraryCode";
import { ArcadeBonus } from "./ArcadeBonus";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { chipBonuses } from "./chipBonuses";
import { Companions } from "./Companions";
import { Divinity } from "./Divinity";
import { DNSM_AlchBubbles, DNSM_StarSigns } from "./DNSM";
import { Dungon } from "./Dungon";
import { FlurboShop } from "./FlurboShop";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { GetSetBonus } from "./GetSetBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { MealBonus } from "./MealBonus";
import { PlayerSpeedBonus } from "./PlayerSpeedBonus";
import { prayersReal } from "./prayersReal";
import { ReturnClasses } from "./ReturnClasses";
import { Summoning } from "./Summoning";
import { TotalStats } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_PlayerAccTot()` @4151358: the character's accuracy. DN.PlayerACCDN is the class's second stat (ClassStatTypes of its
 * first class: WIS for a warrior, STR for an archer, AGI for a mage, LUK for a beginner) x (1 + the AccPct bubble / 100) x (1 + (buff 288,
 * card 17, the AccPct star signs, buff 124, statue 14, arcade 2, Flurbo 5, bribe 21, companion 23) / 100), then x (1 + talent 641 / 100)
 * when the move speed is above 1.99 (PlayerSpeedBonus is a whole %, so that is any speed from 2%). The accuracy is
 * ((DN / 4)^1.4 + DN + TotalStats("Accuracy")) x (1 + (DN + 2 x card set 4) / 200) x max(.1, 1 + (prayer 6 - the curses of 15 and 16) / 100)
 * x (1 + (the acc chips, the TotAcc meals, Roo 3, vote 3, the Amarok set) / 100) x (1 + the kind-0 divinity minor bonus / 100).
 * A dungeon answers 999999. The masterclass forms (Grimoire Wraith, Compass Tempest, Tesseract Arcanist) replace it with their own and
 * buff 124 is not counted (the Damage page's product decision): runtime leaves.
 */
export const PlayerAccTot = block("PlayerAccTot", (ctx) => {
  if (-1 != Dungon(ctx)) return 999999;
  if (1 == runtime(ctx, "Summoning(GrimoireWraith)", "masterclass form, not counted")) throw new Error("unreachable");
  if (1 == runtime(ctx, "Windwalker(CompassTempest)", "masterclass form, not counted")) throw new Error("unreachable");
  if (1 == runtime(ctx, "ArcaneType(TesseractArcanist)", "masterclass form, not counted")) throw new Error("unreachable");
  const first = `${ReturnClasses(attr(ctx, "CharacterClass") as number)[0]}`;
  const types = ClassStatTypes[first];
  // the game indexes ClassStatTypes[class][1] directly and would throw on a class it does not have
  if (!types) throw new RangeError(`PlayerAccTot: no class ${first} in ClassStatTypes`);
  let dn = TotalStats(ctx, types[1]); // DN.PlayerACCDN
  dn =
    dn *
    (1 + DNSM_AlchBubbles(ctx, "AccPct") / 100) *
    (1 +
      (GetBuffBonuses(ctx, 288, 2) +
        (CardBonusREAL(ctx, 17) +
          (DNSM_StarSigns(ctx, "AccPct") +
            (GetBuffBonuses(ctx, 124, 1) +
              (ArbitraryCode(ctx, "StatueBonusGiven14") + (ArcadeBonus(ctx, 2) + (FlurboShop(ctx, 5) + (GetBribeBonus(ctx, "21") + Companions(ctx, 23))))))))) /
        100);
  if (1.99 < PlayerSpeedBonus(ctx)) dn = dn * (1 + GetTalentNumber(ctx, 2, 641) / 100);
  return (
    (Math.pow(dn / 4, 1.4) + (dn + TotalStats(ctx, "Accuracy"))) *
    (1 + (dn + 2 * CardSetBonuses(ctx, 0, "4")) / 200) *
    Math.max(0.1, 1 + (prayersReal(ctx, 6, 0) - prayersReal(ctx, 15, 1) - prayersReal(ctx, 16, 1)) / 100) *
    (1 + (chipBonuses(ctx, "acc") + (MealBonus(ctx, "TotAcc") + (Summoning(ctx, "RooBonuses", 3, 0) + (Summoning(ctx, "VotingBonusz", 3, 0) + GetSetBonus(ctx, "AMAROK_SET", "Bonus", 0, 0))))) / 100) *
    // GetPlayersUsernames.indexOf(UserInfo[0]): the current character
    (1 + Divinity(ctx, "Bonus_Minor", ctx.player, 0) / 100)
  );
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
