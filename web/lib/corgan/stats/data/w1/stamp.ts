// ===== STAMP DATA (W1) =====
// 1:1 port of corgan-source/js/stats/data/w1/stamp.js. Builds STAMP_DATA
// from ITEMS.StampXN entries (e.g. StampA1 = "+{%_Drop_Rate,decay,3,80").
import { ITEMS } from "../game/items.js";

const CAT_MAP: Record<string, number> = { A: 0, B: 1, C: 2 };

export type StampData = {
  cat: number;
  idx: number;
  x1: number;
  x2: number;
  formula: string;
};

export const STAMP_DATA: Record<string, StampData> = {};

const _items = ITEMS as Record<string, any>;
const keys = Object.keys(_items);
for (let i = 0; i < keys.length; i++) {
  const k = keys[i];
  if (k.indexOf("Stamp") !== 0 || k.length < 7) continue;
  const letter = k[5];
  const cat = CAT_MAP[letter];
  if (cat == null) continue;
  const num = k.slice(6);
  const item = _items[k];
  if (!item || !item.desc_line1) continue;
  const parts = String(item.desc_line1).split(",");
  STAMP_DATA[letter + num] = {
    cat,
    idx: item.ID - cat * 1000,
    x1: Number(parts[2]),
    x2: Number(parts[3]),
    formula: parts[1],
  };
}
