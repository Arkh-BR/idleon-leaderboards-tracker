// ===== ACHIEVEMENT SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/achievement.js.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function achieveStatus(idx: number, saveData: SaveData): number {
  if (!saveData || !saveData.achieveRegData) return 0;
  return saveData.achieveRegData[idx] === -1 ? 1 : 0;
}

export type SystemCtx = { saveData: SaveData; charIdx: number; mapIdx?: number };

export const achievement = {
  resolve(id: number, ctx: SystemCtx, args?: number[]): CorganNode {
    const bonus = args ? args[0] : 0;
    const reg = ctx.saveData.achieveRegData;
    const completed = reg ? reg[id] === -1 : false;
    if (!completed) {
      return node(
        label("Achievement", id),
        0,
        [node("Not completed", 0, null, { fmt: "raw" })],
        { note: "achievement " + id }
      );
    }
    return node(
      label("Achievement", id),
      bonus,
      [
        node("Completed", 1, null, { fmt: "raw" }),
        node("Bonus", bonus, null, { fmt: "+" }),
      ],
      { fmt: "+", note: "achievement " + id }
    );
  },
};
