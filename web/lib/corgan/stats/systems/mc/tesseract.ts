// ===== TESSERACT / ARCANE SYSTEM (MC) =====
// Real port replacing Stage 2 stub.

import { node, type CorganNode } from "../../../node";
import { arcanePerLevel } from "../../data/common/arcane";
import { ARCANE_NO_MULTI } from "../../data/game-constants";
import { maxTalentBonus } from "../common/talent";
import { getLOG } from "../../../formulas";
import type { SaveData } from "../../../state";

const arcaneNoMultiSet = ARCANE_NO_MULTI;

export function arcaneUpgBonus(idx: number, saveData: SaveData): number {
  const lv = Number((saveData.arcaneData as any)?.[idx]) || 0;
  if (lv <= 0) return 0;
  const perLv = arcanePerLevel(idx) || 1;
  if (arcaneNoMultiSet.has(idx)) return lv * perLv;
  return lv * perLv * (1 + arcaneUpgBonus(39, saveData) / 100);
}

function arcaneMapBonus(kills: number, _saveData: SaveData): number {
  if (kills < 1) return 0;
  const lg = getLOG(kills);
  const lg2 = Math.log(Math.max(kills, 1)) / Math.log(2);
  return (
    (2 * Math.max(0, lg - 3.5) + Math.max(0, lg2 - 12)) * (lg / 2.5) +
    Math.min(2, kills / 1000) +
    Math.max(5 * (lg - 5), 0)
  );
}

function arcaneMapMultiBonMax(
  activeCharIdx: number | undefined,
  saveData: SaveData
): number {
  const t589 = maxTalentBonus(589, activeCharIdx, saveData);
  return 100 * (t589 - 1) + Math.min(10, arcaneUpgBonus(58, saveData));
}

type ArcaneCtx = {
  saveData: SaveData;
  charIdx: number;
  mapBon?: any[];
  mapIdx?: number;
};

export function computeArcaneMapMultiBon(idx: number, ctx: ArcaneCtx): number {
  const saveData = ctx.saveData;
  if (!ctx || !ctx.mapBon || ctx.mapIdx == null) return 0;
  const mapData = ctx.mapBon[ctx.mapIdx];
  if (!mapData || mapData.length < 3) return 0;
  const kills = Number(mapData[idx]) || 0;
  const raw = arcaneMapBonus(kills, saveData);
  const cap = arcaneMapMultiBonMax(ctx.charIdx, saveData);
  return Math.min(cap, raw);
}

export const arcaneMap = {
  resolve(_id: number, ctx: ArcaneCtx): CorganNode {
    const saveData = ctx.saveData;
    if (!ctx.mapBon || ctx.mapIdx == null) {
      return node(
        "Arcane Map Bonus",
        0,
        [node("Session-only (no map data)", 0, null, { fmt: "raw" })],
        { note: "arcane map" }
      );
    }
    const kills = (ctx.mapBon[ctx.mapIdx] && (ctx.mapBon[ctx.mapIdx] as any)[0]) || 0;
    const raw = arcaneMapBonus(kills, saveData);
    const cap = arcaneMapMultiBonMax(ctx.charIdx, saveData);
    const val = Math.min(cap, raw);
    return node(
      "Arcane Map Bonus",
      val,
      [
        node("Map Kills", kills, null, { fmt: "raw" }),
        node("Raw Bonus", raw, null, { fmt: "+" }),
        node("Cap", cap, null, { fmt: "raw" }),
        node("Capped Bonus", val, null, { fmt: "+" }),
      ],
      { fmt: "+", note: "arcane map" }
    );
  },
};
