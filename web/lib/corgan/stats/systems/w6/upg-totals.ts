// ===== W6 UPGRADE TOTALS =====
// Counters used by several account-wide talent wraps. Each is a simple
// sum of a save array up to the matching CustomLists upgrade-list length.
// Ported 1:1 from N.js _customBlock_Summoning/Windwalker/ArcaneType
// "...UpgTotal" branches.

import { GrimoireUpg, ArcaneUpg, CompassUpg, AtomInfo } from "../../data/game/customlists.js";
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

/** Total quantity of an item across every char's carried inventory plus
 *  account storage (chests). Mirrors N.js `_ItemsAndStorageOWNED.h[item]`,
 *  which the game builds from the inventory rollup + ChestOrder/ChestQuantity.
 *  We sum InventoryOrder_N/ItemQTY_N (per char) + ChestOrder/ChestQuantity.
 *  `item` is the item rawName (e.g. "Copper", "OakTree", "Soul1"). */
export function invStorageOwned(s: SaveData, item: string): number {
  let total = 0;
  const invOrder = (s as any).inventoryOrderData || [];
  const itemQty = (s as any).itemQtyData || [];
  for (let ci = 0; ci < invOrder.length; ci++) {
    const order = invOrder[ci] || [];
    const qty = itemQty[ci] || [];
    for (let i = 0; i < order.length; i++) {
      if (order[i] === item) total += Number(qty[i]) || 0;
    }
  }
  const chestOrder = (s as any).chestOrderData || [];
  const chestQty = (s as any).chestQuantityData || [];
  for (let i = 0; i < chestOrder.length; i++) {
    if (chestOrder[i] === item) total += Number(chestQty[i]) || 0;
  }
  return total;
}

/** AtomCollider("AtomBonuses", 1, 0) — the "Helium - Talent Power Stacker"
 *  atom bonus. N.js: for b=1 (none of the b==0/5/8 special branches apply)
 *  the value is simply Atoms[1] × AtomInfo[1][4] (atom level × per-level
 *  coefficient). AtomInfo[1][4] == "1", so this is effectively the Atom 1
 *  level — the "+N extra powers of 10" that several inventory-log talents
 *  (101/131/295/311/461/476) add to their log10(count) term. */
export function atomBonus1(s: SaveData): number {
  const lvl = Number(((s as any).atomsData || [])[1]) || 0;
  const coef = Number((AtomInfo as any[])?.[1]?.[4]) || 0;
  return lvl * coef;
}

/** AtomCollider("TotalTitanKills") — count of Compass[1][l] === 1 (titans
 *  killed). N.js: _customBlock_ArcaneType / Windwalker("TotalTitanKills")
 *  loops Compass[1] and counts entries equal to 1. Used as the exponent of
 *  Tal 434 (Slayer Abominator). */
export function totalTitanKills(s: SaveData): number {
  const row = ((s as any).compassData || [])[1] || [];
  let count = 0;
  for (let l = 0; l < row.length; l++) if (Number(row[l]) === 1) count++;
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
