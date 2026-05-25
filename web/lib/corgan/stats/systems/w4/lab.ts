// ===== LAB STUB (Stage 4 will port the real impl) =====
// Stub for the symbols that Stage 2 systems consume. Returns safe no-op
// defaults so the dependent systems compile and run.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function mainframeBonus(_idx: number, _saveData: SaveData): number {
  return 0;
}

export function charHasChip(_charIdx: number, _slot: string): boolean {
  return false;
}

export const grid = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Grid", id), 0, null, { fmt: "+", note: "stage4 stub" });
  },
};

export const chip = {
  resolve(id: number | string, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Chip", id), 0, null, { fmt: "+", note: "stage4 stub" });
  },
};

export function computeLabConnectivity(_saveData: SaveData): Record<string, unknown> {
  // Stage 4 will compute lab BFS for mainframe bonuses. Stage 2 returns
  // empty so the loader can assignState() without error.
  return { labBonusConnected: [], labJewelConnected: [], labMainBonusFull: [] };
}
