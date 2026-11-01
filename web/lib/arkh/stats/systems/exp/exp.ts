// ===== EXP SYSTEM =====
// One id per term of N.js x._customBlock_ExpMulti(0) (@4238487). Each case
// returns what its group consumes: a FACTOR in mult groups (G1, G3–G8), a
// % amount in pct groups (G2, G9, G10). defs/exp-multi.ts owns the shapes.
// Existing helpers are reused as-is; new ports live in this folder.

import { node, renamed, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData, divinityData } from "../../../save/data";
import { superBitType, cloudBonus } from "../../../game-helpers";
import { getLOG } from "../../../formulas";
import { label } from "../../entity-names";
import { MapAFKtarget, ZenithMarket, GrimoireUpg } from "../../data/game/customlists.js";

import { talent } from "../common/talent";
import { companions } from "../common/companions";
import { etcBonus } from "../common/etcBonus";
import { workshop } from "../common/wrappers";
import { vaultUpgBonus } from "../common/vault";
import { friend } from "../common/friend";
import { achieveStatus } from "../common/achievement";
import { computeStarSignBonus } from "../common/starSign";
import { goldFoodBonuses } from "../common/goldenFood";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import {
  computeCardBonusByType,
  computeBoxReward,
  computeMealBonus,
  computeStatueBonusGiven,
} from "../common/stats";
import { computeCardSetBonus, cardSet, computeCardLv } from "../common/cards";
import { gridBonusValue } from "../w4/lab";
import { jellyRoGBonus, JELLY_ROG_NAMES } from "../../data/w7/jelly";
import { arcadeBonusNamed } from "../common/tracker-names";
import { computeVialByKey, bubbleValByKey, sigilBonus } from "../w2/alchemy";
import { computeArcaneMapMultiBon } from "../mc/tesseract";
import { computeBigFishBonus } from "../w7/spelunking";
import { sushiRoG } from "../w7/sushi";
import { fountainBonusTotal } from "../../data/w5/fountain";
import { royalStatue } from "../w7/royalG";
import { computeMeritocBonusz } from "../w7/meritoc";
import { computeShinyBonusS } from "../w4/breeding";
import { computeAllShimmerBonuses } from "../w3/equinox";
import { owl } from "../w1/owl";
import { votingBonusz } from "../w2/voting";
import { EXP_VOTE_NAME } from "../../defs/exp-multi";
import { computePrayerReal } from "../w3/prayer";
import { computeShrine } from "../w3/construction";
import { getSetBonus } from "../w3/setBonus";
import { holes, computeMonumentROGbonus, monumentBonusLabel } from "../w5/hole";
import { computeWinBonus } from "../w6/summoning";
import { exoticBonusQTY, exoticDoubled } from "../../data/w5/farming";
import { menagerieBoost } from "../w7/menagerie";
import { grimoireUpgBonus } from "../mc/grimoire";
import { computeButtonBonus } from "../w7/button";
import { divinityMinorFor } from "../coin/divinityMinor";
import { votingMulti, flurboShop } from "../coin/coin";

import { medallionList } from "./medallions";
import { isLowestLevel } from "./lowestLevel";
import { compassBonus } from "./compass";
import { stickerBonus, stickerCount, stickerCrownPct } from "./sticker";
import { dancingCoralBonus, dancingCoralTower } from "./dancingCoral";
import { bubbaRoGBonus, bubbaRoGAll, bubbaRoGTiers } from "./bubba";
import { totalFoodBonuses, foodSlotsOwned } from "./food";
import { saltLick, saltLickLevel } from "./saltLick";
import { msaClassExp, msaTotalWaves } from "./msa";
import { petArenaCrucBonus, arenaCrucTier, arenaCrucWave } from "./petArenaCruc";

/** Class talents in the EXP formula (read from the active character).
 *  55/328/429/434 are account-wide (getbonus2), 632 is a star talent. */
export const EXP_CLASS_TALENTS = [35] as const;

// Node names of the six circumstantial EXP sources: a character can never
// actually get these unless it's the account's lowest-level char (superbit19,
// merit3, vault12) or it's still under the relevant level cap (newbie,
// cardSet0, mealClexp). Biggest Gains excludes them from the ranking (they'd
// rank a source the viewed character can't reach) — see groupedGainsModel's
// `skip` option in lib/statTracker/biggestGains.ts. Named constants (reused
// verbatim inside the matching switch cases below) so the skip list can never
// drift from the actual node names.
const NOOBIE_GAINS_NAME = "Noobie Gains (Super Bit 19)";
const MERIT_LOWEST_LEVEL_NAME = "Merit: EXP for Lowest-Level Character";
const VAULT_12_NAME = "Baby on Board (Vault 12)";
const NEWBIE_BRACKET_NAME = "Newbie Bracket";
const CARD_SET_0_NAME = "EXP if below Lv 50 Set Bonus (Card Set 0)";
const MEALS_CLEXP_NAME = "Class EXP Meals (below Lv 120)";

