// ===== DERIVED DAMAGE HELPERS =====
// What the max damage needs beyond its own sources, from the old port of
// corgan-source/js/stats/defs/damage.js. The max damage itself is the
// `damage` system (systems/damage/damage.ts: one source per N.js term,
// computeMaxDamage = dmgMax over them); this file keeps the shared inputs it
// reads: DamageDealtSTATtype, TotalStats("Weapon_Power"), PlayerSpeedBonus,
// the food-boost multiplier, the TalentCalc terms, the green-sigil and
// map-306 terms, and the accuracy (talent 125's gate, OverkillStuffs("3")).
// It must not import the damage system (damage.ts imports this file), nor
// coin.ts (coin → overkill → damage); FlurboShop comes from the coin/flurbo.ts
// leaf. The one path back is talent → its final-bonus wraps → calcTalent →
// overkill → damage, used only inside function bodies: nothing in that loop
// may call across it at module top level.
//
// ── [STUB] note ─────────────────────────────────────────────────────────
// One sub-source is still STUBBED to 0, flagged `[STUB]` inline: accuracy's
// RooBonuses(3). Its port (rooBonus) lives in coin.ts, which this file must
// not import (see above).

import type { ArkhNode } from "../../../node";
import type { SaveData } from "../../../state";
import { getLOG } from "../../../formulas";
import { ITEMS } from "../../data/game/items.js";
import {
  charClassData,
  optionsListData,
  cauldronInfoData,
  stampLvData,
  equipOrderData,
  equipQtyData,
  emmData,
  obolNamesData,
  obolMapsData,
  obolFamilyNames,
  obolFamilyMaps,
} from "../../../save/data";

import {
  computeCardBonusByType,
  computeBoxReward,
  computeTotalStat,
  computeMealBonus,
  computeFamBonusQTYs,
  computeGalleryBaseStat,
  computeStatueBonusGiven,
  computeEquipBaseStat,
  computeObolBaseStat,
  primaryStatForClass,
} from "./stats";
import { computeStarSignBonus as computeStarSignBonusTree } from "./starSign";

/** Scalar star-sign bonus (derived-damage only needs the number, not the
 *  tree). Delegates to the shared ./starSign helper — no local copy. */
export function computeStarSignBonus(key: string, ci: number, s: SaveData): number {
  return computeStarSignBonusTree(key, ci, s).val;
}
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { goldFoodBonuses } from "./goldenFood";
import { talent } from "./talent";
import { etcBonus } from "./etcBonus";
import { arcade } from "../w2/arcade";
import { companion } from "./companions";
import { guild } from "./guild";
import { sigil, bubbleValByKey, computeVialByKey, totalGreenSigils } from "../w2/alchemy";
import { getBribeBonus } from "../w3/bribe";
import { getSetBonus } from "../w3/setBonus";
import { menagerieObolMiscMulti } from "../../data/w7/menagerie";
import { computeSummUpgBonus, winBonus } from "../w6/summoning";
import { computeCardSetBonus, computeCardLv } from "./cards";
import { computePrayerReal } from "../w3/prayer";
import { computeChipBonus, gridBonusValue } from "../w4/lab";
import { capevineSystemOn, gallerySystemOn, premhatSystemOn } from "../w7/gallery";
import { flurboShop } from "../coin/flurbo";
import { divinityMinorFor } from "../coin/divinityMinor";
import { saltLick } from "../exp/saltLick";

// --------------------------------------------------------------------------
// Local helpers (mirror defs/helpers.js safe / rval), shared with the damage
// system so its sources keep the old 0-on-throw reads.
// --------------------------------------------------------------------------
type Ctx = { saveData: SaveData; charIdx: number; activeCharIdx?: number };

export function safe(fn: (...a: any[]) => any, ...args: any[]): number {
  try {
    const v = fn(...args);
    if (v == null || v !== v) return 0;
    if (typeof v === "object") {
      const n =
        v.val != null
          ? Number(v.val)
          : v.total != null
            ? Number(v.total)
            : v.computed != null
              ? Number(v.computed)
              : 0;
      return n || 0;
    }
    return Number(v) || 0;
  } catch {
    return 0;
  }
}

