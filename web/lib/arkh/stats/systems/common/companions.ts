// ===== COMPANIONS SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/companions.js.

import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { companionBonus } from "../../data/common/companions";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function companions(idx: number, saveData: SaveData): number {
  if (!saveData.companionIds || !saveData.companionIds.has(idx)) return 0;
  return companionBonus(idx, saveData.companionLv2Ids);
}

export const companion = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const name = label("Companion", id);
    const owned = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(id)
      : false;
    const lv2 = !!ctx.saveData.companionLv2Ids?.has(id);
    const bonusVal = companionBonus(id, ctx.saveData.companionLv2Ids);
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
        node("Bonus", bonusVal, null, {
          fmt: "+",
          note: lv2 ? "stage 2 (LV2) value — CompanionDB[id][11]" : undefined,
        }),
      ],
      { fmt: "+" }
    );
  },
};

/**
 * Standardized companion child node — [Owned, Bonus] structure that
 * the gen catalog's ownershipToggle detector picks up automatically.
 *
 * The "Bonus" kid now carries the REAL bonus value (the same number
 * the game shows in tooltips), not a delta-from-idle. Previously the
 * kid carried `val - idle`, which for x-fmt companions like Mr Pig
 * (val=2, idle=1, delta=1) hid the actual multiplier from the user.
 * The runtime handler (ownershipToggle) now computes the delta
 * internally so the math still works:
 *   result = idle + owned × (bonusKid − idle)
 *   x-fmt (idle=1): owned=1 → result = bonusKid; owned=0 → 1
 *   +-fmt (idle=0): owned=1 → result = bonusKid; owned=0 → 0
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
): ArkhNode {
  const fmt = opts?.fmt ?? "raw";
  const owned = saveData.companionIds && saveData.companionIds.has(id) ? 1 : 0;
  const name = opts?.suffix
    ? label("Companion", id, opts.suffix)
    : label("Companion", id);
  return node(
    name,
    val,
    [
      node("Owned", owned, null, { fmt: "raw" }),
      // REAL bonus value (matches in-game tooltip). ownershipToggle
      // handler reads this and computes the delta-from-idle internally.
      node("Bonus", val, null, { fmt: "raw" }),
    ],
    { fmt, note: opts?.note }
  );
}

export const compMulti = {
  resolve(id: number, ctx: Ctx, args?: number[]): ArkhNode {
    const cap = args ? args[0] : 1;
    const divisor = args ? args[1] : 1;
    // Optional explicit multiplier on the bonus (default 1). Some companions
    // apply a fractional factor with NO cap, e.g. Crystal Glunko (168):
    // ×(1 + 0.3·comp168) → args [Infinity, 1, 0.3].
    const mult = args && args[2] !== undefined ? args[2] : 1;
    // Optional flat add applied ONLY at stage 2, outside the cap — Mama Troll
    // (132) in N.js is 1 + (min(.5, comp132) + .2·CompLV2(132)) → args
    // [1.5, 1, 1, 0.2]. (2026-08)
    const lv2Add = args && args[3] !== undefined ? args[3] : 0;
    const name = label("Companion", id);
    const owned = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(id)
      : false;
    const lv2 = owned && !!ctx.saveData.companionLv2Ids?.has(id);
    // Stage-2 companions read CompanionDB[id][11] (e.g. Crystal Glunko 1 → 1.5,
    // so ×(1 + 0.3·1.5) = 1.45 — the "1.45x Drop Rate" of its upgraded text).
    const bonusVal = owned ? companionBonus(id, ctx.saveData.companionLv2Ids) : 0;
    const raw = (divisor > 1 ? bonusVal / divisor : bonusVal) * mult;
    const val = Math.max(1, Math.min(cap, 1 + raw) + (lv2 ? lv2Add : 0));
    // Owned/Not-owned status is reflected by `val` itself (1× when not
    // owned, > 1× when owned), so don't add a redundant zero-val "Owned"
    // row. When not owned, swap in a single explanatory row instead.
    const children: ArkhNode[] = owned
      ? [
          node("Raw bonus", bonusVal, null, {
            fmt: "+",
            note: lv2 ? "stage 2 (LV2) value" : undefined,
          }),
          // An infinite cap (uncapped, e.g. Crystal Glunko 168) must NOT surface
          // as a "Cap: Infinity" ×-child — the top-player frankenstein's PROD(x)
          // op would grab it and blow the node up to Infinity. Emit Cap only
          // when it's a real, finite cap.
          ...(Number.isFinite(cap)
            ? [node("Cap", cap, null, { fmt: "x" })]
            : []),
          ...(lv2 && lv2Add
            ? [
                node("Stage 2 (LV2) bonus", lv2Add, null, {
                  fmt: "+",
                  note: "added outside the cap",
                }),
              ]
            : []),
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
