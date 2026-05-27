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

/** Workshop = Tal 328 (Archlord of the Pirates) applied as a DR
 *  postMult factor: 1 + (talent_value × log(plunderousKills)) / 100.
 *
 *  The Plunderous Kills × multiplier wrap now lives inside
 *  `talent.resolve` itself (see common/talent.ts useMaxMode branch),
 *  so /drop-rate and /talents-level both surface the talent's FINAL
 *  bonus value (with Plunderous Kills already applied) from a single
 *  source. This wrapper is just a delegate — same input, same output
 *  as talent.resolve(328) directly. Kept as a separate symbol so the
 *  DR descriptor's existing `workshop` reference doesn't need to be
 *  rewritten. */
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
