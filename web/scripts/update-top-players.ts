// Refresh the bundled top-player snapshot in lib/tome/topPlayers.ts by
// scraping the IT profile pages of the actual top players.
//
// Pipeline:
//   1. Hit profiles.idleontoolbox.workers.dev for each of the 153 leaderboard
//      categories to get top-N per board.
//   2. Build a deduped candidate set: top 1 of every board + top 10 of the
//      "totalTomePoints" board (the one the user actually cares about).
//      Anonymous players (Anon#xxxxxx) are excluded since their profiles
//      are not publicly viewable.
//   3. Open each candidate's tome page in headless Chromium and scrape the
//      118-row task list off the rendered DOM.
//   4. Aggregate the best per task (highest pts; for ties, the more
//      impressive raw — higher for ascending curves, lower for inverted).
//   5. Preserve the existing per-task classification values so user-curated
//      tags survive the refresh, then overwrite the snapshot file.
//
// Run with:  npx tsx scripts/update-top-players.ts
//
// Knobs:
//   --limit N    cap candidate set to first N players (for smoke testing)
//   --headed     run Chromium with UI (debugging)
//   --slow       throttle to 1500ms between players (be extra nice to IT)

import { chromium, type Browser, type Page } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "../lib/registry";
import { TOP_PLAYERS } from "../lib/tome/topPlayers";

const IT_API =
  "https://profiles.idleontoolbox.workers.dev/api/leaderboards";
const TOME_URL = (name: string) =>
  `https://idleontoolbox.com/account/world-4/tome?profile=${encodeURIComponent(name)}`;
const OUTPUT_FILE = join(__dirname, "..", "lib", "tome", "topPlayers.ts");

const HEADERS = {
  Referer: "https://idleontoolbox.com/",
  "User-Agent":
    "Mozilla/5.0 (compatible; IdleonTrackersScraper/1.0; +https://github.com/Arkh-BR/idleon-leaderboards-tracker)",
};

const args = new Set(process.argv.slice(2));
const HEADED = args.has("--headed");
const SLOW = args.has("--slow");
const THROTTLE_MS = SLOW ? 1500 : 500;
const LIMIT = (() => {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === "--limit");
  if (idx >= 0 && argv[idx + 1]) return Number(argv[idx + 1]) || null;
  return null;
})();

// ───────────────────────────────────────────────────────────────── leaderboards

type TopEntry = { mainChar?: string; rank?: number; [k: string]: unknown };
type CategoryTopResponse = Record<
  string,
  { public?: Record<string, TopEntry[]> } | undefined
>;

async function fetchCategoryTop(
  category: string
): Promise<Record<string, TopEntry[]>> {
  const url = `${IT_API}?leaderboard=${encodeURIComponent(category)}`;
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`top ${category}: HTTP ${r.status}`);
  const data = (await r.json()) as CategoryTopResponse;
  return data[category]?.public ?? {};
}

function isAnonymous(name: string): boolean {
  return name.startsWith("Anon#") || name.startsWith("Anon ") || !name.trim();
}

async function gatherCandidates(): Promise<string[]> {
  console.log(`\n→ Fetching top players across ${CATEGORIES.length} categories…`);
  const candidates = new Set<string>();
  const tomeBoard: TopEntry[] = [];

  for (const cat of CATEGORIES) {
    try {
      const boards = await fetchCategoryTop(cat.key);
      for (const board of cat.boards) {
        const list = boards[board.apiKey] ?? [];
        // Top 1 of every board
        const top1 = list[0]?.mainChar?.trim();
        if (top1 && !isAnonymous(top1)) candidates.add(top1);
        // Snapshot the totalTomePoints board for top 10
        if (board.apiKey === "totalTomePoints") {
          tomeBoard.push(...list);
        }
      }
    } catch (e) {
      console.warn(`  × category ${cat.key} failed:`, (e as Error).message);
    }
  }

  // Top 10 of the tome board specifically
  for (const entry of tomeBoard.slice(0, 10)) {
    const name = entry.mainChar?.trim();
    if (name && !isAnonymous(name)) candidates.add(name);
  }

  let names = [...candidates].sort();
  if (LIMIT) names = names.slice(0, LIMIT);
  console.log(`  ✓ ${names.length} unique candidates`);
  return names;
}

// ──────────────────────────────────────────────────────── idleon number parser

