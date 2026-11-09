// ===== SET BONUS SYSTEM (W3) =====
// 1:1 port replacing the Stage 2 stub.

import { node, treeResult, type ArkhNode, type TreeResult } from "../../../node";
import { gameName, label } from "../../entity-names";
import { optionsListData, equipOrderData } from "../../../save/data";
import { equipSetBonus } from "../../data/common/equipment";
import { EquipmentSets } from "@/lib/game/data/generated/custommaps.js";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

/** N.js GetSetBonus(set, "Bonus"): EquipmentSets[set][3][2] once the set is in
 *  OLA[379] (permanently unlocked) — every set, no whitelist. */
// ponytail: the worn-full-set fallback (PartsOn ≥ PartsReq) is not modelled
// here (setBonus.resolve does it for the sets that need it).
// @njs _customBlock_GetSetBonus
export function getSetBonus(setName: string): TreeResult {
  const perma = String((optionsListData as any)?.[379] ?? "");
  if (!perma.split(",").includes(setName)) return treeResult(0);
  const val = equipSetBonus(setName);
  return treeResult(val, [
    node(setName + " Unlocked", 1, null, { fmt: "raw" }),
    node("Bonus Value", val, null, { fmt: "raw" }),
  ]);
}

const SET_DATA: Record<string, { key: string; bonus: number }> = {
  efaunt: { key: "EFAUNT_SET", bonus: equipSetBonus("EFAUNT_SET") },
  void: { key: "VOID_SET", bonus: equipSetBonus("VOID_SET") },
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
  // N.js GetSetBonus "PartsOn" (@11008519): when EquipmentSets[set][3][1] is
  // 1, one weapon from the set's third list worn in the gear row is a part
  // too (VOID_SET: 4 armor + 2 tools + 1 weapon). EFAUNT's is 0 → unchanged.
  // @njs _customBlock_GetSetBonus
  if (specialCap === 1) {
    const weapons = (setDef[2] || []) as string[];
    for (let s = 0; s < 16; s++) {
      const item = row0[s] || row0[String(s)];
      if (item && weapons.indexOf(item) !== -1) {
        partsOn++;
        break;
      }
    }
  }
  return partsOn >= partsReq;
}

export const setBonus = {
  resolve(id: string, ctx: Ctx): ArkhNode {
    const data = SET_DATA[id];
    // Name = the game's EquipmentSets key: "efaunt" → EFAUNT_SET → "Efaunt Set Bonus".
    const setKey = `${id.toUpperCase()}_SET`;
    const friendly = (EquipmentSets as any)[setKey] ? `${gameName(setKey)} Bonus` : "";
    const tag = `Smithing ${id}`;
    const name = friendly ? `${friendly} (${tag})` : label("Smithing", id);
    if (!data) return node(name, 0, null, { note: "set " + id });
    const perma = String((optionsListData as any)?.[379] ?? "");
    let unlocked = perma.split(",").includes(data.key);
    if (!unlocked) {
      unlocked = checkSetEquipped(data.key, ctx.charIdx);
    }
    return node(
      name,
      unlocked ? data.bonus : 0,
      // Toggle child: name stays "Unlocked", val mirrors the boolean
      // (was previously hardcoded to 0, which confused the max-values
      // tool — child val=0 looks like "set is locked" even when the
      // parent reflects the unlocked bonus).
      [node("Unlocked", unlocked ? 1 : 0, null, { fmt: "raw" })],
      { fmt: "+", note: "set " + id }
    );
  },
};
