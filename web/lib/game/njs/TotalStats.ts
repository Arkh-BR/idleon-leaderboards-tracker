import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { IDforETCbonus, ITEMS } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains } from "../lists";
import { charKey, opt } from "../state";
import { ArbitraryCode } from "./ArbitraryCode";
import { ArcadeBonus } from "./ArcadeBonus";
import { Breeding } from "./Breeding";
import { CardBonusREAL } from "./CardBonusREAL";
import { chipBonuses } from "./chipBonuses";
import { Companions } from "./Companions";
import { DNSM_AlchBubbles, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { Dreamstuff } from "./Dreamstuff";
import { Dungon } from "./Dungon";
import { EtcBonuses } from "./EtcBonuses";
import { Gallery, GalleryBonTOT } from "./Gallery";
import { GamingStatType } from "./GamingStatType";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { getbonus2 } from "./getbonus2";
import { GetTalentNumber } from "./GetTalentNumber";
import { Labb } from "./Labb";
import { Ninja } from "./Ninja";
import { ResearchStuff } from "./ResearchStuff";
import { ObolStats } from "./ScrollCircleINFO";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import { TalentCalc } from "./TalentCalc";
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
function equipMap(ctx: Ctx, f: number, slot: number): Item {
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
 *     for STR/AGI/WIS/LUK and times MenagerieStuff("ObolMISCmulti") for any other stat; for "calcEtcBonuses" the obols' stats named in
 *     IDforETCbonus go into the ETC map.
 * The "Power" stats (Weapon_Power, the tool powers) take another rule in step 1, not ported.
 */
function head(ctx: Ctx, d: string): Head {
  if (-1 != d.indexOf("Power")) throw new NotPorted("TotalStats", d);
  const calcEtc = "calcEtcBonuses" == d;
  const etc = calcEtc ? new Map<string, number>() : null; // DNSM.TotalStatsETCmap
  const etcAdd = (k: string, v: number) => etc!.set(k, asNumber(etc!.get(k)) + v);
  const galleryOn = () => 1 == Gallery(ctx, "GalleryBonusSystemON", 0, 0);
  const premHatOn = () => 1 == Gallery(ctx, "PremHatBonusesSystemON", 0, 0);
  const capeOn = () => 1 == Gallery(ctx, "CapevineBonusesSystemON", 0, 0);
  let dn = 0; // DN.TotalStatsDN
  for (let f = 0; f < 2; f++) {
    for (let O = 0, n = Math.round(8 + 8 * (1 - f)); O < n; O++) {
      const name = attr(ctx, "EquipmentOrder", f, O);
      const skip =
        (galleryOn() && 0 == f && 10 == O) ||
        (galleryOn() && 0 == f && 14 == O) ||
        (premHatOn() && 0 == f && 8 == O) ||
        (capeOn() && 0 == f && 12 == O) ||
        (-1 != Dungon(ctx) && (-1 == Dungon(ctx) || -1 == hString(name).indexOf("Dung"))) ||
        "Blank" == name;
      if (skip) continue;
      const def = itemDef(hString(name));
      const own = equipMap(ctx, f, O);
      dn = Object.hasOwn(own, d) ? dn + (asNumber(def[d]) + asNumber(own[d])) : dn + asNumber(def[d]);
      if (!calcEtc) continue;
      for (let e = 0; e < 2; e++) {
        const txt = `UQ${Math.round(e + 1)}txt`;
        const val = `UQ${Math.round(e + 1)}val`;
        const ownOnly = "0" == def[txt] ? (0 < asNumber(own[val]) ? Object.hasOwn(own, txt) : false) : false;
        const doubled =
          (0 == f && 3 == O && 1 == chipBonuses(ctx, "pend")) || (0 == f && 9 == O && 1 == chipBonuses(ctx, "key1")) || (0 == f && 10 == O && 1 == chipBonuses(ctx, "troph"));
        const amount = ownOnly ? asNumber(own[val]) : asNumber(def[val]) + asNumber(own[val]);
        const key = hString(ownOnly ? own[txt] : def[txt]); // DNSM.TotalStatsDT2
        if (doubled) etcAdd(key, 2 * amount);
        else if (0 == f && 15 == O && 1 <= ResearchStuff(ctx, "Grid_Bonus", 172, 0)) etcAdd(key, (1 + ResearchStuff(ctx, "Grid_Bonus", 172, 0) / 100) * amount);
        else etcAdd(key, amount);
      }
    }
  }
  const fromCache = (cache: ReadonlyMap<string, number>) => {
    if (calcEtc) for (const [k, v] of cache) etcAdd(k, v);
    if (cache.has(d)) dn = dn + asNumber(cache.get(d));
  };
  if (galleryOn()) {
    if (1 == Gallery(ctx, "InitializeTrophyBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "Trophy"));
    if (1 == Gallery(ctx, "InitializeNametagBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "Nametag"));
  }
  if (premHatOn() && 1 == Gallery(ctx, "InitializePremHatBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "PremHat"));
  if (capeOn() && 1 == Gallery(ctx, "InitializeCapeBonuses", 0, 0)) fromCache(GalleryBonTOT(ctx, "CapeVine"));
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
    // (MenagerieStuff("ObolMISCmulti")) is not computed for it; port it with the first non-main stat
    if (obol !== undefined) dn2 = dn2 * (1 + (GetTalentNumber(ctx, 1, obol) + 40 * GamingStatType(ctx, "SuperBitType", 2, 0)) / 100);
    else if (!calcEtc) throw new NotPorted("TotalStats", d);
    dn = dn + dn2;
  }
  return { dn, etc };
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
 * Only STR is ported. Outside a dungeon it is
 * floor(the TotalSTR bubble + talent 652 + Companion 8 + (1 + pct / 100) x (equipment + base + the flat sources)), @4174547.
 */
export const TotalStats = block("TotalStats", (ctx, d: string) => {
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
    default:
      throw new NotPorted("TotalStats", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { STR: true };
