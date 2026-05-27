// ===== SET BONUS SYSTEM (W3) =====
// 1:1 port replacing the Stage 2 stub.

import { node, treeResult, type CorganNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData, equipOrderData } from "../../../save/data";
import { equipSetBonus, SET_BONUS_VALUES } from "../../data/common/equipment";
import { EquipmentSets } from "../../data/game/custommaps.js";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export function getSetBonus(setName: string): TreeResult {
  const perma = String((optionsListData as any)?.[379] ?? "");
  if (!perma.includes(setName)) return treeResult(0);
  const val = SET_BONUS_VALUES[setName] || 0;
  return treeResult(val, [
    node(setName + " Unlocked", 1, null, { fmt: "raw" }),
    node("Bonus Value", val, null, { fmt: "raw" }),
  ]);
}

const SET_DATA: Record<string, { key: string; bonus: number }> = {
  efaunt: { key: "EFAUNT_SET", bonus: equipSetBonus("EFAUNT_SET") },
};

function checkSetEquipped(setName: string, charIdx: number): boolean {
  const setDef = (EquipmentSets as any)[setName];
  if (!setDef) return false;
  const armorPieces = (setDef[0] || []) as string[];
  const toolsCap = Number(setDef[3]?.[0]) || 0;
  const specialCap = Number(setDef[3]?.[1]) || 0;
  const partsReq = armorPieces.length + toolsCap + specialCap;
  let partsOn = 0;
  const eq = (equipOrderData as any)[charIdx];
  if (!eq) return false;
  const row0 = (eq[0] || {}) as Record<string, string>;
  for (let s = 0; s < 16; s++) {
    const item = row0[s] || row0[String(s)];
    if (item && armorPieces.indexOf(item) !== -1) partsOn++;
  }
  if (toolsCap > 0) {
    const toolPieces = (setDef[1] || []) as string[];
    let toolsFound = 0;
    const row1 = (eq[1] || {}) as Record<string, string>;
    for (let s = 0; s < 8; s++) {
      const item = row1[s] || row1[String(s)];
      if (item && toolPieces.indexOf(item) !== -1 && toolsFound < toolsCap) {
        partsOn++;
        toolsFound++;
      }
    }
  }
  return partsOn >= partsReq;
}

// Map a SET_DATA id ("efaunt", "godshard", etc.) to its display name.
// IT website-data labels equipmentSets by SETNAME_SET — we humanise that
// into "Efaunt Set" / "Godshard Set" etc. so the descriptor row reads as
// the set the user can equip, not as "Smithing efaunt".
const SET_FRIENDLY_NAMES: Record<string, string> = {
  efaunt: "Efaunt Set Bonus",
  godshard: "Godshard Set Bonus",
  emperor: "Emperor Set Bonus",
};

export const setBonus = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const data = SET_DATA[id];
    const friendly = SET_FRIENDLY_NAMES[id];
    const tag = `Smithing ${id}`;
    const name = friendly ? `${friendly} (${tag})` : label("Smithing", id);
    if (!data) return node(name, 0, null, { note: "set " + id });
    const perma = String((optionsListData as any)?.[379] ?? "");
    let unlocked = perma.includes(data.key);
    if (!unlocked) {
      unlocked = checkSetEquipped(data.key, ctx.charIdx);
    }
    return node(
      name,
      unlocked ? data.bonus : 0,
      [node(unlocked ? "Unlocked" : "Not unlocked", 0, null, { fmt: "raw" })],
      { fmt: "+", note: "set " + id }
    );
  },
};
