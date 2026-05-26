// ===== BUTTON SYSTEM (W7) =====
// 1:1 port of computeButtonBonus from corgan-source/js/stats/defs/helpers.js.
// The Button is the W7 Mantaray-map minigame: each press adds bonuses to one of
// 9 rotating slots. Bonus per slot = hits × BUTTON_RATES[slot] × bonusMulti
// where bonusMulti = (1 + comp147/100) × (1 + grid125/100).
//
// Slot mapping from website-data ButtonBonusNames:
//   0 = Res XP, 1 = Minehead, 2 = Sushi, 3 = Arti Odds, 4 = Xtra,
//   5 = Spelunk, 6 = Cooking SPD, 7 = Crop Evo, 8 = Class XP.

import { node, type CorganNode } from "../../../node";
import { optionsListData } from "../../../save/data";
import { companionBonus } from "../../data/common/companions";
import { gridBonusValue } from "../w4/lab";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const BUTTON_RATES = [2, 3, 2, 2, 4, 5, 4, 25, 5];

const BUTTON_NAMES = [
  "Res XP",
  "Minehead",
  "Sushi",
  "Arti Odds",
  "Xtra",
  "Spelunk",
  "Cooking SPD",
  "Crop Evo",
  "Class XP",
];

// Computes the bonus contribution for a single button slot (matches Corgan source
// computeButtonBonus). Returns the raw % (e.g. 100 means +100%).
export function computeButtonBonus(slotIdx: number, saveData: SaveData): number {
  const presses = Number((optionsListData as any)?.[594]) || 0;
  if (presses <= 0) return 0;
  const fullCycles = Math.floor(presses / 45);
  const rem = presses % 45;
  const hits = fullCycles * 5 + Math.max(0, Math.min(5, rem - 5 * slotIdx));
  const comp147 =
    saveData.companionIds && saveData.companionIds.has(147)
      ? companionBonus(147)
      : 0;
  const grid125 = gridBonusValue(125, saveData);
  const multi = (1 + comp147 / 100) * (1 + grid125 / 100);
  return hits * (BUTTON_RATES[slotIdx] || 0) * multi;
}

export const button = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const slot = Number(id) || 0;
    const presses = Number((optionsListData as any)?.[594]) || 0;
    const val = computeButtonBonus(slot, ctx.saveData);
    const name = "Button: " + (BUTTON_NAMES[slot] || ("Slot " + slot));
    const fullCycles = Math.floor(presses / 45);
    const rem = presses % 45;
    const hits = fullCycles * 5 + Math.max(0, Math.min(5, rem - 5 * slot));
    const comp147 =
      ctx.saveData.companionIds && ctx.saveData.companionIds.has(147)
        ? companionBonus(147)
        : 0;
    const grid125 = gridBonusValue(125, ctx.saveData);
    const multi = (1 + comp147 / 100) * (1 + grid125 / 100);
    return node(
      name,
      val,
      [
        node("Total Presses", presses, null, { fmt: "raw" }),
        node("Slot Hits", hits, null, {
          fmt: "raw",
          note: "cycles=" + fullCycles + " rem=" + rem,
        }),
        node("Per Hit", BUTTON_RATES[slot] || 0, null, { fmt: "raw" }),
        node(
          "Bonus Multi",
          multi,
          [
            node("Companion 147 (w7b7) +", comp147, null, { fmt: "+" }),
            node("Grid 125 (Better Button) +", grid125, null, { fmt: "+" }),
          ],
          { fmt: "x" }
        ),
      ],
      { fmt: "+", note: "button slot " + slot }
    );
  },
};
