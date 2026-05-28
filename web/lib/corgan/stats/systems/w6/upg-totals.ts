// ===== W6 UPGRADE TOTALS =====
// Counters used by several account-wide talent wraps. Each is a simple
// sum of a save array up to the matching CustomLists upgrade-list length.
// Ported 1:1 from N.js _customBlock_Summoning/Windwalker/ArcaneType
// "...UpgTotal" branches.

import { GrimoireUpg, ArcaneUpg, CompassUpg } from "../../data/game/customlists.js";
import { optionsListData } from "../../../save/data";
import type { SaveData } from "../../../state";

/** Σ Grimoire[0 .. GrimoireUpg.length] — total grimoire upgrade levels.
 *  N.js: _customBlock_Summoning("GrimoireUpgTotal"). */
export function grimoireUpgTotal(s: SaveData): number {
  const arr = (s as any).grimoireData || [];
  const n = (GrimoireUpg as any[]).length;
  let t = 0;
  for (let i = 0; i < n; i++) t += Number(arr[i]) || 0;
  return t;
}

/** Σ Arcane[0 .. ArcaneUpg.length] — total arcane upgrade levels.
 *  N.js: _customBlock_ArcaneType("ArcaneUpgTotal"). */
export function arcaneUpgTotal(s: SaveData): number {
  const arr = (s as any).arcaneData || [];
  const n = (ArcaneUpg as any[]).length;
  let t = 0;
  for (let i = 0; i < n; i++) t += Number(arr[i]) || 0;
  return t;
}

/** Σ Compass[0][0 .. CompassUpg.length] — total compass upgrade levels.
 *  N.js: _customBlock_Windwalker("CompassUpgTotal") sums Compass[0][i]
 *  (the Compass save key is nested: [0] is the upgrade-levels array). */
export function compassUpgTotal(s: SaveData): number {
  const arr = ((s as any).compassData || [])[0] || [];
  const n = (CompassUpg as any[]).length;
  let t = 0;
  for (let i = 0; i < n; i++) t += Number(arr[i]) || 0;
  return t;
}

/** Count of unique Onyx statues owned (StatueG[e] >= 2), gated by
 *  OLA[69] >= 2 (Onyx tier unlocked). N.js: ArbitraryCode("StatueOnyxOwned"). */
export function statueOnyxOwned(s: SaveData): number {
  if ((Number((optionsListData as any)[69]) || 0) < 2) return 0;
  const sg = (s as any).statueGData || [];
  let count = 0;
  for (let e = 0; e < sg.length; e++) if (Number(sg[e]) >= 2) count++;
  return count;
}

/** Count of unlocked breeds (>0.5) across the 4 World-6 breeding worlds.
 *  N.js: _customBlock_Windwalker("TotBreedzWWz") — loops b=0..3 over
 *  Breeding[13+b] and counts entries > 0.5. */
export function totBreedzWWz(s: SaveData): number {
  const br = (s as any).breedingData || [];
  let count = 0;
  for (let b = 0; b < 4; b++) {
    const row = br[13 + b] || [];
    for (let e = 0; e < row.length; e++) {
      if (Number(row[e]) > 0.5) count++;
    }
  }
  return count;
}