const CARD_SET_0_NOTE = "Only below level 50";
const MEALS_CLEXP_NOTE = "MealBonus(\"Clexp\"): no meal in MealINFO carries this key, so it is always 0 (same in N.js)";

export const EXP_CIRCUMSTANTIAL_SOURCE_NAMES = [
  NOOBIE_GAINS_NAME,
  MERIT_LOWEST_LEVEL_NAME,
  VAULT_12_NAME,
  NEWBIE_BRACKET_NAME,
  CARD_SET_0_NAME,
  MEALS_CLEXP_NAME,
] as const;

const raw = (name: string, v: number, note?: string): ArkhNode => node(name, v, null, { fmt: "raw", note });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });

// Flat companion terms — (1 + coeff·Companions(n)). comp128 (min/CompLV2) and
// comp50 (clamp) have their own shape and are handled as separate cases.
const COMP_COEF: Record<string, number> = {
  comp37: 9, comp33: 1, comp32: 1, comp34: 1, comp145: 1, comp160: 4, comp168: 0.4,
};

// G10 achievement terms: AchieveStatus(n) × weight (ach357/61/124/188/286).
const ACH_WEIGHT: Record<string, number> = {
  ach57: 1, ach357: 20, ach61: 3, ach124: 2, ach188: 5, ach286: 25,
};

// N.js ExpMulti(0)'s own LUK curve (distinct from DR's lukCurve() — ÷30 and
// 0.8/.3963 constants here vs DR's ÷40 and 0.5/.297). Exported for reuse by
// both G10 "luk" (the curve/1.8 term) and "talent35" (its ×T35/100 cross term).
export function expLukCurve(luk: number): number {
  if (!Number.isFinite(luk) || luk < 0) return 0;
  return luk < 1e3
    ? (Math.pow(luk + 1, 0.37) - 1) / 30
    : 0.8 * ((luk - 1e3) / (luk + 2500)) + 0.3963;
}

// Spelunk[6].length — save arrays may deserialize as {0:…, length:N} objects
// instead of a real array; count numeric keys and ignore "length" itself.
export function arrCount(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") {
    let n = 0;
    for (const k of Object.keys(v as Record<string, unknown>)) {
      if (k !== "length" && /^\d+$/.test(k)) n++;
    }
    return n;
  }
  return 0;
}

