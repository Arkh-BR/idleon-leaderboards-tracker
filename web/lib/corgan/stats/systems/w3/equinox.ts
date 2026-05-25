// ===== EQUINOX SYSTEM (W3) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { dreamData } from "../../../save/data";
import { DR_DREAM_COEFF } from "../../data/game-constants";
import { cloudBonus as _cb } from "../../../game-helpers";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const dream = {
  resolve(id: number, _ctx: Ctx, args?: number[]): CorganNode {
    const name = label("Dream", id);
    const lv = Number((dreamData as any)?.[id]) || 0;
    const coeff = args && args[0] != null ? args[0] : DR_DREAM_COEFF;
    const val = coeff * lv;
    return node(
      name,
      val,
      [
        node("Dream Upgrade Level", lv, null, { fmt: "raw" }),
        node("Per Level", coeff, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "dream " + id }
    );
  },
};

export const cloudBonusSys = {
  resolve(id: number, ctx: Ctx, args?: number[]): CorganNode {
    const coeff = (args && args[0]) || 5;
    const completed = _cb(id, ctx.saveData.weeklyBossData);
    const val = coeff * completed;
    return node(
      "Dream Challenge " + id,
      val,
      [
        node("Completed", completed, null, { fmt: "raw" }),
        node("Coefficient", coeff, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "cloudBonus " + id }
    );
  },
};

export function computeAllShimmerBonuses(saveData: SaveData): number {
  const artTier31 =
    Number(saveData.sailingData && saveData.sailingData[3] && (saveData.sailingData[3] as any)[31]) || 0;
  const shimmerMulti = artTier31 > 0 ? Math.max(1, Math.min(4, 1 + artTier31)) : 1;
  return shimmerMulti;
}
