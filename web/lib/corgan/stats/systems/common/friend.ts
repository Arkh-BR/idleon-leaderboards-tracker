// ===== FRIEND SYSTEM =====
// Friend bonus for type 3 (DR): 25 * min(1, 0.2 + min(12000, i) / (min(12000, i) + 3000))
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { FRIEND_DR } from "../../data/game-constants";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const friend = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const friends =
      Number(((ctx.saveData as any).currenciesData as any)?.["GenericLoot1"]) || 0;
    const i = Math.min(FRIEND_DR.cap, friends);
    if (id !== 3) return node(label("Friend", id), 0, null, { note: "friend " + id });
    const val =
      FRIEND_DR.scale * Math.min(1, FRIEND_DR.base + i / (i + FRIEND_DR.half));
    return node(
      label("Friend", id),
      val,
      [
        node("Friend Count", friends, null, { fmt: "raw" }),
        node("Capped", i, null, {
          fmt: "raw",
          note: "cap " + FRIEND_DR.cap,
        }),
      ],
      { fmt: "+", note: "friend " + id }
    );
  },
};
