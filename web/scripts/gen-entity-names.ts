// ============================================================================
// gen-entity-names.ts — build-time extractor that distills the game's own
// lists (the N.js-derived game data in web/lib/game/data/generated/, kept
// current by the updater) into a compact id → display-name map. Output:
//
//   web/lib/game/data/generated/entity-names.gen.ts
//
// The game lists are a few MB; the DeepView only needs the names, so the
// script does the cherry-picking once and the generated file is committed.
// Re-run it after the updater regenerates the game data.
//
// Run with: npx tsx web/scripts/gen-entity-names.ts
// ============================================================================

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as LISTS from "@/lib/game/data/generated/customlists.js";
import { ITEMS } from "@/lib/game/data/generated/items.js";
import { MONSTERS } from "@/lib/game/data/generated/monsters.js";

type Json = any;
const L: Json = LISTS;
const ITEM_DEFS: Json = ITEMS;
const MONSTER_DEFS: Json = MONSTERS;

const OUTPUT_PATH = resolve(
  __dirname,
  "..",
  "lib",
  "game",
  "data",
  "generated",
  "entity-names.gen.ts"
);

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Hand-curated overrides for names where the raw key collapses words or
 *  uses an in-game typo we want to preserve / fix. Keyed by the upper-case
 *  raw key (NOT the humanized form) so we patch at source. */
const NAME_OVERRIDES: Record<string, string> = {
  ROBBINGHOOD: "Robbing Hood",
  HAUNGRY_FOR_GOLD: "Hungry for Gold", // game itself has the typo
  "SYMBOLS_OF_BEYOND_~R": "Symbols of Beyond ~R",
};

/** Real game acronyms that should stay UPPERCASE after title-casing. */
const PRESERVED_ACRONYMS = new Set([
  "HP",
  "MP",
  "STR",
  "AGI",
  "WIS",
  "LUK",
  "DEF",
  "EXP",
  "XP",
  "AFK",
  "DR",
  "AC", // active cubes
  "MS", // Milky Way Sigil?
  "WP",
  "II",
  "III",
  "IV",
  "VI",
  "VII",
  "VIII",
  "IX",
  "DK", // Death Bringer abbreviation
  "ES",
  "GM", // achievement suffix (Summoning GM)
  "PTS", // legend PTS, gold ball PTS
  "BB", // big bonus / big big
  "OG",
  "VIP",
]);

/** Convert SCREAMING_SNAKE / underscore_case into "Title Case". Operations:
 *   1. Hand-curated override list for fixed-up names.
 *   2. Split on underscores and "|" (the game's line break in item names),
 *      then for each word lowercase + capitalize first.
 *   3. Restore preserved acronyms (HP, STR, LUK, etc.) to uppercase. */
