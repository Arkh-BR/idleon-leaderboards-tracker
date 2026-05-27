// ===== POPULATE MAX VALUES FROM IT LEADERBOARDS =====
// Reads the catalog (web/data/dr-source-catalog.json) and the latest IT
// leaderboard snapshot (web/data/it-leaderboard-top.json), then writes a
// seed values JSON (web/data/dr-max-values-it-seed.json) in the same
// format the standalone HTML tool's ↓ Import expects.
//
// Only sources with a direct, derivable mapping from a leaderboard board
// get a `maxValue` filled in. Every mapped source records the top-1
// player name in `observedOn` and a one-line formula reference in `notes`
// so the user can sanity-check and refine manually.
//
// Re-run whenever IT data is refreshed (gives a new seed; the HTML's
// Import merges field-by-field so manually-edited entries with extra
// fields don't get clobbered).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const catalogPath = resolve(repoRoot, "web/data/dr-source-catalog.json");
const itPath = resolve(repoRoot, "web/data/it-leaderboard-top.json");
const outPath = resolve(repoRoot, "web/data/dr-max-values-it-seed.json");

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const itData = JSON.parse(readFileSync(itPath, "utf8"));

type SourceEntry = {
  id: string;
  name: string;
  system: string;
  world: string;
  pool: "Additive" | "Multi";
  fmt: "+" | "x" | "raw";
  refValue: number;
  bucket: string;
};

type ValueEntry = {
  maxValue?: number;
  observedOn?: string;
  notes?: string;
  verified?: string;
};

function top1(boardKey: string): { name: string; score: number } | null {
  const b = itData.boards?.[boardKey];
  if (!b || !b.top || b.top.length === 0) return null;
  return { name: b.top[0].name, score: b.top[0].score };
}

function log10(x: number) {
  return Math.log(Math.max(x, 1)) / Math.LN10;
}

const values: Record<string, ValueEntry> = {};

// Helper: find an entry in the catalog by a substring match on its name,
// optionally constrained to a system bucket. Returns the source id or null.
function findSrc(needle: string, system?: string): string | null {
  for (const s of catalog.sources as SourceEntry[]) {
    if (system && s.system !== system) continue;
    if (s.name.includes(needle)) return s.id;
  }
  return null;
}

function setValue(id: string | null, entry: ValueEntry) {
  if (!id) return;
  values[id] = entry;
}

// =============================================================
// 1) Talent 328 — Archlord Of The Pirates (Multi)
//    Formula: total = 1 + (talVal × log10(plunderousKills)) / 100
//    talVal depends on talent level. Use zArkhe's observed talVal (4.846)
//    as a conservative anchor — that already represents a max-level
//    talent on a fully-geared character. Top sbPlunderousKills replaces
//    the kill count.
// =============================================================
{
  const t = top1("sbPlunderousKills");
  if (t) {
    const TAL_VAL = 4.846; // observed at zArkhe (max talent level, full decay)
    const maxMulti = 1 + (TAL_VAL * log10(t.score)) / 100;
    setValue(findSrc("Talent 328", "Talents"), {
      maxValue: maxMulti,
      observedOn: t.name,
      notes:
        `IT top sbPlunderousKills: ${t.score.toLocaleString()}.  ` +
        `Formula: 1 + (talVal × log10(plunder)) / 100; ` +
        `talVal=${TAL_VAL} (max talent level).`,
      verified: "researched",
    });
  }
}

// =============================================================
// 2) Tome 2 — Drop Rate Additive (Tome 2)
//    base = 2 × floor((pts − 8000) / 100)^0.7 then × multi(grim17 + trollSet)
//    Multi unknown without per-player save data — use 1.13 (grim17 maxed +
//    no troll set bonus) as a conservative anchor.
// =============================================================
{
  const t = top1("totalTomePoints");
  if (t) {
    const scaled = Math.max(0, Math.floor((t.score - 8000) / 100));
    const base = 2 * Math.pow(scaled, 0.7);
    const MULTI = 1.13; // grim17 maxed (≈+13%), no troll set
    const val = base * MULTI;
    setValue(findSrc("Tome 2", "Tome"), {
      maxValue: val,
      observedOn: t.name,
      notes:
        `IT top totalTomePoints: ${t.score.toLocaleString()}. ` +
        `base = 2 × floor((pts−8000)/100)^0.7 × multi (multi=${MULTI} for grim17 maxed).`,
      verified: "researched",
    });
  }
}

