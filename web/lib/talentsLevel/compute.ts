// ===== TALENTS LEVEL ENTRY POINT =====
// Loads a raw "Copy for Support" envelope, picks a single talent on a single
// character, and returns the FULL talent CorganNode so the UI can render
// every contributor (Active flag, Level / Effective Level breakdown, formula
// note, multipliers like Plunderous Kills, etc.) — not just the Effective
// Level subtree.

import { loadSaveData } from "../corgan/save/loader";
import { saveData } from "../corgan/state";
import {
  skillLvData,
  playerStuffData,
} from "../corgan/save/data";
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
  /** Which talent preset (0 = Preset 1, 1 = Preset 2) to view. When
   *  omitted or equal to the char's currently-active preset (read from
   *  PlayerStuff_{ci}[1]), the standard SL_{ci} talent levels are used.
   *  When set to the OTHER preset, this helper swaps SLpre_{ci} into
   *  saveData.skillLvData[charIdx] and patches playerStuffData[charIdx][1]
   *  so the Spelunk Super Talent lookup also targets the right preset. */
  presetIdx?: 0 | 1;
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
  loadSaveData(rawEnvelope);

  // Preset swap: by default the resolver reads from skillLvData[charIdx]
  // which the loader populated from SL_{ci} (= the ACTIVE preset's
  // talent levels). If the user wants the OTHER preset, swap in
  // SLpre_{ci} for just this one char, and update playerStuff[ci][1] so
  // the Spelunk Super Talent lookup at talent.ts targets the swapped
  // preset's super array (spelunkData[20+ci+12*preset]).
  //
  // saveData is a singleton, but each computeTalentEffective call hits
  // loadSaveData first which resets it from raw, so mutations here don't
  // leak across calls.
  if (opts?.presetIdx === 0 || opts?.presetIdx === 1) {
    const rawData = rawEnvelope?.data ?? rawEnvelope;
    const activePreset = getActivePresetIdx(rawEnvelope, charIdx);
    if (opts.presetIdx !== activePreset) {
      // talent.ts reads `skillLvData` and `playerStuffData` directly from
      // the corgan save/data module (module-level let bindings). Mutating
      // saveData.skillLvData wouldn't reach them — they have to be
      // mutated in place on the imported arrays.
      const preSL = readField(rawData, `SLpre_${charIdx}`) ?? {};
      if (Array.isArray(skillLvData)) {
        (skillLvData as any)[charIdx] = preSL;
      }
      if (Array.isArray(playerStuffData) && playerStuffData[charIdx]) {
        (playerStuffData[charIdx] as any)[1] = opts.presetIdx;
      }
    }
  }

  const ctx = {
    saveData,
    charIdx,
    activeCharIdx: charIdx,
    useMaxResearchBaseLevel: !!opts?.useMaxResearchBaseLevel,
    // Always on for this page — the Spelunk Super Talent bonus is
    // surfaced as its own "Super Levels" sibling under Effective Level
    // (when the talent is super-active on the active char's preset).
    // /drop-rate doesn't set this flag, so its pool tree stays unchanged.
    splitSuperLevels: true,
  };
  // talent.resolve auto-detects account-wide talents internally (via
  // ACCOUNT_WIDE_TALENT_IDS) and switches to mode="max" cross-char
  // emit on its own — no explicit args needed here. Same path used by
  // /drop-rate so both pages get consistent values.
  const tree = talent.resolve(talentId, ctx);
  return {
    tree,
    talentId,
    talentName: entityName("talent", talentId),
  };
}

/**
 * Resolve many talents across many chars with a SINGLE save load — used by
 * the top-talents collector to scan every simple talent of every char
 * without re-parsing the ~1.25 MB save per char (the dominant cost). Uses
 * each char's active preset (SL_{ci}). Talents that fail to resolve are
 * skipped.
 */
export function computeTalentTreesForChars(
  rawEnvelope: any,
  jobs: { charIdx: number; talentIds: number[] }[]
): { charIdx: number; trees: Map<number, CorganNode> }[] {
  loadSaveData(rawEnvelope);
  const out: { charIdx: number; trees: Map<number, CorganNode> }[] = [];
  for (const job of jobs) {
    const ctx = {
      saveData,
      charIdx: job.charIdx,
      activeCharIdx: job.charIdx,
      useMaxResearchBaseLevel: false,
      splitSuperLevels: true,
    };
    const trees = new Map<number, CorganNode>();
    for (const id of job.talentIds) {
      try {
        trees.set(id, talent.resolve(id, ctx));
      } catch {
        // skip talents that error for this char's context
      }
    }
    out.push({ charIdx: job.charIdx, trees });
  }
  return out;
}
