// ===== EQUIPMENT SYSTEM =====
// Sums equipment UQ stat bonuses across all gear slots, applying chip
// doubling (pendant/keychain/trophy) and grid 172 multiplier on attire.
//
// grid172Multi mirrors the Corgan source: `1 + gbWith(gl, so, 172, ctx) / 100`,
// where gbWith returns perLv × lv × shapeMult × allBonusMulti for Grid M4
// "Well Dressed". For Corsair Uniform (slot 15) at Lv 2 this is ~×1.738.

import { node, type CorganNode } from "../../../node";
import { label, entityName } from "../../entity-names";
import { emmData, equipOrderData } from "../../../save/data";
import { ETC_STAT_NAMES, itemUqMatch } from "../../data/common/equipment";
import { charHasChip, gridBonusValue } from "../w4/lab";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

type SlotResult = {
  row: number;
  slot: number;
  rawVal: number;
  val: number;
  itemName: string;
};

function scanSlots(
  emm: any,
  equipOrder: any,
  row: number,
  statNames: string[],
  grid172Multi: number,
  skipSlots: Record<number, boolean> | null,
  chipDoubles: Record<number, boolean> | null
): SlotResult[] {
  const data = emm[row] || {};
  const eqRow = (equipOrder && equipOrder[row]) || {};
  const results: SlotResult[] = [];
  const maxSlot = row === 0 ? 15 : 7;
  for (let slot = 0; slot <= maxSlot; slot++) {
    if (skipSlots && skipSlots[slot]) continue;
    const sd = data[slot] || data[String(slot)];
    let val = 0;
    const itemName = (eqRow[slot] || eqRow[String(slot)] || "") as string;
    const builtIn = itemUqMatch(itemName, statNames);
    if (sd) {
      for (let si = 0; si < statNames.length; si++) {
        const statName = statNames[si];
        if (sd.UQ1txt === statName) val += Number(sd.UQ1val) || 0;
        if (sd.UQ2txt === statName) val += Number(sd.UQ2val) || 0;
      }
    }
    if (builtIn) {
      val += builtIn.val;
      const uqTxtKey = "UQ" + builtIn.uq + "txt";
      const uqValKey = "UQ" + builtIn.uq + "val";
      if (sd && !sd[uqTxtKey] && (Number(sd[uqValKey]) || 0) > 0) {
        val += Number(sd[uqValKey]);
      }
    }
    if (val <= 0) continue;
    const rawVal = val;
    if (row === 0 && chipDoubles && chipDoubles[slot]) val *= 2;
    if (row === 0 && slot === 15) val *= grid172Multi;
    results.push({ row, slot, rawVal, val, itemName });
  }
  return results;
}

export const equipment = {
  resolve(id: number | string | (number | string)[], ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const ids = Array.isArray(id) ? id : [id];
    const statNames: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const names = ETC_STAT_NAMES[String(ids[i])];
      if (names) for (let j = 0; j < names.length; j++) statNames.push(names[j]);
    }
    if (!statNames.length)
      return node("Equipment " + id, 0, null, { note: "equipment " + id });
    const emm = (emmData as any)[ctx.charIdx];
    if (!emm)
      return node("Equipment Bonuses", 0, null, { note: "equipment " + id });

    // Grid M4 "Well Dressed" — multiplies the first MISC bonus on Attire (slot 15).
    // Now wired through gridBonusValue() instead of the previous Stage 3 stub.
    const grid172Multi = 1 + gridBonusValue(172, saveData) / 100;

    const sp = saveData.spelunkData || [];
    const galleryOn =
      ((sp[16] as any[])?.length > 0) || ((sp[17] as any[])?.length > 0);
    const premhatOn = (sp[46] as any[])?.length > 0;
    let skipSlots: Record<number, boolean> | null = null;
    if (galleryOn || premhatOn) {
      skipSlots = {};
      if (galleryOn) {
        skipSlots[10] = true;
        skipSlots[14] = true;
      }
      if (premhatOn) skipSlots[8] = true;
    }

    const chipDoubles: Record<number, boolean> = {};
    if (charHasChip(ctx.charIdx, "pend")) chipDoubles[3] = true;
    if (charHasChip(ctx.charIdx, "key1")) chipDoubles[9] = true;
    if (charHasChip(ctx.charIdx, "troph")) chipDoubles[10] = true;

    const equipOrder = (equipOrderData as any)[ctx.charIdx];
    const slots0 = scanSlots(
      emm,
      equipOrder,
      0,
      statNames,
      grid172Multi,
      skipSlots,
      chipDoubles
    );
    const slots1 = scanSlots(emm, equipOrder, 1, statNames, grid172Multi, null, null);
    const allSlots = slots0.concat(slots1);

    let total = 0;
    const children: CorganNode[] = [];
    for (let i = 0; i < allSlots.length; i++) {
      const s = allSlots[i];
      total += s.val;
      children.push(
        node(
          entityName("Item", s.itemName) ||
            s.itemName ||
            "Row " + s.row + " Slot " + s.slot,
          s.val,
          null,
          { fmt: "+", note: "R" + s.row + " S" + s.slot }
        )
      );
    }
    return node("Equipment Bonuses", total, children, {
      fmt: "+",
      note: "equipment " + id,
    });
  },
};

void label;
