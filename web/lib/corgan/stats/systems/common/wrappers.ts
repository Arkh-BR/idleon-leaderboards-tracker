// ===== GLIMBO / WORKSHOP / EVENT SHOP WRAPPERS =====
// 1:1 port of corgan-source/js/stats/systems/common/wrappers.js.

import { grid } from "../w4/lab";
import { talent } from "./talent";
import { node, type CorganNode } from "../../../node";
import { eventShopOwned } from "../../../game-helpers";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export const glimbo = {
  resolve(_id: number, ctx: Ctx, args?: number[]): CorganNode {
    return grid.resolve(168, ctx, args);
  },
};

/** Workshop = Tal 328 (Archlord of the Pirates) as a DR postMult factor.
 *  The × log10(Plunderous Kills) wrap lives in talent.resolve(328) via
 *  the TALENT_FINAL_BONUS_WRAPS registry, so this wrapper just delegates
 *  — talent.resolve already returns the final 1.xxx× multiplier with the
 *  Effective Level + Talent Value + Plunderous Kills breakdown. Kept as a
 *  separate symbol so the DR descriptor's `workshop` reference is stable. */
export const workshop = {
  resolve(_id: number, ctx: Ctx, args?: any): CorganNode {
    return talent.resolve(328, ctx, args);
  },
};

export const eventShop = {
  resolve(id: number, ctx: Ctx, args?: number[]): CorganNode {
    const owned = eventShopOwned(id, ctx.saveData.cachedEventShopStr || "");
    const coeff = (args && args[0]) || 1;
    const val = coeff * owned;
    return node(
      "Event Shop " + id,
      val,
      coeff !== 1
        ? [
            node("Owned", owned, null, { fmt: "raw" }),
            node("Coefficient", coeff, null, { fmt: "x" }),
          ]
        : null,
      { fmt: "+", note: "eventShop " + id }
    );
  },
};