export function rval(
  resolver: { resolve: (id: any, ctx: any, args?: any) => ArkhNode },
  id: any,
  ctx: any,
  args?: any
): number {
  try {
    return resolver.resolve(id, ctx, args).val || 0;
  } catch {
    return 0;
  }
}

// GetTalentNumber itself. talent.resolve returns a wrapped talent's final
// bonus (its formula value × a counter, see talent-final-bonus-wraps.ts);
// the bare formula value is the wrapped node's "Talent Value" kid.
export function gtn(id: number, ctx: any, args?: any): number {
  try {
    const n = talent.resolve(id, ctx, args);
    const tv = n.children && n.children.find((k) => k.name === "Talent Value");
    return (tv ? tv.val : n.val) || 0;
  } catch {
    return 0;
  }
}

// [STUB] accuracy's RooBonuses(3): coin.ts rooBonus is the port, out of reach
// (coin → overkill → damage → this file).
function computeRooBonus(_idx: number, _s: SaveData): number {
  return 0;
}

/** N.js FoodBonuses("…BoostsEffectBonus") (@4104779): the effect multiplier of
 *  every boost food (Weapon Power, Base Damage, Move Speed…); 1 if a read throws. */
// @njs _customBlock_FoodBonuses
export function foodBoostMulti(ci: number, ctx: Ctx): number {
  const s = ctx.saveData;
  try {
    return (
      1 +
      (safe(computeBoxReward, ci, "PowerFoodEffect") +
        safe(computeStatueBonusGiven, 3, ci, s) +
        rval(etcBonus, "9", ctx) +
        safe(computeStampBonusOfTypeX, "BFood", s) +
        computeStarSignBonus("FoodEffect", ci, s) +
        safe(computeCardBonusByType, 48, ci, s) +
        safe(computeCardSetBonus, ci, "1") +
        rval(talent, 631, ctx)) /
        100
    );
  } catch {
    return 1;
  }
}

// ==========================================================================
// DamageDealtSTATtype and TotalStats("Weapon_Power"): the two inputs the
// `damage` system (systems/damage/damage.ts) reads in more than one source
// (statType / statWpFloor / statPow, wpSquared / statWpFloor). Moved unchanged
// out of the old inline computeMaxDamage.
// ==========================================================================

export type DamageStatType = {
  /** The class's primary stat (ClassStatTypes[class][0]) and its TotalStats. */
  stat: string;
  statVal: number;
  t95: number;
  t455: number;
  t20: number;
  /** Class-gated: the game zeros the other classes' bubbles. */
  W6: number;
  A6: number;
  M6: number;
  val: number;
};

/** N.js DamageDealtSTATtype = TotalStats(primary stat)
 *  × (1 + (GTN 95 + GTN 455 + GTN 20 + W6 + A6 + M6)/100). */
// @njs Max
export function damageStatType(ci: number, ctx: Ctx): DamageStatType {
  const s = ctx.saveData;
  const stat = primaryStatForClass(ci);
  const statVal = computeTotalStat(stat, ci, ctx).computed;
  const t95 = rval(talent, 95, ctx);
  const t455 = rval(talent, 455, ctx);
  const t20 = rval(talent, 20, ctx);
  let W6 = safe(bubbleValByKey, "W6", ci, s);
  let A6 = safe(bubbleValByKey, "A6", ci, s);
  let M6 = safe(bubbleValByKey, "M6", ci, s);
  // Game zeros class-mismatched bubbles (W6/A6/M6).
  const cls = Number(charClassData && (charClassData as any)[ci]) || 0;
  if (cls >= 6 && cls < 18) {
    A6 = 0;
    M6 = 0;
  } else if (cls >= 18 && cls < 30) {
    W6 = 0;
    M6 = 0;
  } else if (cls >= 30) {
    W6 = 0;
    A6 = 0;
  }
  const val = statVal * (1 + (t95 + t455 + t20 + W6 + A6 + M6) / 100);
  return { stat, statVal, t95, t455, t20, W6, A6, M6, val };
}

/** N.js TotalStats("Weapon_Power") — ported inline from damage.js; FlurboShop(0)
 *  is coin/flurbo.ts's port. 0 if any part throws, as before. */
