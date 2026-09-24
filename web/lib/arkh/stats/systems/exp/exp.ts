// ===== EXP SYSTEM =====
// One id per term of N.js x._customBlock_ExpMulti(0) (@4238487). Each case
// returns what its group consumes: a FACTOR in mult groups (G1, G3–G8), a
// % amount in pct groups (G2, G9, G10). defs/exp-multi.ts owns the shapes.
// Existing helpers are reused as-is; new ports live in this folder.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData, divinityData } from "../../../save/data";
import { superBitType, cloudBonus } from "../../../game-helpers";
import { formulaEval, getLOG } from "../../../formulas";
import { label } from "../../entity-names";
import { MapAFKtarget, ZenithMarket, GrimoireUpg, DungPassiveStats2 } from "../../data/game/customlists.js";

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
import { jellyRoGBonus } from "../../data/w7/jelly";
import { arcadeBonus } from "../w2/arcade";
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
import { computePrayerReal } from "../w3/prayer";
import { computeShrine } from "../w3/construction";
import { getSetBonus } from "../w3/setBonus";
import { holes, computeMonumentROGbonus } from "../w5/hole";
import { computeWinBonus } from "../w6/summoning";
import { computeExoticBonus } from "../w6/farming";
import { grimoireUpgBonus } from "../mc/grimoire";
import { computeButtonBonus } from "../w7/button";
import { divinityMinorSum } from "../coin/divinityMinor";
import { votingMulti } from "../coin/coin";

import { medallionList } from "./medallions";
import { isLowestLevel } from "./lowestLevel";
import { compassBonus } from "./compass";

/** Class talents in the EXP formula (read from the active character).
 *  55/328/429/434 are account-wide (getbonus2), 632 is a star talent. */
export const EXP_CLASS_TALENTS = [35] as const;

const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
/** Terms ported in a later task of the EXP plan; neutral until then. */
const pending = (name: string, neutral: number): ArkhNode =>
  node(name, neutral, null, { fmt: neutral === 1 ? "x" : "+", note: "pending port" });

// G10 (➕ Additive Pool, defs/exp-multi.ts) — Task 4 ports these last three
// (unported subsystems: regular Food, Salt Lick, the live-NPC MSA counter).
// Every other G10 id is a real case below.
const G10_PENDING = new Set<string>(["food", "saltLick3", "msa4"]);

