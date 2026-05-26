// ===== DR MAX-VALUES RESEARCH TOOL — generator =====
// Walks the live DR tree (zArkhe baseline) and emits two artifacts:
//   1. web/data/dr-source-catalog.json — recursive catalog of every DR
//      source row, tagged with system / world / fmt / refValue / agg
//      rule / P2W heuristic flag.
//   2. web/public/dr-max-values.html   — standalone research tool. The
//      catalog AND a bundled DR compute pipeline (built by
//      build-dr-bundle.ts) are inlined so the user can paste any save
//      JSON, pick a character + map, and see the Ref column refresh in
//      place. Works at file:// too.
//
// Pipeline:
//   npx tsx web/scripts/build-dr-bundle.ts        # builds the compute bundle
//   npx tsx web/scripts/gen-source-catalog.ts     # builds catalog + HTML

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  id: string;
  name: string;
  system: SystemKey;
  world: WorldKey;
  pool: "Additive" | "Multi";
  fmt: "+" | "x" | "raw";
  refValue: number;
  bucket: string;
  note?: string;
  children?: SourceEntry[];
  p2w?: boolean;
  /** Closed-form rule the parent's reference value satisfies. See
   *  detectAgg() for the full vocabulary. The HTML maps each to a
   *  recomputer in computeAgg(). */
  agg?: AggRule;
  /** Optional structural formula key — when the formula depends on the
   *  ROW SHAPE (children pattern) rather than the parent's exact name,
   *  we tag it with a key here and the runtime looks up CUSTOM_FORMULAS
   *  by formulaKey first. Used e.g. for friend contributions where the
   *  parent's name is the friend's chosen display string. */
  formulaKey?: string;
};

// Catalog-only placeholders / safety nets — never trackable sources.
const SKIP_NAMES = new Set([
  "No active sources",
  "Available DR Items (not equipped)",
  "Available DR Obols (not equipped)",
  "Not Unlocked",
]);

/** Aggregation detection — tag a parent with the closed-form rule its
 *  reference value satisfies. Order matters: more specific matches first
 *  so we never tag a richer pattern as "sum" by accident.
 *
 *  Currently detects:
 *    - "custom"        — handled by a per-name function in CUSTOM_FORMULAS
 *                        (Arcane Map, Tome 2 / 7, Talent 328, Glimbo, etc.)
 *    - "copy:<name>"   — parent.val matches a "Capped" / "Net" / "Total"
 *                        child verbatim. Common for capped formulas where
 *                        the parent surfaces the post-cap value
 *    - "sum"           — parent fmt:"+", Σ matching-fmt children
 *    - "additiveMulti" — parent fmt:"x", Π (1 + c.val/100) for "+" children
 *    - "product"       — parent fmt:"x", Π matching-fmt children
 *    - "productAB"     — parent fmt:"+", val ≈ childA × childB for some pair
 *                        (one "x" multiplier × one "+" / "raw" base). Covers
 *                        the base × multi pattern */
type AggRule =
  | "sum"
  | "product"
  | "additiveMulti"
  | "productAB"
  | "custom"
  | `copy:${string}`;

function looksCustomNamed(name: string): boolean {
  return CUSTOM_FORMULA_NAMES.has(name);
}

/** Structural detection — keyed by row SHAPE not name. Returns a
 *  formula key that the runtime CUSTOM_FORMULAS table looks up.
 *  Lets us encode formulas for rows whose name varies per save (e.g.
 *  the friend's display name on a Friend Bonus contribution row). */
function detectStructuralFormula(
  node: CorganNode,
  sys: SystemKey
): string | null {
  // Friends system, row carries exactly one "Score" leaf as a child →
  // this is the friend's bonus contribution. Formula:
  //   contrib = 25 × min(1, 0.2 + clamp(score, 0, 12000)/(c + 3000))
  if (sys === "Friends") {
    const kids = node.children || [];
    if (kids.some((c) => c.name === "Score")) return "friendContribution";
  }
  return null;
}

// Source names we provide explicit formulas for in the HTML. Catalog
// generation just records the marker — the actual formula lives in
// CUSTOM_FORMULAS inside the embedded APP_JS (so we can use the bundled
// Math helpers without re-implementing them server-side).
const CUSTOM_FORMULA_NAMES = new Set<string>([
  "Arcane Map Bonus",
  "Drop Rate Additive (Tome 2)",
  "Drop Rate Multi (Tome 7)",
  "Archlord Of The Pirates (Talent 328)",
  "Glimbo DR Multi",
]);

function detectAgg(
  parent: CorganNode,
  children: CorganNode[]
): AggRule | null {
  if (!children.length) return null;
  // 1. Custom formula trumps everything
  if (looksCustomNamed(parent.name)) return "custom";

  const parentVal = Number(parent.val) || 0;
  // 2. "copy" — when a single child carries the post-cap / post-formula
  //    value verbatim. Common in arcane/spelunk patterns where the
  //    parent surfaces "Capped Bonus" / "Net" / "Total" as one of its
  //    own children.
  for (const c of children) {
    if (
      /^(Capped|Net|Total|Effective)\b/i.test(c.name) &&
      c.fmt === parent.fmt &&
      Math.abs((Number(c.val) || 0) - parentVal) < 0.005
    ) {
      return `copy:${c.name}` as const;
    }
  }

  if (parent.fmt === "+") {
    const matching = children.filter((c) => c.fmt === "+");
    if (matching.length > 0) {
      const sum = matching.reduce((a, c) => a + (Number(c.val) || 0), 0);
      if (Math.abs(sum - parentVal) < 0.1) return "sum";
    }
    // 3b. base × multi: parent (fmt:"+") = (matching-fmt or "raw" child A)
    //     × (single fmt:"x" multiplier B). Tries every (A, B) pair.
    const multis = children.filter((c) => c.fmt === "x");
    const bases = children.filter((c) => c.fmt === "+" || c.fmt === "raw");
    if (multis.length === 1 && bases.length >= 1) {
      const m = Number(multis[0].val) || 1;
      for (const b of bases) {
        const bv = Number(b.val) || 0;
        if (Math.abs(bv * m - parentVal) < 0.1) return "productAB";
      }
    }
  } else if (parent.fmt === "x") {
    const xs = children.filter((c) => c.fmt === "x");
    if (xs.length > 0) {
      const prod = xs.reduce((a, c) => a * (Number(c.val) || 1), 1);
      if (Math.abs(prod - (parentVal || 1)) < 0.005) return "product";
    }
    const adds = children.filter((c) => c.fmt === "+");
    if (adds.length > 0) {
      const am = adds.reduce(
        (a, c) => a * (1 + (Number(c.val) || 0) / 100),
        1
      );
      if (Math.abs(am - (parentVal || 1)) < 0.005) return "additiveMulti";
    }
  }
  return null;
}