// @njs _customBlock_TotalStats
export function computeWeaponPower(ci: number, ctx: Ctx): number {
  const s = ctx.saveData;
  let wpRaw = 0;
  try {
    const _eo = equipOrderData && (equipOrderData as any)[ci];
    let _equipWP = 0;
    const _em0 = emmData && (emmData as any)[ci] && (emmData as any)[ci][0];
    // Same skips as TotalStats' equipment scan: trophy/nametag (10/14) while
    // GalleryBonusSystemON, premium hat (slot 8) while PremHatBonusesSystemON,
    // worn cape (slot 12) while the Cape Vine is ON.
    const _galleryActive = gallerySystemOn(ci);
    const _hatOn = premhatSystemOn(ci);
    const _capeOn = capevineSystemOn(ci);
    if (_eo && _eo[0]) {
      for (let _si = 0; _si < 16; _si++) {
        if (_galleryActive && (_si === 10 || _si === 14)) continue;
        if (_hatOn && _si === 8) continue;
        if (_capeOn && _si === 12) continue;
        const _iname = _eo[0][_si];
        if (_iname && _iname !== "Blank") {
          _equipWP +=
            ((ITEMS as any)[_iname]
              ? Number((ITEMS as any)[_iname].Weapon_Power) || 0
              : 0) + (_em0 && _em0[_si] ? Number(_em0[_si].Weapon_Power) || 0 : 0);
        }
      }
    }
    // Gallery base WP
    let _galleryWP = 0;
    try {
      const _galResult = computeGalleryBaseStat(ci, ctx as any, "Weapon_Power");
      _galleryWP = _galResult && _galResult.val ? _galResult.val : 0;
    } catch {}
    // Obol base WP (skip skill-keyword obols + pickaxe/hatchet)
    let _obolWP = 0;
    try {
      const _skillSuffixes = [
        "Mining",
        "Choppin",
        "Fishing",
        "Catching",
        "Trapping",
        "Worship",
      ];
      const _isSkillObol = (name: string): boolean => {
        for (let _si2 = 0; _si2 < _skillSuffixes.length; _si2++) {
          if (name.indexOf(_skillSuffixes[_si2]) !== -1) return true;
        }
        const _it = (ITEMS as any)[name];
        if (_it && (_it.Type === "PICKAXE" || _it.Type === "HATCHET"))
          return true;
        return false;
      };
      const _pNames = obolNamesData && (obolNamesData as any)[ci];
      const _pMaps = obolMapsData && (obolMapsData as any)[ci];
      if (_pNames) {
        for (let _oi = 0; _oi < _pNames.length; _oi++) {
          const _on = _pNames[_oi];
          if (!_on || _on === "Blank" || _on === "Null") continue;
          if (_isSkillObol(_on)) continue;
          const _oItem = (ITEMS as any)[_on];
          const _oStat = _oItem ? Number(_oItem.Weapon_Power) || 0 : 0;
          const _oMap = _pMaps && _pMaps[_oi] ? Number(_pMaps[_oi].Weapon_Power) || 0 : 0;
          const _oSlot = _oStat + _oMap;
          if (_oSlot > 0) _obolWP += _oSlot;
        }
      }
      const _fNames = obolFamilyNames as any;
      const _fMaps = obolFamilyMaps as any;
      if (_fNames) {
        for (let _fi2 = 0; _fi2 < _fNames.length; _fi2++) {
          const _fn = _fNames[_fi2];
          if (!_fn || _fn === "Blank" || _fn === "Null") continue;
          if (_isSkillObol(_fn)) continue;
          const _fItem = (ITEMS as any)[_fn];
          const _fStat = _fItem ? Number(_fItem.Weapon_Power) || 0 : 0;
          const _fMap = _fMaps && _fMaps[_fi2] ? Number(_fMaps[_fi2].Weapon_Power) || 0 : 0;
          const _fSlot = _fStat + _fMap;
          if (_fSlot > 0) _obolWP += _fSlot;
        }
      }
    } catch {}
    // 2026-10-16: the obol sum of non-STR/AGI/WIS/LUK stats × ObolMISCmulti.
    _obolWP *= menagerieObolMiscMulti(s);
    // Flat adds: 5 + BoxRewards["12a"] + CardLv(w5b2) + CardBonus(18) + Sigil(17)
    const _box12a = safe(computeBoxReward, ci, "12a");
    const _cardLvW5b2 = safe(computeCardLv, "w5b2", s);
    const _cardBon18 = safe(computeCardBonusByType, 18, ci, s);
    const _sigil17 = rval(sigil, 17, ctx);
    // Pct scaling on equip WP: (1 + (chipWP + bubW1 + bubA1 + bubM1)/100)
    const _chipWP = safe(computeChipBonus, "weppow");
    let _bubW1 = safe(bubbleValByKey, "W1", ci, s);
    let _bubA1 = safe(bubbleValByKey, "A1", ci, s);
    let _bubM1 = safe(bubbleValByKey, "M1", ci, s);
    const _wpCls = Number(charClassData && (charClassData as any)[ci]) || 0;
    if (_wpCls < 7) {
      _bubW1 = 0;
      _bubA1 = 0;
    } else if (_wpCls < 18) {
      _bubA1 = 0;
      _bubM1 = 0;
    } else if (_wpCls < 30) {
      _bubW1 = 0;
      _bubM1 = 0;
    } else {
      _bubW1 = 0;
      _bubA1 = 0;
    }
    const _equipWPscaled =
      (_equipWP + _galleryWP + _obolWP) *
      (1 + (_chipWP + _bubW1 + _bubA1 + _bubM1) / 100);
    // Additive WP: vials + famBon16 + starSigns + arcade + skill talents
    const _vialWP = safe(computeVialByKey, "WeaponPOW", s);
    const _wpFam = computeFamBonusQTYs(ci, s);
    const _fam16 =
      _wpFam && typeof _wpFam === "object"
        ? Number((_wpFam as any)[16]) || 0
        : 0;
    const _starWP = computeStarSignBonus("WepPow", ci, s);
    const _arc17 = rval(arcade, 17, ctx);
    // Skill-based WP talents: bare GetTalentNumber × counter (N.js
    // TotalStats("Weapon_Power")), not the wrapped final bonus.
    const _lv0 = (s.lv0AllData as any) && (s.lv0AllData as any)[ci];
    const _t530 = gtn(530, ctx) * Math.floor((Number(_lv0 && _lv0[12]) || 0) / 10);
    const _t140 = gtn(140, ctx) * Math.floor((Number(_lv0 && _lv0[10]) || 0) / 10);
    const _t170 = gtn(170, ctx) * Math.floor((Number(_lv0 && _lv0[15]) || 0) / 10);
    const _t320 = gtn(320, ctx) * Math.floor((Number(_lv0 && _lv0[13]) || 0) / 10);
    const _t500 = gtn(500, ctx) * Math.floor((Number(_lv0 && _lv0[14]) || 0) / 10);
    const _petStored02 =
      Number((s.petsStoredData as any) && (s.petsStoredData as any)[0] && (s.petsStoredData as any)[0][2]) || 0;
    const _t365 = gtn(365, ctx) * getLOG(Math.max(1, _petStored02));
    // TalentCalc(616): min(GTN(1,616), floor(maxBeginnerLv / 10))
    let _tc616 = 0;
    try {
      let _maxBeginnerLv = 0;
      for (let _cidx = 0; _cidx < (charClassData as any || []).length; _cidx++) {
        const _cls = Number((charClassData as any)[_cidx]) || 0;
        if (_cls < 6) {
          const _charLv =
            Number((s.lv0AllData as any) && (s.lv0AllData as any)[_cidx] && (s.lv0AllData as any)[_cidx][0]) || 0;
          if (_charLv > _maxBeginnerLv) _maxBeginnerLv = _charLv;
        }
      }
      if (_maxBeginnerLv > 0) {
        const _t616val = rval(talent, 616, ctx);
        _tc616 = Math.min(_t616val, Math.floor(_maxBeginnerLv / 10));
      }
    } catch {}
    // TotalFoodBonuses("WeaponPowerBoosts")
    let _foodWP = 0;
    try {
      const _foodBag = equipOrderData && (equipOrderData as any)[ci] && (equipOrderData as any)[ci][2];
      const _foodQty = equipQtyData && (equipQtyData as any)[ci] && (equipQtyData as any)[ci][2];
      for (let _fi = 0; _fi < 16; _fi++) {
        const _fname = _foodBag && _foodBag[_fi];
        if (
          _fname &&
          _fname !== "Blank" &&
          (ITEMS as any)[_fname] &&
          (ITEMS as any)[_fname].Effect === "WeaponPowerBoosts"
        ) {
          const _fqty = Number((_foodQty && _foodQty[_fi]) || 0);
          if (_fqty > 0) _foodWP += Number((ITEMS as any)[_fname].Amount) || 0;
        }
      }
      if (_foodWP > 0) _foodWP *= foodBoostMulti(ci, ctx);
    } catch {}
    const _guild3 = rval(guild, 3, ctx);
    wpRaw =
      5 +
      _box12a +
      safe(flurboShop, 0, s) +
      _foodWP +
      _cardLvW5b2 +
      _cardBon18 +
      _sigil17 +
      _guild3 +
      _equipWPscaled +
      _tc616 +
      _vialWP +
      _fam16 +
      _starWP +
      _arc17 +
      _t530 +
      _t140 +
      _t170 +
      _t320 +
      _t500 +
      _t365;
  } catch {}
  return wpRaw;
}

