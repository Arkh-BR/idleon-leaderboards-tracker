// ===== OBOL SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/w2/obols.js.
// Sums obol UQ stat bonuses from personal + family obols. Each obol entry
// holds the base item name; the per-slot map (ObolEqMAP) carries rolled
// stone upgrades that add to the matching UQ slot of the item.

import { node, type CorganNode } from "../../../node";
import { entityName } from "../../entity-names";
import {
  obolNamesData,
  obolMapsData,
  obolFamilyNames,
  obolFamilyMaps,
} from "../../../save/data";
import { ETC_STAT_NAMES, itemUqMatch } from "../../data/common/equipment";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

type ObolResult = { idx: number; name: string; val: number };

function scanObols(
  names: any[] | undefined,
  maps: any | undefined,
  statNames: string[]
): ObolResult[] {
  const results: ObolResult[] = [];
  const len = names ? names.length : 0;
  for (let i = 0; i < len; i++) {
    const name = (names as any[])[i];
    if (!name || name === "Blank" || name === "Null") continue;
    const mapData = maps ? maps[i] || maps[String(i)] : null;
    let val = 0;
    const builtIn = itemUqMatch(name, statNames);
    if (builtIn) {
      val += builtIn.val;
      if (mapData) {
        const uqValKey = "UQ" + builtIn.uq + "val";
        val += Number(mapData[uqValKey]) || 0;
      }
    }
    if (val > 0) results.push({ idx: i, name, val });
  }
  return results;
}

export const obol = {
  resolve(id: number | (number | string)[], ctx: Ctx): CorganNode {
    const ids = Array.isArray(id) ? id : [id];
    const statNames: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const names = ETC_STAT_NAMES[String(ids[i])];
      if (names) for (let j = 0; j < names.length; j++) statNames.push(names[j]);
    }
    if (!statNames.length)
      return node("Obols " + id, 0, null, { note: "obol " + id });

    const charNames = (obolNamesData as any)[ctx.charIdx] || [];
    const charMaps = (obolMapsData as any)[ctx.charIdx] || {};
    const personal = scanObols(charNames, charMaps, statNames);
    const family = scanObols(obolFamilyNames, obolFamilyMaps, statNames);

    let total = 0;
    const children: CorganNode[] = [];
    let pTotal = 0;
    const pChildren: CorganNode[] = [];
    for (let i = 0; i < personal.length; i++) {
      pTotal += personal[i].val;
      pChildren.push(
        node(
          entityName("Item", personal[i].name) || personal[i].name,
          personal[i].val,
          null,
          { fmt: "+", note: "slot " + personal[i].idx }
        )
      );
    }
    if (pTotal > 0) {
      children.push(node("Personal", pTotal, pChildren, { fmt: "+" }));
      total += pTotal;
    }
    let fTotal = 0;
    const fChildren: CorganNode[] = [];
    for (let j = 0; j < family.length; j++) {
      fTotal += family[j].val;
      fChildren.push(
        node(
          entityName("Item", family[j].name) || family[j].name,
          family[j].val,
          null,
          { fmt: "+", note: "slot " + family[j].idx }
        )
      );
    }
    if (fTotal > 0) {
      children.push(node("Family", fTotal, fChildren, { fmt: "+" }));
      total += fTotal;
    }
    return node("Obol Bonuses", total, children, {
      fmt: "+",
      note: "obol " + id,
    });
  },
};
