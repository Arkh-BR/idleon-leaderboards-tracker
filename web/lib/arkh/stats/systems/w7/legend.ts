// ===== LEGEND SYSTEM (W7) =====
import { node, type ArkhNode } from "../../../node";
import { gameLabel } from "../../entity-names";
import { legendPTSbonus } from "./spelunking";
import { legendTalentPerPt } from "../../data/w7/legendTalent";
import { LegendTalents } from "@/lib/game/data/generated/customlists.js";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// Name = the game's LegendTalents[id][0] ("Wowa_Woowa").
export function legendLabel(id: number, suffix?: string): string {
  return gameLabel("Legend", id, (LegendTalents as any)[id]?.[0], suffix);
}

export const legendPTS = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const saveData = ctx.saveData;
    const lv = Number(
      (saveData.spelunkData &&
        saveData.spelunkData[18] &&
        (saveData.spelunkData[18] as any)[id]) ||
        0
    );
    const perPt = legendTalentPerPt(id);
    const val = legendPTSbonus(id, saveData);
    const name = legendLabel(id);
    if (val <= 0) return node(name, 0, null, { note: "legend " + id });
    return node(
      name,
      val,
      [
        node("Points", lv, null, { fmt: "raw" }),
        node("Per Point", perPt, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "legend " + id }
    );
  },
};