/** N.js Max (2026-11-01): DamageDealtLIST[2] gains ×(1 + min(100,
 *  TotalGreenSigils · Grid_Bonus(127))/100), right after MeritocBonusz(5) —
 *  each Eclectic ("green") sigil gives Research Grid H6's damage, capped at 100%. */
// @njs Max
export function greenSigilDmgPct(s: SaveData): number {
  return Math.min(100, totalGreenSigils(s) * gridBonusValue(127, s));
}

/** N.js Max (2026-10-16): on The Clamworks (map 306) DamageDealtLIST[2] is
divided by 100^Menagerie[5][2]. The damage system's map306 source reads it;
overkill divides its map-less Max by it. */
export function mapDamageDivisor(map: number, s: SaveData): number {
  if (map !== 306) return 1;
  return Math.pow(100, Number((s.menagerieData as any)?.[5]?.[2]) || 0);
}

// --------------------------------------------------------------------------
// DamageDealed's TalentCalc terms (N.js offset ~4093000): TalentCalc(31) +
// TalentCalc(110) + GTN(1,125)·TalentCalc(125) + TalentCalc(485) +
// TalentCalc(305)/50 + TalentCalc(470)/10 + TalentCalc(656), where
// TalentCalc(id) = GTN(1,id) × CalcTalentMAP[id] (TalentCalc(125) is its
// counter alone). Exported so tests can pin each term.
// --------------------------------------------------------------------------
export function talentCalcTerms(ci: number, ctx: Ctx): Record<number, number> {
  // talent.resolve already returns 31/110/125/305/656 as GTN(1,id) × their
  // counter (the final-bonus wraps; 305's carries the /50), so no counter
  // goes on top here.
  const tc31 = rval(talent, 31, ctx); // GTN × floor(lowest skill LV / 5)
  const tc110 = rval(talent, 110, ctx); // GTN × min(maps over 100k kills, GTN(2,110))
  const tc125 = rval(talent, 125, ctx); // GTN × Σ Refinery ranks, accuracy-gated
  const tc305 = rval(talent, 305, ctx); // GTN × items ever found / 50
  const tc656 = rval(talent, 656, ctx); // GTN × dream clouds completed
  // 470/485 apply their own counter to the bare GTN: calcTalent.ts counts
  // the save envelope's "length" key for these.
  // TalentCalc(485): GTN(1,485) * count(vials with lv > 3)
  let _vialCount = 0;
  const _ci4 = cauldronInfoData && (cauldronInfoData as any)[4];
  if (_ci4) {
    if (Array.isArray(_ci4)) {
      for (let _vi = 0; _vi < _ci4.length; _vi++) if ((Number(_ci4[_vi]) || 0) > 3) _vialCount++;
    } else if (typeof _ci4 === "object") {
      for (const _vk in _ci4) {
        if (isNaN(Number(_vk))) continue;
        if ((Number(_ci4[_vk]) || 0) > 3) _vialCount++;
      }
    }
  }
  const tc485 = gtn(485, ctx) * _vialCount;
  // TalentCalc(470): GTN(1,470) * stampCount / 10
  let _stampCount = 0;
  if (stampLvData)
    for (let _sc = 0; _sc < 3; _sc++) {
      const _scat = (stampLvData as any)[_sc];
      if (!_scat) continue;
      if (Array.isArray(_scat)) {
        for (let _z = 0; _z < _scat.length; _z++) if ((Number(_scat[_z]) || 0) > 0.5) _stampCount++;
      } else {
        for (const _sk in _scat) {
          if (isNaN(Number(_sk))) continue;
          if ((Number(_scat[_sk]) || 0) > 0.5) _stampCount++;
        }
      }
    }
  const tc470 = (gtn(470, ctx) * _stampCount) / 10;
  return { 31: tc31, 110: tc110, 125: tc125, 485: tc485, 305: tc305, 470: tc470, 656: tc656 };
}

