// Sanity check: run computeTome against the ARKHE fixture in the project root
// and print a summary. Compare against expected behavior from the .gs.
//
// Usage: npx tsx scripts/test-tome.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTome } from "../lib/tome/compute";

const fixturePath = join(__dirname, "..", "..", "idleon_raw_ARKHE.json");
const raw = readFileSync(fixturePath, "utf8");

const result = computeTome(raw);

console.log("=".repeat(72));
console.log(`Total pts: ${result.totalPts}`);
console.log(
  `Covered: ${result.coveredCount}/${result.rows.length} | Missing: ${result.missingCount}`
);
console.log("=".repeat(72));

console.log("\nMISSING tasks (pts === null):");
for (const r of result.rows) {
  if (r.pts === null) {
    console.log(`  #${String(r.idx).padStart(3)} ci=${String(r.computeIdx).padStart(3)} raw=${String(r.rawValue)} ${r.task} → ${r.source}`);
  }
}

console.log("\nTop 20 by pts:");
const sorted = [...result.rows].filter(r => r.pts !== null).sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
for (let i = 0; i < Math.min(20, sorted.length); i++) {
  const r = sorted[i];
  console.log(`  ${String(r.pts).padStart(5)} pts | ${String(r.rawValue).padStart(15)} | ${r.task}`);
}

console.log("\nFirst 10 rows (in task order):");
for (let i = 0; i < 10; i++) {
  const r = result.rows[i];
  console.log(
    `  #${String(r.idx).padStart(3)} ci=${String(r.computeIdx).padStart(3)} | ` +
    `${String(r.rawValue ?? "null").padStart(12)} | ${String(r.pts ?? "—").padStart(5)} pts | ${r.task}`
  );
}
