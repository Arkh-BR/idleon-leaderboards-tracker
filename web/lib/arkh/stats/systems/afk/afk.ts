// ===== AFK GAINS SYSTEM =====
// One id per term of N.js k._customBlock_AFKgainrates("Fighting") (@4421667,
// live sha 6de681a96813; verbatim text in SP/afk/afkfn.txt). Pool terms return
// a % amount (defs/afk-gains.ts sums them into Σ); the map rules return what
// afkRate() reads: R1 a factor, R2 the Cove's replacement rate, R3 0 or 1.
// Existing helpers are reused as-is. The spec A4 fixes are new functions next
// to the old ones, which keep feeding the Drop Rate.

import { node, renamed, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { label } from "../../entity-names";
import { MapAFKtarget, RandoListo2 } from "../../data/game/customlists.js";
import { MONSTERS } from "../../data/game/monsters.js";
import { AFK_NODES, AFK_VOTE_NAME } from "../../defs/afk-gains";
import { talent } from "../common/talent";
import { companions } from "../common/companions";
import { etcBonus } from "../common/etcBonus";
import { familyBonus } from "../common/familyBonus";
import { guild } from "../common/guild";
import { goldFoodBonuses } from "../common/goldenFood";
import { vaultUpgBonus } from "../common/vault";
import { computeBoxReward, computeCardBonusByType } from "../common/stats";
import { computeCardLv, computeCardSetBonus } from "../common/cards";
import { arcadeBonus } from "../w2/arcade";
import { votingBonusz } from "../w2/voting";
import { getBribeBonus } from "../w3/bribe";
import { computeShrine } from "../w3/construction";
import { computeWinBonus } from "../w6/summoning";
import { computeArcaneMapMultiBon } from "../mc/tesseract";
import { divinityMinorSum } from "../coin/divinityMinor";
import { votingMulti, flurboShop, rooBonus } from "../coin/coin";
import { compassBonus } from "../exp/compass";
import { prayersReal } from "../w3/prayer";
import { chipBonuses } from "../w4/lab";
import { starSignBonusReal } from "../common/starSign";
import { setBonus } from "../w3/setBonus";
import { bonusMajorReal } from "../w5/divinity";

/** Class talents of the formula (per-character GetTalentNumber) — spec A10.
 *  621 (Tick Tock) and 650 (Rando Event Looty) are star talents of every class. */
export const AFK_CLASS_TALENTS = [79, 88, 268, 448] as const;

// Name + tooltip of the three EtcBonuses sources that share a case (the game's names; jargon goes in the tooltip).
const ETC_NAMES: Record<string, [string, string]> = {
  etc20: ["Fight AFK Gain (Equipment)", "EtcBonuses(20) = %_FIGHT_AFK_GAIN"],
  etc59: ["All AFK Gain (Equipment)", "EtcBonuses(59) = %_ALL_AFK_GAIN"],
};

const raw = (name: string, v: number, note?: string): ArkhNode => node(name, v, null, { fmt: "raw", note });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });

