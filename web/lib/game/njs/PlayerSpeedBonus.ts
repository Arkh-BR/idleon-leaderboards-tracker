import { asNum, asNumber, attr } from "../attr";
import { block, runtime } from "../ctx";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { Windwalker } from "./Windwalker";
import { ArbitraryCode } from "./ArbitraryCode";
import { CardBonusREAL } from "./CardBonusREAL";
import { chipBonuses } from "./chipBonuses";
import { DNSM_StarSigns } from "./DNSM";
import { Dungon } from "./Dungon";
import { EtcBonuses } from "./EtcBonuses";
import { FoodBonuses } from "./FoodBonuses";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { GetTalentNumber } from "./GetTalentNumber";
import { Labb } from "./Labb";
import { SaltLick } from "./SaltLick";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { itemDef, TotalStats } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_PlayerSpeedBonus()` @4139326: the character's move speed, a multiplier to two decimals (1.75 = 175%, what Player Info
 * shows as round(100 x it) % @6716046): floor(100 x DN.PlayerSpeedBonusDN) / 100. DN is
 * 1 + (the move-speed foods (FoodSlotsOwned of EquipmentOrder[2], each Amount x its food multiplier), talent 266, the PctMoveSpd stamp,
 * buff 273, OptionsListAccount[438], statue 1, the MoveSpd star signs, unique stat 1, card 6, talent 77) / 100 + the AGI term / 2.2, the
 * AGI term being (AGI + 1)^.4 - 1) / 40 below 1000 AGI, else .5 (AGI - 1000) / (AGI + 2500) + .371. At 2 or less it is capped: past 1.75
 * at 2 with talent 641 added, else at 1.75 with the Salt Lick 7, the move chips, talent 641 and sigil 13 added (two decimals each time).
 * Map 266 sets it to 1.75. A dungeon (DungeonStat("SPEED")) is not ported; the Tutorial scene's 1.55 is not modelled (a tracked account
 * is in the world); the Compass Tempest form is not counted, a runtime leaf.
 */
export const PlayerSpeedBonus = block("PlayerSpeedBonus", (ctx) => {
  let dn = 0; // DN.PlayerSpeedBonusDN
  for (let e = 0, f = (attr(ctx, "FoodSlotsOwned") as number) | 0; e < f; e++) {
    const name = attr(ctx, "EquipmentOrder", 2, e);
    if (!("Blank" != name && 0 != (attr(ctx, "EquipmentQuantity", 2, e) as number))) continue; // both loose, as the game has them
    const food = itemDef(hString(name)); // DN.PlayerSpeedBonusMAP
    if ("MoveSpdBoosts" == food.Effect) dn = dn + asNumber(food.Amount) * FoodBonuses(ctx, `${hString(food.Effect)}EffectBonus`);
  }
  dn = dn + (GetTalentNumber(ctx, 1, 266) + StampBonusOfTypeX(ctx, "PctMoveSpd") + (GetBuffBonuses(ctx, 273, 1) + asNum(ctx, "OptionsListAccount", 438)));
  const agi = TotalStats(ctx, "AGI"); // DNSM.PlayerSpeedAGI
  const agiTerm = 1e3 > agi ? (Math.pow(agi + 1, 0.4) - 1) / 40 : 0.5 * ((agi - 1e3) / (agi + 2500)) + 0.371;
  dn =
    1 +
    ((dn + (ArbitraryCode(ctx, "StatueBonusGiven1") + (DNSM_StarSigns(ctx, "MoveSpd") + (EtcBonuses(ctx, "1") + (CardBonusREAL(ctx, 6) + GetTalentNumber(ctx, 1, 77)))))) / 100 +
      agiTerm / 2.2);
  if (-1 != Dungon(ctx)) throw new NotPorted("PlayerSpeedBonus", `CurrentMap=${ctx.map}`);
  if (!(2 < dn)) {
    if (1.75 < dn || -1 != Dungon(ctx)) dn = Math.min(2, Math.floor(100 * (dn + GetTalentNumber(ctx, 1, 641) / 100)) / 100);
    else dn = Math.min(1.75, Math.floor(100 * (dn + (SaltLick(ctx, 7) + chipBonuses(ctx, "move") + (GetTalentNumber(ctx, 1, 641) + Labb(ctx, "SigilBonus", "Blank", 13, 0))) / 100)) / 100);
  }
  if (1 == Windwalker(ctx, "CompassTempest", 0, 0)) throw new Error("unreachable");
  if (266 == ctx.map) dn = 1.75;
  return Math.floor(100 * dn) / 100;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
