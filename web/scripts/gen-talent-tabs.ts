// ===== TALENT TABS GENERATOR =====
// One-shot script: reads IT's website-data.json (talents section) and emits a
// strongly-typed lookup table `talentTabsByClass` that the /talents-level
// page uses to build the visual picker.
//
// Run with: `npx tsx web/scripts/gen-talent-tabs.ts`
//
// Output: web/lib/talentsLevel/talentTabs.gen.ts (~30KB, committed).
//
// Why this lives in a gen script instead of being parsed at runtime: the
// website-data.json file is 10MB and we only need a tiny slice of it.
// Generating once at build time keeps the runtime bundle small.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");
const WEBSITE_DATA = join(
  REPO,
  "web",
  "scripts",
  "it-source",
  "data",
  "website-data.json"
);
const OUT = join(REPO, "web", "lib", "talentsLevel", "talentTabs.gen.ts");

// Class → ordered list of tabs (the user's class promotion chain). Mirrors
// the IT-source `talentPagesMap` in scripts/it-source/parsers/talents.ts so
// the chain inherits the same Rage_Basics / Calm_Basics / Savvy_Basics
// branch headers that the in-game UI shows.
const TALENT_PAGES_MAP: Record<string, string[]> = {
  Beginner: ["Beginner"],
  Journeyman: ["Beginner", "Journeyman"],
  Maestro: ["Beginner", "Journeyman", "Maestro"],
  Voidwalker: ["Beginner", "Journeyman", "Maestro", "Voidwalker"],
  Warrior: ["Rage_Basics", "Warrior"],
  Barbarian: ["Rage_Basics", "Warrior", "Barbarian"],
  Blood_Berserker: ["Rage_Basics", "Warrior", "Barbarian", "Blood_Berserker"],
  Death_Bringer: [
    "Rage_Basics",
    "Warrior",
    "Barbarian",
    "Blood_Berserker",
    "Death_Bringer",
  ],
  Squire: ["Rage_Basics", "Warrior", "Squire"],
  Divine_Knight: ["Rage_Basics", "Warrior", "Squire", "Divine_Knight"],
  Archer: ["Calm_Basics", "Archer"],
  Bowman: ["Calm_Basics", "Archer", "Bowman"],
  Siege_Breaker: ["Calm_Basics", "Archer", "Bowman", "Siege_Breaker"],
  Hunter: ["Calm_Basics", "Archer", "Hunter"],
  Beast_Master: ["Calm_Basics", "Archer", "Hunter", "Beast_Master"],
  Wind_Walker: [
    "Calm_Basics",
    "Archer",
    "Hunter",
    "Beast_Master",
    "Wind_Walker",
  ],
  Mage: ["Savvy_Basics", "Mage"],
  Shaman: ["Savvy_Basics", "Mage", "Shaman"],
  Bubonic_Conjuror: ["Savvy_Basics", "Mage", "Shaman", "Bubonic_Conjuror"],
  Arcane_Cultist: [
    "Savvy_Basics",
    "Mage",
    "Shaman",
    "Bubonic_Conjuror",
    "Arcane_Cultist",
  ],
  Wizard: ["Savvy_Basics", "Mage", "Wizard"],
  Elemental_Sorcerer: [
    "Savvy_Basics",
    "Mage",
    "Wizard",
    "Elemental_Sorcerer",
  ],
};

// Star talent tabs — universal, every class has access to the same 4 pages.
const STAR_TALENT_TABS = [
  "Special Talent 1",
  "Special Talent 2",
  "Special Talent 3",
  "Special Talent 4",
];

// Excluded talent ids — talents whose resolver doesn't emit anything useful
// for this page (we'd just render an empty tree). Kept narrow so we don't
// accidentally hide real talents.
const EXCLUDED_IDS = new Set<number>([
  // None excluded right now: even Tal 655 (Boss Spillover) has a meaningful
  // tree thanks to its special-case emit in talent.ts.
]);

type RawTalent = {
  name: string;
  description: string;
  x1: number;
  x2: number;
  funcX: string;
  y1: number | null;
  y2: number | null;
  funcY: string;
  lvlUpText: string;
  skillIndex: number;
};

type TalentEntry = {
  id: number;
  name: string;
  lvlUpText: string;
  description: string;
  funcX: string;
  x1: number;
  x2: number;
};

