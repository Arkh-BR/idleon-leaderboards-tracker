// ===== EQUIPMENT / ITEM DATA =====
// 1:1 port of corgan-source/js/stats/data/common/equipment.js (replaces
// the Stage 2 stub).
import { ITEMS } from "../game/items.js";
import { IDforETCbonus, EquipmentSets } from "../game/custommaps.js";

const _items = ITEMS as Record<string, any>;
const _idForEtc = IDforETCbonus as Record<string, string>;
const _equipSets = EquipmentSets as Record<string, any>;

export function etcStatName(id: number | string): string[] | null {
  return _idForEtc[String(id)] ? [_idForEtc[String(id)]] : null;
}

export const ETC_STAT_NAMES: Record<string, string[]> = {};
for (const _id in _idForEtc) {
  if (_idForEtc[_id]) ETC_STAT_NAMES[_id] = [_idForEtc[_id]];
}

export const ITEMS_BY_UQ: Record<string, Record<string, { uq: number; val: number }>> = {};
for (const _iname in _items) {
  const _item = _items[_iname];
  if (_item.UQ1txt && _item.UQ1txt !== "Blank" && _item.UQ1txt !== "0") {
    if (!ITEMS_BY_UQ[_item.UQ1txt]) ITEMS_BY_UQ[_item.UQ1txt] = {};
    ITEMS_BY_UQ[_item.UQ1txt][_iname] = { uq: 1, val: Number(_item.UQ1val) };
  }
  if (_item.UQ2txt && _item.UQ2txt !== "Blank" && _item.UQ2txt !== "0") {
    if (!ITEMS_BY_UQ[_item.UQ2txt]) ITEMS_BY_UQ[_item.UQ2txt] = {};
    ITEMS_BY_UQ[_item.UQ2txt][_iname] = { uq: 2, val: Number(_item.UQ2val) };
  }
}

export type ItemUqMatch = { stat: string; val: number; uq: number } | null;

export function itemUqMatch(itemName: string, statNames: string[]): ItemUqMatch {
  const item = _items[itemName];
  if (!item) return null;
  for (let i = 0; i < statNames.length; i++) {
    if (item.UQ1txt === statNames[i])
      return { stat: item.UQ1txt, val: Number(item.UQ1val), uq: 1 };
    if (item.UQ2txt === statNames[i])
      return { stat: item.UQ2txt, val: Number(item.UQ2val), uq: 2 };
  }
  return null;
}

export function itemsWithUq(statName: string): Record<string, { uq: number; val: number }> {
  return ITEMS_BY_UQ[statName] || {};
}

export function equipSetBonus(setName: string): number {
  const set = _equipSets[setName];
  return set ? Number(set[3]?.[2]) || 0 : 0;
}

export const GODSHARD_SET_BONUS = equipSetBonus("GODSHARD_SET");
export const SET_BONUS_VALUES: Record<string, number> = {
  GOLD_SET: equipSetBonus("GOLD_SET"),
  SECRET_SET: equipSetBonus("SECRET_SET"),
  EMPEROR_SET: equipSetBonus("EMPEROR_SET"),
  LUSTRE_SET: equipSetBonus("LUSTRE_SET"),
  TROLL_SET: equipSetBonus("TROLL_SET"),
};
