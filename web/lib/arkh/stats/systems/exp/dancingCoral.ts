// ===== DANCING CORAL (W7 Coral Reef) =====
// @njs DancingCoralBonus — N.js Thingies("DancingCoralBonus",b,0) (@10884098):
//   Spelunky[24][b] · max(0, TowerInfo[round(18+b)] − 200)
// (the b,999 call is the per-level base Spelunky[24][b]). TowerInfo is the
// save's "Tower" list (N.js load: getLoadJsonList("Tower") → TowerInfo,
// @19714164; loader towerData).
import { Spelunky } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

export function dancingCoralTower(idx: number, s: SaveData): number {
  return Number((s.towerData as any)?.[Math.round(18 + idx)]) || 0;
}

export function dancingCoralBonus(idx: number, s: SaveData): number {
  const base = Number((Spelunky as any)[24]?.[idx]) || 0;
  return base * Math.max(0, dancingCoralTower(idx, s) - 200);
}
