// ===== TOME SYSTEM (W4) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { equipSetBonus } from "../../data/common/equipment";
import { TOME_DATA } from "../../data/game-constants";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const tome = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const data = TOME_DATA[id];
    if (!data) return node(label("Tome", id), 0, null, { note: "tome " + id });
    const saveData = ctx.saveData;

    let unlocked: boolean;
    if (data.unlockType === "always") {
      unlocked = true;
    } else if (data.unlockType === "eventShop") {
      const evStr = saveData.cachedEventShopStr || "";
      unlocked = eventShopOwned(data.unlockIdx, evStr) >= 1;
    } else {
      unlocked = Number((optionsListData as any)?.[data.unlockIdx]) >= 1;
    }
    if (!unlocked) {
      return node(
        label("Tome", id),
        0,
        [node("Not Unlocked", 0, null, { fmt: "raw" })],
        { note: "tome " + id }
      );
    }

    const tomeScore = saveData.totalTomePoints || 0;
    const scaled = Math.floor(
      Math.max(0, tomeScore - data.threshold) / data.divisor
    );
    const base = data.base * Math.pow(scaled, data.exp);

    const grim17 = Number((saveData.grimoireData as any)?.[17]) || 0;
    const trollSet = String((optionsListData as any)?.[379] ?? "").includes("TROLL_SET")
      ? equipSetBonus("TROLL_SET")
      : 0;
    const multi = 1 + (grim17 + trollSet) / 100;

    const val = base <= 0 ? 0 : base * multi;
    return node(
      label("Tome", id),
      val,
      [
        node("Tome Score", tomeScore, null, { fmt: "raw" }),
        node("Scaled", scaled, null, {
          fmt: "raw",
          note:
            "floor((pts" +
            (data.threshold ? "-" + data.threshold : "") +
            ")/" +
            data.divisor +
            ")",
        }),
        node("Base", base, null, { fmt: "raw" }),
        node(
          "Tome Multi",
          multi,
          [
            node("Grey Tome Book (Grimoire 17)", grim17, null, { fmt: "raw" }),
            node("Troll Set", trollSet, null, { fmt: "raw" }),
          ],
          { fmt: "x" }
        ),
      ],
      { fmt: "+", note: "tome " + id }
    );
  },
};
