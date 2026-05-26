// ===== COMPANIONS SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/companions.js.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { companionBonus } from "../../data/common/companions";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function companions(idx: number, saveData: SaveData): number {
  if (!saveData.companionIds || !saveData.companionIds.has(idx)) return 0;
  return companionBonus(idx);
}

export const companion = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const name = label("Companion", id);
    const owned = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(id)
      : false;
    const bonusVal = companionBonus(id);
    const val = owned ? bonusVal : 0;
    if (!owned) {
      return node(
        name,
        0,
        [
          node("Not owned", 0, null, { fmt: "raw" }),
          node("Would grant", bonusVal, null, {
            fmt: "+",
            note: "if owned",
          }),
        ],
        { note: "Not owned — would grant +" + bonusVal }
      );
    }
    return node(
      name,
      val,
      [
        node("Owned", 1, null, { fmt: "raw" }),
        node("Bonus", bonusVal, null, { fmt: "+" }),
      ],
      { fmt: "+" }
    );
  },
};

/**
 * Standardized companion child node — [Owned, Bonus] structure that
 * the gen catalog's ownershipToggle detector picks up automatically.
 *
 * fmt-aware: x-fmt companions idle to 1 (multiplicative identity), all
 * others idle to 0. The "Bonus" kid carries the DELTA from idle, so
 * the runtime handler computes  idle + owned × bonus  uniformly.
 *
 * Call sites: talent bonus chain (Rift Slug), arcade (Companion 27),
 * friend bonus (Companion 30), owl (Companion 51), gallery (49),
 * meritoc (39, 161), lab (55). Companion 0 in lab.ts is intentionally
 * NOT converted — its emission already carries domain children (grid
 * 173 lv) and uses a non-trivial formula, so the simple toggle shape
 * would lose information.
 */
export function companionChild(
  id: number,
  val: number,
  saveData: SaveData,
  opts?: { fmt?: "raw" | "+" | "x"; note?: string; suffix?: string }
): CorganNode {
  const fmt = opts?.fmt ?? "raw";
  const idle = fmt === "x" ? 1 : 0;
  const delta = val - idle;
  const owned = saveData.companionIds && saveData.companionIds.has(id) ? 1 : 0;
  const name = opts?.suffix
    ? label("Companion", id, opts.suffix)
    : label("Companion", id);
  return node(
    name,
    val,
    [
      node("Owned", owned, null, { fmt: "raw" }),
      node("Bonus", delta, null, { fmt: "raw" }),
    ],
    { fmt, note: opts?.note }
  );
}

export const compMulti = {
  resolve(id: number, ctx: Ctx, args?: number[]): CorganNode {
    const cap = args ? args[0] : 1;
    const divisor = args ? args[1] : 1;
    const name = label("Companion", id);
    const owned = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(id)
      : false;
    const bonusVal = owned ? companionBonus(id) : 0;
    const raw = divisor > 1 ? bonusVal / divisor : bonusVal;
    const val = Math.max(1, Math.min(cap, 1 + raw));
    // Owned/Not-owned status is reflected by `val` itself (1× when not
    // owned, > 1× when owned), so don't add a redundant zero-val "Owned"
    // row. When not owned, swap in a single explanatory row instead.
    const children: CorganNode[] = owned
      ? [
          node("Raw bonus", bonusVal, null, { fmt: "+" }),
          node("Cap", cap, null, { fmt: "x" }),
          node("Result", val, null, { fmt: "x" }),
        ]
      : [
          node("Not owned — no contribution", 0, null, {
            fmt: "raw",
            note: `Would grant +${bonusVal} raw if owned`,
          }),
        ];
    return node(name, val, children, { fmt: "x" });
  },
};
