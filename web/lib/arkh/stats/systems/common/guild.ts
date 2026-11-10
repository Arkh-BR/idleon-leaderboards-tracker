// ===== GUILD SYSTEM =====
import { node, type ArkhNode } from "../../../node";
import { gameLabel } from "../../entity-names";
import { formulaEval } from "../../../formulas";
import { guildBonusParams } from "../../data/common/guild";
import { GuildBonuses } from "@/lib/game/data/generated/customlists.js";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// Name = the game's GuildBonuses[id][0] ("Gold_Charm" → "Gold Charm").
function guildLabel(id: number): string {
  return gameLabel("Guild", id, (GuildBonuses as any)[id]?.[0]);
}

export const guild = {
  resolve(id: number, ctx: Ctx): ArkhNode {
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
