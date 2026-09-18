// Refresh the bundled top-player Tome snapshot in lib/tome/topPlayers.ts by
// fetching each top player's raw save from the IT profiles API and running
// OUR tome engine on it (the same rules /tome and the golden harness use).
//
// Until 2026-09 this scraped the rendered idleontoolbox.com tome page in
// headless Chromium. Its DOM matcher was pinned to exactly 118 task cards, so
// from the 2026-08-25 update (121 tasks) on it silently scraped 0 / 80
// players every run and only bumped the timestamp — the cron looked green
// while the snapshot stayed frozen at 2026-08-28. Computing from the raw
// save has no DOM to break, needs no browser, and scores every player by the
// CURRENT game rules (a profile's stored parsedData.tomePoints is frozen at
// upload time, e.g. Unique Sushi max 63 vs the live 64).
//
// Pipeline:
//   1. Candidates = top 1 of every leaderboard + top 10 of totalTomePoints
//      (shared gatherCandidates: anonymous + denylisted players excluded).
//   2. fetchProfileSave(name) → computeTome(save) with the IT override
//      stripped, so pts come from our per-task computation.
//   3. Aggregate the best per task: highest pts; ties → the more impressive
//      raw (lower for the x2 = 3 "fastest time" curves, higher otherwise).
//   4. Preserve the per-task classification values, overwrite the file.
//
// Run:  npx tsx web/scripts/update-top-players.ts
// Knobs: --limit N   cap candidate set (smoke test; relaxes the min-players guard)
//        --slow      1500ms between players (be extra nice to IT)
//        --dry       compute + report, do not write the file
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeTome } from "../lib/tome/compute";
import { TOME_TASKS } from "../lib/tome/tasks";
import { TOP_PLAYERS } from "../lib/tome/topPlayers";

const g = globalThis as any;
if (!g.window) g.window = g;

const OUTPUT_FILE = join(__dirname, "..", "lib", "tome", "topPlayers.ts");

const args = new Set(process.argv.slice(2));
const SLOW = args.has("--slow");
const DRY = args.has("--dry");
const THROTTLE_MS = SLOW ? 1500 : 500;
const LIMIT = (() => {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === "--limit");
  if (idx >= 0 && argv[idx + 1]) return Number(argv[idx + 1]) || null;
  return null;
})();
// A snapshot built from a handful of players would silently DOWNGRADE every
// task the missing players led — refuse to write one. --limit is a smoke
// test and relaxes this.
const MIN_PLAYERS = LIMIT ? 1 : 10;
// Our engine covers every task unless an extractor returns null; a player
// with far fewer rows means the save is incomplete/private-shaped.
const MIN_TASKS = 100;

// ───────────────────────────────────────────────────── compute one player

type PlayerTask = { task: string; raw: number; pts: number; inverted: boolean };
type PlayerResult = { player: string; totalPts: number; tasks: PlayerTask[] };

function computePlayer(name: string, save: any): PlayerResult {
  // computeTome overwrites its own per-task pts with parsedData.tomePoints
  // when the envelope carries them (so /tome matches idleontoolbox.com for
  // the player's own upload). For the snapshot every player must be scored
  // by the same, current rules — strip the override like the golden does.
  const input =
    save && save.parsedData
      ? { ...save, parsedData: { ...save.parsedData, tomePoints: undefined } }
      : save;
  const res = computeTome(input);
  const tasks: PlayerTask[] = [];
  for (const r of res.rows) {
    if (r.pts === null || r.rawValue === null || !Number.isFinite(r.rawValue)) continue;
    tasks.push({
      task: r.task,
      raw: r.rawValue,
      pts: r.pts,
      // x2 = 3 → inverted curve (lower raw is better).
      inverted: r.bonus?.[1] === 3,
    });
  }
  return { player: name, totalPts: res.totalPts, tasks };
}

// ────────────────────────────────────────────────────────────── aggregate

type AggEntry = {
  player: string;
  raw: number;
  pts: number;
  date: string; // MM/DD/YYYY to match the existing file
};

