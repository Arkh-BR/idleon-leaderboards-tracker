// ===== AFK GAINS SYSTEM =====
// One id per term of N.js k._customBlock_AFKgainrates("Fighting") (@4421667,
// live sha 6de681a96813; verbatim text in SP/afk/afkfn.txt). Pool terms return
// a % amount (defs/afk-gains.ts sums them into Σ); the map rules return what
// afkRate() reads: R1 a factor, R2 the Cove's replacement rate, R3 0 or 1.
// Existing helpers are reused as-is. The spec A4 fixes are new functions next
// to the old ones, which keep feeding the Drop Rate.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { label } from "../../entity-names";
import { MapAFKtarget, RandoListo2 } from "../../data/game/customlists.js";
import { MONSTERS } from "../../data/game/monsters.js";
import { AFK_NODES } from "../../defs/afk-gains";
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
import { votingMulti } from "../coin/coin";
import { compassBonus } from "../exp/compass";
import { prayersReal } from "../w3/prayer";
import { chipBonuses } from "../w4/lab";
import { starSignBonusReal } from "../common/starSign";

/** Class talents of the formula (per-character GetTalentNumber) — spec A10.
 *  621 (Tick Tock) and 650 (Rando Event Looty) are star talents of every class. */
export const AFK_CLASS_TALENTS = [79, 88, 268, 448] as const;

const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });
/** Terms ported in a later task of the AFK plan; 0 (neutral in Σ) until then. */
const pending = (name: string): ArkhNode => node(name, 0, null, { fmt: "+", note: "pending port" });

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
      return pct(label("Bribe", 3), r.val, r.children);
    }
    case "cardSet10": {
      const r = computeCardSetBonus(ci, "10");
      return pct("Card Set 10 (Fight AFK)", r.val, r.children);
    }
    case "card43": {
      const r = computeCardBonusByType(43, ci, s);
      return pct("Cards (Card Type 43)", r.val, r.children);
    }
    // N.js EtcBonuses("20") / ("59") — numeric ids (a string id drops gallery items).
    case "etc20":
    case "etc59":
      return etcBonus.resolve(Number(id.slice(3)), { saveData: s, charIdx: ci });
    // N.js DNSM.StarSigns.FightAFK — the active-signs port (spec A4).
    case "starFightAFK": {
      const r = starSignBonusReal("FightAFK", ci, s);
      return pct("Star signs (FightAFK)", r.val, r.children);
    }
    case "guild4":
      return guild.resolve(4, tctx);
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
      return pct("Lab chip (fafk)", chipBonuses("fafk", ci));
    // N.js CardLv("w6d1") ×1.
    case "cardW6d1":
      return pct("Card w6d1 (Fighting AFK, passive)", computeCardLv("w6d1", s));

    // ── ALL (every AFK type) ──
    // N.js Tasks[2][1][2] > charIdx → AFKgainzzALL = 2 (the W2 merit).
    case "merit": {
      const lv = Number((s.tasksGlobalData as any)?.[2]?.[1]?.[2]) || 0;
      return pct("W2 merit: +2% AFK Gains for your first characters", lv > ci ? 2 : 0, [
        raw("Merit level (Tasks[2][1][2])", lv),
      ]);
    }
    case "arcade6": {
      const r = arcadeBonus(6, s);
      return pct(label("Arcade", 6), r.val, r.children);
    }
    // N.js Windwalker("CompassBonus",57,0): CompassUpg[57][9] = 0, so no
    // compass 39/80 factor (EXP Task 3's compassBonus handles both branches).
    case "compass57":
      return pct("Compass 57", compassBonus(57, s));
    case "voidSet":
      return pending("Void Set Bonus");
    case "flurbo7":
      return pending("Flurbo Shop 7 (AFK Gains)");
    case "divMajor":
      return pending("Divinity major bonus ×30 (type 0)");
    // N.js Divinity("Bonus_Minor",-1,5).
    case "divMinor5":
      return pct("Divinity minor bonus 5", divinityMinorSum(5, ci, s));
    case "comp6":
    case "comp25": {
      const n = Number(id.slice(4));
      return pct(label("Companion", n), companions(n, s));
    }
    // N.js Shrine(8) — its map gate isn't modelled (spec A5, like DR and EXP).
    case "shrine8":
      return pct(label("Shrine", 8), computeShrine(8, s), null, "treated as always active (spec A5)");
    case "winBonus11":
      return pct("Summoning win bonus 11", computeWinBonus(11, null, s));
    case "goldFoodAllAFK":
      return pct("Golden food (AllAFK)", goldFoodBonuses("AllAFK", ci, undefined, s).total);
    // N.js 1.5*CardLv("w6d3").
    case "cardW6d3": {
      const lv = computeCardLv("w6d3", s);
      return pct("Card w6d3 ×1.5 (All AFK, passive)", 1.5 * lv, [raw("Card level", lv)]);
    }
    case "roo5":
      return pending("Kangaroo AFK Gains (Roo 5)");
    // N.js Summoning("VotingBonusz",6,0): 0 unless vote 6 is the active one.
    case "vote6": {
      const m = votingMulti(ctx);
      return pct("Vote 6 (AFK Gains)", votingBonusz(6, m, s), [factor("Voting multi", m)]);
    }
    // N.js 20*EventShopOwned(5).
    case "eventShop5": {
      const owned = eventShopOwned(5, s.cachedEventShopStr || "");
      return pct("Event Shop 5 (×20)", 20 * owned, [raw("Owned", owned)]);
    }
    case "vault23":
      return pct(label("Vault", 23), vaultUpgBonus(23, s));
    // N.js 1==BundlesReceived.bun_u → AFKgainzzALL += 30 (after MULTI, still in ALL).
    case "bunU": {
      const owned = Number((s.bundlesData as any)?.bun_u) === 1 ? 1 : 0;
      return pct("AFK Bundle (bun_u)", 30 * owned, [raw("Owned", owned)]);
    }

    // ── MULTI ──
    // N.js ArcaneType("ArcaneMapMulti_bon",2,0) = min(bonMAX, ArcaneMapMulti(MapBon[map][2])).
    case "arcaneMapAfk": {
      const kills = Number((ctx.mapBon as any)?.[map]?.[2]) || 0;
      return pct(
        "Arcane map bonus (slot 2, AFK)",
        computeArcaneMapMultiBon(2, { ...ctx, mapIdx: map } as any),
        [raw("Kills (mapBon[map][2])", kills)]
      );
    }
    case "etc92":
      return etcBonus.resolve(92, { saveData: s, charIdx: ci });

    // ── Map rules (spec A3 / A9) ──
    // N.js 306==CurrentMap → AFKgainzzDNz = .2*(…the same sum…).
    case "clamworks306":
      return factor(AFK_NODES.clam, map === 306 ? 0.2 : 1, null, map === 306 ? "Clamworks: AFK gains are 1/5" : `map ${map}: no effect`);
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
        [raw("Cavern (Holes[0][char])", cavern), raw("Cglunko upgrade 8", u8), raw("Cglunko upgrade 13", u13), raw("AFK Bundle (bun_u)", bun)],
        cove ? "replaces the whole rate" : "inactive: not map 216 in cavern 17"
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
