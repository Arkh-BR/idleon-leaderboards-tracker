// ===== FLURBO SHOP =====
// A leaf module: derived-damage reads it for the Weapon Power and must not go
// through coin.ts (coin → overkill → damage → derived-damage). coin.ts
// re-exports it for Coin, EXP and AFK.
import { node, type ArkhNode } from "../../../node";
import { formulaEval } from "../../../formulas";
import { DungPassiveStats2 } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

/** N.js FlurboShop(idx) (@7827791): DungPassiveStats2[idx] at level
 *  DungUpg[5][idx]. Coin's flurbo4, EXP's flurbo2, AFK's flurbo7 and the
 *  Weapon Power's flurbo 0. */
// @njs _customBlock_FlurboShop
export function flurboShop(idx: number, s: SaveData): { val: number; children: ArkhNode[] } {
  const row = ((DungPassiveStats2 as any[])[idx] ?? []) as unknown[];
  const lv = Number((s.dungUpgData as any[])?.[5]?.[idx]) || 0;
  return {
    val: formulaEval(String(row[3]), Number(row[1]), Number(row[2]), lv),
    children: [node("Level", lv, null, { fmt: "raw" })],
  };
}
