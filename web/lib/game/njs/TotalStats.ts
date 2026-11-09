import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { IDforETCbonus, ITEMS, PowerSuffixes } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains, listAt } from "../lists";
import { charKey, opt } from "../state";
import { AchieveStatus } from "./AchieveStatus";
import { ArbitraryCode } from "./ArbitraryCode";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { Breeding } from "./Breeding";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { chipBonuses } from "./chipBonuses";
import { CompLV2 } from "./CompLV2";
import { Companions } from "./Companions";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { Dreamstuff } from "./Dreamstuff";
import { Dungon } from "./Dungon";
import { EtcBonuses } from "./EtcBonuses";
import { FarmingStuffs } from "./FarmingStuffs";
import { FlurboShop } from "./FlurboShop";
import { Gallery, GalleryBonTOT } from "./Gallery";
import { GamingStatType } from "./GamingStatType";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { getbonus2 } from "./getbonus2";
import { getLOG } from "./getLOG";
import { GetSetBonus } from "./GetSetBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { GuildBonuses } from "./GuildBonuses";
import { Holes } from "./Holes";
import { Holes2 } from "./Holes2";
import { JellyOperation } from "./JellyOperation";
import { Labb } from "./Labb";
import { MenagerieStuff } from "./MenagerieStuff";
import { Minehead } from "./Minehead";
import { Ninja } from "./Ninja";
import { prayersReal } from "./prayersReal";
import { ResearchStuff } from "./ResearchStuff";
import { RoyalG } from "./RoyalG";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { ObolStats } from "./ScrollCircleINFO";
import { Shrine } from "./Shrine";
import { Spelunk } from "./Spelunk";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import { SushiStuff } from "./SushiStuff";
import { TalentCalc } from "./TalentCalc";
import { haveBan, Thingies } from "./Thingies";
import { TotalFoodBonuses } from "./TotalFoodBonuses";
import { WorkbenchStuff } from "./WorkbenchStuff";
import type { Ported } from "../ported";

type Item = Readonly<Record<string, unknown>>;

/** `ItemDefinitionsGET[name]`. The game indexes it directly and would throw on an item it does not have. */
export function itemDef(name: string): Item {
  const item = (ITEMS as Record<string, Item>)[name];
  if (!item) throw new RangeError(`no item ${name} in ItemDefinitions`);
  return item;
}

/**
 * `EquipmentMap[f][slot]`, the per-item stats of the equipped item (EMm0/EMm1 of the character): the load @19920950 reads them as a sparse
 * list of `EMmLENGTH<f>` slots (`getLoadSparseList`), so a slot the save does not have is an empty map. Past that length the game reads
 * undefined and would throw.
 */
export function equipMap(ctx: Ctx, f: number, slot: number): Item {
  const lengthKey = charKey(`EMmLENGTH${f}`, ctx.player);
  const length = opt(ctx.state, lengthKey);
  if (length === undefined) throw new MissingSaveKey(lengthKey);
  if (!(slot < Math.round(asNumber(length)))) throw new RangeError(`TotalStats: equipment slot ${slot} is past ${lengthKey}`);
  const v = attr(ctx, "EquipmentMap", f, slot);
  if (v === undefined) return {};
  if (v === null || typeof v !== "object") throw new InvalidSaveValue(`EquipmentMap[${f}][${slot}]`, "a map", v);
  return v as Item;
}

/** The pieces of TotalStats' head (DN, and the ETC map when `d` is "calcEtcBonuses"). */
type Head = { dn: number; etc: Map<string, number> | null };

const galleryOn = (ctx: Ctx) => 1 == Gallery(ctx, "GalleryBonusSystemON", 0, 0);
const premHatOn = (ctx: Ctx) => 1 == Gallery(ctx, "PremHatBonusesSystemON", 0, 0);
const capeOn = (ctx: Ctx) => 1 == Gallery(ctx, "CapevineBonusesSystemON", 0, 0);

/** Step 1's skip (@4156881, the head's comment below): slot O of EquipmentOrder[f] adds nothing. */
export function equipSlotSkipped(ctx: Ctx, f: number, O: number): boolean {
  const name = attr(ctx, "EquipmentOrder", f, O);
  return (
    (galleryOn(ctx) && 0 == f && 10 == O) ||
    (galleryOn(ctx) && 0 == f && 14 == O) ||
    (premHatOn(ctx) && 0 == f && 8 == O) ||
    (capeOn(ctx) && 0 == f && 12 == O) ||
    (-1 != Dungon(ctx) && (-1 == Dungon(ctx) || -1 == hString(name).indexOf("Dung"))) ||
    "Blank" == name
  );
}

