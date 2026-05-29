// Refresh the bundled top-player Drop Rate reference in
// lib/dropRate/topDropRate.ts by fetching each top player's raw save from
// the IT profiles endpoint and running OUR corgan DR engine on it.
//
// HYPOTHETICAL-MAX model: for every char of every candidate we resolve the
// DR pools at PEAK (highest-arcane map + chip gallery on), then keep the
// BEST value seen per source (per pool item index — sources are emitted in
// a fixed order, so item i is the same source for everyone). After scanning
// everyone we recompute the DR formula (dropRateDesc.combine) on that
// "best of each source" pool set. The result is a single coherent tree
// whose total is HIGHER than any individual player — the theoretical
// ceiling a save would hit if it had everyone's best of every source.
// (It's a frankenstein: sources come from different players, so it's an
// aspirational max, not necessarily reachable. Combat-only bonuses like
// Active Drop Rate / multikill aren't in the save either.)
//
// Run:  npx tsx web/scripts/update-top-dr.ts
// Knobs: --limit N   cap candidate set (smoke test)
//        --slow       1500ms between players
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeCorganDRPools, combineDRPools } from "../lib/corgan/computeDR";
import type { Pool } from "../lib/corgan/stats/tree-builder";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";
import { buildMapOptions } from "../lib/dropRate/arcaneBonus";

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

// Merge an incoming pool set into the running best-per-source accumulator.
function mergeBest(
  acc: Record<string, Pool> | null,
  incoming: Record<string, Pool>
): Record<string, Pool> {
  if (!acc) {
    const init: Record<string, Pool> = {};
    for (const pn in incoming) {
      init[pn] = { items: [...incoming[pn].items], sum: 0, product: 0 };
    }
    return init;
  }
  for (const pn in incoming) {
    const inc = incoming[pn];
    if (!acc[pn]) {
      acc[pn] = { items: [...inc.items], sum: 0, product: 0 };
      continue;
    }
    const cur = acc[pn];
    const n = Math.min(cur.items.length, inc.items.length);
    for (let i = 0; i < n; i++) {
      if ((Number(inc.items[i].val) || 0) > (Number(cur.items[i].val) || 0)) {
        cur.items[i] = inc.items[i];
      }
    }
  }
  return acc;
}

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  // Same logic as the Tome collector, but the top-10 focus board is the
  // Drop Rate ranking (the players that actually define the DR ceiling).
  const candidates = await gatherCandidates({
    limit: LIMIT ?? undefined,
    focusBoard: "dropRate",
  });
  console.log(`  ✓ ${candidates.length} candidates`);

  let bestPools: Record<string, Pool> | null = null;
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
    // Peak setup for this save: the map with the highest arcane factor
    // (account-wide AFK kills, same for every char) + chip gallery on.
    const maps = buildMapOptions(save);
    const bestMapIdx = maps.reduce(
      (a, b) => (b.factor > a.factor ? b : a),
      maps[0]
    ).index;
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const pools = computeCorganDRPools(save, ch.charIndex, bestMapIdx, {
          chipGalleryActive: true,
        });
        // Individual total (context only — combine doesn't mutate the pool
        // items, so the accumulator's references stay intact).
        const total = combineDRPools(pools).total;
        if (total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
        bestPools = mergeBest(bestPools, pools);
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

  if (!bestPools) {
    console.error("× no pools collected, aborting");
    process.exit(1);
  }

  // Recompute sum/product over the best-per-source items, then run the DR
  // formula to get the hypothetical-max tree.
  for (const pn in bestPools) {
    let sum = 0;
    let product = 1;
    for (const it of bestPools[pn].items) {
      const v = Number(it.val) || 0;
      sum += v;
      product *= v !== 0 ? v : 1;
    }
    bestPools[pn].sum = sum;
    bestPools[pn].product = product;
  }
  const { tree: hypoTree, total: hypoTotal } = combineDRPools(bestPools);
  const flat = flattenTree(hypoTree);

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · ${Object.keys(flat).length} reference paths`);
  console.log(`  · hypothetical-max DR: ${hypoTotal.toFixed(2)}x`);
  console.log(
    `  · best real player: ${bestTotal?.total.toFixed(2)}x by ${bestTotal?.player} (${bestTotal?.char})`
  );

  emitFiles(flat, bestTotal, hypoTotal, scanned);
}

function emitFiles(
  flat: Record<string, number>,
  best: Best | null,
  hypotheticalTotal: number,
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
    "// Recomputed DR of the 'best of every source' synthetic save (higher",
    "// than any single player). This is TOP_DR_FLAT['Drop Rate'].",
    `export const TOP_DR_HYPOTHETICAL_TOTAL = ${hypotheticalTotal};`,
    "// Highest DR of a single real player, for context.",
    `export const TOP_DR_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
    "",
  ].join("\n");
  writeFileSync(META_FILE, meta);
  console.log(`\n✓ Wrote ${META_FILE}`);

  // Flat table — large, lazy-loaded only when the user opts into the
  // comparison. Keyed by the same nodePath() scheme treeFlatten uses so it
  // drops straight into DeepView as a comparison baseline. Every value is
  // the best-of-each-source hypothetical max (root = recomputed total).
  const lines: string[] = [
    "// Top-player Drop Rate reference — the 'best of every source' synthetic",
    "// save: each source is the max across the scanned top players and the",
    "// tree is recomputed via the DR formula. Keyed by the nodePath() scheme",
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
