// ===== MULTIKILL SYSTEM =====
// One id per term of N.js WorkbenchStuff("MultiKill_base") (@7754109) and
// ("MultiKill_perTier") (@7751511) — % amounts the two sums add — plus the
// formula's other inputs: the damage tier (OverkillStuffs "2"), the two map
// rules and the activation flag (OverkillStuffs "3", a status row only —
// spec M2). defs/multikill.ts owns the shape ⌊B′ + T × P′⌋. Existing helpers
// are called as they are; the new ports live next to their siblings
// (common/overkill.ts, coin/gambit.ts, common/buffs.ts, exp/saltLick.ts).

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData } from "../../../save/data";
import { label } from "../../entity-names";
import { RandoListo2 } from "../../data/game/customlists.js";
import { MK_NODES, MK_RULES } from "../../defs/multikill";
import { talent } from "../common/talent";
import { etcBonus } from "../common/etcBonus";
import { achieveStatus } from "../common/achievement";
import { computeBoxReward, computeCardBonusByType } from "../common/stats";
import { computeCardSetBonus } from "../common/cards";
import { overkillActive, overkillStuffs } from "../common/overkill";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { computeVialByKey } from "../w2/alchemy";
import { arcadeBonus } from "../w2/arcade";
import { prayersReal } from "../w3/prayer";
import { chipBonuses } from "../w4/lab";
import { computeShinyBonusS } from "../w4/breeding";
import { computeArtifactBonus } from "../w5/sailing";

/** Class talents of the formula (per-character buffs) — spec M16. 654 is a
 *  star talent (every class) and 58 is account-wide, so neither is gated. */
export const MK_CLASS_TALENTS = [46, 469] as const;

const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });
const factor = (name: string, v: number, children?: ArkhNode[] | null): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x" });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
/** Terms ported in a later task of the Multikill plan; neutral in Σ until then. */
const pending = (name: string, neutral: number): ArkhNode =>
  node(name, neutral, null, { fmt: "+", note: "pending port" });

