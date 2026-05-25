// ===== PRAYER SYSTEM (W3) =====
import { node, treeResult, type CorganNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { prayersPerCharData } from "../../../save/data";
import { prayerBaseBonus } from "../../data/w3/prayer";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

const PRAYER_DATA: Record<number, { baseBonus: number }> = {
  7: { baseBonus: prayerBaseBonus(7) },
};

export const prayer = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const data = PRAYER_DATA[id];
    if (!data) return node(label("Prayer", id), 0, null, { note: "prayer " + id });
    const name = label("Prayer", id);
    const prayerLv = Number((ctx.saveData.prayOwnedData as any)?.[id]) || 0;
    const equipped = ((prayersPerCharData as any)[ctx.charIdx] || []) as any[];
    const isEquipped = equipped.includes(id);
    if (prayerLv <= 0 || !isEquipped) {
      return node(
        name,
        0,
        [
          node("Prayer Level", prayerLv, null, { fmt: "raw" }),
          node(isEquipped ? "Equipped" : "NOT Equipped", 0, null, { fmt: "raw" }),
        ],
        { note: "prayer " + id }
      );
    }
    const scaling = Math.max(1, 1 + (prayerLv - 1) / 10);
    const val = Math.round(data.baseBonus * scaling);
    return node(
      name,
      val,
      [
        node("Prayer Level", prayerLv, null, { fmt: "raw" }),
        node("Equipped", 1, null, { fmt: "raw" }),
        node("Base Bonus", data.baseBonus, null, { fmt: "raw" }),
        node("Level Scaling", scaling, null, { fmt: "x" }),
      ],
      { fmt: "+", note: "prayer " + id }
    );
  },
};

export function computePrayerReal(
  prayerIdx: number,
  costIdx: number,
  ci: number,
  saveData: SaveData
): TreeResult {
  const prayerLv = Number((saveData.prayOwnedData as any)?.[prayerIdx]) || 0;
  if (prayerLv <= 0) return treeResult(0);
  let equipped = false;
  try {
    equipped = ((prayersPerCharData as any)[ci] || []).includes(prayerIdx);
  } catch {}
  if (!equipped) return treeResult(0);
  let base = 0;
  try {
    base = prayerBaseBonus(prayerIdx, costIdx) || 0;
  } catch {}
  const scale = Math.max(1, 1 + (prayerLv - 1) / 10);
  const val = Math.round(base * scale);
  return treeResult(val, [
    node("Base Bonus", base, null, { fmt: "raw" }),
    node("Prayer Lv", prayerLv, null, { fmt: "raw" }),
    node("Level Scale", scale, null, { fmt: "x" }),
  ]);
}
