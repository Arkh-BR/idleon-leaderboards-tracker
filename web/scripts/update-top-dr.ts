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
import {
  reconcileSharedMultipliers,
  sumMulti,
  type SharedMultiplier,
} from "./_shared/reconcile";
import {
  accumulateOps,
  chooseOps,
  recomputeFrankenstein,
} from "./_shared/frankenstein";
import type { CorganNode } from "../lib/corgan/node";

// Account-wide multipliers that are emitted under many owned items, so
// best-per-path can leave them reading different values per row (each item
// is won by a different owner). Reconcile each to ONE frankenstein-max value
// (1 + Σ best-of-each-sub-source / 100) shown consistently everywhere.
// Extend this list if another shared "1 + Σ/100" multiplier surfaces.
const DR_SHARED_MULTIPLIERS: SharedMultiplier[] = [
  { name: "Gallery Bonus Multi", recompute: sumMulti },
  { name: "Hatrack Bonus Multi", recompute: sumMulti },
];

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
  // GRANULAR best-per-path reference map: for every node path in the DR
  // tree, the max value any single (player, char) reached. Replaces the old
  // "copy the winning player's whole pool-item subtree" merge, which let a
  // shared quantity (e.g. the Gallery Bonus Multi, computed once per save
  // but emitted under both the additive Gallery and the multiplicative
  // Gallery) inherit DIFFERENT players' subtrees in each pool and show two
  // different values. Per-path max makes each shared node resolve to one
  // consistent value wherever it appears.
  const bestFlat: Record<string, number> = {};
  // Per-path op detection for the frankenstein recompute of aggregate nodes
  // (buckets/pools/multi-item sums). An op survives only if it reproduces the
  // parent from its children for EVERY scanned (player, char). `structure` is
  // the most complete tree seen — the shape we walk to recompute bottom-up.
  const opSets = new Map<string, Set<string>>();
  let structure: CorganNode | null = null;
  let structPaths = -1;
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
        // Per-char full tree: its total drives the "best real player"
        // headline, and every node feeds the granular best-per-path map.
        // combine doesn't mutate the pool items, so the bestPools references
        // used for the frankenstein total below stay intact.
        const combined = combineDRPools(pools);
        const total = combined.total;
        if (total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
        const f = flattenTree(combined.tree);
        for (const p in f) {
          const v = f[p];
          if (bestFlat[p] === undefined || v > bestFlat[p]) bestFlat[p] = v;
        }
        // Feed the aggregate-op detector and keep the most complete tree as
        // the recompute structure.
        accumulateOps(combined.tree, opSets);
        const nPaths = Object.keys(f).length;
        if (nPaths > structPaths) {
          structPaths = nPaths;
          structure = combined.tree;
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

  // Frankenstein total for the headline: run the DR formula over the
  // best-of-each-source pool set (one coherent recompute whose total is
  // higher than any individual player). This drives the headline only.
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
  const { total: hypoTotal } = combineDRPools(bestPools);

  // Frankenstein recompute: every aggregate node with a cross-player-verified
  // op (buckets = Σ items, pools = Σ buckets, Cards DR-Multi = Σ cards, …) is
  // rebuilt from its INDEPENDENTLY-maxed children, so the ceiling reflects the
  // best of each component combined rather than the best single player's
  // aggregate. Bespoke per-source nodes keep their best-per-path value.
  if (!structure) {
    console.error("× no structure tree collected, aborting");
    process.exit(1);
  }
  const opByPath = chooseOps(opSets);
  const { flat, recomputed } = recomputeFrankenstein(
    structure,
    bestFlat,
    opByPath
  );

  // Unify account-wide shared multipliers (Gallery / Hatrack Bonus Multi) to
  // one frankenstein-max value everywhere, so a quantity that's logically
  // singular stops reading differently per owned item.
  const reconciled = reconcileSharedMultipliers(flat, DR_SHARED_MULTIPLIERS);
  // Pin the "Drop Rate" root to the frankenstein ceiling (DR formula over the
  // best-of-each-source pools) — the headline 🎯 for overall DR.
  flat["Drop Rate"] = hypoTotal;

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · recomputed ${recomputed} aggregate paths (of ${opByPath.size} with a verified op)`);
  console.log(`  · reconciled ${reconciled} shared-multiplier paths`);
  console.log(`  · ${Object.keys(flat).length} reference paths`);
  console.log(`  · hypothetical-max DR (frankenstein root): ${hypoTotal.toFixed(2)}x`);
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
    "// Top-player Drop Rate reference — GRANULAR best-per-path: every value",
    "// is the max ANY single scanned (player, char) reached for that exact",
    "// node path, so a shared quantity (e.g. the Gallery Bonus Multi) stays",
    "// consistent wherever it appears instead of inheriting a whole winning",
    "// subtree per pool. The 'Drop Rate' root is pinned to the frankenstein",
    "// ceiling (DR formula over the best-of-each-source pools, higher than",
    "// any single player). Keyed by the nodePath() scheme treeFlatten uses.",
    "// Large file: lazy-load it, don't import statically.",
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
