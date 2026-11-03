// ===== PRISTINE CHARMS (W5) =====
// Real 1:1 port replacing the Stage 2 stub. Returns the charm's bonus if
// the charm is unlocked (ninjaData[107][idx] === 1).

import { node, type ArkhNode } from "../../../node";
import { gameLabel, gameName } from "../../entity-names";
import { pristineCharmBonus } from "../../data/common/sigils";
import { NjEQ } from "../../data/game/custommaps.js";
import type { SaveData } from "../../../state";

// Name = the game's charm item NjEQ["NjTrP" + id][2] ("Jellypick"), the
// entry PristineBon reads the bonus from.
const charmRaw = (id: number) => (NjEQ as any)["NjTrP" + id]?.[2];
export const pristineName = (id: number): string => gameName(charmRaw(id));
export function pristineLabel(id: number): string {
  return gameLabel("Pristine", id, charmRaw(id));
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
  resolve(id: number, ctx: { saveData: SaveData }): ArkhNode {
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
