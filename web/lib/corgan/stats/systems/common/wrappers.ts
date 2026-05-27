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
 *  The TALENT tree itself (Effective Level → Base / Bonus / Super +
 *  Best Character N) is spread directly under this node — IDENTICAL
 *  to what /talents-level shows when the user picks Tal 328. The only
 *  difference is /drop-rate appends a Plunderous Kills sibling and the
 *  parent val is the multiplicative DR factor instead of the raw
 *  talent value. Net effect: when the user edits something inside the
 *  Effective Level subtree (in the research tool), both pages
 *  recompute from the same source. */
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
        // Spread the talent.resolve(328) children directly so the
        // Effective Level subtree appears at the same nesting depth as
        // /talents-level — no "Talent Value" wrapper this time.
        ...(talentTree.children ?? []),
        // DR-specific extra: the Plunderous Kills the multiplier scales
        // against. Only present on /drop-rate.
        node("Plunderous Kills", plunderKills, null, {
          fmt: "raw",
          note: "OLA[139] — applied as × multiplier in DR postMult only",
        }),
      ],
      {
        fmt: "x",
        note: `1 + (${talentVal.toFixed(2)} talent × log(${plunderKills})) / 100`,
      }
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
