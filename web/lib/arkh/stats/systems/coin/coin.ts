// ===== COIN SYSTEM =====
// One id per term of N.js ArbitraryCode("MonsterCash"). Each returns what the
// formula adds inside its group; defs/coin-multi.ts owns the group shapes.
// Existing helpers are reused as-is; terms the engine never ported live in
// this folder so the Drop Rate paths stay untouched.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import type { SaveData } from "../../../state";
import { getLOG, formulaEval } from "../../../formulas";
import { optionsListData, currentMapData, numCharacters, dreamData } from "../../../save/data";
import { eventShopOwned, emporiumBonus } from "../../../game-helpers";
import { label } from "../../entity-names";
import { DungPassiveStats2, RANDOlist } from "../../data/game/customlists.js";
import { legendPTSbonus, computePaletteBonus } from "../w7/spelunking";
import { cropSCbonMulti } from "../w6/farming";
import { vaultKillzTotal, cardsCollected, accountMapKills } from "./accountKills";
import { divinityMinorSum } from "./divinityMinor";
import { computeArtifactBonus } from "../w5/sailing";
import { votingBonusz } from "../w2/voting";
import { computeMeritocBonusz } from "../w7/meritoc";
import { computeWinBonus } from "../w6/summoning";
import { cosmoBonus } from "../w5/hole";
import { bubbleValByKey, computeVialByKey } from "../w2/alchemy";
import {
  computeMealBonus,
  computeStatueBonusGiven,
  computeCardBonusByType,
  computeBoxReward,
} from "../common/stats";
import { companions } from "../common/companions";
import { etcBonus } from "../common/etcBonus";
import { sushiRoG } from "../w7/sushi";
import { gridBonusValue, mainframeBonus } from "../w4/lab";
import { getSetBonus } from "../w3/setBonus";
import { maxTalentBonus, talent } from "../common/talent";
import { computeOverkillTier } from "../common/derived-damage";
import { overkillStuffs } from "../common/overkill";
import { friend } from "../common/friend";
import { vaultUpgBonus } from "../common/vault";
import { pristineBon } from "../w5/pristine";
import { computePrayerReal } from "../w3/prayer";
import { computeCardLv } from "../common/cards";
import { arcadeBonus } from "../w2/arcade";
import { guild } from "../common/guild";
import { goldFoodBonuses } from "../common/goldenFood";
import { achieveStatus } from "../common/achievement";
import { gambitBonus, gambitPoints, deathNoteSkulls } from "./gambit";

/** Class talents in the coin formula (per-char GetTalentNumber / TalentCalc).
 *  Talent 433 is account-wide (getbonus2) so it isn't listed. */
export const COIN_CLASS_TALENTS = [22, 657, 643, 644] as const;

type Tree = { val: number; children: ArkhNode[] | null };
const add = (name: string, r: Tree, note?: string): ArkhNode =>
  node(name, r.val, r.children, { fmt: "+", note });
const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });

/** N.js FlurboShop(idx) (@7827791): DungPassiveStats2[idx] at level
 *  DungUpg[5][idx]. Coin's flurbo4, EXP's flurbo2 and AFK's flurbo7. */
// @njs _customBlock_FlurboShop
export function flurboShop(idx: number, s: SaveData): { val: number; children: ArkhNode[] } {
  const row = ((DungPassiveStats2 as any[])[idx] ?? []) as unknown[];
  const lv = Number((s.dungUpgData as any[])?.[5]?.[idx]) || 0;
  return { val: formulaEval(String(row[3]), Number(row[1]), Number(row[2]), lv), children: [raw("Level", lv)] };
}

/** N.js Summoning("RooBonuses", idx) (@10827396): coef·(1 + Legend26/100)·
 *  (1 + Companions(51))·(1 + RooBonusAll/100)·max(0, ⌈(OLA[271] − idx)/7⌉),
 *  RooBonusAll = the megafeather %. N.js coef per idx 0–6: 3, 3, 5, 2, 2, .5, 3. */
// @njs RooBonuses
export function rooBonus(idx: number, coef: number, s: SaveData): { val: number; children: ArkhNode[] } {
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const mf = (k: number) => (ola(279) > k ? (k === 11 ? ola(279) - 11 : 1) : 0);
  const all = 50 * mf(1) + 50 * mf(3) + 50 * mf(6) + 50 * mf(8) + 50 * Math.min(1, mf(11)) + 25 * Math.max(0, mf(11) - 1);
  const legend = legendPTSbonus(26, s);
  const c51 = companions(51, s);
  const steps = Math.max(0, Math.ceil((ola(271) - idx) / 7));
  return {
    val: coef * (1 + legend / 100) * (1 + c51) * (1 + all / 100) * steps,
    children: [raw("Legend 26", legend), raw("Companion 51", c51), raw("Megafeathers %", all), raw(`⌈(OLA[271] − ${idx}) / 7⌉`, steps)],
  };
}

