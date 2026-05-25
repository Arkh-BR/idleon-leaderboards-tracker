// ===== TALENT SYSTEM =====
// Pragmatic port of corgan-source/js/stats/systems/common/talent.js.
//
// Reads the raw talent level for a character and applies the talent
// formula via formulaEval. The full Corgan implementation also folds in
// `computeAllTalentLVz` — a chain of ~15 sources (Spelunk Super Talents,
// Talent 149/374/539, Achievement 291, Family Bonus 68, Companion 1,
// Divinity Minor 2, Dream 12, OLA 232, Grimoire 39, Kattlekruk Set, Arcane
// 57, SuperBit 47) that bumps the effective level. Stage 2 ships a stub of
// that chain that returns 0 — the resulting val matches the game for any
// account that hasn't farmed those sources, and is a small underestimate
// otherwise. The chain will be filled in incrementally in Stages 3-4.

import { node, type CorganNode } from "../../../node";
import {
  skillLvData,
  cauldronInfoData,
  optionsListData,
  playerStuffData,
} from "../../../save/data";
import { formulaEval, getLOG } from "../../../formulas";
import { superBitType } from "../../../game-helpers";
import { hasBonusMajor } from "../w5/divinity";
import { label, entityName } from "../../entity-names";
import { talentParams, familyBonusParams } from "../../data/common/talent";
import { companionBonus } from "../../data/common/companions";
import { bubbleParams } from "../../data/w2/alchemy";
import { equipSetBonus } from "../../data/common/equipment";
import { godMinorX1 } from "../../data/w5/divinity";
import { DIVINITY_MINOR_DENOM } from "../../data/game-constants";
import { numCharacters, charClassData } from "../../../save/data";
import type { SaveData } from "../../../state";

type Ctx = {
  saveData: SaveData;
  charIdx: number;
  activeCharIdx?: number;
};

type TalentResolveArgs = {
  tab?: number;
  mode?: "max";
};

export type TalentBonusDetail = { total: number; children: CorganNode[] };

/**
 * Stage-2 simplification: returns 0 ATL bonus levels with an empty children
 * list. Stage 3+ will replace this with the full Corgan implementation
 * pulling from Spelunk / Talent 149-374-539 / Achievement 291 / FamBonus 68
 * / Companion 1 / Divinity Minor 2 / Dream 12 / OLA 232 / Grimoire 39 /
 * Kattlekruk Set / Arcane 57 / SuperBit 47.
 */
export function computeAllTalentLVz(
  _talentIdx: number,
  _slotIdx: number,
  _opts: unknown,
  _saveData: SaveData
): number {
  return 0;
}

function getTalentData(id: number, tab?: number) {
  const p = talentParams(id, tab);
  if (!p || !p.formula || p.formula === "txt" || p.formula === "_") return null;
  const name = entityName("Talent", id) || "Talent " + id;
  return { x1: p.x1, x2: p.x2, formula: p.formula, name };
}

function getTalentNumber(
  charIdx: number,
  talentIdx: number,
  data: { x1: number; x2: number; formula: string },
  _activeCharIdx: number | undefined,
  _atlIdx: number | undefined,
  saveData: SaveData
) {
  const sl = (skillLvData as any)[charIdx] || {};
  const rawLv = Number(sl[talentIdx] || sl[String(talentIdx)]) || 0;
  if (rawLv <= 0) {
    return {
      val: 0,
      rawLv: 0,
      bonus: 0,
      effectiveLv: 0,
      bonusDetail: { total: 0, children: [] } as TalentBonusDetail,
    };
  }
  // Stage 2: bonus=0. Stage 3+ injects the real ATL chain here.
  const bonus = 0;
  const effectiveLv = rawLv + bonus;
  const val = formulaEval(data.formula, data.x1, data.x2, effectiveLv);
  return {
    val,
    rawLv,
    bonus,
    effectiveLv,
    bonusDetail: { total: 0, children: [] } as TalentBonusDetail,
  };
}

function getbonus2(
  talentIdx: number,
  data: { x1: number; x2: number; formula: string },
  activeCharIdx: number | undefined,
  saveData: SaveData
) {
  let best = 0;
  let bestChar = -1;
  let bestR:
    | ReturnType<typeof getTalentNumber>
    | null = null;
  for (let ci = 0; ci < numCharacters; ci++) {
    const sl = (skillLvData as any)[ci] || {};
    const rawLv = Number(sl[talentIdx] || sl[String(talentIdx)]) || 0;
    let r: ReturnType<typeof getTalentNumber>;
    if (talentIdx >= 100) {
      const ctxForATL = activeCharIdx != null && activeCharIdx >= 0 ? activeCharIdx : ci;
      r = getTalentNumber(ci, talentIdx, data, ctxForATL, rawLv, saveData);
    } else if (rawLv <= 0) {
      r = {
        val: 0,
        rawLv: 0,
        bonus: 0,
        effectiveLv: 0,
        bonusDetail: { total: 0, children: [] },
      };
    } else {
      const v = formulaEval(data.formula, data.x1, data.x2, rawLv);
      r = {
        val: v,
        rawLv,
        bonus: 0,
        effectiveLv: rawLv,
        bonusDetail: { total: 0, children: [] },
      };
    }
    if (r.val > best) {
      best = r.val;
      bestChar = ci;
      bestR = r;
    }
  }
  return { val: best, bestChar, detail: bestR };
}

