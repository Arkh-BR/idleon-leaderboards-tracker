import { asNumber, attr } from "../attr";
import { block } from "../ctx";
import { Number2Letter, StampBonusIndex, StampDescriptions } from "../data";
import { hString } from "../hstring";
import { contains } from "../lists";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { GetTalentNumber } from "./GetTalentNumber";
import { MainframeBonus } from "./MainframeBonus";
import { Ninja } from "./Ninja";
import { Summoning } from "./Summoning";
import { itemDef } from "./TotalStats";
import { StampDetails } from "./StampDetails";
import { StampOverLevel, stampLevel } from "./StampOverLevel";
import { Windwalker } from "./Windwalker";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_StampBonusOfTypeX(d)` @4430061: the total of every stamp whose bonus is of type `d` ("BaseSTR", "AllStatPct"...),
 * cached in `DNSM.StampBonuses_Map_Of_Val` (here the `block` cache). The type's tab is the StampBonusIndex list that names it; each stamp
 * of that tab whose description names it and has a level adds its curve (details [1..3]) at floor(StampOverLevel), doubled by the
 * Windwalker's StampDoubler for a stamp named in Compass[4]. Then: an "Eff" type times max(1, talent 625); the first two tabs doubled with
 * the lab bonus 7 at 2 and times 1 + Pristine Charm 17 / 100; the base damage, HP, accuracy and defence types times 1 + Vault 16 / 100.
 * A type no tab names is 0 (the game then reads the tab of the call before, but every factor multiplies that 0).
 */
export const StampBonusOfTypeX = block("StampBonusOfTypeX", (ctx, d: string) => {
  let tab = -1; // DN.Stamp_bonuses_DRI
  for (let g = 0; g < 3; g++) {
    if (contains((StampBonusIndex as unknown as readonly unknown[][])[g], d)) {
      tab = g;
      break;
    }
  }
  if (-1 == tab) return 0;
  const letter = hString(Number2Letter[Math.round(tab + 1)]).toUpperCase(); // DNSM.Sp_bn_l
  let total = 0; // DN.Stamp_TOTAL_bonus_of_type_X
  for (let g = 0, n = (StampDescriptions as unknown as readonly unknown[][])[tab].length; g < n; g++) {
    const id = g + 1e3 * tab;
    if (!(-1 != hString(itemDef(`Stamp${letter}${Math.round(g + 1)}`).desc_line1).indexOf(d) && 0 < stampLevel(ctx, id))) continue;
    let doubled = 1; // DN.StampExalted_double
    if (contains(attr(ctx, "Compass", 4), `${hString(Number2Letter[Math.floor(id / 1e3)])}${Math.round(id - 1e3 * Math.floor(id / 1e3))}`)) doubled = 1 + Windwalker(ctx, "StampDoubler", 0, 0) / 100;
    const det = StampDetails(id);
    total = total + doubled * ArbitraryCode5Inputs(ctx, hString(det[1]), asNumber(det[2]), asNumber(det[3]), Math.floor(StampOverLevel(ctx, id)), 0, 0);
  }
  if (-1 != d.indexOf("Eff")) total = total * Math.max(GetTalentNumber(ctx, 1, 625), 1);
  if (2 == MainframeBonus(ctx, 7) && 2 > tab) total = 2 * total;
  if ("BaseDmg" == d || "BaseHP" == d || "BaseAcc" == d || "BaseDef" == d) total = total * (1 + Summoning(ctx, "VaultUpgBonus", 16, 0) / 100);
  if (2 > tab) total = total * (1 + Ninja(ctx, "PristineBon", 17, 0) / 100);
  return total;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