// "boxMonsterExp" → "Box Monster Exp", "saltLick3" → "Salt Lick 3" — readable
// label for a pending() row (space before both a case change and a trailing number).
function niceName(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d+)$/, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

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
function arrCount(v: unknown): number {
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

// N.js x._customBlock_ExpMulti(0) — the snapshot key is the underscore-led
// "_customBlock_ExpMulti", which the registry guard's regex can't capture
// (it requires a letter first); per-case @njs tags below cite the specific
// sub-formula each case ports instead, where one is separately named.
function resolveExp(id: string, ctx: SystemCtx): ArkhNode {
  if (G10_PENDING.has(id)) return pending(niceName(id), 0);

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

    // @njs 1==BundlesReceived.bun_q → LUK3 += 20
    case "bunQ": {
      const owned = Number((s.bundlesData as any)?.bun_q) === 1 ? 1 : 0;
      return pct("EXP Bundle (bun_q)", owned ? 20 : 0, [raw("Owned", owned)]);
    }
    // @njs SuperBitType — N.js Tasks[2][0][2]>0 lowest-level block →
    // 1==SuperBitType(19) → LUK3=50
    case "superbit19": {
      const merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0;
      const lowest = isLowestLevel(ci, s) ? 1 : 0;
      const bit = superBitType(19, (s.gamingData as any)?.[12]);
      const active = merit > 0 && lowest === 1 && bit === 1;
      return pct(
        "Noobie Gains (Super Bit 19) · lowest-level character",
        active ? 50 : 0,
        [raw("Merit (Tasks[2][0][2])", merit), raw("Lowest level", lowest), raw("Super Bit 19", bit)]
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
        [raw("Medallion owned (map's monster)", gate ? 1 : 0), raw("Talent 429 (getbonus2)", Number(t.val) || 0)],
        `Map ${map} · ${monster}`
      );
    }

    // @njs (1+9·Companions(37)) / (1+Companions(n)) / (1+4·Companions(160)) /
    // (1+.4·Companions(168)) — flat coefficient off COMP_COEF.
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
    // @njs RoG_BonusQTY — (1+JellyOperation("RoG_BonusQTY",n,0)/100)
    case "jelly30":
    case "jelly62": {
      const n = Number(id.slice(5));
      const v = jellyRoGBonus(n, s);
      return factor(`Jelly Operation ${n}`, 1 + v / 100, [raw("Jelly RoG bonus", v)]);
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
        "Research Grid (130·131·132·152)",
        1 + (g130 + g131 + g132 + g152) / 100,
        [raw("Grid 130", g130), raw("Grid 131", g131), raw("Grid 132", g132), raw("Grid 152", g152)]
      );
    }
    // Task 4 port — FarmingStuffs("StickerBonus",0,0).
    case "sticker0":
      return pending("Sticker 0", 1);
    // @njs (1+.1·SuperBitType(63))
    case "superbit63": {
      const bit = superBitType(63, (s.gamingData as any)?.[12]);
      return factor("Experienced Gamer (Super Bit 63)", 1 + 0.1 * bit, [raw("Super Bit 63", bit)]);
    }
    // @njs ZenithMarketBonus — floor(ZenithMarket[9][4]·Spelunk[45][9])
    case "zenith9": {
      const perLv = Number((ZenithMarket as any)?.[9]?.[4]) || 0;
      const lv = Number((s.spelunkData as any)?.[45]?.[9]) || 0;
      const zen = Math.floor(perLv * lv);
      return factor("Zenith Market 9", 1 + zen / 100, [
        raw("ZenithMarket[9][4]", perLv),
        raw("Spelunk[45][9] level", lv),
      ]);
    }
    // @njs (1+EtcBonuses("84")/100)
    case "etc84": {
      const e = etcBonus.resolve(84, { saveData: s, charIdx: ci });
      return factor("Class EXP multi gear (Etc 84)", 1 + Number(e.val) / 100, [e]);
    }
    // @njs (1+CardBonusREAL(100)/100)
    case "card100": {
      const cb = computeCardBonusByType(100, ci, s);
      return factor("Cards (Card Type 100)", 1 + Number(cb.val) / 100, cb.children);
    }
    // @njs (1+ArcadeBonus(60)/100)
    case "arcade60": {
      const a = arcadeBonus(60, s);
      return factor(label("Arcade", 60), 1 + Number(a.val) / 100, a.children);
    }
    // @njs (1+AlchVials["7classexp"]/100)
    case "vialClassExp": {
      const v = computeVialByKey("7classexp", s);
      return factor("Class EXP vial (7classexp)", 1 + Number(v.val) / 100, v.children);
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
      return factor("Arcane map bonus (slot 1, EXP)", 1 + bon / 100, [raw("Kills (mapBon[map][1])", kills)]);
    }
    // @njs BigFishBonuses — (1+Spelunk("BigFishBonuses",4,0)/100)
    case "bigFish4": {
      const b = computeBigFishBonus(4, s);
      return factor("Big Fish 4", 1 + b / 100, [raw("Big Fish 4 bonus", b)]);
    }
    // Task 4 port — Thingies("DancingCoralBonus",3,0).
    case "dancingCoral3":
      return pending("Dancing Coral 3", 1);
    // @njs CoralKidUpgBonus — pow(1+CoralKidUpgBonus(2)/100, max(0,Divinity[25]-10));
    // CoralKidUpgBonus(2) = 20·OLA[429]/(25+OLA[429]).
    case "coralKid": {
      const o429 = ola(429);
      const ck = (20 * o429) / (25 + o429);
      const rank = Math.max(0, (Number((divinityData as any)?.[25]) || 0) - 10);
      return factor("Coral Kid 2 ^ God Rank", Math.pow(1 + ck / 100, rank), [
        raw("Coral Kid 2 (%)", ck),
        raw("God Rank", rank),
      ]);
    }
    // @njs (1+CardSetBonuses(0,"12")/100) — computeCardSetBonus is the direct
    // port of _customBlock_CardSetBonuses (Cards[3] keyed by IDforCardSETbonus).
    case "cardSet12": {
      const cs = computeCardSetBonus(ci, "12");
      return factor("Card Set 12", 1 + Number(cs.val) / 100, cs.children);
    }
    // Task 4 port — Bubbastuff("BubbaRoG_Bonuses",6,0).
    case "bubba6":
      return pending("Bubba RoG 6", 1);
    // @njs RoG_BonusQTY — (1+SushiStuff("RoG_BonusQTY",15,0)/100)
    case "sushi15": {
      const su = sushiRoG.resolve(15, ctx as any);
      return factor("Sushi RoG 15", 1 + Number(su.val) / 100, [su]);
    }
    // @njs CloudBonus — (1+5·Dreamstuff("CloudBonus",70)/100)
    case "cloud70": {
      const c = cloudBonus(70, s.weeklyBossData);
      return factor("Equinox cloud 70 (×5)", 1 + (5 * c) / 100, [raw("Dream Challenge 70 completed", c)]);
    }
    // @njs Fountain_BonTOT — (1+Holes2("Fountain_BonTOT",0,16)/100)
    case "fountain16": {
      const f = fountainBonusTotal(s, 0, 16);
      return factor("Fountain 16", 1 + f / 100, [raw("Fountain bonus 16", f)]);
    }
    // @njs StatueBon — (1+RoyalG("StatueBon",3,0)/100)
    case "royalStatue3": {
      const r = royalStatue.resolve(3, ctx as any);
      return factor(r.name, 1 + Number(r.val) / 100, r.children);
    }
    // @njs MeritocBonusz — max(1, pow(1.03,Spelunk[6].length)·SuperBitType(24)·
    //   (1+Meritoc2("MeritocBonusz",27,0)/100)·(1+max(0,5·(OLA[464]-8))/100))
    case "classy": {
      const n = arrCount((s.spelunkData as any)?.[6]);
      const bit24 = superBitType(24, (s.gamingData as any)?.[12]);
      const meritoc27 = computeMeritocBonusz(27, s);
      const o464 = ola(464);
      const val = Math.max(
        1,
        Math.pow(1.03, n) * bit24 * (1 + meritoc27 / 100) * (1 + Math.max(0, 5 * (o464 - 8)) / 100)
      );
      return factor("Classy Discoveries", val, [
        raw("Spelunk[6].length", n),
        raw("Super Bit 24", bit24),
        raw("Meritoc 27", meritoc27),
        raw("OLA[464]", o464),
      ]);
    }
    // N.js EtcBonuses("78")
    case "etc78":
      return etcBonus.resolve(78, { saveData: s, charIdx: ci });

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
      return etcBonus.resolve(4, { saveData: s, charIdx: ci });
    // N.js BoxRewards.monsterExp — Box of Unwanted Stats slot 2 (N.js
    // PostOffUpgradeInfo row: "...decay %_Monster_EXP...acc def monsterExp").
    case "boxMonsterExp": {
      const r = computeBoxReward(ci, "monsterExp");
      return pct("Post Office (Monster EXP)", r.val, r.children);
    }
    // N.js StarSigns.MainXP
    case "starSignMainXP": {
      const r = computeStarSignBonus("MainXP", ci, s);
      return pct("Star Sign (Main XP)", r.val, r.children);
    }
    // N.js AlchVials.MonsterEXP
    case "vialMonsterExp": {
      const r = computeVialByKey("MonsterEXP", s);
      return pct("Vials (Monster EXP)", r.val, r.children);
    }
    // N.js AlchBubbles.expACTIVE
    case "bubbleExp": {
      const r = bubbleValByKey("expACTIVE", ci, s);
      return pct("Bubble (Class EXP Active)", r.val, r.children);
    }
    // N.js CardBonusREAL(44)
    case "card44": {
      const r = computeCardBonusByType(44, ci, s);
      return pct("Class EXP Cards (Card Type 44)", r.val, r.children);
    }
    // N.js Tasks[2][0][2]>0 lowest-level block: ExpGainLUK2 = 3*merit + Vault12
    // — active only when the block's gate (merit owned + lowest-level char)
    // holds; see SP/exp/semantics.md §4.
    case "merit3": {
      const merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0;
      const active = merit > 0 && isLowestLevel(ci, s);
      return pct("Merit (Lowest-Level Family)", active ? 3 * merit : 0, [
        raw("Merit (Tasks[2][0][2])", merit),
        raw("Lowest level", active ? 1 : 0),
      ]);
    }
    // @njs VaultUpgBonus — same block as merit3, gated on the lowest-level char.
    case "vault12": {
      const merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0;
      const active = merit > 0 && isLowestLevel(ci, s);
      const v = active ? vaultUpgBonus(12, s) : 0;
      return pct(label("Vault", 12), v, [raw("Lowest level", active ? 1 : 0)]);
    }
    // N.js Lv0<50 → CardSetBonuses(0,"0") — same equipped-set semantics as
    // Task 2's cardSet12 (computeCardSetBonus), key "0".
    case "cardSet0": {
      if (level >= 50) return pct("Card Set 0", 0);
      const cs = computeCardSetBonus(ci, "0");
      return pct("Card Set 0", Number(cs.val) || 0, cs.children);
    }
    // N.js Lv0<120 → MealBonus("Clexp")
    case "mealClexp": {
      if (level >= 120) return pct("Meals (Clexp)", 0);
      const m = computeMealBonus("Clexp", s);
      return pct("Meals (Clexp)", m.val, m.children);
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
      return pct("Newbie Bracket", val, [raw("Class Level", level)]);
    }
    // @njs Bonus_Minor — N.js Divinity("Bonus_Minor", playerIdx, 4)
    case "divMinor4":
      return pct("Divinity Minor Bonus (Class EXP)", divinityMinorSum(4, ci, s));
    // N.js CardSetBonuses(0,"5") — same system+id already wired into DR (G7).
    case "cardSet5":
      return cardSet.resolve(5, ctx as any);
    // N.js ArbitraryCode("StatueBonusGiven10") — added directly, no ÷100
    // (unlike Coin's statue19: EXP's whole G10 pool is what gets ÷100).
    case "statue10": {
      const r = computeStatueBonusGiven(10, ci, s);
      return pct(label("Statue", 10), r.val, r.children);
    }
    // N.js GetTalentNumber(1,632) — star talent (id≥615), active character.
    case "talent632":
      return talent.resolve(632, tctx);
    // N.js Shrine(5)
    case "shrine5":
      return pct(label("Shrine", 5), computeShrine(5, s));
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
    // N.js FlurboShop(2) — same 4-line idiom as coin's flurbo4, idx 2.
    case "flurbo2": {
      const row = ((DungPassiveStats2 as any[])[2] ?? []) as unknown[];
      const lv = Number((s.dungUpgData as any[])?.[5]?.[2]) || 0;
      const v = formulaEval(String(row[3]), Number(row[1]), Number(row[2]), lv);
      return pct("Flurbo Shop 2 (Class EXP)", v, [raw("Level", lv)]);
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
      const name = w === 1 ? label("Achievement", n) : `${label("Achievement", n)} × ${w}`;
      return pct(name, w * achieveStatus(n, s));
    }
    // N.js ArcadeBonus(12)
    case "arcade12": {
      const a = arcadeBonus(12, s);
      return pct(label("Arcade", 12), a.val, a.children);
    }
    // N.js Labb("SigilBonus","Blank",8,0)
    case "sigil8":
      return pct(label("Sigil", 8), sigilBonus(8, s));
    // @njs ShinyBonusS — N.js Breeding("ShinyBonusS","Nah",1,-1)
    case "shiny1":
      return pct("Shiny Pets (Breeding 1)", computeShinyBonusS(1, s));
    // N.js getbonus2(1,55,-1) — account-wide (EXP Cultivation).
    case "talent55":
      return talent.resolve(55, tctx);
    // @njs CardLv — N.js 2*RunCodeOfTypeXforThingY("CardLv","springEvent1")
    case "cardSpring": {
      const lv = computeCardLv("springEvent1", s);
      return pct(`${label("Card", "springEvent1")} × 2`, 2 * lv, [raw("Card Lv", lv)]);
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
      return pct("Island Shimmer (OLA[179])", o179 * shim, [
        raw("OLA[179]", o179),
        raw("Shimmer multi", shim),
      ]);
    }
    // N.js GoldFoodBonuses("ClassEXPz")
    case "goldFood":
      return pct("Golden Food (ClassEXPz)", goldFoodBonuses("ClassEXPz", ci, undefined, s).total);
    // N.js Summoning("OwlBonuses",0,0)
    case "owl0":
      return owl.resolve(0, ctx as any);
    // N.js Summoning("VotingBonusz",15,0) — shares Coin's votingMulti(ctx).
    case "vote15": {
      const multi = votingMulti(ctx);
      const v = votingBonusz(15, multi, s);
      return pct("Vote 15 (Class EXP)", v, [raw("Voting multi", multi)]);
    }
    // @njs MonumentROGbonuses — N.js Holes("MonumentROGbonuses",1,6)
    case "monument1_6":
      return pct("Monument ROG Bonus (tier 1, idx 6)", computeMonumentROGbonus(1, 6, s));
    // @njs CompassBonus — N.js Windwalker("CompassBonus",51,0), Moon of Experience.
    case "compass51":
      return pct(label("Compass", 51), compassBonus(51, s));
    // @njs B_UPG — N.js Holes("B_UPG",47,0) / Holes("B_UPG",83,40); data
    // extended (game-constants.ts) with upg47/upg83.
    case "hole47":
      return holes.resolve("upg47", ctx as any);
    case "hole83":
      return holes.resolve("upg83", ctx as any);
    // @njs WinBonus — N.js ExpMulti(999) = Summoning("WinBonus",23,0)
    case "win23":
      return pct("Win Bonus 23", computeWinBonus(23, null, s));
    // @njs GrimoireUpgBonus — N.js Summoning("GrimoireUpgBonus",24,0)
    case "grimoire24":
      return pct(label("Grimoire", 24), grimoireUpgBonus(24, GrimoireUpg, s));
    // @njs VaultUpgBonus — N.js Summoning("VaultUpgBonus",3,0)
    case "vault3":
      return pct(label("Vault", 3), vaultUpgBonus(3, s));
    // @njs VaultUpgBonus — N.js Summoning("VaultUpgBonus",35,0) * getLOG(OLA[345]),
    // same shape as coin's vault17 (× log(OLA[340])).
    case "vault35": {
      const v = vaultUpgBonus(35, s);
      const lg = getLOG(ola(345));
      return pct(`${label("Vault", 35)} × log(OLA[345])`, v * lg, [
        raw("Vault 35", v),
        raw("log10(OLA[345])", lg),
      ]);
    }
    // N.js GetSetBonus("IRON_SET","Bonus",0,0)
    case "ironSet": {
      const r = getSetBonus("IRON_SET");
      return pct("Iron Set", r.val, r.children);
    }
    // @njs ExoticBonusQTY — N.js FarmingStuffs("ExoticBonusQTY",50,0)
    case "exotic50":
      return pct("Exotic Market 50", computeExoticBonus(50, s));
    // N.js OptionsListAccount[421]
    case "ola421":
      return pct("Account Option 421", ola(421));
    // N.js StampBonusOfTypeX("classxp")
    case "stampClassxp": {
      const r = computeStampBonusOfTypeX("classxp", s);
      return pct("Stamp (Class XP)", r.val, r.children);
    }
    // @njs FriendBonusStatz — N.js Thingies("FriendBonusStatz",1,0)
    case "friend1":
      return friend.resolve(1, { saveData: s });
    // @njs Button_Bonuses — N.js Minehead("Button_Bonuses",8,0), slot 8 is "Class XP".
    case "button8":
      return pct("Button: Class XP (Slot 8)", computeButtonBonus(8, s));

    default:
      throw new Error(`exp: unknown source "${id}"`);
  }
}

export const exp = { resolve: resolveExp };
