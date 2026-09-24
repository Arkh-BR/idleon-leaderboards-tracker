// ===== EXP SYSTEM =====
// One id per term of N.js x._customBlock_ExpMulti(0) (@4238487). Each case
// returns what its group consumes: a FACTOR in mult groups (G1, G3–G8), a
// % amount in pct groups (G2, G9, G10). defs/exp-multi.ts owns the shapes.
// Existing helpers are reused as-is; new ports live in this folder.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData, divinityData } from "../../../save/data";
import { superBitType, cloudBonus } from "../../../game-helpers";
import { label } from "../../entity-names";
import { MapAFKtarget, ZenithMarket } from "../../data/game/customlists.js";

import { talent } from "../common/talent";
import { companions } from "../common/companions";
import { etcBonus } from "../common/etcBonus";
import { workshop } from "../common/wrappers";
import { computeCardBonusByType } from "../common/stats";
import { computeCardSetBonus } from "../common/cards";
import { gridBonusValue } from "../w4/lab";
import { jellyRoGBonus } from "../../data/w7/jelly";
import { arcadeBonus } from "../w2/arcade";
import { computeVialByKey } from "../w2/alchemy";
import { computeArcaneMapMultiBon } from "../mc/tesseract";
import { computeBigFishBonus } from "../w7/spelunking";
import { sushiRoG } from "../w7/sushi";
import { fountainBonusTotal } from "../../data/w5/fountain";
import { royalStatue } from "../w7/royalG";
import { computeMeritocBonusz } from "../w7/meritoc";

import { medallionList } from "./medallions";
import { isLowestLevel } from "./lowestLevel";

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

// G10 (➕ Additive Pool, defs/exp-multi.ts) — every id ported in Task 3. Kept
// as one guard clause (instead of 60 near-identical case labels) so Task 3's
// diff is just "remove the id here, add its real case" per source.
const G10_PENDING = new Set<string>([
  "luk", "talent35", "etc4", "boxMonsterExp", "food", "starSignMainXP", "vialMonsterExp",
  "bubbleExp", "card44",
  "merit3", "vault12", "cardSet0", "mealClexp", "weeklyBoss", "newbie", "divMinor4", "cardSet5",
  "statue10", "talent632", "shrine5", "saltLick3", "prayer0", "prayer2", "prayer9", "flurbo2",
  "ach57", "ach357", "ach61", "ach124", "ach188", "arcade12", "sigil8", "ach286", "shiny1",
  "msa4", "talent55",
  "cardSpring", "comp3", "comp50add", "shimmer179", "goldFood", "owl0", "vote15", "monument1_6",
  "compass51", "hole47", "win23", "grimoire24", "vault3", "vault35", "hole83",
  "ironSet", "exotic50", "ola421", "stampClassxp", "friend1", "comp47", "comp111", "button8",
  "comp128add",
]);

// "boxMonsterExp" → "Box Monster Exp" — readable label for a pending() row.
function niceName(id: string): string {
  return id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

// Flat companion terms — (1 + coeff·Companions(n)). comp128 (min/CompLV2) and
// comp50 (clamp) have their own shape and are handled as separate cases.
const COMP_COEF: Record<string, number> = {
  comp37: 9, comp33: 1, comp32: 1, comp34: 1, comp145: 1, comp160: 4, comp168: 0.4,
};

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

    default:
      throw new Error(`exp: unknown source "${id}"`);
  }
}

export const exp = { resolve: resolveExp };
