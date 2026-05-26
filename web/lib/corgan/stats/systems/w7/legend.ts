// ===== LEGEND SYSTEM (W7) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { legendPTSbonus } from "./spelunking";
import { legendTalentPerPt } from "../../data/w7/legendTalent";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// Friendly names sourced from legendTalents[i].name in IT website-data.
// Exported so cross-system consumers (talents/owl/cards/etc.) can reuse it.
export const LEGEND_NAMES: Record<number, string> = {
  1: "Greatest Drop Party Ever",
  7: "Spelunky Super Talent",
  21: "Legendary Cardholder",
  25: "Master Chef",
  26: "Furry Friends Forever",
  36: "Wowa Woowa",
};

export function legendLabel(id: number, suffix?: string): string {
  const n = LEGEND_NAMES[id];
  if (n) return `${n} (Legend ${id})${suffix || ""}`;
  return label("Legend", id, suffix);
}

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