function humanize(raw: string): string {
  if (!raw) return "";
  if (NAME_OVERRIDES[raw]) return NAME_OVERRIDES[raw];
  return raw
    .replace(/[_|]/g, " ")
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      // Title-case first, then restore acronym if listed.
      const upper = w.toUpperCase();
      if (PRESERVED_ACRONYMS.has(upper)) return upper;
      const lower = w.toLowerCase();
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// ----------------------------------------------------------------------------
// Talents — TalentIconNames[id] for every id placed in a talent tab
// (TalentOrder). Empty slots are "_"; the few ids with a name but no
// TalentDescriptions text ("C", "A", "Special53") aren't real talents.
// ----------------------------------------------------------------------------
const talents: Record<number, string> = {};
for (const raw of L.TalentOrder) {
  const id = Number(raw);
  const name = L.TalentIconNames[id];
  if (!name || name === "_" || L.TalentDescriptions[id]?.[0]?.[0] === "_") continue;
  talents[id] = humanize(name);
}

// ----------------------------------------------------------------------------
// Stamps — ItemDefinitions StampA1…, StampB1…, StampC1… Our codes are "A38",
// "B12", "C5": letter = category, number = the item's 1-indexed position.
// ----------------------------------------------------------------------------
const stamps: Record<string, string> = {};
for (const key in ITEM_DEFS) {
  const m = /^Stamp([ABC])(\d+)$/.exec(key);
  if (m) stamps[`${m[1]}${m[2]}`] = humanize(ITEM_DEFS[key].displayName);
}

// ----------------------------------------------------------------------------
// Cards — CardStuff[category][i][0] is the monster key; the card's name is
// that monster's Name. "Blank" filler slots have no monster → skipped.
// ----------------------------------------------------------------------------
const cards: Record<string, string> = {};
for (const cat of L.CardStuff) {
  for (const c of cat) {
    const name = MONSTER_DEFS[c[0]]?.Name;
    if (name) cards[c[0]] = humanize(name);
  }
}

// ----------------------------------------------------------------------------
// Prayers — PrayerInfo[i][0]
// ----------------------------------------------------------------------------
const prayers: Record<number, string> = {};
L.PrayerInfo.forEach((p: Json, i: number) => {
  prayers[i] = humanize(p[0]);
});

// ----------------------------------------------------------------------------
// Shrines — ShrineInfo[i][0]. Our descriptors refer to them 0-indexed
// (shrine 4 = drop); shrines are also construction buildings 18+
// (TowerInfo[18] = Woodular_Shrine), so both keys resolve.
// ----------------------------------------------------------------------------
const shrines: Record<number, string> = {};
L.ShrineInfo.forEach((s: Json, i: number) => {
  shrines[i] = shrines[i + 18] = humanize(s[0]);
});

// ----------------------------------------------------------------------------
// Achievements — RegAchieves[i][0]
// ----------------------------------------------------------------------------
const achievements: Record<number, string> = {};
L.RegAchieves.forEach((a: Json, i: number) => {
  achievements[i] = humanize(a[0]);
});

// ----------------------------------------------------------------------------
// Star Signs — StarSigns[i][0]. Our descriptor uses logical keys like "drop"
// (the drop-rate sign — Gum Drop / Gum Drop Major). We expose both: numeric
// ids AND logical keys.
// ----------------------------------------------------------------------------
const starSigns: Record<string | number, string> = {};
L.StarSigns.forEach((s: Json, i: number) => {
  starSigns[i] = humanize(s[0]);
});
// Logical-key alias used by the descriptor. We search for the most-specific
// "Major" version since that's the one our resolver picks at high levels.
const dropSign =
  L.StarSigns.find((s: Json) => /gum_?drop_?major/i.test(s[0])) ||
  L.StarSigns.find((s: Json) => /gum_?drop/i.test(s[0]));
if (dropSign) starSigns["drop"] = humanize(dropSign[0]);

// ----------------------------------------------------------------------------
// Arcade — ArcadeShopInfo[i][0] is the effect text ("+{%_Drop_Rate",
// "}x_Worship_Souls"). We label by stripping the value placeholders
// ({ / }x / + / %), which yields "Drop Rate" for arcade 27.
// ----------------------------------------------------------------------------
const arcade: Record<number, string> = {};
L.ArcadeShopInfo.forEach((a: Json, i: number) => {
  const raw = String(a[0])
    .replace(/^\}x_/, "")
    .replace(/_/g, " ")
    .replace(/[\{\}+%]/g, "")
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const humanized = humanize(raw);
  // Add "Arcade Bonus" prefix so it doesn't read like a standalone phrase.
  arcade[i] = humanized ? `${humanized} Arcade Bonus` : `Arcade ${i}`;
});

// ----------------------------------------------------------------------------
// Post Office — PostOffUpgradeInfo[i][0]
// ----------------------------------------------------------------------------
const postOffice: Record<string, string> = {};
L.PostOffUpgradeInfo.forEach((p: Json, i: number) => {
  postOffice[i] = humanize(p[0]);
});