function aggregateBestPerTask(results: PlayerResult[]): Map<string, AggEntry> {
  const best = new Map<string, AggEntry>();
  const today = new Date();
  const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

  for (const res of results) {
    for (const t of res.tasks) {
      const cur = best.get(t.task);
      if (
        !cur ||
        t.pts > cur.pts ||
        (t.pts === cur.pts && (t.inverted ? t.raw < cur.raw : t.raw > cur.raw))
      ) {
        best.set(t.task, { player: res.player, raw: t.raw, pts: t.pts, date: dateStr });
      }
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────── emit file

function fmtNum(v: number | null): string {
  return v === null || !Number.isFinite(v) ? "null" : String(v);
}

function emitTopPlayersFile(best: Map<string, AggEntry>, totalScanned: number): string {
  // In-game task order first, then any legacy key the task list no longer
  // carries (kept so a renamed task never silently loses its classification).
  const allTaskNames = [
    ...TOME_TASKS,
    ...Object.keys(TOP_PLAYERS).filter((k) => !(TOME_TASKS as readonly string[]).includes(k)),
  ];

  const lines: string[] = [];
  lines.push(
    "// Top-player tome snapshot + per-task classification. Bundled static data,",
    "// auto-refreshed by scripts/update-top-players.ts: it fetches each top",
    "// player's raw save from the IT profiles API and scores it with our tome",
    "// engine (lib/tome/compute.ts), so every entry follows the current game rules.",
    "//",
    `// Snapshot generated: ${new Date().toISOString()}`,
    "// Source: https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=<name> → computeTome()",
    `// Players scanned: ${totalScanned}`,
    "",
    "// Classification is the user-defined tag from column D of the original sheet.",
    "// Numbers are arbitrary IDs that map to semantic labels.",
    "export const CLASSIFICATION_LABELS: Readonly<Record<number, string>> = {",
    '  1: "Priority",',
    '  3: "Doable",',
    '  4: "Time Gated",',
    '  5: "Lucky Gated",',
    '  9: "Update Gated",',
    '  12: "Capped",',
    "};",
    "",
    "export type TopPlayerEntry = {",
    "  date: string;",
    "  player: string;",
    "  raw: number | null;",
    "  pts: number | null;",
    "  classification: number | null;",
    "};",
    "",
    "export const TOP_PLAYERS: Readonly<Record<string, TopPlayerEntry>> = {"
  );

  for (const task of allTaskNames) {
    const fresh = best.get(task);
    const old = TOP_PLAYERS[task];
    const classification = old?.classification ?? null;
    const cls = classification === null ? "null" : String(classification);
    if (fresh) {
      lines.push(
        `  ${JSON.stringify(task)}: { date: ${JSON.stringify(fresh.date)}, player: ${JSON.stringify(fresh.player)}, raw: ${fmtNum(fresh.raw)}, pts: ${fmtNum(fresh.pts)}, classification: ${cls} },`
      );
    } else if (old) {
      lines.push(
        `  ${JSON.stringify(task)}: { date: ${JSON.stringify(old.date)}, player: ${JSON.stringify(old.player)}, raw: ${fmtNum(old.raw)}, pts: ${fmtNum(old.pts)}, classification: ${cls} },`
      );
    }
  }

  lines.push("};", "");
  return lines.join("\n");
}

// ────────────────────────────────────────────────────────── main

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\n→ Fetching top players across the leaderboard categories…");
  const candidates = await gatherCandidates({
    focusBoard: "totalTomePoints",
    limit: LIMIT ?? undefined,
  });
  console.log(`  ✓ ${candidates.length} unique candidates`);
  if (candidates.length === 0) {
    console.error("× no candidates found, aborting");
    process.exit(1);
  }

  const results: PlayerResult[] = [];
  let skipped = 0;
  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const tag = `[${i + 1}/${candidates.length}]`;
    process.stdout.write(`  ${tag} ${name.padEnd(20)}`);
    try {
      const save = await fetchProfileSave(name);
      if (!save) {
        console.log("  · skipped (private/not found)");
        skipped++;
      } else {
        const res = computePlayer(name, save);
        if (res.tasks.length < MIN_TASKS) {
          console.log(`  · skipped (only ${res.tasks.length} tasks computed)`);
          skipped++;
        } else {
          console.log(`  ✓ ${res.tasks.length} tasks, total ${res.totalPts}`);
          results.push(res);
        }
      }
    } catch (e) {
      console.log(`  × error: ${(e as Error).message}`);
      skipped++;
    }
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  console.log(`\n✓ Computed ${results.length} / ${candidates.length} players (${skipped} skipped)`);
  if (results.length < MIN_PLAYERS) {
    console.error(
      `× only ${results.length} player(s) computed (need ${MIN_PLAYERS}) — refusing to write a degraded snapshot`
    );
    process.exit(1);
  }

  const best = aggregateBestPerTask(results);
  console.log(`  · ${best.size} / ${TOME_TASKS.length} tasks have a fresh top entry`);
  const bestTotal = results.reduce((m, r) => (r.totalPts > m.totalPts ? r : m), results[0]);
  console.log(`  · best single player: ${bestTotal.player} (${bestTotal.totalPts} pts)`);

  const text = emitTopPlayersFile(best, results.length);
  if (DRY) {
    console.log("\n(--dry) not writing. Preview of the first rows:");
    console.log(text.split("\n").slice(29, 37).join("\n"));
    return;
  }
  writeFileSync(OUTPUT_FILE, text);
  console.log(`\n✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
