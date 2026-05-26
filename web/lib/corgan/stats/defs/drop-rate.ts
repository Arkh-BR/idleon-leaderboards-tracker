// ===== DROP RATE DESCRIPTOR =====
// 1:1 port of corgan-source/js/stats/defs/drop-rate.js.

import type { Descriptor, Pool } from "../tree-builder";
import type { CorganNode } from "../../node";
import { categorizePoolItems } from "../categorize";

const dropRateDesc: Descriptor = {
  id: "drop-rate",
  name: "Drop Rate",
  scope: "character+map",
  category: "combat",

  pools: {
    base: [{ system: "lukScaling" }],
    addMain: [
      { system: "talent", id: 279 },
      { system: "talent", id: 24 },
      { system: "talent", id: 655 },
      { system: "stamp", id: "A38" },
      { system: "alchemy", id: "DROPPIN_LOADS" },
      { system: "prayer", id: 7 },
      { system: "shrine", id: 4 },
      { system: "arcade", id: 27 },
      { system: "card", id: 10 },
      { system: "guild", id: 10 },
      { system: "cardSet", id: 5 },
      { system: "cardSet", id: 6 },
      { system: "starSign", id: "drop" },
      { system: "postOffice", id: [11, 0] },
      { system: "etcBonus", id: 2 },
      // etcBonus 102 (%_DROP_CHANCE) is dropped from the pool: no item in
      // IT website-data carries it as a built-in, so the only way for it
      // to contribute is a random UQ-stone roll of that exact stat onto
      // an item or obol — extremely rare in practice and worth zero for
      // every observed save. Keeping the entry showed an empty wrapper
      // with no children, which read as broken UX.
      { system: "sigil", id: 11 },
      { system: "shiny", id: 0 },
      { system: "companion", id: 3 },
      { system: "companion", id: 50 },
      { system: "winBonus", id: 9 },
      { system: "tome", id: 2 },
      { system: "grid", id: 173 },
      { system: "dream", id: 10 },
    ],
    addLUK2: [
      { system: "cardSingle", id: "mini5a", args: [1.5, 10] },
      { system: "cardSingle", id: "caveC", args: [4, 30] },
      { system: "cardSingle", id: "anni4Event1", args: [2, 20] },
      { system: "cardSingle", id: "luckEvent1", args: [3, 25] },
      { system: "goldenFood", id: "DropRatez" },
      { system: "achievement", id: 377, args: [6] },
      { system: "achievement", id: 381, args: [4] },
      { system: "owl", id: 4 },
      { system: "voting", id: 27 },
      { system: "grimoire", id: 44 },
      { system: "vault", id: 18 },
      { system: "farm", id: "rank9" },
      { system: "farm", id: "cropSC7" },
      { system: "farm", id: "exotic59" },
      { system: "holes", id: "upg46" },
      { system: "holes", id: "upg82" },
      { system: "holes", id: "meas15" },
      { system: "holes", id: "monument" },
      { system: "companion", id: 22 },
      { system: "companion", id: 158 },
      { system: "companion", id: 111 },
      { system: "emperor", id: 11 },
      { system: "setBonus", id: "efaunt" },
      { system: "friend", id: 3 },
      { system: "legendPTS", id: 1 },
      { system: "spelunkShop", id: 50 },
      { system: "companion", id: 132 },
    ],
    chipDR: [{ system: "chip", id: "dr" }],
    postFlat: [
      { system: "bundle", id: "bun_v" },
      { system: "ola", id: 232, args: [1, 0.3] },
    ],
    postMult: [
      { system: "workshop" },
      { system: "bundle", id: "bun_p" },
      { system: "arcaneMap" },
      { system: "card", id: 101 },
      { system: "sushiRoG", id: 48 },
      { system: "glimbo" },
      { system: "tome", id: 7 },
      { system: "etcBonus", id: 99 },
      { system: "minehead", id: 0 },
      { system: "cloudBonus", id: 69, args: [5] },
      { system: "pristine", id: 3 },
      { system: "etcBonus", id: 91 },
      { system: "compMulti", id: 132, args: [1.5] },
      { system: "compMulti", id: 26, args: [1.3] },
      { system: "compMulti", id: 160, args: [1.5, 2] },
      { system: "compMulti", id: 50, args: [1.01, 2500] },
    ],
  },

  combine(pools: Record<string, Pool>): { val: number; children: CorganNode[] } {
    // Step 1: LUK scaling
    const lukVal = pools.base.items[0] ? pools.base.items[0].val : 0;
    const lukC = 1.4 * lukVal;

    // Step 2+3: additive pools.
    // N.js source (the in-game ground truth) at line 5611-5614 has:
    //   e = 1 + (1.4 * DropRateLUK + (talent279 + ... )) / 100
    // i.e. the 1.4*LUK term is INSIDE the /100 division alongside the
    // additives, not outside. Corgan and IdleonToolbox both use the
    // outside-the-/100 form (1.4*LUK + add/100 + 1), which is off from the
    // game by ~(1.4 * lukVal) units of base — about 0.3% on a fully geared
    // character. Matching N.js literally.
    const addSum = pools.addMain.sum + pools.addLUK2.sum;
    let base = 1 + (lukC + addSum) / 100;

    // Chip cap-break (only if base < 5)
    const chipPct = pools.chipDR.items[0] ? pools.chipDR.items[0].val : 0;
    let chipApplied = 0;
    if (base < 5 && chipPct > 0) {
      chipApplied = Math.min(5 - base, chipPct / 100);
      base += chipApplied;
    }

    // Step 4: Post-processing — interleaved flats/mults (game order)
    let dr = base;
    const pf = pools.postFlat.items;
    const pm = pools.postMult.items;

    dr += pf[0] ? pf[0].val : 0; // +bunV
    dr *= pm[0] ? pm[0].val : 1; // ×talent328
    dr += pf[1] ? pf[1].val : 0; // +ola232
    dr *= pm[1] ? pm[1].val : 1; // ×bunP

    for (let i = 2; i < pm.length; i++) {
      const item = pm[i];
      const v = item.val || 0;
      if (item.fmt === "x") {
        dr *= v;
      } else {
        dr *= 1 + v / 100;
      }
    }

    const postMult = base > 0 ? dr / base : 1;

    // Split Post-Processing into the two logically distinct phases the
    // formula actually applies:
    //   1. Initial Sequence (order-sensitive) — pf[0], pm[0], pf[1], pm[1]
    //      interleave +flat with ×mult, so reordering would change the
    //      result. Group only CONSECUTIVE same-system items (runs mode).
    //   2. Multiplier Chain (commutative) — pm[2..end] are all pure
    //      multipliers; order doesn't matter, so merge same-system items
    //      into one bucket each (merge mode).
    const initialItems: CorganNode[] = [];
    if (pf[0]) initialItems.push(pf[0]);
    if (pm[0]) initialItems.push(pm[0]);
    if (pf[1]) initialItems.push(pf[1]);
    if (pm[1]) initialItems.push(pm[1]);
    const chainItems = pm.slice(2);

    // Per-phase summary values (effective multiplier applied to base
    // before the next phase begins). Initial-phase math mirrors the
    // interleaved formula exactly; chain is a pure product of effective
    // multipliers.
    let drInitial = base;
    drInitial += pf[0] ? pf[0].val : 0;
    drInitial *= pm[0] ? pm[0].val : 1;
    drInitial += pf[1] ? pf[1].val : 0;
    drInitial *= pm[1] ? pm[1].val : 1;
    const initialMulti = base > 0 ? drInitial / base : 1;

    let chainMulti = 1;
    for (const it of chainItems) {
      const v = Number(it.val) || 0;
      chainMulti *= it.fmt === "x" ? v || 1 : 1 + v / 100;
    }

    // Merged additive pool — the formula sums addMain.sum + addLUK2.sum
    // before applying (lukC + addSum)/100, so the two pools are
    // mathematically a single bucket. Combine them into one "Additive
    // Pool" section so the tree matches the N.js arithmetic.
    const allAdditiveItems = [
      ...pools.addMain.items,
      ...pools.addLUK2.items,
    ];

    const children: CorganNode[] = [
      {
        name: "LUK Scaling",
        val: lukVal,
        children: pools.base.items[0]
          ? pools.base.items[0].children
          : undefined,
        fmt: "raw",
      },
      { name: "× 1.4", val: lukC, fmt: "raw", note: "1.4 × lukScaling" },
      {
        name: "Additive Pool",
        val: addSum,
        // Order doesn't matter for additive sums, so merge same-system
        // items across both source pools (addMain + addLUK2). One bucket
        // per system regardless of which legacy pool the item came from.
        children: categorizePoolItems(allAdditiveItems, "additive", "merge"),
        fmt: "+",
        note: "Σ all additive sources (formerly Main + LUK2 pools)",
      },
      {
        name: "Total Sum",
        val: base - chipApplied,
        fmt: "raw",
        note:
          "1 + (1.4·LUK + addSum)/100  =  1 + (" +
          lukC.toFixed(2) +
          " + " +
          addSum.toFixed(1) +
          ") / 100  — N.js formula",
      },
      {
        name: "Chip Cap-Break",
        val: chipApplied,
        children: pools.chipDR.items,
        fmt: "+",
        note:
          chipApplied > 0
            ? "Applies when base < 5×"
            : "Inactive (base ≥ 5× or no chip)",
      },
      {
        name: "Post-Processing",
        val: postMult,
        // Two phases — see split above. Initial section uses "runs" so the
        // formula's interleaved +flat / ×mult sequence stays readable;
        // chain section uses "merge" since pure multiplication is
        // commutative.
        children: [
          {
            name: "Initial Sequence",
            val: initialMulti,
            fmt: "x",
            note:
              "Order-sensitive: +flat / ×mult interleaved — base + bunV, ×talent328, +ola232, ×bunP",
            children: categorizePoolItems(
              initialItems,
              "multiplicative",
              "runs"
            ),
          },
          {
            name: "Multiplier Chain",
            val: chainMulti,
            fmt: "x",
            note: "Pure × chain — order commutative, same-system items merged",
            children: categorizePoolItems(
              chainItems,
              "multiplicative",
              "merge"
            ),
          },
        ],
        fmt: "x",
      },
    ];

    return { val: dr, children };
  },
};

export default dropRateDesc;
