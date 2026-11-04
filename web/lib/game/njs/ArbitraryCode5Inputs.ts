import { block } from "../ctx";

/**
 * N.js `_customBlock_ArbitraryCode5Inputs(a, b, c, f, g, h)` @4101084: the game's shared curve formulas. `a` names the curve, `b` and
 * `c` are its constants and `f` the level; `g` and `h` are not read. Any other name is 0. The whole function, one expression.
 */
export const ArbitraryCode5Inputs = block("ArbitraryCode5Inputs", (_ctx, a: string, b: number, c: number, f: number, _g: number, _h: number) =>
  "add" == a
    ? 0 != c
      ? ((((b + c) / c + 0.5 * (f - 1)) / (b / c)) * f * b)
      : b * f
    : "addLower" == a
      ? b + c * (f + 1)
      : "addDECAY" == a
        ? 50001 > f
          ? b * f
          : b * Math.min(5e4, f) + ((f - 5e4) / (15e4 + (f - 5e4))) * b * 5e4
        : "decay" == a
          ? (b * f) / (f + c)
          : "decayLower" == a
            ? (b * (f + 1)) / (f + 1 + c) - (b * f) / (f + c)
            : "decayMulti" == a
              ? 1 + (b * f) / (f + c)
              : "decayMultiLower" == a
                ? (b * (f + 1)) / (f + 1 + c) - (b * f) / (f + c)
                : "bigBase" == a
                  ? b + c * f
                  : "bigBaseLower" == a
                    ? c
                    : "intervalAdd" == a
                      ? b + Math.floor(f / c)
                      : "intervalAddLower" == a
                        ? Math.max(Math.floor((f + 1) / c), 0) - Math.max(Math.floor(f / c), 0)
                        : "reduce" == a
                          ? b - c * f
                          : "reduceLower" == a
                            ? b - c * (f + 1)
                            : "PtsSpentOnGuildBonus" == a
                              ? (((b + c) / c + 0.5 * (f - 1)) / (b / c)) * f * b - c * f
                              : 0
);