/** Step 1 for "calcEtcBonuses": unique stat e (0 or 1) of the item in a counted slot goes into the ETC map as `multi` x `amount`, under `stat`. */
export function equipEtcLine(ctx: Ctx, f: number, O: number, e: number): { stat: string; amount: number; multi: number } {
  const def = itemDef(hString(attr(ctx, "EquipmentOrder", f, O)));
  const own = equipMap(ctx, f, O);
  const txt = `UQ${Math.round(e + 1)}txt`;
  const val = `UQ${Math.round(e + 1)}val`;
  const ownOnly = "0" == def[txt] ? (0 < asNumber(own[val]) ? Object.hasOwn(own, txt) : false) : false;
  const doubled = (0 == f && 3 == O && 1 == chipBonuses(ctx, "pend")) || (0 == f && 9 == O && 1 == chipBonuses(ctx, "key1")) || (0 == f && 10 == O && 1 == chipBonuses(ctx, "troph"));
  const amount = ownOnly ? asNumber(own[val]) : asNumber(def[val]) + asNumber(own[val]);
  const stat = hString(ownOnly ? own[txt] : def[txt]); // DNSM.TotalStatsDT2
  const multi = doubled ? 2 : 0 == f && 15 == O && 1 <= ResearchStuff(ctx, "Grid_Bonus", 172, 0) ? 1 + ResearchStuff(ctx, "Grid_Bonus", 172, 0) / 100 : 1;
  return { stat, amount, multi };
}

/**
 * The part of `_customBlock_TotalStats(d)` @4156192 every sub-case shares, up to the sub-cases' own chain (@4174547):
 *  1. @4156881: the equipment (EquipmentOrder[0], 16 slots, and [1], the 8 tools): every item but "Blank" adds its stat `d` from its
 *     definition, plus the item's own `d` (EquipmentMap) when it has one. The trophy slot 10 and the nametag slot 14 are skipped when the
 *     Gallery holds them, the premium hat slot 8 with the Hatrack, the cape slot 12 with the Cape Vine; in a dungeon (`Dungon() != -1`)
 *     only the dungeon items count. For "calcEtcBonuses" each item's two unique stats (UQ1/UQ2) go into the ETC map instead: doubled on
 *     the pendant (slot 3), the keychain (9) and the trophy (10) slots with the matching chip, times 1 + Research square 172 / 100 on the
 *     slot 15;
 *  2. @4164328: the Gallery's trophy and nametag bonuses, the Hatrack's and the Cape Vine's (Gallery.ts), each when its system is on;
 *  3. @4171970 (not in a dungeon): STR/AGI/WIS/LUK times 1 + (their % talent + their % stamp) / 100;
 *  4. @4172893 (not in a dungeon): the obols' total of `d` (ScrollCircleINFO.ts), times 1 + (their obol talent + 40 x Super Bit 2) / 100
 *     for STR/AGI/WIS/LUK and times MenagerieStuff("ObolMISCmulti") for any other stat (@4175537); for "calcEtcBonuses" the obols' stats
 *     named in IDforETCbonus go into the ETC map.
 * The "Power" stats (Weapon_Power, the tool powers, Dung_Power) take another rule in step 1 (powerCounts below), @4158761.
 */
