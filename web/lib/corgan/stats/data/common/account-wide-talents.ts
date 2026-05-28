// ===== ACCOUNT-WIDE TALENT REGISTRY =====
// Talents whose bonus applies to the ENTIRE account (cross-character),
// computed via the in-game getbonus2(1, id, -1) call which scans every
// character and uses the highest contributor.
//
// Sourced from IT's parsers — every call to getHighestTalentByClass
// represents a talent that the game treats as account-wide. The class
// in the call is the "owner class" (you need a char of that class to
// activate the bonus).
//
// IMPORTANT — Super Talent does NOT propagate via these talents.
// N.js line 5415's _customBlock_RunCodeOfTypeXforThingY("AllTalentLVz")
// reads the Spelunk super array using the ACTIVE character's index AND
// preset:
//   Spelunk[20 + UserInfo[0].idx + 12 * PlayerStuff[1]]
// AND the getbonus2(1, id, -1) call at N.js line 12551 passes the
// talent's rawLv (not its talentIdx) as the lookup key into that array
// — Spelunk[...].indexOf(rawLv) almost never finds a hit, so super
// contribution is effectively zero in cross-char queries.
//
// This file lives in corgan/ (not talentsLevel/) so talent.resolve can
// auto-detect account-wide ids and switch to mode="max" without the
// caller having to opt in. /talents-level and /drop-rate then share
// the same compute path.

/** Talent ids that the game treats as account-wide via getbonus2. The
 *  bonus applies cross-character based on the best owner-class char.
 *  Source: IT's parsers/* calls to getHighestTalentByClass, cross-
 *  verified against every `_customBlock_getbonus2(N, id, -1)` call in
 *  N.js (see web/scripts/check-talent-caps.ts companion audit).
 *
 *  EXCLUDED — talents that LOOK like they could be account-wide
 *  (N.js does call getbonus2 on them in some spot) but the SEMANTIC
 *  effect is per-char, so the auto-max emit would mislead the user:
 *
 *  - 144 (The Family Guy): N.js calls `getbonus2(1,144,-1)` to read
 *    the best 144 lv when computing Family Bonus 68 (the FB68 chain
 *    multiplier reads the highest 144). BUT the resulting bonus only
 *    applies to the char that HAS Tal 144 itself — every char has 144
 *    in tab 4, and each char's instance only boosts that char's own
 *    Family Bonus. Cross-char emit would say "ARKHELUCK gives +X"
 *    when actually only that char benefits, so we keep it per-char.
 *  - 149/374/539 (Symbols of Beyond ~R/~L/~P): adds bonus levels to
 *    the OWNER char's talents via the ATL chain — does NOT propagate
 *    to other chars. The ATL chain reads Symbols off the ACTIVE char's
 *    save, so each char sees only its own Symbols contribution.
 *  - 475 (Charge Syphon): active skill — temporarily steals worship
 *    charge from other chars when triggered. Not a passive cross-char
 *    bonus the way Eternal STR or Archlord are; treating it as auto-
 *    max would create a meaningless "Reference Character" view since
 *    the effect isn't continuously contributed by any one char. */
export const ACCOUNT_WIDE_TALENT_IDS = new Set<number>([
  49,  // Enhancement Eclipse — Voidwalker
  50,  // Power Orb — Voidwalker
  51,  // Eternal STR — Voidwalker (Base STR += getbonus2(1,51,-1) on every char)
  52,  // Eternal AGI — Voidwalker (Base AGI)
  53,  // Eternal WIS — Voidwalker (Base WIS)
  54,  // Eternal LUK — Voidwalker (Base LUK)
  55,  // EXP Cultivation — Voidwalker
  56,  // Voodoo Statufication — Voidwalker
  57,  // Species Epoch — Voidwalker
  58,  // Master Of The System — Voidwalker
  59,  // Blood Marrow — Voidwalker
  176, // 1000 Hours Played — Divine Knight (Gaming EXP "for all characters!")
  177, // Bitty Litty — Divine Knight
  178, // King Of The Remembered — Divine Knight (Printer Output × log(OLA[138]) wrap — see talent-final-bonus-wraps)
  204, // Ribbon Winning — Death Bringer
  205, // Mass Irrigation — Death Bringer
  206, // Agricultural 'Preciation — Death Bringer (Farming + Land Rank EXP, "Works on all characters!")
  207, // Dank Ranks — Death Bringer
  208, // Wraith Overlord — Death Bringer
  209, // Apocalypse Wow — Death Bringer
  325, // Unending Loot Search — Siege Breaker
  326, // Expertly Sailed — Siege Breaker
  327, // Captain Peptalk — Siege Breaker
  328, // Archlord Of The Pirates — Siege Breaker (same shape as Tal 178: × log(OLA[139] Plunderous Kills) wrap)
  370, // Arena Spirit — Beast Master (breeding, funcY)
  372, // Shining Beacon Of Egg — Beast Master
  373, // Curviture Of The Paw — Beast Master (pet bonus multiplier)
  429, // Shiny Medallions — Wind Walker
  430, // Price Recession — Wind Walker
  431, // Sneaky Skilling — Wind Walker
  432, // Generational Gemstones — Wind Walker
  433, // Dustwalker — Wind Walker
  434, // Slayer Abominator — Wind Walker
  505, // Polytheism — Elemental Sorcerer (Divinity multiplier)
  506, // Shared Beliefs — Elemental Sorcerer
  507, // Gods Chosen Children — Elemental Sorcerer
  508, // Wormhole Emperor — Elemental Sorcerer
  535, // Purple Tube — Bubonic Conjuror
  536, // Green Tube — Bubonic Conjuror
  585, // Arcanist Form — Arcane Cultist (gates a map-specific effect cross-char)
  589, // Overwhelming Energy — Arcane Cultist
  595, // Essential Essence — Arcane Cultist (upgrade cost reducer)
  596, // Passion Of The Summon — Arcane Cultist
  597, // Absolute Stardom — Arcane Cultist (summoning upgrade multiplier)
  598, // Tachyon Truth — Arcane Cultist
]);

/** Convenience predicate — true when the talent's bonus applies
 *  account-wide via the in-game getbonus2 cross-character scan. */
export function isAccountWideTalent(talentId: number): boolean {
  return ACCOUNT_WIDE_TALENT_IDS.has(talentId);
}

/** No talents currently need to skip the auto-max emit.
 *  - Tal 328 (Archlord) used to have a Plunderous Kills × wrapper
 *    branch here, but that's a DR-specific application and now lives
 *    in the `workshop` wrapper (the only caller that needs it).
 *  - Tal 655 is a star talent (id >= 615), handled by the dedicated
 *    star-talent branch later in talent.resolve — it's not in
 *    ACCOUNT_WIDE_TALENT_IDS so auto-max never fires for it anyway.
 *  Left as an empty Set so future special-case talents can be added
 *  without re-plumbing the gate. */
export const ACCOUNT_WIDE_SPECIAL_BRANCH_IDS = new Set<number>([]);
