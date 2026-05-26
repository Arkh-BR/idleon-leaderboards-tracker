// ===== BREEDING SYSTEM (W4) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import {
  PET_SHINY_TYPE,
  PET_NAMES,
  SHINY_BONUS_PER_LV,
  SHINY_TYPE_TO_CAT,
  SHINY_CAT_NAMES,
} from "../../data/w4/breeding";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

function shinyLvFromExp(exp: number): number {
  if (exp <= 0) return 0;
  let lv = 1;
  for (let e = 0; e < 19; e++) {
    if (exp > Math.floor((1 + Math.pow(e + 1, 1.6)) * Math.pow(1.7, e + 1))) {
      lv = e + 2;
    }
  }
  return lv;
}

type ShinyParts = {
  total: number;
  parts: Array<{
    world: number;
    pet: number;
    val: number;
    shinyLv: number;
    bonusPerLv: number;
    exp: number;
  }>;
};

function _shinyBonusParts(catKey: number, saveData: SaveData): ShinyParts {
  const parts: ShinyParts["parts"] = [];
  let total = 0;
  for (let world = 0; world < 4; world++) {
    const shinyExps = saveData.breedingData && (saveData.breedingData[22 + world] as any);
    const petTypes = PET_SHINY_TYPE[world];
    if (!shinyExps || !petTypes) continue;
    for (let pet = 0; pet < petTypes.length; pet++) {
      const exp = Number((shinyExps as any)[pet]) || 0;
      if (exp <= 0) continue;
      const shinyTypeIdx = petTypes[pet];
      const cat = SHINY_TYPE_TO_CAT[shinyTypeIdx];
      if (cat !== catKey) continue;
      const shinyLv = shinyLvFromExp(exp);
      const bonusPerLv = SHINY_BONUS_PER_LV[shinyTypeIdx] || 0;
      const val = Math.round(shinyLv * bonusPerLv);
      total += val;
      parts.push({ world, pet, val, shinyLv, bonusPerLv, exp });
    }
  }
  return { total, parts };
}

export function computeShinyBonusS(catKey: number, saveData: SaveData): number {
  return _shinyBonusParts(catKey, saveData).total;
}

export const shiny = {
  resolve(id: number, ctx: Ctx): CorganNode {
    // The shiny-cat name is the in-game label for the pet category (id 0 is
    // "Drop Rate", etc.) — gives the row a meaningful header instead of the
    // bare "Breeding 0". Some entries in SHINY_CAT_NAMES still carry the
    // "+{%_" template marker (e.g. "+{% Drop Rate") — strip it so the label
    // reads as just the bonus type.
    const rawCatName = SHINY_CAT_NAMES[id] || "#" + id;
    const catName = rawCatName
      .replace(/^\+?\{%\s*/, "")
      .replace(/^[+\-]?\{[\d.]*\}\s*/, "")
      .trim();
    const shinyLabel = `${catName} Shiny Pet (Breeding ${id})`;
    const r = _shinyBonusParts(id, ctx.saveData);
    const children: CorganNode[] = [];
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      const petName =
        (PET_NAMES[p.world] && PET_NAMES[p.world][p.pet]) ||
        "W" + p.world + " P" + p.pet;
      children.push(
        node(
          petName,
          p.val,
          [
            node("Shiny Lv", p.shinyLv, null, { fmt: "raw" }),
            node("Bonus/Lv", p.bonusPerLv, null, { fmt: "raw" }),
            node("Shiny EXP", p.exp, null, { fmt: "raw" }),
          ],
          { fmt: "+" }
        )
      );
    }
    return node(
      shinyLabel,
      r.total,
      children.length ? children : null,
      { fmt: "+", note: "breeding shiny " + id }
    );
  },
};
