// ===== TALENTS LEVEL ENTRY POINT =====
// Loads a raw "Copy for Support" envelope, picks a single talent on a single
// character, and returns the FULL talent CorganNode so the UI can render
// every contributor (Active flag, Level / Effective Level breakdown, formula
// note, multipliers like Plunderous Kills, etc.) — not just the Effective
// Level subtree.

import { loadSaveData } from "../corgan/save/loader";
import { saveData } from "../corgan/state";
import { talent } from "../corgan/stats/systems/common/talent";
import { entityName } from "../corgan/stats/entity-names";
import type { CorganNode } from "../corgan/node";

export type TalentLevelResult = {
  /** Full talent CorganNode — Active flag + Effective Level (Base + Bonus)
   *  for tab 1-5 talents, or the talent's specialized shape (Tal 328's
   *  Plunderous-Kills branch, Tal 655's Per-Skull × Skulls, every other
   *  star talent's Active + Level + formula). The headline value is
   *  `tree.val` = the bonus the talent actually contributes. */
  tree: CorganNode;
  /** Talent id (echoed for convenience). */
  talentId: number;
  /** Friendly name from ENTITY_NAMES (or "" if no mapping). */
  talentName: string;
};

export type TalentEffectiveOpts = {
  /** Mirrors ComputeDROpts.useMaxResearchBaseLevel — irrelevant to this
   *  page in practice (we always want actual values here so Base + Bonus =
   *  Effective Level), but exposed so future research scenarios can opt in
   *  without re-plumbing the ctx. Default false. */
  useMaxResearchBaseLevel?: boolean;
};

export function computeTalentEffective(
  rawEnvelope: any,
  charIdx: number,
  talentId: number,
  opts?: TalentEffectiveOpts
): TalentLevelResult {
  loadSaveData(rawEnvelope);
  const ctx = {
    saveData,
    charIdx,
    activeCharIdx: charIdx,
    useMaxResearchBaseLevel: !!opts?.useMaxResearchBaseLevel,
  };
  const tree = talent.resolve(talentId, ctx);
  return {
    tree,
    talentId,
    talentName: entityName("talent", talentId),
  };
}
