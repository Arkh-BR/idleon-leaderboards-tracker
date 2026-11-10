// ===== TALENT TABS GENERATOR =====
// One-shot script: reads the game's talent lists (N.js-derived
// web/lib/game/data/generated/customlists.js: ClassNames, TalentOrder,
// TalentIconNames, TalentDescriptions) and emits a strongly-typed lookup
// table `talentTabsByClass` that the /talents-level page uses to build the
// visual picker.
//
// Run with: `npx tsx web/scripts/gen-talent-tabs.ts`
//
// Output: web/lib/talentsLevel/talentTabs.gen.ts (~30KB, committed).
//
// Why this lives in a gen script instead of being parsed at runtime: the
// game lists are a few MB and we only need a tiny slice of them.
// Generating once at build time keeps the runtime bundle small. Re-run after
// the updater regenerates the game data.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as LISTS from "@/lib/game/data/generated/customlists.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");
const OUT = join(REPO, "web", "lib", "talentsLevel", "talentTabs.gen.ts");

// Class → ordered list of tabs (the user's class promotion chain, per the
// game's ClassPromotionChoices), starting with the Rage_Basics / Calm_Basics /
// Savvy_Basics branch headers that the in-game UI shows.
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
  // Royal Guardian (2026-08-25): Divine Knight's promotion
  // (ClassPromotionChoices[12] = ["16"]).
  Royal_Guardian: [
    "Rage_Basics",
    "Warrior",
    "Squire",
    "Divine_Knight",
    "Royal_Guardian",
  ],
};

const L = LISTS as unknown as {
  ClassNames: string[];
  TalentOrder: (number | string)[];
  TalentIconNames: string[];
  TalentDescriptions: unknown[][][];
};

// A tab is a run of TalentOrder SLOTS (slot → talent id; "_" names are empty
// slots). Class tab c (its ClassNames index) = 15 slots from (c - 1) * 15 —
// Beginner (1) = 0..14, Royal Guardian (16) = 225..239. The star talent pages
// follow at slot 615, 13 slots each.
function tabSlots(tabName: string): [number, number] {
  const star = STAR_TALENT_TABS.indexOf(tabName);
  if (star >= 0) return [615 + 13 * star, 615 + 13 * star + 12];
  const c = L.ClassNames.indexOf(tabName.toUpperCase());
  if (c < 1) throw new Error(`No ClassNames entry for tab "${tabName}"`);
  return [(c - 1) * 15, (c - 1) * 15 + 14];
}

function buildTab(tabName: string): TabEntry {
  const [first, last] = tabSlots(tabName);
  const talents: TalentEntry[] = [];
  for (let slot = first; slot <= last; slot++) {
    const id = Number(L.TalentOrder[slot]);
    const name = String(L.TalentIconNames[id] ?? "_");
    if (!name || name === "_" || EXCLUDED_IDS.has(id)) continue;
    const d = (L.TalentDescriptions[id] as unknown[][]) || [];
    const params = (d[1] as string[]) || [];
    talents.push({
      id,
      name,
      lvlUpText: String((d[2] as string[])?.[0] ?? ""),
      description: String((d[0] as string[])?.[0] ?? ""),
      funcX: String(params[2] ?? ""),
      x1: Number(params[0]) || 0,
      x2: Number(params[1]) || 0,
    });
  }
  return { name: tabName, talents };
}

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

function tabsForClass(className: string): TabEntry[] {
  const pages = TALENT_PAGES_MAP[className];
  if (!pages) {
    throw new Error(`No talent pages defined for class "${className}"`);
  }
  // Regular class tabs, then the star talent tabs — same 4 for everyone.
  return [...pages, ...STAR_TALENT_TABS].map(buildTab);
}

async function main(): Promise<void> {
  // Build the full lookup. Keys are PascalCase class names that match what
  // we resolve from `ClassNames[classIdx]` (after the CONSTANT_CASE → Title
  // conversion done in the runtime helper).
  const result: Record<string, { tabs: TabEntry[] }> = {};
  for (const className of Object.keys(TALENT_PAGES_MAP)) {
    result[className] = { tabs: tabsForClass(className) };
  }

  // Emit. Header is a hand-written banner; the rest is JSON pretty-printed.
  const header = `// AUTO-GENERATED by web/scripts/gen-talent-tabs.ts — do not edit by hand.
// Re-run with: npx tsx web/scripts/gen-talent-tabs.ts
//
// Shape: for each class promotion (Beginner → Voidwalker, etc), the ordered
// list of talent tabs the in-game UI shows, with the talents inside each
// tab. Every class also gets the 4 Special Talent (star talent) tabs at the
// end. The id field IS the game's numeric talent index.

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
