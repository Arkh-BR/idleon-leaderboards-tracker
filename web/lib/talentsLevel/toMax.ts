// ===== TALENTS "FALTANDO P/ MAX" =====
// Account-wide scan that lists, per character, every regular (tab 1-5)
// talent whose invested level is still BELOW its Max Book Lv Cap — i.e.
// the talents the player can still push up by investing more points.
//
// Lightweight by design: we read the raw invested level straight from
// SL_{ci} (skillLvData) and the cap from SM_{ci} (skillLvMaxData, which the
// game writes as the live SkillLevelsMAX — already includes cap-booster
// raises for the stat talents). Only when SM has no entry for a talent do
// we fall back to the account-wide maxBookLv formula. No per-talent tree
// resolve, so a 10-char account scans in O(chars × talents) lookups.
//
// Star talents (the "Special Talent" tabs) are pool-capped and have no Max
// Book Lv Cap, so they're skipped entirely.

import { loadSaveData } from "../corgan/save/loader";
import { saveData } from "../corgan/state";
import { skillLvData, skillLvMaxData } from "../corgan/save/data";
import { computeMaxBookLv } from "../corgan/stats/systems/common/talent";
import { entityName } from "../corgan/stats/entity-names";
import { TALENT_TABS_BY_CLASS } from "./talentTabs.gen";
import { getCharClassKey, getCharClassLabel } from "./charClass";
import { listCharacters } from "../dropRate/extract";
import { isAccountWideTalent } from "./accountWideTalents";

export type ToMaxItem = {
  talentId: number;
  /** Friendly talent name (entityName, falling back to title-cased raw). */
  name: string;
  /** Cleaned lvlUpText ("+{_STR" → "+ STR") shown as the bonus subtitle. */
  bonusText: string;
  /** Tab the talent lives in (for context — e.g. "Death Bringer"). */
  tab: string;
  invested: number;
  cap: number;
  /** cap − invested, always > 0 for items that make the list. */
  gap: number;
  accountWide: boolean;
};

export type ToMaxCharGroup = {
  charIdx: number;
  charName: string;
  classLabel: string;
  level: number;
  /** Talents below cap, sorted by gap descending. May be empty when the
   *  char has everything at the cap. */
  items: ToMaxItem[];
  /** Total regular talents scanned for this char (for the "X / Y at cap"
   *  read-out). */
  totalScanned: number;
};

// Strip IT formula-placeholder tokens out of lvlUpText so it reads as a
// plain bonus name. Mirrors the same helper in TalentsLevelPageClient.
function cleanLvlUpText(s: string): string {
  return s.replace(/[{}_]/g, " ").replace(/\s+/g, " ").trim();
}

// CONSTANT_CASE talent name → "Title Case" fallback when entityName has no
// mapping (e.g. "FIST_OF_RAGE" → "Fist Of Rage").
function prettifyName(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function readLevel(perChar: any, talentId: number): number {
  if (!perChar) return 0;
  const v = perChar[talentId] ?? perChar[String(talentId)];
  return Number(v) || 0;
}

/**
 * Scan the whole account and return, per character, the regular talents
 * still below their Max Book Lv Cap.
 *
 * @param rawEnvelope The parsed "Copy for Support" save (same object the
 *   page already holds as `save`).
 */
export function computeTalentsToMax(rawEnvelope: any): ToMaxCharGroup[] {
  loadSaveData(rawEnvelope);
  const maxBookLv = computeMaxBookLv(saveData);
  const chars = listCharacters(rawEnvelope);

  const groups: ToMaxCharGroup[] = [];
  for (const ch of chars) {
    const ci = ch.charIndex;
    const classKey = getCharClassKey(rawEnvelope, ci);
    if (!classKey) continue;
    const cls = TALENT_TABS_BY_CLASS[classKey];
    if (!cls) continue;

    const sl = skillLvData[ci];
    const sm = skillLvMaxData[ci];

    const items: ToMaxItem[] = [];
    const seen = new Set<number>();
    let totalScanned = 0;

    for (const tab of cls.tabs) {
      // Star talents are pool-capped — no Max Book Lv Cap to chase.
      if (tab.name.startsWith("Special Talent")) continue;
      const tabLabel = tab.name.replace(/_/g, " ");
      for (const t of tab.talents) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        totalScanned++;

        const invested = readLevel(sl, t.id);
        // SM holds the live in-game cap (incl. cap-booster raises for the
        // stat talents). When it's missing/zero the game hasn't written a
        // cap for this talent yet → fall back to the account-wide formula.
        const savedCap = readLevel(sm, t.id);
        const cap = savedCap > 0 ? savedCap : maxBookLv;
        if (invested >= cap) continue;

        const friendly = entityName("talent", t.id) || prettifyName(t.name);
        items.push({
          talentId: t.id,
          name: friendly,
          bonusText: cleanLvlUpText(t.lvlUpText),
          tab: tabLabel,
          invested,
          cap,
          gap: cap - invested,
          accountWide: isAccountWideTalent(t.id),
        });
      }
    }

    items.sort((a, b) => b.gap - a.gap);
    groups.push({
      charIdx: ci,
      charName: ch.charName,
      classLabel: getCharClassLabel(rawEnvelope, ci) ?? "—",
      level: ch.level,
      items,
      totalScanned,
    });
  }
  return groups;
}
