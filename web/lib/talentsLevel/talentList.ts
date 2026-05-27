// ===== TALENT LIST FOR THE TALENTS LEVEL PAGE =====
// Derives the searchable list of talents from ENTITY_NAMES — every numeric id
// that has a friendly name. We exclude Tal 655 (the only star talent that
// short-circuits past the Effective Level structure) so the dropdown never
// surfaces a talent whose tree would be empty.

import { ENTITY_NAMES } from "../corgan/stats/data/entity-names.gen";

export type TalentListEntry = {
  id: number;
  name: string;
  /** Combined "Name (Talent 279)" string used as the dropdown label and as
   *  the search target. Lowercased once at build time so the filter loop
   *  doesn't re-allocate per keystroke. */
  searchKey: string;
};

// Talents whose resolver does NOT emit the Base + Bonus → Effective Level
// structure. Keep this list narrow — most talents go through the default
// emit path and DO have it.
const EXCLUDED_TALENT_IDS = new Set<number>([
  655, // Boss Battle Spillover (star talent — rawLv IS effLv, no Base/Bonus split)
]);

let _cached: TalentListEntry[] | null = null;

export function getTalentList(): TalentListEntry[] {
  if (_cached) return _cached;
  const table = (ENTITY_NAMES as Record<string, Record<string, string>>)[
    "talent"
  ];
  if (!table) {
    _cached = [];
    return _cached;
  }
  const entries: TalentListEntry[] = [];
  for (const key of Object.keys(table)) {
    const id = Number(key);
    if (!Number.isFinite(id)) continue;
    if (EXCLUDED_TALENT_IDS.has(id)) continue;
    const name = table[key];
    if (!name) continue;
    entries.push({
      id,
      name,
      searchKey: `${name} (Talent ${id})`.toLowerCase(),
    });
  }
  // Alphabetical by friendly name so the dropdown is human-scannable. Ties
  // (rare for talents) fall back to id.
  entries.sort((a, b) => {
    const cmp = a.name.localeCompare(b.name);
    return cmp !== 0 ? cmp : a.id - b.id;
  });
  _cached = entries;
  return _cached;
}
