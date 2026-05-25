// ===== ETC BONUS SYSTEM =====
// Sums equipment UQ stat bonuses for a specific bonus ID across gear slots.
// Reuses the equipment system (Stage 3 port).
import { equipment } from "./equipment";
import type { CorganNode } from "../../../node";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export const etcBonus = {
  resolve(id: number, ctx: Ctx): CorganNode {
    return equipment.resolve(id, ctx);
  },
};
