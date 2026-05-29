// Refresh the bundled top-player Drop Rate reference in
// lib/dropRate/topDropRate.ts by fetching the raw save of each top player
// from the IT profiles endpoint and running OUR corgan DR engine on it.
//
// For every character of every candidate we compute the DR tree (map 0 —
// the base map, so the comparison focuses on the character's own sources,
// not the map multiplier the user picks) and flatten it to path→value. The
// reference is the BEST value seen per path across all of them (the
// per-source ceiling), plus a headline of the single highest DR total.
//
// Run:  npx tsx web/scripts/update-top-dr.ts
// Knobs: --limit N   cap candidate set (smoke test)
//        --slow       1500ms between players
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";

const argv = process.argv.slice(2);
const SLOW = argv.includes("--slow");
const THROTTLE_MS = SLOW ? 1500 : 400;
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
})();

const OUTPUT_FILE = join(__dirname, "..", "lib", "dropRate", "topDropRate.ts");
const META_FILE = join(__dirname, "..", "lib", "dropRate", "topDropRate.meta.ts");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Best = { player: string; char: string; total: number };

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates(LIMIT ?? undefined);
  console.log(`  ✓ ${candidates.length} candidates`);

  const bestFlat: Record<string, number> = {};
  let bestTotal: Best | null = null;
  let scanned = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const tag = `[${i + 1}/${candidates.length}]`;
    process.stdout.write(`  ${tag} ${name.padEnd(20)}`);
    const save = await fetchProfileSave(name);
    if (!save) {
      console.log("  · skipped (no save)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let chars: { charIndex: number; charName: string }[] = [];
    try {
      chars = listCharacters(save);
    } catch {
      console.log("  · skipped (parse)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const { tree, total } = computeCorganDropRate(save, ch.charIndex, 0);
        const flat = flattenTree(tree);
        for (const path in flat) {
          const v = flat[path];
          if (bestFlat[path] === undefined || v > bestFlat[path]) {
            bestFlat[path] = v;
          }
        }
        if (total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
      } catch {
        // skip a char that fails to compute (e.g. no class)
      }
    }
    if (!bestTotal || playerBest > bestTotal.total) {
      bestTotal = { player: name, char: playerBestChar, total: playerBest };
    }
    scanned++;
    console.log(`  ✓ best ${playerBest.toFixed(2)}x (${playerBestChar})`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · ${Object.keys(bestFlat).length} reference paths`);
  console.log(
    `  · headline best: ${bestTotal?.total.toFixed(2)}x by ${bestTotal?.player} (${bestTotal?.char})`
  );

  emitFiles(bestFlat, bestTotal, scanned);
}

function emitFiles(
  flat: Record<string, number>,
  best: Best | null,
  scanned: number
) {
  const now = new Date().toISOString();

  // Metadata file — small, safe to import statically (powers the toggle's
  // headline without pulling in the large path table).
  const meta = [
    "// Top-player Drop Rate reference — metadata only (small, statically",
    "// imported). The large path→value table lives in topDropRate.ts and is",
    "// lazy-loaded on demand. Both auto-refreshed by scripts/update-top-dr.ts.",
    "",
    `export const TOP_DR_GENERATED_AT = ${JSON.stringify(now)};`,
    `export const TOP_DR_PLAYERS_SCANNED = ${scanned};`,
    `export const TOP_DR_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
    "",
  ].join("\n");
  writeFileSync(META_FILE, meta);
  console.log(`\n✓ Wrote ${META_FILE}`);

  // Flat table — large, lazy-loaded only when the user opts into the
  // comparison. Keyed by the same nodePath() scheme treeFlatten uses so it
  // drops straight into DeepView as a comparison baseline.
  const lines: string[] = [
    "// Top-player Drop Rate reference — per-source ceiling (best value seen",
    "// across the scanned top players), keyed by the nodePath() scheme",
    "// treeFlatten uses. Large file: lazy-load it, don't import statically.",
    `// Generated ${now} · ${scanned} players. Refresh: scripts/update-top-dr.ts.`,
    "",
    "export const TOP_DR_FLAT: Readonly<Record<string, number>> = {",
  ];
  for (const path of Object.keys(flat).sort()) {
    lines.push(`  ${JSON.stringify(path)}: ${flat[path]},`);
  }
  lines.push("};", "");
  writeFileSync(OUTPUT_FILE, lines.join("\n"));
  console.log(`✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
