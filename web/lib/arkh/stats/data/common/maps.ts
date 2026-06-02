// ===== MAP / COMBAT DATA =====
// 1:1 port of corgan-source/js/stats/data/common/maps.js.

import { MapDetails, MapAFKtarget } from "../game/customlists.js";

const _mapDetails = MapDetails as any[];
const _mapAfk = MapAFKtarget as any[];

export function mapKillReq(idx: number): number {
  return Number(_mapDetails?.[idx]?.[0]?.[0]) || 0;
}

export function isFightingMap(mapIdx: number): boolean {
  const mob = _mapAfk[mapIdx];
  return !!mob && mob !== "Nothing" && mob !== "Z";
}
