// ===== ACCOUNT-WIDE TALENT REGISTRY =====
// Talents whose bonus applies to the ENTIRE account (cross-character),
// computed via the in-game getbonus2(line, id, -1) call which scans every
// character and uses the highest contributor. The ids are generated from
// N.js (account-wide-talents.gen.ts, scripts/gen-account-wide-talents.ts).
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
// This file lives in arkh/ (not talentsLevel/) so talent.resolve can
// auto-detect account-wide ids and switch to mode="max" without the
// caller having to opt in. /talents-level and /drop-rate then share
// the same compute path.

import { GETBONUS2_BEST_ACROSS_CHARS_IDS } from "./account-wide-talents.gen";

/** Read best-across-characters by N.js only in a special case, so the
 *  auto-max emit would mislead:
 *  - 144 (The Family Guy): _customBlock_TalentCalc boosts a family bonus by
 *    GetTalentNumber(1,144) — the ACTIVE char's own 144, only when that char
 *    gives the bonus (CalcTalentDT1 == UserInfo[0]). getbonus2(1,144,-1)
 *    (best across chars) is used only for family bonuses "24" and "44". */
const PER_CHAR_IN_GENERAL = new Set<number>([144]);

/** Talent ids that the game treats as account-wide via getbonus2. The
 *  bonus applies cross-character based on the best owner-class char. */
export const ACCOUNT_WIDE_TALENT_IDS = new Set<number>(
  GETBONUS2_BEST_ACROSS_CHARS_IDS.filter((id) => !PER_CHAR_IN_GENERAL.has(id))
);

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