// --------------------------------------------------------------------------
// Player movement speed — ported inline from damage.js PlayerSpeedBonus.
// Normal mode only (dungeon caps skipped — always offline for save calc).
// Exported so Tal 290 (Speedna) can read the move-speed counter.
// --------------------------------------------------------------------------
export function computePlayerSpeed(ci: number, ctx: Ctx): number {
  const s = ctx.saveData;
  let playerSpeed = 1;
  try {
    // Food scan: MoveSpdBoosts
    let _spdFood = 0;
    const _spdFoodBag = equipOrderData && (equipOrderData as any)[ci] && (equipOrderData as any)[ci][2];
    const _spdFoodQty = equipQtyData && (equipQtyData as any)[ci] && (equipQtyData as any)[ci][2];
    for (let _sfi = 0; _sfi < 16; _sfi++) {
      const _sfname = _spdFoodBag && _spdFoodBag[_sfi];
      if (
        _sfname &&
        _sfname !== "Blank" &&
        (ITEMS as any)[_sfname] &&
        (ITEMS as any)[_sfname].Effect === "MoveSpdBoosts"
      ) {
        const _sfqty = Number((_spdFoodQty && _spdFoodQty[_sfi]) || 0);
        if (_sfqty > 0) _spdFood += (Number((ITEMS as any)[_sfname].Amount) || 0) * foodBoostMulti(ci, ctx);
      }
    }
    const _spdT266 = rval(talent, 266, ctx);
    const _spdStamp = safe(computeStampBonusOfTypeX, "PctMoveSpd", s);
    const _ola438 = Number((optionsListData as any)[438]) || 0;
    const _spdStatue1 = safe(computeStatueBonusGiven, 1, ci, s);
    const _spdStarMoveSpd = computeStarSignBonus("MoveSpd", ci, s);
    const _spdEtc1 = rval(etcBonus, "1", ctx);
    const _spdCard6 = safe(computeCardBonusByType, 6, ci, s);
    const _spdT77 = rval(talent, 77, ctx);
    const _agiVal2 = computeTotalStat("AGI", ci, ctx).computed;
    const _agiScale =
      _agiVal2 < 1000
        ? (Math.pow(_agiVal2 + 1, 0.4) - 1) / 40
        : ((_agiVal2 - 1000) / (_agiVal2 + 2500)) * 0.5 + 0.371;
    const _spdPctSum = _spdFood + _spdT266 + _spdStamp + _ola438;
    playerSpeed =
      (_spdPctSum + _spdStatue1 + _spdStarMoveSpd + _spdEtc1 + _spdCard6 + _spdT77) / 100 +
      _agiScale / 2.2 +
      1;
    if (playerSpeed <= 2) {
      const _saltLick7 = safe(saltLick, 7, s);
      const _chipMove = safe(computeChipBonus, "move");
      const _spdT641 = rval(talent, 641, ctx);
      const _sigil13 = rval(sigil, 13, ctx);
      if (playerSpeed > 1.75) {
        playerSpeed = Math.min(2, Math.floor(100 * (playerSpeed + _spdT641 / 100)) / 100);
      } else {
        playerSpeed = Math.min(
          1.75,
          Math.floor(100 * (playerSpeed + (_saltLick7 + _chipMove + _spdT641 + _sigil13) / 100)) / 100
        );
      }
    }
    playerSpeed = Math.floor(100 * playerSpeed) / 100;
  } catch {}
  return playerSpeed;
}

