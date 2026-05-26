// ===== DROP RATE DESCRIPTOR =====
// 1:1 port of corgan-source/js/stats/defs/drop-rate.js.

import type { Descriptor, Pool } from "../tree-builder";
import type { CorganNode } from "../../node";
import { categorizePoolItems, decorateSystem } from "../categorize";

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

    // The N.js post-processing formula applies four order-sensitive ops to
    // `base` BEFORE the pure-mult chain begins:
    //
    //   dr  = base
    //   dr += pf[0]   // +bunV   (Death Bringer Bundle, +2 flat)
    //   dr *= pm[0]   // ×Archlord Of The Pirates (Talent 328)
    //   dr += pf[1]   // +ola232 (Sneaking — Pristine Charm, +0.3 flat)
    //   dr *= pm[1]   // ×bunP   (Explorer Bundle, ×1.2)
    //   for i in pm[2..]:
    //     dr *= effective-multiplier(pm[i])
    //
    // Group those four into a "Post-Processing" wrapper whose children
    // read in formula order:
    //   + bunV  →  ×Talent  →  + Pristine  →  Multiplier Chain.
    // The remaining pm[1..] all multiply, so they collapse into a single
    // "Multiplier Chain" bucket where same-system items merge freely.

    // Merged additive pool — the formula sums addMain.sum + addLUK2.sum
    // before applying (lukC + addSum)/100, so the two pools are
    // mathematically a single bucket. Combine them into one "Additive
    // Pool" section.
    const allAdditiveItems = [
      ...pools.addMain.items,
      ...pools.addLUK2.items,
    ];

    // Chain items = pm[1] (Explorer Bundle) + pm[2..end]. Now hoisted to
    // Post-Processing siblings by game system (no more "Multiplier Chain"
    // wrapper) — Post-Processing's headline val (dr / base) carries the
    // overall chain multiplier, so no need to precompute the product.
    const chainItems = pm.slice(1);

    // The three hoisted pre-chain items — each rendered as a 1-item
    // system bucket (Bundles / Talents / Sneaking Mastery) so the visual
    // matches the additive-pool style.
    const wrapInBucket = (
      item: CorganNode | undefined,
      bucketName: string,
      bucketFmt: "+" | "x"
    ): CorganNode | null => {
      if (!item) return null;
      // For the additive flats (bun_v +2, ola232 +0.3), bucket val = the
      // flat add. For the multiplicative talent, bucket val = the factor.
      const val =
        bucketFmt === "x"
          ? Number(item.val) || 1
          : Number(item.val) || 0;
      return {
        name: bucketName,
        val,
        fmt: bucketFmt,
        children: [item],
      };
    };
    // Bucket names use the SYSTEM_EMOJI decoration so they line up with the
    // categorized buckets in the Additive Pool / chain output. "Sneaking
    // Mastery" gets the ninja emoji since the category itself is keyed as
    // "Sneaking / OLA".
    const bunVBucket = wrapInBucket(pf[0], decorateSystem("Bundles"), "+");
    const talentBucket = wrapInBucket(pm[0], decorateSystem("Talents"), "x");
    // ola 232 is the Sneaking Mastery completion bonus (not a Pristine
    // Charm — earlier label was wrong).
    const olaBucket = wrapInBucket(pf[1], "🥷 Sneaking Mastery", "+");

    // LUK Scaling — collapse the previous standalone "× 1.4" sibling INTO
    // this wrapper so the section reads top-to-bottom as the math chain:
    //   🍀 Total LUK  →  curve  →  × 1.4  =  lukC (contribution to addSum).
    // Parent val = lukC so the headline matches what actually feeds the
    // Additive Pool, not the pre-×1.4 luk curve.
    const lukScalingChildren: CorganNode[] = pools.base.items[0]?.children
      ? [...pools.base.items[0].children]
      : [];
    lukScalingChildren.push({
      name: "× 1.4",
      val: lukC,
      fmt: "raw",
      note: "1.4 × lukScaling",
    });

    const children: CorganNode[] = [
      {
        name: "LUK Scaling",
        val: lukC,
        children: lukScalingChildren,
        fmt: "raw",
        // Closed by default — the headline value already tells the user
        // what LUK contributes (lukC ≈ 1.115 for a fully geared char);
        // the curve breakdown inside is reference material, not what they
        // scan for. Matches the categorize-bucket pattern.
        defaultClosed: true,
        note: "Total LUK → curve → × 1.4 = contribution to additive sum",
      },
      {
        name: "Additive Pool",
        val: addSum,
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
        // Collapse by default — most characters have base ≥ 5× so this row
        // sits inactive and would just take vertical space next to the
        // Additive Pool / Post-Processing sections that the user actually
        // wants to scan. Matches the categorize-bucket pattern (Talents /
        // Cards / etc. all default-closed).
        defaultClosed: true,
        note:
          chipApplied > 0
            ? "Applies when base < 5×"
            : "Inactive (base ≥ 5× or no chip)",
      },
      // Post-Processing flow, top-to-bottom:
      //   1) + Death Bringer Bundle (flat add)
      //   2) × Archlord Of The Pirates (Talent 328)
      //   3) + Sneaking Completions (Sneaking Mastery, flat add)
      //   4+) Every remaining ×mult — Explorer Bundle through the rest of
      //       pm[], collapsed by game system. These are pure × operations,
      //       commutative within the chain, so each category bucket lands
      //       directly under Post-Processing instead of being nested in a
      //       "Multiplier Chain" wrapper.
      {
        // Headline = effective multiplier the Post-Processing block applies
        // to (Total Sum + Chip Cap-Break) to reach the final DR. `base` at
        // this point already includes chipApplied, so dr / base is the right
        // ratio.
        name: "Post-Processing",
        val: base > 0 ? dr / base : 1,
        fmt: "x",
        note: "Applied to Total Sum (and Chip Cap-Break if active)",
        children: [
          ...(bunVBucket
            ? [
                {
                  ...bunVBucket,
                  note: "Added to Total Sum",
                },
              ]
            : []),
          ...(talentBucket
            ? [
                {
                  ...talentBucket,
                  note: "Multiplies the running total",
                },
              ]
            : []),
          ...(olaBucket
            ? [
                {
                  ...olaBucket,
                  note: "Added to the running total",
                },
              ]
            : []),
          ...categorizePoolItems(chainItems, "multiplicative", "merge"),
        ],
      },
    ];

    return { val: dr, children };
  },
};

export default dropRateDesc;