function looksP2W(name: string, system: SystemKey): boolean {
  if (system === "Bundles") return true;
  if (/\(Bundle\s/.test(name)) return true;
  return false;
}

function collectChildren(
  parent: CorganNode,
  parentPath: string,
  bucket: CorganNode,
  sys: SystemKey,
  world: WorldKey,
  poolBadge: "Additive" | "Multi"
): SourceEntry[] {
  const kids = parent.children || [];
  const out: SourceEntry[] = [];
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (SKIP_NAMES.has(child.name)) continue;
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
    const grandKids = collectChildren(child, childPath, bucket, sys, world, poolBadge);
    if (grandKids.length > 0) {
      entry.children = grandKids;
      const fkey = detectStructuralFormula(child, sys);
      if (fkey) {
        entry.formulaKey = fkey;
        entry.agg = "custom";
      } else {
        const agg = detectAgg(child, child.children || []);
        if (agg) entry.agg = agg;
      }
    }
    out.push(entry);
  }
  return out;
}

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
// charIdx 2 (zArkhe), mapIdx 0 (Town, factor 1) — the same baseline the
// rest of the tooling uses.
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
      const badge: "Additive" | "Multi" = bucket.fmt === "x" ? "Multi" : "Additive";
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
      const subs = collectChildren(src, id, bucket, sys, world, badge);
      if (subs.length > 0) {
        entry.children = subs;
        const fkey = detectStructuralFormula(src, sys);
        if (fkey) {
          entry.formulaKey = fkey;
          entry.agg = "custom";
        } else {
          const agg = detectAgg(src, src.children || []);
          if (agg) entry.agg = agg;
        }
      }
      sources.push(entry);
    }
  }
}

const repoRoot = resolve(__dirname, "..", "..");
const catalogPath = resolve(repoRoot, "web/data/dr-source-catalog.json");
const bundlePath = resolve(repoRoot, "web/data/dr-compute-bundle.js");
const htmlPath = resolve(repoRoot, "web/public/dr-max-values.html");

mkdirSync(dirname(catalogPath), { recursive: true });
mkdirSync(dirname(htmlPath), { recursive: true });

const catalog = {
  generatedAt: new Date().toISOString(),
  refTotal: r.total,
  refSave: "zArkhe (save 25-21-16.json) — Town, no AC",
  sourceCount: sources.length,
  worldEmoji: WORLD_EMOJI,
  systemEmoji: SYSTEM_EMOJI,
  worldOrder: WORLD_ORDER,
  sources,
};
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

// Read the pre-built compute bundle (build-dr-bundle.ts must have run first).
let bundleJs = "";
try {
  bundleJs = readFileSync(bundlePath, "utf8");
} catch {
  console.warn(
    `\n!! Compute bundle not found at ${bundlePath}.\n   Run: npx tsx web/scripts/build-dr-bundle.ts\n`
  );
}
// Splitting the bundle around any literal "</script>" tokens is paranoia
// against esbuild emitting one in minified string content — at the cost
// of one extra trivial concat per occurrence.
const safeBundle = bundleJs.split("</script>").join("</scr\"+\"ipt>");

// HTML write happens at the BOTTOM of this file, after CSS / BODY /
// APP_JS const declarations have evaluated (buildHtml closes over them).

// =============================================================
// HTML BUILDER
// =============================================================
function buildHtml(cat: typeof catalog, bundle: string): string {
  const catJson = JSON.stringify(cat);
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    "<title>DR Source Max Values — Research Tool</title>",
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    "<style>" + CSS + "</style>",
    "</head><body>",
    BODY,
    '<script type="application/json" id="catalog">' + catJson + "</script>",
    "<script>" + bundle + "</script>",
    "<script>" + APP_JS + "</script>",
    "</body></html>",
  ].join("\n");
}

