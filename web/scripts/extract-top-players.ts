// Parses scripts/best-tome-sheet.csv (exported from the Google Sheet's
// BEST TOME tab) and emits lib/tome/topPlayers.ts with the per-task
// top-player snapshot (Date, Name, raw, pts) as bundled static data.
//
// Usage:  npx tsx scripts/extract-top-players.ts
// Once the IT scraper exists, this file can be regenerated to keep the
// snapshot fresh, or replaced by live data.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const csvPath = join(__dirname, "best-tome-sheet.csv");
const csv = readFileSync(csvPath, "utf8");

// Tiny CSV parser that handles quoted fields with embedded commas.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const rows = parseCsv(csv);

// Row 2 = headers, rows 3..N = task data (one per task).
// Per row:
//   col 3  = classification number (1/3/4/5/9/12) — user-defined tag
//   col 4  = task name
//   col 10 = date the top-player datapoint was captured
//   col 11 = top player name
//   col 13 = top player's pts for this task
//   col 14 = top player's raw value (numeric, unformatted)
type Entry = {
  task: string;
  classification: number | null;
  date: string;
  player: string;
  raw: number | null;
  pts: number | null;
};

const entries: Entry[] = [];
for (let i = 2; i < rows.length; i++) {
  const row = rows[i];
  const task = (row[4] || "").trim();
  if (!task) continue;
  const classStr = (row[3] || "").trim();
  const classification =
    classStr === "" ? null : Number.isFinite(Number(classStr)) ? Number(classStr) : null;
  const date = (row[10] || "").trim();
  const player = (row[11] || "").trim();
  const ptsStr = (row[13] || "").trim();
  const rawStr = (row[14] || "").trim();
  const pts = ptsStr === "" ? null : Number(ptsStr.replace(/,/g, ""));
  const raw = rawStr === "" ? null : Number(rawStr.replace(/,/g, ""));
  entries.push({
    task,
    classification,
    date: date || "",
    player: player || "",
    raw: raw !== null && isFinite(raw) ? raw : null,
    pts: pts !== null && isFinite(pts) ? pts : null,
  });
}

console.log(`Parsed ${entries.length} task entries.`);
console.log(`With pts:    ${entries.filter((e) => e.pts !== null).length}`);
console.log(`With raw:    ${entries.filter((e) => e.raw !== null).length}`);
console.log(`With player: ${entries.filter((e) => e.player !== "").length}`);
console.log(`Total pts (sum):`, entries.reduce((s, e) => s + (e.pts || 0), 0));

// Print a few sanity-check rows.
console.log("\nFirst 5:");
for (const e of entries.slice(0, 5)) console.log("  ", JSON.stringify(e));

// Emit TS module keyed by task name.
const out = [
  "// Top-player tome snapshot + per-task classification. Bundled static data,",
  "// manually refreshed from the Google Sheet's BEST TOME tab via",
  "// scripts/extract-top-players.ts. Will be replaced by a live IT scraper",
  "// in a follow-up.",
  "//",
  `// Snapshot generated: ${new Date().toISOString()}`,
  `// Source: docs.google.com/spreadsheets/d/1Lhr2-S8EBzghzuJCEfiSp3ByrjHxO7CHKac03rAIcCY/edit#gid=105801712`,
  "",
  "// Classification is the user-defined tag from column D of the sheet.",
  "// Numbers are arbitrary IDs that map to semantic labels (see legend).",
  "// Quote from the sheet: \"The classification is personal, if u want to",
  "// change something, change the number in column D\".",
  "export const CLASSIFICATION_LABELS: Readonly<Record<number, string>> = {",
  "  1: \"Priority\",",
  "  3: \"Doable\",",
  "  4: \"Time Gated\",",
  "  5: \"Lucky Gated\",",
  "  9: \"Update Gated\",",
  "  12: \"Capped\",",
  "};",
  "",
  "export type TopPlayerEntry = {",
  "  date: string;                       // e.g. '05/20/2026' (when this datapoint was captured)",
  "  player: string;                     // top player's main char name",
  "  raw: number | null;                 // their raw value for the task",
  "  pts: number | null;                 // their tome pts on this task (often capped at maxPts)",
  "  classification: number | null;      // user-defined tier id (see CLASSIFICATION_LABELS)",
  "};",
  "",
  "// Keyed by task name (matches TOME_TASKS entries).",
  "export const TOP_PLAYERS: Readonly<Record<string, TopPlayerEntry>> = {",
];
for (const e of entries) {
  out.push(
    `  ${JSON.stringify(e.task)}: { date: ${JSON.stringify(e.date)}, player: ${JSON.stringify(e.player)}, raw: ${e.raw === null ? "null" : String(e.raw)}, pts: ${e.pts === null ? "null" : String(e.pts)}, classification: ${e.classification === null ? "null" : String(e.classification)} },`
  );
}
out.push("};", "");

const tsPath = join(__dirname, "..", "lib", "tome", "topPlayers.ts");
writeFileSync(tsPath, out.join("\n"));
console.log(`\nWrote ${tsPath} (${entries.length} entries)`);
