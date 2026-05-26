// ===== GUILD SYSTEM =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { formulaEval } from "../../../formulas";
import { guildBonusParams } from "../../data/common/guild";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// Friendly guild-bonus names sourced from guildBonuses[i].name in IT
// website-data. The DR descriptor references id 10 (Gold Charm).
const GUILD_NAMES: Record<number, string> = {
  10: "Gold Charm",
};
function guildLabel(id: number): string {
  const n = GUILD_NAMES[id];
  return n ? `${n} (Guild ${id})` : label("Guild", id);
}

export const guild = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const data = guildBonusParams(id);
    if (!data) return node(guildLabel(id), 0, null, { note: "guild " + id });
    const name = guildLabel(id);
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