// =============================================================
// CSS
// =============================================================
const CSS = `
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
  --pink: #f9a8d4;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.4;
}
.wrap { max-width: 1400px; margin: 0 auto; padding: 14px 18px 48px; }
header h1 { margin: 0 0 4px; font-size: 22px; color: var(--gold); font-weight: 700; }
header .sub { color: var(--ink-dim); font-size: 12px; margin-bottom: 14px; }

/* ── Save loader block ── */
.loader {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 14px; margin-bottom: 12px;
}
.loader h2 {
  margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--ink-dim);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.loader textarea {
  width: 100%; min-height: 60px; max-height: 200px;
  background: #09090b; border: 1px solid var(--border); border-radius: 4px;
  color: var(--ink); padding: 6px 8px; font-family: monospace; font-size: 11px;
  resize: vertical;
}
.loader textarea:focus { outline: none; border-color: var(--accent); }
.loader-controls {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px;
}
.loader-controls button {
  background: var(--accent); color: #09090b; border: none; border-radius: 4px;
  padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.loader-controls button:hover { background: #7dd3fc; }
.loader-controls button.clear {
  background: #18181b; color: var(--red); border: 1px solid rgba(248, 113, 113, 0.4);
}
.loader-controls button.clear:hover { background: rgba(248, 113, 113, 0.1); }
.loader-controls #loader-status { color: var(--ink-dim); font-size: 12px; }
.loader-controls #loader-status.err { color: var(--red); }
.loader-controls #loader-status.ok { color: var(--green); }
.char-map-row {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 10px;
  padding-top: 10px; border-top: 1px solid var(--border);
}
.char-map-row label { font-size: 12px; color: var(--ink-dim); }
.char-map-row select {
  background: #18181b; color: var(--ink); border: 1px solid var(--border-strong);
  border-radius: 4px; padding: 4px 8px; font-size: 12px; margin-left: 6px;
}
.char-map-row .big-dr {
  margin-left: auto; font-family: monospace; font-size: 16px;
  color: var(--gold); font-weight: 600;
}

/* ── Toolbar ── */
.toolbar {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  padding: 8px 10px; margin-bottom: 12px;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
}
.toolbar input[type="search"] {
  flex: 1; min-width: 200px;
  background: #09090b; color: var(--ink);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 5px 10px; font-size: 12px;
}
.toolbar input[type="search"]:focus { outline: none; border-color: var(--accent); }
.toolbar button {
  background: #18181b; color: var(--ink); border: 1px solid var(--border-strong);
  border-radius: 4px; padding: 4px 9px; font-size: 11px; cursor: pointer;
  font-family: inherit;
}
.toolbar button:hover { background: #27272a; }
.toolbar .pill {
  border-radius: 999px; padding: 3px 9px;
  color: var(--ink-dim); background: #18181b;
}
.toolbar .pill.active {
  color: var(--gold); border-color: rgba(250, 204, 21, 0.4);
  background: rgba(250, 204, 21, 0.1);
}
.toolbar label {
  font-size: 11px; color: var(--ink-dim); cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 9px; border: 1px solid var(--border-strong); border-radius: 4px;
  background: #18181b;
}
.toolbar label:hover { background: #27272a; }
.toolbar label input[type="file"] { display: none; }
.toolbar #stats { color: var(--ink-dim); font-size: 11px; margin-left: auto; }
.toolbar #stats b { color: var(--ink); }

/* ── Tree ── */
.world-section {
  border: 1px solid var(--border); border-radius: 8px;
  background: rgba(24, 24, 27, 0.3); margin-bottom: 10px; overflow: hidden;
}
.world-header {
  width: 100%; text-align: left;
  background: none; color: var(--accent); border: none;
  padding: 8px 14px; font-size: 15px; font-weight: 600;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer;
}
.world-header.open { border-bottom: 1px solid var(--border); }
.world-header .arrow { color: var(--ink-mute); font-size: 11px; width: 12px; }
.world-header .progress {
  margin-left: auto; font-size: 11px; color: var(--ink-mute); font-weight: 400;
  display: inline-flex; align-items: center; gap: 6px;
}
.world-header .progress .bar {
  width: 70px; height: 5px; background: #27272a; border-radius: 3px; overflow: hidden;
}
.world-header .progress .bar > i {
  display: block; height: 100%; background: var(--green);
}

.bucket {
  padding: 4px 0 8px;
}
.bucket-title {
  color: var(--ink-dim); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.1em; padding: 8px 14px 4px; font-weight: 600;
}

/* ── Per-source row ── */
.row {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 14px;
  border-bottom: 1px solid rgba(39, 39, 42, 0.4);
  font-size: 12px;
}
.row:last-child { border-bottom: none; }
.row.no-data { opacity: 0.7; }
.row.has-max { background: rgba(52, 211, 153, 0.03); }
.row.maxed { background: rgba(250, 204, 21, 0.07); }
.row.maxed.has-max { background: rgba(250, 204, 21, 0.1); }
.row .chev {
  width: 14px; text-align: center; color: var(--ink-mute);
  font-size: 11px; cursor: pointer; flex-shrink: 0; user-select: none;
}
.row .chev.no-children { cursor: default; opacity: 0.25; }
.row .chev:not(.no-children):hover { color: var(--accent); }

.row .name {
  flex: 1.6; min-width: 180px;
  display: flex; align-items: center; gap: 6px;
  white-space: nowrap; overflow: hidden;
  color: var(--ink); font-weight: 500;
}
.row .name .name-text { overflow: hidden; text-overflow: ellipsis; }
.row .rename {
  width: 160px;
  background: #09090b; border: 1px solid var(--border); border-radius: 3px;
  color: var(--ink); padding: 3px 6px; font-size: 11px; font-family: inherit;
}
.row .rename:focus { outline: none; border-color: var(--accent); }
.row .rename:not(:placeholder-shown) {
  border-color: rgba(250, 204, 21, 0.4);
}
.row .p2w-btn {
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: 3px; padding: 1px 6px; font-size: 9px;
  font-family: monospace; cursor: pointer; color: var(--ink-mute);
  opacity: 0.4;
  transition: opacity 100ms, color 100ms, background 100ms, border-color 100ms;
}
.row:hover .p2w-btn { opacity: 0.9; }
.row .p2w-btn.on {
  background: rgba(244, 114, 182, 0.12);
  color: var(--pink);
  border-color: rgba(244, 114, 182, 0.4);
  opacity: 1;
}
.row .p2w-btn:hover {
  background: rgba(244, 114, 182, 0.2);
  color: var(--pink);
  border-color: rgba(244, 114, 182, 0.4);
  opacity: 1;
}

.row .ref-col {
  width: 90px; text-align: right;
  font-family: monospace; font-size: 11px; color: var(--ink-dim);
}
.row .ref-col.has-override { color: var(--gold); font-weight: 600; }
.row .pull-ref {
  background: #18181b; color: var(--ink-mute); border: 1px solid var(--border-strong);
  border-radius: 3px; padding: 2px 6px; font-size: 10px;
  font-family: monospace; cursor: pointer;
  flex-shrink: 0;
}
.row .pull-ref:hover { color: var(--accent); border-color: var(--accent); }
.row .pull-ref.clean-btn:hover { color: var(--red); border-color: var(--red); }

.row .max-col {
  /* Auto-sized so it shrink-wraps around its contents (input + ← ref +
     ✕ clean / OR input + Σ badge). The previous fixed 110px was
     narrower than the three-button manual layout, which made the
     notes-input column overlap the buttons. */
  display: inline-flex; align-items: center; gap: 4px;
  flex-shrink: 0;
  min-width: 110px;
}
.row .max-input {
  width: 90px;
  background: #09090b; border: 1px solid var(--border); border-radius: 3px;
  color: var(--ink); padding: 3px 6px; font-size: 11px; font-family: monospace;
  text-align: right;
}
.row .max-input:focus { outline: none; border-color: var(--accent); }
.row .max-input.filled { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.04); }
.row .max-input.agg-driven { border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.04); }
.row .max-input.readonly {
  background: rgba(56, 189, 248, 0.05);
  border-style: dashed;
  color: var(--accent);
  cursor: not-allowed;
}
.row .max-input.readonly:focus { outline: none; }
.row .agg-badge {
  background: rgba(56, 189, 248, 0.1); color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 3px; padding: 1px 4px;
  font-size: 10px; font-family: monospace; cursor: pointer;
}
.row .agg-badge:hover { background: rgba(56, 189, 248, 0.2); }

.row .notes-input {
  flex: 1.2; min-width: 150px;
  background: #09090b; border: 1px solid var(--border); border-radius: 3px;
  color: var(--ink); padding: 3px 6px; font-size: 11px; font-family: inherit;
}
.row .notes-input:focus { outline: none; border-color: var(--accent); }

.row .status-select {
  width: 100px;
  background: #09090b; border: 1px solid var(--border); border-radius: 3px;
  color: var(--ink); padding: 2px 4px; font-size: 11px;
}

/* Sub-row indentation */
.row.depth-1 { padding-left: 36px; font-size: 11px; }
.row.depth-2 { padding-left: 58px; font-size: 11px; }
.row.depth-3 { padding-left: 80px; font-size: 11px; }
.row.depth-4 { padding-left: 102px; font-size: 11px; }
.row.depth-1 .name, .row.depth-2 .name, .row.depth-3 .name, .row.depth-4 .name {
  color: var(--ink-dim);
}

footer {
  margin-top: 24px; font-size: 11px; color: var(--ink-mute);
  text-align: center; border-top: 1px solid var(--border); padding-top: 10px;
}
footer code { color: var(--ink-dim); }
`;

// =============================================================
// BODY MARKUP
// =============================================================
const BODY = `
<div class="wrap">
  <header>
    <h1>🎯 DR Source Max Values — Research Tool</h1>
    <div class="sub">
      Set a theoretical / observed ceiling per source. Manual values
      persist in localStorage. Children roll up to their parents
      automatically wherever a simple formula applies.
    </div>
  </header>

  <section class="loader">
    <h2>📋 Save data — paste a raw save JSON (Copy for Support) or a snapshot</h2>
    <textarea id="save-paste" placeholder='Paste the save JSON here…'></textarea>
    <div class="loader-controls">
      <button id="load-save" type="button">Load save</button>
      <button id="clear-save" type="button" class="clear" hidden>Clear save</button>
      <span id="loader-status"></span>
    </div>
    <div id="char-map-row" class="char-map-row" hidden>
      <label>Character: <select id="char-select"></select></label>
      <label>Map: <select id="map-select"></select></label>
      <span class="big-dr" id="big-dr"></span>
    </div>
  </section>

  <div class="toolbar">
    <input type="search" id="search" placeholder="🔍 filter by name…" />
    <button id="filter-blank" class="pill">Show blanks</button>
    <button id="filter-filled" class="pill">Show filled</button>
    <button id="filter-p2w" class="pill">💰 Hide P2W</button>
    <label><input type="checkbox" id="hide-zero" /> Hide inactive</label>
    <button id="expand-all">↓ Expand</button>
    <button id="collapse-all">↑ Collapse</button>
    <button id="reset-expand">↺ Reset</button>
    <button id="export">↑ Export</button>
    <label>↓ Import<input type="file" id="import" accept="application/json,.json" /></label>
    <span id="stats"></span>
  </div>

  <div id="content"></div>

  <footer>
    Catalog generated <code id="genstamp"></code> · Baseline
    <code id="refsave"></code> · Regenerate with
    <code>npx tsx web/scripts/build-dr-bundle.ts &amp;&amp; npx tsx web/scripts/gen-source-catalog.ts</code>.
  </footer>
</div>
`;

