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
};

export type CapBoosterEntry = {
  /** The hardcoded base cap for this target talent — 100 for the stat-
   *  style targets we've mapped so far. Replaces maxBookLv as the base
   *  when this entry is present. */
  baseCap: number;
  boosters: CapBoosterSpec[];
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

  // TODO: bubble-capped boosters — these target talents are boosted by
  // a source talent BUT the contribution is clamped by an alchemy bubble
  // level (e.g. "Each Lv of 'Lotto Skills' Bubble raises max Lv of
  // 'Sleepin On The Job', up to +{"). Adding them requires reading the
  // bubble level from the save and applying a min() cap.
  //
  //   79  SLEEPIN_ON_THE_JOB ← 39 COLLOQUIAL_CONTAINERS (capped by Lotto Skills bubble)
  //   86  MEAT_SHANK         ← 129 BLOCKY_BOTTLES        (capped by Warriors Rule bubble)
  //   87  CRITIKILL          ← 114 BEEFY_BOTTLES         (capped by Warriors Rule bubble)
  //   266 FEATHERWEIGHT      ← 294 VELOCITY_VESSELS      (capped by Archer or Bust bubble)
  //   267 I_SEE_YOU          ← 309 VISIBILITY_VESSELS    (capped by Archer or Bust bubble)
  //   446 OVERCLOCKED_ENERGY ← 474 FUSCIA_FLASKS         (capped by Mage is Best bubble)
  //   447 FARSIGHT           ← 489 FANTASIA_FLASKS       (capped by Mage is Best bubble)
};

/** Convenience predicate. */
export function hasTalentCapBoosters(targetTalentId: number): boolean {
  return targetTalentId in TALENT_CAP_BOOSTERS;
}
