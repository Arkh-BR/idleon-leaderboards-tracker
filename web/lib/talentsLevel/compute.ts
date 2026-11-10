// ===== TALENTS LEVEL ENTRY POINT =====
// Loads a raw "Copy for Support" envelope, picks a single talent on a single
// character, and returns the FULL talent ArkhNode so the UI can render
// every contributor (Active flag, Level / Effective Level breakdown, formula
// note, multipliers like Plunderous Kills, etc.) — not just the Effective
// Level subtree.

import { computeGameTalent } from "@/lib/game/trackers/talents";
import type { ArkhNode } from "@/lib/dropRate/node";
import { entityName } from "./entityNames";

export type TalentLevelResult = {
  /** Full talent ArkhNode — Active flag + Effective Level (Base + Bonus)
   *  for tab 1-5 talents, or the talent's specialized shape (Tal 328's
   *  Plunderous-Kills branch, Tal 655's Per-Skull × Skulls, every other
   *  star talent's Active + Level + formula). The headline value is
   *  `tree.val` = the bonus the talent actually contributes. */
  tree: ArkhNode;
  /** Talent id (echoed for convenience). */
  talentId: number;
  /** Friendly name from ENTITY_NAMES (or "" if no mapping). */
  talentName: string;
};

export type TalentEffectiveOpts = {
  /** Which talent preset (0 = Preset 1, 1 = Preset 2) to view. When
   *  omitted or equal to the char's currently-active preset (read from
   *  PlayerStuff_{ci}[1]), the standard SL_{ci} talent levels are used.
   *  When set to the OTHER preset, this helper swaps SLpre_{ci} into
   *  saveData.skillLvData[charIdx] and patches playerStuffData[charIdx][1]
   *  so the Spelunk Super Talent lookup also targets the right preset. */
  presetIdx?: 0 | 1;
  /** Treat the talent as the active Spelunk Super Talent even when it isn't
   *  in the super slot — used by the /talents Hypothetical tab so the Super
   *  Levels row is always counted. Default false. */
  forceSuperActive?: boolean;
};

/** Parse a save field that might be a raw JSON string or an already-
 *  parsed object/array. The "Copy for Support" payload stringifies most
 *  per-char fields (PlayerStuff_{ci}, SL_{ci}, SLpre_{ci}, …) but in some
 *  test envelopes they arrive pre-parsed. */
function readField(rawData: any, key: string): any {
  const v = rawData?.[key];
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
}

/** Pull the active preset index for a char straight from the raw save's
 *  PlayerStuff_{ci}[1]. Defaults to 0 (Preset 1) when the field is
 *  missing or malformed. */
export function getActivePresetIdx(rawEnvelope: any, charIdx: number): 0 | 1 {
  const data = rawEnvelope?.data ?? rawEnvelope;
  const stuff = readField(data, `PlayerStuff_${charIdx}`);
  if (Array.isArray(stuff) && (stuff[1] === 0 || stuff[1] === 1)) {
    return stuff[1] as 0 | 1;
  }
  return 0;
}

export function computeTalentEffective(
  rawEnvelope: any,
  charIdx: number,
  talentId: number,
  opts?: TalentEffectiveOpts
): TalentLevelResult {
  return {
    tree: computeGameTalent(rawEnvelope, charIdx, talentId, opts),
    talentId,
    talentName: entityName("talent", talentId),
  };
}

/**
 * Resolve many talents across many chars on one save (the state is cached per
 * save by lib/game) — used by the top-talents collector. Uses each char's
 * active preset. Talents that fail to resolve are skipped.
 */
export function computeTalentTreesForChars(
  rawEnvelope: any,
  jobs: { charIdx: number; talentIds: number[] }[],
  opts?: { forceSuperActive?: boolean }
): { charIdx: number; trees: Map<number, ArkhNode> }[] {
  return jobs.map((job) => {
    const trees = new Map<number, ArkhNode>();
    for (const id of job.talentIds) {
      try {
        trees.set(id, computeGameTalent(rawEnvelope, job.charIdx, id, { forceSuperActive: opts?.forceSuperActive }));
      } catch {
        // skip talents that error for this char's context
      }
    }
    return { charIdx: job.charIdx, trees };
  });
}