// @njs MultiKill_base
// @njs MultiKill_perTier
function resolveMultikill(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const map = ctx.mapIdx ?? (Number((currentMapData as any)?.[ci]) || 0);

  switch (id) {
    // ── Base Multikill (N.js order) ──
    case "sign47":
      return pending("Star signs (Multikill)", 0);
    case "saltLick8":
      return pending("Salt Lick 8 (Multikill)", 0);
    // N.js StampBonusOfTypeX("Overkill") — only StampC19 has that type.
    case "stampC19": {
      const r = computeStampBonusOfTypeX("Overkill", s);
      return pct("Stamps (Overkill)", r.val, r.children);
    }
    // N.js 2*TowerInfo[2]: the Death Note building's level ×2.
    case "deathNoteBuilding": {
      const lv = Number((s.towerData as any)?.[2]) || 0;
      return pct("Death Note building ×2", 2 * lv, [raw("Building level (TowerInfo[2])", lv)]);
    }
    // N.js EtcBonuses("29") / ("71") — numeric ids (a string id drops gallery items).
    case "etc29":
    case "etc71": {
      const n = Number(id.slice(3));
      const e = etcBonus.resolve(n, { saveData: s, charIdx: ci });
      return pct(n === 29 ? "Multikill gear (Etc 29)" : "Multikill per tier gear (Etc 71)", Number(e.val) || 0, e.children);
    }
    // N.js Math.min(5, AchieveStatus(148)) + 6*AchieveStatus(122) + 2*AchieveStatus(123).
    case "ach148":
      return pct(label("Achievement", 148), Math.min(5, achieveStatus(148, s)));
    case "ach122":
    case "ach123": {
      const n = Number(id.slice(3));
      const w = n === 122 ? 6 : 2;
      return pct(`${label("Achievement", n)} × ${w}`, w * achieveStatus(n, s));
    }
    // N.js StatueOnyxOwned*GetTalentNumber(1,654) (star talent) and
    // getbonus2(1,58,-1)*⌊OLA[158]/5⌋ (account-wide): talent.resolve applies
    // both wraps already. The label keeps "(Talent n)".
    case "talent654":
    case "talent58": {
      const n = Number(id.slice(6));
      const t = talent.resolve(n, tctx);
      return pct(label("Talent", n), Number(t.val) || 0, t.children);
    }

    // ── Multikill per Tier (N.js order) ──
    case "deathNoteWorld":
      return pending(`Death Note (W${Math.floor(map / 50) + 1} page)`, 0);
    case "deathNoteMini":
      return pending("Death Note (minibosses)", 0);
    // N.js AlchVials.Overkill.
    case "vialOverkill": {
      const r = computeVialByKey("Overkill", s);
      return pct("Vials (Overkill)", r.val, r.children);
    }
    case "buff46":
      return pending(label("Talent", 46), 0);
    // N.js ArcadeBonus(8).
    case "arcade8": {
      const r = arcadeBonus(8, s);
      return pct(label("Arcade", 8), r.val, r.children);
    }
    // N.js Sailing("ArtifactBonus",26,0): Trilobite Rock, 25 × its tier.
    case "artifact26":
      return pct("Trilobite Rock (Artifact 26)", computeArtifactBonus(26, ci, { saveData: s, charIdx: ci } as any));
    case "buff469":
      return pending(label("Talent", 469), 0);
    // N.js chipBonuses("mkill"): the active character's lab chips (Wood Chip, 15).
    case "chipMkill":
      return pct("Lab chip (mkill)", chipBonuses("mkill", ci));
    case "meas9":
      return pending("Measurement 9 (Multikill per tier)", 0);
    // N.js CardBonusREAL(80).
    case "card80": {
      const r = computeCardBonusByType(80, ci, s);
      return pct("Cards (Card Type 80)", r.val, r.children);
    }
    case "sign78":
      return pending("Star signs (Multikill per tier)", 0);
    // N.js prayersReal(16,0): Balance of Pain, super-bit branch included.
    case "prayer16": {
      const r = prayersReal(16, 0, ci, s);
      return pct(label("Prayer", 16), r.val, r.children);
    }
    // N.js Breeding("ShinyBonusS","Nah",4,-1).
    case "shiny4":
      return pct("Shiny Pets (Breeding 4)", computeShinyBonusS(4, s));
    // N.js BoxRewards["13b"] (Utilitarian Capsule).
    case "box13b": {
      const r = computeBoxReward(ci, "13b");
      return pct("Post Office 13b", r.val, r.children);
    }
    case "bubbleMKtier":
      return pending("MR_MASSACRE bubble (MKtierACTIVE)", 0);
    // N.js CardSetBonuses(0,"11") = Cards[3]["{%_Multikill_Per_Tier"].
    case "cardSet11": {
      const r = computeCardSetBonus(ci, "11");
      return pct("Card Set 11 (Multikill per tier)", r.val, r.children);
    }

    // ── Damage tier, map rules, status ──
    // N.js OverkillStuffs("2") against the target's live HP (common/overkill.ts,
    // spec M1/M5). Named by ladder: the ×5 W7 tier never meets the map-251
    // reference (M12). "estimate" below the cap: arkh's max damage isn't
    // reconciled with the game yet (M4, M17).
    case "tier": {
      const ok = overkillStuffs(ci, map, ctx);
      const hpKids = ok.clam
        ? [raw("Clamworks HP (1e16 × 30^OLA[464])", ok.staticHp)]
        : [
            raw("Static HP", ok.staticHp),
            factor("Prayer curses", ok.curse, [
              raw(`Curse: ${label("Prayer", 0)}`, ok.curses[0]),
              raw(`Curse: ${label("Prayer", 7)}`, ok.curses[1]),
              raw(`Curse: ${label("Prayer", 8)}`, ok.curses[2]),
            ]),
          ];
      const note = `${ok.tier < 51 ? "estimate — max damage isn't reconciled with the game yet · " : ""}Map ${ok.map} · ${ok.target}`;
      return node(
        ok.exponent === 5 ? MK_NODES.tierW7 : MK_NODES.tier,
        ok.tier,
        [
          raw("Max Damage", ok.maxDmg),
          node("Target HP", ok.hp, hpKids, { fmt: "raw" }),
          raw("Exponent", ok.exponent),
          raw("Tier reached at", ok.tierAt),
          raw("Next tier at", ok.nextAt),
        ],
        { fmt: "raw", note }
      );
    }
    // N.js MultiKill_base / _perTier on maps ≥ 300: the Shimmerfin Deep soft
    // cap on both sums (combine applies mkSoftCap; the per-tier bypass
    // e = 8675309 only feeds the W7 notice).
    case "softCap":
      return node(MK_RULES.softCap, map >= 300 ? 1 : 0, null, {
        fmt: "raw",
        note: map >= 300 ? "Shimmerfin Deep (map ≥ 300)" : `map ${map}: no soft cap`,
      });
    // N.js 216==CurrentMap && 17==Holes[0][me] → each sum is REPLACED by
    // Holes2("Cglunko_MKbase") = Cglunko_upgBon(15) and ("Cglunko_MKtier") =
    // Cglunko_upgBon(6), Cglunko_upgBon(b) = OLA[630+b]·RandoListo2[13][b]
    // (@10969437). combine reads the first two children (×100 and ×1).
    // @njs _customBlock_Holes2
    case "cove": {
      const cavern = Number((s.holesData as any)?.[0]?.[ci]);
      const on = map === 216 && cavern === 17;
      const upg = (b: number) => ola(630 + b) * (Number((RandoListo2 as any)[13]?.[b]) || 0);
      return node(
        MK_RULES.cove,
        on ? 1 : 0,
        [raw("Cglunko MK base (upgrade 15)", upg(15)), raw("Cglunko MK per tier (upgrade 6)", upg(6)), raw("Cavern (Holes[0][char])", cavern)],
        { fmt: "raw", note: on ? "replaces both sums" : "inactive: not map 216 in cavern 17" }
      );
    }
    // N.js OverkillStuffs("3"). The headline never uses it (spec M2): the game
    // applies the multikill only when it's 1, and prints the AFK Info line
    // only for a FIGHTING target (@3835457).
    case "active": {
      const ok = overkillStuffs(ci, map, ctx);
      const a = overkillActive(ok, ci, s);
      const note = !a.active
        ? "inactive: the game applies no multikill"
        : a.type === "FIGHTING"
          ? "the AFK Info shows the MULTIKILL line"
          : `the AFK Info hides the MULTIKILL line (${ok.target} is ${a.type})`;
      return node(
        MK_NODES.active,
        a.active ? 1 : 0,
        [
          raw("Max damage ≥ HP × E", a.maxOk ? 1 : 0),
          raw("Death Note built (TowerInfo[2] > 0.5)", a.deathNote ? 1 : 0),
          node("Accuracy > 1.5 × Defence", a.accOk ? 1 : 0, [raw("Accuracy", a.accuracy), raw("Target Defence", a.defence)], { fmt: "raw" }),
        ],
        { fmt: "raw", note }
      );
    }

    default:
      throw new Error(`multikill: unknown source "${id}"`);
  }
}

export const multikill = { resolve: resolveMultikill };
