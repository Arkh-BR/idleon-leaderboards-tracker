// Compares our local computeTome() output against IT's own parsedData.tomePoints.
// Both work from the SAME raw save. Any task where they disagree is either a
// port bug, a formula change, or stale data on our side.
//
// Usage: npx tsx scripts/diff-vs-it.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTome } from "../lib/tome/compute";
import { TOME_TASKS } from "../lib/tome/tasks";

const snap = join(__dirname, "arkhe-it-snapshot.json");
const blob = JSON.parse(readFileSync(snap, "utf8")) as {
  data?: Record<string, unknown>;
  parsedData?: { tomePoints?: number[]; [k: string]: unknown };
};

if (!blob.data || !blob.parsedData?.tomePoints) {
  console.error("snapshot missing .data or .parsedData.tomePoints");
  process.exit(1);
}

const itPoints = blob.parsedData.tomePoints;
// Default: feed raw `data` only — exercise local compute path.
// Pass MODE=hybrid env var to feed the full envelope (data + parsedData).
const ours =
  process.env.MODE === "hybrid"
    ? computeTome(blob as unknown as Record<string, unknown>)
    : computeTome(blob.data as Record<string, unknown>);
console.log("Mode:", process.env.MODE === "hybrid" ? "hybrid (parsedData override)" : "raw-only");

console.log("=".repeat(80));
const itTotal = itPoints.reduce((a, b) => a + (Number(b) || 0), 0);
console.log(`IT total:    ${itTotal}`);
console.log(`Our total:   ${ours.totalPts}`);
console.log(`Diff:        ${ours.totalPts - itTotal}`);
console.log(`Covered:     ${ours.coveredCount}/${ours.rows.length}`);
console.log("=".repeat(80));

type Row = {
  idx: number;
  task: string;
  itPts: number;
  ourPts: number | null;
  rawValue: number | null;
  source: string;
  diff: number | null;
};

const rows: Row[] = ours.rows.map((r, i) => {
  const itPts = Number(itPoints[i]) || 0;
  const diff = r.pts === null ? null : r.pts - itPts;
  return {
    idx: r.idx,
    task: TOME_TASKS[i],
    itPts,
    ourPts: r.pts,
    rawValue: r.rawValue,
    source: r.source,
    diff,
  };
});

const mismatches = rows.filter((r) => r.diff === null || r.diff !== 0);

console.log(`\n${mismatches.length} mismatched tasks:\n`);
console.log(
  "idx".padEnd(4) +
    " | " +
    "task".padEnd(42) +
    " | " +
    "IT".padStart(6) +
    " | " +
    "ours".padStart(6) +
    " | " +
    "diff".padStart(6) +
    " | " +
    "rawValue".padStart(15) +
    " | source"
);
console.log("-".repeat(140));

for (const r of mismatches) {
  console.log(
    String(r.idx).padEnd(4) +
      " | " +
      r.task.slice(0, 42).padEnd(42) +
      " | " +
      String(r.itPts).padStart(6) +
      " | " +
      String(r.ourPts ?? "—").padStart(6) +
      " | " +
      String(r.diff ?? "—").padStart(6) +
      " | " +
      String(r.rawValue ?? "null").padStart(15) +
      " | " +
      r.source
  );
}

// Categorize
const ourMissing = mismatches.filter((r) => r.ourPts === null).length;
const overshoot = mismatches.filter((r) => r.diff !== null && r.diff > 0).length;
const undershoot = mismatches.filter((r) => r.diff !== null && r.diff < 0).length;
console.log(`\nSummary: ${ourMissing} missing on our side | ${overshoot} we're higher | ${undershoot} we're lower`);
