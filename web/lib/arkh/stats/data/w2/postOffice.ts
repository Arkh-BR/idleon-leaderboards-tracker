// ===== POST OFFICE DATA =====
import { PostOffUpgradeInfo } from "../game/customlists.js";

export type PostOfficeSlotParams = {
  x1: number;
  x2: number;
  formula: string;
  name: string;
};

export function postOfficeSlotParams(boxIdx: number, slot: number): PostOfficeSlotParams | null {
  const box = (PostOffUpgradeInfo as any)[boxIdx];
  if (!box) return null;
  const offset = 1 + slot * 4;
  return {
    x1: Number(box[offset]) || 0,
    x2: Number(box[offset + 1]) || 0,
    formula: box[offset + 2],
    name: String(box[0]).replace(/_/g, " "),
  };
}
