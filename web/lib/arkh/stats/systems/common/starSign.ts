// ===== STAR SIGN SYSTEM =====
// Pragmatic port: covers computeSeraphMulti (used widely) and the
// "drop" descriptor used by the DR additive pool. Full table of every
// SIGN_BONUSES key + per-sign accumulator lives in corgan-source — we
// port the minimum the DR pipeline reads.

import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { labData, starSignData } from "../../../save/data";
import { starSignDropVal } from "../../data/common/starSign";
import { computeMeritocBonusz } from "../w7/meritoc";
import { computeShinyBonusS } from "../w4/breeding";
import { StarSigns } from "../../data/game/customlists.js";
import { chipBonuses } from "../w4/lab";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

// ── Keyed star-sign bonus (shared) ──────────────────────────────────────
// The game hardcodes per-sign bonuses by index (description strings don't
// match keys). Map: effectKey → { signIndex: baseValue }. Single source of
// truth used by derived-stats (HP/MP) and derived-damage (damage/accuracy/
// move speed) — previously copy-pasted into both.
export const SIGN_BONUSES: Record<string, Record<number, number>> = {
  FightAFK: { 19: 2, 28: 6, 29: -6, 56: 4 },
  SkillAFK: { 20: 2, 25: 1, 29: -6, 55: 4 },
  SkillEXP: { 30: 3, 50: 6 },
  MainXP: { 2: 1, 24: 3, 52: 6 },
  WorshExp: { 46: 15 },
  Drop: { 14: 5, 76: 12 },
  PctDmg: { 0: 1, 32: 2, 51: 20, 53: 6, 54: 15, 70: 25 },
  WepPow: { 12: 2 },
  MoveSpd: { 1: 2, 8: 4, 13: 2, 32: -3, 51: -12 },
  TotalHP: { 28: -80 },
  FoodEffect: { 22: 15 },
};

export type StarSignTree = { val: number; children: ArkhNode[] | null };

/** Number of star signs enabled (rift lv >= 10 unlocks 5 + shiny bonus). */
export function getEnabledStarSigns(saveData: SaveData): number {
  const riftLv = Number(saveData.riftData && (saveData.riftData as any)[0]) || 0;
  return riftLv >= 10 ? 5 + computeShinyBonusS(3, saveData) : 0;
}

/** Keyed star-sign bonus (e.g. "PctDmg", "MoveSpd", "FoodEffect"): Σ per-sign
 *  base values (negatives only count once their sign is enabled) × Seraph
 *  multiplier. Returns a Tree; callers wanting just the scalar read `.val`. */
export function computeStarSignBonus(
  key: string,
  ci: number,
  saveData: SaveData
): StarSignTree {
  const bonusMap = SIGN_BONUSES[key];
  if (!bonusMap) return { val: 0, children: null };
  const enabled = getEnabledStarSigns(saveData);
  let total = 0;
  const children: ArkhNode[] = [];
  for (const k of Object.keys(bonusMap)) {
    const sigIdx = Number(k);
    const val = bonusMap[sigIdx];
    if (val < 0 && sigIdx < enabled) continue;
    total += val;
    children.push(node("Sign " + sigIdx, val, null, { fmt: "raw" }));
  }
  let seraphMulti = 1;
  if (total > 0) {
    seraphMulti = computeSeraphMulti(ci, saveData);
    total *= seraphMulti;
  }
  if (seraphMulti !== 1 && children.length)
    children.push(node("Seraph Multi", seraphMulti, null, { fmt: "x" }));
  return { val: total, children };
}

const SIGN_TABLES: Record<
  string,
  { indices: number[]; val: (idx: number) => number }
> = {
  drop: { indices: [14, 76], val: starSignDropVal },
};

const STAR_CHIP_ID = 15;

export function computeSeraphMulti(charIdx: number, saveData: SaveData): number {
  // Defensive: starSignsUnlocked is supposed to be a Record<string, unknown>,
  // but some loader paths historically produced a Number (a regression we
  // hit on at least one save where StarSg was already parsed by IT). The
  // `in` operator throws on non-objects, so explicitly check shape first.
  const unlocked = saveData.starSignsUnlocked;
  if (!unlocked || typeof unlocked !== "object" || Array.isArray(unlocked))
    return 1;
  if (!("Seraph_Cosmos" in unlocked)) return 1;

  const arcane40 = Number((saveData.arcaneData as any)?.[40]) || 0;
  const lv0 = saveData.lv0AllData && (saveData.lv0AllData[charIdx] as any[]);
  const summonLv = Number(lv0?.[18]) || 0;
  const seraphBase = 1.1 + Math.min(arcane40, 10) / 100;
  const seraphExp = Math.ceil((summonLv + 1) / 20);
  const seraphMulti = Math.min(5, Math.pow(seraphBase, seraphExp));

  let hasStarChip = false;
  const chipSlots = (labData as any)?.[1 + charIdx];
  if (chipSlots) {
    for (let c = 0; c < 7; c++) {
      if (Number(chipSlots[c]) === STAR_CHIP_ID) {
        hasStarChip = true;
        break;
      }
    }
  }
  const riftLv = Number((saveData.riftData as any)?.[0]) || 0;
  const enabledSS = riftLv >= 10 ? 5 : 0;
  const chipMulti = hasStarChip && enabledSS >= 1 ? Math.max(1, Math.min(2, 2)) : 1;

  const meritoc22 = computeMeritocBonusz(22, saveData);
  const meritocMulti = 1 + meritoc22 / 100;

  return chipMulti * meritocMulti * seraphMulti;
}

