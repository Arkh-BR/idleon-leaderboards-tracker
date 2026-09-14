// ===== ARCADE SYSTEM (W2) =====
import { node, treeResult, type ArkhNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { arcadeShopParams } from "../../data/w2/arcade";
import { companionChild } from "../common/companions";
import { companionBonus } from "../../data/common/companions";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// N.js _customBlock_ArcadeBonus: `1 == Companions(27) && ArcadBonDNz *= 2`.
// It compares the CompanionBon value with exactly 1, so the ×2 only applies
// while Reindeer is at stage 1; at stage 2 (CompanionDB[27][11] = 1.5) the
// game silently drops it despite the "2.50x" LV2 text. Mirrored on purpose:
// the engine tracks the live game, not the intended value.
export function comp27Multi(saveData: SaveData): number {
  const owned = !!(saveData.companionIds && saveData.companionIds.has(27));
  return owned && companionBonus(27, saveData.companionLv2Ids) === 1 ? 2 : 1;
}

export function arcadeBonus(idx: number, saveData: SaveData): TreeResult {
  const params = arcadeShopParams(idx);
  if (!params) return treeResult(0);
  const lv = Number((saveData.arcadeUpgData as any)?.[idx]) || 0;
  if (lv <= 0) return treeResult(0);
  const [type, base, denom] = params;
  const raw =
    type === "add"
      ? denom !== 0
        ? ((base + denom) / denom + 0.5 * (lv - 1)) / (base / denom) * lv * base
        : base * lv
      : (base * lv) / (lv + denom);
  const maxedM = lv === 101 ? 2 : 1;
  const comp27M = comp27Multi(saveData);
  const val = maxedM * comp27M * raw;
  return treeResult(val, [
    node("Raw (lv=" + lv + ")", raw, null, { fmt: "raw" }),
    node("Maxed Multi (101)", maxedM, null, { fmt: "x" }),
    node("Companion 27 Multi", comp27M, null, { fmt: "x" }),
  ]);
}

export const arcade = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const saveData = ctx.saveData;
    const params = arcadeShopParams(id);
    if (!params)
      return node(label("Arcade", id), 0, null, { note: "arcade " + id });
    const lv = Number((saveData.arcadeUpgData as any)?.[id]) || 0;
    if (lv <= 0) return node(label("Arcade", id), 0, null, { note: "arcade " + id });
    const tr = arcadeBonus(id, saveData);
    const val = tr.val;
    const maxedM = lv === 101 ? 2 : 1;
    const comp27M = comp27Multi(saveData);
    return node(
      label("Arcade", id),
      val,
      [
        node("Level", lv, null, { fmt: "raw" }),
        node("Raw Value", val / maxedM / comp27M, null, { fmt: "raw" }),
        node("Maxed Bonus", maxedM, null, {
          fmt: "x",
          note: lv === 101 ? "Level 101" : "Not maxed",
        }),
        companionChild(27, comp27M, saveData, {
          fmt: "x",
          note: saveData.companionLv2Ids?.has(27)
            ? "stage 2: game applies no ×2 (checks value == 1)"
            : "companion 27",
        }),
      ],
      { fmt: "+", note: "arcade " + id }
    );
  },
};
