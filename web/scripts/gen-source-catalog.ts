// ===== DR SOURCE CATALOG GENERATOR =====
// Walks the live DR tree and emits a JSON catalog of every "source row"
// (named items inside the categorize buckets — Talent 279, Card Type 101,
// Companion 132, etc.) so the standalone max-values tool has a stable list
// to render. The catalog also embeds the current reference value pulled
// from the test save, so the tool can highlight gaps vs. the current best.
//
// Writes both:
//   • web/data/dr-source-catalog.json  — raw catalog
//   • web/public/dr-max-values.html    — standalone tool with the catalog
//                                         inlined as a <script> literal so
//                                         it works at file:// too

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";
import {
  parseSystemFromBucketName,
  systemWorld,
  WORLD_ORDER,
  WORLD_EMOJI,
  SYSTEM_EMOJI,
  type SystemKey,
  type WorldKey,
} from "../lib/corgan/stats/categorize";
import { nodePath } from "../lib/dropRate/treeFlatten";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

type SourceEntry = {
  /** Stable canonical path — same scheme treeFlatten uses, so the entry's
   *  identity survives across save reloads. */
  id: string;
  /** Display name of the source row, e.g. "Robbing Hood (Talent 279)". */
  name: string;
  /** Game system bucket — Talents / Cards / Companions / etc. */
  system: SystemKey;
  /** World grouping — Global / Character / W1 … W7 / Other. */
  world: WorldKey;
  /** Whether the source feeds the additive sum or the multiplier chain. */
  pool: "Additive" | "Multi";
  /** Format the renderer uses for the value (+, x, raw). */
  fmt: "+" | "x" | "raw";
  /** Value computed for this source on the reference save (zArkhe). Used
   *  in the tool as a "current best on-record" anchor. */
  refValue: number;
  /** Parent bucket display name (with emoji), for grouping in the UI. */
  bucket: string;
  /** Optional informational footer the renderer mutes after the name. */
  note?: string;
  /** Recursive descendants. Empty/undefined when the node has no
   *  drill-down (e.g. a leaf talent without sub-source breakdown). */
  children?: SourceEntry[];
  /** True for paid-only sources (real-money DLC bundles, gem-shop
   *  exclusives). The UI exposes a "Hide P2W" toggle that filters
   *  these out so the user can see a free-to-play ceiling. */
  p2w?: boolean;
  /** Aggregation rule — set when this source's reference value is
   *  recoverable from its children (sum for "+" parents, product for
   *  "x" parents). The HTML uses it to live-recompute the parent's Max
   *  whenever a descendant's Max changes, so the user can stipulate
   *  per-leaf maxes and watch totals roll up automatically. */
  agg?: "sum" | "product";
};

/** Detect whether `parent.val` is recoverable from `children.val` via a
 *  trivial aggregation (sum for fmt:"+" parents, product for fmt:"x").
 *  Only children whose fmt matches the parent contribute — siblings
 *  with mismatched fmts are informational (e.g. an "x" Legendary
 *  Cardholder row inside a "+" card-sum bucket). */
function detectAgg(
  parent: CorganNode,
  children: CorganNode[]
): "sum" | "product" | null {
  if (!children.length) return null;
  if (parent.fmt === "+") {
    const matching = children.filter((c) => c.fmt === "+");
    if (matching.length === 0) return null;
    const sum = matching.reduce((a, c) => a + (Number(c.val) || 0), 0);
    if (Math.abs(sum - (Number(parent.val) || 0)) < 0.1) return "sum";
  } else if (parent.fmt === "x") {
    const matching = children.filter((c) => c.fmt === "x");
    if (matching.length === 0) return null;
    const prod = matching.reduce((a, c) => a * (Number(c.val) || 1), 1);
    if (Math.abs(prod - (Number(parent.val) || 1)) < 0.005) return "product";
  }
  return null;
}

/** Heuristic-flag for P2W sources. The criterion right now:
 *    - Anything classified under the Bundles system, OR
 *    - Any node whose name contains "(Bundle " (covers Death Bringer +
 *      Explorer Bundle children)
 *  We can expand this list as more clearly P2W items surface. */
function looksP2W(name: string, system: SystemKey): boolean {
  if (system === "Bundles") return true;
  if (/\(Bundle\s/.test(name)) return true;
  return false;
}

// Names that mark catalog-only placeholder rows (un-equipped items,
// safety net rows). They have no per-character DR value and would
// drown out the real entries, so we skip them entirely.
const SKIP_NAMES = new Set([
  "No active sources",
  "Available DR Items (not equipped)",
  "Available DR Obols (not equipped)",
  "Not Unlocked",
]);

function collectChildren(
  parent: CorganNode,
  parentPath: string,
  parentSiblings: CorganNode[],
  parentIdx: number,
  bucket: CorganNode,
  sys: SystemKey,
  world: WorldKey,
  poolBadge: "Additive" | "Multi"
): SourceEntry[] {
  void parentSiblings;
  void parentIdx;
  const kids = parent.children || [];
  const out: SourceEntry[] = [];
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (SKIP_NAMES.has(child.name)) continue;
    // Drop placeholder rows the loader emits to signpost catalog content
    // (e.g. "Helmets — 6 items" inside the catalog tree). They're
    // navigational, not actual DR sources, so keep them collapsed but
    // skip including them as trackable entries.
    if (/— \d+ item/.test(child.name)) continue;
    const childPath = nodePath(parentPath, child, kids, i);
    const entry: SourceEntry = {
      id: childPath,
      name: child.name,
      system: sys,
      world,
      pool: poolBadge,
      fmt: (child.fmt as "+" | "x" | "raw") ?? "raw",
      refValue: Number(child.val) || 0,
      bucket: bucket.name,
    };
    if (child.note) entry.note = child.note;
    if (looksP2W(child.name, sys)) entry.p2w = true;
    const grandKids = collectChildren(
      child,
      childPath,
      kids,
      i,
      bucket,
      sys,
      world,
      poolBadge
    );
    if (grandKids.length > 0) {
      entry.children = grandKids;
      const agg = detectAgg(child, child.children || []);
      if (agg) entry.agg = agg;
    }
    out.push(entry);
  }
  return out;
}

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeCorganDropRate(raw, 2, 0);

const sources: SourceEntry[] = [];
const root = r.tree as CorganNode;
const rootPath = nodePath("", root, [root], 0);
const tops = root.children || [];
for (let pi = 0; pi < tops.length; pi++) {
  const top = tops[pi];
  if (top.name !== "Additive Pool" && top.name !== "Post-Processing") continue;
  const topPath = nodePath(rootPath, top, tops, pi);
  const buckets = top.children || [];
  for (let bi = 0; bi < buckets.length; bi++) {
    const bucket = buckets[bi];
    const sys = parseSystemFromBucketName(bucket.name);
    if (!sys) continue;
    const world = systemWorld(sys);
    const bucketPath = nodePath(topPath, bucket, buckets, bi);
    const rows = bucket.children || [];
    for (let si = 0; si < rows.length; si++) {
      const src = rows[si];
      if (SKIP_NAMES.has(src.name)) continue;
      const id = nodePath(bucketPath, src, rows, si);
      const badge: "Additive" | "Multi" =
        bucket.fmt === "x" ? "Multi" : "Additive";
      const entry: SourceEntry = {
        id,
        name: src.name,
        system: sys,
        world,
        pool: badge,
        fmt: (src.fmt as "+" | "x" | "raw") ?? "raw",
        refValue: Number(src.val) || 0,
        bucket: bucket.name,
      };
      if (src.note) entry.note = src.note;
      if (looksP2W(src.name, sys)) entry.p2w = true;
      const subs = collectChildren(src, id, rows, si, bucket, sys, world, badge);
      if (subs.length > 0) {
        entry.children = subs;
        const agg = detectAgg(src, src.children || []);
        if (agg) entry.agg = agg;
      }
      sources.push(entry);
    }
  }
}

