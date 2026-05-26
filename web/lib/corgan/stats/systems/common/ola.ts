// ===== OLA SYSTEM =====
// Reads OptionsListAccount[idx] and applies a threshold-based bonus.
// DR descriptor uses ola 232 with args [1, 0.3]: if OLA[232] >= 1, contribute +0.3 flat.
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData } from "../../../save/data";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// OptionsListAccount is a flat array of account-wide flags / counters.
// Most don't have an IT naming table, so the descriptor entries we care
// about get explicit overrides — both for the main name and for the
// "system category" tag that DeepView mutes after the friendly name.
//   232 → +0.3 flat DR once you've completed a W7 Sneaking Mastery task.
//          The bonus is granted by the Sneaking Mastery system (NOT a
//          Pristine Charm — the earlier "Pristine Charm" tag was wrong).
const OLA_LABELS: Record<number, { name: string; tag: string }> = {
  232: { name: "Sneaking Completions", tag: "Sneaking Mastery" },
};

export const ola = {
  resolve(id: number, _ctx: Ctx, args?: number[]): CorganNode {
    const threshold = (args && args[0]) ?? 1;
    const bonus = (args && args[1]) ?? 0;
    const raw = Number((optionsListData as any)?.[id]) || 0;
    const meets = raw >= threshold;
    const val = meets ? bonus : 0;
    const friendly = OLA_LABELS[id];
    const olaName = friendly
      ? `${friendly.name} (${friendly.tag})`
      : label("Ola", id);
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