export function maxTalentBonus(
  talentIdx: number,
  activeCharIdx: number | undefined,
  saveData: SaveData
): number {
  const data = getTalentData(talentIdx);
  if (!data) return 0;
  return getbonus2(talentIdx, data, activeCharIdx, saveData).val;
}

export const talent = {
  resolve(id: number, ctx: Ctx, args?: TalentResolveArgs): CorganNode {
    const saveData = ctx.saveData;
    const tab = args && args.tab;
    const data = getTalentData(id, tab);
    if (!data) {
      return node(label("Talent", id), 0, null, { note: "talent " + id + " no data" });
    }
    const name = label("Talent", id);
    const mode = args && args.mode;

    if (mode === "max") {
      const r = getbonus2(id, data, ctx.charIdx, saveData);
      let maxChildren: CorganNode[] = [
        node("Best Character " + r.bestChar, r.val, null, { fmt: "raw" }),
      ];
      if (r.detail) {
        maxChildren = [
          node("Base Level", r.detail.rawLv, null, { fmt: "raw" }),
          node(
            "Bonus Levels",
            r.detail.bonus,
            r.detail.bonusDetail.children.length ? r.detail.bonusDetail.children : null,
            { fmt: "+" }
          ),
          node("Effective Level", r.detail.effectiveLv, null, { fmt: "raw" }),
          node("Best Character " + r.bestChar, r.val, null, { fmt: "raw" }),
        ];
      }
      return node(name, r.val, maxChildren, { fmt: "+", note: "talent " + id });
    }

    // Talent 328 (Archlord of the Pirates): multiplicative DR factor
    if (id === 328) {
      const gb = getbonus2(id, data, ctx.charIdx, saveData);
      const plunderKills = Number((optionsListData as any)[139]) || 0;
      const logVal = plunderKills > 0 ? getLOG(plunderKills) : 0;
      if (gb.val <= 0 || plunderKills <= 0) {
        return node(name, 1, null, { fmt: "x", note: "talent 328" });
      }
      const total328 = 1 + (gb.val * logVal) / 100;
      const talCh: CorganNode[] = [];
      if (gb.detail) {
        talCh.push(node("Base Level", gb.detail.rawLv, null, { fmt: "raw" }));
        talCh.push(
          node(
            "Bonus Levels",
            gb.detail.bonus || 0,
            gb.detail.bonusDetail && gb.detail.bonusDetail.children.length
              ? gb.detail.bonusDetail.children
              : null,
            { fmt: "+" }
          )
        );
        talCh.push(node("Effective Level", gb.detail.effectiveLv, null, { fmt: "raw" }));
      }
      return node(
        name,
        total328,
        [
          node("Talent Value", gb.val, talCh, {
            fmt: "raw",
            note:
              "decay(6,150," +
              (gb.detail ? gb.detail.effectiveLv : "?") +
              ")",
          }),
          node("Plunderous Kills", plunderKills, null, {
            fmt: "raw",
            note: "OLA[139]",
          }),
          node("log₁₀(" + plunderKills + ")", logVal, null, { fmt: "raw" }),
        ],
        { fmt: "x", note: "talent 328" }
      );
    }

    const r = getTalentNumber(ctx.charIdx, id, data, ctx.activeCharIdx, undefined, saveData);
    if (r.val === 0) return node(name, 0, null, { note: "talent " + id });

    const bonusChildren =
      r.bonusDetail && r.bonusDetail.children.length ? r.bonusDetail.children : null;

    // Talent 655 (Boss Battle Spillover): multiply by OLA[189] skulls beaten
    if (id === 655) {
      const skulls = Number((optionsListData as any)[189]) || 0;
      const perSkull = r.val;
      const total = perSkull * skulls;
      return node(
        name,
        total,
        [
          node("Base Level", r.rawLv, null, { fmt: "raw" }),
          node("Bonus Levels", r.bonus || 0, bonusChildren, { fmt: "+" }),
          node("Effective Level", r.effectiveLv, null, { fmt: "raw" }),
          node("Per Skull", perSkull, null, { fmt: "raw" }),
          node("Skulls Beaten", skulls, null, { fmt: "raw", note: "OLA[189]" }),
        ],
        { fmt: "+", note: "talent 655" }
      );
    }

    return node(
      name,
      r.val,
      [
        node("Base Level", r.rawLv, null, { fmt: "raw" }),
        node("Bonus Levels", r.bonus || 0, bonusChildren, { fmt: "+" }),
        node("Effective Level", r.effectiveLv, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "talent " + id }
    );
  },
};

// Silence unused-import warnings — these symbols stay imported to keep
// the source dependency map identical to Corgan's, so Stage 3+ can
// add the real implementations without changing the import surface.
void cauldronInfoData;
void playerStuffData;
void superBitType;
void hasBonusMajor;
void companionBonus;
void bubbleParams;
void equipSetBonus;
void godMinorX1;
void DIVINITY_MINOR_DENOM;
void familyBonusParams;
void charClassData;
