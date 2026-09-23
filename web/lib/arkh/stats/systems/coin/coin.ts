// ===== COIN SYSTEM =====
// One id per term of N.js ArbitraryCode("MonsterCash"). Each returns what the
// formula adds inside its group; defs/coin-multi.ts owns the group shapes.
// Existing helpers are reused as-is; terms the engine never ported live in
// this folder so the Drop Rate paths stay untouched.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { getLOG } from "../../../formulas";
import { optionsListData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { label } from "../../entity-names";
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
import { gridBonusValue } from "../w4/lab";
import { getSetBonus } from "../w3/setBonus";
import { maxTalentBonus, talent } from "../common/talent";
import { friend } from "../common/friend";
import { vaultUpgBonus } from "../common/vault";
import { pristineBon } from "../w5/pristine";
import { computePrayerReal } from "../w3/prayer";
import { computeCardLv } from "../common/cards";
import { arcadeBonus } from "../w2/arcade";
import { guild } from "../common/guild";
import { goldFoodBonuses } from "../common/goldenFood";
import { achieveStatus } from "../common/achievement";

/** Class talents in the coin formula (per-char GetTalentNumber / TalentCalc).
 *  Talent 433 is account-wide (getbonus2) so it isn't listed. */
export const COIN_CLASS_TALENTS = [22, 657, 643, 644] as const;

type Tree = { val: number; children: ArkhNode[] | null };
const add = (name: string, r: Tree, note?: string): ArkhNode =>
  node(name, r.val, r.children, { fmt: "+", note });
const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });

const BUBBLES: Record<string, { name: string; key: string; stat: number; label: string }> = {
  bubbleSTR: { name: "Penny of Strength", key: "CashSTR", stat: 0, label: "STR" },
  bubbleAGI: { name: "Dollar of Agility", key: "CashAGI", stat: 1, label: "AGI" },
  bubbleWIS: { name: "Nickel of Wisdom", key: "CashWIS", stat: 2, label: "WIS" },
};

const ACH_WEIGHT: Record<number, number> = { 235: 5, 350: 10, 376: 20 };

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
    // Talent 643 (Coins For Charon): N.js multiplies GetTalentNumber(1,643)
    // by CalcTalentMAP["643"] = OverkillStuffs("2") — a LIVE multikill-combo
    // counter built only while actually AFK-fighting, not something a static
    // save records. The shared talent.resolve() wrap (talent-final-bonus-
    // wraps.ts, via computeCalcTalent → computeOverkillTier) instead feeds it
    // a THEORETICAL max-damage tier, which overstates this term for a save
    // snapshot (tier 51 here) — both N.js's own uninitialized CalcTalentMAP
    // entry and our port's own "not on a fighting map" branch default this
    // counter to 1 (baseline/inactive), and IdleonToolbox's cross-check
    // confirms that reading is right (last 0.11-style residual: 1306.4712...
    // only reconciles when 643 contributes its bare coefficient). We read
    // that coefficient back off the shared resolver's "Talent Value" child
    // instead of re-deriving the whole effective-level pipeline here.
    case "talent643": {
      const resolved = talent.resolve(643, tctx);
      const tv = Number(resolved.children?.find((c) => c.name === "Talent Value")?.val) || 0;
      return node(resolved.name, tv, resolved.children, {
        fmt: "+",
        note: "OverkillStuffs('2') is live combat state, not derivable from a save — treated as baseline (×1)",
      });
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
    default:
      // Ported by Tasks 2–5; 0 keeps the product valid meanwhile.
      return node(`${id} (not ported yet)`, 0, null, { note: "coin:" + id });
  }
}

export const coin = { resolve: resolveCoin };