// =============================================================
// 3) Tome 7 — Drop Rate Multi (Tome 7)
//    base = 3 × floor(pts/1000)^0.3 then × multi(grim17 + trollSet)
// =============================================================
{
  const t = top1("totalTomePoints");
  if (t) {
    const scaled = Math.max(0, Math.floor(t.score / 1000));
    const base = 3 * Math.pow(scaled, 0.3);
    const MULTI = 1.13;
    const val = base * MULTI;
    setValue(findSrc("Tome 7", "Tome"), {
      maxValue: val,
      observedOn: t.name,
      notes:
        `IT top totalTomePoints: ${t.score.toLocaleString()}. ` +
        `base = 3 × floor(pts/1000)^0.3 × multi (multi=${MULTI} for grim17 maxed).`,
      verified: "researched",
    });
  }
}

// =============================================================
// 4) Glimbo DR Multi (Grid 168 — Researching bucket spelled "Glimbo")
//    glimboMulti = 1 + (gridVal × tradeGroups) / 100,
//    tradeGroups = floor(trades / 100),
//    gridVal = 1.525 (level 1 grid 168 with shape +25% × allMulti ≈1.22).
// =============================================================
{
  const t = top1("glimboTotalTrades");
  if (t) {
    const GRID_VAL = 1.525; // zArkhe's grid 168 effective bonus value
    const tradeGroups = Math.floor(t.score / 100);
    const maxMulti = 1 + (GRID_VAL * tradeGroups) / 100;
    setValue(findSrc("Grid 168", "Glimbo"), {
      maxValue: maxMulti,
      observedOn: t.name,
      notes:
        `IT top glimboTotalTrades: ${t.score.toLocaleString()} → ` +
        `${tradeGroups} groups. ` +
        `Formula: 1 + (gridVal × tradeGroups) / 100, gridVal=${GRID_VAL}.`,
      verified: "researched",
    });
  }
}

// =============================================================
// 5) Summoning Win Bonus 9 (Drop Rate Summoning Win)
//    Idleon's win-bonus index 9 threshold scaling — without the exact
//    constants from descriptor, just record the top wins so the user
//    can compute manually. (Score = unique completed runs across all
//    summoning enemies — feeds the win-bonus catalog.)
// =============================================================
{
  const t = top1("endlessSummoningWins");
  if (t) {
    setValue(findSrc("Summoning 9", "Summoning"), {
      observedOn: t.name,
      notes:
        `IT top endlessSummoningWins: ${t.score.toLocaleString()}. ` +
        `Win Bonus 9 (DR) scales with unique-win-count thresholds — ` +
        `compute via getWinBonus / threshold list.`,
    });
  }
}

// =============================================================
// 6) Minehead 0 (DR) — scales with mine floor + opponents defeated.
// =============================================================
{
  const t = top1("mineheadOpponentsDefeated");
  if (t) {
    setValue(findSrc("Minehead 0", "Minehead"), {
      observedOn: t.name,
      notes:
        `IT top mineheadOpponentsDefeated: ${t.score.toLocaleString()}. ` +
        `Bonus scales with current mine floor (stateR7[4]). 19 opponents = ` +
        `current public ceiling.`,
    });
  }
}

// =============================================================
// 7) Shiny Pet / Breeding 0 — total shiny levels feeds the Drop Rate
//    breeding-shiny bonus index 0.
// =============================================================
{
  const t = top1("totalShinyLevels");
  if (t) {
    setValue(findSrc("Breeding 0", "Shiny Pets"), {
      observedOn: t.name,
      notes:
        `IT top totalShinyLevels: ${t.score.toLocaleString()}. ` +
        `breeding system maps shiny-pet levels to per-bonus index 0 (DR).`,
    });
  }
}

// =============================================================
// 8) Sanity reference — the dropRate leaderboard top-1 is the absolute
//    end-game ceiling. Not a "per-source max", but useful as a footer
//    note in the JSON.
// =============================================================
const drTop = top1("dropRate");
const drCitation = drTop
  ? `IT top character/dropRate: ${drTop.name} = ${drTop.score.toFixed(3)}x`
  : "IT top character/dropRate unavailable";

// =============================================================
// Write the seed in the HTML tool's import format
// =============================================================
const payload = {
  schema: "dr-max-values",
  version: 1,
  generatedAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  source: "Seeded from IT leaderboards top-1 (fetch-it-leaderboards.ts).",
  drTopReference: drCitation,
  values,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log(`✓ Wrote ${outPath}`);
console.log(`  Seeded ${Object.keys(values).length} entries`);
console.log(`  Reference: ${drCitation}`);
console.log("");
console.log("To use:");
console.log("  1. Open web/public/dr-max-values.html in your browser");
console.log("  2. Click ↓ Import and select dr-max-values-it-seed.json");
console.log("  3. Field-merge — manual entries with extra fields stay intact");
