// Probe for IDL-13: rank the 118 tome tasks by Tome-Score points still on the
// table, the way a "Biggest Gains for Tome" tab would. Mirrors the enrichment
// in components/tome/BestTomePanel.tsx. Run from web/:
//   npx tsx scripts/check-tome-gains.ts "../save 28-05.json"
import { readFileSync } from "node:fs";
import { computeTome } from "../lib/tome/compute";
import {
  calcPointsPercent,
  isInvertedCurve,
  maxPtsForBonus,
  quantityForPts,
} from "../lib/tome/math";
import { tierForPct } from "../lib/tome/tier";
import { TOP_PLAYERS } from "../lib/tome/topPlayers";
import { DEFAULT_CLASSIFICATIONS } from "../lib/tome/defaultClassifications";

const CLASS_LABEL: Record<number, string> = {
  1: "Priority", 3: "Doable", 4: "Time Gated", 5: "Lucky Gated", 9: "Update Gated", 12: "Capped",
};

const path = process.argv[2] ?? "../save 28-05.json";
const raw = readFileSync(path, "utf8");
const result = computeTome(raw, {});

console.log(`\n=== SAVE: ${path} ===`);
console.log(`Total tome pts: ${result.totalPts.toLocaleString()}  |  covered ${result.coveredCount}/${result.rows.length}  |  usedParsedTomePoints=${result.usedParsedTomePoints}`);

type Enriched = {
  task: string; pts: number; maxPts: number; topPts: number | null;
  gapToTop: number; gapToMax: number; rawForNextPt: number | null;
  nextCost: number | null; inverted: boolean; cls: number | null; clsLabel: string;
  tier: string; rawValue: number | null; topRaw: number | null;
};

const rows: Enriched[] = result.rows.map((r) => {
  const maxPts = maxPtsForBonus(r.bonus);
  const pct = r.bonus && r.rawValue !== null ? calcPointsPercent(r.bonus, Number(r.rawValue)) : null;
  const pts = r.pts ?? 0;
  const rawForNextPt = quantityForPts(r.bonus, pts + 1);
  const top = TOP_PLAYERS[r.task] ?? null;
  const topPts = top && top.pts !== null ? top.pts : null;
  const gapToTop = topPts !== null ? Math.max(0, topPts - pts) : 0;
  const gapToMax = Math.max(0, maxPts - pts);
  const inverted = isInvertedCurve(r.bonus);
  const nextCost =
    r.rawValue === null || rawForNextPt === null
      ? null
      : inverted
        ? Number(r.rawValue) - rawForNextPt
        : rawForNextPt - Number(r.rawValue);
  const overridePick = DEFAULT_CLASSIFICATIONS[r.task];
  const cls = overridePick !== undefined ? overridePick : top?.classification ?? null;
  return {
    task: r.task, pts, maxPts, topPts, gapToTop, gapToMax,
    rawForNextPt, nextCost, inverted, cls, clsLabel: cls !== null ? CLASS_LABEL[cls] ?? String(cls) : "—",
    tier: tierForPct(pct), rawValue: r.rawValue, topRaw: top?.raw ?? null,
  };
});

const fmt = (n: number | null) =>
  n === null ? "—" : Math.abs(n) >= 1e6 ? n.toExponential(2) : n.toLocaleString();

function table(title: string, list: Enriched[], n = 15) {
  console.log(`\n--- ${title} (top ${n}) ---`);
  console.log("rank  gapTop  gapMax  you/top/max          class         +1pt cost            task");
  list.slice(0, n).forEach((r, i) => {
    const ptsCol = `${r.pts}/${r.topPts ?? "—"}/${r.maxPts}`.padEnd(18);
    const cost = r.nextCost !== null && r.nextCost > 0 ? `${r.inverted ? "-" : "+"}${fmt(r.nextCost)}` : "—";
    console.log(
      `${String(i + 1).padStart(3)}  ${String(r.gapToTop).padStart(6)}  ${String(r.gapToMax).padStart(6)}  ${ptsCol} ${r.clsLabel.padEnd(13)} ${cost.padEnd(18)}  ${r.task}`,
    );
  });
}

const ACTIONABLE = new Set([1, 3]); // Priority + Doable (exclude Time/Lucky/Update Gated + Capped)

// View A: pure gap-to-top (what the descriptive sheet already sorts by)
table("ALL tasks by gap-to-top desc", [...rows].sort((a, b) => b.gapToTop - a.gapToTop));

// View B: prescriptive — only actionable classes, ranked by gap-to-top
table(
  "ACTIONABLE (Priority/Doable) by gap-to-top desc",
  rows.filter((r) => r.cls !== null && ACTIONABLE.has(r.cls) && r.gapToTop > 0).sort((a, b) => b.gapToTop - a.gapToTop),
);

// Stats for §1 evidence
const withGap = rows.filter((r) => r.gapToTop > 0);
const totalGapTop = withGap.reduce((s, r) => s + r.gapToTop, 0);
const actionableGap = rows.filter((r) => r.cls !== null && ACTIONABLE.has(r.cls) && r.gapToTop > 0);
const top5 = [...withGap].sort((a, b) => b.gapToTop - a.gapToTop).slice(0, 5);
const top5Sum = top5.reduce((s, r) => s + r.gapToTop, 0);
const gatedGap = rows.filter((r) => r.cls !== null && [4, 5, 9].includes(r.cls) && r.gapToTop > 0).reduce((s, r) => s + r.gapToTop, 0);
const cappedAhead = rows.filter((r) => r.gapToTop === 0 && r.topPts !== null).length;

console.log(`\n=== STATS ===`);
console.log(`Tasks with gap-to-top > 0: ${withGap.length}/118`);
console.log(`Total pts gap-to-top (sum): ${totalGapTop.toLocaleString()}`);
console.log(`Top 5 tasks = ${top5Sum} pts = ${((top5Sum / totalGapTop) * 100).toFixed(0)}% of total gap`);
console.log(`Actionable (Priority/Doable) tasks with gap: ${actionableGap.length}, summing ${actionableGap.reduce((s, r) => s + r.gapToTop, 0)} pts`);
console.log(`Gated (Time/Lucky/Update) tasks with gap sum: ${gatedGap} pts (would be ranked high but are not push-now-able)`);
console.log(`Tasks already tied/ahead of top snapshot: ${cappedAhead}`);
