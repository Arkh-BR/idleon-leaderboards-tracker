// ===== TALENT CAP BOOSTERS =====
// Some "target" talents have a HARDCODED low base cap (typically 100) but
// get raised by other talents' x/y bonuses. The boosters are documented
// in the source talent's description text (e.g. ETERNAL_STR's desc:
// "Also +} max LV to 'Fist_of_Rage'").
//
// Discovered via empirical match against SkillLevelsMAX (SM_{ci}[id]) from
// real saves — for a target talent, SM[id] = baseCap + Σ booster
// contributions. Once we mirror the formula, the in-game cap shown on
// /talents-level matches what the player sees in the talent tooltip.
//
// Two scopes:
//   - "account-wide": cross-char max — pick the best owner-class char and
//     use their bonus. ETERNAL_STR/AGI/WIS/LUK propagate across the
//     account for their Max LV effect, even though IT's
//     `getHighestTalentByClass` doesn't list them (the Max LV mechanic
//     uses a different game path than getbonus2). Implemented via
//     talent.resolve(srcId, ctx, { tab, mode: "max" }).
//   - "per-char": the active char's own investment in the source talent.
//     Implemented via talent.resolve(srcId, ctx, { tab }) — falls through
//     to the default per-char branch.
//
// "kind: 'y'" means use the source talent's Y-bonus (funcY/y1/y2 params);
// "kind: 'x'" means the X-bonus (funcX/x1/x2). Resolved at runtime by
// passing tab: 2 (y) or omitting tab (x) to talent.resolve.

export type CapBoosterScope = "account-wide" | "per-char";

/** Optional alchemy-bubble clamp applied to a single booster's contribution.
 *  Mirrors N.js `Math.min(GetTalentNumber(1, src), CauldronInfo[chap][slot])`
 *  — the booster's effect is capped by the BUBBLE LEVEL (raw integer Lv),
 *  not its computed % value. */
export type BubbleCap = {
  /** 0=W1, 1=W2, 2=W3, 3=W4 — index into CauldronInfo. */
  chapter: number;
  /** Bubble slot inside the chapter's cauldron. */
  slot: number;
  /** Friendly bubble name for the breakdown row note. */
  bubbleLabel: string;
};

export type CapBoosterSpec = {
  /** Source talent whose bonus contributes max LV to the target. */
  sourceTalent: number;
  /** Which of the source talent's two bonus formulas to use. */
  kind: "x" | "y";
  /** Whether the source's effect is shared across the account (best owner-
   *  class char wins) or only applies on the source char itself. */
  scope: CapBoosterScope;
  /** Display label for the breakdown row under "Max Book Lv Cap". */
  label: string;
  /** When present, clamp this booster's value to the bubble's level
   *  (CauldronInfo[chapter][slot]). Replicates the in-game "Each Lv of
   *  '<bubble>' raises max Lv of '<talent>', up to +{" pattern. */
  bubbleCap?: BubbleCap;
};

export type CapBoosterEntry = {
  /** The hardcoded base cap for this target talent — 100 for the stat-
   *  style targets we've mapped so far. Replaces maxBookLv as the base
   *  when this entry is present. */
  baseCap: number;
  boosters: CapBoosterSpec[];
  /** When true, the computed cap is taken as max(formula, savedSM[id]).
   *  Mirrors N.js: SkillLevelsMAX ratchets UPWARD only — once a bubble
   *  was leveled high, the cap stays even if the bubble is unleveled.
   *  Used for the 7 bubble-capped targets (79, 86, 87, 266, 267, 446,
   *  447); the stat targets (10/11/12/23/75) reassign without max(). */
  ratchet?: boolean;
};

/** Targets that don't have a registry entry use maxBookLv (the standard
 *  account-wide cap formula) as their cap with no boosters. */
