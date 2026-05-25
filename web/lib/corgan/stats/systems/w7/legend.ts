// ===== LEGEND SYSTEM (W7) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { legendPTSbonus } from "./spelunking";
import { legendTalentPerPt } from "../../data/w7/legendTalent";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const legendPTS = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const lv = Number(
      (saveData.spelunkData &&
        saveData.spelunkData[18] &&
        (saveData.spelunkData[18] as any)[id]) ||
        0
    );
    const perPt = legendTalentPerPt(id);
    const val = legendPTSbonus(id, saveData);
    if (val <= 0)
      return node(label("Legend", id), 0, null, { note: "legend " + id });
    return node(
      label("Legend", id),
      val,
      [
        node("Points", lv, null, { fmt: "raw" }),
        node("Per Point", perPt, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "legend " + id }
    );
  },
};
