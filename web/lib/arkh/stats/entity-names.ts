// ===== ENTITY NAMES — Real game names plumbed through the resolver chain =====
//
// We use the auto-generated ENTITY_NAMES table (sourced from the game's own
// lists — see web/scripts/gen-entity-names.ts) to turn "Talent 279" into "Robbing Hood", "Stamp A38" into "Golden Sixes
// Stamp", etc. Coverage: talents, stamps, cards, prayers, shrines,
// achievements, star signs, arcade, post office, vials, bubbles, owl bonuses.
//
// `entityName(system, id)` → real name string, or "" if no mapping found.
// `label(system, id, suffix?)` → "Real Name (Talent 279)" so the descriptor
//   tree still surfaces the canonical id for debugging while the user sees
//   the friendly name first.

import { ENTITY_NAMES } from "./data/entity-names.gen";
import { TalentIconNames } from "./data/game/customlists.js";

// "GRADED_RATE" → "Graded Rate", "PIT_O'_PAGES" → "Pit O' Pages". Used for
// talents the generated table doesn't know yet (a game update landed in
// customlists.js but gen-entity-names.ts wasn't re-run), straight from the
// game's TalentIconNames.
const SMALL_WORDS = new Set(["of", "the", "a", "an", "and", "in", "for", "to"]);
function talentNameFromGame(raw: string): string {
  return raw
    .split("_")
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// Aliases used by the descriptor & resolvers — these map our system keys to
// the ones we generated in ENTITY_NAMES (the generator picks the closest game
// list but the descriptor may use a near-synonym).
const SYSTEM_ALIASES: Record<string, string[]> = {
  cardset: ["cardSet", "card"],
  cardsingle: ["card"],
  "card set": ["cardSet"],
  "card type": ["cardType"],
  cardtype: ["cardType"],
  compmulti: ["compMulti", "companion"],
  sushirog: [],
  spelunkshop: [],
  legendpts: [],
  etcbonus: [],
  postoffice: ["postOffice"],
  "post office": ["postOffice"],
  "star sign": ["starSign"],
  starsign: ["starSign"],
};

export function entityName(system: string, id: unknown): string {
  if (id === null || id === undefined) return "";
  const sys = system.toLowerCase();
  const idStr = Array.isArray(id) ? id.join(",") : String(id);

  // Try the lowercase system key as-is first
  const candidates: string[] = [];
  for (const k of Object.keys(ENTITY_NAMES)) {
    if (k.toLowerCase() === sys) candidates.push(k);
  }
  // Then add any registered aliases
  for (const alias of SYSTEM_ALIASES[sys] || []) {
    if (ENTITY_NAMES[alias]) candidates.push(alias);
  }

  for (const c of candidates) {
    const m = ENTITY_NAMES[c];
    if (m && m[idStr]) return m[idStr];
  }
  if (sys === "talent") {
    const raw = (TalentIconNames as unknown as string[])[Number(idStr)];
    if (raw && raw !== "_") return talentNameFromGame(raw);
  }
  return "";
}

export function label(
  system: string,
  id: unknown,
  suffix?: string
): string {
  const idStr = Array.isArray(id) ? id.join(",") : String(id);
  const friendly = entityName(system, id);
  // Keep the system+id tag in parens so the canonical id is still
  // grep-able / cross-referenceable against leaderboards or external
  // resources that quote ids directly.
  const tag = `${system} ${idStr}`;
  const base = friendly ? `${friendly} (${tag})` : tag;
  return base + (suffix || "");
}