export const TALENT_CAP_BOOSTERS: Record<number, CapBoosterEntry> = {
  // Tal 10 (FIST_OF_RAGE) — STR stat talent. Verified 100% match against
  // SkillLevelsMAX across all 10 chars in our ref save.
  10: {
    baseCap: 100,
    boosters: [
      { sourceTalent: 51, kind: "y", scope: "account-wide", label: "Eternal STR (Tal 51 y-bonus)" },
      { sourceTalent: 81, kind: "x", scope: "per-char", label: "Str Summore (Tal 81 x-bonus)" },
      { sourceTalent: 143, kind: "y", scope: "per-char", label: "Overblown Testosterone (Tal 143 y-bonus)" },
    ],
  },
  // Tal 11 (QUICKNESS_BOOTS) — AGI stat talent. Verified.
  11: {
    baseCap: 100,
    boosters: [
      { sourceTalent: 52, kind: "y", scope: "account-wide", label: "Eternal AGI (Tal 52 y-bonus)" },
      { sourceTalent: 293, kind: "x", scope: "per-char", label: "Agi Again (Tal 293 x-bonus)" },
      { sourceTalent: 368, kind: "y", scope: "per-char", label: "Adaptation Revelation (Tal 368 y-bonus)" },
    ],
  },
  // Tal 12 (BOOK_OF_THE_WISE) — WIS stat talent. Verified.
  12: {
    baseCap: 100,
    boosters: [
      { sourceTalent: 53, kind: "y", scope: "account-wide", label: "Eternal WIS (Tal 53 y-bonus)" },
      { sourceTalent: 488, kind: "x", scope: "per-char", label: "Wis Wumbo (Tal 488 x-bonus)" },
      { sourceTalent: 533, kind: "y", scope: "per-char", label: "Utmost Intellect (Tal 533 y-bonus)" },
    ],
  },
  // Tal 23 (LUCKY_HORSESHOE) — LUK stat talent (Journeyman tab). Verified.
  // Note: ETERNAL_LUK targets THIS talent (not LUCKY_CLOVER), per its
  // description string "Also +} max LV to 'Lucky_Horseshoe'".
  23: {
    baseCap: 100,
    boosters: [
      { sourceTalent: 54, kind: "y", scope: "account-wide", label: "Eternal LUK (Tal 54 y-bonus)" },
      { sourceTalent: 38, kind: "y", scope: "per-char", label: "Bliss N Chips (Tal 38 y-bonus)" },
    ],
  },
  // Tal 75 (HAPPY_DUDE). Verified.
  75: {
    baseCap: 100,
    boosters: [
      { sourceTalent: 38, kind: "x", scope: "per-char", label: "Bliss N Chips (Tal 38 x-bonus)" },
    ],
  },

  // ===== Bubble-capped targets (N.js Padrão B) =====
  // Pattern: SM[K] = max(100 + min(GTN(1, src), CauldronInfo[chap][slot]), SM[K])
  // The booster's contribution is hard-clamped by the alchemy bubble's
  // LEVEL (not its % value). The outer max() with the saved SM means the
  // cap never decreases — ratchet=true mirrors that.

  // Tal 79 (SLEEPIN_ON_THE_JOB). N.js: max(100 + min(GTN(1,39), CauldronInfo[3][0]), 100).
  // Inner max is 100, not the saved SM — but the outer SM[79] clamp on the
  // assignment line means cap still ratchets if SM was previously higher.
  79: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 39,
        kind: "x",
        scope: "per-char",
        label: "Colloquial Containers (Tal 39 x-bonus)",
        bubbleCap: { chapter: 3, slot: 0, bubbleLabel: "Lotto Skills (W4 bubble [3][0])" },
      },
    ],
  },
  // Tal 86 (MEAT_SHANK).
  86: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 129,
        kind: "x",
        scope: "per-char",
        label: "Blocky Bottles (Tal 129 x-bonus)",
        bubbleCap: { chapter: 0, slot: 1, bubbleLabel: "Warriors Rule (W1 bubble [0][1])" },
      },
    ],
  },
  // Tal 87 (CRITIKILL).
  87: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 114,
        kind: "x",
        scope: "per-char",
        label: "Beefy Bottles (Tal 114 x-bonus)",
        bubbleCap: { chapter: 0, slot: 1, bubbleLabel: "Warriors Rule (W1 bubble [0][1])" },
      },
    ],
  },
  // Tal 266 (FEATHERWEIGHT).
  266: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 294,
        kind: "x",
        scope: "per-char",
        label: "Velocity Vessels (Tal 294 x-bonus)",
        bubbleCap: { chapter: 1, slot: 1, bubbleLabel: "Archer or Bust (W2 bubble [1][1])" },
      },
    ],
  },
  // Tal 267 (I_SEE_YOU).
  267: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 309,
        kind: "x",
        scope: "per-char",
        label: "Visibility Vessels (Tal 309 x-bonus)",
        bubbleCap: { chapter: 1, slot: 1, bubbleLabel: "Archer or Bust (W2 bubble [1][1])" },
      },
    ],
  },
  // Tal 446 (OVERCLOCKED_ENERGY).
  446: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 474,
        kind: "x",
        scope: "per-char",
        label: "Fuscia Flasks (Tal 474 x-bonus)",
        bubbleCap: { chapter: 2, slot: 1, bubbleLabel: "Mage is Best (W3 bubble [2][1])" },
      },
    ],
  },
  // Tal 447 (FARSIGHT).
  447: {
    baseCap: 100,
    ratchet: true,
    boosters: [
      {
        sourceTalent: 489,
        kind: "x",
        scope: "per-char",
        label: "Fantasia Flasks (Tal 489 x-bonus)",
        bubbleCap: { chapter: 2, slot: 1, bubbleLabel: "Mage is Best (W3 bubble [2][1])" },
      },
    ],
  },
};

/** Convenience predicate. */
export function hasTalentCapBoosters(targetTalentId: number): boolean {
  return targetTalentId in TALENT_CAP_BOOSTERS;
}
