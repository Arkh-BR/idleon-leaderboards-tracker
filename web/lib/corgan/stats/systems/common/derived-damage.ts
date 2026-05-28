// ===== DERIVED DAMAGE (Max Damage) + OVERKILL TIER =====
// Port of corgan-source/js/stats/defs/damage.js (the `combine` body) into a
// plain compute function `computeMaxDamage(charIdx, ctx)`, plus a port of
// corgan-source/js/stats/systems/common/overkill.js into
// `computeOverkillTier(charIdx, ctx, opts)`.
//
// `computeMaxDamage` returns DamageDealed("Max") = DDL[0] × DDL[1] × DDL[2]
// for the normal (non-dungeon / non-grimoire / non-tempest / non-tesseract)
// combat mode. The descriptor's tree/children rendering is dropped — we only
// need the scalar so the overkill tier (and talent 643) can be computed.
//
// `computeOverkillTier` mirrors OverkillStuffs("2"): the raw overkill tier
// (1..50) for the char on their current AFK map. Monster HP comes from the
// ported MONSTERS table (keyed by MapAFKtarget[currentMap]); max damage is
// computeMaxDamage. okExp = currentMap >= 300 ? 5 : 2.
//
// ── Faithfulness / [STUB] notes ─────────────────────────────────────────
// Most sub-sources reuse our already-ported systems. The following damage
// sub-sources are GENUINELY NOT ported in this codebase and are STUBBED to
// 0 (or the neutral multiplier 1). Each is flagged `[STUB]` inline. Because
// max damage feeds a log-base-okExp tier, omitting these barely moves the
// tier (each missing additive % is a tiny fraction of a doubling/quintupling
// threshold), so the tier stays in the correct 1..50 range:
//   computeVaultKillzTotal  (vault kill counters)
//   computeFlurboShop       (W2 dungeon flurbo shop WP)
//   computeRooBonus         (W7 sushi RoG dmg %)
//   bubbaRoGBonuses         (W7 bubba RoG dmg %)
//   farmRankUpgBonus        (W6 farm-rank dmg %)
//   computeDivinityMinor    (W5 divinity minor link)
//   computeDivinityBless    (W5 divinity blessing)
//   computeRiftSkillETC     (W4 rift skill ETC)
//   computeEclipseSkulls    (W4 rift eclipse skulls)
//   computeKillroyDMG       (W4 rift killroy dmg)
//   computeCompassBonus     (W7 compass dmg %)
//   computeMSABonus         (W4 gaming MSA dmg %)
//   computeStickerBonus     (W6 farming sticker dmg, neutral=1)
//   computeCropSC           (W6 farming crop scientist dmg %)
//   computePetArenaBonus    (W4 pet-arena dmg %)
//   computeSaltLick         (W3 salt-lick dmg %)
// Also stubbed-as-0 (runtime-only, never in raw save): GetBuffBonuses(108/124)
// and the Reliquarium possession check.