const BUBBLES: Record<string, { name: string; key: string; stat: number; label: string }> = {
  bubbleSTR: { name: "Penny of Strength", key: "CashSTR", stat: 0, label: "STR" },
  bubbleAGI: { name: "Dollar of Agility", key: "CashAGI", stat: 1, label: "AGI" },
  bubbleWIS: { name: "Nickel of Wisdom", key: "CashWIS", stat: 2, label: "WIS" },
};

const ACH_WEIGHT: Record<number, number> = { 235: 5, 350: 10, 376: 20 };

// Voting multi shared by Coin's vote34 and EXP Multi's vote15 (votingBonusz
// gates on activeVoteIdx, so the same multi is inert unless that vote is
// the account's active one). Extracted so both callers share one formula.
export function votingMulti(ctx: SystemCtx): number {
  const s = ctx.saveData;
  const es = (n: number) => eventShopOwned(n, s.cachedEventShopStr || "");
  const inner =
    companions(41, s) + (Number((dreamData as any[])[13]) || 0) + cosmoBonus(s, 2, 3) +
    computeWinBonus(22, null, s) + 17 * es(7) + 13 * es(16) + companions(19, s) +
    computePaletteBonus(32, s) + legendPTSbonus(22, s) +
    (Number(sushiRoG.resolve(50, ctx as any).val) || 0);
  return (1 + companions(161, s) / 100) * (1 + computeMeritocBonusz(9, s) / 100) * (1 + inner / 100);
}

