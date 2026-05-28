// ===== DRAGAMI SNAPSHOT GENERATOR =====
// Reads ../dragami.json, computes the DR tree for every character on the
// account, picks the highest-DR one, and emits a snapshot JSON in the
// exact format the standalone HTML tool's "💾 Load save snapshot" button
// expects (matches storage.ts's exportAllAsJson shape).
//
// Output: web/data/dragami-snapshot.json
//
// To use: open web/public/dr-max-values.html, click "💾 Load save snapshot",
// pick the generated file. The Ref column then reflects Dragami's actual
// values instead of zArkhe's.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import { flattenTree } from "../lib/dropRate/treeFlatten";

const repoRoot = resolve(__dirname, "..", "..");
const savePath = resolve(repoRoot, "dragami.json");
const outPath = resolve(repoRoot, "web/data/dragami-snapshot.json");

const raw = JSON.parse(readFileSync(savePath, "utf8"));
const charNames: string[] = Array.isArray(raw.charNames) ? raw.charNames : [];
if (charNames.length === 0) {
  throw new Error("dragami.json has no charNames");
}

console.log(`Account: ${charNames.length} character(s)`);

// Compute DR for every character, keep the strongest.
type CharResult = {
  idx: number;
  name: string;
  total: number;
  flatTree: Record<string, number>;
};
const results: CharResult[] = [];
for (let i = 0; i < charNames.length; i++) {
  try {
    // mapIdx=0 (Town, factor=1) to keep the comparison apples-to-apples
    // with the catalog's zArkhe baseline (which was computed at Froggy
    // Fields, factor=1.38). The user will swap maps live in the calc;
    // for the research tool the un-mapped baseline is the right anchor.
    const r = computeCorganDropRate(raw, i, 0);
    const flat = flattenTree(r.tree);
    results.push({
      idx: i,
      name: charNames[i],
      total: r.total,
      flatTree: flat,
    });
    console.log(
      `  ${String(i).padStart(2)}  ${charNames[i].padEnd(20)} ${r.total.toFixed(3)}x`
    );
  } catch (e) {
    console.warn(
      `  ${String(i).padStart(2)}  ${charNames[i].padEnd(20)} FAILED: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

results.sort((a, b) => b.total - a.total);
const best = results[0];
if (!best) throw new Error("No character DR computed successfully");

console.log(
  `\nBest: ${best.name} (char ${best.idx}) @ ${best.total.toFixed(3)}x — ` +
    `${Object.keys(best.flatTree).length} flatTree entries`
);

// The HTML's snapshot loader accepts the same format storage.ts exports:
//   { snapshotsByChar: { [charName]: [DropRateSnapshot] } }
// Including the flatTree on each snapshot is what powers the Ref column
// override.
const snapshot = {
  charName: best.name,
  capturedAt: Date.now(),
  computedDropRate: best.total,
  flatTree: best.flatTree,
  // Trickle the rest of the per-character payload too, in case future
  // versions of the HTML want to surface luck / map / class. These match
  // the optional EnrichedSnapshot fields the main app saves.
  mapName: "Town (no AC)",
  arcaneFactor: 1,
};

const payload = {
  snapshotsByChar: {
    [best.name]: [snapshot],
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`\n✓ Wrote ${outPath}`);
console.log("  Open web/public/dr-max-values.html → 💾 Load save snapshot → pick this file.");
