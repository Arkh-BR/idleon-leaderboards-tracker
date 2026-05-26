// ===== PRISTINE CHARMS (W5) =====
// Real 1:1 port replacing the Stage 2 stub. Returns the charm's bonus if
// the charm is unlocked (ninjaData[107][idx] === 1).

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { pristineCharmBonus } from "../../data/common/sigils";
import type { SaveData } from "../../../state";

// Friendly charm names sourced from pristineCharms[i].name in IT website-data.
export const PRISTINE_NAMES: Record<number, string> = {
  3: "Cotton Candy",
  8: "Crystal Comb",
  14: "Liquorice Roll",
  17: "Liquorice Rolle",
  20: "Jellypick",
};

export function pristineLabel(id: number): string {
  const n = PRISTINE_NAMES[id];
  return n ? `${n} (Pristine ${id})` : label("Pristine", id);
}

export function pristineBon(idx: number, saveData: SaveData): number {
  if (
    !saveData ||
    !saveData.ninjaData ||
    (saveData.ninjaData[107] as any[] | undefined)?.[idx] !== 1
  ) {
    return 0;
  }
  return pristineCharmBonus(idx);
}

export const pristine = {
  resolve(id: number, ctx: { saveData: SaveData }): CorganNode {
    const val = pristineBon(id, ctx.saveData);
    const unlocked = val > 0;
    return node(
      pristineLabel(id),
      val,
      [
        node(unlocked ? "Unlocked" : "Locked", unlocked ? 1 : 0, null, { fmt: "raw" }),
        node("Charm Bonus", pristineCharmBonus(id), null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "pristine " + id }
    );
  },
};
