"use client";

// ============================================================================
// DeepView — Full-depth, fully-expanded view of every DR source.
//
// Where CorganTree collapses past depth 2 to stay scannable, this view exposes
// EVERY layer of the DR formula: pool → source → sub-source → sub-sub-source
// (e.g. Main Additive Pool → Talent 279 → Bonus Levels → Family Bonus 68 →
// Best Mage Lv). Designed to answer "what _really_ adds to my DR, and what
// feeds those things?".
//
// Two layouts:
//   • Tree    — formula-first hierarchy (Pool → Source → Sub) fully expanded
//   • System  — flat grouping by game system (Talents, Stamps, Cards…)
//
// Controls:
//   • Search        text filter (matches any node name)
//   • Hide zero     drops nodes whose val is ~0 (and their dead subtrees)
//   • Collapse/All  override the default "everything open" state
//
// Every visible node is annotated with its formula `note` and (for leaves)
// the percentage weight inside its containing pool, so the user can see
// at-a-glance which sources are pulling the most weight.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CorganNode } from "@/lib/corgan/node";

// -----------------------------------------------------------------------------
// Persisted expand state — survives reloads so the user's drilling stays put.
//
// `overrides` keys are node paths (parent / name / name ...). The default is
// "open if depth < 2", so the user only sees rows in their map after they
// click. `globalForce` is set by the Expand all / Collapse all buttons and
// shifts the default for un-overridden paths; clicking a node clears that
// node's override-to-default-flip but leaves the global force alone.
// -----------------------------------------------------------------------------

const EXPAND_STORAGE_KEY = "drop-rate.deep-view.expand-state.v1";
const DEFAULT_OPEN_MAX_DEPTH = 2;

type ExpandState = {
  globalForce: "open" | "closed" | null;
  overrides: Record<string, boolean>;
};

const DEFAULT_EXPAND_STATE: ExpandState = {
  globalForce: null,
  overrides: {},
};

function loadExpandState(): ExpandState {
  if (typeof window === "undefined") return DEFAULT_EXPAND_STATE;
  try {
    const raw = window.localStorage.getItem(EXPAND_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPAND_STATE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.overrides) {
      return {
        globalForce:
          parsed.globalForce === "open" || parsed.globalForce === "closed"
            ? parsed.globalForce
            : null,
        overrides:
          typeof parsed.overrides === "object" && parsed.overrides !== null
            ? parsed.overrides
            : {},
      };
    }
    return DEFAULT_EXPAND_STATE;
  } catch {
    return DEFAULT_EXPAND_STATE;
  }
}

function saveExpandState(state: ExpandState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPAND_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or full — silently degrade to memory-only
  }
}

function joinPath(segments: string[]): string {
  return segments.join(" / ");
}

function isPathOpen(
  path: string,
  depth: number,
  state: ExpandState
): boolean {
  const override = state.overrides[path];
  if (override !== undefined) return override;
  if (state.globalForce === "open") return true;
  if (state.globalForce === "closed") return false;
  return depth < DEFAULT_OPEN_MAX_DEPTH;
}

// -----------------------------------------------------------------------------
// Formatting helpers — same conventions as CorganTree so values look familiar
// -----------------------------------------------------------------------------

function formatVal(val: number, fmt: string | undefined): string {
  if (!Number.isFinite(val)) return "—";
  if (fmt === "x") return val.toFixed(3) + "x";
  if (fmt === "+") return (val >= 0 ? "+" : "") + val.toFixed(3);
  if (fmt === "%") return val.toFixed(2) + "%";
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + "B";
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + "K";
  return val.toFixed(3);
}

/** Split a node label like "Crystal Custard (Companion 3)" into its friendly
 *  name and the trailing system+id tag so the renderer can style them
 *  differently — the name reads in normal text, the tag in muted grey.
 *  Returns { main, tag } where tag includes its parens (or null if absent).
 *
 *  Two tag shapes are accepted:
 *    1. "(System id)"      — e.g. "(Talent 279)", "(Stamp A38)"
 *    2. "(System Words)"   — e.g. "(Pristine Charm)" for sources whose
 *                            origin is descriptive rather than id-indexed.
 *  Both render the same way (muted grey), so the user reads the friendly
 *  name first and the category in soft text after. */