const repoRoot = resolve(__dirname, "..", "..");
const catalogPath = resolve(repoRoot, "web/data/dr-source-catalog.json");
const htmlPath = resolve(repoRoot, "web/public/dr-max-values.html");

mkdirSync(dirname(catalogPath), { recursive: true });
mkdirSync(dirname(htmlPath), { recursive: true });

// Pick up the IT seed if it's been generated (populate-max-from-it.ts).
// Embedding it means the HTML can ship with a one-click "Apply IT seed"
// button so the user doesn't have to find + Import a file every refresh.
const seedPath = resolve(repoRoot, "web/data/dr-max-values-it-seed.json");
let itSeed: any = null;
if (existsSync(seedPath)) {
  try {
    itSeed = JSON.parse(readFileSync(seedPath, "utf8"));
  } catch {
    itSeed = null;
  }
}

// Pick up a per-character reference snapshot if one's been generated
// (gen-dragami-snapshot.ts and friends — one file per high-end player
// whose save we have on disk). Embed inline so the HTML can offer a
// one-click "Load <player>" button per snapshot.
type RefSnap = {
  label: string;
  emoji: string;
  charName: string;
  capturedAt: number;
  computedDropRate: number;
  flatTree: Record<string, number>;
};
const refSnapshots: RefSnap[] = [];
function loadRefSnapshot(filePath: string, label: string, emoji: string) {
  if (!existsSync(filePath)) return;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    // Extract the latest snapshot across all chars in this file.
    let best: any = null;
    let bestTs = -Infinity;
    if (raw.snapshotsByChar) {
      for (const charName of Object.keys(raw.snapshotsByChar)) {
        const list = raw.snapshotsByChar[charName];
        if (!Array.isArray(list)) continue;
        for (const snap of list) {
          if (!snap || !snap.flatTree) continue;
          const ts = Number(snap.capturedAt) || 0;
          if (ts > bestTs) {
            bestTs = ts;
            best = { ...snap, charName: snap.charName || charName };
          }
        }
      }
    }
    if (!best) return;
    refSnapshots.push({
      label,
      emoji,
      charName: best.charName,
      capturedAt: best.capturedAt || Date.now(),
      computedDropRate: Number(best.computedDropRate) || 0,
      flatTree: best.flatTree,
    });
  } catch {
    /* skip broken snapshot files */
  }
}
loadRefSnapshot(
  resolve(repoRoot, "web/data/dragami-snapshot.json"),
  "Load Dragami",
  "🐉"
);

const catalog = {
  generatedAt: new Date().toISOString(),
  refTotal: r.total,
  refSave: "zArkhe (save 25-21-16.json) — Froggy Fields",
  sourceCount: sources.length,
  worldEmoji: WORLD_EMOJI,
  systemEmoji: SYSTEM_EMOJI,
  worldOrder: WORLD_ORDER,
  sources,
  /** Optional pre-baked seed (from populate-max-from-it.ts). The HTML
   *  exposes a button to apply it without leaving the page. */
  itSeed,
  /** Per-character reference snapshots — embedded so the HTML can offer
   *  one-click "Load <player>" buttons. Each carries the full flatTree
   *  so the Ref column updates per-source. */
  refSnapshots,
};
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

// Build the standalone HTML with the catalog inlined.
const html = buildHtml(catalog);
writeFileSync(htmlPath, html);

console.log(`✓ Catalog:  ${catalogPath}  (${sources.length} sources)`);
console.log(`✓ Tool:     ${htmlPath}`);
console.log(`✓ Ref save: ${catalog.refSave}  →  DR ${r.total.toFixed(3)}x`);
if (itSeed)
  console.log(
    `✓ IT seed:  ${Object.keys(itSeed.values || {}).length} entries embedded`
  );

