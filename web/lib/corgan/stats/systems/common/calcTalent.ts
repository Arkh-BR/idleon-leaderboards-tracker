// ===== CALC TALENT MAP =====
// Port of the N.js `_customBlock_TalentCalc(d)` MAP-build block
// (offset ~4370455). The game maintains `DNSM.CalcTalentMAP` — a dict
// keyed by talent id — that holds the *counter* each "scaling" talent
// multiplies its per-level coefficient against. The talent's final bonus
// is then `GetTalentNumber(1,id) × CalcTalentMAP[id]` (or a clamp / power
// form, depending on the talent — see talent-final-bonus-wraps.ts).
//
// This file ports JUST the counter computation (`CalcTalentMAP[id]`),
// exposed as `computeCalcTalent(talentId, charIdx, saveData)`. The wrap
// (× / clamp / power) lives in the wrap registry; this returns the bare
// counter so the registry can apply the right shape.
//
// Keys 42/43 (Journeyman skill EXP/eff per skill slot) are an ARRAY form
// indexed by skill slot and are handled separately by derived-stats.ts's
// own local helper — NOT here. This module only covers the scalar keys.
//
// ── Faithfulness notes ──────────────────────────────────────────────
// Most keys read directly off ported save arrays. A few sub-sources are
// genuinely not ported (rift kill-trackers, overkill-tier sim, accuracy
// gate) and are STUBBED to 0 / a documented proxy — each is flagged
// `[STUB]` / `[PROXY]` inline so the caller knows the value is partial.

import {
  numCharacters,
  charClassData,
  cauldronInfoData,
  stampLvData,
  skillLvData,
} from "../../../save/data";
import type { SaveData } from "../../../state";
import {
  RANDOlist,
  DreamChallenge,
} from "../../data/game/customlists.js";
import { apocalypseMapsOver, apocalypseMapsOverBest } from "../w6/upg-totals";
import { talentParams } from "../../data/common/talent";
import { formulaEval } from "../../../formulas";

/** GetTalentNumber(2,id) approximated at the char's RAW talent level (no
 *  ATL chain) — the "Counts up to {" cap on the Apocalypse talents. The
 *  ATL bonus on the cap is small relative to the cap, so the raw-lv
 *  approximation is close. Returns Infinity when the talent has no tab-2
 *  formula (no cap). */
function talentTab2Cap(talentId: number, charIdx: number, s: SaveData): number {
  const p = talentParams(talentId, 2);
  if (!p || !p.formula || p.formula === "txt" || p.formula === "_") return Infinity;
  void s;
  const sl = (skillLvData as any)?.[charIdx] || {};
  const rawLv = Number(sl[talentId] ?? sl[String(talentId)]) || 0;
  if (rawLv <= 0) return 0;
  return Number(formulaEval(p.formula, p.x1, p.x2, rawLv)) || 0;
}

/** Active-char Lv0 array (skill levels + player level at [0]). */
function lv0Of(saveData: SaveData, charIdx: number): any[] {
  return ((saveData.lv0AllData as any)?.[charIdx] as any[]) || [];
}

/**
 * computeCalcTalent(talentId, charIdx, saveData) → CalcTalentMAP[talentId].
 *
 * Returns the scalar counter the talent scales against. `charIdx` is the
 * "active" character (matters for the per-char keys: 31, 644). Account-
 * wide keys (57, 616, 620, ...) ignore charIdx and scan every character.
 *
 * Mirrors N.js `_customBlock_TalentCalc`'s MAP-build for the supported
 * keys; unsupported sub-sources return 0 / a documented proxy (see
 * inline comments). Returns 0 for any id not handled here.
 */