// IT uses K/M/B/T/Q/QQ/QQQ for magnitudes plus scientific E notation past 10^25.
function parseIdleonNumber(raw: string): number {
  const s = raw.trim().replace(/,/g, "");
  if (s === "" || s === "—" || s === "-") return NaN;
  // Scientific: "4.79E56"
  if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) return Number(s);
  // Suffixed: "149B", "553Q", "5105M"
  const m = s.match(/^(-?\d+(?:\.\d+)?)(K|M|B|T|Q|QQ|QQQ|QQQQ|QQQQQ)$/i);
  if (m) {
    const n = Number(m[1]);
    const mult: Record<string, number> = {
      K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15,
      QQ: 1e18, QQQ: 1e21, QQQQ: 1e24, QQQQQ: 1e27,
    };
    return n * mult[m[2].toUpperCase()];
  }
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

// ─────────────────────────────────────────────────────── scrape one player

type ScrapedTask = { task: string; raw: number; pts: number };
type ScrapeResult = {
  player: string;
  totalPts: number;
  tasks: ScrapedTask[];
} | null;

async function scrapePlayer(page: Page, name: string): Promise<ScrapeResult> {
  await page.goto(TOME_URL(name), { waitUntil: "domcontentloaded", timeout: 30_000 });
  // Wait until the page rendered all 118 task cards (Firestore Listen channel
  // streams the data in after JS hydrates). Cap at 20s.
  try {
    await page.waitForFunction(
      () => {
        const matches =
          (document.body.innerText.match(/\d+,?\d* PTS/g) || []).length;
        return matches >= 100; // 118 in full, but accept some slack
      },
      { timeout: 20_000 }
    );
  } catch {
    // Either private / not found / IT rate-limited us — skip silently.
    return null;
  }

  const scraped = await page.evaluate(() => {
    const allDivs = [...document.querySelectorAll("div")];
    const container = allDivs.find((el) => {
      const matches = (el.textContent || "").match(/\d+,?\d* PTS/g) || [];
      return (
        matches.length === 118 &&
        el.children.length >= 100 &&
        el.children.length <= 200
      );
    });
    if (!container) return null;
    const totalMatch =
      document.body.innerText.match(/Total Points\s*([\d,]+)/);
    const totalPts = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 0;
    const tasks = [...container.children]
      .map((el) => {
        const lines = (el as HTMLElement).innerText
          .trim()
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length < 3) return null;
        // Last line is "X PTS", penultimate-ish is raw qty, first is name
        const ptsMatch = lines[lines.length - 1].match(/^([\d,]+)\s*PTS$/i);
        if (!ptsMatch) return null;
        const pts = Number(ptsMatch[1].replace(/,/g, ""));
        const rawStr = lines[lines.length - 2];
        // Task name is everything up to the raw — usually line 0, but some
        // tasks have multi-word names that wrap, so join all leading lines.
        const taskName = lines.slice(0, lines.length - 2).join(" ");
        return { task: taskName, rawStr, pts };
      })
      .filter(Boolean);
    return { totalPts, tasks };
  });

  if (!scraped) return null;

  // Parse raw numbers outside browser context (parseIdleonNumber is Node-side).
  const tasks = scraped.tasks
    .map((t) => {
      if (!t) return null;
      const raw = parseIdleonNumber(t.rawStr);
      return { task: t.task, raw, pts: t.pts };
    })
    .filter((t): t is ScrapedTask => t !== null && !Number.isNaN(t.raw));

  return { player: name, totalPts: scraped.totalPts, tasks };
}

// ────────────────────────────────────────────────────────────── aggregate

const INVERTED_TASK_NAMES = new Set<string>(
  // Curves with x2=3 — lower raw wins. Pulled from the task list explicitly
  // so we don't have to depend on the bonus table here. Update if Lava adds
  // more "Fastest Time" tasks.
  [
    "Fastest Time to kill Chaotic Efaunt (in Seconds)",
    "Fastest Time reaching Round 100 Arena (in Seconds)",
    "Fastest Time to Kill 200 Tremor Wurms (in Seconds)",
    "Total Gambit Time (in Seconds)",
  ]
);

type AggEntry = {
  player: string;
  raw: number;
  pts: number;
  date: string; // ISO -> formatted as MM/DD/YYYY to match the existing file
};

