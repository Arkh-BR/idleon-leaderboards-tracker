// ===== FAMILY BONUS (class-wide) =====
// N.js keeps every class's family bonus in DNSM.FamBonusQTYs keyed 2×classIdx
// (FB "68" = Elemental Sorcerer 34, "66" = 33, "64" = Wizard 32, "18" = 9 —
// and "32" = Royal Guardian 16). The value is the ClassFamilyBonuses[cls] curve
// evaluated at (best character level of that class − ClassAccountBonus[cls]
// offset), the same shape talent.ts already uses for Family Bonus 68.
//
// The 2026-08 Royal Guardian family bonus is "+{%_DROP_RATE|MULTIPLIER"
// decay(10, 800): the DR chain applies ×(1 + FamBonusQTYs["32"]/100).

import { node, type ArkhNode } from "../../../node";
import { familyBonusParams } from "../../data/common/talent";
import { ClassNames } from "../../data/game/customlists.js";
import { charClassData, numCharacters } from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { computeFamBonusQTYs } from "./stats";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx?: number; activeCharIdx?: number };

/** Highest Lv0 among characters whose class index is exactly `clsIdx`. */
export function bestClassLevel(clsIdx: number, saveData: SaveData): number {
  let best = 0;
  for (let ci = 0; ci < numCharacters; ci++) {
    if (Number((charClassData as any)?.[ci]) !== clsIdx) continue;
    const lv = Number((saveData as any).lv0AllData?.[ci]?.[0]) || 0;
    if (lv > best) best = lv;
  }
  return best;
}

// @njs ClassFamilyBonuses[16]
// (FamBonusQTYs is a DNSM map, not a formula — the mirrored constant is the
// Royal Guardian row of ClassFamilyBonuses, so a curve change flags this file.)
export function familyBonusValue(clsIdx: number, saveData: SaveData): number {
  const p = familyBonusParams(clsIdx);
  if (!p || !p.formula || p.formula === "_" || p.formula === "txt") return 0;
  const famN = Math.max(0, Math.round(bestClassLevel(clsIdx, saveData) - p.lvOffset));
  return famN > 0 ? formulaEval(p.formula, p.x1, p.x2, famN) : 0;
}

function className(clsIdx: number): string {
  const raw = String((ClassNames as any)?.[clsIdx] ?? `Class ${clsIdx}`);
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export const familyBonus = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const s = ctx.saveData;
    const p = familyBonusParams(id);
    const best = bestClassLevel(id, s);
    const curve = familyBonusValue(id, s);
    // The chain reads DNSM.FamBonusQTYs[2·id] as the game builds it for the
    // ACTIVE character: a running max over characters in save order where the
    // active character's own value is buffed by its The Family Guy (talent
    // 144). computeFamBonusQTYs ports that loop, so e.g. the top Royal
    // Guardian with Family Guy gets ×(1 + tal144/100) on its own DR.
    const active = ctx.activeCharIdx ?? ctx.charIdx ?? -1;
    const val = computeFamBonusQTYs(active, s)[2 * id] ?? curve;
    const cls = className(id);
    return node(
      `${cls} Family Bonus`,
      val,
      [
        node(`Best ${cls} Lv`, best, null, {
          fmt: "raw",
          note: best > 0 ? "max across account" : "no character of this class",
        }),
        node("Lv Offset", p?.lvOffset ?? 0, null, { fmt: "raw" }),
        node("Formula x1", p?.x1 ?? 0, null, { fmt: "raw" }),
        node("Formula x2", p?.x2 ?? 0, null, { fmt: "raw" }),
        ...(val !== curve
          ? [
              node("The Family Guy (Talent 144)", val - curve, null, {
                fmt: "+",
                note: "active character's own family bonus × (1 + talent 144 / 100)",
              }),
            ]
          : []),
      ],
      { fmt: "+", note: `family bonus ${id} (FamBonusQTYs["${2 * id}"])` }
    );
  },
};
