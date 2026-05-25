// ===== STATS SYSTEM (W stage-4 stub for lukScaling) =====
//
// Corgan's stats.js is 1380+ lines computing the full TotalStat chain
// (equip base + gallery + obols + alchemy bubbles + stamps + AllStatPCT
// from 16 sub-sources + star signs + etc.). Porting that completely is
// Stage 5 work — for the DR descriptor we only need the luk multiplier
// `1.4 × lukCurve(LUK)`.
//
// Pragmatic port: read raw LUK from PersonalValuesMap (already populated
// in stats.ts state via PVStatList_N → save loader doesn't currently
// extract that — we read directly from the save via `lv0AllData` instead,
// where indexes 4-7 hold STR/AGI/WIS/LUK with talent + card bonuses
// already baked in). This matches what the IT-port reads and bate exact
// with IT's /characters page. Stage 5 will swap in the full chain when
// `computeTotalStat` ports.

import { node, type CorganNode } from "../../../node";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export function lukCurve(luk: number): number {
  if (!Number.isFinite(luk) || luk < 0) return 0;
  if (luk < 1e3) {
    return (Math.pow(luk + 1, 0.37) - 1) / 40;
  }
  return ((luk - 1e3) / (luk + 2500)) * 0.5 + 0.297;
}

function readRawLuk(saveData: SaveData, charIdx: number): number {
  // Corgan reads computeTotalStat('LUK', ci, ctx) — we approximate with
  // raw level from data.PVStatList_N (already loaded via raw data, but
  // not yet pushed into state by Stage 1 loader). Read directly from
  // saveData['data']?.[`PVStatList_${ci}`] if present, else fall back
  // to lv0AllData. PersonalValuesMap.StatList[3] in IT == LUK.
  const raw: any = (saveData as any).rawDataPVStatList;
  if (Array.isArray(raw) && Array.isArray(raw[charIdx])) {
    return Number(raw[charIdx][3]) || 0;
  }
  // Fallback: lv0AllData[charIdx][7] is the per-char LUK in the save tab order.
  const lv0 = (saveData.lv0AllData as any)?.[charIdx];
  if (Array.isArray(lv0) && lv0.length > 7) return Number(lv0[7]) || 0;
  return 0;
}

export const lukScaling = {
  resolve(_id: unknown, ctx: Ctx): CorganNode {
    const charIdx = ctx.charIdx;
    const totalLUK = readRawLuk(ctx.saveData, charIdx);
    const drLUK = lukCurve(totalLUK);
    return node("LUK Scaling", drLUK, [
      node("Total LUK", totalLUK, null, { fmt: "raw" }),
      node(
        totalLUK < 1000 ? "Sub-1000 curve" : "Over-1000 curve",
        drLUK,
        null,
        {
          fmt: "raw",
          note:
            totalLUK < 1000
              ? "(pow(" + totalLUK + "+1, 0.37)-1)/40"
              : "(" + totalLUK + "-1000)/(" + totalLUK + "+2500)*0.5+0.297",
        }
      ),
    ], { fmt: "raw" });
  },
};