// =============================================================
// APP JS
// =============================================================
const APP_JS = `
(function () {
  "use strict";
  var STORAGE = {
    values: "dr-max-values.v2",
    collapsed: "dr-max-values.world-collapsed.v2",
    expanded: "dr-max-values.expanded.v2",
    refOverride: "dr-max-values.ref-override.v2",
    refMeta: "dr-max-values.ref-meta.v2",
    hideP2W: "dr-max-values.hide-p2w.v2",
    pasteText: "dr-max-values.paste-text.v2",
    charIdx: "dr-max-values.char-idx.v2",
    mapIdx: "dr-max-values.map-idx.v2",
  };

  var catalog = JSON.parse(document.getElementById("catalog").textContent);
  document.getElementById("genstamp").textContent =
    new Date(catalog.generatedAt).toLocaleString();
  document.getElementById("refsave").textContent = catalog.refSave;

  // ===== STATE =====
  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var p = JSON.parse(raw);
      return p === null || p === undefined ? fallback : p;
    } catch (e) { return fallback; }
  }
  function saveJson(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* quota */ }
  }
  function saveStr(key, v) {
    try {
      if (v === null || v === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, String(v));
    } catch (e) { /* quota */ }
  }
  var values = loadJson(STORAGE.values, {});
  var collapsedWorlds = loadJson(STORAGE.collapsed, {});
  var expandedIds = new Set(loadJson(STORAGE.expanded, []));
  var refOverride = loadJson(STORAGE.refOverride, {});
  var refMeta = loadJson(STORAGE.refMeta, null);
  var hideP2W = localStorage.getItem(STORAGE.hideP2W) === "1";
  var filterText = "";
  var filterMode = "all"; // "all" | "blank" | "filled"
  var hideZero = false;

  // ===== INDEX =====
  var sourceById = new Map();
  var parentByChildId = new Map();
  (function indexSources(arr, parentId) {
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      sourceById.set(s.id, s);
      if (parentId) parentByChildId.set(s.id, parentId);
      if (s.children) indexSources(s.children, s.id);
    }
  })(catalog.sources, null);

  function eachSource(cb) {
    function walk(s) { cb(s); if (s.children) for (var i = 0; i < s.children.length; i++) walk(s.children[i]); }
    for (var i = 0; i < catalog.sources.length; i++) walk(catalog.sources[i]);
  }

  // ===== ACCESSORS =====
  function getRefValue(src) {
    if (Object.prototype.hasOwnProperty.call(refOverride, src.id))
      return Number(refOverride[src.id]) || 0;
    return src.refValue;
  }
  function hasRefOverride(id) {
    return Object.prototype.hasOwnProperty.call(refOverride, id);
  }
  function effectiveValue(src) {
    var e = values[src.id];
    if (e && typeof e.maxValue === "number") return e.maxValue;
    return getRefValue(src);
  }
  // The display name is ALWAYS the catalog default — the per-row text
  // input next to the name only captures a free-text tag/note (stored
  // under values[id].tag) so the user can jot down research context
  // without changing the source's display name or triggering anything
  // that touches the agg formulas.
  function effectiveName(src) {
    return src.name;
  }
  function effectiveP2W(src) {
    var e = values[src.id];
    if (e && typeof e.p2wOverride === "boolean") return e.p2wOverride;
    return !!src.p2w;
  }
  function patchEntry(id, patch) {
    var next = Object.assign({}, values[id] || {}, patch);
    // Clear undefined keys
    for (var k in patch) if (patch[k] === undefined) delete next[k];
    if (Object.keys(next).length === 0) delete values[id];
    else values[id] = next;
    saveJson(STORAGE.values, values);
  }

  // ===== AGG / FORMULAS =====
  // Per-source closed-form formulas. Each handler gets the parent
  // SourceEntry and an array of its children; returns the recomputed
  // parent value from the children's effective values (or null to opt
  // out). The agg-rule "custom" in the catalog routes to this dict.
  function kid(kids, namePattern) {
    var rx = namePattern instanceof RegExp ? namePattern : new RegExp("^" + namePattern + "$");
    for (var i = 0; i < kids.length; i++) {
      if (rx.test(kids[i].name)) return Number(effectiveValue(kids[i])) || 0;
    }
    return null;
  }
  var CUSTOM_FORMULAS = {
    // ── Structural keys (catalog tags rows via formulaKey) ──────────
    "friendContribution": function (_p, kids) {
      // contrib = 25 × min(1, 0.2 + c/(c + 3000))  where c = clamp(score, 0, 12000)
      var score = kid(kids, /^Score$/);
      if (score == null) return null;
      var c = Math.min(12000, Math.max(0, score));
      return 25 * Math.min(1, 0.2 + c / (c + 3000));
    },
    // ── Per-name keys ───────────────────────────────────────────────
    "Arcane Map Bonus": function (_p, kids) {
      var kills = kid(kids, /^Map Kills$/);
      var cap = kid(kids, /^Cap$/);
      if (kills == null || kills < 1) return 0;
      var lg = Math.log(Math.max(kills, 1)) / Math.LN10;
      var lg2 = Math.log(Math.max(kills, 1)) / Math.LN2;
      var raw = (2 * Math.max(0, lg - 3.5) + Math.max(0, lg2 - 12)) * (lg / 2.5) +
                Math.min(2, kills / 1000) +
                Math.max(5 * (lg - 5), 0);
      return cap == null ? raw : Math.min(cap, raw);
    },
    "Drop Rate Additive (Tome 2)": function (_p, kids) {
      var base = kid(kids, /^Base$/);
      var multi = kid(kids, /^Tome Multi$/);
      if (base == null || multi == null) return 0;
      return base * multi;
    },
    "Drop Rate Multi (Tome 7)": function (_p, kids) {
      var base = kid(kids, /^Base$/);
      var multi = kid(kids, /^Tome Multi$/);
      if (base == null || multi == null) return 0;
      return base * multi;
    },
    "Archlord Of The Pirates (Talent 328)": function (_p, kids) {
      // total = 1 + (talVal × log10(plunder)) / 100
      var talVal = kid(kids, /^Talent Value$/);
      var plunder = kid(kids, /^Plunderous Kills$/);
      if (talVal == null || plunder == null || plunder < 1) return 1;
      return 1 + (talVal * (Math.log(Math.max(plunder, 1)) / Math.LN10)) / 100;
    },
    "Glimbo DR Multi": function (_p, kids) {
      // 1 + (gridVal × tradeGroups) / 100 where gridVal already lives
      // on one of the children (typically "Glimbo Insider Trading
      // Secrets (Grid 168) Level" mediated through the parent structure).
      // We look for an explicit "Total Trades" child if present and a
      // per-level / shape stack. Fallback: just preserve the parent.
      var trades = kid(kids, /^Total Trades$/);
      var lv = kid(kids, /^.*Grid 168.*Level$/);
      var shape = kid(kids, /^Shape Bonus$/);
      var am = kid(kids, /^All Multi$/);
      if (trades == null) return null;
      var perLv = 1; // per-level bonus on grid 168
      var gridVal = (lv != null ? lv : 1) * perLv *
                    (shape != null ? shape : 1) *
                    Math.max(1, am != null ? am : 1);
      var groups = Math.floor(Math.max(0, trades) / 100);
      return 1 + (gridVal * groups) / 100;
    },
  };

  /** Children visible to the aggregation. When the Hide P2W filter is
   *  on, P2W rows are removed from the agg entirely — matches the
   *  visual filter so the parent's computed Max reflects "what would
   *  the DR be without paying?". The custom-formula handlers also call
   *  this via the kid() helper indirectly: the kid() lookup walks
   *  effectiveChildren so a hidden P2W input just isn't there. */
  function effectiveChildren(parent) {
    var kids = parent.children || [];
    if (!hideP2W) return kids;
    return kids.filter(function (c) { return !effectiveP2W(c); });
  }
  /** Walk every formula-tagged parent and recompute its Max. Used when
   *  the user flips Hide P2W (since the filter changes what each agg
   *  sees) and after a fresh save load. */
  function recomputeAllFormulas() {
    // Topo order: descend, then on the way back up assign. eachSource
    // already walks in pre-order which means we'd compute parents
    // BEFORE their children. Instead, collect all formula parents and
    // sort by depth descending so leaves' formulas resolve first.
    var formulaSrcs = [];
    eachSource(function (s) { if (hasFormula(s)) formulaSrcs.push(s); });
    function depthOf(id) {
      var d = 0, cur = parentByChildId.get(id);
      while (cur) { d++; cur = parentByChildId.get(cur); }
      return d;
    }
    formulaSrcs.sort(function (a, b) { return depthOf(b.id) - depthOf(a.id); });
    for (var i = 0; i < formulaSrcs.length; i++) {
      var s = formulaSrcs[i];
      var v = computeAgg(s);
      if (v !== null && Number.isFinite(v)) {
        // Only write a value when the recomputation produces something
        // — if the formula relies on a hidden P2W child and bails to
        // null, we leave the previous max alone.
        patchEntry(s.id, { maxValue: v });
      }
    }
  }

  function computeAgg(parent) {
    var rule = parent.agg;
    if (!rule || !parent.children) return null;
    var kids = effectiveChildren(parent);

    // 1. Custom — registered per-formulaKey first, then per-name. The
    //    formulaKey path is used by structurally-tagged rows (e.g. each
    //    friend's bonus contribution, whose 'name' is the friend's
    //    chosen display string, not stable across saves).
    if (rule === "custom") {
      var fn = (parent.formulaKey && CUSTOM_FORMULAS[parent.formulaKey]) ||
               CUSTOM_FORMULAS[parent.name];
      if (!fn) return null;
      try { return fn(parent, kids); } catch (e) { return null; }
    }

    // 2. Copy from a specific child
    if (typeof rule === "string" && rule.indexOf("copy:") === 0) {
      var target = rule.slice(5);
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].name === target) return Number(effectiveValue(kids[i])) || 0;
      }
      return null;
    }

    var matching = kids.filter(function (c) { return c.fmt === parent.fmt; });
    if (rule === "sum") {
      var s = 0;
      for (var a = 0; a < matching.length; a++) s += Number(effectiveValue(matching[a])) || 0;
      return s;
    }
    if (rule === "product") {
      var p = 1;
      for (var b = 0; b < matching.length; b++) p *= Number(effectiveValue(matching[b])) || 1;
      return p;
    }
    if (rule === "additiveMulti") {
      // Π (1 + c.val/100) over "+" children
      var adds = kids.filter(function (c) { return c.fmt === "+"; });
      var am = 1;
      for (var x = 0; x < adds.length; x++) am *= 1 + (Number(effectiveValue(adds[x])) || 0) / 100;
      return am;
    }
    if (rule === "productAB") {
      // base × multi: pick the single "x" child and ONE non-"x" child
      // whose product (currently) matches the parent — that pair stays
      // the canonical formula even as values change.
      var multis = kids.filter(function (c) { return c.fmt === "x"; });
      var bases = kids.filter(function (c) { return c.fmt !== "x"; });
      if (multis.length !== 1 || bases.length === 0) return null;
      var m = Number(effectiveValue(multis[0])) || 1;
      // We need to determine WHICH base child is the canonical one.
      // Strategy: pick the one whose (ref × multi ref) matches the
      // catalog refValue. That selection is deterministic per source
      // and lets the runtime pin to it once and forever.
      var canon = null;
      var bestErr = Infinity;
      var pVal = Number(parent.refValue) || 0;
      for (var y = 0; y < bases.length; y++) {
        var br = Number(bases[y].refValue) || 0;
        var mr = Number(multis[0].refValue) || 1;
        var err = Math.abs(br * mr - pVal);
        if (err < bestErr) { bestErr = err; canon = bases[y]; }
      }
      if (!canon) return null;
      var bv = Number(effectiveValue(canon)) || 0;
      return bv * m;
    }
    return null;
  }
  function hasFormula(src) { return !!src.agg; }
  function propagateUp(childId) {
    var curId = parentByChildId.get(childId);
    while (curId) {
      var parent = sourceById.get(curId);
      if (parent && hasFormula(parent)) {
        var newVal = computeAgg(parent);
        if (newVal !== null && Number.isFinite(newVal)) {
          patchEntry(curId, { maxValue: newVal });
          var input = document.querySelector('input.max-input[data-source-id="' + CSS.escape(curId) + '"]');
          if (input) {
            input.value = String(newVal);
            input.classList.add("filled", "agg-driven");
            var row = input.closest(".row");
            if (row) { row.classList.add("has-max"); row.classList.remove("no-data"); }
          }
        }
      }
      curId = parentByChildId.get(curId);
    }
  }

  // ===== FORMAT =====
  function formatRef(v, fmt) {
    if (typeof v !== "number" || !isFinite(v)) return "—";
    if (fmt === "x") return v.toFixed(3) + "x";
    if (fmt === "+") return (v >= 0 ? "+" : "") + v.toFixed(3);
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + "K";
    return v.toFixed(2);
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ===== FILTERS =====
  function passFilter(src) {
    var e = values[src.id];
    var hasMax = e && typeof e.maxValue === "number";
    if (filterMode === "blank" && hasMax) return false;
    if (filterMode === "filled" && !hasMax) return false;
    if (hideP2W && effectiveP2W(src)) return false;
    if (hideZero && Math.abs(Number(effectiveValue(src)) || 0) < 1e-9) return false;
    if (filterText) {
      var q = filterText.toLowerCase();
      var name = effectiveName(src).toLowerCase();
      if (
        name.indexOf(q) === -1 &&
        src.name.toLowerCase().indexOf(q) === -1 &&
        src.bucket.toLowerCase().indexOf(q) === -1 &&
        (!(e && (e.notes || "").toLowerCase().indexOf(q) !== -1))
      ) return false;
    }
    return true;
  }

  // ===== RENDER =====
  function group() {
    var byWorld = new Map();
    for (var i = 0; i < catalog.sources.length; i++) {
      var s = catalog.sources[i];
      if (!byWorld.has(s.world)) byWorld.set(s.world, new Map());
      var bb = byWorld.get(s.world);
      if (!bb.has(s.bucket)) bb.set(s.bucket, []);
      bb.get(s.bucket).push(s);
    }
    return byWorld;
  }

  function countAll() { var n = 0; eachSource(function () { n++; }); return n; }
  function countFilled() {
    var n = 0; eachSource(function (s) {
      if (values[s.id] && typeof values[s.id].maxValue === "number") n++;
    }); return n;
  }

  function render() {
    var content = document.getElementById("content");
    content.innerHTML = "";

    // Snapshot banner above the tree
    if (refMeta) {
      var banner = document.createElement("div");
      banner.className = "loader";
      banner.style.padding = "8px 12px";
      banner.style.marginBottom = "10px";
      banner.style.background = "rgba(56, 189, 248, 0.05)";
      banner.style.borderColor = "rgba(56, 189, 248, 0.3)";
      banner.innerHTML =
        '<div style="font-size:12px;color:var(--ink-dim)">' +
        '💾 Reference loaded from <b style="color:var(--ink)">' +
        escapeHtml(refMeta.charName) + '</b> · DR <b style="color:var(--gold);font-family:monospace">' +
        (refMeta.computedDropRate ? refMeta.computedDropRate.toFixed(2) + "x" : "?") +
        '</b> on map <b style="color:var(--ink)">' + escapeHtml(refMeta.mapName || "Town") +
        '</b> · resolved <b style="color:var(--ink)">' + (refMeta.matchedCount || 0) +
        "/" + (refMeta.totalCount || catalog.sources.length) + '</b> sources.</div>';
      content.appendChild(banner);
    }

    var byWorld = group();
    var visible = 0;
    for (var wi = 0; wi < catalog.worldOrder.length; wi++) {
      var world = catalog.worldOrder[wi];
      var bb = byWorld.get(world);
      if (!bb) continue;
      var worldFilled = 0, worldTotal = 0, worldVisible = 0;
      var allInWorld = [];
      bb.forEach(function (list) { list.forEach(function (s) { allInWorld.push(s); }); });
      function walkCount(s) {
        worldTotal++;
        if (values[s.id] && typeof values[s.id].maxValue === "number") worldFilled++;
        if (s.children) for (var k = 0; k < s.children.length; k++) walkCount(s.children[k]);
      }
      for (var ai = 0; ai < allInWorld.length; ai++) {
        walkCount(allInWorld[ai]);
        if (passFilter(allInWorld[ai])) worldVisible++;
      }
      if (worldVisible === 0) continue;
      visible += worldVisible;

      var isCollapsed = !!collapsedWorlds[world];
      var section = document.createElement("section");
      section.className = "world-section";
      var header = document.createElement("button");
      header.type = "button";
      header.className = "world-header" + (isCollapsed ? "" : " open");
      var pct = worldTotal > 0 ? Math.round(100 * worldFilled / worldTotal) : 0;
      header.innerHTML =
        '<span class="arrow">' + (isCollapsed ? "▸" : "▾") + '</span>' +
        '<span>' + (catalog.worldEmoji[world] || "") + ' ' + escapeHtml(world) + '</span>' +
        '<span class="progress">' +
          '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
          worldFilled + '/' + worldTotal + ' filled' +
        '</span>';
      (function (w) {
        header.onclick = function () {
          collapsedWorlds[w] = !collapsedWorlds[w];
          saveJson(STORAGE.collapsed, collapsedWorlds);
          render();
        };
      })(world);
      section.appendChild(header);

      if (!isCollapsed) {
        bb.forEach(function (sources, bucketName) {
          var visibleInBucket = sources.filter(passFilter);
          if (visibleInBucket.length === 0) return;
          var bucketEl = document.createElement("div");
          bucketEl.className = "bucket";
          var title = document.createElement("div");
          title.className = "bucket-title";
          title.textContent = bucketName;
          bucketEl.appendChild(title);
          for (var bi = 0; bi < visibleInBucket.length; bi++) {
            renderRowAndChildren(bucketEl, visibleInBucket[bi], 0);
          }
          section.appendChild(bucketEl);
        });
      }
      content.appendChild(section);
    }

    updateStats(visible);
  }

  function renderRowAndChildren(parent, src, depth) {
    // P2W skip at EVERY depth — top-level passFilter only catches the
    // bucket entry point, but the user wants the row gone entirely
    // (and its value excluded from agg, see computeAgg).
    if (hideP2W && effectiveP2W(src)) return;
    parent.appendChild(renderRow(src, depth));
    if (expandedIds.has(src.id) && src.children) {
      for (var i = 0; i < src.children.length; i++) {
        renderRowAndChildren(parent, src.children[i], depth + 1);
      }
    }
  }

  function renderRow(src, depth) {
    var entry = values[src.id] || {};
    var hasMax = typeof entry.maxValue === "number";
    var hasChildren = !!(src.children && src.children.length);
    var isOpen = expandedIds.has(src.id);
    var row = document.createElement("div");
    row.className = "row " + (hasMax ? "has-max" : "no-data");
    if (entry.verified === "maxed") row.classList.add("maxed");
    if (depth > 0) row.classList.add("depth-" + depth);

    // Chevron
    var chev = document.createElement("span");
    chev.className = "chev" + (hasChildren ? "" : " no-children");
    chev.textContent = hasChildren ? (isOpen ? "▾" : "▸") : "·";
    if (hasChildren) {
      chev.title = isOpen ? "Collapse" : "Expand " + src.children.length + " sub-source(s)";
      chev.onclick = function () {
        if (expandedIds.has(src.id)) expandedIds.delete(src.id);
        else expandedIds.add(src.id);
        saveJson(STORAGE.expanded, Array.from(expandedIds));
        render();
      };
    }
    row.appendChild(chev);

    // Name (always-visible rename input + P2W toggle)
    var nameWrap = document.createElement("div");
    nameWrap.className = "name";
    var nameText = document.createElement("span");
    nameText.className = "name-text";
    nameText.textContent = effectiveName(src);
    nameText.title = src.name;
    nameWrap.appendChild(nameText);

    // Free-text TAG input — captures a research note next to the row's
    // name. Decoupled from the actual display name on purpose (an
    // earlier version of this field was a rename override, but typing
    // in it raised concerns about silently triggering formula
    // recomputes). This input never touches the source's name or value
    // logic, just stores the string under values[src.id].tag.
    var tagInput = document.createElement("input");
    tagInput.type = "text";
    tagInput.className = "rename";
    tagInput.placeholder = "tag / note…";
    tagInput.value = entry.tag || "";
    tagInput.title =
      "Free-text label next to the row name. Stored in your local " +
      "notes — does NOT rename the source or affect formulas.";
    tagInput.oninput = function () {
      patchEntry(src.id, { tag: tagInput.value || undefined });
    };
    nameWrap.appendChild(tagInput);

    var p2wBtn = document.createElement("button");
    p2wBtn.type = "button";
    p2wBtn.className = "p2w-btn" + (effectiveP2W(src) ? " on" : "");
    p2wBtn.textContent = "P2W";
    p2wBtn.title = "Toggle the P2W flag — when on, this row is hidden by the Hide P2W filter.";
    p2wBtn.onclick = function () {
      var cur = effectiveP2W(src);
      if (cur === !!src.p2w) {
        patchEntry(src.id, { p2wOverride: !cur });
      } else {
        patchEntry(src.id, { p2wOverride: undefined });
      }
      render();
    };
    nameWrap.appendChild(p2wBtn);

    row.appendChild(nameWrap);

    // Ref (display only) + pull-from-ref button
    var refVal = getRefValue(src);
    var refEl = document.createElement("span");
    refEl.className = "ref-col" + (hasRefOverride(src.id) ? " has-override" : "");
    refEl.textContent = formatRef(refVal, src.fmt);
    refEl.title = "Reference value" + (hasRefOverride(src.id) && refMeta ? " (from " + refMeta.charName + ")" : " (from catalog baseline)");
    row.appendChild(refEl);

    // Max column
    var maxWrap = document.createElement("div");
    maxWrap.className = "max-col";
    var maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.step = "any";
    maxInput.className = "max-input";
    maxInput.setAttribute("data-source-id", src.id);
    maxInput.placeholder = "—";
    maxInput.value = hasMax ? String(entry.maxValue) : "";
    if (hasMax) maxInput.classList.add("filled");
    // Rows with ANY formula rule (sum / product / additive-multi /
    // productAB / copy / custom) get a read-only Max — the value is
    // purely a function of children, so manual edits would create
    // false data and immediately get overwritten on the next child
    // change. The user can still pull a ref (← ref) or click the
    // formula badge to refresh from descendants.
    if (hasFormula(src)) {
      maxInput.readOnly = true;
      maxInput.classList.add("readonly");
      maxInput.title =
        "Auto-computed from children — read-only. Edit a leaf below to update.";
    }
    maxInput.oninput = function () {
      var v = maxInput.value === "" ? undefined : Number(maxInput.value);
      patchEntry(src.id, { maxValue: (v === undefined || isNaN(v)) ? undefined : v });
      var nowFilled = typeof values[src.id] !== "undefined" && typeof values[src.id].maxValue === "number";
      maxInput.classList.toggle("filled", nowFilled);
      maxInput.classList.remove("agg-driven");
      row.classList.toggle("has-max", nowFilled);
      row.classList.toggle("no-data", !nowFilled);
      propagateUp(src.id);
      updateStats(null);
    };
    maxWrap.appendChild(maxInput);

    // ← ref / ✕ clean — only on MANUAL rows. Formula rows are auto-
    // driven by their children so adding manual seed/clear buttons
    // would just confuse the recompute path.
    if (!hasFormula(src)) {
      var pull = document.createElement("button");
      pull.type = "button";
      pull.className = "pull-ref";
      pull.textContent = "← ref";
      pull.title = "Copy the Ref value into Max for this row (" + formatRef(refVal, src.fmt) + ")";
      pull.onclick = function () {
        var v = Number(refVal) || 0;
        maxInput.value = String(v);
        patchEntry(src.id, { maxValue: v });
        maxInput.classList.add("filled");
        maxInput.classList.remove("agg-driven");
        row.classList.add("has-max");
        row.classList.remove("no-data");
        propagateUp(src.id);
        updateStats(null);
      };
      maxWrap.appendChild(pull);

      var cleanBtn = document.createElement("button");
      cleanBtn.type = "button";
      cleanBtn.className = "pull-ref clean-btn";
      cleanBtn.textContent = "✕";
      cleanBtn.title = "Clear this row's Max (parent formulas recompute)";
      cleanBtn.onclick = function () {
        maxInput.value = "";
        patchEntry(src.id, { maxValue: undefined });
        maxInput.classList.remove("filled");
        maxInput.classList.remove("agg-driven");
        row.classList.remove("has-max");
        row.classList.add("no-data");
        propagateUp(src.id);
        updateStats(null);
      };
      maxWrap.appendChild(cleanBtn);
    }
    if (hasFormula(src)) {
      var agg = document.createElement("button");
      agg.type = "button";
      agg.className = "agg-badge";
      // Glyph by rule:
      //   Σ  sum             Π  product          ⋅×  productAB (a×b)
      //   Π+ additiveMulti   ↑  copy:<child>     ƒ  custom
      var rule = src.agg;
      var glyph = "ƒ";
      if (rule === "sum") glyph = "Σ";
      else if (rule === "product") glyph = "Π";
      else if (rule === "additiveMulti") glyph = "%×";
      else if (rule === "productAB") glyph = "·×";
      else if (typeof rule === "string" && rule.indexOf("copy:") === 0) glyph = "=";
      agg.textContent = glyph;
      agg.title =
        (rule === "sum" ? "Σ — sum of matching-fmt children. " :
         rule === "product" ? "Π — product of matching-fmt children. " :
         rule === "additiveMulti" ? "Π(1+c/100) — multiplicative chain of '+' children. " :
         rule === "productAB" ? "base × multi — one child times one × multiplier. " :
         (typeof rule === "string" && rule.indexOf("copy:") === 0)
            ? "Copies the value from child '" + rule.slice(5) + "'. " :
         "Custom formula — see notes. ") +
        "Click to re-pull from current children.";
      agg.onclick = function () {
        var nv = computeAgg(src);
        if (nv === null) return;
        maxInput.value = String(nv);
        patchEntry(src.id, { maxValue: nv });
        maxInput.classList.add("filled", "agg-driven");
        row.classList.add("has-max"); row.classList.remove("no-data");
        propagateUp(src.id);
        updateStats(null);
      };
      maxWrap.appendChild(agg);
      var computed = computeAgg(src);
      if (computed !== null && hasMax && Math.abs(entry.maxValue - computed) < 1e-6) {
        maxInput.classList.add("agg-driven");
      }
    }
    row.appendChild(maxWrap);

    // Notes
    var notes = document.createElement("input");
    notes.type = "text";
    notes.className = "notes-input";
    notes.placeholder = "notes / source / link…";
    notes.value = entry.notes || "";
    notes.oninput = function () {
      patchEntry(src.id, { notes: notes.value || undefined });
    };
    row.appendChild(notes);

    // Status
    var sel = document.createElement("select");
    sel.className = "status-select";
    sel.innerHTML =
      '<option value="">—</option>' +
      '<option value="observed">observed</option>' +
      '<option value="researched">researched</option>' +
      '<option value="theorized">theorized</option>' +
      '<option value="maxed">maxed</option>';
    sel.value = entry.verified || "";
    sel.onchange = function () {
      patchEntry(src.id, { verified: sel.value || undefined });
      row.classList.toggle("maxed", sel.value === "maxed");
    };
    row.appendChild(sel);

    return row;
  }

  function updateStats(visible) {
    var filled = countFilled();
    var total = countAll();
    document.getElementById("stats").innerHTML =
      "<b>" + filled + "</b>/" + total + " filled" +
      (typeof visible === "number" ? " · <b>" + visible + "</b> visible" : "");
  }

  // ===== TOOLBAR WIRING =====
  document.getElementById("search").addEventListener("input", function (e) {
    filterText = e.target.value || "";
    render();
  });
  var blankBtn = document.getElementById("filter-blank");
  var filledBtn = document.getElementById("filter-filled");
  var p2wBtn = document.getElementById("filter-p2w");
  blankBtn.onclick = function () {
    filterMode = filterMode === "blank" ? "all" : "blank";
    blankBtn.classList.toggle("active", filterMode === "blank");
    filledBtn.classList.toggle("active", filterMode === "filled");
    render();
  };
  filledBtn.onclick = function () {
    filterMode = filterMode === "filled" ? "all" : "filled";
    blankBtn.classList.toggle("active", filterMode === "blank");
    filledBtn.classList.toggle("active", filterMode === "filled");
    render();
  };
  if (hideP2W) p2wBtn.classList.add("active");
  p2wBtn.onclick = function () {
    hideP2W = !hideP2W;
    saveStr(STORAGE.hideP2W, hideP2W ? "1" : "0");
    p2wBtn.classList.toggle("active", hideP2W);
    // Every formula-tagged parent has to recompute: P2W children are
    // now in/out of its effectiveChildren() depending on the new state.
    recomputeAllFormulas();
    render();
  };
  var hideZeroChk = document.getElementById("hide-zero");
  hideZeroChk.onchange = function () { hideZero = hideZeroChk.checked; render(); };
  document.getElementById("expand-all").onclick = function () {
    eachSource(function (s) { if (s.children) expandedIds.add(s.id); });
    saveJson(STORAGE.expanded, Array.from(expandedIds));
    var worlds = catalog.worldOrder;
    for (var i = 0; i < worlds.length; i++) collapsedWorlds[worlds[i]] = false;
    saveJson(STORAGE.collapsed, collapsedWorlds);
    render();
  };
  document.getElementById("collapse-all").onclick = function () {
    expandedIds = new Set();
    saveJson(STORAGE.expanded, []);
    render();
  };
  document.getElementById("reset-expand").onclick = function () {
    expandedIds = new Set();
    collapsedWorlds = {};
    saveJson(STORAGE.expanded, []);
    saveJson(STORAGE.collapsed, {});
    render();
  };
  document.getElementById("export").onclick = function () {
    var payload = {
      schema: "dr-max-values",
      version: 2,
      generatedAt: new Date().toISOString(),
      catalogGeneratedAt: catalog.generatedAt,
      values: values,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "dr-max-values-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById("import").onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || !parsed.values) {
          alert("Not a dr-max-values export.");
          return;
        }
        var added = 0, updated = 0;
        for (var id in parsed.values) {
          var inc = parsed.values[id];
          var cur = values[id];
          if (!cur) { values[id] = inc; added++; }
          else {
            var merged = Object.assign({}, cur);
            for (var k in inc) if (inc[k] !== undefined && inc[k] !== null && inc[k] !== "") merged[k] = inc[k];
            values[id] = merged; updated++;
          }
        }
        saveJson(STORAGE.values, values);
        alert("Imported " + added + " new + " + updated + " merged entries.");
        render();
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  // ===== SAVE LOADER =====
  var saveCache = null;       // parsed raw-save object (after load)
  var charSelect = document.getElementById("char-select");
  var mapSelect = document.getElementById("map-select");
  var charMapRow = document.getElementById("char-map-row");
  var statusEl = document.getElementById("loader-status");
  var clearBtn = document.getElementById("clear-save");
  var bigDr = document.getElementById("big-dr");
  var pasteTa = document.getElementById("save-paste");

  // Restore last paste text (in case the user is iterating on a save)
  var savedPaste = localStorage.getItem(STORAGE.pasteText) || "";
  pasteTa.value = savedPaste;
  pasteTa.addEventListener("input", function () {
    try { localStorage.setItem(STORAGE.pasteText, pasteTa.value); } catch (e) { /* */ }
  });

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = kind || "";
  }

  function applyComputed(charIdx, mapIdx) {
    if (!saveCache) return;
    var DR = window.DRMax;
    if (!DR) { setStatus("Compute bundle missing.", "err"); return; }
    try {
      var r = DR.computeCorganDropRate(saveCache, charIdx, mapIdx);
      var flat = DR.flattenTree(r.tree);
      // Build the override map: keep only entries that match a catalog id
      var overrides = {};
      var matched = 0;
      eachSource(function (s) {
        if (Object.prototype.hasOwnProperty.call(flat, s.id)) {
          overrides[s.id] = Number(flat[s.id]) || 0;
          matched++;
        }
      });
      refOverride = overrides;
      var maps = DR.buildMapOptions(saveCache);
      var mapName = (maps.find(function (m) { return m.index === mapIdx; }) || {}).name || "Town";
      var chars = DR.listCharacters(saveCache);
      var charName = (chars[charIdx] || {}).charName || ("char " + charIdx);
      refMeta = {
        charName: charName,
        capturedAt: Date.now(),
        computedDropRate: r.total,
        mapName: mapName,
        matchedCount: matched,
        totalCount: countAll(),
      };
      saveJson(STORAGE.refOverride, refOverride);
      saveJson(STORAGE.refMeta, refMeta);
      saveStr(STORAGE.charIdx, String(charIdx));
      saveStr(STORAGE.mapIdx, String(mapIdx));
      bigDr.textContent = r.total.toFixed(2) + "x";
      clearBtn.hidden = false;
      setStatus("✓ DR computed: " + r.total.toFixed(3) + "x · " + matched + "/" + countAll() + " sources matched", "ok");
      // New refs landed — push every formula parent's Max forward so
      // the agg chain stays consistent with the freshly-overridden
      // child reference values.
      recomputeAllFormulas();
      render();
    } catch (e) {
      setStatus("Compute failed: " + e.message, "err");
    }
  }

  function populateCharMap(save) {
    var DR = window.DRMax;
    var chars = DR.listCharacters(save);
    var maps = DR.buildMapOptions(save);
    charSelect.innerHTML = "";
    for (var i = 0; i < chars.length; i++) {
      var o = document.createElement("option");
      o.value = chars[i].charIndex;
      o.textContent = chars[i].charName + " (Lv " + chars[i].level + ")";
      charSelect.appendChild(o);
    }
    mapSelect.innerHTML = "";
    for (var j = 0; j < maps.length; j++) {
      var m = document.createElement("option");
      m.value = maps[j].index;
      m.textContent = maps[j].label || maps[j].name;
      mapSelect.appendChild(m);
    }
    var lastChar = parseInt(localStorage.getItem(STORAGE.charIdx) || "0", 10) || 0;
    var lastMap = parseInt(localStorage.getItem(STORAGE.mapIdx) || "0", 10) || 0;
    if (chars.find(function (c) { return c.charIndex === lastChar; })) charSelect.value = String(lastChar);
    if (maps.find(function (m) { return m.index === lastMap; })) mapSelect.value = String(lastMap);
    charMapRow.hidden = false;
    charSelect.onchange = function () {
      applyComputed(Number(charSelect.value), Number(mapSelect.value));
    };
    mapSelect.onchange = function () {
      applyComputed(Number(charSelect.value), Number(mapSelect.value));
    };
  }

  document.getElementById("load-save").onclick = function () {
    var text = pasteTa.value.trim();
    if (!text) {
      setStatus("Paste a save JSON first.", "err");
      return;
    }
    var DR = window.DRMax;
    if (!DR) {
      setStatus("Compute bundle missing — regenerate with build-dr-bundle.ts.", "err");
      return;
    }
    var parsed;
    try {
      parsed = DR.parseSave(text);
    } catch (e) {
      setStatus("Parse failed: " + e.message, "err");
      return;
    }
    saveCache = parsed;
    var chars;
    try { chars = DR.listCharacters(parsed); }
    catch (e) {
      setStatus("Char list failed: " + e.message, "err");
      return;
    }
    if (!chars || chars.length === 0) {
      setStatus("Save parsed but no characters found.", "err");
      return;
    }
    populateCharMap(parsed);
    var initChar = parseInt(localStorage.getItem(STORAGE.charIdx) || "0", 10) || 0;
    var initMap = parseInt(localStorage.getItem(STORAGE.mapIdx) || "0", 10) || 0;
    if (!chars.find(function (c) { return c.charIndex === initChar; })) initChar = chars[0].charIndex;
    applyComputed(initChar, initMap);
  };

  clearBtn.onclick = function () {
    refOverride = {};
    refMeta = null;
    saveCache = null;
    saveJson(STORAGE.refOverride, refOverride);
    saveJson(STORAGE.refMeta, null);
    bigDr.textContent = "";
    charMapRow.hidden = true;
    clearBtn.hidden = true;
    setStatus("");
    render();
  };

  // If we had a stored ref override and meta on load, show the clear button.
  if (refMeta) clearBtn.hidden = false;

  render();
})();
`;

// =============================================================
// Bottom of file — emit the HTML now that CSS / BODY / APP_JS are bound.
// =============================================================
const html = buildHtml(catalog, safeBundle);
writeFileSync(htmlPath, html);

console.log(`✓ Catalog:  ${catalogPath}  (${sources.length} top sources)`);
console.log(`✓ Tool:     ${htmlPath}  (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`✓ Ref save: ${catalog.refSave}  →  DR ${r.total.toFixed(3)}x`);