type TabEntry = { name: string; talents: TalentEntry[] };

function loadTalentsFromWebsiteData(): Record<string, Record<string, RawTalent>> {
  const json = JSON.parse(readFileSync(WEBSITE_DATA, "utf-8"));
  const out = json.talents;
  if (!out || typeof out !== "object") {
    throw new Error("website-data.json missing `talents` root key");
  }
  return out;
}

function tabsForClass(
  className: string,
  talentsByClass: Record<string, Record<string, RawTalent>>
): TabEntry[] {
  const pages = TALENT_PAGES_MAP[className];
  if (!pages) {
    throw new Error(`No talent pages defined for class "${className}"`);
  }
  const tabs: TabEntry[] = [];
  // Regular class tabs.
  for (const tabName of pages) {
    const raw = talentsByClass[tabName];
    if (!raw) {
      throw new Error(
        `website-data.json has no talents for tab "${tabName}" (needed by class "${className}")`
      );
    }
    const talents: TalentEntry[] = [];
    for (const [, t] of Object.entries(raw)) {
      if (EXCLUDED_IDS.has(t.skillIndex)) continue;
      talents.push({
        id: t.skillIndex,
        name: t.name,
        lvlUpText: t.lvlUpText || "",
        description: t.description || "",
        funcX: t.funcX || "",
        x1: typeof t.x1 === "number" ? t.x1 : 0,
        x2: typeof t.x2 === "number" ? t.x2 : 0,
      });
    }
    tabs.push({ name: tabName, talents });
  }
  // Star talent tabs — same 4 for everyone.
  for (const tabName of STAR_TALENT_TABS) {
    const raw = talentsByClass[tabName];
    if (!raw) continue; // Special Talent 4 has only 4 entries; some tabs may not exist
    const talents: TalentEntry[] = [];
    for (const [, t] of Object.entries(raw)) {
      if (EXCLUDED_IDS.has(t.skillIndex)) continue;
      talents.push({
        id: t.skillIndex,
        name: t.name,
        lvlUpText: t.lvlUpText || "",
        description: t.description || "",
        funcX: t.funcX || "",
        x1: typeof t.x1 === "number" ? t.x1 : 0,
        x2: typeof t.x2 === "number" ? t.x2 : 0,
      });
    }
    tabs.push({ name: tabName, talents });
  }
  return tabs;
}

function main(): void {
  const talentsByClass = loadTalentsFromWebsiteData();

  // Build the full lookup. Keys are PascalCase class names that match what
  // we resolve from `ClassNames[classIdx]` (after the CONSTANT_CASE → Title
  // conversion done in the runtime helper).
  const result: Record<string, { tabs: TabEntry[] }> = {};
  for (const className of Object.keys(TALENT_PAGES_MAP)) {
    result[className] = { tabs: tabsForClass(className, talentsByClass) };
  }

  // Emit. Header is a hand-written banner; the rest is JSON pretty-printed.
  const header = `// AUTO-GENERATED by web/scripts/gen-talent-tabs.ts — do not edit by hand.
// Re-run with: npx tsx web/scripts/gen-talent-tabs.ts
//
// Shape: for each class promotion (Beginner → Voidwalker, etc), the ordered
// list of talent tabs the in-game UI shows, with the talents inside each
// tab. Every class also gets the 4 Special Talent (star talent) tabs at the
// end. The id field IS the numeric talent index our corgan resolvers use.

export type TalentEntry = {
  id: number;
  name: string;
  lvlUpText: string;
  description: string;
  funcX: string;
  x1: number;
  x2: number;
};

export type TalentTab = { name: string; talents: TalentEntry[] };

export type TalentClass = { tabs: TalentTab[] };

export const TALENT_TABS_BY_CLASS: Record<string, TalentClass> = `;

  const json = JSON.stringify(result, null, 2);
  const body = `${header}${json};\n`;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body, "utf-8");

  // Summary
  const classCount = Object.keys(result).length;
  let talentCount = 0;
  for (const c of Object.values(result)) {
    for (const t of c.tabs) talentCount += t.talents.length;
  }
  console.log(`✓ Wrote ${OUT}`);
  console.log(`  Classes: ${classCount}, total talent rows: ${talentCount}`);
}

main();
