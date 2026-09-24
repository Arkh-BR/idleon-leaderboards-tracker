// ===== PRAYER SYSTEM (W3) =====
import { node, treeResult, type ArkhNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { prayersPerCharData } from "../../../save/data";
import { prayerBaseBonus } from "../../data/w3/prayer";
import { superBitType } from "../../../game-helpers";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

const PRAYER_DATA: Record<number, { baseBonus: number }> = {
  7: { baseBonus: prayerBaseBonus(7) },
};

export const prayer = {
  resolve(id: number, ctx: Ctx): ArkhNode {
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
      { fmt: "+" }
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

/** N.js prayersReal(idx, cost) (@7774914) with both branches. With no prayer
 *  equipped (every Prayers_ci slot is −1) and Super Bit 9 or 39 owned, each
 *  unlocked prayer — not 5, not a curse — gives
 *  round((0.2·SB9 + 0.2·SB39 + 0.2·SB53)·PrayerInfo[idx][3]·max(1, 1 + (lv−1)/10)).
 *  Otherwise it's the equipped branch of computePrayerReal, which DR/Coin keep. */
// @njs _customBlock_prayersReal
export function prayersReal(idx: number, cost: number, ci: number, saveData: SaveData): TreeResult {
  const slots = (prayersPerCharData as any)[ci];
  const noneEquipped = Array.isArray(slots) && slots.length > 0 && slots.every((p: unknown) => Number(p) === -1);
  const g12 = (saveData.gamingData as any)?.[12];
  const sb9 = superBitType(9, g12);
  const sb39 = superBitType(39, g12);
  if ((sb9 !== 1 && sb39 !== 1) || !noneEquipped) return computePrayerReal(idx, cost, ci, saveData);
  const lv = Number((saveData.prayOwnedData as any)?.[idx]) || 0;
  if (idx === 5 || cost === 1 || !(lv > 0.5)) return treeResult(0);
  const bits = 0.2 * sb9 + (0.2 * sb39 + 0.2 * superBitType(53, g12));
  const base = prayerBaseBonus(idx);
  const scale = Math.max(1, 1 + (lv - 1) / 10);
  return treeResult(Math.round(bits * base * scale), [
    node("Super Bits 9/39/53 (no prayer equipped)", bits, null, { fmt: "x" }),
    node("Base Bonus", base, null, { fmt: "raw" }),
    node("Prayer Lv", lv, null, { fmt: "raw" }),
    node("Level Scale", scale, null, { fmt: "x" }),
  ]);
}
