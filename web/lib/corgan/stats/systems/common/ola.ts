// ===== OLA SYSTEM =====
// Reads OptionsListAccount[idx] and applies a threshold-based bonus.
// DR descriptor uses ola 232 with args [1, 0.3]: if OLA[232] >= 1, contribute +0.3 flat.
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData } from "../../../save/data";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// OptionsListAccount is a flat array of account-wide flags / counters with
// no IT-side naming table. The descriptor entries we currently use here:
//   232 → Sneaking Completions (W7 Ninja sneaking, drives a flat +0.3 DR)
const OLA_NAMES: Record<number, string> = {
  232: "Sneaking Completions",
};

export const ola = {
  resolve(id: number, _ctx: Ctx, args?: number[]): CorganNode {
    const threshold = (args && args[0]) ?? 1;
    const bonus = (args && args[1]) ?? 0;
    const raw = Number((optionsListData as any)?.[id]) || 0;
    const meets = raw >= threshold;
    const val = meets ? bonus : 0;
    const friendly = OLA_NAMES[id];
    const olaName = friendly ? `${friendly} (Ola ${id})` : label("Ola", id);
    return node(
      olaName,
      val,
      [
        node("OLA[" + id + "]", raw, null, { fmt: "raw" }),
        node("Threshold", threshold, null, {
          fmt: "raw",
          note: meets ? "met" : "not met",
        }),
        node("Bonus", bonus, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "ola " + id }
    );
  },
};
