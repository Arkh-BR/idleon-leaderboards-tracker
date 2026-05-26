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
};

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
      // Skip pure placeholder rows ("No active sources", "Available DR
      // Items (not equipped)") that exist for catalog UX but aren't real
      // source rows we'd track a max for.
      if (
        src.name === "No active sources" ||
        src.name === "Available DR Items (not equipped)"
      )
        continue;
      const id = nodePath(bucketPath, src, rows, si);
      const badge: "Additive" | "Multi" =
        bucket.fmt === "x" ? "Multi" : "Additive";
      sources.push({
        id,
        name: src.name,
        system: sys,
        world,
        pool: badge,
        fmt: (src.fmt as "+" | "x" | "raw") ?? "raw",
        refValue: Number(src.val) || 0,
        bucket: bucket.name,
      });
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
  td.input input[type="number"] {
    width: 100px; padding: 4px 6px; font-size: 12px; font-family: monospace;
    background: #09090b; border: 1px solid var(--border); border-radius: 3px;
    color: var(--ink); text-align: right;
  }
  td.input input[type="number"]:focus { outline: none; border-color: var(--accent); }
  td.input input.filled { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.04); }
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
    <span class="stats" id="stats"></span>
  </div>

  <div id="seed-banner" class="seed-banner" hidden></div>

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
   *  verified ∈ "" | "observed" | "researched" | "theorized" */
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

  let values = loadValues();
  let collapsedWorlds = loadCollapsedWorlds();
  let filterText = "";
  let filterMode = "all"; // "all" | "blank" | "filled"

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

  function passFilter(src) {
    const entry = values[src.id];
    const hasMax = entry && typeof entry.maxValue === "number";
    if (filterMode === "blank" && hasMax) return false;
    if (filterMode === "filled" && !hasMax) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      if (
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

  function render() {
    const content = document.getElementById("content");
    content.innerHTML = "";
    const byWorld = group();
    let visibleSources = 0;
    let filledSources = 0;
    let totalSources = 0;
    for (const src of catalog.sources) {
      totalSources++;
      if (values[src.id] && typeof values[src.id].maxValue === "number")
        filledSources++;
    }

    for (const world of catalog.worldOrder) {
      const buckets = byWorld.get(world);
      if (!buckets || buckets.size === 0) continue;
      // Filter at the source level to get a visible-count for this world
      let worldVisible = 0;
      let worldFilled = 0;
      let worldTotal = 0;
      for (const [, list] of buckets) {
        for (const src of list) {
          worldTotal++;
          if (values[src.id] && typeof values[src.id].maxValue === "number")
            worldFilled++;
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
            tbody.appendChild(renderRow(src));
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

  function renderRow(src) {
    const entry = values[src.id] || {};
    const hasMax = typeof entry.maxValue === "number";
    const tr = document.createElement("tr");
    tr.className = hasMax ? "has-max" : "no-data";

    const tdName = document.createElement("td");
    tdName.className = "name";
    tdName.textContent = src.name;
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

    const tdRef = document.createElement("td");
    tdRef.className = "ref";
    tdRef.textContent = formatRef(src.refValue, src.fmt);
    tr.appendChild(tdRef);

    const tdInput = document.createElement("td");
    tdInput.className = "input";
    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.step = "any";
    maxInput.placeholder = "—";
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
      tr.classList.toggle("has-max", typeof next.maxValue === "number");
      tr.classList.toggle("no-data", typeof next.maxValue !== "number");
      updateStats();
    };
    tdInput.appendChild(maxInput);
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
      '<option value="theorized">theorized</option>';
    sel.value = entry.verified || "";
    sel.onchange = () => {
      const next = { ...(values[src.id] || {}) };
      if (sel.value) next.verified = sel.value;
      else delete next.verified;
      if (Object.keys(next).length === 0) delete values[src.id];
      else values[src.id] = next;
      saveValues(values);
    };
    tdVer.appendChild(sel);
    tr.appendChild(tdVer);

    return tr;
  }

  function updateStats() {
    let filled = 0;
    for (const id in values) {
      if (typeof values[id].maxValue === "number") filled++;
    }
    let visible = 0;
    for (const src of catalog.sources) if (passFilter(src)) visible++;
    document.getElementById("stats").innerHTML =
      '<b>' + filled + '</b>/' + catalog.sources.length +
      ' filled · <b>' + visible + '</b> visible';
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
