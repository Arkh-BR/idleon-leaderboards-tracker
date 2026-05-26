// ===== STAR SIGN SYSTEM =====
// Pragmatic port: covers computeSeraphMulti (used widely) and the
// "drop" descriptor used by the DR additive pool. Full table of every
// SIGN_BONUSES key + per-sign accumulator lives in corgan-source — we
// port the minimum the DR pipeline reads.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { labData } from "../../../save/data";
import { starSignDropVal } from "../../data/common/starSign";
import { computeMeritocBonusz } from "../w7/meritoc";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

const SIGN_TABLES: Record<
  string,
  { indices: number[]; val: (idx: number) => number }
> = {
  drop: { indices: [14, 76], val: starSignDropVal },
};

const STAR_CHIP_ID = 15;

export function computeSeraphMulti(charIdx: number, saveData: SaveData): number {
  if (!saveData.starSignsUnlocked || !("Seraph_Cosmos" in saveData.starSignsUnlocked))
    return 1;

  const arcane40 = Number((saveData.arcaneData as any)?.[40]) || 0;
  const lv0 = saveData.lv0AllData && (saveData.lv0AllData[charIdx] as any[]);
  const summonLv = Number(lv0?.[18]) || 0;
  const seraphBase = 1.1 + Math.min(arcane40, 10) / 100;
  const seraphExp = Math.ceil((summonLv + 1) / 20);
  const seraphMulti = Math.min(5, Math.pow(seraphBase, seraphExp));

  let hasStarChip = false;
  const chipSlots = (labData as any)?.[1 + charIdx];
  if (chipSlots) {
    for (let c = 0; c < 7; c++) {
      if (Number(chipSlots[c]) === STAR_CHIP_ID) {
        hasStarChip = true;
        break;
      }
    }
  }
  const riftLv = Number((saveData.riftData as any)?.[0]) || 0;
  const enabledSS = riftLv >= 10 ? 5 : 0;
  const chipMulti = hasStarChip && enabledSS >= 1 ? Math.max(1, Math.min(2, 2)) : 1;

  const meritoc22 = computeMeritocBonusz(22, saveData);
  const meritocMulti = 1 + meritoc22 / 100;

  return chipMulti * meritocMulti * seraphMulti;
}

export const starSign = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const table = SIGN_TABLES[id];
    if (!table)
      return node("Star Signs", 0, null, { note: "starSign:" + id });
    let baseTotal = 0;
    const signChildren: CorganNode[] = [];
    for (let i = 0; i < table.indices.length; i++) {
      const idx = table.indices[i];
      const bonus = table.val(idx);
      const name = label("Star Sign", idx);
      signChildren.push(node(name, bonus, null, { fmt: "+" }));
      baseTotal += bonus;
    }
    if (baseTotal <= 0)
      return node("Star Signs", 0, signChildren, {
        fmt: "+",
        note: "starSign:" + id,
      });

    const totalMulti = computeSeraphMulti(ctx.charIdx, saveData);
    const total = baseTotal * totalMulti;

    // Flatten: skip the "Base Sum" wrapper and just hang the individual sign
    // rows directly under "Star Signs", followed by the Seraph multiplier as
    // its own sibling row. The base sum is implicit from the sum of sign
    // children + the multiplier shows its own factor.
    return node(
      "Star Signs",
      total,
      [
        ...signChildren,
        node("Seraph Multiplier", totalMulti, null, { fmt: "x" }),
      ],
      { fmt: "+", note: "starSign:" + id }
    );
  },
};
