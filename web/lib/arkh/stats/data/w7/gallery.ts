// ===== GALLERY DATA (W7) =====
// 1:1 port of corgan-source/js/stats/data/w7/gallery.js.
// Builds NAMETAG_UQ / TROPHY_UQ / HAT_UQ indexes at module load by scanning ITEMS.

import { ITEMS } from "../game/items.js";
import { IDforETCbonus } from "../game/custommaps.js";

type UqEntry = { stat: string; val: number };

const _items = ITEMS as Record<string, any>;
const _idForEtc = IDforETCbonus as Record<string, string>;

function uqEntries(item: any): UqEntry[] | null {
  const out: UqEntry[] = [];
  if (item.UQ1txt) out.push({ stat: item.UQ1txt, val: Number(item.UQ1val) });
  if (item.UQ2txt) out.push({ stat: item.UQ2txt, val: Number(item.UQ2val) });
  return out.length ? out : null;
}

function cleanName(s: string): string {
  return s ? s.replace(/\|/g, " ").replace(/_/g, " ") : "";
}

export const NAMETAG_UQ: Record<number, UqEntry[]> = {};
export const NAMETAG_NAMES: Record<number, string> = {};
for (const name in _items) {
  const item = _items[name];
  if (item.Type !== "NAMETAG") continue;
  const uqs = uqEntries(item);
  if (uqs) {
    NAMETAG_UQ[Number(item.ID)] = uqs;
    NAMETAG_NAMES[Number(item.ID)] = cleanName(item.displayName);
  }
}

export const TROPHY_UQ: Record<number, UqEntry[]> = {};
export const TROPHY_NAMES: Record<number, string> = {};
for (const name in _items) {
  if (!name.startsWith("Trophy")) continue;
  const id = Number(name.replace("Trophy", ""));
  if (isNaN(id)) continue;
  const item = _items[name];
  const uqs = uqEntries(item);
  if (uqs) {
    TROPHY_UQ[id] = uqs;
    TROPHY_NAMES[id] = cleanName(item.displayName);
  }
}

export const HAT_UQ: Record<string, UqEntry[]> = {};
export const HAT_NAMES: Record<string, string> = {};
for (const name in _items) {
  if (!name.startsWith("EquipmentHats")) continue;
  const item = _items[name];
  const uqs = uqEntries(item);
  if (uqs) {
    HAT_UQ[name] = uqs;
    HAT_NAMES[name] = cleanName(item.displayName);
  }
}

export const GALLERY_STAT_FOR_ID: Record<string, string> = {};
for (const gid in _idForEtc) {
  if (_idForEtc[gid]) GALLERY_STAT_FOR_ID[gid] = _idForEtc[gid];
}

export const NAMETAG_DR = NAMETAG_UQ;
export const TROPHY_DR = TROPHY_UQ;
export const PREMHAT_DR = HAT_UQ;
export const PREMHAT_NAMES = HAT_NAMES;