function aggregateBestPerTask(
  scrapes: NonNullable<ScrapeResult>[]
): Map<string, AggEntry> {
  const best = new Map<string, AggEntry>();
  const today = new Date();
  const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

  for (const scrape of scrapes) {
    for (const t of scrape.tasks) {
      const cur = best.get(t.task);
      if (
        !cur ||
        t.pts > cur.pts ||
        (t.pts === cur.pts &&
          (INVERTED_TASK_NAMES.has(t.task) ? t.raw < cur.raw : t.raw > cur.raw))
      ) {
        best.set(t.task, {
          player: scrape.player,
          raw: t.raw,
          pts: t.pts,
          date: dateStr,
        });
      }
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────── emit file

function emitTopPlayersFile(
  best: Map<string, AggEntry>,
  totalScanned: number
): void {
  // Preserve existing classifications + retain tasks we didn't see in any
  // scrape (e.g. event-gated tasks not yet present in any top player).
  const allTaskNames = new Set<string>([
    ...Object.keys(TOP_PLAYERS),
    ...best.keys(),
  ]);

  const lines: string[] = [];
  lines.push(
    "// Top-player tome snapshot + per-task classification. Bundled static data,",
    "// auto-refreshed by scripts/update-top-players.ts. Run that script to",
    "// re-scrape the IT profile pages of the current top players.",
    "//",
    `// Snapshot generated: ${new Date().toISOString()}`,
    `// Source: scraped from https://idleontoolbox.com/account/world-4/tome?profile=<name>`,
    `// Players scanned: ${totalScanned}`,
    "",
    "// Classification is the user-defined tag from column D of the original sheet.",
    "// Numbers are arbitrary IDs that map to semantic labels.",
    'export const CLASSIFICATION_LABELS: Readonly<Record<number, string>> = {',
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
    if (fresh) {
      const rawStr =
        fresh.raw === null
          ? "null"
          : Number.isFinite(fresh.raw)
            ? String(fresh.raw)
            : "null";
      const ptsStr = fresh.pts === null ? "null" : String(fresh.pts);
      lines.push(
        `  ${JSON.stringify(task)}: { date: ${JSON.stringify(fresh.date)}, player: ${JSON.stringify(fresh.player)}, raw: ${rawStr}, pts: ${ptsStr}, classification: ${classification === null ? "null" : String(classification)} },`
      );
    } else if (old) {
      const rawStr = old.raw === null ? "null" : String(old.raw);
      const ptsStr = old.pts === null ? "null" : String(old.pts);
      lines.push(
        `  ${JSON.stringify(task)}: { date: ${JSON.stringify(old.date)}, player: ${JSON.stringify(old.player)}, raw: ${rawStr}, pts: ${ptsStr}, classification: ${classification === null ? "null" : String(classification)} },`
      );
    }
  }

  lines.push("};", "");
  writeFileSync(OUTPUT_FILE, lines.join("\n"));
  console.log(`\n✓ Wrote ${OUTPUT_FILE}`);
}

// ────────────────────────────────────────────────────────── main

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const candidates = await gatherCandidates();
  if (candidates.length === 0) {
    console.error("× no candidates found, aborting");
    process.exit(1);
  }

  console.log(`\n→ Launching headless Chromium (${HEADED ? "headed" : "headless"})…`);
  const browser: Browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    userAgent: HEADERS["User-Agent"],
  });
  const page = await context.newPage();

  const results: NonNullable<ScrapeResult>[] = [];
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const tag = `[${i + 1}/${candidates.length}]`;
    process.stdout.write(`  ${tag} ${name.padEnd(20)}`);
    try {
      const res = await scrapePlayer(page, name);
      if (!res || res.tasks.length < 100) {
        console.log(`  · skipped (private/not found/incomplete)`);
        skipped++;
      } else {
        console.log(`  ✓ ${res.tasks.length} tasks, total ${res.totalPts}`);
        results.push(res);
      }
    } catch (e) {
      console.log(`  × error: ${(e as Error).message}`);
      skipped++;
    }
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  await browser.close();

  console.log(
    `\n✓ Scraped ${results.length} / ${candidates.length} players (${skipped} skipped)`
  );

  const best = aggregateBestPerTask(results);
  console.log(`  · ${best.size} / 118 tasks have a fresh top entry`);

  emitTopPlayersFile(best, results.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
