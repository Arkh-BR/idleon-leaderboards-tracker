// ===== ACCOUNT-WIDE TALENT REGISTRY =====
// Talents whose bonus applies to the ENTIRE account (cross-character),
// computed via the in-game getbonus2(line, id, -1) call which scans every
// character and uses the highest contributor. The ids are generated from
// N.js (account-wide-talents.gen.ts, scripts/gen-account-wide-talents.ts).
//
// getbonus2(d, id, -1) @7987852 reads every character's own level of the talent and keeps the highest curve value. For an id from 100 on, each
// character g also gets AllTalentLVz("id|g") @4085148, whose super-talent term reads both presets of g (Spelunk[20 + g] and Spelunk[32 + g]):
// the super levels DO propagate into these talents. The page reads them through lib/game's getbonus2 (lib/game/njs/getbonus2.ts).

import { GETBONUS2_BEST_ACROSS_CHARS_IDS } from "@/lib/game/data/generated/account-wide-talents.gen";

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
