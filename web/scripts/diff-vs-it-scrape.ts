// Side-by-side diff: our local computeTome output vs what the IT WEBSITE
// renders for the same player (scraped via Playwright). Useful for hunting
// extractor bugs that only show up when comparing against ground truth.
//
// Usage:
//   npx tsx scripts/diff-vs-it-scrape.ts <player> <path-to-save.json>

import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { computeTome } from "../lib/tome/compute";

const player = process.argv[2];
const savePath = process.argv[3];
if (!player || !savePath) {
  console.error("Usage: npx tsx scripts/diff-vs-it-scrape.ts <player> <save.json>");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (compatible; IdleonTrackersScraper/1.0; +https://github.com/Arkh-BR/idleon-leaderboards-tracker)";

function parseIdleonNumber(raw: string): number {
  const s = raw.trim().replace(/,/g, "");
  if (s === "" || s === "—" || s === "-") return NaN;
  if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) return Number(s);
  const m = s.match(/^(-?\d+(?:\.\d+)?)(K|M|B|T|Q|QQ|QQQ|QQQQ|QQQQQ)$/i);
  if (m) {
    const mult: Record<string, number> = {
      K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15,
      QQ: 1e18, QQQ: 1e21, QQQQ: 1e24, QQQQQ: 1e27,
    };
    return Number(m[1]) * mult[m[2].toUpperCase()];
  }
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

async function scrapeFromIT(name: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA });
  try {
    await page.goto(
      `https://idleontoolbox.com/account/world-4/tome?profile=${encodeURIComponent(name)}`,
      { waitUntil: "domcontentloaded", timeout: 30_000 }
    );
    await page.waitForFunction(
      () => (document.body.innerText.match(/\d+,?\d* PTS/g) || []).length >= 100,
      { timeout: 25_000 }
    );
    return await page.evaluate(() => {
      const allDivs = [...document.querySelectorAll("div")];
      const container = allDivs.find((el) => {
        const matches = (el.textContent || "").match(/\d+,?\d* PTS/g) || [];
        return matches.length === 118 && el.children.length >= 100 && el.children.length <= 200;
      });
      if (!container) return null;
      const totalMatch = document.body.innerText.match(/Total Points\s*([\d,]+)/);
      const tasks = [...container.children]
        .map((el) => {
          const lines = (el as HTMLElement).innerText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
          if (lines.length < 3) return null;
          const ptsMatch = lines[lines.length - 1].match(/^([\d,]+)\s*PTS$/i);
          if (!ptsMatch) return null;
          return {
            task: lines.slice(0, lines.length - 2).join(" "),
            rawStr: lines[lines.length - 2],
            pts: Number(ptsMatch[1].replace(/,/g, "")),
          };
        })
        .filter(Boolean);
      return {
        total: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 0,
        tasks,
      };
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`→ Scraping IT for ${player}…`);
  const itData = await scrapeFromIT(player);
  if (!itData) {
    console.error("× Failed to scrape IT (profile private or missing?)");
    process.exit(1);
  }
  console.log(`  ✓ IT total: ${itData.total}, ${itData.tasks.length} tasks`);

  console.log(`→ Computing locally from ${savePath}…`);
  const raw = readFileSync(savePath, "utf8");
  const ours = computeTome(raw);
  console.log(`  ✓ Our total: ${ours.totalPts}, ${ours.coveredCount}/${ours.rows.length} computed`);

  const itMap = new Map<string, { raw: number; pts: number; rawStr: string }>();
  for (const t of itData.tasks) {
    if (!t) continue;
    itMap.set(t.task, { raw: parseIdleonNumber(t.rawStr), pts: t.pts, rawStr: t.rawStr });
  }

  type Diff = {
    task: string;
    ourRaw: number | null;
    itRaw: number;
    itRawStr: string;
    ourPts: number | null;
    itPts: number;
    source: string;
  };
  const diffs: Diff[] = [];
  for (const r of ours.rows) {
    const it = itMap.get(r.task);
    if (!it) continue;
    const ourRawNum = r.rawValue === null ? null : Number(r.rawValue);
    const rawDiffers =
      ourRawNum !== null &&
      Math.abs(ourRawNum - it.raw) / Math.max(1, Math.abs(it.raw)) > 0.001;
    const ptsDiffers = (r.pts ?? 0) !== it.pts;
    if (rawDiffers || ptsDiffers) {
      diffs.push({
        task: r.task,
        ourRaw: ourRawNum,
        itRaw: it.raw,
        itRawStr: it.rawStr,
        ourPts: r.pts,
        itPts: it.pts,
        source: r.source,
      });
    }
  }

  console.log(`\n→ ${diffs.length} tasks with discrepancies (out of ${ours.rows.length})`);
  console.log(
    `Total pts: ours=${ours.totalPts} | IT=${itData.total} | Δ=${itData.total - ours.totalPts}\n`
  );

  diffs.sort(
    (a, b) =>
      Math.abs(b.itPts - (b.ourPts ?? 0)) - Math.abs(a.itPts - (a.ourPts ?? 0))
  );

  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  const fmtNum = (v: number | null) =>
    v === null
      ? "—"
      : Number.isFinite(v)
        ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
        : String(v);

  console.log(
    pad("Task", 50) + "| " +
    pad("Our raw", 15) + "| " +
    pad("IT raw", 15) + "| " +
    pad("Our pts", 7) + "| " +
    pad("IT pts", 6) + "| " +
    pad("Δpts", 5) + "| Source"
  );
  console.log("─".repeat(140));
  for (const d of diffs) {
    const deltaPts = d.itPts - (d.ourPts ?? 0);
    const sign = deltaPts > 0 ? "+" : "";
    console.log(
      pad(d.task, 50) + "| " +
      pad(fmtNum(d.ourRaw), 15) + "| " +
      pad(d.itRawStr, 15) + "| " +
      pad(fmtNum(d.ourPts), 7) + "| " +
      pad(String(d.itPts), 6) + "| " +
      pad(sign + deltaPts, 5) + "| " +
      d.source
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