export function computeCalcTalent(
  talentId: number,
  charIdx: number,
  saveData: SaveData
): number {
  switch (talentId) {
    // ── 31 — Skillage Damage (per-char): lowest skill LV ─────────────
    // N.js: DN1=1000; for g=0..8 (skill slots 1..9 of Lv0): DN1 =
    // min(DN1, Lv0[g+1]). The `8<g` gate in N.js is a no-op for g≤8,
    // so this is simply the min of Lv0[1..9].
    case 31: {
      const lv0 = lv0Of(saveData, charIdx);
      let lowest = 1000;
      for (let g = 0; g < 9; g++) {
        const v = Number(lv0[g + 1]) || 0;
        if (v < lowest) lowest = v;
      }
      return lowest;
    }

    // ── 57 — Species Epoch (account-wide): combined Trapping+Worship ──
    // over 100. N.js: scan chars with class<6; DN1 = max(Lv0[7]+Lv0[9]);
    // MAP[57] = max(0, DN1 - 100). Lv0[7]=Trapping, Lv0[9]=Worship.
    case 57: {
      let best = 0;
      for (let ci = 0; ci < numCharacters; ci++) {
        const cls = Number((charClassData as any)[ci]) || 0;
        if (cls >= 6) continue;
        const lv0 = lv0Of(saveData, ci);
        const combined = (Number(lv0[7]) || 0) + (Number(lv0[9]) || 0);
        if (combined > best) best = combined;
      }
      return Math.max(0, best - 100);
    }

    // ── 59 — Blood Marrow (account-wide): total LV of all Meals ──────
    // N.js: DN1 = Σ Meals[0][g]; MAP[59] = max(0, DN1).
    case 59: {
      const meals0 = ((saveData.mealsData as any)?.[0] as any[]) || [];
      let sum = 0;
      for (let g = 0; g < meals0.length; g++) sum += Number(meals0[g]) || 0;
      return Math.max(0, sum);
    }

    // ── 110 — Apocalypse Zow (per-char): mob types killed >100k ──────
    // ── 110 — Apocalypse Zow (per-char): mob types killed >100k ──────
    // N.js: count of fighting maps where killsDone(g) >= 1e5, then
    // min(count, GetTalentNumber(2,110)). killsDone = MapDetails[g][0][0]
    // − KLA[charIdx][g][0] (KLA goes negative on over-kill). The cap uses
    // a raw-lv approximation of GTN(2,110) (ATL on the cap omitted).
    case 110:
      return Math.min(
        apocalypseMapsOver(saveData, charIdx, 1e5),
        talentTab2Cap(110, charIdx, saveData)
      );

    // ── 125 — Precision Power (per-char): Σ Refinery ranks, IF the
    // active char's total accuracy >= 2.25× the AFK target's defence ──
    // [STUB] The accuracy gate (PlayerAccTot vs AFKtarget defence) needs
    // the accuracy engine + the char's current AFK map, neither ported.
    // N.js returns the refinery-rank sum (Σ Refinery[3+g][1], g=0..5)
    // only when the gate passes, else 0. We can't evaluate the gate, so
    // we return 0 (conservative — matches the "gate failed" branch).
    case 125:
      return 0; // [STUB] accuracy gate unported (Precision Power)

    // ── 146 — Apocalypse Chow (per-char): mob types killed >1m ───────
    // Same shape as 110, threshold 1e6, cap GTN(2,146).
    case 146:
      return Math.min(
        apocalypseMapsOver(saveData, charIdx, 1e6),
        talentTab2Cap(146, charIdx, saveData)
      );

    // ── 209 — Apocalypse Wow (account-wide): mob types killed >1b ────
    // N.js DN4: count over the best Death-Bringer char's kill tracker at
    // the 1e9 threshold. We take the max count across all chars (no cap
    // in the in-game MAP build for 209).
    case 209:
      return apocalypseMapsOverBest(saveData, 1e9);

    // ── 305 — Looty Mc Shooty (per-char): items ever found ───────────
    // N.js: deep-copies Cards[1] (the "items ever found" registry — a
    // flat list), strips entries starting with "Gem"/"Cards", and the
    // remaining length is the item count. We mirror that exactly.
    case 305: {
      const cards1 = (saveData.cards1Data as any[]) || [];
      let count = 0;
      for (let i = 0; i < cards1.length; i++) {
        const s = String(cards1[i] ?? "");
        if (s.indexOf("Gem") === 0 || s.indexOf("Cards") === 0) continue;
        count++;
      }
      return count;
    }

    // ── 430 — Price Recession (account-wide): total Ninja upgrades ───
    // N.js: DN1 = Σ Ninja[103][g]. (Ninja Knowledge upgrade levels.)
    case 430: {
      const ninja103 = ((saveData.ninjaData as any)?.[103] as any[]) || [];
      let sum = 0;
      for (let g = 0; g < ninja103.length; g++) sum += Number(ninja103[g]) || 0;
      return sum;
    }

    // ── 470 — Paperwork, Great... (per-char): stamps in collection ───
    // N.js: count of StampLevelMAX[0..2][z] > 0.5 (stamps ever obtained,
    // across the 3 stamp categories). StampLevelMAX (the per-stamp cap)
    // is a RUNTIME array not present in the raw save — only the current
    // levels (StampLv) are saved.
    // [PROXY] We count StampLv[cat][slot] > 0 instead. This undercounts
    // stamps that are owned but sitting at level 0 (rare for end-game
    // accounts, which level every stamp they own).
    case 470: {
      const stampLv = stampLvData as any;
      let count = 0;
      for (let cat = 0; cat < 3; cat++) {
        const arr = stampLv?.[cat] ?? stampLv?.[String(cat)];
        if (!arr) continue;
        // StampLv can be an array or a {slot: lv} dict per category.
        if (Array.isArray(arr)) {
          for (let z = 0; z < arr.length; z++) {
            if ((Number(arr[z]) || 0) > 0.5) count++;
          }
        } else if (typeof arr === "object") {
          for (const k in arr) {
            if ((Number(arr[k]) || 0) > 0.5) count++;
          }
        }
      }
      return count; // [PROXY] StampLv>0 stands in for StampLevelMAX>0.5
    }

    // ── 485 — Virile Vials (per-char): vials at >= Green LV ──────────
    // N.js: count of CauldronInfo[4][g] > 3. (Vial levels; >3 = Green+.)
    case 485: {
      // CauldronInfo[4] can be an array or a {slot: lv} dict depending
      // on the save envelope — handle both.
      const vials = (cauldronInfoData as any)?.[4];
      let count = 0;
      if (Array.isArray(vials)) {
        for (let g = 0; g < vials.length; g++) {
          if ((Number(vials[g]) || 0) > 3) count++;
        }
      } else if (vials && typeof vials === "object") {
        for (const k in vials) {
          if ((Number(vials[k]) || 0) > 3) count++;
        }
      }
      return count;
    }

    // ── 595 — Essential Essence (account-wide): total Summon upgrades ─
    // N.js: DN5 = Σ Summon[0][g] (summoning upgrade levels). The bonus
    // path uses floor(MAP[595]/100), but MAP[595] itself is the raw sum.
    case 595: {
      const summon0 = ((saveData.summonData as any)?.[0] as any[]) || [];
      let sum = 0;
      for (let g = 0; g < summon0.length; g++) sum += Number(summon0[g]) || 0;
      return sum;
    }

    // ── 616 — Beginner Best Class (account-wide): best Beginner Lv ───
    // N.js: scan chars with class<6; MAP[616] = max(Lv0[0]). Lv0[0] is
    // the character (player) level.
    case 616: {
      let best = 0;
      for (let ci = 0; ci < numCharacters; ci++) {
        const cls = Number((charClassData as any)[ci]) || 0;
        if (cls >= 6) continue;
        const lv = Number(lv0Of(saveData, ci)[0]) || 0;
        if (lv > best) best = lv;
      }
      return best;
    }

    // ── 620 — Will Of The Eldest (account-wide): highest char Lv ─────
    // N.js: scan ALL chars (no class filter); MAP[620] = max(Lv0[0]).
    case 620: {
      let best = 0;
      for (let ci = 0; ci < numCharacters; ci++) {
        const lv = Number(lv0Of(saveData, ci)[0]) || 0;
        if (lv > best) best = lv;
      }
      return best;
    }

    // ── 643 — Coins For Charon (per-char): Multikill Damage Tier ─────
    // N.js seeds MAP[643] = -11, then lazily replaces it with
    // RunCodeOfTypeXforThingY("OverkillStuffs","2") (the purple multikill
    // damage tier shown in AFK Info) on first read.
    // [STUB] The overkill-tier sim isn't ported. Returns 0.
    case 643:
      return 0; // [STUB] OverkillStuffs("2") multikill tier (Coins For Charon)

    // ── 644 — American Tipper (per-char): Cooking Lv / 10 ────────────
    // N.js: MAP[644] = Lv0[10] / 10 (active char's cooking level over 10,
    // NOT floored — it's a continuous /10).
    case 644: {
      const cooking = Number(lv0Of(saveData, charIdx)[10]) || 0;
      return cooking / 10;
    }

    // ── 650 — Rando Event Looty (account-wide): rare random-event ────
    // items found. N.js: for catalog index 0..4, count cards in Cards[1]
    // matching RANDOlist[82+i] entries.
    case 650: {
      const cards1 = new Set(
        ((saveData.cards1Data as any[]) || []).map((x) => String(x))
      );
      let count = 0;
      for (let i = 0; i < 5; i++) {
        const list = (RANDOlist as any[])?.[82 + i] as any[];
        if (!Array.isArray(list)) continue;
        for (let z = 0; z < list.length; z++) {
          if (cards1.has(String(list[z]))) count++;
        }
      }
      return count;
    }

    // ── 656 — Dreamer Damage (account-wide): Equinox Dream clouds done ─
    // N.js: count of DreamChallenge entries g where WeeklyBoss["d_"+g]
    // === -1 (a completed dream cloud is flagged -1). Skipped during the
    // Tutorial scene (always false in our offline context).
    case 656: {
      const wb = (saveData as any).weeklyBossData || {};
      const challenges = (DreamChallenge as any[]) || [];
      let count = 0;
      for (let g = 0; g < challenges.length; g++) {
        if (Number(wb["d_" + g]) === -1) count++;
      }
      return count;
    }

    default:
      return 0;
  }
}
