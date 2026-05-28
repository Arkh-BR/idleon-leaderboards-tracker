// ===== GLIMBO / WORKSHOP / EVENT SHOP WRAPPERS =====
// 1:1 port of corgan-source/js/stats/systems/common/wrappers.js.

import { grid } from "../w4/lab";
import { talent } from "./talent";
import { node, type CorganNode } from "../../../node";
import { eventShopOwned } from "../../../game-helpers";
import { getLOG } from "../../../formulas";
import { optionsListData } from "../../../save/data";
import { label } from "../../entity-names";
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
 *  Tal 328 itself is now a "normal" account-wide talent in
 *  ACCOUNT_WIDE_TALENT_IDS — its talent.resolve() returns the raw
 *  account-wide value (the % per log step, e.g. ~4.86 talent), with
 *  the standard Reference Character → Base Level → Bonus Levels
 *  shape. This wrapper is the DR-specific consumer: it pulls that
 *  raw talent value and applies the Plunderous Kills (OLA[139]) log
 *  multiplier, emitting the final 1.xxx× multiplier the DR pipeline
 *  expects.
 *
 *  Keeping the wrap here (instead of in EXTERNAL_CONTEXT_MULTIPLIERS)
 *  matches how the rest of the account-wide talents work: the talent
 *  emits its raw bonus, and anything that needs the wrap applies it
 *  at its consumption site. /talents-level for Tal 328 now shows the
 *  same shape as Tal 51/53/176/178 etc. — no special-cased "1.27×"
 *  pre-multiplied value that hid the talent's actual contribution. */
export const workshop = {
  resolve(_id: number, ctx: Ctx, args?: any): CorganNode {
    const talTree = talent.resolve(328, ctx, args);
    const talVal = Number(talTree.val) || 0;
    const plunder = Number((optionsListData as any)[139]) || 0;
    const active = talVal > 0 && plunder > 0;
    const multi = active ? 1 + (talVal * getLOG(plunder)) / 100 : 1;
    // Distinct name so the DR tree doesn't show two "Archlord Of The
    // Pirates (Talent 328)" nodes (the inner one is talTree, this one
    // is the wrap). The "× Plunderous Kills" suffix also makes the
    // contribution shape immediately scannable on the DR page.
    const talentLbl = label("Talent", 328);
    const wrapName = `Workshop DR — ${talentLbl} × Plunderous Kills`;
    const kids: CorganNode[] = [
      talTree,
      node("Talent Value", talVal, null, {
        fmt: "raw",
        note: "talent.resolve(328) val — % per log10(Plunderous Kills) step",
      }),
      node("Plunderous Kills", plunder, null, {
        fmt: "raw",
        note: "OLA[139] — count of plunderous kills",
      }),
    ];
    return node(wrapName, multi, kids, {
      fmt: "x",
      note: active
        ? `1 + (${talVal.toFixed(2)} talent × log(${plunder})) / 100`
        : plunder <= 0
          ? "Inactive — no Plunderous Kills (OLA[139])"
          : "Inactive — Archlord talent contributes 0",
    });
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