// @njs _customBlock_ExpMulti
// N.js x._customBlock_ExpMulti(0) — per-case @njs tags below cite the
// specific sub-formula each case ports instead, where one is separately named.
function resolveExp(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const savedMap = Number((currentMapData as any)?.[ci]) || 0;
  const map = ctx.mapIdx ?? savedMap;
  const level = Number((s.lv0AllData as any[])?.[ci]?.[0]) || 0;

  switch (id) {
    // N.js WorkbenchStuff("AdditionExtraEXPnDR",0,0) — Tal 328 × log(OLA[139]),
    // already wired as talent.resolve(328)'s final-bonus wrap.
    case "workbench":
      return workshop.resolve(undefined as any, tctx);

    // N.js 1==BundlesReceived.bun_q → LUK3 += 20 (@4241578)
    case "bunQ": {
      const owned = Number((s.bundlesData as any)?.bun_q) === 1 ? 1 : 0;
      return pct("EXP Bundle", owned ? 20 : 0, [raw("Owned", owned)], "bun_q: Equinox Valley pack, +20% Class EXP; no in-game title");
    }
    // @njs SuperBitType — N.js Tasks[2][0][2]>0 lowest-level block →
    // 1==SuperBitType(19) → LUK3=50
    case "superbit19": {
      const merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0;
      const lowest = isLowestLevel(ci, s) ? 1 : 0;
      const bit = superBitType(19, (s.gamingData as any)?.[12]);
      const active = merit > 0 && lowest === 1 && bit === 1;
      return pct(
        NOOBIE_GAINS_NAME,
        active ? 50 : 0,
        [raw("Merit level", merit, "Tasks[2][0][2]"), raw("Lowest level", lowest), raw("Super Bit 19", bit)],
        "Only the account's lowest-level character gets it"
      );
    }
    // N.js GenINFO[17]==1 (Compass[3] has the map's default monster's
    // medallion) → LUK5 *= max(1, getbonus2(1,429,-1)). Never read
    // AFKtarget_N — SP/exp/semantics.md §1.
    case "medallion429": {
      const monster = String((MapAFKtarget as any)[map] ?? "");
      const gate = medallionList(s).includes(monster);
      const t = talent.resolve(429, tctx);
      const val = gate ? Math.max(1, Number(t.val) || 0) : 1;
      return factor(
        label("Talent", 429),
        val,
        [raw("Medallion owned (map's monster)", gate ? 1 : 0), raw("Talent value", Number(t.val) || 0, "getbonus2(1, 429), account-wide")],
        `Map ${map} · ${monster}`
      );
    }

    // N.js (1+9·Companions(37)) / (1+Companions(n)) / (1+4·Companions(160)) /
    // (1+.4·Companions(168)) — flat coefficient off COMP_COEF. (@4242637)
    case "comp37":
    case "comp33":
    case "comp32":
    case "comp34":
    case "comp145":
    case "comp160":
    case "comp168": {
      const n = Number(id.slice(4));
      return factor(label("Companion", n), 1 + COMP_COEF[id] * companions(n, s));
    }
    // @njs PetArenaCrucBonus — N.js (1+.2·Breeding("PetArenaCrucBonus","0",15,0))
    // (2026-10-16, petArenaCruc.ts): ×1.2 once the Crucible's 16th wave is cleared.
    case "arenaCruc15": {
      const on = petArenaCrucBonus(15, s);
      return factor("1.20x Class EXP (Pet Arena Crucible 15)", 1 + 0.2 * on, [
        raw("Best Crucible wave", arenaCrucWave(), "OLA[628]"),
        raw("Crucible waves cleared", arenaCrucTier(s)),
      ], "×1.2 once the Crucible's 16th wave is cleared (RANDOlist[115][15])");
    }
    // @njs BoostQTY — N.js (1+MenagerieStuff("BoostQTY",23,0)/100) (2026-10-16).
    case "menagerie23": {
      const m = menagerieBoost.resolve(23, ctx as any);
      return factor(m.name, 1 + Number(m.val) / 100, m.children);
    }
    // @njs RoG_BonusQTY — (1+JellyOperation("RoG_BonusQTY",n,0)/100)
    case "jelly30":
    case "jelly62": {
      const n = Number(id.slice(5));
      const v = jellyRoGBonus(n, s);
      return factor(`${JELLY_ROG_NAMES[n]} (Jelly Obstruction ${n + 1})`, 1 + v / 100, [raw("Jelly RoG bonus", v)], `Jelly Bonus ${n}: x Class EXP gain`);
    }
    // N.js (1+(min(.5,Companions(128))+.25·CompLV2(128))); CompLV2 is a 0/1
    // flag (DNSM.CompanionLVz[id] >= 1) — same test arkh's companionLv2Ids set.
    case "comp128": {
      const c = companions(128, s);
      const lv2 = s.companionLv2Ids?.has(128) ? 1 : 0;
      return factor(label("Companion", 128), 1 + Math.min(0.5, c) + 0.25 * lv2);
    }
    // N.js max(1,min(1.01,1+Companions(50)/2500))
    case "comp50": {
      const c = companions(50, s);
      return factor(label("Companion", 50), Math.max(1, Math.min(1.01, 1 + c / 2500)));
    }
    // @njs Grid_Bonus — (1+(Grid_Bonus(130)+Grid_Bonus(131)+Grid_Bonus(132)+Grid_Bonus(152))/100)
    case "gridExp": {
      const g130 = gridBonusValue(130, s);
      const g131 = gridBonusValue(131, s);
      const g132 = gridBonusValue(132, s);
      const g152 = gridBonusValue(152, s);
      return factor(
        "Legendary Fevers (Research Grid 130·131·132·152)",
        1 + (g130 + g131 + g132 + g152) / 100,
        [raw("Grid 130", g130), raw("Grid 131", g131), raw("Grid 132", g132), raw("Grid 152", g152)],
        "Legendary Yellow / Red / Brown / Green Fever"
      );
    }
    // @njs StickerBonus — (1+FarmingStuffs("StickerBonus",0,0)/100) (@4243276), sticker.ts
    case "sticker0": {
      const v = stickerBonus(0, s);
      return factor("Mega Mongo Sticker (Sticker 0)", 1 + v / 100, [
        raw("Stickers found", stickerCount(0, s), "Research[9][0]"),
        raw("Boony Crowns % (Grid 68 × crowns)", stickerCrownPct(s)),
      ]);
    }
    // N.js (1+.1·SuperBitType(63)) (@4243370)
    case "superbit63": {
      const bit = superBitType(63, (s.gamingData as any)?.[12]);
      return factor("Experienced Gamer (Super Bit 63)", 1 + 0.1 * bit, [raw("Super Bit 63", bit)]);
    }
    // @njs ZenithMarketBonus — floor(ZenithMarket[9][4]·Spelunk[45][9])
    case "zenith9": {
      const perLv = Number((ZenithMarket as any)?.[9]?.[4]) || 0;
      const lv = Number((s.spelunkData as any)?.[45]?.[9]) || 0;
      const zen = Math.floor(perLv * lv);
      return factor("Classy Gogo (Zenith Market 9)", 1 + zen / 100, [
        raw("Bonus per level", perLv, "ZenithMarket[9][4]"),
        raw("Upgrade level", lv, "Spelunk[45][9]"),
      ]);
    }
    // N.js (1+EtcBonuses("84")/100) (@4243532)
    case "etc84": {
      const e = etcBonus.resolve(84, { saveData: s, charIdx: ci });
      return factor("Bonus Class EXP (Equipment)", 1 + Number(e.val) / 100, [renamed(e, "Bonus Class EXP (Equipment)")], "EtcBonuses(84) = %_BONUS_CLASS_EXP");
    }
    // N.js (1+CardBonusREAL(100)/100) (@4243572)
    case "card100": {
      const cb = computeCardBonusByType(100, ci, s);
      return factor("Class EXP Multi Cards (Card Type 100)", 1 + Number(cb.val) / 100, cb.children);
    }
    // N.js (1+ArcadeBonus(60)/100) (@4243614)
    case "arcade60": {
      const a = arcadeBonusNamed(60, s);
      return factor(label("Arcade", 60), 1 + Number(a.val) / 100, a.children);
    }
    // N.js (1+AlchVials["7classexp"]/100) (@4243698)
    case "vialClassExp": {
      const v = computeVialByKey("7classexp", s);
      return factor("Crabomayse (Vial 83)", 1 + Number(v.val) / 100, v.children, "Vial effect key 7classexp");
    }
    // @njs TotalTitanKills — pow(max(1,getbonus2(1,434,-1)), TotalTitanKills)
    // — already the shape talent.resolve(434) returns via its final-bonus wrap.
    case "talent434": {
      const t = talent.resolve(434, tctx);
      return factor(t.name, Math.max(1, Number(t.val) || 0), t.children);
    }
    // @njs ArcaneMapMulti_bon — (1+ArcaneType("ArcaneMapMulti_bon",1,0)/100)
    // — slot 1 is the EXP variant (slot 0 = DR, slot 2 = AFK gains).
    case "arcane1": {
      const bon = computeArcaneMapMultiBon(1, ctx as any);
      const kills = Number((ctx.mapBon?.[map] as any)?.[1]) || 0;
      return factor("Arcane Map Bonus: Class EXP", 1 + bon / 100, [raw("Kills on this map", kills, "MapBon[map][1]")], "MapBon slot 1 (slot 0 = DR, 2 = AFK)");
    }
    // @njs BigFishBonuses — (1+Spelunk("BigFishBonuses",4,0)/100)
    case "bigFish4": {
      const b = computeBigFishBonus(4, s);
      return factor("Advice on Being Smart (Big Fish 4)", 1 + b / 100, [raw("Big Fish 4 bonus", b)], "x Class EXP gain");
    }
    // @njs DancingCoralBonus — (1+Thingies("DancingCoralBonus",3,0)/100) (@4244052), dancingCoral.ts
    case "dancingCoral3": {
      const v = dancingCoralBonus(3, s);
      return factor("Class EXP (Dancing Coral 3)", 1 + v / 100, [raw("Pantheon Shrine level", dancingCoralTower(3, s), "TowerInfo[21]")], "Depends on the Pantheon Shrine level (TowerInfo[21])");
    }
    // @njs CoralKidUpgBonus — pow(1+CoralKidUpgBonus(2)/100, max(0,Divinity[25]-10));
    // CoralKidUpgBonus(2) = 20·OLA[429]/(25+OLA[429]).
    case "coralKid": {
      const o429 = ola(429);
      const ck = (20 * o429) / (25 + o429);
      const rank = Math.max(0, (Number((divinityData as any)?.[25]) || 0) - 10);
      return factor("Coral Kid Upgrade 2", Math.pow(1 + ck / 100, rank), [
        raw("Coral Kid 2 (%)", ck),
        raw("God Rank", rank),
      ], "(1 + bonus/100) ^ (God Rank - 10); bonus = 20·OLA[429]/(25 + OLA[429]); upgrades bought with Singularity Spirals");
    }
    // N.js (1+CardSetBonuses(0,"12")/100) (@4244260) — computeCardSetBonus is
    // the direct port of _customBlock_CardSetBonuses (Cards[3] keyed by IDforCardSETbonus).
    case "cardSet12": {
      const cs = computeCardSetBonus(ci, "12");
      return factor("Class EXP Multi Set Bonus (Card Set 12)", 1 + Number(cs.val) / 100, cs.children);
    }
    // N.js (1+Bubbastuff("BubbaRoG_Bonuses",6,0)/100) (@4244288), bubba.ts
    case "bubba6": {
      const v = bubbaRoGBonus(6, s);
      return factor("XP Multi (Bubba RoG 6)", 1 + v / 100, [
        raw("Megaflesh bonus %", bubbaRoGAll(s), "Bubba_RoG_all"),
        raw(label("Companion", 51), companions(51, s)),
        raw("Bubba tiers", bubbaRoGTiers(6, s), "⌈(Bubba[1][3] − 5) / 7⌉"),
      ], "Bubba the Seal RoG bonus 6");
    }
    // @njs RoG_BonusQTY — (1+SushiStuff("RoG_BonusQTY",15,0)/100)
    case "sushi15": {
      const su = sushiRoG.resolve(15, ctx as any);
      return factor(su.name.split(" — ")[0], 1 + Number(su.val) / 100, [su], "RoG Bonus 15: x Class EXP gain");
    }
    // @njs CloudBonus — (1+5·Dreamstuff("CloudBonus",70)/100)
    case "cloud70": {
      const c = cloudBonus(70, s.weeklyBossData);
      return factor("Palette Lv. 100 (Equinox Challenge 70)", 1 + (5 * c) / 100, [raw("Dream Challenge 70 completed", c)], "Reach Lv. 100 on any Palette colour; reward 1.05x Class EXP (×5 → 5 × 1%)");
    }
    // @njs Fountain_BonTOT — (1+Holes2("Fountain_BonTOT",0,16)/100)
    case "fountain16": {
      const f = fountainBonusTotal(s, 0, 16);
      return factor("Class EXP Boost (Fountain 16)", 1 + f / 100, [raw("Fountain bonus 16", f)], "Fountain upgrade 16 (tier 0)");
    }
    // @njs StatueBon — (1+RoyalG("StatueBon",3,0)/100)
    case "royalStatue3": {
      const r = royalStatue.resolve(3, ctx as any);
      return factor(r.name, 1 + Number(r.val) / 100, r.children);
    }
    // @njs MeritocBonusz — max(1, pow(1.03,Spelunk[6].length)·SuperBitType(24)·
    //   (1+Meritoc2("MeritocBonusz",27,0)/100)). The 2026-10-16 build dropped
    //   the (1+max(0,5·(OLA[464]-8))/100) factor.
    case "classy": {
      const n = arrCount((s.spelunkData as any)?.[6]);
      const bit24 = superBitType(24, (s.gamingData as any)?.[12]);
      const meritoc27 = computeMeritocBonusz(27, s);
      const val = Math.max(1, Math.pow(1.03, n) * bit24 * (1 + meritoc27 / 100));
      return factor("Classy Discoveries", val, [
        raw("Discoveries found", n, "Spelunk[6].length"),
        raw("Super Bit 24", bit24),
        raw("Meritoc 27", meritoc27),
      ]);
    }
    // N.js EtcBonuses("78")
    case "etc78":
      return renamed(etcBonus.resolve(78, { saveData: s, charIdx: ci }), "Class EXP Multi (Equipment)", "EtcBonuses(78) = %_CLASS_EXP_MULTI");

    // ===== G10 — ➕ Additive Pool =====
    // N.js ExpGainLUK*(1+T35/100)/1.8 — split into two pct-points terms so
    // T35 (class-gated) can be zeroed independently: "luk" = 100·curve/1.8
    // (the "1+" part) and "talent35" = curve·t35/1.8 (the "·T35/100" part).
    // Both recover the true term once G10's pool divides the sum by 100.
    case "luk": {
      const luk = Number((s.statList as any)?.[ci]?.[3]) || 0;
      const curve = expLukCurve(luk);
      return pct("LUK Scaling (Class EXP)", (100 * curve) / 1.8, [
        raw("Total LUK", luk),
        raw("EXP LUK curve", curve),
      ]);
    }
    case "talent35": {
      const luk = Number((s.statList as any)?.[ci]?.[3]) || 0;
      const curve = expLukCurve(luk);
      const t = talent.resolve(35, tctx);
      const t35 = Number(t.val) || 0;
      return node(t.name, (curve * t35) / 1.8, [raw("EXP LUK curve", curve), raw("Talent 35", t35)], { fmt: "+" });
    }
    // N.js EtcBonuses("4") — IT "% Xp From Monsters" (Equip+Gallery+Hat Rack).
    case "etc4":
      return renamed(etcBonus.resolve(4, { saveData: s, charIdx: ci }), "XP from Monsters (Equipment)", "EtcBonuses(4) = %_XP_FROM_MONSTERS");
    // N.js BoxRewards.monsterExp — Box of Unwanted Stats slot 2 (N.js
    // PostOffUpgradeInfo row: "...decay %_Monster_EXP...acc def monsterExp").
    case "boxMonsterExp": {
      const r = computeBoxReward(ci, "monsterExp");
      return pct("Box of Unwanted Stats (Post Office 3c)", r.val, r.children, "% Monster EXP (third slot of box 3)");
    }
    // N.js TotalFoodBonuses("ClassEXP") (@4246378), food.ts — equipped
    // regular food only (golden food is goldFood below).
    case "food":
      return pct("Food (Class EXP)", totalFoodBonuses("ClassEXP", ci, s), [raw("Food slots owned", foodSlotsOwned(s))]);
    // N.js StarSigns.MainXP
    case "starSignMainXP": {
      const r = computeStarSignBonus("MainXP", ci, s);
      return pct("Star Signs: Main EXP", r.val, r.children, "StarSigns.MainXP: The Book Worm (2), The Big Brain (24), Big Brain Major (52)");
    }
    // N.js AlchVials.MonsterEXP
    case "vialMonsterExp": {
      const r = computeVialByKey("MonsterEXP", s);
      return pct("Mimicraugh (Vial 17)", r.val, r.children, "Vial effect key MonsterEXP");
    }
    // N.js AlchBubbles.expACTIVE
    case "bubbleExp": {
      const r = bubbleValByKey("expACTIVE", ci, s);
      return pct("Grind Time (Kazam Cauldron)", r.val, r.children, "ACTIVE bubble (key expACTIVE): counts only with Sheepie or when equipped");
    }
    // N.js CardBonusREAL(44)
    case "card44": {
      const r = computeCardBonusByType(44, ci, s);
      return pct("Monster EXP Cards (Card Type 44)", r.val, r.children, "Card type 44 = +% EXP from monsters");
    }
    // N.js Tasks[2][0][2]>0 lowest-level block: ExpGainLUK2 = 3*merit + Vault12
    // — active only when the block's gate (merit owned + lowest-level char)
    // holds; see SP/exp/semantics.md §4.
    case "merit3": {
      const merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0;
      const active = merit > 0 && isLowestLevel(ci, s);
      return pct(MERIT_LOWEST_LEVEL_NAME, active ? 3 * merit : 0, [
        raw("Merit level", merit, "Tasks[2][0][2]"),
        raw("Lowest level", active ? 1 : 0),
      ], "Taskboard merit (Tasks[2][0][2]): +3% per level, lowest-level character only");
    }
    // @njs VaultUpgBonus — same block as merit3, gated on the lowest-level char.
    case "vault12": {
      const merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0;
      const active = merit > 0 && isLowestLevel(ci, s);
      const v = active ? vaultUpgBonus(12, s) : 0;
      return pct(VAULT_12_NAME, v, [raw("Lowest level", active ? 1 : 0)], "Lowest-level character only");
    }
    // N.js Lv0<50 → CardSetBonuses(0,"0") — same equipped-set semantics as
    // Task 2's cardSet12 (computeCardSetBonus), key "0".
    case "cardSet0": {
      if (level >= 50) return pct(CARD_SET_0_NAME, 0, null, CARD_SET_0_NOTE);
      const cs = computeCardSetBonus(ci, "0");
      return pct(CARD_SET_0_NAME, Number(cs.val) || 0, cs.children, CARD_SET_0_NOTE);
    }
    // N.js Lv0<120 → MealBonus("Clexp")
    case "mealClexp": {
      if (level >= 120) return pct(MEALS_CLEXP_NAME, 0, null, MEALS_CLEXP_NOTE);
      const m = computeMealBonus("Clexp", s);
      return pct(MEALS_CLEXP_NAME, m.val, m.children, MEALS_CLEXP_NOTE);
    }
    // N.js hasOwnProperty(WeeklyBoss,"c") → min(150, WeeklyBoss.c)
    case "weeklyBoss": {
      const wb = s.weeklyBossData as any;
      const has = !!wb && Object.prototype.hasOwnProperty.call(wb, "c");
      const val = has ? Math.min(150, Number(wb.c) || 0) : 0;
      return pct("Weekly Boss", val, has ? [raw("WeeklyBoss.c", Number(wb.c) || 0)] : null);
    }
    // N.js Lv0<10?150:Lv0<30?100:Lv0<50?50:0
    case "newbie": {
      const val = level < 10 ? 150 : level < 30 ? 100 : level < 50 ? 50 : 0;
      return pct(NEWBIE_BRACKET_NAME, val, [raw("Class Level", level)]);
    }
    // @njs Bonus_Minor — N.js Divinity("Bonus_Minor",
    // GetPlayersUsernames.indexOf(UserInfo[0]), 4) — the ACTIVE character's
    // own index, i.e. divinityMinorFor's single-player branch, not
    // divinityMinorSum's roster-sum (-1) branch Coin's divMinor3 uses.
    case "divMinor4":
      return pct("Class EXP (Divinity Minor Bonus 4)", divinityMinorFor(ci, 4, s), null, "The active character's linked god, minor type 4");
    // N.js CardSetBonuses(0,"5") — same system+id already wired into DR (G7).
    // Named locally (not via cardSet.resolve()'s own label()) — the real name,
    // "Damage / Drop / EXP Set Bonus (Card Set 5)", contains the flat-tree's
    // " / " path separator, which makes this node invisible as a direct child
    // of its group (groupedGainsModel/directChildren in biggestGains.ts split
    // it into fake sub-path segments instead). label() itself can't change:
    // DR's stored snapshot paths depend on its exact output.
    case "cardSet5": {
      const r = cardSet.resolve(5, ctx as any);
      return pct("Card Set 5 (Damage · Drop · EXP)", r.val, r.children);
    }
    // N.js ArbitraryCode("StatueBonusGiven10") — added directly, no ÷100
    // (unlike Coin's statue19: EXP's whole G10 pool is what gets ÷100).
    case "statue10": {
      const r = computeStatueBonusGiven(10, ci, s);
      return pct("EXP Statue (Statue 10)", r.val, r.children, "Added directly, no ÷ 100");
    }
    // N.js GetTalentNumber(1,632) — star talent (id≥615), active character.
    case "talent632":
      return talent.resolve(632, tctx);
    // N.js Shrine(5)
    case "shrine5":
      return pct(label("Shrine", 5), computeShrine(5, s));
    // N.js SaltLick(3) (@4246848), saltLick.ts
    case "saltLick3":
      return pct("Class EXP and Skill EXP (Salt Lick 3)", saltLick(3, s), [raw("Level", saltLickLevel(3, s))]);
    // N.js prayersReal(n,0)
    case "prayer0":
    case "prayer2": {
      const n = Number(id.slice(6));
      const r = computePrayerReal(n, 0, ci, s);
      return pct(label("Prayer", n), r.val, r.children);
    }
    // N.js −prayersReal(9,1) — the curse column; don't forget the minus sign.
    case "prayer9": {
      const r = computePrayerReal(9, 1, ci, s);
      return pct(`${label("Prayer", 9)} (curse)`, -(Number(r.val) || 0), r.children);
    }
    // N.js FlurboShop(2) — shares coin's extracted flurboShop(), idx 2.
    case "flurbo2": {
      const r = flurboShop(2, s);
      return pct("Class Exp (Flurbo Shop 2)", r.val, r.children);
    }
    // N.js AchieveStatus(n) × weight
    case "ach57":
    case "ach357":
    case "ach61":
    case "ach124":
    case "ach188":
    case "ach286": {
      const n = Number(id.slice(3));
      const w = ACH_WEIGHT[id];
      return pct(label("Achievement", n), w * achieveStatus(n, s), null, w === 1 ? undefined : `× ${w}`);
    }
    // N.js ArcadeBonus(12)
    case "arcade12": {
      const a = arcadeBonusNamed(12, s);
      return pct(label("Arcade", 12), a.val, a.children);
    }
    // N.js Labb("SigilBonus","Blank",8,0)
    case "sigil8":
      return pct("Metal Exterior Sigil (Sigil 8)", sigilBonus(8, s));
    // @njs ShinyBonusS — N.js Breeding("ShinyBonusS","Nah",1,-1)
    case "shiny1":
      return pct("Class EXP Shiny Pet (Breeding 1)", computeShinyBonusS(1, s));
    // @njs MSA_Bonus — N.js GamingStatType("MSA_Bonus",4,0) (@4247353), msa.ts
    case "msa4":
      return pct("MSA Totalizer (Class EXP)", msaClassExp(s), [raw("Total Worship waves", msaTotalWaves(s))]);
    // N.js getbonus2(1,55,-1) — account-wide (EXP Cultivation).
    case "talent55":
      return talent.resolve(55, tctx);
    // @njs CardLv — N.js 2*RunCodeOfTypeXforThingY("CardLv","springEvent1")
    case "cardSpring": {
      const lv = computeCardLv("springEvent1", s);
      return pct(label("Card", "springEvent1"), 2 * lv, [raw("Card Lv", lv)], "× 2 per card level");
    }
    // N.js Companions(n) — flat additive companion value (LUK6 block).
    case "comp3":
    case "comp47":
    case "comp111":
    case "comp50add":
    case "comp128add": {
      const n = Number(id.replace(/^comp/, "").replace(/add$/, ""));
      return pct(label("Companion", n), companions(n, s));
    }
    // @njs AllShimmerBonuses — N.js OptionsListAccount[179] * Dreamstuff("AllShimmerBonuses",0)
    case "shimmer179": {
      const o179 = ola(179);
      const shim = computeAllShimmerBonuses(s);
      return pct("Island Shimmer", o179 * shim, [
        raw("Shimmer count", o179, "OLA[179]"),
        raw("Shimmer multi", shim),
      ], "OLA[179] × AllShimmerBonuses (The Shim Lantern, Artifact 31)");
    }
    // N.js GoldFoodBonuses("ClassEXPz")
    case "goldFood":
      return pct("Golden Nigiri (Golden Food)", goldFoodBonuses("ClassEXPz", ci, undefined, s).total, null, "Σ of equipped + Emporium golden foods with effect ClassEXPz");
    // N.js Summoning("OwlBonuses",0,0)
    case "owl0":
      return renamed(owl.resolve(0, ctx as any), "Bonuses of Orion (Owl Upgrade 0)", "Orion the Horned Owl: permanent +% Class XP (owl bonus 0)");
    // N.js Summoning("VotingBonusz",15,0) — shares Coin's votingMulti(ctx).
    case "vote15": {
      const multi = votingMulti(ctx);
      const v = votingBonusz(15, multi, s);
      return pct(EXP_VOTE_NAME, v, [raw("Voting multi", multi)], "Only counts the week vote 15 wins");
    }
    // @njs MonumentROGbonuses — N.js Holes("MonumentROGbonuses",1,6)
    case "monument1_6":
      return pct(monumentBonusLabel(1, 6), computeMonumentROGbonus(1, 6, s));
    // @njs CompassBonus — N.js Windwalker("CompassBonus",51,0), Moon of Experience.
    case "compass51":
      return pct("Moon of Experience (Compass 51)", compassBonus(51, s));
    // @njs B_UPG — N.js Holes("B_UPG",47,0) / Holes("B_UPG",83,40); data
    // extended (game-constants.ts) with upg47/upg83.
    case "hole47":
      return renamed(holes.resolve("upg47", ctx as any), "Gloomie Expie (Cavern Upgrade 47)", "+25% Class EXP per Gloomie Mushroom colony cleared");
    case "hole83":
      return renamed(holes.resolve("upg83", ctx as any), "Sanctum of EXP (Cavern Upgrade 83)", "+40% Class EXP per Sanctum of Ancient Golems cleared");
    // @njs WinBonus — N.js ExpMulti(999) = Summoning("WinBonus",23,0)
    case "win23":
      return pct("Class EXP (Winner Bonus 23)", computeWinBonus(23, null, s), null, "Summoning winner bonus 23");
    // @njs GrimoireUpgBonus — N.js Summoning("GrimoireUpgBonus",24,0)
    case "grimoire24":
      return pct("Skull of Major Experience (Grimoire 24)", grimoireUpgBonus(24, GrimoireUpg, s));
    // @njs VaultUpgBonus — N.js Summoning("VaultUpgBonus",3,0)
    case "vault3":
      return pct("Wicked Smart (Vault 3)", vaultUpgBonus(3, s));
    // @njs VaultUpgBonus — N.js Summoning("VaultUpgBonus",35,0) * getLOG(OLA[345]),
    // same shape as coin's vault17 (× log(OLA[340])).
    case "vault35": {
      const v = vaultUpgBonus(35, s);
      const lg = getLOG(ola(345));
      return pct("Schoolin' the Fish (Vault 35)", v * lg, [
        raw("Vault 35", v),
        raw("Total fish caught (log10)", lg, "log10(OLA[345])"),
      ], "× log10(total fish caught) (OLA[345])");
    }
    // N.js GetSetBonus("IRON_SET","Bonus",0,0)
    case "ironSet": {
      const r = getSetBonus("IRON_SET");
      return pct("Iron Set", r.val, r.children);
    }
    // @njs ExoticBonusQTY — N.js FarmingStuffs("ExoticBonusQTY",50,0), ×2 when
    // a Menagerie doubler sits on it (Spelunk[50], 2026-10-16).
    case "exotic50":
      return pct("Intelleaf (Exotic Market 50)", exoticBonusQTY(50, s), [raw("Menagerie doubler", exoticDoubled(50, s) ? 1 : 0)], "Doubled by a Menagerie doubler");
    // N.js OptionsListAccount[421]
    case "ola421":
      return pct("Class EXP from Monsters (Hoops Shop 2)", ola(421), null, "Level of Hoops shop upgrade 2 (OLA[421])");
    // N.js StampBonusOfTypeX("classxp")
    case "stampClassxp": {
      const r = computeStampBonusOfTypeX("classxp", s);
      return pct("Gud EXP Stamp (Stamp A44)", r.val, r.children, "StampBonusOfTypeX(\"classxp\")");
    }
    // @njs FriendBonusStatz — N.js Thingies("FriendBonusStatz",1,0)
    case "friend1":
      return renamed(friend.resolve(1, { saveData: s }), "Class EXP Gain (Friend Bonus 1)", "Friend bonus type 1; scales with account level");
    // @njs Button_Bonuses — N.js Minehead("Button_Bonuses",8,0), slot 8 is "Class XP".
    case "button8":
      return pct("Class XP (Minehead Button 8)", computeButtonBonus(8, s), null, "Button slot 8");

    default:
      throw new Error(`exp: unknown source "${id}"`);
  }
}

export const exp = { resolve: resolveExp };
