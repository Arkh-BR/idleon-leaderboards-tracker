// ===== EMPEROR SYSTEM (W6) =====
import { node, type CorganNode } from "../../../node";
import { emperorBonType, emperorBonVal } from "../../data/common/emperor";
import { arcadeBonus } from "../w2/arcade";
import { arcaneUpgBonus } from "../mc/tesseract";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// Emperor bonus slot names. Each emperorBonType returns a numeric bonus
// category; the descriptor uses id 11 for Drop Rate. Sourced semantically
// from the W6 Emperor system — each id is a different stat the rolling
// kill counter feeds.
const EMPEROR_NAMES: Record<number, string> = {
  11: "Drop Rate Emperor Bonus",
};
function emperorLabel(id: number): string {
  const n = EMPEROR_NAMES[id];
  return n ? `${n} (Emperor ${id})` : emperorLabel(id);
}

export function computeEmperorBon(bonusIdx: number, saveData: SaveData): number {
  const emperorCount = Number((saveData.olaData as any)?.[369]) || 0;
  let sum = 0;
  for (let r = 0; r < emperorCount; r++) {
    const slot = r % 48;
    if (emperorBonType(slot) === bonusIdx) sum += emperorBonVal(bonusIdx);
  }
  const mult =
    1 + (arcaneUpgBonus(48, saveData) + arcadeBonus(51, saveData).val) / 100;
  return Math.floor(sum * mult);
}

export const emperor = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const emperorCount = Number((saveData.olaData as any)?.[369]) || 0;
    let sum = 0;
    let slotMatches = 0;
    for (let r = 0; r < emperorCount; r++) {
      const slot = r % 48;
      if (emperorBonType(slot) === id) {
        sum += emperorBonVal(id);
        slotMatches++;
      }
    }
    const arcane48 = arcaneUpgBonus(48, saveData);
    const arcade51val = arcadeBonus(51, saveData).val;
    const mult = 1 + (arcane48 + arcade51val) / 100;
    const val = Math.floor(sum * mult);
    if (val <= 0)
      return node(emperorLabel(id), 0, null, { note: "emperor " + id });
    return node(
      emperorLabel(id),
      val,
      [
        node("Emperor Kills", emperorCount, null, { fmt: "raw" }),
        node("Slot Matches", slotMatches, null, { fmt: "raw" }),
        node("Raw Sum", sum, null, { fmt: "raw" }),
        node(label("Arcane", 48), arcane48, null, { fmt: "raw" }),
        node(label("Arcade", 51), arcade51val, null, { fmt: "raw" }),
        node("Multi", mult, null, { fmt: "x" }),
      ],
      { fmt: "+", note: "emperor " + id }
    );
  },
};