function splitEntityTag(name: string): { main: string; tag: string | null } {
  // Try id-bearing tag first ("(Talent 279)"); fall back to words-only
  // tag ("(Pristine Charm)").
  const idMatch = name.match(/^(.*?)\s*(\([A-Za-z][A-Za-z ]*?\s+[\w,\-]+\))\s*$/);
  if (idMatch) return { main: idMatch[1].trim(), tag: idMatch[2] };
  const wordsMatch = name.match(/^(.*?)\s+(\([A-Za-z][A-Za-z ]{2,}\))\s*$/);
  if (wordsMatch) return { main: wordsMatch[1].trim(), tag: wordsMatch[2] };
  return { main: name, tag: null };
}

function valColor(val: number, fmt: string | undefined): string {
  if (fmt === "+") {
    if (val > 0) return "text-emerald-300";
    if (val < 0) return "text-red-300";
    return "text-zinc-600";
  }
  if (fmt === "x") {
    if (val > 1.001) return "text-amber-300";
    if (val < 0.999) return "text-red-300";
    return "text-zinc-400";
  }
  return "text-zinc-200";
}

// -----------------------------------------------------------------------------
// Classification used to live here as a flat "By System" view. That layout
// was removed — the tree's buckets (built by lib/corgan/stats/categorize.ts)
// already group every source by its game system, so the parallel
// classifier was redundant and out-of-date relative to the descriptor
// renames. Search across the tree handles the "find a source quickly"
// use case the By System view originally targeted.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Tree introspection helpers
// -----------------------------------------------------------------------------

type TreeStats = {
  nodeCount: number;
  leafCount: number;
  nonZeroLeafCount: number;
  maxDepth: number;
  poolSums: Record<string, number>; // pool name → sum of its direct children vals
};

function computeStats(root: CorganNode | null): TreeStats {
  const s: TreeStats = {
    nodeCount: 0,
    leafCount: 0,
    nonZeroLeafCount: 0,
    maxDepth: 0,
    poolSums: {},
  };
  if (!root) return s;

  // Pools we care about pulling sums from for "% of pool" badges
  const POOL_NAMES = new Set([
    "Main Additive Pool",
    "LUK2 Additive Pool",
    "Post-Processing",
  ]);

  function walk(node: CorganNode, depth: number, parentPoolName: string | null) {
    s.nodeCount++;
    if (depth > s.maxDepth) s.maxDepth = depth;
    const kids = node.children || [];
    if (kids.length === 0) {
      s.leafCount++;
      if (Math.abs(node.val) > 1e-9) s.nonZeroLeafCount++;
    }
    const childPool = POOL_NAMES.has(node.name) ? node.name : parentPoolName;
    if (POOL_NAMES.has(node.name)) {
      const sum = kids.reduce((a, c) => a + (Number(c.val) || 0), 0);
      s.poolSums[node.name] = sum;
    }
    for (const c of kids) walk(c, depth + 1, childPool);
  }
  walk(root, 0, null);
  return s;
}

// Find a node's containing pool name by walking from the root. Used to compute
// "% of pool" for additive sources. Returns null if the node isn't under one
// of our recognized pools (e.g. LUK Scaling, Post-Processing leaves).
function findPoolForPath(
  root: CorganNode,
  targetPath: string[]
): string | null {
  const POOL_NAMES = new Set([
    "Main Additive Pool",
    "LUK2 Additive Pool",
    "Post-Processing",
  ]);
  let current: CorganNode | null = root;
  let pool: string | null = null;
  for (const seg of targetPath) {
    if (!current) return pool;
    if (POOL_NAMES.has(current.name)) pool = current.name;
    const next: CorganNode | undefined = (current.children || []).find(
      (c) => c.name === seg
    );
    if (!next) return pool;
    current = next;
  }
  if (current && POOL_NAMES.has(current.name)) pool = current.name;
  return pool;
}

