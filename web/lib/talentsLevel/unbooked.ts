// ===== TALENTS "UNBOOKED" =====
// Account-wide scan that lists, per character, every regular (tab 1-5)
// talent whose CURRENT cap (SkillLevelsMAX, SM_{ci}[id]) is still below the
// account-wide maxBookLv ceiling — i.e. talents that can still have their
// cap raised by applying more talent BOOKS.
//
// This is distinct from "Points to Invest" (toMax.ts): there the gap is
// invested-points vs the current cap; here the gap is current-cap vs the
// maximum cap a book can reach.
//
// Cap-booster talents (the ~12 stat talents in TALENT_CAP_BOOSTERS) are
// EXCLUDED: their cap follows the baseCap + bubble/eternal-booster mechanic,
// not maxBookLv, so a book never raises them. When their booster is
// inactive SM sits at the hardcoded baseCap (e.g. 100), which would
// otherwise read as a huge fake "books needed" gap. Star talents are
// pool-capped and skipped too.
//
// Lightweight: pure SM lookups + one maxBookLv computation. No presets —
// there's a single SkillLevelsMAX per char (no SMpre).

import { loadSaveData } from "../corgan/save/loader";
import { saveData } from "../corgan/state";
import { skillLvMaxData } from "../corgan/save/data";
import { computeMaxBookLv } from "../corgan/stats/systems/common/talent";
import { hasTalentCapBoosters } from "../corgan/stats/data/common/talent-cap-boosters";
import { entityName } from "../corgan/stats/entity-names";
import { TALENT_TABS_BY_CLASS } from "./talentTabs.gen";
import { getCharClassKey, getCharClassLabel } from "./charClass";
import { listCharacters } from "../dropRate/extract";
import { isAccountWideTalent } from "./accountWideTalents";

export type UnbookedItem = {
  talentId: number;
  /** Friendly talent name (entityName, falling back to title-cased raw). */
  name: string;
  /** Cleaned lvlUpText ("+{_STR" → "+ STR") shown as the bonus subtitle. */
  bonusText: string;
  /** Tab the talent lives in (for context — e.g. "Death Bringer"). */
  tab: string;
  /** Current cap (SM_{ci}[id]). */
  currentCap: number;
  /** Ceiling cap a fully-booked talent reaches (account-wide maxBookLv). */
  maxCap: number;
  /** maxCap − currentCap: how many book levels are still missing. */
  booksNeeded: number;
  accountWide: boolean;
};

export type UnbookedCharGroup = {
  charIdx: number;
  charName: string;
  classLabel: string;
  level: number;
  /** Talents whose cap is below maxBookLv, sorted by booksNeeded desc. */
  items: UnbookedItem[];
  /** Regular non-booster talents scanned (for the "X / Y booked" read-out). */
  totalScanned: number;
};

function cleanLvlUpText(s: string): string {
  return s.replace(/[{}_]/g, " ").replace(/\s+/g, " ").trim();
}

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
 * whose cap can still be raised with books (current cap < maxBookLv).
 *
 * @param rawEnvelope The parsed "Copy for Support" save.
 */
export function computeUnbooked(rawEnvelope: any): UnbookedCharGroup[] {
  loadSaveData(rawEnvelope);
  const maxBookLv = computeMaxBookLv(saveData);
  const chars = listCharacters(rawEnvelope);

  const groups: UnbookedCharGroup[] = [];
  for (const ch of chars) {
    const ci = ch.charIndex;
    const classKey = getCharClassKey(rawEnvelope, ci);
    if (!classKey) continue;
    const cls = TALENT_TABS_BY_CLASS[classKey];
    if (!cls) continue;

    const sm = skillLvMaxData[ci];

    const items: UnbookedItem[] = [];
    const seen = new Set<number>();
    let totalScanned = 0;

    for (const tab of cls.tabs) {
      // Star talents are pool-capped — no book cap to raise.
      if (tab.name.startsWith("Special Talent")) continue;
      const tabLabel = tab.name.replace(/_/g, " ");
      for (const t of tab.talents) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        // Cap-booster talents don't follow the maxBookLv mechanic — skip.
        if (hasTalentCapBoosters(t.id)) continue;
        totalScanned++;

        const currentCap = readLevel(sm, t.id);
        // Skip talents with no recorded cap (0 = not active for this char)
        // and those already at/above the ceiling.
        if (currentCap <= 0 || currentCap >= maxBookLv) continue;

        const friendly = entityName("talent", t.id) || prettifyName(t.name);
        items.push({
          talentId: t.id,
          name: friendly,
          bonusText: cleanLvlUpText(t.lvlUpText),
          tab: tabLabel,
          currentCap,
          maxCap: maxBookLv,
          booksNeeded: maxBookLv - currentCap,
          accountWide: isAccountWideTalent(t.id),
        });
      }
    }

    items.sort((a, b) => b.booksNeeded - a.booksNeeded);
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