// ===== HTML BUILDER =====
function buildHtml(cat: typeof catalog): string {
  // The catalog is inlined as JSON inside a <script type="application/json">
  // tag so the tool works even when opened via file:// (no fetch needed).
  // User-entered max values live in localStorage under a versioned key.
  const inline = JSON.stringify(cat);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DR Source Max Values — Research Tool</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root {
    color-scheme: dark;
    --bg: #09090b;
    --panel: rgba(24, 24, 27, 0.6);
    --border: #27272a;
    --border-strong: #3f3f46;
    --ink: #e4e4e7;
    --ink-dim: #71717a;
    --ink-mute: #52525b;
    --accent: #38bdf8;
    --gold: #facc15;
    --green: #34d399;
    --red: #f87171;
    --amber: #fbbf24;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 16px 20px 48px; }
  header h1 { margin: 0 0 4px; font-size: 22px; color: var(--gold); font-weight: 700; }
  header .sub { color: var(--ink-dim); font-size: 12px; margin-bottom: 18px; }
  .toolbar {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    padding: 10px; margin-bottom: 14px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  }
  .toolbar input[type="search"] {
    flex: 1; min-width: 200px;
    background: #09090b; color: var(--ink);
    border: 1px solid var(--border); border-radius: 4px;
    padding: 6px 10px; font-size: 13px;
  }
  .toolbar input[type="search"]:focus { outline: none; border-color: var(--accent); }
  .toolbar button, .toolbar label {
    background: #18181b; color: var(--ink); border: 1px solid var(--border-strong);
    border-radius: 4px; padding: 5px 10px; font-size: 12px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .toolbar button:hover, .toolbar label:hover { background: #27272a; }
  .toolbar input[type="file"] { display: none; }
  .toolbar select {
    background: #18181b; color: var(--ink); border: 1px solid var(--border-strong);
    border-radius: 4px; padding: 5px 8px; font-size: 12px;
  }
  .stats {
    font-size: 12px; color: var(--ink-dim);
    margin-left: auto;
  }
  .stats b { color: var(--ink); }
  .world-section {
    border: 1px solid var(--border); border-radius: 8px;
    background: rgba(24, 24, 27, 0.4);
    margin-bottom: 12px; overflow: hidden;
  }
  .world-header {
    width: 100%; text-align: left;
    background: none; color: var(--accent); border: none;
    padding: 10px 14px; font-size: 16px; font-weight: 600;
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; border-bottom: 1px solid transparent;
  }
  .world-header.open { border-bottom-color: var(--border); }
  .world-header .arrow { color: var(--ink-mute); font-size: 12px; width: 14px; }
  .world-header .count {
    margin-left: auto; font-size: 11px; color: var(--ink-mute); font-weight: 400;
  }
  .world-header .progress {
    font-size: 11px; color: var(--ink-mute); font-weight: 400;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .world-header .progress .bar {
    width: 80px; height: 6px; background: #27272a; border-radius: 3px; overflow: hidden;
  }
  .world-header .progress .bar > i {
    display: block; height: 100%; background: var(--green);
  }
  .bucket-group { padding: 2px 0 6px; }
  .bucket-title {
    color: var(--ink-dim); font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; padding: 10px 14px 4px;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; text-align: left; vertical-align: top; }
  th {
    font-size: 10px; color: var(--ink-mute); text-transform: uppercase;
    letter-spacing: 0.08em; border-bottom: 1px solid var(--border);
    font-weight: 500;
  }
  td { font-size: 13px; border-bottom: 1px solid rgba(39, 39, 42, 0.4); }
  tr:last-child td { border-bottom: none; }
  td.name { color: var(--ink); font-weight: 500; }
  td.system {
    color: var(--ink-dim); font-size: 11px;
  }
  td.poolbadge { font-size: 10px; }
  td.poolbadge span.add {
    color: #93c5fd; background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 1px 6px; border-radius: 3px; font-family: monospace;
  }
  td.poolbadge span.mul {
    color: var(--amber); background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    padding: 1px 6px; border-radius: 3px; font-family: monospace;
  }
  td.ref {
    font-family: monospace; text-align: right; color: var(--ink);
    font-size: 12px;
  }
  /* Expand chevron for rows with sub-sources */
  td.name {
    white-space: nowrap;
  }
  td.name .chev {
    display: inline-block; width: 14px; text-align: center;
    color: var(--ink-mute); font-size: 11px;
    cursor: pointer; margin-right: 4px; user-select: none;
  }
  td.name .chev.no-children { cursor: default; opacity: 0.25; }
  td.name .chev:not(.no-children):hover { color: var(--accent); }
  td.name .name-text { white-space: normal; }
  /* Sub-source rows — indented + slightly faded */
  tr.subrow td { font-size: 11px; padding: 4px 8px; }
  tr.subrow.depth-1 td.name { padding-left: 28px; }
  tr.subrow.depth-2 td.name { padding-left: 48px; }
  tr.subrow.depth-3 td.name { padding-left: 68px; }
  tr.subrow.depth-4 td.name { padding-left: 88px; }
  tr.subrow td.name { color: var(--ink-dim); }
  tr.subrow td.system, tr.subrow td.poolbadge {
    /* Children share the parent's system + pool — leave columns empty
       so the eye reads them as continuation of the row above. */
    opacity: 0;
  }
  tr.subrow td.input input[type="number"] { width: 80px; }
  tr.subrow td.observed input { width: 110px; }
  tr.subrow td.verified select { font-size: 10px; }
  tr.hidden { display: none; }

  td.input {
    white-space: nowrap;
  }
  td.input input[type="number"] {
    width: 100px; padding: 4px 6px; font-size: 12px; font-family: monospace;
    background: #09090b; border: 1px solid var(--border); border-radius: 3px;
    color: var(--ink); text-align: right;
  }
  td.input input[type="number"]:focus { outline: none; border-color: var(--accent); }
  td.input input.filled { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.04); }
  td.input .eq-ref {
    margin-left: 4px;
    background: #18181b; color: var(--ink-dim); border: 1px solid var(--border-strong);
    border-radius: 3px; padding: 3px 6px; font-size: 10px; cursor: pointer;
    font-family: monospace;
  }
  td.input .eq-ref:hover { color: var(--accent); border-color: var(--accent); }
  td.input .eq-ref:disabled { opacity: 0.3; cursor: not-allowed; }
  /* Aggregation badge — appears on parent rows whose Max is derivable
     from children (Σ for sum, Π for product). Clicking re-pulls from
     descendants in case the parent's Max drifted out of sync. */
  td.input .agg-badge {
    margin-left: 4px;
    background: rgba(56, 189, 248, 0.1);
    color: var(--accent);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 3px;
    padding: 3px 5px;
    font-size: 10px;
    font-family: monospace;
    cursor: pointer;
  }
  td.input .agg-badge:hover {
    background: rgba(56, 189, 248, 0.2);
  }
  td.input input[type="number"].agg-driven {
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(56, 189, 248, 0.04);
  }
  td.ref.has-override {
    color: var(--gold);
    font-weight: 600;
  }
  td.notes input { width: 100%; }
  td.notes input, td.observed input {
    background: #09090b; border: 1px solid var(--border); border-radius: 3px;
    color: var(--ink); padding: 4px 6px; font-size: 12px;
  }
  td.observed input { width: 140px; }
  td.verified select {
    background: #09090b; border: 1px solid var(--border); border-radius: 3px;
    color: var(--ink); padding: 4px 6px; font-size: 11px;
  }
  tr.no-data { opacity: 0.65; }
  tr.has-max { background: rgba(52, 211, 153, 0.04); }
  /* "maxed" status outshines plain has-max — gold tint signals
     "this source is at its theoretical ceiling, no more to gain". */
  tr.maxed { background: rgba(250, 204, 21, 0.08); }
  tr.maxed.has-max { background: rgba(250, 204, 21, 0.10); }
  tr.maxed td.input input.filled { border-color: rgba(250, 204, 21, 0.6); }
  /* P2W flag pill — sits at the end of the Source name to mark the row.
     Clickable: click to toggle the per-source P2W override off (revealing
     the muted "+P2W" stub the user can click again to re-flag). */
  td.name .p2w-badge {
    display: inline-block; margin-left: 6px;
    background: rgba(244, 114, 182, 0.12);
    color: #f9a8d4;
    border: 1px solid rgba(244, 114, 182, 0.4);
    border-radius: 3px; padding: 0px 5px;
    font-size: 9px; font-family: monospace;
    vertical-align: middle;
    cursor: pointer;
    transition: background 100ms, color 100ms;
  }
  td.name .p2w-badge:hover {
    background: rgba(244, 114, 182, 0.25);
  }
  td.name .p2w-stub {
    display: inline-block; margin-left: 6px;
    background: transparent;
    color: var(--ink-mute);
    border: 1px dashed var(--border-strong);
    border-radius: 3px; padding: 0px 5px;
    font-size: 9px; font-family: monospace;
    vertical-align: middle;
    cursor: pointer;
    opacity: 0.4;
  }
  tr:hover td.name .p2w-stub { opacity: 0.9; }
  td.name .p2w-stub:hover {
    color: #f9a8d4;
    border-color: rgba(244, 114, 182, 0.4);
    opacity: 1;
  }
  /* Editable name text — looks like normal text, but a hint on hover */
  td.name .name-text {
    cursor: text;
    border-bottom: 1px dotted transparent;
    transition: border-color 100ms;
  }
  tr:hover td.name .name-text:not(.editing) {
    border-bottom-color: rgba(56, 189, 248, 0.4);
  }
  td.name input.name-edit {
    background: #09090b;
    border: 1px solid var(--accent);
    border-radius: 3px;
    color: var(--ink);
    padding: 2px 6px;
    font-size: 13px;
    font-family: inherit;
    min-width: 200px;
  }
  td.name .name-reset {
    margin-left: 4px;
    background: transparent;
    color: var(--ink-mute);
    border: none;
    cursor: pointer;
    font-size: 11px;
    padding: 0 4px;
  }
  td.name .name-reset:hover { color: var(--accent); }
  .filter-pill {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; padding: 3px 8px;
    border: 1px solid var(--border-strong); border-radius: 999px;
    color: var(--ink-dim); cursor: pointer; background: #18181b;
  }
  .filter-pill.active {
    color: var(--gold); border-color: rgba(250, 204, 21, 0.4);
    background: rgba(250, 204, 21, 0.1);
  }
  footer {
    margin-top: 30px; font-size: 11px; color: var(--ink-mute);
    text-align: center; border-top: 1px solid var(--border); padding-top: 12px;
  }
  footer code { color: var(--ink-dim); }
  .pulse { animation: pulse 1.2s ease-out; }
  @keyframes pulse {
    0% { background-color: rgba(56, 189, 248, 0.3); }
    100% { background-color: transparent; }
  }
  .seed-btn {
    background: rgba(52, 211, 153, 0.1) !important;
    color: var(--green) !important;
    border-color: rgba(52, 211, 153, 0.4) !important;
  }
  .seed-btn:hover { background: rgba(52, 211, 153, 0.2) !important; }
  .seed-banner {
    margin-bottom: 14px; padding: 10px 14px;
    border: 1px solid rgba(56, 189, 248, 0.3);
    background: rgba(56, 189, 248, 0.05);
    border-radius: 8px;
    color: var(--ink-dim); font-size: 12px;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  }
  .seed-banner b { color: var(--ink); }
  .seed-banner .top {
    margin-left: auto; font-family: monospace; color: var(--gold);
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🎯 DR Source Max Values — Research Tool</h1>
    <div class="sub">
      Stipulate the theoretical / observed maximum for every DR source.
      Values persist in localStorage (browser-local). Use
      <b>↑ Export</b> to ship a JSON for collaboration, <b>↓ Import</b>
      to merge a teammate's.
    </div>
  </header>

  <div class="toolbar">
    <input type="search" id="search" placeholder="🔍 filter by source name, system, or world…" />
    <button id="filter-blank" class="filter-pill" title="Show only sources without a max value yet">
      Show only blanks
    </button>
    <button id="filter-mine" class="filter-pill" title="Show only sources I've filled in">
      Show only filled
    </button>
    <button id="filter-p2w" class="filter-pill" title="Hide paid-only sources (Bundles, real-money DLC)">
      💰 Hide P2W
    </button>
    <button id="expand-all" title="Expand every world section">↓ Expand</button>
    <button id="collapse-all" title="Collapse every world section">↑ Collapse</button>
    <button id="export" title="Download a JSON of current max-value entries">↑ Export</button>
    <label title="Import a teammate's JSON — merges, blanks don't overwrite filled values">
      ↓ Import
      <input type="file" id="import" accept="application/json,.json" />
    </label>
    <button id="apply-seed" class="seed-btn" hidden title="Apply the IT-leaderboard-derived seed values">
      🌱 Apply IT seed
    </button>
    <span id="ref-snap-btns"></span>
    <button id="set-all-ref"
      title="For every BLANK row, copy its reference value into Max. Existing maxes are left alone."
    >
      = Fill blanks with ref
    </button>
    <label title="Load a snapshot JSON exported from the main app's Snapshot History. Refreshes the Ref column for every source.">
      💾 Load save snapshot
      <input type="file" id="snap-import" accept="application/json,.json" />
    </label>
    <button id="clear-ref-override" hidden
      title="Discard the loaded save snapshot — revert Ref column to the catalog default (zArkhe)."
    >
      ✕ Clear save
    </button>
    <span class="stats" id="stats"></span>
  </div>

  <div id="seed-banner" class="seed-banner" hidden></div>
  <div id="ref-banner" class="seed-banner" hidden></div>

  <div id="content"></div>

  <footer>
    Catalog generated <code id="genstamp"></code> from reference save
    <code id="refsave"></code>. Regenerate with
    <code>npx tsx web/scripts/gen-source-catalog.ts</code>.
  </footer>
</div>

<script type="application/json" id="catalog">${inline}</script>
<script>
(function () {
  "use strict";
  const STORAGE_KEY = "dr-max-values.v1";
  const COLLAPSE_KEY = "dr-max-values.world-collapsed.v1";
  // Override map: { [sourceId]: number } from a user-loaded save snapshot.
  // Lives in localStorage so the loaded save persists across reloads.
  const REF_OVERRIDE_KEY = "dr-max-values.ref-override.v1";
  // Meta about the loaded snapshot: { charName, capturedAt }
  const REF_META_KEY = "dr-max-values.ref-meta.v1";
  // Expanded source rows (the chevron has been clicked open). Stored as
  // a Set<string> of source ids; persisted to localStorage so the
  // drill-down state survives reloads.
  const EXPANDED_KEY = "dr-max-values.expanded.v1";

  const catalog = JSON.parse(document.getElementById("catalog").textContent);
  document.getElementById("genstamp").textContent =
    new Date(catalog.generatedAt).toLocaleString();
  document.getElementById("refsave").textContent = catalog.refSave;

  // Surface the IT-seed banner + Apply button when the generator was
  // able to embed a seed (populate-max-from-it.ts ran beforehand).
  const seed = catalog.itSeed;
  if (seed && seed.values) {
    const btn = document.getElementById("apply-seed");
    btn.hidden = false;
    const banner = document.getElementById("seed-banner");
    banner.hidden = false;
    const drTop = seed.drTopReference || "";
    const entryCount = Object.keys(seed.values).length;
    banner.innerHTML =
      '<span>🌱 <b>' + entryCount + '</b> entries pre-seeded from IT leaderboards' +
      ' (top-1 per board). Click <b>Apply IT seed</b> to merge them into your local ' +
      'values — manual edits keep their extra fields.</span>' +
      (drTop ? '<span class="top">' + escapeHtml(drTop) + '</span>' : '');
  }

  /** Per-source user data:
   *    { [sourceId]: { maxValue?:number, observedOn?:string,
   *                    notes?:string, verified?:string } }
   *  verified ∈ "" | "observed" | "researched" | "theorized" | "maxed" */
  function loadValues() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  }
  function saveValues(v) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }
    catch (e) { /* quota */ }
  }
  function loadCollapsedWorlds() {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  }
  function saveCollapsedWorlds(v) {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(v)); }
    catch (e) { /* quota */ }
  }

  function loadRefOverride() {
    try {
      const raw = localStorage.getItem(REF_OVERRIDE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  }
  function saveRefOverride(v) {
    try { localStorage.setItem(REF_OVERRIDE_KEY, JSON.stringify(v)); }
    catch (e) { /* quota */ }
  }
  function loadRefMeta() {
    try {
      const raw = localStorage.getItem(REF_META_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) { return null; }
  }
  function saveRefMeta(m) {
    try {
      if (m) localStorage.setItem(REF_META_KEY, JSON.stringify(m));
      else localStorage.removeItem(REF_META_KEY);
    } catch (e) { /* quota */ }
  }

  function loadExpanded() {
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) { return new Set(); }
  }
  function saveExpanded(s) {
    try { localStorage.setItem(EXPANDED_KEY, JSON.stringify([...s])); }
    catch (e) { /* quota */ }
  }

  let values = loadValues();
  let collapsedWorlds = loadCollapsedWorlds();
  let refOverride = loadRefOverride();
  let refMeta = loadRefMeta();
  let expandedIds = loadExpanded();
  let filterText = "";
  let filterMode = "all"; // "all" | "blank" | "filled"
  // P2W filter — persists in localStorage so the user's preference
  // (typically "hide P2W" for F2P planning) survives reloads.
  const P2W_KEY = "dr-max-values.hide-p2w.v1";
  let hideP2W = false;
  try {
    hideP2W = localStorage.getItem(P2W_KEY) === "1";
  } catch (e) { /* ignore */ }

  /** Effective reference value for a source — uses the loaded snapshot's
   *  value when one is present, else falls back to the catalog default
   *  (zArkhe baseline). */
  function getRefValue(src) {
    if (Object.prototype.hasOwnProperty.call(refOverride, src.id)) {
      return Number(refOverride[src.id]) || 0;
    }
    return src.refValue;
  }
  function hasRefOverride(id) {
    return Object.prototype.hasOwnProperty.call(refOverride, id);
  }

  // Group catalog sources by world, then by bucket.
  function group() {
    const byWorld = new Map();
    for (const src of catalog.sources) {
      const w = src.world;
      if (!byWorld.has(w)) byWorld.set(w, new Map());
      const byBucket = byWorld.get(w);
      if (!byBucket.has(src.bucket)) byBucket.set(src.bucket, []);
      byBucket.get(src.bucket).push(src);
    }
    return byWorld;
  }

  /** Walk every source AND every descendant, calling cb on each. */
  function eachSource(cb) {
    function walk(s) {
      cb(s);
      if (s.children) for (const c of s.children) walk(c);
    }
    for (const top of catalog.sources) walk(top);
  }

  // -- Source index + parent map. Built once at startup so the
  //    auto-aggregation pass can walk up from a leaf to its ancestors
  //    in O(depth) instead of re-walking the whole catalog. --
  const sourceById = new Map();
  const parentByChildId = new Map();
  (function indexSources(arr, parentId) {
    for (const s of arr) {
      sourceById.set(s.id, s);
      if (parentId) parentByChildId.set(s.id, parentId);
      if (s.children) indexSources(s.children, s.id);
    }
  })(catalog.sources, null);

  /** Current effective Max for a source — uses the user's manual value
   *  when filled, falls back to the (possibly snapshot-overridden) Ref. */
  function effectiveValue(src) {
    const entry = values[src.id];
    if (entry && typeof entry.maxValue === "number") return entry.maxValue;
    return getRefValue(src);
  }
  /** Display name — user override (if set), else catalog default. */
  function effectiveName(src) {
    const entry = values[src.id];
    if (entry && typeof entry.nameOverride === "string" && entry.nameOverride)
      return entry.nameOverride;
    return src.name;
  }
  /** Whether to treat the row as P2W after merging the user's per-row
   *  override on top of the catalog's auto-detected flag. */
  function effectiveP2W(src) {
    const entry = values[src.id];
    if (entry && typeof entry.p2wOverride === "boolean")
      return entry.p2wOverride;
    return !!src.p2w;
  }

  /** Compute the aggregated value for an agg-tagged parent from its
   *  matching-fmt descendants' effective values. */
  function computeAgg(parent) {
    if (!parent.children || !parent.agg) return null;
    const matching = parent.children.filter((c) => c.fmt === parent.fmt);
    if (matching.length === 0) return null;
    if (parent.agg === "sum") {
      let s = 0;
      for (const c of matching) s += Number(effectiveValue(c)) || 0;
      return s;
    } else if (parent.agg === "product") {
      let p = 1;
      for (const c of matching) p *= Number(effectiveValue(c)) || 1;
      return p;
    }
    return null;
  }

  /** Walk up from childId; for each ancestor with an agg rule,
   *  recompute and persist its Max. Also updates the visible input
   *  in-place (no full re-render) so the user's focus + scroll stay
   *  where they were. */
  function propagateUp(childId) {
    let curId = parentByChildId.get(childId);
    while (curId) {
      const parent = sourceById.get(curId);
      if (parent && parent.agg) {
        const newVal = computeAgg(parent);
        if (newVal !== null && Number.isFinite(newVal)) {
          const next = { ...(values[curId] || {}) };
          next.maxValue = newVal;
          values[curId] = next;
          saveValues(values);
          // Sync the rendered input if it's currently in the DOM.
          const input = document.querySelector(
            'input.max-input[data-source-id="' + CSS.escape(curId) + '"]'
          );
          if (input) {
            input.value = String(newVal);
            input.classList.add("filled", "agg-driven");
            const tr = input.closest("tr");
            if (tr) {
              tr.classList.add("has-max");
              tr.classList.remove("no-data");
            }
          }
        }
      }
      curId = parentByChildId.get(curId);
    }
  }
  function countAllSources() {
    let n = 0;
    eachSource(() => n++);
    return n;
  }
  function countFilledAll() {
    let n = 0;
    eachSource((s) => {
      if (values[s.id] && typeof values[s.id].maxValue === "number") n++;
    });
    return n;
  }

  function passFilter(src) {
    const entry = values[src.id];
    const hasMax = entry && typeof entry.maxValue === "number";
    if (filterMode === "blank" && hasMax) return false;
    if (filterMode === "filled" && !hasMax) return false;
    if (hideP2W && effectiveP2W(src)) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      const displayName = effectiveName(src);
      if (
        !displayName.toLowerCase().includes(q) &&
        !src.name.toLowerCase().includes(q) &&
        !src.system.toLowerCase().includes(q) &&
        !src.world.toLowerCase().includes(q) &&
        !src.bucket.toLowerCase().includes(q) &&
        !(entry && (entry.notes || "").toLowerCase().includes(q)) &&
        !(entry && (entry.observedOn || "").toLowerCase().includes(q))
      ) return false;
    }
    return true;
  }

  function formatRef(v, fmt) {
    if (typeof v !== "number" || !isFinite(v)) return "—";
    if (fmt === "x") return v.toFixed(3) + "x";
    if (fmt === "+") return (v >= 0 ? "+" : "") + v.toFixed(3);
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + "K";
    return v.toFixed(2);
  }

  function updateRefBanner() {
    const banner = document.getElementById("ref-banner");
    const clearBtn = document.getElementById("clear-ref-override");
    if (refMeta) {
      banner.hidden = false;
      clearBtn.hidden = false;
      const matched = refMeta.matchedCount || 0;
      const total = refMeta.totalCount || catalog.sources.length;
      banner.innerHTML =
        '<span>💾 Reference loaded from <b>' + escapeHtml(refMeta.charName) + '</b> ' +
        'snapshot taken ' +
        new Date(refMeta.capturedAt).toLocaleString() + '. ' +
        'Resolved <b>' + matched + '/' + total + '</b> sources. ' +
        'Ref column shows your save\\'s values — use <b>= ref</b> per row or ' +
        '<b>Fill blanks with ref</b> to bulk-apply.</span>';
    } else {
      banner.hidden = true;
      clearBtn.hidden = true;
    }
  }

  function render() {
    updateRefBanner();
    const content = document.getElementById("content");
    content.innerHTML = "";
    const byWorld = group();
    let visibleSources = 0;
    const totalSources = countAllSources();
    const filledSources = countFilledAll();

    for (const world of catalog.worldOrder) {
      const buckets = byWorld.get(world);
      if (!buckets || buckets.size === 0) continue;
      // Filter at the source level to get a visible-count for this world.
      // Filled / Total count descendants recursively so the progress bar
      // reflects the deepest catalog level.
      let worldVisible = 0;
      let worldFilled = 0;
      let worldTotal = 0;
      function walkCount(s) {
        worldTotal++;
        if (values[s.id] && typeof values[s.id].maxValue === "number")
          worldFilled++;
        if (s.children) for (const c of s.children) walkCount(c);
      }
      for (const [, list] of buckets) {
        for (const src of list) {
          walkCount(src);
          if (passFilter(src)) worldVisible++;
        }
      }
      if (worldVisible === 0) continue;
      visibleSources += worldVisible;

      const isCollapsed = !!collapsedWorlds[world];
      const section = document.createElement("section");
      section.className = "world-section";

      const header = document.createElement("button");
      header.className = "world-header" + (isCollapsed ? "" : " open");
      header.type = "button";
      const pct = worldTotal > 0 ? Math.round((worldFilled / worldTotal) * 100) : 0;
      header.innerHTML =
        '<span class="arrow">' + (isCollapsed ? "▸" : "▾") + '</span>' +
        '<span>' + (catalog.worldEmoji[world] || "") + ' ' + escapeHtml(world) + '</span>' +
        '<span class="progress">' +
          '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
          worldFilled + '/' + worldTotal + ' filled' +
        '</span>' +
        '<span class="count">' + worldVisible + ' visible</span>';
      header.onclick = () => {
        collapsedWorlds[world] = !collapsedWorlds[world];
        saveCollapsedWorlds(collapsedWorlds);
        render();
      };
      section.appendChild(header);

      if (!isCollapsed) {
        for (const [bucketName, sources] of buckets) {
          const visibleSrc = sources.filter(passFilter);
          if (visibleSrc.length === 0) continue;
          const group = document.createElement("div");
          group.className = "bucket-group";
          group.innerHTML = '<div class="bucket-title">' + escapeHtml(bucketName) + '</div>';
          const table = document.createElement("table");
          table.innerHTML =
            '<thead><tr>' +
              '<th>Source</th>' +
              '<th>System</th>' +
              '<th>Pool</th>' +
              '<th style="text-align:right">Ref (zArkhe)</th>' +
              '<th style="text-align:right">Max value</th>' +
              '<th>Observed on</th>' +
              '<th>Notes</th>' +
              '<th>Status</th>' +
            '</tr></thead>';
          const tbody = document.createElement("tbody");
          for (const src of visibleSrc) {
            // Recursively emit the source row and any expanded descendants.
            appendRowAndChildren(tbody, src, 0);
          }
          table.appendChild(tbody);
          group.appendChild(table);
          section.appendChild(group);
        }
      }
      content.appendChild(section);
    }

    document.getElementById("stats").innerHTML =
      '<b>' + filledSources + '</b>/' + totalSources +
      ' filled · <b>' + visibleSources + '</b> visible';
  }

  /** Append src and (if expanded) its descendants to tbody. The
   *  caller passes depth=0 for top-level rows; recursion increments. */
  function appendRowAndChildren(tbody, src, depth) {
    tbody.appendChild(renderRow(src, depth));
    if (expandedIds.has(src.id) && src.children) {
      for (const c of src.children) {
        appendRowAndChildren(tbody, c, depth + 1);
      }
    }
  }

  function renderRow(src, depth) {
    const entry = values[src.id] || {};
    const hasMax = typeof entry.maxValue === "number";
    const hasChildren = !!(src.children && src.children.length);
    const isOpen = expandedIds.has(src.id);
    const tr = document.createElement("tr");
    tr.className = hasMax ? "has-max" : "no-data";
    if (entry.verified === "maxed") tr.classList.add("maxed");
    if (depth > 0) tr.classList.add("subrow", "depth-" + depth);

    const tdName = document.createElement("td");
    tdName.className = "name";
    // Chevron button — clickable when the source has children, dead-space
    // dot otherwise (so columns line up).
    const chev = document.createElement("span");
    chev.className = "chev" + (hasChildren ? "" : " no-children");
    chev.textContent = hasChildren ? (isOpen ? "▾" : "▸") : "·";
    if (hasChildren) {
      chev.title = isOpen
        ? "Collapse — hide " + src.children.length + " sub-source(s)"
        : "Expand — show " + src.children.length + " sub-source(s)";
      chev.onclick = () => {
        if (expandedIds.has(src.id)) expandedIds.delete(src.id);
        else expandedIds.add(src.id);
        saveExpanded(expandedIds);
        render();
      };
    }
    tdName.appendChild(chev);

    // ── Inline-editable name span ──
    // Click on the span swaps it for an <input>; blur/Enter commits the
    // override, Escape cancels. The user can rename ANY source (top-level
    // or sub) to whatever helps them research it — stored as
    // values[src.id].nameOverride. A small "↺" reset button appears next
    // to overridden names.
    const isOverridden =
      !!(entry.nameOverride && typeof entry.nameOverride === "string");
    const displayName = effectiveName(src);
    const nameText = document.createElement("span");
    nameText.className = "name-text";
    nameText.textContent = displayName;
    nameText.title = isOverridden
      ? "Renamed from: " + src.name + "  ·  Click to edit"
      : "Click to rename";
    nameText.onclick = (ev) => {
      ev.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.className = "name-edit";
      input.value = effectiveName(src);
      nameText.classList.add("editing");
      nameText.replaceWith(input);
      input.focus();
      input.select();
      let committed = false;
      function commit() {
        if (committed) return;
        committed = true;
        const next = { ...(values[src.id] || {}) };
        const trimmed = input.value.trim();
        if (!trimmed || trimmed === src.name) {
          delete next.nameOverride;
        } else {
          next.nameOverride = trimmed;
        }
        if (Object.keys(next).length === 0) delete values[src.id];
        else values[src.id] = next;
        saveValues(values);
        render(); // simplest way to refresh chevron + reset button state
      }
      input.onblur = commit;
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        } else if (e.key === "Escape") {
          committed = true;
          render();
        }
      };
    };
    tdName.appendChild(nameText);
    if (isOverridden) {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "name-reset";
      resetBtn.textContent = "↺";
      resetBtn.title = "Reset name to catalog default: " + src.name;
      resetBtn.onclick = (ev) => {
        ev.stopPropagation();
        const next = { ...(values[src.id] || {}) };
        delete next.nameOverride;
        if (Object.keys(next).length === 0) delete values[src.id];
        else values[src.id] = next;
        saveValues(values);
        render();
      };
      tdName.appendChild(resetBtn);
    }

    // ── P2W toggle ──
    // Show a filled pink "P2W" pill when effective P2W is true; clicking
    // it toggles OFF (sets p2wOverride: false). When P2W is off, show a
    // muted dashed "💰 P2W?" stub that, when clicked, sets the override
    // to true. The auto-detected flag from the catalog (src.p2w) acts as
    // the default if no override is set.
    const isP2W = effectiveP2W(src);
    if (isP2W) {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "p2w-badge";
      badge.textContent = "P2W";
      badge.title = src.p2w
        ? "Real-money DLC / Bundle — gated by purchase.\\nClick to mark this source as NOT P2W."
        : "Manually flagged as P2W.\\nClick to remove the flag.";
      badge.onclick = (ev) => {
        ev.stopPropagation();
        const next = { ...(values[src.id] || {}) };
        next.p2wOverride = false;
        values[src.id] = next;
        saveValues(values);
        render();
      };
      tdName.appendChild(badge);
    } else {
      const stub = document.createElement("button");
      stub.type = "button";
      stub.className = "p2w-stub";
      stub.textContent = "💰 ?";
      stub.title = src.p2w
        ? "Catalog flagged this as P2W; you cleared it.\\nClick to re-flag."
        : "Mark this source as P2W (paid-only / locked behind a real-money purchase).";
      stub.onclick = (ev) => {
        ev.stopPropagation();
        const next = { ...(values[src.id] || {}) };
        if (src.p2w) {
          // Catalog says P2W but user cleared it — re-flagging just
          // removes the override so we fall back to the catalog default.
          delete next.p2wOverride;
        } else {
          next.p2wOverride = true;
        }
        if (Object.keys(next).length === 0) delete values[src.id];
        else values[src.id] = next;
        saveValues(values);
        render();
      };
      tdName.appendChild(stub);
    }

    tr.appendChild(tdName);

    const tdSys = document.createElement("td");
    tdSys.className = "system";
    tdSys.textContent = (catalog.systemEmoji[src.system] || "") + " " + src.system;
    tr.appendChild(tdSys);

    const tdPool = document.createElement("td");
    tdPool.className = "poolbadge";
    tdPool.innerHTML = src.pool === "Multi"
      ? '<span class="mul">Multi</span>'
      : '<span class="add">Additive</span>';
    tr.appendChild(tdPool);

    const refVal = getRefValue(src);
    const tdRef = document.createElement("td");
    tdRef.className = "ref" + (hasRefOverride(src.id) ? " has-override" : "");
    tdRef.textContent = formatRef(refVal, src.fmt);
    if (hasRefOverride(src.id))
      tdRef.title = "Loaded from " + (refMeta?.charName || "save snapshot");
    tr.appendChild(tdRef);

    const tdInput = document.createElement("td");
    tdInput.className = "input";
    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.step = "any";
    maxInput.placeholder = "—";
    maxInput.className = "max-input";
    maxInput.setAttribute("data-source-id", src.id);
    maxInput.value = hasMax ? String(entry.maxValue) : "";
    if (hasMax) maxInput.classList.add("filled");
    maxInput.oninput = () => {
      const v = maxInput.value === "" ? undefined : Number(maxInput.value);
      const next = { ...(values[src.id] || {}) };
      if (v === undefined || isNaN(v)) {
        delete next.maxValue;
      } else {
        next.maxValue = v;
      }
      if (Object.keys(next).length === 0) delete values[src.id];
      else values[src.id] = next;
      saveValues(values);
      // Light-touch UI sync (no full re-render — keep focus + scroll)
      maxInput.classList.toggle("filled", typeof next.maxValue === "number");
      // The user just MANUALLY edited this row — drop the agg-driven
      // tint since the value is no longer auto-computed.
      maxInput.classList.remove("agg-driven");
      tr.classList.toggle("has-max", typeof next.maxValue === "number");
      tr.classList.toggle("no-data", typeof next.maxValue !== "number");
      updateStats();
      // Roll the change UP the ancestor chain — any agg-tagged parent
      // recomputes from its (now-updated) children's effective values.
      propagateUp(src.id);
    };
    tdInput.appendChild(maxInput);

    // "= ref" — one-click copy of the current Ref into Max for this row.
    const eqBtn = document.createElement("button");
    eqBtn.type = "button";
    eqBtn.className = "eq-ref";
    eqBtn.textContent = "= ref";
    eqBtn.title = "Set Max to the current reference value (" +
      formatRef(refVal, src.fmt) + ")";
    eqBtn.onclick = () => {
      const v = Number(refVal) || 0;
      maxInput.value = String(v);
      const next = { ...(values[src.id] || {}) };
      next.maxValue = v;
      values[src.id] = next;
      saveValues(values);
      maxInput.classList.add("filled");
      maxInput.classList.remove("agg-driven");
      tr.classList.add("has-max");
      tr.classList.remove("no-data");
      updateStats();
      // Same propagation as a manual edit — parents recompute.
      propagateUp(src.id);
    };
    tdInput.appendChild(eqBtn);

    // Aggregation badge — present only on parents whose Max can be
    // derived from children. Clicking force-recomputes from current
    // children (useful if the parent's Max drifted out of sync, e.g.
    // after a manual override). The input also paints itself with
    // the agg-driven tint whenever the value matches the computed one.
    if (src.agg) {
      const agg = document.createElement("button");
      agg.type = "button";
      agg.className = "agg-badge";
      agg.textContent = src.agg === "sum" ? "Σ" : "Π";
      agg.title =
        (src.agg === "sum"
          ? "Σ — Max auto-computed as the SUM of matching-fmt children. "
          : "Π — Max auto-computed as the PRODUCT of matching-fmt children. ") +
        "Click to re-pull from current children.";
      agg.onclick = () => {
        const newVal = computeAgg(src);
        if (newVal === null) return;
        maxInput.value = String(newVal);
        const next = { ...(values[src.id] || {}) };
        next.maxValue = newVal;
        values[src.id] = next;
        saveValues(values);
        maxInput.classList.add("filled", "agg-driven");
        tr.classList.add("has-max");
        tr.classList.remove("no-data");
        updateStats();
        propagateUp(src.id);
      };
      tdInput.appendChild(agg);
      // If the stored Max matches what we'd auto-compute, paint the
      // input with the agg-driven tint so the user knows it's synced.
      const computed = computeAgg(src);
      if (
        computed !== null &&
        typeof entry.maxValue === "number" &&
        Math.abs(entry.maxValue - computed) < 1e-6
      ) {
        maxInput.classList.add("agg-driven");
      }
    }
    tr.appendChild(tdInput);

    const tdObs = document.createElement("td");
    tdObs.className = "observed";
    const obsInput = document.createElement("input");
    obsInput.type = "text";
    obsInput.placeholder = "player / save";
    obsInput.value = entry.observedOn || "";
    obsInput.oninput = () => {
      const next = { ...(values[src.id] || {}) };
      if (obsInput.value) next.observedOn = obsInput.value;
      else delete next.observedOn;
      if (Object.keys(next).length === 0) delete values[src.id];
      else values[src.id] = next;
      saveValues(values);
    };
    tdObs.appendChild(obsInput);
    tr.appendChild(tdObs);

    const tdNotes = document.createElement("td");
    tdNotes.className = "notes";
    const notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.placeholder = "source / link / context";
    notesInput.value = entry.notes || "";
    notesInput.oninput = () => {
      const next = { ...(values[src.id] || {}) };
      if (notesInput.value) next.notes = notesInput.value;
      else delete next.notes;
      if (Object.keys(next).length === 0) delete values[src.id];
      else values[src.id] = next;
      saveValues(values);
    };
    tdNotes.appendChild(notesInput);
    tr.appendChild(tdNotes);

    const tdVer = document.createElement("td");
    tdVer.className = "verified";
    const sel = document.createElement("select");
    sel.innerHTML =
      '<option value="">—</option>' +
      '<option value="observed">observed</option>' +
      '<option value="researched">researched</option>' +
      '<option value="theorized">theorized</option>' +
      '<option value="maxed">maxed</option>';
    sel.value = entry.verified || "";
    sel.onchange = () => {
      const next = { ...(values[src.id] || {}) };
      if (sel.value) next.verified = sel.value;
      else delete next.verified;
      if (Object.keys(next).length === 0) delete values[src.id];
      else values[src.id] = next;
      saveValues(values);
      // Light-touch row sync — toggle the gold "maxed" tint without a
      // full re-render so the user keeps their focus / scroll position.
      tr.classList.toggle("maxed", next.verified === "maxed");
    };
    tdVer.appendChild(sel);
    tr.appendChild(tdVer);

    return tr;
  }

  function updateStats() {
    const filled = countFilledAll();
    const total = countAllSources();
    let visible = 0;
    for (const src of catalog.sources) if (passFilter(src)) visible++;
    document.getElementById("stats").innerHTML =
      '<b>' + filled + '</b>/' + total +
      ' filled · <b>' + visible + '</b> top-level visible';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Search + filter wiring
  document.getElementById("search").addEventListener("input", (e) => {
    filterText = e.target.value || "";
    render();
  });
  const blankBtn = document.getElementById("filter-blank");
  const mineBtn = document.getElementById("filter-mine");
  const p2wBtn = document.getElementById("filter-p2w");
  blankBtn.onclick = () => {
    filterMode = filterMode === "blank" ? "all" : "blank";
    blankBtn.classList.toggle("active", filterMode === "blank");
    mineBtn.classList.toggle("active", filterMode === "filled");
    render();
  };
  mineBtn.onclick = () => {
    filterMode = filterMode === "filled" ? "all" : "filled";
    blankBtn.classList.toggle("active", filterMode === "blank");
    mineBtn.classList.toggle("active", filterMode === "filled");
    render();
  };
  // Initial paint of the P2W pill if it was active last session.
  if (hideP2W) p2wBtn.classList.add("active");
  p2wBtn.onclick = () => {
    hideP2W = !hideP2W;
    try { localStorage.setItem(P2W_KEY, hideP2W ? "1" : "0"); }
    catch (e) { /* ignore */ }
    p2wBtn.classList.toggle("active", hideP2W);
    render();
  };
  document.getElementById("expand-all").onclick = () => {
    collapsedWorlds = {};
    saveCollapsedWorlds(collapsedWorlds);
    render();
  };
  document.getElementById("collapse-all").onclick = () => {
    for (const w of catalog.worldOrder) collapsedWorlds[w] = true;
    saveCollapsedWorlds(collapsedWorlds);
    render();
  };

  // Reusable merge so Import (file) and Apply seed (embedded) share semantics.
  function mergeValues(incoming) {
    let added = 0, updated = 0;
    for (const id in incoming) {
      const cur = values[id];
      const inc = incoming[id];
      if (!cur) {
        values[id] = inc;
        added++;
      } else {
        const merged = { ...cur };
        for (const k of Object.keys(inc)) {
          if (inc[k] !== undefined && inc[k] !== null && inc[k] !== "")
            merged[k] = inc[k];
        }
        values[id] = merged;
        updated++;
      }
    }
    saveValues(values);
    return { added, updated };
  }

  // Apply embedded IT seed → merge into localStorage, same semantics as Import.
  const applySeedBtn = document.getElementById("apply-seed");
  if (applySeedBtn) {
    applySeedBtn.onclick = () => {
      if (!seed || !seed.values) return;
      const { added, updated } = mergeValues(seed.values);
      alert(
        "Applied IT seed: " + added + " new + " + updated + " merged entries. " +
        "Inspect 'IT seed' in the notes column to refine."
      );
      render();
    };
  }

  // Bulk: fill every BLANK row's Max with its current Ref value. Filled
  // rows are preserved — this is for fast onboarding, not bulk overwrite.
  document.getElementById("set-all-ref").onclick = () => {
    let filled = 0;
    for (const src of catalog.sources) {
      const cur = values[src.id];
      if (cur && typeof cur.maxValue === "number") continue;
      const refVal = Number(getRefValue(src)) || 0;
      if (refVal === 0) continue; // skip empty refs — adds no info
      const next = { ...(cur || {}) };
      next.maxValue = refVal;
      values[src.id] = next;
      filled++;
    }
    saveValues(values);
    alert(
      "Set Max = Ref on " + filled + " blank rows. " +
      "Already-filled rows kept their values."
    );
    render();
  };

  // Load a save snapshot JSON — the same format the main app's Snapshot
  // History exports. We pull the most-recent snapshot's flatTree and use
  // it to override the Ref column for every catalog source whose id
  // matches a path in the flat tree.
  document.getElementById("snap-import").onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        // Two shapes accepted:
        //   1. The full storage export: { snapshotsByChar: { [char]: [...] } }
        //   2. A single flatTree dump (unlikely but supported): { flatTree: {...} }
        let latest = null;
        let mostRecent = -Infinity;
        if (parsed.snapshotsByChar && typeof parsed.snapshotsByChar === "object") {
          for (const charName of Object.keys(parsed.snapshotsByChar)) {
            const list = parsed.snapshotsByChar[charName];
            if (!Array.isArray(list)) continue;
            for (const snap of list) {
              if (!snap || !snap.flatTree) continue;
              const ts = Number(snap.capturedAt) || 0;
              if (ts > mostRecent) {
                mostRecent = ts;
                latest = { charName: snap.charName || charName, flatTree: snap.flatTree, capturedAt: ts };
              }
            }
          }
        } else if (parsed.flatTree && typeof parsed.flatTree === "object") {
          latest = {
            charName: parsed.charName || "unknown",
            flatTree: parsed.flatTree,
            capturedAt: Number(parsed.capturedAt) || Date.now(),
          };
        }
        if (!latest) {
          alert(
            "Couldn't find a snapshot with a flatTree in that file. " +
            "Use the main app's Snapshot History → 💾 Save snapshot " +
            "(captures the tree) → ↑ Export."
          );
          return;
        }
        // Build the override map — only keys present in the flatTree get
        // overridden. Sources missing from the snapshot fall back to the
        // catalog default (zArkhe).
        const overrides = {};
        let matched = 0;
        for (const src of catalog.sources) {
          if (Object.prototype.hasOwnProperty.call(latest.flatTree, src.id)) {
            overrides[src.id] = Number(latest.flatTree[src.id]) || 0;
            matched++;
          }
        }
        refOverride = overrides;
        refMeta = {
          charName: latest.charName,
          capturedAt: latest.capturedAt,
          matchedCount: matched,
          totalCount: catalog.sources.length,
        };
        saveRefOverride(refOverride);
        saveRefMeta(refMeta);
        alert(
          "Loaded snapshot for " + latest.charName + " from " +
          new Date(latest.capturedAt).toLocaleString() + ".\\n" +
          matched + "/" + catalog.sources.length + " sources resolved."
        );
        render();
      } catch (err) {
        alert("Load failed: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Clear the loaded snapshot → revert Ref to the catalog default.
  document.getElementById("clear-ref-override").onclick = () => {
    refOverride = {};
    refMeta = null;
    saveRefOverride(refOverride);
    saveRefMeta(null);
    render();
  };

  // Apply a single embedded reference snapshot — same code path as the
  // file picker import, just with the data inlined at generation time.
  function applyEmbeddedSnap(snap) {
    const overrides = {};
    let matched = 0;
    for (const src of catalog.sources) {
      function walk(s) {
        if (Object.prototype.hasOwnProperty.call(snap.flatTree, s.id)) {
          overrides[s.id] = Number(snap.flatTree[s.id]) || 0;
          matched++;
        }
        if (s.children) for (const c of s.children) walk(c);
      }
      walk(src);
    }
    refOverride = overrides;
    refMeta = {
      charName: snap.charName,
      capturedAt: snap.capturedAt,
      matchedCount: matched,
      totalCount: countAllSources(),
    };
    saveRefOverride(refOverride);
    saveRefMeta(refMeta);
    render();
  }

  // Inject one button per embedded snapshot (e.g. Dragami).
  const snapBtnsHost = document.getElementById("ref-snap-btns");
  if (snapBtnsHost && Array.isArray(catalog.refSnapshots)) {
    for (const snap of catalog.refSnapshots) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seed-btn";
      btn.title =
        snap.emoji + " Load " + snap.charName + " — DR " +
        (snap.computedDropRate ? snap.computedDropRate.toFixed(0) + "x" : "?") +
        ". Overrides the Ref column with this character's values.";
      btn.textContent = snap.emoji + " " + (snap.label || "Load " + snap.charName);
      btn.onclick = () => applyEmbeddedSnap(snap);
      snapBtnsHost.appendChild(btn);
    }
  }

  // Export → JSON download
  document.getElementById("export").onclick = () => {
    const payload = {
      schema: "dr-max-values",
      version: 1,
      generatedAt: new Date().toISOString(),
      catalogGeneratedAt: catalog.generatedAt,
      values,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dr-max-values-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import → merge (keep existing filled entries if incoming is blank)
  document.getElementById("import").onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || typeof parsed !== "object" || !parsed.values) {
          alert("Import failed — file doesn't look like a dr-max-values export.");
          return;
        }
        const { added, updated } = mergeValues(parsed.values);
        alert("Imported " + added + " new + " + updated + " merged entries.");
        render();
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  render();
})();
</script>
</body>
</html>
`;
}
