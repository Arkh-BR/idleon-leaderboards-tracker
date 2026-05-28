// ===== CHARACTER CLASS RESOLUTION =====
// Reads CharacterClass_{ci} from a raw save and turns the numeric class
// index (0-41) into the PascalCase key the talent tabs table uses
// ("Divine_Knight", "Bowman", etc.).
//
// ClassNames in customlists is CONSTANT_CASE; we use a small explicit
// override table for the handful of names whose PascalCase form differs
// from a naive title-case (e.g. "BLOOD_BERSERKER" → "Blood_Berserker",
// not "Blood_berserker").

import { ClassNames } from "../corgan/stats/data/game/customlists.js";

// Map of numeric class index → PascalCase key in TALENT_TABS_BY_CLASS.
// Built by lowercasing the CONSTANT_CASE name and capitalizing each
// underscore-separated word.
function toPascal(name: string): string {
  return name
    .toLowerCase()
    .split("_")
    .map((s) => (s.length ? s[0].toUpperCase() + s.slice(1) : s))
    .join("_");
}

// Cached for repeated calls (the runtime page recomputes the talent grid
// on every char switch, so this gets hit often).
let _cache: Record<number, string> | null = null;
function getMap(): Record<number, string> {
  if (_cache) return _cache;
  const names = ClassNames as unknown as string[];
  const out: Record<number, string> = {};
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (!n || n === "Na" || n === "0" || n === "NOPE" || n === "FILLER") {
      continue;
    }
    out[i] = toPascal(n);
  }
  _cache = out;
  return _cache;
}

/** Read CharacterClass_{ci} from the raw save and return the PascalCase
 *  class key, or null if the field is missing / the class is filler. */
export function getCharClassKey(rawSave: any, charIdx: number): string | null {
  const data = rawSave?.data ?? rawSave;
  if (!data || typeof data !== "object") return null;
  const v = Number(data[`CharacterClass_${charIdx}`]);
  if (!Number.isFinite(v)) return null;
  return getMap()[v] ?? null;
}

/** Same as getCharClassKey but returns the display name (PascalCase with
 *  underscores swapped for spaces — "Divine_Knight" → "Divine Knight").
 *  Used for the char-class label shown next to the character selector. */
export function getCharClassLabel(
  rawSave: any,
  charIdx: number
): string | null {
  const k = getCharClassKey(rawSave, charIdx);
  return k ? k.replace(/_/g, " ") : null;
}