// @njs MonsterCash
function resolveCoin(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;

  switch (id) {
    // G1 — CashSTR·⌊STR/250⌋ + CashAGI·⌊AGI/250⌋ + CashWIS·⌊WIS/250⌋. The stat
    // is the save's PVStatList (what the game wrote from TotalStats).
    case "bubbleSTR":
    case "bubbleAGI":
    case "bubbleWIS": {
      const b = BUBBLES[id];
      const statVal = Number((s as any).statList?.[ci]?.[b.stat]) || 0;
      const steps = Math.floor(statVal / 250);
      const bub = bubbleValByKey(b.key, ci, s);
      return node(
        `${b.name} (${b.key})`,
        bub.val * steps,
        [
          node("Bubble", bub.val, bub.children, { fmt: "raw" }),
          raw(`Total ${b.label}`, statVal),
          raw(`⌊${b.label} / 250⌋`, steps),
        ],
        { fmt: "+" }
      );
    }
    // G2–G5 — companion values; the group applies min(4, ·) or 1 + v.
    case "comp24":
    case "comp38":
    case "comp45":
    case "comp159": {
      const n = Number(id.slice(4));
      return node(label("Companion", n), companions(n, s), null, { fmt: "raw" });
    }
    // G6/G7 — (1 + .5·EventShopOwned(9)) and (1 + .6·EventShopOwned(20)).
    case "eventShop9":
    case "eventShop20": {
      const n = id === "eventShop9" ? 9 : 20;
      const coeff = n === 9 ? 0.5 : 0.6;
      const owned = eventShopOwned(n, s.cachedEventShopStr || "");
      return node(`Event Shop ${n} (×${coeff})`, coeff * owned, [raw("Owned", owned)], { fmt: "raw" });
    }
    // EtcBonuses("77"/"100"/"3") — numeric ids (a string id drops gallery items).
    case "etc77":
    case "etc100":
    case "etc3":
      return etcBonus.resolve(Number(id.slice(3)), { saveData: s, charIdx: ci });
    case "sushi18":
    case "sushi37":
      return sushiRoG.resolve(Number(id.slice(5)), ctx as any);
    case "grid149":
    case "grid169": {
      const n = Number(id.slice(4));
      return node(`Research Grid ${n}`, gridBonusValue(n, s), null, { fmt: "+" });
    }
    case "goldSet":
      return add("Gold Set", getSetBonus("GOLD_SET"));
    case "gambit7":
      return node(
        "Gambit 7 (Cash)",
        gambitBonus(7, s),
        [raw("Gambit points", gambitPoints(s)), raw("Deathnote skulls (Measurement 13)", deathNoteSkulls(s))],
        { fmt: "+" }
      );
    // G15 — (1 + 250·bun_y/100). Don't call bundle.resolve: it recurses on any
    // bundle id other than bun_v/bun_p.
    case "bunY": {
      const owned = Number((s.bundlesData as any)?.bun_y) === 1 ? 1 : 0;
      return node("Cash Bundle (bun_y)", 250 * owned, [raw("Owned", owned)], { fmt: "+" });
    }
    // G16 — max(1, getbonus2(1,433,-1))·getLOG(OLA[362]), active-char context.
    case "dustWalker": {
      const tv = Math.max(1, maxTalentBonus(433, ci, s));
      const lg = getLOG(ola(362));
      return node(
        `${label("Talent", 433)} × log(OLA[362])`,
        tv * lg,
        [raw("Talent 433 (getbonus2, min 1)", tv), raw("log10(OLA[362])", lg)],
        { fmt: "+" }
      );
    }
    case "mealCash":
      return add("Meals (Cash)", computeMealBonus("Cash", s));
    // G18 adds these WITHOUT /100 — except the statue, which is /100.
    case "friend5":
      return friend.resolve(5, { saveData: s });
    case "statue19": {
      const r = computeStatueBonusGiven(19, ci, s);
      return node(
        `${label("Statue", 19)} ÷ 100`,
        r.val / 100,
        [node("Statue bonus", r.val, r.children, { fmt: "raw" })],
        { fmt: "raw" }
      );
    }
    case "pristine16":
      return node(label("Pristine", 16), pristineBon(16, s), null, { fmt: "+" });
    case "prayer8":
      return add(label("Prayer", 8), computePrayerReal(8, 0, ci, s));
    // G23 terms.
    case "talent657":
    case "talent22":
    case "talent644":
      return talent.resolve(Number(id.slice(6)), tctx);
    // Talent 643 (Coins For Charon): TalentCalc(643) = GetTalentNumber(1,643)
    // × OverkillStuffs("2") (N.js @4075410). talent.resolve() applies the
    // shared wrap's tier (computeOverkillTier: MapAFKtarget of the saved map,
    // a FIGHTING gate, no curses), so dividing it back out recovers the bare
    // GetTalentNumber(1,643); overkillStuffs (common/overkill.ts) then gives
    // the game's tier for the viewed map: AFKtarget_N on the saved map, the
    // HP with the character's prayer curses, Clamz_HP on map 306 (spec M5).
    case "talent643": {
      const r = talent.resolve(643, tctx);
      if (!(Number(r.val) > 0)) return r;
      const t0 = computeOverkillTier(ci, { saveData: s, charIdx: ci });
      const tv = Number(r.val) / t0.tier;
      const map = ctx.mapIdx ?? Number((currentMapData as any)?.[ci]);
      const ok = overkillStuffs(ci, map, ctx, { maxDmg: t0.maxDmg });
      return node(
        r.name,
        tv * ok.tier,
        [
          ...(r.children ?? []),
          node("Multikill tier (selected map)", ok.tier, null, { fmt: "raw", note: `Map ${ok.map} · target ${ok.target}` }),
        ],
        { fmt: "+" }
      );
    }
    case "vialCash":
      return add("Cash Vial (MonsterCash)", computeVialByKey("MonsterCash", s));
    case "card11":
      return add("Money Cards (Card Type 11)", computeCardBonusByType(11, ci, s));
    case "cardW5b1": {
      const lv = computeCardLv("w5b1", s);
      return node(`${label("Card", "w5b1")} × 7`, 7 * lv, [raw("Card Lv", lv)], { fmt: "+" });
    }
    case "arcade10":
    case "arcade11": {
      const n = Number(id.slice(6));
      return add(label("Arcade", n), arcadeBonus(n, s));
    }
    // BoxRewards["13c"] — computeBoxReward applies the slot thresholds
    // (postOffice.resolve doesn't).
    case "box13c":
      return add("Post Office 13c", computeBoxReward(ci, "13c"));
    case "guild8": {
      const gn = guild.resolve(8, { saveData: s } as any);
      const world = 1 + Math.floor((ctx.mapIdx ?? 0) / 50);
      return node(
        "Guild 8 × World",
        (Number(gn.val) || 0) * world,
        [gn, node("1 + ⌊map / 50⌋", world, null, { fmt: "x" })],
        { fmt: "+" }
      );
    }
    case "goldFood":
      return node(
        "Golden Food (MonsterCash)",
        goldFoodBonuses("MonsterCash", ci, undefined, s).total,
        null,
        { fmt: "+" }
      );
    case "ach235":
    case "ach350":
    case "ach376": {
      const n = Number(id.slice(3));
      const w = ACH_WEIGHT[n];
      return node(`${label("Achievement", n)} × ${w}`, w * achieveStatus(n, s), null, { fmt: "+" });
    }
    case "vault2":
      return node(label("Vault", 2), vaultUpgBonus(2, s), null, { fmt: "+" });
    case "vault17": {
      const v = vaultUpgBonus(17, s);
      const lg = getLOG(ola(340));
      return node(
        `${label("Vault", 17)} × log(OLA[340])`,
        v * lg,
        [raw("Vault 17", v), raw("log10(OLA[340])", lg)],
        { fmt: "+" }
      );
    }
    case "ola420":
      return node("Ninja Extra Cash (OLA[420])", ola(420), null, { fmt: "+" });
    case "flurbo4": {
      const r = flurboShop(4, s);
      return node("Flurbo Shop 4 (Monster Cash)", r.val, r.children, { fmt: "+" });
    }
    case "divMinor3":
      return node("Divinity minor bonus (Cash)", divinityMinorSum(3, ci, s), null, { fmt: "+" });
    case "cropSC4": {
      const unlocked = emporiumBonus(23, (s.ninjaData as any[])?.[102]?.[9]) ? 1 : 0;
      const crops = Math.round(s.farmCropCount || 0);
      const multi = cropSCbonMulti(s);
      return node(
        "Crop Depot Bonus 4 (Cash)",
        unlocked ? 15 * crops * multi : 0,
        [raw("Emporium 23 unlocked", unlocked), raw("Crops found", crops), node("Depot multi", multi, null, { fmt: "x" })],
        { fmt: "+" }
      );
    }
    case "arena5":
    case "arena14": {
      const i = id === "arena5" ? 5 : 14;
      const coeff = i === 5 ? 0.5 : 1;
      const wave = ola(89);
      const req = Number((RANDOlist as any[])[53]?.[i]);
      const owned = Number.isFinite(req) && wave >= req ? 1 : 0;
      return node(
        `Pet Arena bonus ${i}${coeff !== 1 ? " (×0.5)" : ""}`,
        coeff * owned,
        [raw("Arena wave (OLA[89])", wave), raw("Wave needed", req)],
        { fmt: "raw" }
      );
    }
    case "roo6": {
      const r = rooBonus(6, 3, s);
      return node("Kangaroo Cash (Roo 6)", r.val, r.children, { fmt: "+" });
    }
    case "vault14":
    case "vault31":
    case "vault34":
    case "vault37": {
      const n = Number(id.slice(5));
      const k = n === 14 ? 4 : n === 31 ? 7 : n === 34 ? 8 : 9;
      const v = vaultUpgBonus(n, s);
      const kills = vaultKillzTotal(k, s);
      return node(`${label("Vault", n)} × VaultKillzTotal(${k})`, v * kills, [raw(`Vault ${n}`, v), raw(`VaultKillzTotal(${k})`, kills)], { fmt: "+" });
    }
    case "vault70": {
      const v = vaultUpgBonus(70, s);
      const cards = cardsCollected(s);
      return node(`${label("Vault", 70)} × cards collected`, v * cards, [raw("Vault 70", v), raw("Cards collected", cards)], { fmt: "+" });
    }
    // Artifact 1 (Maneki Kat): base × tier (computeArtifactBonus) × the
    // highest character level (CalcTalentMAP["620"], account-wide).
    case "artifact1": {
      const base = computeArtifactBonus(1, ci, { saveData: s, charIdx: ci } as any);
      let top = 0;
      for (let c = 0; c < numCharacters; c++) top = Math.max(top, Number((s.lv0AllData as any[])?.[c]?.[0]) || 0);
      return node(`${label("Artifact", 1)} × highest level`, base * top, [raw("Artifact bonus", base), raw("Highest char level", top)], { fmt: "+" });
    }
    // MainframeBonus(9) = (LabMainBonus[9][5] + MainframeBonus(113)) ×
    // ⌊kills/1e6⌋ (or × kills/1e6 past 1e8), kills = green mushroom map
    // (MapAFKtarget.indexOf("mushG") = 1) account kills. mainframeBonus()
    // in lab.ts already returns the unmultiplied base9 sum (see its comment);
    // the kill multiplier is applied here, not inside the shared helper.
    case "mainframe9": {
      const base = mainframeBonus(9, s);
      const k = accountMapKills(1) / 1e6; // map 1 = MapAFKtarget "mushG"
      const mult = k < 1e8 ? Math.floor(k) : k;
      return node("Lab Mainframe 9 × green mushroom kills", base * mult, [raw("Mainframe 9", base), raw("Kills / 1e6", mult)], { fmt: "+" });
    }
    // VotingBonusz(34): base value gated on the active weekly vote, scaled
    // by a multi built from companions/dream/cosmo/win/event-shop/palette/
    // legend/sushi terms. Only nonzero in weeks vote 34 wins.
    case "vote34": {
      const multi = votingMulti(ctx);
      return node("Vote 34 (Cash)", votingBonusz(34, multi, s), [node("Voting multi", multi, null, { fmt: "x" })], { fmt: "+" });
    }
    default:
      throw new Error(`coin: unknown source "${id}"`);
  }
}

export const coin = { resolve: resolveCoin };