export const starSign = {
  resolve(id: string, ctx: Ctx): ArkhNode {
    const saveData = ctx.saveData;
    const table = SIGN_TABLES[id];
    if (!table)
      return node("Star Signs", 0, null, { note: "starSign:" + id });
    let baseTotal = 0;
    const signChildren: ArkhNode[] = [];
    for (let i = 0; i < table.indices.length; i++) {
      const idx = table.indices[i];
      const bonus = table.val(idx);
      const name = label("Star Sign", idx);
      signChildren.push(node(name, bonus, null, { fmt: "+" }));
      baseTotal += bonus;
    }
    if (baseTotal <= 0)
      return node("Star Signs", 0, signChildren, {
        fmt: "+",
        note: "starSign:" + id,
      });

    const totalMulti = computeSeraphMulti(ctx.charIdx, saveData);
    const total = baseTotal * totalMulti;

    // Flatten: skip the "Base Sum" wrapper and just hang the individual sign
    // rows directly under "Star Signs", followed by the Seraph multiplier as
    // its own sibling row. The base sum is implicit from the sum of sign
    // children + the multiplier shows its own factor.
    return node(
      "Star Signs",
      total,
      [
        ...signChildren,
        node("Seraph Multiplier", totalMulti, null, { fmt: "x" }),
      ],
      { fmt: "+", note: "starSign:" + id }
    );
  },
};

// ── Active star signs (the faithful per-key sum) ────────────────────────
// N.js _customBlock_StarSigns (@6490716). A sign counts only when it is in
// StarSignsDL = the character's equipped signs (PVtStarSign_ci) ∪ every
// k < enabledStarSigns whose name is in StarSignsUnlocked. Some lines only
// apply while the sign is at or above the enabled count (29, 54) or above a
// class level (56). One star chip with no enabled signs re-adds the equipped
// signs (2nd pass, @6491933) unless pass 1 went negative (N.js restores the
// negatives); Seraph multiplies positive totals only (@6514021).
// computeStarSignBonus above keeps the DR's "every listed sign" reading.

type SignTerm = {
  sign: number;
  val: number;
  /** Only while sign ≥ enabledStarSigns (N.js `sign > enabled − 1`). */
  notEnabled?: boolean;
  /** Only when the class level Lv0[0] is above this. */
  lvAbove?: number;
};

// @njs _customBlock_StarSigns
export const STAR_SIGN_TERMS: Record<string, readonly SignTerm[]> = {
  FightAFK: [
    { sign: 19, val: 2 },
    { sign: 28, val: 6 },
    { sign: 29, val: -6, notEnabled: true },
    { sign: 54, val: -7, notEnabled: true },
    { sign: 56, val: 4, lvAbove: 99 },
  ],
};

export function starSignBonusReal(key: string, ci: number, saveData: SaveData): StarSignTree {
  const terms = STAR_SIGN_TERMS[key] ?? [];
  const enabled = getEnabledStarSigns(saveData);
  const lv = Number((saveData.lv0AllData as any)?.[ci]?.[0]) || 0;
  const equipped = new Set(String((starSignData as any)?.[ci] ?? "").split(","));
  const active = new Set(equipped);
  const unlocked = saveData.starSignsUnlocked;
  const names = StarSigns as unknown as string[][];
  if (unlocked && typeof unlocked === "object" && !Array.isArray(unlocked)) {
    for (let k = 0; k < enabled && k < names.length; k++) {
      const nm = names[k]?.[0];
      if (nm && nm in unlocked) active.add(String(k));
    }
  }
  const counted = (dl: Set<string>) =>
    terms.filter(
      (t) => dl.has(String(t.sign)) && (!t.notEnabled || t.sign > enabled - 1) && (t.lvAbove == null || lv > t.lvAbove)
    );
  const sumOf = (ts: readonly SignTerm[]) => ts.reduce((a, t) => a + t.val, 0);
  const pass1 = counted(active);
  const sum1 = sumOf(pass1);
  const again = chipBonuses("star", ci) === 1 && !(enabled >= 1) && sum1 >= 0 ? counted(equipped) : [];
  const base = sum1 + sumOf(again);
  const seraph = base > 0 ? computeSeraphMulti(ci, saveData) : 1;
  const children: ArkhNode[] = pass1.map((t) => node(label("Star Sign", t.sign), t.val, null, { fmt: "+" }));
  if (again.length) children.push(node("Star chip: equipped signs count twice", sumOf(again), null, { fmt: "+" }));
  if (seraph !== 1) children.push(node("Seraph Multi", seraph, null, { fmt: "x" }));
  return { val: base * seraph, children };
}
