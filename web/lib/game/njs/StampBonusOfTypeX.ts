import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { Number2Letter, StampBonusIndex, StampDescriptions } from "../data";
import { hString } from "../hstring";
import { contains, listOrMapAt } from "../lists";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { GetTalentNumber } from "./GetTalentNumber";
import { MainframeBonus } from "./MainframeBonus";
import { Ninja } from "./Ninja";
import { Summoning } from "./Summoning";
import { itemDef } from "./TotalStats";
import { Windwalker } from "./Windwalker";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_StampDetails(c)` @4427254: stamp `c` (its tab floor(c / 1000), its index the rest): its item's `desc_line1`
 * ("Stamp" + A/B/C + (index + 1)) split on commas. A list, so a plain function.
 */
export function StampDetails(c: number): string[] {
  const tab = Math.floor(c / 1e3);
  return hString(itemDef(`Stamp${0 == tab ? "A" : 1 == tab ? "B" : "C"}${Math.round(c - 1e3 * tab + 1)}`).desc_line1).split(",");
}

/** `StampLevel[floor(d / 1000)][d mod 1000]`, the stamp's level (the save keeps each tab as a list or a {"0": …} map). */
function stampLevel(ctx: Ctx, d: number): number {
  const tab = Math.floor(d / 1e3);
  listOrMapAt(ctx, "StampLevel", tab); // the game indexes StampLevel[tab][i] directly
  return asNum(ctx, "StampLevel", tab, (d - 1e3 * tab) | 0);
}

/**
 * N.js `_customBlock_StampOverLevel(d)` @4427756: the level stamp `d` counts at. A stamp with a level cap by skill (details [10], the
 * Lv0 index of that skill) is held back while that skill is low, unless the Emporium item 5 is owned: past a deficit of 3 levels, its level
 * x 10 / details[4] counts only as 3 + (that - 3) x (skill level / (that - 3))^.75, back in levels, and never above the stamp's level.
 */
export const StampOverLevel = block("StampOverLevel", (ctx, d: number) => {
  const det = StampDetails(d);
  if (!(0 < asNumber(det[10]) && 0 == Ninja(ctx, "EmporiumBonus", 5, 0))) return stampLevel(ctx, d);
  let over: number; // DN.StampOverlevelNumberDUM
  if (1 < asNumber(det[4])) {
    const yourLv = asNum(ctx, "Lv0", asNumber(det[10]) | 0); // DN.StampOL_yourLv
    const stampLv = stampLevel(ctx, d) * (200 / (20 * asNumber(det[4]))); // DN.StampOL_stampLv
    const deficit = 3; // DN.StampOL_deficitcoeff
    over = stampLv > deficit ? (deficit + (stampLv - deficit) * Math.pow(yourLv / (stampLv - deficit), 0.75)) * ((20 * asNumber(det[4])) / 200) : stampLv;
  } else over = stampLevel(ctx, d);
  return Math.min(over, stampLevel(ctx, d));
});

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
