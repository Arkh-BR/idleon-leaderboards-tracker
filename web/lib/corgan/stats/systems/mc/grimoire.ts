// ===== GRIMOIRE SYSTEM (MC) =====
// Real port replacing Stage 2 stub.
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { grimoireUpgPerLevel } from "../../data/mc/grimoire";
import { GRIMOIRE_NO_MULTI } from "../../data/game-constants";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function grimoireUpgBonus(
  idx: number,
  grimoireGameData: any,
  saveData: SaveData
): number {
  const level = Number((saveData.grimoireData as any)?.[idx]) || 0;
  if (level <= 0) return 0;
  const perLv =
    (grimoireGameData && grimoireGameData[idx] && grimoireGameData[idx][5]) || 0;
  if (GRIMOIRE_NO_MULTI.has(idx)) return level * perLv;
  const multi36 = grimoireUpgBonus(36, grimoireGameData, saveData);
  return level * perLv * (1 + multi36 / 100);
}

export function grimoireUpgBonus22(saveData: SaveData): number {
  const g22 = Number((saveData.grimoireData as any)?.[22]) || 0;
  const g36 = Number((saveData.grimoireData as any)?.[36]) || 0;
  return g22 * (1 + g36 / 100);
}

const GRIMOIRE_DATA: Record<number, { perLevel: number; name: string }> = {
  44: {
    perLevel: grimoireUpgPerLevel(44),
    name: label("Grimoire", 44),
  },
};

export const grimoire = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const data = GRIMOIRE_DATA[id];
    if (!data)
      return node(label("Grimoire", id), 0, null, { note: "grimoire " + id });
    const saveData = ctx.saveData;
    const lv = Number((saveData.grimoireData as any)?.[id]) || 0;
    if (lv <= 0) return node(data.name, 0, null, { note: "grimoire " + id });

    const lv36 = Number((saveData.grimoireData as any)?.[36]) || 0;
    const multi36 = lv36 > 0 ? lv36 * 1 : 0;
    const val = lv * data.perLevel * (1 + multi36 / 100);

    return node(
      data.name,
      val,
      [
        node("Level", lv, null, { fmt: "raw" }),
        node("Per Level", data.perLevel, null, { fmt: "raw" }),
        node(label("Grimoire", 36), 1 + multi36 / 100, null, {
          fmt: "x",
          note: "Level " + lv36,
        }),
      ],
      { fmt: "+", note: "grimoire " + id }
    );
  },
};