// -----------------------------------------------------------------------------
// Tree rendering — full-depth, controlled by global expand-all state plus per-
// node override. We render the whole tree (no virtualization) since DR trees
// top out around ~250 nodes.
// -----------------------------------------------------------------------------

type TreeRowProps = {
  node: CorganNode;
  depth: number;
  parentPath: string[];
  expandState: ExpandState;
  onToggle: (path: string, nextOpen: boolean) => void;
  searchTerm: string;
  // Pre-computed visibility maps (built once per tree change in DeepView).
  // Lookup is O(1) so toggling hide-zero / typing in search doesn't trigger
  // an O(N²) re-walk inside every row's render. Either map being null means
  // "filter is off, everything passes". See computeFilterMaps() below.
  hideZeroMap: WeakMap<CorganNode, boolean> | null;
  searchMatchMap: WeakMap<CorganNode, boolean> | null;
  root: CorganNode;
  stats: TreeStats;
};

function TreeRow({
  node,
  depth,
  parentPath,
  expandState,
  onToggle,
  searchTerm,
  hideZeroMap,
  searchMatchMap,
  root,
  stats,
}: TreeRowProps) {
  // Filter checks come first so a hidden node short-circuits before doing
  // any work for the row that won't be drawn.
  if (hideZeroMap && hideZeroMap.get(node) === false) return null;
  if (searchMatchMap && searchMatchMap.get(node) === false) return null;

  const hasChildren = !!(node.children && node.children.length);
  // Path is the stable identity used as both the localStorage key and the
  // child-row pass-through. Must be derived before the `open` lookup.
  const pathSegments = [...parentPath, node.name];
  const path = joinPath(pathSegments);
  const open = isPathOpen(path, depth, expandState);
  const arrow = hasChildren ? (open ? "▾" : "▸") : "·";

  // Pool-weight badge — for leaves under one of the additive pools, compute
  // their % of the pool sum so the user sees "this source = 32% of LUK2 pool".
  let weightBadge: { label: string; tone: "weak" | "med" | "strong" } | null = null;
  if (!hasChildren && (node.fmt === "+" || node.fmt === "x")) {
    const pool = findPoolForPath(root, pathSegments);
    if (pool && stats.poolSums[pool]) {
      const sum = stats.poolSums[pool];
      if (sum !== 0) {
        const pct = (Number(node.val) / sum) * 100;
        const absPct = Math.abs(pct);
        if (absPct >= 0.1) {
          const tone: "weak" | "med" | "strong" =
            absPct >= 10 ? "strong" : absPct >= 3 ? "med" : "weak";
          weightBadge = {
            label: pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`,
            tone,
          };
        }
      }
    }
  }

  // Split into friendly name + system-tag suffix so we can mute the tag
  // visually (it's metadata for users who want to cross-reference, not the
  // primary label). Then apply search highlight on top.
  const nameSpan = useMemo(() => {
    const { main, tag } = splitEntityTag(node.name);
    function highlight(text: string) {
      if (!searchTerm) return text;
      const q = searchTerm.toLowerCase();
      const lower = text.toLowerCase();
      const idx = lower.indexOf(q);
      if (idx < 0) return text;
      return (
        <>
          {text.slice(0, idx)}
          <mark className="bg-amber-500/30 text-amber-200 rounded px-0.5">
            {text.slice(idx, idx + q.length)}
          </mark>
          {text.slice(idx + q.length)}
        </>
      );
    }
    if (!tag) return highlight(main);
    return (
      <>
        {highlight(main)}
        <span className="ml-1.5 text-zinc-500 font-normal text-[0.85em]">
          {tag}
        </span>
      </>
    );
  }, [node.name, searchTerm]);

  // Depth-based visual styling: top-level pools get heavier weight, deeper
  // nodes get progressively lighter so the eye can skim categories quickly.
  const isPoolHeader = depth === 1; // pools sit at depth 1 under root
  const isSubSource = depth >= 3; // sub-source breakdown (formula inputs)
  const isZero = Math.abs(Number(node.val) || 0) < 1e-9;

  return (
    <div>
      <div
        className={`group flex items-center gap-2 px-2 border-b border-white/5 transition-colors ${
          hasChildren ? "cursor-pointer hover:bg-sky-500/5" : ""
        } ${
          isPoolHeader
            ? "py-2 bg-zinc-900/40 font-semibold text-sm"
            : isSubSource
            ? "py-0.5 text-xs"
            : "py-1.5 text-sm"
        } ${isZero && !hasChildren ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 1.0}rem` }}
        onClick={() => hasChildren && onToggle(path, !open)}
        title={node.note}
      >
        <span
          className={`w-4 select-none flex-shrink-0 ${
            hasChildren ? "text-zinc-400 group-hover:text-sky-400" : "text-zinc-700"
          }`}
        >
          {arrow}
        </span>
        <span
          className={`flex-1 min-w-0 ${
            isPoolHeader ? "text-zinc-100" : isSubSource ? "text-zinc-400" : "text-zinc-200"
          }`}
        >
          <span className="truncate inline-block max-w-full align-middle">
            {nameSpan}
          </span>
          {node.note && (
            <span className="ml-2 text-[10px] text-zinc-500 italic font-normal">
              {node.note}
            </span>
          )}
        </span>
        {weightBadge && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              weightBadge.tone === "strong"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : weightBadge.tone === "med"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "bg-zinc-800 text-zinc-500 border border-zinc-700"
            }`}
            title="Share of containing pool"
          >
            {weightBadge.label}
          </span>
        )}
        <span
          className={`font-mono tabular-nums text-right w-24 ${valColor(
            node.val,
            node.fmt
          )}`}
        >
          {formatVal(node.val, node.fmt)}
        </span>
      </div>
      {open && hasChildren && (
        <div className="bg-black/20 border-l-2 border-white/5">
          {node.children!.map((c, i) => (
            <TreeRow
              key={`${depth}-${i}-${c.name}`}
              node={c}
              depth={depth + 1}
              parentPath={pathSegments}
              expandState={expandState}
              onToggle={onToggle}
              searchTerm={searchTerm}
              hideZeroMap={hideZeroMap}
              searchMatchMap={searchMatchMap}
              root={root}
              stats={stats}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Filter maps — pre-walked ONCE per filter-state change so hide-zero and
// search filtering are O(1) per row instead of O(subtree) per row.
//
// The hide-zero map: WeakMap<node, true|false>. `true` means "keep this node"
// (either it has a non-zero val directly, or some descendant does). The pool
// containers always pass because their val is the pool sum.
//
// The search map: `true` if this node's name/note matches OR any descendant
// does. Containers pass through so the user can drill into a matching leaf.
// -----------------------------------------------------------------------------

function buildHideZeroMap(root: CorganNode): WeakMap<CorganNode, boolean> {
  const map = new WeakMap<CorganNode, boolean>();
  function walk(n: CorganNode): boolean {
    const directNonZero = Math.abs(Number(n.val) || 0) > 1e-9;
    let any = directNonZero;
    const kids = n.children || [];
    for (const c of kids) {
      // Walk every child regardless so the map covers the whole tree, but OR
      // the result into `any` so containers light up if any descendant does.
      if (walk(c)) any = true;
    }
    map.set(n, any);
    return any;
  }
  walk(root);
  return map;
}

function buildSearchMatchMap(
  root: CorganNode,
  searchTerm: string
): WeakMap<CorganNode, boolean> {
  const map = new WeakMap<CorganNode, boolean>();
  const q = searchTerm.toLowerCase();
  function matchesSelf(n: CorganNode): boolean {
    if (n.name.toLowerCase().includes(q)) return true;
    if (n.note && n.note.toLowerCase().includes(q)) return true;
    return false;
  }
  function walk(n: CorganNode): boolean {
    let any = matchesSelf(n);
    for (const c of n.children || []) {
      if (walk(c)) any = true;
    }
    map.set(n, any);
    return any;
  }
  walk(root);
  return map;
}


// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function DeepView({ tree }: { tree: CorganNode | null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hideZero, setHideZero] = useState(false);

  // Persisted expand state: defaults to "depth < 2 open" until the user has
  // clicked something. Loaded from localStorage on mount so toggles survive
  // refreshes. We hydrate from a default in SSR/initial-render to avoid a
  // mismatch, then sync from storage in an effect.
  const [expandState, setExpandState] = useState<ExpandState>(
    DEFAULT_EXPAND_STATE
  );
  useEffect(() => {
    setExpandState(loadExpandState());
  }, []);

  const toggleNode = useCallback((path: string, nextOpen: boolean) => {
    setExpandState((prev) => {
      const next: ExpandState = {
        globalForce: prev.globalForce,
        overrides: { ...prev.overrides, [path]: nextOpen },
      };
      saveExpandState(next);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const next: ExpandState = { globalForce: "open", overrides: {} };
    setExpandState(next);
    saveExpandState(next);
  }, []);

  const collapseAll = useCallback(() => {
    const next: ExpandState = { globalForce: "closed", overrides: {} };
    setExpandState(next);
    saveExpandState(next);
  }, []);

  const resetExpandState = useCallback(() => {
    const next: ExpandState = { globalForce: null, overrides: {} };
    setExpandState(next);
    saveExpandState(next);
  }, []);

  const stats = useMemo(() => computeStats(tree), [tree]);

  // Pre-compute filter visibility maps. Each is null when the corresponding
  // filter is off — TreeRow short-circuits in that case.
  const hideZeroMap = useMemo(() => {
    if (!hideZero || !tree) return null;
    return buildHideZeroMap(tree);
  }, [hideZero, tree]);
  const searchMatchMap = useMemo(() => {
    if (!searchTerm || !tree) return null;
    return buildSearchMatchMap(tree, searchTerm);
  }, [searchTerm, tree]);

  if (!tree) {
    return (
      <p className="text-sm text-zinc-500 italic">
        Load a save above to populate the deep view.
      </p>
    );
  }

  return (
    <div className="font-sans">
      {/* Controls bar — single row. Search goes first (it's the most-used
          control and benefits from a flex-grow input), followed by the
          expand-state buttons and the Hide-inactive toggle. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-900/60">
        {/* Search — flex-grow so it claims most of the bar width. */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Search source name or note…"
          className="flex-1 min-w-[200px] px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500/60"
        />

        {/* Expand / Collapse / Reset. */}
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            title="Open every node"
          >
            ↓ Expand
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            title="Close every node"
          >
            ↑ Collapse
          </button>
          <button
            type="button"
            onClick={resetExpandState}
            className="px-2 py-1 text-xs rounded border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title="Reset to default: depth < 2 open, everything else closed"
          >
            ↺ Reset
          </button>
        </div>

        {/* Hide-inactive toggle — some leaves carry val=0 but still feel
            "active" (e.g. catalog rows). "Inactive" reads more naturally
            than "Hide zero". */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="accent-sky-500"
          />
          Hide inactive
        </label>
      </div>

      {/* Tree content */}
      <div className="rounded border border-zinc-800 bg-zinc-950/40">
        <TreeRow
          node={tree}
          depth={0}
          parentPath={[]}
          expandState={expandState}
          onToggle={toggleNode}
          searchTerm={searchTerm}
          hideZeroMap={hideZeroMap}
          searchMatchMap={searchMatchMap}
          root={tree}
          stats={stats}
        />
      </div>
    </div>
  );
}