function head(ctx: Ctx, d: string): Head {
  const calcEtc = "calcEtcBonuses" == d;
  const etc = calcEtc ? new Map<string, number>() : null; // DNSM.TotalStatsETCmap
  const etcAdd = (k: string, v: number) => etc!.set(k, asNumber(etc!.get(k)) + v);
  let dn = 0; // DN.TotalStatsDN
  for (let f = 0; f < 2; f++) {
    for (let O = 0, n = Math.round(8 + 8 * (1 - f)); O < n; O++) {
      if (equipSlotSkipped(ctx, f, O)) continue;
      const name = attr(ctx, "EquipmentOrder", f, O);
      if (-1 != d.indexOf("Power")) {
        // @4160167: a power stat adds the item's Weapon_Power (whatever the power), its own one too when it has it
        if (!powerCounts(d, f, O, hString(name))) continue;
        const def = itemDef(hString(name));
        const own = equipMap(ctx, f, O);
        dn = Object.hasOwn(own, "Weapon_Power") ? dn + (asNumber(def.Weapon_Power) + asNumber(own.Weapon_Power)) : dn + asNumber(def.Weapon_Power);
        continue; // the ETC map below is for "calcEtcBonuses", which is not a power
      }
      const def = itemDef(hString(name));
      const own = equipMap(ctx, f, O);
      dn = Object.hasOwn(own, d) ? dn + (asNumber(def[d]) + asNumber(own[d])) : dn + asNumber(def[d]);
      if (!calcEtc) continue;
      for (let e = 0; e < 2; e++) {
        const { stat, amount, multi } = equipEtcLine(ctx, f, O, e);
        etcAdd(stat, multi * amount);
      }
    }
  }
  const fromCache = (cache: ReadonlyMap<string, number>) => {
    if (calcEtc) for (const [k, v] of cache) etcAdd(k, v);
    if (cache.has(d)) dn = dn + asNumber(cache.get(d));
  };
  if (galleryOn(ctx)) {
    if (1 == Gallery(ctx, "InitializeTrophyBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "Trophy"));
    if (1 == Gallery(ctx, "InitializeNametagBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "Nametag"));
  }
  if (premHatOn(ctx) && 1 == Gallery(ctx, "InitializePremHatBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "PremHat"));
  if (capeOn(ctx) && 1 == Gallery(ctx, "InitializeCapeBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "CapeVine"));
  const pct = PCT[d];
  if (-1 == Dungon(ctx) && pct) dn = dn * (1 + (GetTalentNumber(ctx, 1, pct.talent) + StampBonusOfTypeX(ctx, pct.stamp)) / 100);
  if (-1 == Dungon(ctx)) {
    let dn2 = 0; // DNSM.TotalStatsDN2
    const names = Object.values(IDforETCbonus); // DNSM.TotalStatsETCmap2List
    for (const [stat, , , total] of ObolStats(ctx)) {
      if (stat == d) dn2 = dn2 + total;
      if (calcEtc && contains(names, stat)) etcAdd(hString(stat), total);
    }
    const obol = OBOL[d];
    // ponytail: the ETC map ignores TotalStatsDN (TotalStats("calcEtcBonuses") answers 0), so its obol multiplier
    // (MenagerieStuff("ObolMISCmulti")) is not computed for it
    if (obol !== undefined) dn2 = dn2 * (1 + (GetTalentNumber(ctx, 1, obol) + 40 * GamingStatType(ctx, "SuperBitType", 2, 0)) / 100);
    else if (!calcEtc) dn2 = dn2 * MenagerieStuff(ctx, "ObolMISCmulti", 0, 0);
    dn = dn + dn2;
  }
  return { dn, etc };
}

/**
 * Step 1's power rule, @4158761: whether the item `name` in slot O of EquipmentOrder[f] counts for the power `d` (DN.TotalStatsDT2 =
 * "YESstats"). With DT the power's name before "_" ("Weapon" for Weapon_Power): on the equipment (f = 0) the first of PowerSuffixes the
 * item's name contains decides (it counts only when that suffix is DT), and an item that contains none counts for Weapon only; on the
 * tools (f = 1) only the slot at DT's index in PowerSuffixes counts (none for Weapon, which is not in the list).
 */
function powerCounts(d: string, f: number, O: number, name: string): boolean {
  const DT = d.substring(0, d.indexOf("_")); // DN.TotalStatsDT
  const suffixes = PowerSuffixes as readonly unknown[];
  let yes = false;
  if (0 == f) {
    for (let I = 0; I < suffixes.length; I++) {
      if (-1 != name.indexOf(hString(suffixes[I]))) {
        if (suffixes[I] == DT) yes = true;
        break;
      } else if (I + 1 == suffixes.length && "Weapon" == DT) yes = true;
    }
  } else if (suffixes.indexOf(DT) == O) yes = true;
  return yes;
}

/** Step 3's talent and stamp, @4171970. */
const PCT: Readonly<Record<string, { talent: number; stamp: string }>> = {
  STR: { talent: 96, stamp: "PctSTR" },
  AGI: { talent: 276, stamp: "PctAGI" },
  WIS: { talent: 456, stamp: "PctWIS" },
  LUK: { talent: 21, stamp: "PctLUK" },
};
/** Step 4's obol talent, @4174705. */
const OBOL: Readonly<Record<string, number>> = { STR: 111, AGI: 291, WIS: 486, LUK: 36 };

/**
 * `DNSM.TotalStatsETCmap`, the unique stats of the equipment, the Gallery and the obols by name ("%_ALL_STATS"...), which
 * `TotalStats("calcEtcBonuses")` rebuilds whenever the equipment changes (the item drop, equip and map-load events @6787852, @15300727...)
 * and `EtcBonuses` reads. This is that rebuild, for the current player.
 */
export function TotalStatsETCmap(ctx: Ctx): ReadonlyMap<string, number> {
  return head(ctx, "calcEtcBonuses").etc!;
}

/**
 * N.js `_customBlock_TotalStats(d)` @4156192: the character's total of stat `d`, cached in `DNSM.TotStatMAP` (here the `block` cache).
 * Only STR, AGI, WIS, LUK, Accuracy, Weapon_Power and Drop_Rarity are ported. Outside a dungeon each main stat is
 * floor(the TotalSTR bubble + talent 652 + Companion 8 + (1 + pct / 100) x (equipment + base + the flat sources)), @4174547.
 */
export const TotalStats: (ctx: Ctx, d: string) => number = block("TotalStats", (ctx, d: string) => {
  switch (d) {
    case "STR": {
      const { dn } = head(ctx, d);
      if (-1 != Dungon(ctx)) return Math.floor(dn);
      return Math.floor(
        DNSM_AlchBubbles(ctx, "TotalSTR") +
          (GetTalentNumber(ctx, 1, 652) + Companions(ctx, 8)) +
          (1 +
            (GetTalentNumber(ctx, 1, 143) +
              EtcBonuses(ctx, "57") +
              (EtcBonuses(ctx, "46") + (ArbitraryCode(ctx, "AllStatPCT") + Ninja(ctx, "PristineBon", 4, 0)) + (DNSM_StarSigns(ctx, "pctSTR") + DNSM_AlchBubbles(ctx, "W8")))) /
              100) *
            (dn +
              (GetTalentNumber(ctx, 1, 10) + getbonus2(ctx, 1, 51, -1) + (StampBonusOfTypeX(ctx, "BaseSTR") + EtcBonuses(ctx, "51"))) +
              (GetTalentNumber(ctx, 1, 98) +
                GetTalentNumber(ctx, 1, 203) +
                (GetBuffBonuses(ctx, 94, 1) + (GetTalentNumber(ctx, 2, 142) + asNum(ctx, "OptionsListAccount", 174) * Dreamstuff(ctx, "AllShimmerBonuses", 0)))) +
              (DNSM_FamBonusQTYs(ctx, "14") +
                (DNSM_StarSigns(ctx, "STR") +
                  DNSM_BoxRewards(ctx, "23b") +
                  (TalentCalc(ctx, 620) +
                    (CardBonusREAL(ctx, 9) +
                      (StampBonusOfTypeX(ctx, "BaseAllStat") +
                        (ArbitraryCode(ctx, "AllStat") +
                          (Labb(ctx, "SigilBonus", "Blank", 0, 0) +
                            (DNSM_AlchBubbles(ctx, "W4") +
                              (Breeding(ctx, "ShinyBonusS", "Nah", 6, -1) + (ArcadeBonus(ctx, 19) + Summoning(ctx, "OwlBonuses", 5, 0))))))))))))
      );
    }
    // @4174547 on, the next sub-case
    case "AGI": {
      const { dn } = head(ctx, d);
      if (-1 != Dungon(ctx)) return Math.floor(dn);
      return Math.floor(
        DNSM_AlchBubbles(ctx, "TotalAGI") +
          (GetTalentNumber(ctx, 1, 652) + Companions(ctx, 8)) +
          (1 +
            (GetTalentNumber(ctx, 1, 368) +
              EtcBonuses(ctx, "25") +
              (EtcBonuses(ctx, "46") + (ArbitraryCode(ctx, "AllStatPCT") + Ninja(ctx, "PristineBon", 1, 0)) + (DNSM_StarSigns(ctx, "pctAGI") + DNSM_AlchBubbles(ctx, "A9")))) /
              100) *
            (dn +
              (GetTalentNumber(ctx, 1, 11) + getbonus2(ctx, 1, 52, -1) + (StampBonusOfTypeX(ctx, "BaseAGI") + EtcBonuses(ctx, "52"))) +
              (GetTalentNumber(ctx, 1, 278) + GetTalentNumber(ctx, 1, 428) + asNum(ctx, "OptionsListAccount", 175) * Dreamstuff(ctx, "AllShimmerBonuses", 0)) +
              (DNSM_FamBonusQTYs(ctx, "38") +
                (DNSM_StarSigns(ctx, "AGI") +
                  DNSM_BoxRewards(ctx, "21b") +
                  (TalentCalc(ctx, 620) +
                    (CardBonusREAL(ctx, 7) +
                      (StampBonusOfTypeX(ctx, "BaseAllStat") +
                        (ArbitraryCode(ctx, "AllStat") +
                          (Labb(ctx, "SigilBonus", "Blank", 1, 0) +
                            (GetTalentNumber(ctx, 2, 367) +
                              (DNSM_AlchBubbles(ctx, "A4") +
                                (Breeding(ctx, "ShinyBonusS", "Nah", 7, -1) + (ArcadeBonus(ctx, 20) + Summoning(ctx, "OwlBonuses", 5, 0)))))))))))))
      );
    }
    case "WIS": {
      const { dn } = head(ctx, d);
      if (-1 != Dungon(ctx)) return Math.floor(dn);
      return Math.floor(
        DNSM_AlchBubbles(ctx, "TotalWIS") +
          (GetTalentNumber(ctx, 1, 652) + Companions(ctx, 8)) +
          (1 +
            (GetTalentNumber(ctx, 1, 533) +
              EtcBonuses(ctx, "58") +
              (EtcBonuses(ctx, "46") + (ArbitraryCode(ctx, "AllStatPCT") + Ninja(ctx, "PristineBon", 10, 0)) + (DNSM_StarSigns(ctx, "pctWIS") + DNSM_AlchBubbles(ctx, "M9")))) /
              100) *
            (dn +
              (GetTalentNumber(ctx, 1, 12) + getbonus2(ctx, 1, 53, -1) + (StampBonusOfTypeX(ctx, "BaseWIS") + EtcBonuses(ctx, "53"))) +
              (GetTalentNumber(ctx, 1, 459) + asNum(ctx, "OptionsListAccount", 176) * Dreamstuff(ctx, "AllShimmerBonuses", 0)) +
              DNSM_FamBonusQTYs(ctx, "62") +
              (DNSM_StarSigns(ctx, "WIS") +
                DNSM_BoxRewards(ctx, "22b") +
                (GetTalentNumber(ctx, 1, 593) +
                  TalentCalc(ctx, 620) +
                  (CardBonusREAL(ctx, 5) +
                    (StampBonusOfTypeX(ctx, "BaseAllStat") +
                      (ArbitraryCode(ctx, "AllStat") +
                        (Labb(ctx, "SigilBonus", "Blank", 2, 0) +
                          (GetTalentNumber(ctx, 2, 532) +
                            (DNSM_AlchBubbles(ctx, "M4") +
                              (Breeding(ctx, "ShinyBonusS", "Nah", 8, -1) + (ArcadeBonus(ctx, 21) + Summoning(ctx, "OwlBonuses", 5, 0))))))))))))
      );
    }
    case "LUK": {
      const { dn } = head(ctx, d);
      if (-1 != Dungon(ctx)) return Math.floor(dn);
      // the quests term is min(quests, talent 618): with the talent at 0 it is 0 whatever the count (a count is never below 0), so the
      // count, the Tome's TomeQTY[4], is only read when the talent has a level
      const t618 = GetTalentNumber(ctx, 1, 618);
      const quests = 0 >= t618 ? t618 : Math.min(ArbitraryCode(ctx, "TotalQuestsComplete"), t618);
      return Math.floor(
        DNSM_AlchBubbles(ctx, "TotalLUK") +
          (GetTalentNumber(ctx, 1, 652) + Companions(ctx, 8)) +
          (1 + (EtcBonuses(ctx, "17") + (EtcBonuses(ctx, "46") + (ArbitraryCode(ctx, "AllStatPCT") + Ninja(ctx, "PristineBon", 5, 0)) + DNSM_StarSigns(ctx, "pctLUK"))) / 100) *
            (dn +
              (GetTalentNumber(ctx, 1, 13) +
                getbonus2(ctx, 1, 54, -1) +
                (StampBonusOfTypeX(ctx, "BaseLUK") + DNSM_BoxRewards(ctx, "15c") + (EtcBonuses(ctx, "54") + asNum(ctx, "OptionsListAccount", 177) * Dreamstuff(ctx, "AllShimmerBonuses", 0)))) +
              (DNSM_BoxRewards(ctx, "LUK") +
                (DNSM_FamBonusQTYs(ctx, "4") +
                  DNSM_StarSigns(ctx, "LUK") +
                  (quests +
                    (TalentCalc(ctx, 620) +
                      (CardBonusREAL(ctx, 2) +
                        (GetTalentNumber(ctx, 1, 23) +
                          (StampBonusOfTypeX(ctx, "BaseAllStat") +
                            (ArbitraryCode(ctx, "AllStat") +
                              (Labb(ctx, "SigilBonus", "Blank", 3, 0) +
                                (DNSM_AlchBubbles(ctx, "A4") + (Breeding(ctx, "ShinyBonusS", "Nah", 9, -1) + (ArcadeBonus(ctx, 22) + Summoning(ctx, "OwlBonuses", 5, 0))))))))))))))
      );
    }
    // @4185692: no floor, and no dungeon rule of its own (the head keeps only the dungeon items there)
    case "Accuracy": {
      const { dn } = head(ctx, d);
      return (
        2 +
        DNSM_AlchVials(ctx, "baseACC") +
        (DNSM_BoxRewards(ctx, "acc") +
          (CardBonusREAL(ctx, 23) + EtcBonuses(ctx, "28") + GoldFoodBonuses(ctx, "BaseAcc")) +
          (StampBonusOfTypeX(ctx, "BaseAcc") + Summoning(ctx, "VaultUpgBonus", 4, 0))) +
        dn
      );
    }
    // @4186239: no floor; DN is the head's equipment, Gallery and obol power
    case "Weapon_Power": {
      const { dn } = head(ctx, d);
      listAt(ctx, "PetsStored", 0); // the game indexes PetsStored[0][2] directly
      return (
        5 +
        DNSM_BoxRewards(ctx, "12a") +
        FlurboShop(ctx, 0) +
        TotalFoodBonuses(ctx, "WeaponPowerBoosts") +
        (CardBonusREAL(ctx, 18) + RunCodeOfTypeXforThingY(ctx, "CardLv", "w5b2") + (GuildBonuses(ctx, 3) + Labb(ctx, "SigilBonus", "Blank", 17, 0))) +
        (dn * (1 + (chipBonuses(ctx, "weppow") + (DNSM_AlchBubbles(ctx, "W1") + (DNSM_AlchBubbles(ctx, "A1") + DNSM_AlchBubbles(ctx, "M1")))) / 100) +
          TalentCalc(ctx, 616) +
          (DNSM_AlchVials(ctx, "WeaponPOW") +
            (DNSM_FamBonusQTYs(ctx, "16") +
              (DNSM_StarSigns(ctx, "WepPow") +
                (ArcadeBonus(ctx, 17) +
                  (GetTalentNumber(ctx, 1, 140) * Math.floor(asNum(ctx, "Lv0", 10) / 10) +
                    (GetTalentNumber(ctx, 1, 170) * Math.floor(asNum(ctx, "Lv0", 15) / 10) +
                      (GetTalentNumber(ctx, 1, 320) * Math.floor(asNum(ctx, "Lv0", 13) / 10) + GetTalentNumber(ctx, 1, 500) * Math.floor(asNum(ctx, "Lv0", 14) / 10))) +
                    (GetTalentNumber(ctx, 1, 365) * getLOG(ctx, asNum(ctx, "PetsStored", 0, 2)) + GetTalentNumber(ctx, 1, 530) * Math.floor(asNum(ctx, "Lv0", 12) / 10))))))))
      );
    }
    case "Drop_Rarity":
      return dropRarity(ctx);
    default:
      throw new NotPorted("TotalStats", d);
  }
});

/** DNSM.DropRateLUK after its curve (@4190539): `1E3 > LUK ? (pow(LUK + 1, .37) - 1) / 40 : .5 x ((LUK - 1E3) / (LUK + 2500)) + .297`. */
export const dropRateLuk = (luk: number): number => (1e3 > luk ? (Math.pow(luk + 1, 0.37) - 1) / 40 : 0.5 * ((luk - 1e3) / (luk + 2500)) + 0.297);

/**
 * `"Drop_Rarity"==d` @4190432, the Player Info "Drop Rate". The game works in DNSM: DropRateLUK (the LUK curve), DropRateLUK2 (a Σ of its own),
 * TotStatMAP.Drop_Rarity (the total, rewritten step by step) and NormzDR_GlunkC (the total before the Cove, which nothing reads); they are rewritten
 * on every call, so they are locals here, in the game's order and with its parentheses (the float rounding). After the base 1 + 1.4 x the curve +
 * Σ / 100: the chip under 5, then (outside a dungeon) bun_v, the Workbench, OptionsListAccount[232], bun_p and the multipliers; last, on map 216
 * (`CurrentMap`, ctx.map) a character in cavern 17 gets the Cove's own Drop Rate instead. The Arcane factor reads ctx.map too.
 */
function dropRarity(ctx: Ctx): number {
  // @4190490: DropRateLUK, the curve of the live LUK total
  const luk = dropRateLuk(TotalStats(ctx, "LUK"));
  // @4190966: DropRateLUK2
  const luk2 =
    Math.min(1.5 * RunCodeOfTypeXforThingY(ctx, "CardLv", "mini5a"), 10) +
    (Math.min(4 * RunCodeOfTypeXforThingY(ctx, "CardLv", "caveC") + 6 * RunCodeOfTypeXforThingY(ctx, "CardLv", "caveD"), 100) +
      (Math.min(2 * RunCodeOfTypeXforThingY(ctx, "CardLv", "anni4Event1"), 20) + Math.min(3 * RunCodeOfTypeXforThingY(ctx, "CardLv", "luckEvent1"), 25))) +
    (GoldFoodBonuses(ctx, "DropRatez") +
      (6 * AchieveStatus(ctx, 377) +
        4 * AchieveStatus(ctx, 381) +
        (Summoning(ctx, "OwlBonuses", 4, 0) +
          (FarmingStuffs(ctx, "LankRankUpgBonus", 9, 0) +
            (Summoning(ctx, "VotingBonusz", 27, 0) +
              (Holes(ctx, "B_UPG", 46, 0) +
                (FarmingStuffs(ctx, "CropSCbonus", 7, 0) +
                  (Summoning(ctx, "GrimoireUpgBonus", 44, 0) +
                    (Summoning(ctx, "VaultUpgBonus", 18, 0) +
                      (Holes(ctx, "MeasurementBonusTOTAL", 15, 0) +
                        (Companions(ctx, 22) +
                          Companions(ctx, 158) +
                          (Holes(ctx, "B_UPG", 82, 20) +
                            (Holes(ctx, "MonumentROGbonuses", 2, 6) +
                              (Thingies(ctx, "EmperorBon", 11, 0) +
                                (GetSetBonus(ctx, "EFAUNT_SET", "Bonus", 0, 0) +
                                  (FarmingStuffs(ctx, "ExoticBonusQTY", 59, 0) +
                                    (Thingies(ctx, "FriendBonusStatz", 3, 0) +
                                      (Thingies(ctx, "LegendPTS_bonus", 1, 0) +
                                        (Spelunk(ctx, "ShopUpgBonus", 50, 0) + (Companions(ctx, 111) + GetTalentNumber(ctx, 1, 239) * (RoyalG(ctx, "TotalStatz", 0, 0) / 1)))))))))))))))))))));
  // @4192476: TotStatMAP.Drop_Rarity, 1 + 1.4 x DropRateLUK + Σ / 100 (the curve sits outside the /100)
  let tot =
    1 +
    (1.4 * luk +
      (GetTalentNumber(ctx, 1, 279) +
        (DNSM_BoxRewards(ctx, "DropRate") +
          (EtcBonuses(ctx, "2") +
            EtcBonuses(ctx, "102") +
            (DNSM_AlchBubbles(ctx, "DropRate") +
              (CardBonusREAL(ctx, 10) +
                (GetTalentNumber(ctx, 1, 24) +
                  (DNSM_StarSigns(ctx, "Drop") +
                    (GuildBonuses(ctx, 10) +
                      (CardSetBonuses(ctx, 0, "5") +
                        (CardSetBonuses(ctx, 0, "6") +
                          (Shrine(ctx, 4) +
                            (prayersReal(ctx, 7, 0) +
                              (Labb(ctx, "SigilBonus", "Blank", 11, 0) +
                                (Breeding(ctx, "ShinyBonusS", "Nah", 0, -1) +
                                  (ArcadeBonus(ctx, 27) +
                                    (Companions(ctx, 3) +
                                      Companions(ctx, 50) +
                                      (StampBonusOfTypeX(ctx, "DropRate") +
                                        (GetTalentNumber(ctx, 1, 655) * asNum(ctx, "OptionsListAccount", 189) +
                                          (5 * asNum(ctx, "Dream", 10) +
                                            (Summoning(ctx, "WinBonus", 9, 0) +
                                              (Summoning(ctx, "TomeBonus", 2, 0) + (luk2 + (ResearchStuff(ctx, "Grid_Bonus", 173, 0) + Companions(ctx, 132)))))))))))))))))))))))) /
        100);
  // @4193824: the chip ("dr"), only under 5 and up to 5
  if (5 > tot) tot = Math.min(5, tot + chipBonuses(ctx, "dr") / 100);
  // @4194067: in a dungeon the total is 1 + (LUK + DungeonStat("DropRarity")) / 100; Dungon() answers -1 on every map (Ruling Y), so it is not ported
  if (-1 != Dungon(ctx)) throw new Error('TotalStats("Drop_Rarity"): Dungon() is not -1, and the in-dungeon branch (@4194067) is not ported: Dungon() answers -1 on every map (Ruling Y), so a stub that leaves it at another value (0) reaches this');
  // @4194240: outside a dungeon
  if (-1 == Dungon(ctx)) {
    if (1 == haveBan(ctx, "bun_v")) tot = tot + 2; // @4194318, an absent BundlesReceived is the loader's empty map (Ruling H)
    tot = tot * WorkbenchStuff(ctx, "AdditionExtraEXPnDR", 0, 0); // @4194602
    if (1 <= asNum(ctx, "OptionsListAccount", 232)) tot = tot + 0.3; // @4194678
    if (1 == haveBan(ctx, "bun_p")) tot = 1.2 * tot; // @4194883
    // @4195168
    tot =
      tot *
      (1 + ArcaneType(ctx, "ArcaneMapMulti_bon", 0, 0) / 100) *
      (1 + RoyalG(ctx, "StatueBon", 1, 0) / 100) *
      (1 + MenagerieStuff(ctx, "BoostQTY", 24, 0) / 100) *
      (1 + CardBonusREAL(ctx, 101) / 100) *
      (1 + DNSM_FamBonusQTYs(ctx, "32") / 100) *
      (1 + 0.3 * Companions(ctx, 168)) *
      (1 + (Math.min(0.5, Companions(ctx, 132)) + 0.2 * CompLV2(ctx, 132))) *
      (1 + (SushiStuff(ctx, "RoG_BonusQTY", 48, 0) + JellyOperation(ctx, "RoG_BonusQTY", 14, 0)) / 100) *
      Math.max(1, Minehead(ctx, "GlimboDRmulti", 0, 0)) *
      (1 + Summoning(ctx, "TomeBonus", 7, 0) / 100) *
      (1 + EtcBonuses(ctx, "99") / 100) *
      (1 + Minehead(ctx, "BonusQTY", 0, 0) / 100) *
      (1 + (5 * Dreamstuff(ctx, "CloudBonus", 69)) / 100);
    // @4196045
    tot = tot * (1 + Ninja(ctx, "PristineBon", 3, 0) / 100) * (1 + EtcBonuses(ctx, "91") / 100) * (1 + DNSM_AlchVials(ctx, "7drMulto") / 100);
    // @4196312
    tot = tot * Math.max(1, Math.min(1.3, 1 + Companions(ctx, 26)) * (1 + 0.5 * Companions(ctx, 160))) * Math.max(1, Math.min(1.01, 1 + Companions(ctx, 50) / 2500));
  }
  // @4196590: DNSM.NormzDR_GlunkC = the total (written, never read). @4196607: map 216 with the character in cavern 17 (Holes[0][its index], the raw
  // element, loosely): the Cove's Drop Rate replaces the total
  if (216 == ctx.map && 17 == attr(ctx, "Holes", 0, ctx.player)) tot = Holes2(ctx, "Cglunko_DR", 0, 0);
  return tot;
}

/**
 * What this module covers (lib/game/ported.ts). `"()"` is the call with a computed name: DamageDealed's and ArtifactBonus 25's
 * TotalStats(ClassStatTypes[first class][0]), PlayerAccTot's [1], always a main stat.
 */
export const PORTED: Ported = { STR: true, AGI: true, WIS: true, LUK: true, Accuracy: true, Weapon_Power: true, Drop_Rarity: true, "()": ["STR", "AGI", "WIS", "LUK"] };