// @njs _customBlock_AFKgainrates
function resolveAfk(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const map = ctx.mapIdx ?? (Number((currentMapData as any)?.[ci]) || 0);
  const cavern = Number((s.holesData as any)?.[0]?.[ci]);
  const cove = map === 216 && cavern === 17;

  switch (id) {
    // ── Fighting terms (N.js order) ──
    // N.js (.4 + (…)/100): the 0.4 base as a visible 40% source (spec A3).
    case "base":
      return pct("Base fighting rate (40%)", 40);
    // N.js DNSM.FamBonusQTYs["8"] — the active char's Family Guy buff included.
    case "fam8":
      return familyBonus.resolve(4, tctx);
    // N.js DNSM.BoxRewards.fightAFK (Civil War Memory Box).
    case "boxFightAFK": {
      const r = computeBoxReward(ci, "fightAFK");
      return pct("Post Office (fightAFK)", r.val, r.children);
    }
    // N.js GetTalentNumber(1,n) / TalentCalc(650): talent.resolve already
    // returns the wrapped value. The label keeps "(Talent n)" — the
    // collector's class gating matches that suffix.
    case "talent88":
    case "talent268":
    case "talent448":
    case "talent621":
    case "talent79":
    case "talent650": {
      const n = Number(id.slice(6));
      const t = talent.resolve(n, tctx);
      return pct(label("Talent", n), Number(t.val) || 0, t.children);
    }
    case "bribe3": {
      const r = getBribeBonus("3", s);
      return pct("Sleeping on the Job (Bribe 3)", r.val, r.children, "+5% fighting AFK gains rate");
    }
    case "cardSet10": {
      const r = computeCardSetBonus(ci, "10");
      return pct("Fight AFK Gain Rate Set Bonus (Card Set 10)", r.val, r.children);
    }
    case "card43": {
      const r = computeCardBonusByType(43, ci, s);
      return pct("Fighting AFK Cards (Card Type 43)", r.val, r.children);
    }
    // N.js EtcBonuses("20") / ("59") — numeric ids (a string id drops gallery items).
    case "etc20":
    case "etc59":
      return renamed(etcBonus.resolve(Number(id.slice(3)), { saveData: s, charIdx: ci }), ...ETC_NAMES[id]);
    // N.js DNSM.StarSigns.FightAFK — the active-signs port (spec A4).
    case "starFightAFK": {
      const r = starSignBonusReal("FightAFK", ci, s);
      return pct("Star Signs: Fighting AFK", r.val, r.children, "StarSigns.FightAFK: Silly Snoozer (19), The Forsaken (28), Mr No Sleep (29, negative), S. Snoozer Major (56)");
    }
    case "guild4":
      return renamed(guild.resolve(4, tctx), "REM Fighting (Guild 4)");
    // N.js prayersReal(4,0) — with the super-bit branch (spec A4).
    case "prayer4": {
      const r = prayersReal(4, 0, ci, s);
      return pct(label("Prayer", 4), r.val, r.children);
    }
    // N.js −prayersReal(12,1): the Ruck Sack curse. Kept NEGATIVE (−89 on
    // Markhe, Ruck Sack equipped at level 50) — prayersReal(12,1,…) itself
    // returns 0 in the super-bit branch (cost===1 short-circuits), so this
    // only differs from 0 through the equipped branch of computePrayerReal.
    case "curse12": {
      const r = prayersReal(12, 1, ci, s);
      return pct("Ruck Sack curse (Prayer 12)", -r.val, r.children);
    }
    // N.js chipBonuses("fafk") — the active character's chips only.
    case "chipFafk":
      return pct("Conductive Software (Lab Chip 7)", chipBonuses("fafk", ci), null, "Chip effect key fafk; only the active character's chips");
    // N.js CardLv("w6d1") ×1.
    case "cardW6d1":
      return pct(label("Card", "w6d1"), computeCardLv("w6d1", s), null, "Fighting AFK, passive (×1)");

    // ── ALL (every AFK type) ──
    // N.js Tasks[2][1][2] > charIdx → AFKgainzzALL = 2 (the W2 merit).
    case "merit": {
      const lv = Number((s.tasksGlobalData as any)?.[2]?.[1]?.[2]) || 0;
      return pct("Merit: AFK Gains for First Characters", lv > ci ? 2 : 0, [
        raw("Merit level (Tasks[2][1][2])", lv),
      ], "+2% AFK Gains for your first N characters (N = merit level, Tasks[2][1][2]); World 2 merit");
    }
    case "arcade6": {
      const r = arcadeBonus(6, s);
      return pct(label("Arcade", 6), r.val, r.children);
    }
    // N.js Windwalker("CompassBonus",57,0): CompassUpg[57][9] = 0, so no
    // compass 39/80 factor (EXP Task 3's compassBonus handles both branches).
    case "compass57":
      return pct("Moon of Sleep (Compass 57)", compassBonus(57, s));
    // N.js GetSetBonus("VOID_SET","Bonus",0,0): OLA[379] ∪ worn parts (spec A11).
    case "voidSet":
      return renamed(setBonus.resolve("void", { saveData: s, charIdx: ci }), "Void Set Bonus", "Equipment set \"void\" (OLA[379] plus worn parts)");
    case "flurbo7": {
      const r = flurboShop(7, s);
      return pct("AFK Gains (Flurbo Shop 7)", r.val, r.children);
    }
    // N.js 30*Divinity("Bonus_MAJOR", ci, 0) — Snehebatu's +30% AFK Gains.
    case "divMajor": {
      const on = bonusMajorReal(ci, 0, s) ? 1 : 0;
      return pct("Snehebatu Major Bonus (Divinity 0)", 30 * on, [raw("Major bonus active", on)], "+30% AFK Gains while the active character is linked (×30)");
    }
    // N.js Divinity("Bonus_Minor",-1,5).
    case "divMinor5":
      return pct("AFK Gains (Divinity Minor Bonus 5)", divinityMinorSum(5, ci, s), null, "Σ over the linked gods' minor bonus, type 5");
    case "comp6":
    case "comp25": {
      const n = Number(id.slice(4));
      return pct(label("Companion", n), companions(n, s));
    }
    // N.js Shrine(8) — its map gate isn't modelled (spec A5, like DR and EXP).
    case "shrine8":
      return pct(label("Shrine", 8), computeShrine(8, s), null, "treated as always active (map gate not modelled)");
    case "winBonus11":
      return pct("AFK Gains (Winner Bonus 11)", computeWinBonus(11, null, s), null, "Summoning winner bonus 11");
    case "goldFoodAllAFK":
      return pct("Golden Dumpling (Golden Food)", goldFoodBonuses("AllAFK", ci, undefined, s).total, null, "Σ of equipped + Emporium golden foods with effect AllAFK");
    // N.js 1.5*CardLv("w6d3").
    case "cardW6d3": {
      const lv = computeCardLv("w6d3", s);
      return pct(label("Card", "w6d3"), 1.5 * lv, [raw("Card level", lv)], "All AFK, passive; × 1.5 per card level");
    }
    // N.js Summoning("RooBonuses",5,0) — coefficient .5, offset 5.
    case "roo5": {
      const r = rooBonus(5, 0.5, s);
      return pct("Fisheroo Reset (Poppy Upgrade 5)", r.val, r.children, "Poppy the Kangaroo Mouse upgrade (code name RooBonuses 5), coefficient 0.5");
    }
    // N.js Summoning("VotingBonusz",6,0): 0 unless vote 6 is the active one.
    case "vote6": {
      const m = votingMulti(ctx);
      return pct(AFK_VOTE_NAME, votingBonusz(6, m, s), [factor("Voting multi", m)], "Only counts the week vote 6 wins");
    }
    // N.js 20*EventShopOwned(5).
    case "eventShop5": {
      const owned = eventShopOwned(5, s.cachedEventShopStr || "");
      return pct("Sleepy Joe Armstrong (Event Shop 5)", 20 * owned, [raw("Owned", owned)], "×20: +20% AFK gains");
    }
    case "vault23":
      return pct("Sleepy Time (Vault 23)", vaultUpgBonus(23, s));
    // N.js 1==BundlesReceived.bun_u → AFKgainzzALL += 30 (after MULTI, still in ALL).
    case "bunU": {
      const owned = Number((s.bundlesData as any)?.bun_u) === 1 ? 1 : 0;
      return pct("AFK Bundle", 30 * owned, [raw("Owned", owned)], "bun_u: clothes pack, +30% AFK gains; no in-game title");
    }

    // ── MULTI ──
    // N.js ArcaneType("ArcaneMapMulti_bon",2,0) = min(bonMAX, ArcaneMapMulti(MapBon[map][2])).
    case "arcaneMapAfk": {
      const kills = Number((ctx.mapBon as any)?.[map]?.[2]) || 0;
      return pct(
        "Arcane Map Bonus: AFK Gains",
        computeArcaneMapMultiBon(2, { ...ctx, mapIdx: map } as any),
        [raw("Kills (mapBon[map][2])", kills)],
        "MapBon slot 2 kills"
      );
    }
    case "etc92":
      return renamed(etcBonus.resolve(92, { saveData: s, charIdx: ci }), "AFK Gains Multi (Equipment)", "EtcBonuses(92) = %_AFK_GAINS_MULTI");

    // ── Map rules (spec A3 / A9) ──
    // N.js 306==CurrentMap → AFKgainzzDNz = .2*(…the same sum…).
    case "clamworks306":
      return factor(AFK_NODES.clam, map === 306 ? 0.2 : 1, null, `×0.2 on map 306 · ${map === 306 ? "Clamworks: AFK gains are 1/5" : `map ${map}: no effect`}`);
    // N.js 216==CurrentMap && 17==Holes[0][ci] → AFKgainzzDNz =
    // Holes2("Cglunko_AFKgains") × (1 + 30·min(1, bun_u)/100), with
    // Cglunko_AFKgains = (10 + Cglunko_upgBon(8) + Cglunko_upgBon(13))/100 (@10969315)
    // and Cglunko_upgBon(i) = OLA[630+i]·RandoListo2[13][i] (@10969789).
    // @njs _customBlock_Holes2
    case "cglunkoCove": {
      const u8 = ola(638) * (Number((RandoListo2 as any)[13]?.[8]) || 0);
      const u13 = ola(643) * (Number((RandoListo2 as any)[13]?.[13]) || 0);
      const bun = Math.min(1, Number((s.bundlesData as any)?.bun_u) || 0);
      const rate = ((10 + u8 + u13) / 100) * (1 + (30 * bun) / 100);
      return factor(
        AFK_NODES.cove,
        cove ? rate : 0,
        [
          raw("The character's cavern", cavern, "Holes[0][char]"),
          raw("Sleepy Drops (Cove Upgrade 8)", u8, "Boost AFK Gains rate in the Cove"),
          raw("Sleepy Drops+ (Cove Upgrade 13)", u13, "Boost AFK Gains rate in the Cove"),
          raw("AFK Bundle", bun, "×(1 + 30% with the bundle)"),
        ],
        `Map 216 (The Hole), cavern 17 (The Cove); replaces the whole rate${cove ? "" : " · inactive: not map 216 in cavern 17"}`
      );
    }
    // AFK Info dispatch (@3786279): the panel shows AFKgainrates(type of the
    // AFK target); "Nothing" / "Paying_Respect" print a literal 0%. The page
    // uses the map's default target (spec A9 — AFKtarget_N only describes the
    // saved map); the Cove counts as a fight (@11987854).
    case "afkType": {
      const monster = String((MapAFKtarget as any)[map] ?? "");
      const type = cove ? "FIGHTING" : String((MONSTERS as any)[monster]?.AFKtype ?? "no definition");
      const none = type === "Nothing" || type === "Paying_Respect" || type === "no definition";
      const skill = !none && type !== "FIGHTING";
      return factor(
        AFK_NODES.type,
        none ? 0 : 1,
        null,
        `Map ${map} · ${cove ? "Crystal Glunko Cove" : monster} · ${type}` +
          (skill ? " — skill target: this page shows the fighting rate" : "")
      );
    }

    default:
      throw new Error(`afk: unknown source "${id}"`);
  }
}

export const afk = { resolve: resolveAfk };
