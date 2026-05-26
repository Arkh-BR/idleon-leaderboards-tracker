// ============================================================================
// gen-entity-names.ts — build-time extractor that distills website-data.json's
// huge per-entity payloads (formulas, costs, descriptions, …) into a compact
// id → display-name map. The output lands at:
//
//   web/lib/corgan/stats/data/entity-names.gen.ts
//
// We don't want to ship the full website-data with the DeepView bundle just to
// read a few names, so the script does the cherry-picking once and the
// generated file (~50KB readable JS) is committed.
//
// Run with: npx tsx web/scripts/gen-entity-names.ts
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Json = any;

const DATA_PATH = resolve(
  __dirname,
  "..",
  "lib",
  "it",
  "data",
  "website-data.json"
);
const OUTPUT_PATH = resolve(
  __dirname,
  "..",
  "lib",
  "corgan",
  "stats",
  "data",
  "entity-names.gen.ts"
);

const data: Json = JSON.parse(readFileSync(DATA_PATH, "utf8"));

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Hand-curated overrides for names where IT's raw key collapses words or
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
 *   2. Split on underscores, then for each word lowercase + capitalize first.
 *   3. Restore preserved acronyms (HP, STR, LUK, etc.) to uppercase. */
function humanize(raw: string): string {
  if (!raw) return "";
  if (NAME_OVERRIDES[raw]) return NAME_OVERRIDES[raw];
  return raw
    .replace(/_/g, " ")
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
// Talents — Object<TreeName, Object<TALENT_KEY, { skillIndex, ... }>>
// ----------------------------------------------------------------------------
const talents: Record<number, string> = {};
for (const treeName in data.talents) {
  const tree = data.talents[treeName];
  for (const k in tree) {
    const t = tree[k];
    const idx = Number(t?.skillIndex);
    if (Number.isFinite(idx)) {
      talents[idx] = humanize(k);
    }
  }
}

// ----------------------------------------------------------------------------
// Stamps — { combat: {idx:{...}}, skills: {...}, misc: {...} }
// Our codes are "A38", "B12", "C5" where letter is category and number is
// 1-indexed position. The IT data is 0-indexed (combat[0] = stamp 1).
// ----------------------------------------------------------------------------
const stamps: Record<string, string> = {};
const STAMP_CAT_LETTERS: Record<string, string> = {
  combat: "A",
  skills: "B",
  misc: "C",
};
for (const cat in data.stamps) {
  const letter = STAMP_CAT_LETTERS[cat];
  if (!letter) continue;
  const group = data.stamps[cat];
  for (const k in group) {
    const idx = Number(k);
    if (!Number.isFinite(idx)) continue;
    const s = group[k];
    const name = humanize(s.displayName || s.rawName || `Stamp ${letter}${idx + 1}`);
    stamps[`${letter}${idx + 1}`] = name;
  }
}

// ----------------------------------------------------------------------------
// Cards — { cardKey: { displayName, rawName, ... } }
// ----------------------------------------------------------------------------
const cards: Record<string, string> = {};
for (const k in data.cards) {
  const c = data.cards[k];
  cards[k] = humanize(c.displayName || c.rawName || k);
}

// ----------------------------------------------------------------------------
// Prayers — { id: { name, effect, ... } }
// ----------------------------------------------------------------------------
const prayers: Record<number, string> = {};
for (const k in data.prayers) {
  const idx = Number(k);
  if (!Number.isFinite(idx)) continue;
  prayers[idx] = humanize(data.prayers[k].name || `Prayer ${k}`);
}

// ----------------------------------------------------------------------------
// Shrines — { id: { shrineName, ... } }
// IT stores shrines starting at index 18 (the in-game item-ID space) but our
// descriptor refers to them 0-indexed (shrine 4 = drop). Build BOTH maps so
// the lookup can match either convention.
// ----------------------------------------------------------------------------
const shrines: Record<number, string> = {};
const shrineKeys = Object.keys(data.shrines)
  .map((k) => Number(k))
  .filter((n) => Number.isFinite(n))
  .sort((a, b) => a - b);
shrineKeys.forEach((rawIdx, zeroIdx) => {
  const s = data.shrines[rawIdx];
  const name = humanize(s.shrineName || `Shrine ${rawIdx}`);
  shrines[rawIdx] = name;
  shrines[zeroIdx] = name;
});

// ----------------------------------------------------------------------------
// Achievements — array
// ----------------------------------------------------------------------------
const achievements: Record<number, string> = {};
if (Array.isArray(data.achievements)) {
  data.achievements.forEach((a: Json, i: number) => {
    if (a && a.name) achievements[i] = humanize(a.name);
  });
}

// ----------------------------------------------------------------------------
// Star Signs — { id: { starName, ... } }. Our descriptor uses logical keys
// like "drop" (which means "the drop-rate sign — IT has Gum Drop / Gum Drop
// Major"). We expose both: numeric ids AND logical keys.
// ----------------------------------------------------------------------------
const starSigns: Record<string | number, string> = {};
for (const k in data.starSigns) {
  const s = data.starSigns[k];
  const name = humanize(s.starName || s.name || `Star Sign ${k}`);
  starSigns[k] = name;
}
// Logical-key alias used by the descriptor. We search for the most-specific
// "Major" version since that's the one our resolver picks at high levels.
const dropSign =
  Object.values(data.starSigns).find((s: Json) =>
    /gum_?drop_?major/i.test(s?.starName || "")
  ) ||
  Object.values(data.starSigns).find((s: Json) =>
    /gum_?drop/i.test(s?.starName || "")
  );
if (dropSign && (dropSign as Json).starName) {
  starSigns["drop"] = humanize((dropSign as Json).starName);
}

// ----------------------------------------------------------------------------
// Arcade — array, our descriptor uses arcade id: 27.
// IT's bonusName field is just the effect text ("+{%_Drop"). The effect
// field has more context. We label by stripping {/}/+/% and showing what
// the bonus boosts, which yields "Drop Rate" for arcade 27.
// ----------------------------------------------------------------------------
const arcade: Record<number, string> = {};
if (Array.isArray(data.arcadeShop)) {
  data.arcadeShop.forEach((a: Json, i: number) => {
    if (!a) return;
    const raw = String(a.effect || a.bonusName || `Arcade ${i}`)
      .replace(/_/g, " ")
      .replace(/[\{\}+%]/g, "")
      .replace(/\b\d+\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const humanized = humanize(raw);
    // Add "Arcade Bonus" prefix so it doesn't read like a standalone phrase.
    arcade[i] = humanized ? `${humanized} Arcade Bonus` : `Arcade ${i}`;
  });
}

// ----------------------------------------------------------------------------
// Post Office — array of upgrades
// ----------------------------------------------------------------------------
const postOffice: Record<string, string> = {};
if (Array.isArray(data.postOffice)) {
  data.postOffice.forEach((p: Json, i: number) => {
    if (p && p.name) postOffice[i] = humanize(p.name);
  });
}

// ----------------------------------------------------------------------------
// Vials — array
// ----------------------------------------------------------------------------
const vials: Record<number, string> = {};
if (Array.isArray(data.vials)) {
  data.vials.forEach((v: Json, i: number) => {
    if (v && v.name) vials[i] = humanize(v.name);
  });
}

// ----------------------------------------------------------------------------
// Bubbles — { cauldronName: [...] } across the cauldrons key
// ----------------------------------------------------------------------------
const bubbles: Record<string, string> = {}; // key "cauldronIdx,bubbleIdx" → name
if (data.cauldrons && typeof data.cauldrons === "object") {
  let cauldronIdx = 0;
  for (const name in data.cauldrons) {
    const list = data.cauldrons[name];
    if (Array.isArray(list)) {
      list.forEach((b: Json, bi: number) => {
        if (b && b.bubbleName) {
          bubbles[`${cauldronIdx},${bi}`] = humanize(b.bubbleName);
        }
      });
    }
    cauldronIdx++;
  }
}

// ----------------------------------------------------------------------------
// Owl bonuses — array
// ----------------------------------------------------------------------------
const owl: Record<number, string> = {};
if (data.owlData && Array.isArray(data.owlData.bonuses)) {
  data.owlData.bonuses.forEach((b: Json, i: number) => {
    if (b && (b.name || b.effect)) owl[i] = humanize(b.name || `Owl ${i}`);
  });
}

// ----------------------------------------------------------------------------
// Compose output
// ----------------------------------------------------------------------------
const out: Record<string, Record<string, string>> = {
  talent: Object.fromEntries(
    Object.entries(talents).map(([k, v]) => [k, v])
  ),
  stamp: stamps,
  card: cards,
  cardSingle: cards, // alias — cardSingle id "mini5a" should resolve via same map
  prayer: Object.fromEntries(
    Object.entries(prayers).map(([k, v]) => [k, v])
  ),
  shrine: Object.fromEntries(
    Object.entries(shrines).map(([k, v]) => [k, v])
  ),
  achievement: Object.fromEntries(
    Object.entries(achievements).map(([k, v]) => [k, v])
  ),
  starSign: Object.fromEntries(
    Object.entries(starSigns).map(([k, v]) => [k, v])
  ),
  arcade: Object.fromEntries(
    Object.entries(arcade).map(([k, v]) => [k, v])
  ),
  postOffice,
  vial: Object.fromEntries(
    Object.entries(vials).map(([k, v]) => [k, v])
  ),
  bubble: bubbles,
  owl: Object.fromEntries(
    Object.entries(owl).map(([k, v]) => [k, v])
  ),
};

const lines: string[] = [];
lines.push(
  "// AUTO-GENERATED by web/scripts/gen-entity-names.ts — do not edit by hand."
);
lines.push("// Source: web/lib/it/data/website-data.json");
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