// ==========================================================================
// ACCURACY — port of corgan-source/js/stats/defs/accuracy.js (combine body),
// which itself ports N.js `_customBlock_PlayerAccTot`. Returns the char's
// total accuracy as a finite scalar (the descriptor tree is dropped — only
// the value is needed for the talent-125 >= gate).
//
// N.js shape (PlayerAccTot, confirmed at offset 4061816):
//   PlayerACCDN = TotalStats(secondaryStat)                          [Step 2]
//               × (1 + AlchBubbles.AccPct/100)
//               × (1 + Σpct/100)        // buff288, card17, starAccPct,
//                                        // buff124, statue14, arcade2,
//                                        // flurbo5, bribe21, comp23
//   if PlayerSpeedBonus() > 1.99: PlayerACCDN *= (1 + GTN(2,641)/100) [Step 3]
//   acc = (pow(PlayerACCDN/4, 1.4) + PlayerACCDN + TotalStats("Accuracy"))
//       × (1 + (PlayerACCDN + 2·CardSet(0,"4"))/200)                  [Step 4]
//       × max(.1, 1 + (prayer6 − prayer15 − prayer16)/100)
//       × (1 + (chipAcc + mealTotAcc + roo3 + voting3 + amarokSet)/100)
//       × (1 + DivinityMinor/100)
//
// ── Faithfulness / [STUB] notes ──────────────────────────────────────────
// Star-sign AccPct is faithful to corgan-source (its SIGN_BONUSES table has
// no AccPct key → contributes 0, matching computeStarSignBonus here). The
// following sub-sources are genuinely unported in this codebase and STUB to
// the neutral value (0 additive). Because accuracy only feeds a >= gate, a
// few missing additive % almost never flips the result:
//   getBuffBonus(288,2) / getBuffBonus(124,1)  — runtime buffs, never in
//       the raw save → 0 (same treatment as derived-damage GetBuffBonuses).
//   computeRooBonus(3)     — Roo (Poppy) upgrade 3   [STUB, local =0]
// All other sub-sources reuse already-ported systems: FlurboShop(5) from
// coin/flurbo.ts, Divinity("Bonus_Minor", this character, 0) from
// coin/divinityMinor.ts.
// ==========================================================================

