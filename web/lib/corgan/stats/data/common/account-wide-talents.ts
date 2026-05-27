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
 *  Source: IT's parsers/* calls to getHighestTalentByClass. */
export const ACCOUNT_WIDE_TALENT_IDS = new Set<number>([
  49,  // Enhancement Eclipse — Voidwalker
  50,  // Power Orb — Voidwalker
  55,  // EXP Cultivation — Voidwalker
  56,  // Voodoo Statufication — Voidwalker
  58,  // Master Of The System — Voidwalker
  59,  // Blood Marrow — Voidwalker
  144, // The Family Guy — Beast Master / Divine Knight / Siege Breaker
  177, // Bitty Litty — Divine Knight
  207, // Dank Ranks — Death Bringer
  208, // Wraith Overlord — Death Bringer
  209, // Apocalypse Wow — Death Bringer
  325, // Unending Loot Search — Siege Breaker
  326, // Expertly Sailed — Siege Breaker
  328, // Archlord Of The Pirates — Siege Breaker
  372, // Shining Beacon Of Egg — Beast Master
  429, // Shiny Medallions — Wind Walker
  431, // Sneaky Skilling — Wind Walker
  432, // Generational Gemstones — Wind Walker
  433, // Dustwalker — Wind Walker
  434, // Slayer Abominator — Wind Walker
  475, // Charge Syphon — Wizard
  506, // Shared Beliefs — Elemental Sorcerer
  507, // Gods Chosen Children — Elemental Sorcerer
  508, // Wormhole Emperor — Elemental Sorcerer
  536, // Green Tube — Bubonic Conjuror
  589, // Overwhelming Energy — Arcane Cultist
  596, // Passion Of The Summon — Arcane Cultist
  598, // Tachyon Truth — Arcane Cultist
  // Symbols of Beyond — add bonus levels to every talent via ATL chain,
  // also propagates account-wide (different mechanism than getbonus2
  // but still affects all chars).
  149, // Symbols of Beyond ~R — Maestro
  374, // Symbols of Beyond ~L — W5 variant
  539, // Symbols of Beyond ~P — Bubonic Conjuror
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
