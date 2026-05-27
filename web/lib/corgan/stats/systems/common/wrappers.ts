// ===== GLIMBO / WORKSHOP / EVENT SHOP WRAPPERS =====
// 1:1 port of corgan-source/js/stats/systems/common/wrappers.js.

import { grid } from "../w4/lab";
import { talent } from "./talent";
import { node, type CorganNode } from "../../../node";
import { eventShopOwned } from "../../../game-helpers";
import { getLOG } from "../../../formulas";
import { optionsListData } from "../../../save/data";
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
 *  talent.resolve(328) returns the cross-char Effective Level tree (via
 *  the account-wide auto-max emit) with val = the bonus value the
 *  Archlord owner contributes. We wrap that here with the Plunderous
 *  Kills × log factor that the DR formula expects. This used to live
 *  inside talent.resolve as a Tal 328 special branch, but the
 *  multiplier is purely a DR-application concern and doesn't belong on
 *  /talents-level. Co-locating it with the workshop entry keeps the
 *  talent system unified and the DR-specific logic isolated to the
 *  caller that actually needs it. */
export const workshop = {
  resolve(_id: number, ctx: Ctx, args?: any): CorganNode {
    const talentTree = talent.resolve(328, ctx, args);
    const talentVal = Number(talentTree.val) || 0;
    const plunderKills = Number((optionsListData as any)[139]) || 0;
    if (talentVal <= 0 || plunderKills <= 0) {
      return node(talentTree.name, 1, null, {
        fmt: "x",
        note:
          plunderKills <= 0
            ? "Inactive — no Plunderous Kills (OLA[139])"
            : "Inactive — Archlord talent contributes 0",
      });
    }
    const logVal = getLOG(plunderKills);
    const total = 1 + (talentVal * logVal) / 100;
    return node(
      talentTree.name,
      total,
      [
        // Wrap the talent's emit under "Talent Value" so the user sees
        // the full Effective Level breakdown nested inside, mirroring
        // the old special-branch shape.
        node("Talent Value", talentVal, talentTree.children ?? null, {
          fmt: "raw",
          note: talentTree.note,
        }),
        node("Plunderous Kills", plunderKills, null, {
          fmt: "raw",
          note: "OLA[139]",
        }),
      ],
      { fmt: "x", note: "1 + (talent × log(kills)) / 100" }
    );
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