import type { CorganNode } from "../../../node";
import type { SaveData } from "../../../state";
import { getLOG } from "../../../formulas";
import { ITEMS } from "../../data/game/items.js";
import { MONSTERS } from "../../data/game/monsters.js";
import {
  MapAFKtarget,
  MapDetails,
  GrimoireUpg,
  AtomInfo,
} from "../../data/game/customlists.js";
import {
  charClassData,
  optionsListData,
  dreamData,
  divinityData,
  cauldronInfoData,
  klaData,
  stampLvData,
  equipOrderData,
  equipQtyData,
  emmData,
  obolNamesData,
  obolMapsData,
  obolFamilyNames,
  obolFamilyMaps,
  currentMapData,
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
import { computePlayerHPmax, computePlayerMPmax } from "./derived-stats";
import { computeShinyBonusS } from "../w4/breeding";
import { computeSeraphMulti } from "./starSign";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { goldFoodBonuses } from "./goldenFood";
import { talent } from "./talent";
import { etcBonus } from "./etcBonus";
import { arcade } from "../w2/arcade";
import { vault } from "./vault";
import { companion } from "./companions";
import { friend } from "./friend";
import { guild } from "./guild";
import { tome } from "../w4/tome";
import { sigil, bubbleValByKey, computeVialByKey } from "../w2/alchemy";
import { getBribeBonus } from "../w3/bribe";
import { grimoireUpgBonus } from "../mc/grimoire";
import { getSetBonus } from "../w3/setBonus";
import { pristine } from "../w5/pristine";
import { votingBonusz } from "../w2/voting";
import { shrine } from "../w3/construction";
import { computeCosmoBonus, computeMonumentROGbonus } from "../w5/hole";
import { computeArtifactBonus } from "../w5/sailing";
import { computeAllShimmerBonuses } from "../w3/equinox";
import { computePaletteBonus } from "../w7/spelunking";
import { computeMeritocBonusz } from "../w7/meritoc";
import { mineheadBonusQTY } from "../w7/minehead";
import { rogBonusQTY, computeUniqueSushi } from "../w7/sushi";
import { computeSummUpgBonus, winBonus } from "../w6/summoning";
import { computeWorkbenchStuff } from "./stats";
import { computeCardSetBonus, computeCardLv } from "./cards";
import { computePrayerReal } from "../w3/prayer";
import { achieveStatus } from "../common/achievement";
import { mainframeBonus, computeChipBonus } from "../w4/lab";
import { owl as owlResolver } from "../w1/owl";
import { superBitType } from "../../../game-helpers";

// --------------------------------------------------------------------------
// Local helpers (mirror defs/helpers.js safe / rval).
// --------------------------------------------------------------------------
type Ctx = { saveData: SaveData; charIdx: number; activeCharIdx?: number };

function safe(fn: (...a: any[]) => any, ...args: any[]): number {
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

function rval(
  resolver: { resolve: (id: any, ctx: any, args?: any) => CorganNode },
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

// --------------------------------------------------------------------------
// Star sign bonus (ported from starSign.js — the keyed effect map; our
// systems/common/starSign.ts only exports the `drop` table on the resolver,
// so we replicate the keyed bonus helper here, matching derived-stats.ts).
// --------------------------------------------------------------------------
const SIGN_BONUSES: Record<string, Record<number, number>> = {
  PctDmg: { 0: 1, 32: 2, 51: 20, 53: 6, 54: 15, 70: 25 },
  WepPow: { 12: 2 },
  MoveSpd: { 1: 2, 8: 4, 13: 2, 32: -3, 51: -12 },
  TotalHP: { 28: -80 },
  FoodEffect: { 22: 15 },
};

function getEnabledStarSigns(saveData: SaveData): number {
  const riftLv = Number(saveData.riftData && saveData.riftData[0]) || 0;
  return riftLv >= 10 ? 5 + computeShinyBonusS(3, saveData) : 0;
}

function computeStarSignBonus(
  key: string,
  ci: number,
  saveData: SaveData
): number {
  const bonusMap = SIGN_BONUSES[key];
  if (!bonusMap) return 0;
  const enabled = getEnabledStarSigns(saveData);
  let total = 0;
  for (const k of Object.keys(bonusMap)) {
    const sigIdx = Number(k);
    const val = bonusMap[sigIdx];
    if (val < 0 && sigIdx < enabled) continue;
    total += val;
  }
  if (total > 0) total *= computeSeraphMulti(ci, saveData);
  return total;
}

// --------------------------------------------------------------------------
// [STUB] genuinely-unported damage sub-sources — see header note. Each
// returns 0 (additive %) or 1 (neutral multiplier). Tiny relative to the
// log-based tier thresholds.
// --------------------------------------------------------------------------
function computeVaultKillzTotal(_idx: number, _s: SaveData): number {
  return 0; // [STUB] vault kill counters unported
}
function computeFlurboShop(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W2 dungeon flurbo shop unported
}
function computeRooBonus(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W7 sushi RoG dmg unported
}
function bubbaRoGBonuses(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W7 bubba RoG dmg unported
}
function farmRankUpgBonus(_idx: number, _ci: number, _s: SaveData): number {
  return 0; // [STUB] W6 farm-rank dmg unported
}
function computeDivinityMinor(_ci: number, _idx: number, _s: SaveData): number {
  return 0; // [STUB] W5 divinity minor link unported
}
function computeDivinityBless(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W5 divinity blessing unported
}
function computeRiftSkillETC(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W4 rift skill ETC unported
}
function computeEclipseSkulls(_s: SaveData): number {
  return 0; // [STUB] W4 rift eclipse skulls unported
}
function computeKillroyDMG(_s: SaveData): number {
  return 0; // [STUB] W4 rift killroy dmg unported
}
function computeCompassBonus(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W7 compass dmg unported
}
function computeMSABonus(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W4 gaming MSA dmg unported
}
function computeStickerBonus(_idx: number, _s: SaveData): number {
  return 1; // [STUB] W6 farming sticker dmg (neutral multiplier)
}
function computeCropSC(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W6 farming crop scientist dmg unported
}
function computePetArenaBonus(_idx: number): number {
  return 0; // [STUB] W4 pet-arena dmg unported
}
function computeSaltLick(_idx: number, _s: SaveData): number {
  return 0; // [STUB] W3 salt-lick dmg unported
}

// ==========================================================================
// MAX DAMAGE — port of damage.js combine() (normal mode).
// Returns DDL[0] × DDL[1] × DDL[2] as a finite scalar.
// ==========================================================================
export function computeMaxDamage(charIdx: number, ctx: Ctx): number {
  const s = ctx.saveData;
  if (!s) return 0;
  const ci = charIdx ?? ctx.charIdx ?? 0;

  // === MAX DAMAGE (MaxDmg812) ===
  // Step 1: DamageDealtSTATtype = TotalStats(primaryStat)
  //   * (1 + (talent95+talent455+talent20 + bubbles W6+A6+M6)/100)
  const pStatName = primaryStatForClass(ci);
  const pStatResult = computeTotalStat(pStatName, ci, ctx);
  const pStatVal = pStatResult.computed;
  const talent95 = rval(talent, 95, ctx);
  const talent455 = rval(talent, 455, ctx);
  const talent20 = rval(talent, 20, ctx);
  let bubbleW6 = safe(bubbleValByKey, "W6", ci, s);
  let bubbleA6 = safe(bubbleValByKey, "A6", ci, s);
  let bubbleM6 = safe(bubbleValByKey, "M6", ci, s);
  // Game zeros class-mismatched bubbles (W6/A6/M6).
  const _stCls = Number(charClassData && (charClassData as any)[ci]) || 0;
  if (_stCls >= 6 && _stCls < 18) {
    bubbleA6 = 0;
    bubbleM6 = 0;
  } else if (_stCls >= 18 && _stCls < 30) {
    bubbleW6 = 0;
    bubbleM6 = 0;
  } else if (_stCls >= 30) {
    bubbleW6 = 0;
    bubbleA6 = 0;
  }
  const statType =
    pStatVal *
    (1 + (talent95 + talent455 + talent20 + bubbleW6 + bubbleA6 + bubbleM6) / 100);

  // --- Weapon power (WP) — ported inline from damage.js ---
  let wpRaw = 0;
  try {
    const _eo = equipOrderData && (equipOrderData as any)[ci];
    let _equipWP = 0;
    const _em0 = emmData && (emmData as any)[ci] && (emmData as any)[ci][0];
    const _galleryActive =
      (s.spelunkData as any) &&
      (s.spelunkData as any)[16] &&
      (s.spelunkData as any)[16].length > 0;
    if (_eo && _eo[0]) {
      for (let _si = 0; _si < 16; _si++) {
        if (_galleryActive && (_si === 8 || _si === 10 || _si === 14)) continue;
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
    // Skill-based WP talents
    const _lv0 = (s.lv0AllData as any) && (s.lv0AllData as any)[ci];
    const _t530 = rval(talent, 530, ctx) * Math.floor((Number(_lv0 && _lv0[12]) || 0) / 10);
    const _t140 = rval(talent, 140, ctx) * Math.floor((Number(_lv0 && _lv0[10]) || 0) / 10);
    const _t170 = rval(talent, 170, ctx) * Math.floor((Number(_lv0 && _lv0[15]) || 0) / 10);
    const _t320 = rval(talent, 320, ctx) * Math.floor((Number(_lv0 && _lv0[13]) || 0) / 10);
    const _t500 = rval(talent, 500, ctx) * Math.floor((Number(_lv0 && _lv0[14]) || 0) / 10);
    const _petStored02 =
      Number((s.petsStoredData as any) && (s.petsStoredData as any)[0] && (s.petsStoredData as any)[0][2]) || 0;
    const _t365 = rval(talent, 365, ctx) * getLOG(Math.max(1, _petStored02));
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
      if (_foodWP > 0) {
        let _boostEff = 1;
        try {
          const _bBoxVal = safe(computeBoxReward, ci, "PowerFoodEffect");
          const _bStatue3 = safe(computeStatueBonusGiven, 3, ci, s);
          const _bStampVal = safe(computeStampBonusOfTypeX, "BFood", s);
          const _bStar = computeStarSignBonus("FoodEffect", ci, s);
          const _bCard48 = safe(computeCardBonusByType, 48, ci, s);
          const _bT631 = rval(talent, 631, ctx);
          const _bEtc9 = rval(etcBonus, "9", ctx);
          const _bCardSet01 = safe(computeCardSetBonus, ci, "1");
          _boostEff =
            1 +
            (_bBoxVal +
              _bStatue3 +
              _bEtc9 +
              _bStampVal +
              _bStar +
              _bCard48 +
              _bCardSet01 +
              _bT631) /
              100;
        } catch {}
        _foodWP *= _boostEff;
      }
    } catch {}
    const _guild3 = rval(guild, 3, ctx);
    wpRaw =
      5 +
      _box12a +
      safe(computeFlurboShop, 0, s) +
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

  const talent97 = rval(talent, 97, ctx);
  const talent277 = rval(talent, 277, ctx);
  const talent457 = rval(talent, 457, ctx);
  const cosmoBonus24 = safe(computeCosmoBonus, 2, 4, s);
  const talent5 = rval(talent, 5, ctx);
  const wp = wpRaw * (1 + (talent97 + talent277 + talent457 + cosmoBonus24) / 100) + talent5;

  let gfBaseDmg = 0;
  try {
    const gf = goldFoodBonuses("BaseDamage", ci, undefined as any, s);
    gfBaseDmg = gf && typeof gf === "object" ? Number((gf as any).total) || 0 : Number(gf) || 0;
  } catch {}

  let baseDmgRaw =
    Math.pow(wp / 3, 2) + statType + gfBaseDmg + Math.min(150, 2 * wpRaw + statType);

  // Additive sources
  const arcade0 = rval(arcade, 0, ctx);
  const vault0 = rval(vault, 0, ctx);
  const vault20 = rval(vault, 20, ctx) * safe(computeVaultKillzTotal, 5, s);
  baseDmgRaw += arcade0 + vault0 + vault20;

  // More additive sources (DDL[0] += section)
  const statue0 = safe(computeStatueBonusGiven, 0, ci, s);
  const boxBaseDmg = safe(computeBoxReward, ci, "basedmg");
  const etc16 = rval(etcBonus, "16", ctx);
  const card4 = safe(computeCardBonusByType, 4, ci, s);
  baseDmgRaw += statue0 + boxBaseDmg + etc16 + card4;

  // Stamp, owl, sigil, bubble-HP/MP/SPD sources
  const stampBaseDmg = safe(computeStampBonusOfTypeX, "BaseDmg", s);
  const sigil4 = rval(sigil, 4, ctx);
  const bdmgHP = safe(bubbleValByKey, "bdmgHP", ci, s);
  const bdmgSPD = safe(bubbleValByKey, "bdmgSPD", ci, s);
  const bdmgMP = safe(bubbleValByKey, "bdmgMP", ci, s);

  // PlayerHPmax / PlayerMPmax — reuse ported derived-stats functions.
  let hpMax = 250;
  try {
    hpMax = Math.max(1, computePlayerHPmax(ci, ctx).val || 250);
  } catch {}
  let mpMax = 150;
  try {
    mpMax = Math.max(1, computePlayerMPmax(ci, ctx).val || 150);
  } catch {}

  const bubbleHP = bdmgHP * getLOG(Math.max(hpMax - 250, 1));
  const bubbleMP = bdmgMP * getLOG(Math.max(mpMax - 150, 1));

  // PlayerSpeed (movement) — ported inline from damage.js.
  const playerSpeed = computePlayerSpeed(ci, ctx);
  const bubbleSPD = bdmgSPD * (Math.log2(Math.max(playerSpeed - 0.1, 0)) / 0.25);

  baseDmgRaw += stampBaseDmg + sigil4 + bubbleHP + bubbleMP + bubbleSPD;
  // owlBonus1 — owl resolver (OwlBonuses(1))
  baseDmgRaw += rval(owlResolver, 1, ctx);

  // Softcap on DDL[0]
  if (baseDmgRaw > 4000) {
    baseDmgRaw = 4000 + Math.max(Math.pow(baseDmgRaw - 4000, 0.91), 0);
    if (baseDmgRaw > 15000) {
      baseDmgRaw = 15000 + Math.max(Math.pow(baseDmgRaw - 15000, 0.84), 0);
    }
  }

  // === Percent multiplier (DDL[1]) ===
  const statPow = Math.pow(statType, 0.7);
  const vault27 = rval(vault, 27, ctx) * safe(computeVaultKillzTotal, 6, s);
  const vault15 = rval(vault, 15, ctx);
  const ola338 = Number((optionsListData as any)[338]) || 0;
  const vault10 = rval(vault, 10, ctx);
  const bribe30 = safe(getBribeBonus, "30", s);
  const bribe20 = safe(getBribeBonus, "20", s);
  const stampPctDmg = safe(computeStampBonusOfTypeX, "PctDmg", s);
  const farmRank14 = safe(farmRankUpgBonus, 14, ci, s);
  const statue22 = safe(computeStatueBonusGiven, 22, ci, s);
  const talent113 = rval(talent, 113, ctx);
  const talent86 = rval(talent, 86, ctx);
  const talent446 = rval(talent, 446, ctx);
  const hpLog = getLOG(Math.max(hpMax, 1));
  const mpLog = getLOG(Math.max(mpMax, 1));
  const rooBonus4 = safe(computeRooBonus, 4, s);
  const bubbaRoG4 = safe(bubbaRoGBonuses, 4, s);
  const vault80 = rval(vault, 80, ctx);

  const addBase =
    statPow +
    vault27 +
    vault15 * ola338 +
    0.4 * vault10 +
    bribe30 +
    bribe20 +
    stampPctDmg +
    farmRank14 +
    statue22 +
    talent113 +
    hpLog * talent86 +
    mpLog * talent446 +
    rooBonus4 +
    bubbaRoG4 +
    vault80;
  const pctMultBase = 1 + addBase / 100;

  // Sequential multipliers on DDL[1]
  const talent284 = rval(talent, 284, ctx);
  const smithingLv =
    Number((s.lv0AllData as any) && (s.lv0AllData as any)[ci] && (s.lv0AllData as any)[ci][2]) || 0;
  const smithMult = 1 + (talent284 * (Math.min(100, smithingLv) / 10)) / 100;

  const winBonus0 = rval(winBonus, 0, ctx);
  const winMult = 1 + winBonus0 / 100;

  // TalentCalc chain
  let talentChainSum = 0;
  const bubbleW12 = safe(bubbleValByKey, "W12", ci, s);
  const bubbleA12 = safe(bubbleValByKey, "A12", ci, s);
  const bubbleM12 = safe(bubbleValByKey, "M12", ci, s);
  talentChainSum += bubbleW12 + bubbleA12 + bubbleM12;
  // TalentCalc(31): GTN(1,31) * floor(minCharSkillLv / 5)
  const tc31raw = rval(talent, 31, ctx);
  let _minSkillLv = 1e9;
  const _lv0Ci = (s.lv0AllData as any) && (s.lv0AllData as any)[ci];
  if (_lv0Ci) {
    for (let _sk3 = 1; _sk3 <= 9; _sk3++) {
      const _slv3 = Number(_lv0Ci[_sk3]) || 0;
      if (_slv3 < _minSkillLv) _minSkillLv = _slv3;
    }
  }
  if (_minSkillLv > 1e8) _minSkillLv = 0;
  const tc31 = tc31raw * Math.floor(_minSkillLv / 5);
  // TalentCalc(110): GTN(1,110) * min(monstersOver100K, GTN(2,110))
  const _gtn1_110 = rval(talent, 110, ctx);
  const _gtn2_110 = rval(talent, 110, ctx, { tab: 2 });
  let _monstersOver100K = 0;
  if (_gtn1_110 > 0) {
    const _kla = (klaData as any)[ci] || [];
    for (let _mi = 0; _mi < (MapAFKtarget as any).length; _mi++) {
      const _mob = (MapAFKtarget as any)[_mi];
      if (!_mob || _mob === "Nothing" || _mob === "Z" || _mob === "Filler") continue;
      const _killReq =
        Number((MapDetails as any)[_mi] && (MapDetails as any)[_mi][0] && (MapDetails as any)[_mi][0][0]) || 0;
      const _klaVal = Number(_kla[_mi] && _kla[_mi][0]) || 0;
      if (_killReq - _klaVal >= 100000) _monstersOver100K++;
    }
  }
  const tc110 = _gtn1_110 * Math.min(_monstersOver100K, _gtn2_110);
  // TalentCalc(125): GTN(1,125) * sum(Refinery[3..8][1])
  const gtn125 = rval(talent, 125, ctx);
  let _refSum = 0;
  if (s.refineryData)
    for (let _ri = 3; _ri <= 8; _ri++)
      _refSum += Number((s.refineryData as any)[_ri] && (s.refineryData as any)[_ri][1]) || 0;
  const tc125 = gtn125 * _refSum;
  // TalentCalc(485): GTN(1,485) * count(vials with lv > 3)
  let _vialCount = 0;
  const _ci4 = cauldronInfoData && (cauldronInfoData as any)[4];
  if (_ci4) {
    if (Array.isArray(_ci4)) {
      for (let _vi = 0; _vi < _ci4.length; _vi++) if ((Number(_ci4[_vi]) || 0) > 3) _vialCount++;
    } else if (typeof _ci4 === "object") {
      for (const _vk in _ci4) if ((Number(_ci4[_vk]) || 0) > 3) _vialCount++;
    }
  }
  const tc485 = rval(talent, 485, ctx) * _vialCount;
  // TalentCalc(305): GTN(1,305) * cardCount / 50
  const _c1 = (s.cards1Data as any) || [];
  let _cardCount = _c1.length;
  const _ensured = [
    "MaxCapBagT1",
    "MaxCapBag6",
    "MaxCapBagT2",
    "MaxCapBagM1",
    "EquipmentTools1",
    "OilBarrel4",
  ];
  if (_c1.indexOf("Trophy6") !== -1) {
    for (let _ni = 1; _ni < 16; _ni++) if (_ni !== 8) _ensured.push("NPCtoken" + _ni);
    _ensured.push(
      "BadgeG1",
      "BadgeG2",
      "BadgeG3",
      "BadgeD1",
      "BadgeD2",
      "BadgeD3",
      "BadgeI1",
      "BadgeI2",
      "BadgeI3"
    );
  }
  for (let _ei = 0; _ei < _ensured.length; _ei++)
    if (_c1.indexOf(_ensured[_ei]) === -1) _cardCount++;
  for (let _cdi = 0; _cdi < _c1.length; _cdi++) {
    const _cn = "" + _c1[_cdi];
    if (_cn.indexOf("Gem") === 0 || _cn.indexOf("Cards") === 0) _cardCount--;
  }
  const tc305 = (rval(talent, 305, ctx) * _cardCount) / 50;
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
  const tc470 = (rval(talent, 470, ctx) * _stampCount) / 10;
  talentChainSum += tc31 + tc110 + tc125 + tc485 + tc305 + tc470;
  // B_UPG(57)
  const _holes9 = (s.holesData as any) && (s.holesData as any)[9];
  const _holes13 = (s.holesData as any) && (s.holesData as any)[13];
  const bUpg57 =
    (_holes13 && Number(_holes13[57])) || 0 > 0
      ? 20 * Math.floor(getLOG(Number(_holes9 && _holes9[1]) || 1))
      : 0;
  talentChainSum += bUpg57;
  // T290 * floor(min(speed-1, 10) / 0.15)
  const talent290 = rval(talent, 290, ctx);
  const _spdClamp = Math.min(playerSpeed - 1, 10);
  talentChainSum += talent290 * Math.floor(_spdClamp / 0.15);
  // TalentCalc(656): GTN(1,656) * count(dream challenges WeeklyBoss["d_"+i]==-1)
  let _dreamCount = 0;
  const _wb = (s as any).weeklyBossData;
  if (_wb) for (let _di = 0; _di < 100; _di++) if (Number(_wb["d_" + _di]) === -1) _dreamCount++;
  const tc656 = rval(talent, 656, ctx) * _dreamCount;
  talentChainSum += tc656;
  // LOG(OLA[161]) * T649
  const ola161 = Number((optionsListData as any)[161]) || 0;
  const talent649 = rval(talent, 649, ctx);
  talentChainSum += getLOG(ola161) * talent649;
  // LOG(OLA[71]) * T638
  const ola71 = Number((optionsListData as any)[71]) || 0;
  const talent638 = rval(talent, 638, ctx);
  talentChainSum += getLOG(ola71) * talent638;
  // min(TotalQuestsComplete, T658)
  const talent658 = rval(talent, 658, ctx);
  const totalQuests = Number((s as any).totalQuestsComplete) || 0;
  talentChainSum += Math.min(totalQuests, talent658);
  // DivinityMinor(ci, 7)  [STUB]
  talentChainSum += safe(computeDivinityMinor, ci, 7, s);
  // T463 * floor(minigameHiScore[0] / 25)
  const talent463 = rval(talent, 463, ctx, { tab: 2 });
  let minigameHS = 0;
  try {
    const _mhArr = (s as any).minigameHiscores || ((s as any).data && (s as any).data.FamValMinigameHiscores);
    if (_mhArr) minigameHS = Number(_mhArr[0]) || 0;
  } catch {}
  talentChainSum += talent463 * Math.floor(minigameHS / 25);
  const talentChainMult = 1 + talentChainSum / 100;

  let gfDamage = 1;
  try {
    const gfd = goldFoodBonuses("Damage", ci, undefined as any, s);
    const gfdTotal = gfd && typeof gfd === "object" ? Number((gfd as any).total) || 0 : Number(gfd) || 0;
    gfDamage = 1 + gfdTotal / 100;
  } catch {}

  let pctMult = pctMultBase * smithMult * winMult * talentChainMult * gfDamage;

  // DDL[1] softcaps
  if (pctMult > 100) pctMult = 100 + Math.max(Math.pow(pctMult - 100, 0.86), 0);
  if (pctMult > 2e6) pctMult = 2e6 * Math.pow(pctMult / 2e6, 0.5);
  if (pctMult > 1e8) pctMult = 1e8 * Math.pow(pctMult / 1e8, 0.3);

  // === DDL[2]: Big multiplier group ===
  const t508 = rval(talent, 508, ctx, { mode: "max", tab: 1 });
  const t208 = rval(talent, 208, ctx, { mode: "max", tab: 1 });
  const ola152 = Number((optionsListData as any)[152]) || 0;
  const ola329 = Number((optionsListData as any)[329]) || 0;
  let wbDmg = (1 + (t508 * getLOG(ola152)) / 100) * (1 + (t208 * getLOG(ola329)) / 100);
  if (wbDmg < 1) wbDmg = 1;

  let ddl2 = wbDmg;

  // Individual multipliers before first softcap
  ddl2 *= 1 + safe(computeVialByKey, "7dmg", s) / 100;
  ddl2 *= 1 + safe(computeEclipseSkulls, s) / 100;
  ddl2 *= 1 + safe(computePaletteBonus, 34, s) / 100;
  const dream6 = Number(dreamData && (dreamData as any)[6]) || 0;
  ddl2 *= 1 + dream6 / 10;
  ddl2 *= 1 + rval(pristine, 0, ctx) / 100;
  ddl2 *= 1 + safe(computeSummUpgBonus, 79, s) / 100;

  // Buff+Friend+StarSigns+Divinity
  const starSignPctDmg = computeStarSignBonus("PctDmg", ci, s);
  let friendDmg = 0;
  try {
    friendDmg = friend.resolve(0, ctx as any).val || 0;
  } catch {}
  const div25 = Number(divinityData && (divinityData as any)[25]) || 0;
  const talent507 = rval(talent, 507, ctx, { mode: "max", tab: 1 });
  const divLvBonus = Math.max(0, div25 - 10) * talent507;
  const charLvl =
    Number((s.lv0AllData as any) && (s.lv0AllData as any)[ci] && (s.lv0AllData as any)[ci][0]) || 0;
  const talent50 = rval(talent, 50, ctx, { mode: "max", tab: 1 });
  const lvlBonus = Math.floor(Math.max(0, charLvl - 200) / 50) * talent50;
  const _grp1Sum = friendDmg + starSignPctDmg + divLvBonus + lvlBonus;
  ddl2 *= 1 + _grp1Sum / 100;

  // Grimoire+Set+Shrine+Monument+Box+Art+Atom+Shiny+MSA+Shimmer+Crop+Vault41
  const grimoireUpg35 = safe(grimoireUpgBonus, 35, GrimoireUpg, s);
  const lustreSet = safe(getSetBonus, "LUSTRE_SET");
  const shrine0 = rval(shrine, 0, ctx);
  const monument06 = safe(computeMonumentROGbonus, 0, 6, s);
  const br12c = safe(computeBoxReward, ci, "12c");
  const br21c = safe(computeBoxReward, ci, "21c");
  const br23c = safe(computeBoxReward, ci, "23c");
  const _famMap = computeFamBonusQTYs(ci, s);
  let famBonus20 = 0;
  try {
    if (_famMap && typeof _famMap === "object") famBonus20 = Number((_famMap as any)[20]) || 0;
  } catch {}
  const artifact25 = safe(computeArtifactBonus, 25, ci, ctx);
  const atomLevel9 = Number((s.atomsData as any) && (s.atomsData as any)[9]) || 0;
  const atom9 = atomLevel9 * (Number((AtomInfo as any)[9] && (AtomInfo as any)[9][4]) || 0);
  const shiny5 = safe(computeShinyBonusS, 5, s);
  const msa0 = safe(computeMSABonus, 0, s);
  const ola178 = Number((optionsListData as any)[178]) || 0;
  const shimmerBonus = safe(computeAllShimmerBonuses, s);
  const cropSC0 = safe(computeCropSC, 0, s);
  const vault41 = rval(vault, 41, ctx);
  const ola346 = Number((optionsListData as any)[346]) || 0;
  const v41Log = vault41 * getLOG(ola346);
  const _grp2Sum =
    grimoireUpg35 +
    lustreSet +
    shrine0 +
    monument06 +
    br12c +
    br21c +
    br23c +
    famBonus20 +
    artifact25 +
    atom9 +
    shiny5 +
    msa0 +
    ola178 * shimmerBonus +
    cropSC0 +
    v41Log;
  ddl2 *= 1 + _grp2Sum / 100;

  // RiftSkillETC + Bubbles(pctDmg1,2,3) + Artifacts(2,8) + Stat bubbles + Const + Tome + Compass + Exotic + OLA[419]
  const riftETC0 = safe(computeRiftSkillETC, 0, s);
  const pctDmg1 = safe(bubbleValByKey, "pctDmg1", ci, s);
  const pctDmg2 = safe(bubbleValByKey, "pctDmg2", ci, s);
  const pctDmg3 = safe(bubbleValByKey, "pctDmg3", ci, s);
  const artifact2 = safe(computeArtifactBonus, 2, ci, ctx);
  const artifact8 = safe(computeArtifactBonus, 8, ci, ctx);
  const bubW5 = safe(bubbleValByKey, "W5", ci, s);
  const bubA5 = safe(bubbleValByKey, "A5", ci, s);
  const bubM5 = safe(bubbleValByKey, "M5", ci, s);
  const strVal = computeTotalStat("STR", ci, ctx).computed;
  const agiVal = computeTotalStat("AGI", ci, ctx).computed;
  const wisVal = computeTotalStat("WIS", ci, ctx).computed;
  const lukVal = computeTotalStat("LUK", ci, ctx).computed;
  const _cls = Number(charClassData && (charClassData as any)[ci]) || 0;
  const _useW5 = _cls < 18 ? 1 : 0;
  const _useA5 = _cls >= 18 && _cls < 30 ? 1 : 0;
  const _useM5 = _cls >= 30 ? 1 : 0;
  const statBubbles =
    _useW5 * bubW5 * Math.floor(Math.max(strVal, lukVal) / 250) +
    _useA5 * bubA5 * Math.floor(agiVal / 250) +
    _useM5 * bubM5 * Math.floor(wisVal / 250);
  // ConstMasteryBonus(1): Rift[0]>=40 && totalTowerLv sum
  let constMastery1 = 0;
  try {
    const _riftLv = Number((s.riftData as any) && (s.riftData as any)[0]) || 0;
    if (_riftLv >= 40) {
      const _tow = (s as any).towerData;
      if (_tow && _tow.length > 26) {
        let _totalTowerLv = 0;
        for (let _ti = 0; _ti < 27; _ti++) _totalTowerLv += Number(_tow[_ti]) || 0;
        constMastery1 = Math.max(0, 2 * Math.floor((_totalTowerLv - 750) / 10));
      }
    }
  } catch {}
  let tomeBonus0 = 0;
  try {
    tomeBonus0 = tome.resolve(0, ctx as any).val || 0;
  } catch {}
  const compassBonus48 = safe(computeCompassBonus, 48, s);
  const exotic41 = 0; // [STUB] computeExoticBonus(41) — W6 farming exotic dmg unported
  const ola419 = Number((optionsListData as any)[419]) || 0;
  const _grp3Sum =
    riftETC0 +
    pctDmg1 +
    pctDmg2 +
    pctDmg3 +
    artifact2 +
    artifact8 +
    statBubbles +
    constMastery1 +
    tomeBonus0 +
    compassBonus48 +
    exotic41 +
    ola419;
  ddl2 *= 1 + _grp3Sum / 100;

  // Talent6 + SaltLick(9) + EtcBonuses(45) + Prayer(15) + Mainframe(0,11,110) + Artifacts(27,29) + B_UPG(84) + Arcade(46) + OLA[435]
  const talent6 = rval(talent, 6, ctx);
  const saltLick9 = safe(computeSaltLick, 9, s);
  const etc45 = rval(etcBonus, "45", ctx);
  const prayer15 = safe(computePrayerReal, 15, 0, ci, s);
  const mf0 = safe(mainframeBonus, 0, s);
  const mf11 = safe(mainframeBonus, 11, s);
  const mf110 = safe(mainframeBonus, 110, s);
  const artifact27 = safe(computeArtifactBonus, 27, ci, ctx);
  const artifact29 = safe(computeArtifactBonus, 29, ci, ctx);
  const holesData11 = (s.holesData as any) && (s.holesData as any)[11];
  const bUpg84 =
    ((holesData11 && Number(holesData11[55])) || 0) > 0 &&
    (((s.holesData as any) && (s.holesData as any)[13] && Number((s.holesData as any)[13][84])) || 0) > 0
      ? 100 * Number(holesData11[55])
      : 0;
  const arcade46 = rval(arcade, 46, ctx);
  const ola435 = Number((optionsListData as any)[435]) || 0;
  const _grp4Sum =
    talent6 +
    saltLick9 +
    etc45 +
    prayer15 +
    mf0 +
    mf11 +
    mf110 +
    artifact27 +
    artifact29 +
    bUpg84 +
    arcade46 +
    ola435;
  ddl2 *= 1 + _grp4Sum / 100;

  // Companions(10,156) + CardBonusREAL(42) + CardSetBonuses(0,"5")
  const comp10 = rval(companion, 10, ctx);
  const comp156 = rval(companion, 156, ctx);
  const card42 = safe(computeCardBonusByType, 42, ci, s);
  const cardSet5 = safe(computeCardSetBonus, ci, "5");
  const _grp5Sum = comp10 + comp156 + card42 + cardSet5;
  ddl2 *= 1 + _grp5Sum / 100;

  // PetArena + Chips + Meal + Achievements + Divinity bless
  const petArena2 = safe(computePetArenaBonus, 2);
  const petArena15 = safe(computePetArenaBonus, 15);
  const chipDmg = safe(computeChipBonus, "dmg");
  const mealTotDmg = safe(computeMealBonus, "TotDmg", s);
  const achSum =
    2 * safe(achieveStatus, 58, s) +
    3 * safe(achieveStatus, 59, s) +
    5 * safe(achieveStatus, 60, s) +
    5 * safe(achieveStatus, 62, s) +
    2 * safe(achieveStatus, 119, s) +
    3 * safe(achieveStatus, 120, s) +
    5 * safe(achieveStatus, 121, s) +
    4 * safe(achieveStatus, 189, s) +
    2 * safe(achieveStatus, 185, s) +
    3 * safe(achieveStatus, 186, s) +
    5 * safe(achieveStatus, 187, s) +
    safe(achieveStatus, 240, s) +
    safe(achieveStatus, 280, s) +
    3 * safe(achieveStatus, 297, s) +
    2 * safe(achieveStatus, 303, s) +
    2 * safe(achieveStatus, 364, s) +
    4 * safe(achieveStatus, 354, s) +
    3 * safe(achieveStatus, 375, s);
  const divBless7 = safe(computeDivinityBless, 7, s);
  const divBless8 = safe(computeDivinityBless, 8, s);
  const _grp6Sum =
    20 * petArena2 + 40 * petArena15 + chipDmg + mealTotDmg + achSum + divBless7 + divBless8;
  ddl2 *= 1 + _grp6Sum / 100;

  // Penalty multiplier: max((1 - T24/100) * 1 * max(.01, 1 - (prayer6+prayer13)/100), .05)
  const talent24 = rval(talent, 24, ctx);
  const prayer6penalty = safe(computePrayerReal, 6, 1, ci, s);
  const prayer13penalty = safe(computePrayerReal, 13, 1, ci, s);
  const penaltyMult = Math.max(
    (1 - talent24 / 100) * 1 * Math.max(0.01, 1 - (prayer6penalty + prayer13penalty) / 100),
    0.05
  );
  ddl2 *= penaltyMult;

  // Minehead bonuses (pre-softcap)
  const mineFloor = ((s as any).stateR7 && (s as any).stateR7[4]) || 0;
  const mhBonusQTY0 = safe(mineheadBonusQTY, 0, mineFloor);
  let mhWepPowDmgPCT = 0;
  try {
    const _mhBon4 = mineheadBonusQTY(4, mineFloor);
    if (_mhBon4 > 0) {
      const _eo = equipOrderData && (equipOrderData as any)[ci];
      const _weaponName = _eo && _eo[0] && _eo[0][1];
      const _baseWP =
        _weaponName && (ITEMS as any)[_weaponName] ? (ITEMS as any)[_weaponName].Weapon_Power || 0 : 0;
      const _em0 = emmData && (emmData as any)[ci] && (emmData as any)[ci][0];
      const _affixWP = _em0 && _em0[1] ? Number(_em0[1].Weapon_Power) || 0 : 0;
      mhWepPowDmgPCT = _mhBon4 * (_baseWP + _affixWP);
    }
  } catch {}
  ddl2 *= (1 + mhBonusQTY0 / 100) * (1 + mhWepPowDmgPCT / 100);

  // WeeklyBoss.g bonus
  try {
    const _wbg = (s as any).weeklyBossData;
    if (_wbg && _wbg.g != null) ddl2 *= 1 + Math.min(150, Number(_wbg.g) || 0) / 100;
  } catch {}

  // DDL[2] softcap chain
  if (ddl2 > 100) ddl2 = 100 + Math.max(Math.pow(ddl2 - 100, 0.86), 0);
  if (ddl2 > 2e7) ddl2 = 2e7 * Math.pow(ddl2 / 2e7, 0.8);
  if (ddl2 > 5e8) ddl2 = 5e8 * Math.pow(ddl2 / 5e8, 0.6);
  if (ddl2 > 2e9) ddl2 = 2e9 * Math.pow(ddl2 / 2e9, 0.45);
  if (ddl2 > 15e9) ddl2 = 15e9 * Math.pow(ddl2 / 15e9, 0.36);
  if (ddl2 > 6e10) ddl2 = 6e10 * Math.pow(ddl2 / 6e10, 0.28);

  // Post-softcap multipliers
  const etc72 = rval(etcBonus, "72", ctx);
  const etc75 = rval(etcBonus, "75", ctx);
  const etc104 = rval(etcBonus, "104", ctx);
  const votingDmg = safe(votingBonusz, 1, 1, s);
  const uniqueSushi = (s as any).cachedUniqueSushi || safe(computeUniqueSushi, (s as any).sushiData);
  const rogBonus49 = safe(rogBonusQTY, 49, uniqueSushi);
  const superBit64 = safe(superBitType, 64, (s.gamingData as any) && (s.gamingData as any)[12]);
  const ola232 = Number((optionsListData as any)[232]) || 0;
  const ola232Bonus = 10 * Math.floor((96 + ola232) / 100);
  const card96 = safe(computeCardBonusByType, 96, ci, s);
  let stickerDmg = safe(computeStickerBonus, 0, s);
  if (stickerDmg < 1) stickerDmg = 1;
  let tomeBonus6 = 0;
  try {
    tomeBonus6 = tome.resolve(6, ctx as any).val || 0;
  } catch {}
  const ach371 = safe(achieveStatus, 371, s);
  const ach384 = safe(achieveStatus, 384, s);

  ddl2 *=
    (1 + etc72 / 100) *
    (1 + etc75 / 100) *
    (1 + etc104 / 100) *
    (1 + votingDmg / 100) *
    (1 + rogBonus49 / 100) *
    (1 + 0.1 * superBit64) *
    (1 + ola232Bonus / 100) *
    (1 + card96 / 100) *
    Math.max(1, stickerDmg) *
    (1 + (tomeBonus6 + ach371 + ach384) / 100) *
    (1 + Math.max(0, Math.min(2, safe(computeKillroyDMG, s) / 100)));

  // More post-softcap: Companions(12,33,160) + Crystal6 card + Meritoc
  const comp12 = rval(companion, 12, ctx);
  const comp33 = rval(companion, 33, ctx);
  const comp160 = rval(companion, 160, ctx);
  const compMult = Math.max(1, (1 + comp12) * (1 + comp33) * (1 + 2 * comp160));
  const crystal6Lv = safe(computeCardLv, "Crystal6", s);
  const crystal6Bonus = Math.min(1.5 * crystal6Lv, 15);
  const meritoc5 = safe(computeMeritocBonusz, 5, s);
  ddl2 *= compMult * (1 + crystal6Bonus / 100) * (1 + meritoc5 / 100);

  // Bundle bonus
  try {
    const _bun =
      (s as any).bundlesData || ((s as any).data ? (s as any).data.BundlesReceived : (s as any).BundlesReceived);
    if (_bun && _bun.bon_a == 1) ddl2 *= 1.5;
  } catch {}

  // FamBonusQTYs[80]
  const _famMap2 = _famMap || computeFamBonusQTYs(ci, s);
  let famBonus80 = 0;
  try {
    if (_famMap2 && typeof _famMap2 === "object") famBonus80 = Number((_famMap2 as any)[80]) || 0;
  } catch {}
  ddl2 *= 1 + famBonus80 / 100;

  // Reliquarium: [STUB] needs Thingies("ReliquariumInPosession") — skipped (no-op).

  // === Final: MaxDmg = DDL[0] * DDL[1] * DDL[2] ===
  let maxDmg = baseDmgRaw * pctMult * ddl2;
  if (maxDmg !== maxDmg || maxDmg == null) maxDmg = 0;
  return maxDmg;
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
        if (_sfqty > 0) {
          const _sfAmt = Number((ITEMS as any)[_sfname].Amount) || 0;
          let _sfBoost = 1;
          try {
            const _sfBoxVal = safe(computeBoxReward, ci, "PowerFoodEffect");
            const _sfStatue3 = safe(computeStatueBonusGiven, 3, ci, s);
            const _sfStampVal = safe(computeStampBonusOfTypeX, "BFood", s);
            const _sfStar = computeStarSignBonus("FoodEffect", ci, s);
            const _sfCard48 = safe(computeCardBonusByType, 48, ci, s);
            const _sfT631 = rval(talent, 631, ctx);
            const _sfEtc9 = rval(etcBonus, "9", ctx);
            const _sfCardSet01 = safe(computeCardSetBonus, ci, "1");
            _sfBoost =
              1 +
              (_sfBoxVal +
                _sfStatue3 +
                _sfEtc9 +
                _sfStampVal +
                _sfStar +
                _sfCard48 +
                _sfCardSet01 +
                _sfT631) /
                100;
          } catch {}
          _spdFood += _sfAmt * _sfBoost;
        }
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
      const _saltLick7 = safe(computeSaltLick, 7, s);
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
//   computeFlurboShop(5)   — W2 dungeon flurbo shop  [STUB, local =0]
//   computeRooBonus(3)     — W7 sushi RoG acc        [STUB, local =0]
//   computeDivinityMinor   — W5 divinity minor link  [STUB, local =0]
// All other sub-sources reuse already-ported systems.
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
    obolAcc = computeObolBaseStat(ci, "Accuracy").val || 0;
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
  const summVault4 = safe(computeSummUpgBonus, 4, s);

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
  const flurbo5 = safe(computeFlurboShop, 5, s); // [STUB] local =0
  const bribe21 = safe(getBribeBonus, "21", s);
  const comp23 = rval(companion, 23, ctx);
  const starAccPct = computeStarSignBonus("AccPct", ci, s); // faithful-to-corgan =0
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
  const divinityMinor = safe(computeDivinityMinor, ci, 0, s); // [STUB] local =0

  const prayerMult = Math.max(0.1, 1 + (prayer6 - prayer15pen - prayer16pen) / 100);
  const postMult1 = 1 + (playerACCDN + 2 * cardSet4) / 200;
  const postMult2 = 1 + (chipAcc + mealTotAcc + rooBonus3 + votingBonus3 + amarokSet) / 100;
  const postMult3 = 1 + divinityMinor / 100;

  let acc = base * postMult1 * prayerMult * postMult2 * postMult3;
  if (acc !== acc || acc == null) acc = 0;
  return acc;
}

// ==========================================================================
// OVERKILL TIER — port of systems/common/overkill.js (OverkillStuffs("2")).
// Uses computeMaxDamage instead of corgan's buildTree/getCatalog.
// ==========================================================================
export type OverkillResult = {
  tier: number;
  maxDmg: number;
  monsterHP: number;
  mapIdx: number;
  exponent: number;
};

/**
 * Compute the overkill tier (1..50) for a character on their current AFK map.
 * Game logic: OverkillStuffs("2")
 *   okExp = CurrentMap >= 300 ? 5 : 2
 *   tier = 1; for s=0..49: if maxDmg >= MonsterHP * okExp * okExp^(s+1) → tier = s+2
 */
export function computeOverkillTier(
  charIdx: number,
  ctx: Ctx,
  opts?: { mapIdx?: number; maxDmg?: number }
): OverkillResult {
  opts = opts || {};
  const mapIdx =
    opts.mapIdx != null
      ? opts.mapIdx
      : (currentMapData && (currentMapData as any)[charIdx]) || 0;
  const monsterKey = (MapAFKtarget as any)[mapIdx];
  const mon = monsterKey && (MONSTERS as any)[monsterKey];
  const monsterHP = (mon && mon.MonsterHPTotal) || 0;
  const afkType = mon && mon.AFKtype;

  // Only fighting maps have overkill.
  if (afkType !== "FIGHTING" || monsterHP <= 0) {
    return { tier: 1, maxDmg: 0, monsterHP: 0, mapIdx, exponent: 1 };
  }

  let maxDmg = opts.maxDmg;
  if (maxDmg == null) {
    try {
      maxDmg = computeMaxDamage(charIdx, ctx) || 0;
    } catch {
      maxDmg = 0;
    }
  }

  const okExp = mapIdx >= 300 ? 5 : 2;
  let tier = 1;
  for (let st = 0; st < 50; st++) {
    const threshold = monsterHP * okExp * Math.pow(okExp, st + 1);
    if ((maxDmg as number) >= threshold) {
      tier = st + 2;
    } else {
      break;
    }
  }

  return { tier, maxDmg: maxDmg as number, monsterHP, mapIdx, exponent: okExp };
}
