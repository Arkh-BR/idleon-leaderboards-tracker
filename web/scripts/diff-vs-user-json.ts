// Run our local computeTome on the user's actual JSON paste (envelope from
// IT's "Copy for Support" button — has data + companion + guildData but no
// parsedData). Print our result so we can compare against IT website value.
//
// Usage: npx tsx scripts/diff-vs-user-json.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTome } from "../lib/tome/compute";

const path = join(__dirname, "..", "..", "idleon_raw_ARKHE.json");
const blob = JSON.parse(readFileSync(path, "utf8"));

const ours = computeTome(blob as Record<string, unknown>);

console.log("=".repeat(80));
console.log(`Input: ${path}`);
console.log(`Mode:  ${ours.usedParsedTomePoints ? "hybrid (parsedData present)" : "envelope (no parsedData)"}`);
console.log(`Covered: ${ours.coveredCount}/${ours.rows.length}`);
console.log(`Our total: ${ours.totalPts}`);
console.log("=".repeat(80));

// Print Star Talents row specifically (the known divergent task)
const starTalents = ours.rows.find((r) => r.task === "Star Talent Points Owned");
if (starTalents) {
  console.log("\nStar Talent Points Owned:");
  console.log(`  raw   = ${starTalents.rawValue}`);
  console.log(`  pts   = ${starTalents.pts}`);
  console.log(`  src   = ${starTalents.source}`);
  console.log(`  bonus = [${starTalents.bonus?.join(", ")}]`);
}

// Print top 15 contributors
console.log("\nTop 15 by pts (ours):");
const sorted = [...ours.rows]
  .filter((r) => r.pts !== null)
  .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
for (let i = 0; i < 15; i++) {
  const r = sorted[i];
  console.log(`  ${String(r.pts).padStart(5)} pts | ${r.task}`);
}
