// Phase 2 validation: runs computeDropRateBreakdown() against the ARKHE save
// and asserts that the computed `dropRate` matches the pre-computed value
// in `extraData.dropRate` from IT's "Copy for Support" envelope.
//
// Run:
//   cd web && npx tsx scripts/verify-drop-rate-breakdown.ts
//
// Optional: pass a different save path as argv[2].

// IT code occasionally references `window.gtag` from inside error catches.
// Stub minimal browser globals so Node doesn't blow up on those branches.
const g = globalThis as any;
if (!g.window) g.window = g;

import { readFileSync } from "node:fs";
import { computeDropRateBreakdown } from "../lib/dropRate/breakdown";

const SAVE_PATH =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\idleon_raw_ARKHE.json";

const CHAR_INDEX = Number(process.argv[3] ?? 0);

console.log(`[verify] Loading ${SAVE_PATH}`);
const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));

const expected = Number(save?.extraData?.dropRate);
console.log(`[verify] extraData.dropRate = ${expected}`);
console.log(
  `[verify] Selected char ${CHAR_INDEX} → ${save?.charNames?.[CHAR_INDEX]}`
);

console.log(`[verify] Calling computeDropRateBreakdown(...)`);
const t0 = Date.now();
const { breakdown, characters } = computeDropRateBreakdown(save, CHAR_INDEX);
const ms = Date.now() - t0;

const computed = breakdown.dropRate as number;
console.log(`[verify] computed dropRate = ${computed}   (${ms}ms)`);

const diff = Math.abs(computed - expected);
const relativeDiff = expected > 0 ? diff / expected : 0;

console.log("");
console.log(
  `[verify] Δ = ${diff.toFixed(6)}   (${(relativeDiff * 100).toFixed(4)}%)`
);
if (relativeDiff < 0.001) {
  console.log("[verify] ✅ PARITY: within 0.1% of IT's pre-computed value");
} else if (relativeDiff < 0.05) {
  console.log("[verify] ⚠️  CLOSE: within 5% — likely a recent IT/N.js drift");
} else {
  console.log("[verify] ❌ MISMATCH — investigate parser output");
  process.exitCode = 1;
}

console.log("");
console.log("[verify] Breakdown summary:");
console.log(`  statName: ${breakdown.breakdown?.statName}`);
console.log(`  totalValue: ${breakdown.breakdown?.totalValue}`);
console.log(`  categories: ${breakdown.breakdown?.categories?.length ?? 0}`);

// Print EVERY source (verbose=true) or top 6 (verbose=false)
const verbose = process.argv.includes("--verbose");
for (const cat of breakdown.breakdown?.categories ?? []) {
  const sources = (cat as any).sources ?? [];
  const sorted = [...sources]
    .sort((a: any, b: any) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
  console.log(`\n  ${cat.name} (${sources.length} sources)`);
  const list = verbose ? sorted : sorted.filter((s: any) => Math.abs(s.value ?? 0) > 0).slice(0, 6);
  for (const s of list) {
    const v =
      typeof s.value === "number" ? s.value.toFixed(4) : String(s.value);
    console.log(`    ${s.name.padEnd(28)}  ${v}`);
  }
}

console.log("");
console.log(`[verify] Characters parsed: ${characters?.length ?? 0}`);
