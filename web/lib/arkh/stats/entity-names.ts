// ===== ENTITY NAMES — Real game names plumbed through the resolver chain =====
//
// We use the auto-generated ENTITY_NAMES table (sourced from IT website-data)
// to turn "Talent 279" into "Robbing Hood", "Stamp A38" into "Golden Sixes
// Stamp", etc. Coverage: talents, stamps, cards, prayers, shrines,
// achievements, star signs, arcade, post office, vials, bubbles, owl bonuses.
//
// `entityName(system, id)` → real name string, or "" if no mapping found.
// `label(system, id, suffix?)` → "Real Name (Talent 279)" so the descriptor
//   tree still surfaces the canonical id for debugging while the user sees
//   the friendly name first.

import { ENTITY_NAMES } from "./data/entity-names.gen";

// Aliases used by the descriptor & resolvers — these map our system keys to
// the ones we generated in ENTITY_NAMES (the generator picks the closest IT
// data section but the descriptor may use a near-synonym).
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

// Names IT's website-data hasn't published yet (new crystal/event companions,
// etc.). Checked before the generated table so a later regen can't drop them.
// Keyed by lowercased system. Extend as new unnamed sources surface.
const MANUAL_NAMES: Record<string, Record<string, string>> = {
  // Companion 168 = "caveD" in CompanionDB (1.30x Drop Rate); IT never named
  // it. Without this it renders "Companion 168" and, lacking the "(Companion"
  // tag, misses the Companions category → falls to "Other".
  companion: { "168": "Crystal Glunko" },
};

export function entityName(system: string, id: unknown): string {
  if (id === null || id === undefined) return "";
  const sys = system.toLowerCase();
  const idStr = Array.isArray(id) ? id.join(",") : String(id);

  const manual = MANUAL_NAMES[sys]?.[idStr];
  if (manual) return manual;

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
  // grep-able / cross-referenceable when users compare against IT's
  // leaderboards or external resources that quote ids directly.
  const tag = `${system} ${idStr}`;
  const base = friendly ? `${friendly} (${tag})` : tag;
  return base + (suffix || "");
}
