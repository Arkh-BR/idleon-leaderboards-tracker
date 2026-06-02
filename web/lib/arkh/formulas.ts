// ===== FORMULA ENGINE =====
// 1:1 port of corgan-source/js/formulas.js. Pure, no state.

export type FormulaType =
  | "add" | "addLower"
  | "addDECAY"
  | "decay" | "decayLower"
  | "decayMulti" | "decayMultiLower"
  | "bigBase" | "bigBaseLower"
  | "intervalAdd" | "intervalAddLower"
  | "reduce" | "reduceLower"
  | "PtsSpentOnGuildBonus";

/**
 * ArbitraryCode5Inputs — the game's universal formula evaluator.
 * Used by stamps, talents, bubbles, and dozens of other systems.
 */
export function formulaEval(
  type: string,
  x1: number,
  x2: number,
  lv: number
): number {
  switch (type) {
    case "add":
      return x2 !== 0
        ? ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1
        : x1 * lv;
    case "addLower":
      return x1 + x2 * (lv + 1);
    case "addDECAY":
      return lv < 50001
        ? x1 * lv
        : x1 * Math.min(50000, lv) +
            ((lv - 50000) / (lv - 50000 + 150000)) * x1 * 50000;
    case "decay":
      return (x1 * lv) / (lv + x2);
    case "decayLower":
      return (x1 * (lv + 1)) / (lv + 1 + x2) - (x1 * lv) / (lv + x2);
    case "decayMulti":
      return 1 + (x1 * lv) / (lv + x2);
    case "decayMultiLower":
      return (x1 * (lv + 1)) / (lv + 1 + x2) - (x1 * lv) / (lv + x2);
    case "bigBase":
      return x1 + x2 * lv;
    case "bigBaseLower":
      return x2;
    case "intervalAdd":
      return x1 + Math.floor(lv / x2);
    case "intervalAddLower":
      return (
        Math.max(Math.floor((lv + 1) / x2), 0) -
        Math.max(Math.floor(lv / x2), 0)
      );
    case "reduce":
      return x1 - x2 * lv;
    case "reduceLower":
      return x1 - x2 * (lv + 1);
    case "PtsSpentOnGuildBonus":
      return (
        ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1 -
        x2 * lv
      );
    default:
      return 0;
  }
}

/** getLOG — game's log helper (Math.log(x)/2.30259, truncated ln10). */
export function getLOG(x: number): number {
  return Math.log(Math.max(x, 1)) / 2.30259;
}
