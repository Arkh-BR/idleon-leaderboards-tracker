// ===== COMPANION DATA =====
// 1:1 port of corgan-source/js/stats/data/common/companions.js.
//
// 2026-08 (Royal Guardian update): companions gained a second stage ("LV2",
// flagged by field [4] of the companion.l entry). On load N.js builds
// DNSM.CompanionBon[id] = CompanionDB[id][11] when CompanionLVz[id] == 1, else
// CompanionDB[id][2] (the loop right after `g.h.CompanionLVz=r` in the bundle;
// _customBlock_Companions just reads that map). Callers that know the save pass
// its `companionLv2Ids` so the stage-2 value is used.
import { CompanionDB } from "../game/customlists.js";

// @njs _customBlock_Companions
export function companionBonus(idx: number, lv2Ids?: Set<number> | null): number {
  const row = (CompanionDB as any)?.[idx];
  if (!row) return 0;
  if (lv2Ids && lv2Ids.has(idx) && row[11] != null && row[11] !== "") {
    return Number(row[11]) || 0;
  }
  return Number(row[2]) || 0;
}