/** ClassStatTypes secondary-stat lookup (N.js ClassStatTypes, offset
 *  14190631): class root 1→LUK, 6→WIS, 18→STR, 30→AGI. Beginner (cls 0)
 *  resolves through returnClasses(0)=[1] → LUK. */
function secondaryStatForClass(ci: number): string {
  const cls = Number((charClassData as any) && (charClassData as any)[ci]) || 0;
  if (cls < 6) return "LUK"; // beginner + journeyman family
  const root = 6 + 12 * Math.floor((cls - 6) / 12);
  if (root === 18) return "STR"; // archer → STR
  if (root === 30) return "AGI"; // mage → AGI
  return "WIS"; // warrior → WIS
}

/**
 * computeAccuracy(charIdx, ctx) → PlayerAccTot() for the char. `ctx.charIdx`
 * is the active char (matches N.js, which evaluates against the active
 * char's stats). Returns a finite scalar; never throws.
 */
export function computeAccuracy(charIdx: number, ctx: Ctx): number {
  const s = ctx.saveData;
  if (!s) return 0;
  const ci = charIdx ?? ctx.charIdx ?? 0;

  // ---- Step 1: TotalStats("Accuracy") = flat base accuracy ----
  let equipAcc = 0;
  try {
    equipAcc = computeEquipBaseStat(ci, "Accuracy", s).val || 0;
  } catch {}
  let galleryAcc = 0;
  try {
    galleryAcc = computeGalleryBaseStat(ci, ctx as any, "Accuracy").val || 0;
  } catch {}
  let obolAcc = 0;
  try {
    obolAcc = (computeObolBaseStat(ci, "Accuracy").val || 0) * menagerieObolMiscMulti(s);
  } catch {}
  const vialBaseACC = safe(computeVialByKey, "baseACC", s);
  const boxAcc = safe(computeBoxReward, ci, "acc");
  const cardBonus23 = safe(computeCardBonusByType, 23, ci, s);
  const etc28 = rval(etcBonus, "28", ctx);
  let gfBaseAcc = 0;
  try {
    const gf = goldFoodBonuses("BaseAcc", ci, undefined as any, s);
    gfBaseAcc = gf && typeof gf === "object" ? Number((gf as any).total) || 0 : Number(gf) || 0;
  } catch {}
  const stampBaseAcc = safe(computeStampBonusOfTypeX, "BaseAcc", s);
  const summVault4 = safe(computeSummUpgBonus, 4, s, ci);

  const totalStatsAcc =
    2 + vialBaseACC + boxAcc + cardBonus23 + etc28 + gfBaseAcc + stampBaseAcc +
    summVault4 + equipAcc + galleryAcc + obolAcc;

  // ---- Step 2: secondary stat scaled by AccPct + pct sum ----
  const secName = secondaryStatForClass(ci);
  let secondaryStat = 0;
  try {
    secondaryStat = computeTotalStat(secName, ci, ctx).computed || 0;
  } catch {}

  const accPct = safe(bubbleValByKey, "AccPct", ci, s);
  const cardBonus17 = safe(computeCardBonusByType, 17, ci, s);
  const statue14 = safe(computeStatueBonusGiven, 14, ci, s);
  const arcade2 = rval(arcade, 2, ctx);
  const flurbo5 = safe(flurboShop, 5, s);
  const bribe21 = safe(getBribeBonus, "21", s);
  const comp23 = rval(companion, 23, ctx);
  const starAccPct = computeStarSignBonus("AccPct", ci, s); // faithful-to-arkh =0
  const buff288 = 0; // [STUB] GetBuffBonuses(288,2) — runtime buff, not in save
  const buff124 = 0; // [STUB] GetBuffBonuses(124,1) — runtime buff, not in save

  const pctSum =
    cardBonus17 + starAccPct + statue14 + arcade2 + flurbo5 + bribe21 + comp23 +
    buff288 + buff124;

  let playerACCDN = secondaryStat * (1 + accPct / 100) * (1 + pctSum / 100);

  // ---- Step 3: speed→accuracy talent 641 conditional (GTN(2,641)) ----
  const playerSpeed = computePlayerSpeed(ci, ctx);
  const talent641 = rval(talent, 641, ctx, { tab: 2 });
  if (playerSpeed > 1.99 && talent641) {
    playerACCDN *= 1 + talent641 / 100;
  }

  // ---- Step 4: final formula ----
  const base = Math.pow(playerACCDN / 4, 1.4) + playerACCDN + totalStatsAcc;

  const cardSet4 = safe(computeCardSetBonus, ci, "4");
  const prayer6 = safe(computePrayerReal, 6, 0, ci, s);
  const prayer15pen = safe(computePrayerReal, 15, 1, ci, s);
  const prayer16pen = safe(computePrayerReal, 16, 1, ci, s);
  const chipAcc = safe(computeChipBonus, "acc");
  const mealTotAcc = safe(computeMealBonus, "TotAcc", s);
  const rooBonus3 = safe(computeRooBonus, 3, s); // [STUB] local =0
  const votingBonus3 = rval(winBonus, 3, ctx);
  const amarokSet = safe(getSetBonus, "AMAROK_SET");
  const divinityMinor = safe(divinityMinorFor, ci, 0, s);

  const prayerMult = Math.max(0.1, 1 + (prayer6 - prayer15pen - prayer16pen) / 100);
  const postMult1 = 1 + (playerACCDN + 2 * cardSet4) / 200;
  const postMult2 = 1 + (chipAcc + mealTotAcc + rooBonus3 + votingBonus3 + amarokSet) / 100;
  const postMult3 = 1 + divinityMinor / 100;

  let acc = base * postMult1 * prayerMult * postMult2 * postMult3;
  if (acc !== acc || acc == null) acc = 0;
  return acc;
}
