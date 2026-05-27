// ===== TALENTS LEVEL ENTRY POINT =====
// Loads a raw "Copy for Support" envelope, picks a single talent on a single
// character, and returns the "Effective Level" subtree (Base Level +
// Bonus Levels) so the UI can render it identically to the DR page tree.
//
// Mirrors web/lib/corgan/computeDR.ts but exits early — we don't traverse the
// drop-rate descriptor, we just resolve one `talent` source directly.

import { loadSaveData } from "../corgan/save/loader";
import { saveData } from "../corgan/state";
import { talent } from "../corgan/stats/systems/common/talent";
import { entityName } from "../corgan/stats/entity-names";
import type { CorganNode } from "../corgan/node";

export type TalentLevelResult = {
  /** The "Effective Level" CorganNode, with Base Level + Bonus Levels kids.
   *  Null when the talent has no level / no breakdown to show on this char
   *  (e.g. talent never invested AND no bonus levels stack on it). */
  tree: CorganNode | null;
  /** Full talent node (parent of Effective Level) — kept for callers that
   *  want the talent's final value, formula note, or Active flag. */
  full: CorganNode;
  /** Talent id (echoed for convenience). */
  talentId: number;
  /** Friendly name from ENTITY_NAMES (or "" if no mapping). */
  talentName: string;
};

/** Locate the Effective Level child inside a talent's resolved tree. The
 *  talent resolver emits its children differently depending on which path
 *  fired (default emit, Tal 328 special, Tal 655 star — Tal 655 has no
 *  Effective Level node at all). Returns null when not found. */
function findEffectiveLevel(node: CorganNode): CorganNode | null {
  if (!node.children) return null;
  for (const c of node.children) {
    if (c.name === "Effective Level") return c;
    // Tal 328 nests Effective Level one layer deeper (under "Talent Value")
    if (c.children) {
      const nested = findEffectiveLevel(c);
      if (nested) return nested;
    }
  }
  return null;
}

export type TalentEffectiveOpts = {
  /** Mirrors ComputeDROpts.useMaxResearchBaseLevel — irrelevant to this
   *  page in practice (we always want actual values here so Base + Bonus =
   *  Effective Level), but exposed so future research scenarios can opt
   *  in without re-plumbing the ctx. Default false. */
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
  const full = talent.resolve(talentId, ctx);
  const tree = findEffectiveLevel(full);
  return {
    tree,
    full,
    talentId,
    talentName: entityName("talent", talentId),
  };
}
