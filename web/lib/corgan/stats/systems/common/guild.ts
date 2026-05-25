// ===== GUILD SYSTEM =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { formulaEval } from "../../../formulas";
import { guildBonusParams } from "../../data/common/guild";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const guild = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const data = guildBonusParams(id);
    if (!data) return node(label("Guild", id), 0, null, { note: "guild " + id });
    const name = label("Guild", id);
    const gd = ctx.saveData.guildData as any[];
    const lv = gd ? Number((gd[0] || {})[id]) || 0 : 0;
    if (lv <= 0) return node(name, 0, null, { note: "guild " + id });
    const val = formulaEval(data.formula, data.x1, data.x2, lv);
    return node(
      name,
      val,
      [
        node("Guild Points", lv, null, { fmt: "raw" }),
        node("Formula Result", val, null, {
          fmt: "raw",
          note: data.formula + "(" + data.x1 + "," + data.x2 + "," + lv + ")",
        }),
      ],
      { fmt: "+", note: "guild " + id }
    );
  },
};