// ----------------------------------------------------------------------------
// Vials — AlchemyDescription[4][i][0]
// ----------------------------------------------------------------------------
const vials: Record<number, string> = {};
L.AlchemyDescription[4].forEach((v: Json, i: number) => {
  vials[i] = humanize(v[0]);
});

// ----------------------------------------------------------------------------
// Bubbles — AlchemyDescription[0..3] = the four cauldrons (power, quicc,
// high-iq, kazam). Key "cauldronIdx,bubbleIdx" → name.
// ----------------------------------------------------------------------------
const bubbles: Record<string, string> = {};
for (let ci = 0; ci < 4; ci++) {
  L.AlchemyDescription[ci].forEach((b: Json, bi: number) => {
    bubbles[`${ci},${bi}`] = humanize(b[0]);
  });
}

// ----------------------------------------------------------------------------
// Owl — the descriptors' owl ids are the Orion bonus slots, which have no
// name list in the game data (Owlz is the feather upgrade shop), so empty.
// ----------------------------------------------------------------------------
const owl: Record<number, string> = {};

// ----------------------------------------------------------------------------
// Companions — CompanionDB[i][0] is the monster key; the name is that
// monster's Name. Our descriptor uses numeric ids that index into CompanionDB.
// Unreleased slots with no monster ("shovel", "slimmer") are skipped.
// ----------------------------------------------------------------------------
const companions: Record<number, string> = {};
L.CompanionDB.forEach((c: Json, i: number) => {
  const name = MONSTER_DEFS[c[0]]?.Name;
  if (name) companions[i] = humanize(name);
});

// ----------------------------------------------------------------------------
// Card Types (bonus-table-id → display name) and Card Sets — these are the
// abstracted card-system entries the descriptor refers to via "card 10" /
// "card 101" / "cardSet 5" / "cardSet 6". They're not named entities in the
// game data, so we hand-curate the four DR-relevant ones.
// ----------------------------------------------------------------------------
const cardType: Record<number, string> = {
  10: "Drop Rate Cards",
  101: "Drop Rate Multi Cards",
};
const cardSet: Record<number, string> = {
  // Hardcoded card-set ID → effect mapping that mirrors cards.ts's
  // CARD_SET_KEYS. Numeric ID is what the descriptor uses.
  5: "Damage / Drop / EXP Set Bonus",
  6: "Drop Rate Set Bonus",
};

// ----------------------------------------------------------------------------
// Compose output
// ----------------------------------------------------------------------------
const out: Record<string, Record<string, string>> = {
  talent: talents,
  stamp: stamps,
  card: cards,
  cardSingle: cards, // alias — cardSingle id "mini5a" should resolve via same map
  prayer: prayers,
  shrine: shrines,
  achievement: achievements,
  starSign: starSigns,
  arcade,
  postOffice,
  vial: vials,
  bubble: bubbles,
  owl,
  companion: companions,
  compMulti: companions,
  cardType,
  cardSet,
};

const lines: string[] = [];
lines.push(
  "// AUTO-GENERATED by web/scripts/gen-entity-names.ts — do not edit by hand."
);
lines.push("// Source: web/lib/game/data/generated/{customlists,items,monsters}.js (N.js)");
lines.push("// Regenerate: npx tsx web/scripts/gen-entity-names.ts");
lines.push("");
lines.push("export const ENTITY_NAMES: Record<string, Record<string, string>> = {");
for (const sys of Object.keys(out).sort()) {
  lines.push(`  ${JSON.stringify(sys)}: {`);
  const m = out[sys];
  for (const k of Object.keys(m).sort()) {
    lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(m[k])},`);
  }
  lines.push("  },");
}
lines.push("};");
lines.push("");

writeFileSync(OUTPUT_PATH, lines.join("\n"));
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(
  `Systems: ${Object.keys(out).length}, total entries: ${Object.values(out).reduce(
    (a, m) => a + Object.keys(m).length,
    0
  )}`
);
