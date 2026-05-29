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

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CorganNode } from "@/lib/corgan/node";
import {
  parseSystemFromBucketName,
  systemWorld,
  WORLD_ORDER,
  WORLD_EMOJI,
  type SystemKey,
  type WorldKey,
} from "@/lib/corgan/stats/categorize";
import { nodePath, type FlatTree } from "@/lib/dropRate/treeFlatten";

// Compare baseline plumbed from the SnapshotSection — when set, every row
// in both layouts gets a "Δ vs snap" badge showing current − captured.
type Baseline = {
  flatTree: FlatTree;
  capturedAt: number;
  charName: string;
} | null;

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
const SHOW_NOTES_STORAGE_KEY = "drop-rate.deep-view.show-notes.v1";
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
  state: ExpandState,
  node?: CorganNode
): boolean {
  const override = state.overrides[path];
  if (override !== undefined) return override;
  if (state.globalForce === "open") return true;
  if (state.globalForce === "closed") return false;
  // Nodes marked defaultClosed override the depth heuristic — start closed
  // (categorize-bucket pattern) until the user clicks.
  if (node?.defaultClosed) return false;
  return depth < DEFAULT_OPEN_MAX_DEPTH;
}

// -----------------------------------------------------------------------------
// Formatting helpers — same conventions as CorganTree so values look familiar
// -----------------------------------------------------------------------------

// Idleon-style suffixed number — M/B/T/Q/QQ/QQQ, then scientific past 1e24
// (where toFixed itself starts emitting exponent strings, which produced the
// "3.7e+34B" garbage when only B existed and bigger numbers got divided by 1e9).
function suffixed(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e24) return val.toExponential(2);
  if (abs >= 1e21) return (val / 1e21).toFixed(2) + "QQQ";
  if (abs >= 1e18) return (val / 1e18).toFixed(2) + "QQ";
  if (abs >= 1e15) return (val / 1e15).toFixed(2) + "Q";
  if (abs >= 1e12) return (val / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (val / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (val / 1e3).toFixed(2) + "K";
  return val.toFixed(3);
}

/** Drop trailing zeros (and a bare trailing dot) from a fixed string. */
function trimZeros(s: string): string {
  return s.indexOf(".") >= 0 ? s.replace(/\.?0+$/, "") : s;
}

function formatVal(val: number, fmt: string | undefined): string {
  if (!Number.isFinite(val)) return "—";
  // Multipliers compound into the final DR, so show real precision (6 dp,
  // trimmed) for normal-range multis instead of rounding 1.26974 → 1.270.
  // Big multis (>=1000) don't need decimals; past 1e21 use exponential.
  if (fmt === "x") {
    const a = Math.abs(val);
    if (a >= 1e21) return val.toExponential(2) + "x";
    return trimZeros(val.toFixed(a < 1000 ? 6 : 3)) + "x";
  }
  // Additive fmts keep their unit; fall back to exponential past 1e21.
  if (fmt === "+")
    return (
      (val >= 0 ? "+" : "") +
      (Math.abs(val) >= 1e21 ? val.toExponential(2) : val.toFixed(3))
    );
  if (fmt === "%") return val.toFixed(2) + "%";
  return suffixed(val);
}

/** Look up a path's reference value in the baseline flatTree. Returns null
 *  if no baseline is selected or the path didn't exist in it (a source the
 *  reference doesn't have). */
function lookupRef(
  baseline: FlatTree | null | undefined,
  path: string
): number | null {
  if (!baseline) return null;
  const v = baseline[path];
  return typeof v === "number" ? v : null;
}

/** Small inline badge that renders the REFERENCE value (the baseline /
 *  hypothetical-max value for this source) next to the row's own value.
 *  Color codes the comparison: green when the user is at/above the
 *  reference, red when below, zinc when equal. Returns null when there's no
 *  baseline or the path is missing — so callers can drop it into any row
 *  without a guard. */
function RefBadge({
  reference,
  current,
  fmt,
}: {
  reference: number | null;
  current: number;
  fmt: string | undefined;
}) {
  if (reference === null) return null;
  const diff = current - reference;
  const eq = Math.abs(diff) < 1e-9;
  const tone = eq
    ? "text-zinc-500 border-zinc-700 bg-zinc-800/40"
    : diff > 0
      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
      : "text-red-300 border-red-500/40 bg-red-500/10";
  return (
    <span
      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${tone}`}
      title={`Reference (hypothetical max) for this source — you have ${formatVal(
        current,
        fmt
      )}`}
    >
      🎯 {formatVal(reference, fmt)}
    </span>
  );
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
  /** Parent path as a single " / "-joined string in the same scheme
   *  treeFlatten.nodePath() uses (dup-named siblings get "#i" suffix).
   *  Empty string at the root. */
  parentPathStr: string;
  /** This node's sibling array (the parent's children) and its index in
   *  that array, so we can dedupe same-named siblings with "#i" — matches
   *  the path scheme used by snapshot flatTree storage. */
  siblings: CorganNode[];
  siblingIndex: number;
  /** Same as parentPathStr but kept as an array for findPoolForPath() which
   *  walks segments. The array form lets us tolerate "Foo / Bar" labels
   *  that happen to contain " / " literally. */
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
  /** Snapshot flatTree for Δ lookups. null = no baseline selected. */
  baseline: FlatTree | null;
};

function TreeRow({
  node,
  depth,
  parentPathStr,
  siblings,
  siblingIndex,
  parentPath,
  expandState,
  onToggle,
  searchTerm,
  hideZeroMap,
  searchMatchMap,
  root,
  stats,
  baseline,
}: TreeRowProps) {
  // Filter checks come first so a hidden node short-circuits before doing
  // any work for the row that won't be drawn.
  if (hideZeroMap && hideZeroMap.get(node) === false) return null;
  if (searchMatchMap && searchMatchMap.get(node) === false) return null;

  const hasChildren = !!(node.children && node.children.length);
  // Path computed the same way treeFlatten.nodePath does so a snapshot
  // saved before this render will line up exactly. Used both as the
  // localStorage expand-state key and as the baseline lookup key.
  const path = nodePath(parentPathStr, node, siblings, siblingIndex);
  // Keep an array form for findPoolForPath() which walks segments.
  const pathSegments = [...parentPath, node.name];
  const open = isPathOpen(path, depth, expandState, node);
  const arrow = hasChildren ? (open ? "▾" : "▸") : "·";
  const ref = lookupRef(baseline, path);

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
            <span className="dr-node-note ml-2 text-[10px] text-zinc-500 italic font-normal">
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
        <RefBadge
          reference={ref}
          current={Number(node.val) || 0}
          fmt={node.fmt}
        />
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
              parentPathStr={path}
              siblings={node.children!}
              siblingIndex={i}
              parentPath={pathSegments}
              expandState={expandState}
              onToggle={onToggle}
              searchTerm={searchTerm}
              hideZeroMap={hideZeroMap}
              searchMatchMap={searchMatchMap}
              baseline={baseline}
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

// "tree" / "world" are the built-in layouts; any other string is the id of
// a caller-supplied extra tab (see DeepViewExtraTab).
type ViewMode = string;

/** A caller-injected tab that renders its own content. Used by
 *  /talents-level to add the "Faltando p/ Max" account scan in place of
 *  the (irrelevant-for-a-single-talent) Per World layout. */
export type DeepViewExtraTab = {
  /** Unique id — becomes the active `view` value when selected. Avoid
   *  "tree" / "world" which are reserved for the built-ins. */
  id: string;
  /** Tab button label (may include an emoji). */
  label: string;
  /** Optional tooltip for the tab button. */
  title?: string;
  /** Renders the tab's body. Called only while this tab is active. */
  render: () => ReactNode;
};

export default function DeepView({
  tree,
  baseline,
  showWorldView = true,
  extraTabs = [],
}: {
  tree: CorganNode | null;
  /** Optional snapshot baseline. When set, every row gains a "Δ vs snap"
   *  badge showing current − captured. Lookup is keyed by the same
   *  nodePath() scheme treeFlatten uses to serialize the snapshot. */
  baseline?: Baseline;
  /** Show the built-in 🌍 Per World tab. Default true (Drop Rate). The
   *  Talents Level page passes false because grouping a single talent's
   *  tree by world is meaningless there. */
  showWorldView?: boolean;
  /** Extra caller-supplied tabs appended after the built-ins. */
  extraTabs?: DeepViewExtraTab[];
}) {
  const [view, setView] = useState<ViewMode>("tree");
  // The active extra tab (if `view` points at one). Built-in layouts win.
  const activeExtra =
    view !== "tree" && view !== "world"
      ? extraTabs.find((t) => t.id === view) ?? null
      : null;
  const [searchTerm, setSearchTerm] = useState("");
  const [hideZero, setHideZero] = useState(false);
  // Show-notes hydrates from localStorage in a useEffect (below) to avoid
  // SSR/initial-render hydration mismatches. Notes are hidden by default
  // (showNotes=false); the user opts in to the formula annotations.
  const [showNotes, setShowNotes] = useState(false);
  const baselineFlat = baseline?.flatTree ?? null;

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

  // Hydrate show-notes from localStorage post-mount. We keep persistence in a
  // tiny try/catch wrapper rather than going through a helper since the value
  // is a single boolean.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(SHOW_NOTES_STORAGE_KEY) === "1") {
        setShowNotes(true);
      }
    } catch {
      // localStorage unavailable — keep default.
    }
  }, []);
  const toggleShowNotes = useCallback((next: boolean) => {
    setShowNotes(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SHOW_NOTES_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
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
    <div className="font-sans" data-hide-notes={!showNotes ? "1" : undefined}>
      {/* View tabs — sit where the "Deep View" title used to be. Built-in
          layouts: 🌳 Tree (formula hierarchy) and 🌍 Per World (sources
          grouped by world). `showWorldView` hides Per World, and
          `extraTabs` appends caller-supplied tabs (e.g. /talents-level's
          "Faltando p/ Max" account scan). */}
      <div className="mb-3 flex items-center gap-1 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setView("tree")}
          className={`px-3 py-1.5 text-sm font-medium rounded-t -mb-px border ${
            view === "tree"
              ? "bg-sky-500/15 text-sky-300 border-sky-500/40 border-b-transparent"
              : "text-zinc-400 hover:text-zinc-200 border-transparent"
          }`}
          title="Formula hierarchy — pool → source → sub-source"
        >
          🌳 Tree
        </button>
        {showWorldView && (
          <button
            type="button"
            onClick={() => setView("world")}
            className={`px-3 py-1.5 text-sm font-medium rounded-t -mb-px border ${
              view === "world"
                ? "bg-sky-500/15 text-sky-300 border-sky-500/40 border-b-transparent"
                : "text-zinc-400 hover:text-zinc-200 border-transparent"
            }`}
            title="Sources grouped by world (Global / Character / W1 … W7)"
          >
            🌍 Per World
          </button>
        )}
        {extraTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t -mb-px border ${
              view === t.id
                ? "bg-sky-500/15 text-sky-300 border-sky-500/40 border-b-transparent"
                : "text-zinc-400 hover:text-zinc-200 border-transparent"
            }`}
            title={t.title}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls bar — single row. Search goes first (it's the most-used
          control and benefits from a flex-grow input), followed by the
          expand-state buttons (tree-only) and the Hide-inactive toggle.
          Hidden for extra tabs, which render their own (if any) controls. */}
      {!activeExtra && (
      <div className="mb-3 flex flex-wrap items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-900/60">
        {/* Search — flex-grow so it claims most of the bar width. */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Search source name or note…"
          className="flex-1 min-w-[200px] px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500/60"
        />

        {/* Expand / Collapse / Reset — works in both views. In Tree it
            mutates the path-based expand state; in Per World it broadcasts
            to every WorldSection so all of them flip together. Reset in
            Per World restores the default (all open). */}
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={() => {
              if (view === "tree") expandAll();
              else broadcastWorldAll("open");
            }}
            className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            title={view === "tree" ? "Open every node" : "Expand every world section"}
          >
            ↓ Expand
          </button>
          <button
            type="button"
            onClick={() => {
              if (view === "tree") collapseAll();
              else broadcastWorldAll("closed");
            }}
            className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            title={view === "tree" ? "Close every node" : "Collapse every world section"}
          >
            ↑ Collapse
          </button>
          <button
            type="button"
            onClick={() => {
              if (view === "tree") resetExpandState();
              // Per World default: every section open.
              else broadcastWorldAll("open");
            }}
            className="px-2 py-1 text-xs rounded border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title={
              view === "tree"
                ? "Reset to default: depth < 2 open, everything else closed"
                : "Reset to default: every world section open"
            }
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

        {/* Show-notes toggle — reveals every italic formula-note span
            (the muted "{source} · {idx}" annotations next to source names).
            Off by default. CSS-driven via data-hide-notes on the outer
            wrapper so the tree doesn't re-render when toggled. */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={showNotes}
            onChange={(e) => toggleShowNotes(e.target.checked)}
            className="accent-sky-500"
          />
          Show notes
        </label>
      </div>
      )}

      {/* View content. The world view doesn't need the expand-state machinery
          — its rows track their own open/closed state locally. */}
      {/* If a snapshot baseline is selected, surface a small banner so the
          user knows which snapshot is currently driving the Δ badges. */}
      {!activeExtra && baseline && (
        // Single-line banner — left side states the active comparison,
        // right side gives a hint that truncates with ellipsis on narrow
        // viewports (full text stays accessible via the title tooltip).
        <div className="mb-3 px-3 py-2 rounded-md border border-sky-500/30 bg-sky-500/5 flex items-center gap-3 text-xs overflow-hidden">
          <span className="text-sky-200 whitespace-nowrap flex-shrink-0">
            Comparing against{" "}
            <span className="font-semibold">{baseline.charName}</span>{" "}
            snapshot from{" "}
            <span className="font-mono">
              {new Date(baseline.capturedAt).toLocaleString()}
            </span>
          </span>
          <span
            className="text-zinc-500 italic truncate min-w-0 ml-auto"
            title="Pick another snapshot to switch — toggle off in Snapshot History"
          >
            Pick another snapshot to switch — toggle off in Snapshot History
          </span>
        </div>
      )}

      {activeExtra ? (
        activeExtra.render()
      ) : view === "world" ? (
        <PerWorldView
          tree={tree}
          searchTerm={searchTerm}
          hideZero={hideZero}
          baseline={baselineFlat}
        />
      ) : (
      <div className="rounded border border-zinc-800 bg-zinc-950/40">
        <TreeRow
          node={tree}
          depth={0}
          parentPathStr=""
          siblings={[tree]}
          siblingIndex={0}
          parentPath={[]}
          expandState={expandState}
          onToggle={toggleNode}
          searchTerm={searchTerm}
          hideZeroMap={hideZeroMap}
          searchMatchMap={searchMatchMap}
          root={tree}
          stats={stats}
          baseline={baselineFlat}
        />
      </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Per World view — flatten the tree's category buckets (depth-2 children of
// Additive Pool and Post-Processing) into groups by WorldKey. Each row
// displays a single bucket; expanding it reveals the same source rows the
// Tree view shows. A bucket can appear in BOTH pools (e.g. Talents adds
// 58 to the additive sum AND multiplies by 1.27x via Talent 328) — when
// that happens we show both rows with a pool badge so the user can see
// each contribution separately.
// -----------------------------------------------------------------------------

type WorldBucket = {
  /** Display key for React + sort tiebreak. Includes both the SystemKey
   *  and the pool name so two buckets with the same system but different
   *  pools each get a unique key. */
  id: string;
  system: SystemKey;
  poolBadge: "Additive" | "Multi";
  node: CorganNode;
  /** Canonical path under the root tree — same scheme treeFlatten uses
   *  so we can look up snapshot values for the Δ badge. */
  path: string;
};

function collectWorldBuckets(root: CorganNode): WorldBucket[] {
  const out: WorldBucket[] = [];
  // The categorize-pass emits bucket nodes as direct children of these
  // two parents. Anything else (LUK Scaling, Total Sum, Chip Cap-Break,
  // Post-Processing's "Sneaking Mastery" prefix bucket, etc.) we also
  // walk — the Post-Processing prefix buckets (Bundles, Talents,
  // Sneaking Mastery) are direct categorize-style children too and
  // belong in the per-world view.
  const rootSiblings = [root];
  const rootPath = nodePath("", root, rootSiblings, 0); // "Drop Rate"
  const parentChildren = root.children || [];
  for (let pi = 0; pi < parentChildren.length; pi++) {
    const child = parentChildren[pi];
    const childPath = nodePath(rootPath, child, parentChildren, pi);
    if (child.name === "Additive Pool" || child.name === "Post-Processing") {
      const buckets = child.children || [];
      for (let bi = 0; bi < buckets.length; bi++) {
        const bucket = buckets[bi];
        const sys = parseSystemFromBucketName(bucket.name);
        if (!sys) continue;
        const bucketPath = nodePath(childPath, bucket, buckets, bi);
        // Badge is driven by the BUCKET's own fmt, not by which parent
        // pool it sits under. Death Bringer Bundle (+2) and Sneaking
        // Mastery (+0.3) both live in Post-Processing for formula-order
        // reasons but they're additive ops — fmt:"+" so they get the
        // Additive badge.
        const badge: "Additive" | "Multi" =
          bucket.fmt === "x" ? "Multi" : "Additive";
        out.push({
          id: `${badge}::${sys}::${bucketPath}::${out.length}`,
          system: sys,
          poolBadge: badge,
          node: bucket,
          path: bucketPath,
        });
      }
    }
  }
  return out;
}

function bucketMatchesSearch(bucket: WorldBucket, term: string): boolean {
  if (!term) return true;
  const q = term.toLowerCase();
  if (bucket.system.toLowerCase().includes(q)) return true;
  if (bucket.node.name.toLowerCase().includes(q)) return true;
  // Look one level deep so searching "archlord" finds Talents → Archlord.
  for (const c of bucket.node.children || []) {
    if (c.name.toLowerCase().includes(q)) return true;
    if ((c.note ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

function PerWorldView({
  tree,
  searchTerm,
  hideZero,
  baseline,
}: {
  tree: CorganNode;
  searchTerm: string;
  hideZero: boolean;
  baseline: FlatTree | null;
}) {
  const buckets = useMemo(() => collectWorldBuckets(tree), [tree]);

  // Group by WorldKey, applying search + hide-inactive filters.
  const byWorld = useMemo(() => {
    const map = new Map<WorldKey, WorldBucket[]>();
    for (const b of buckets) {
      if (hideZero && Math.abs(Number(b.node.val) || 0) < 1e-9) continue;
      if (!bucketMatchesSearch(b, searchTerm)) continue;
      const world = systemWorld(b.system);
      if (!map.has(world)) map.set(world, []);
      map.get(world)!.push(b);
    }
    return map;
  }, [buckets, hideZero, searchTerm]);

  const totalVisible = Array.from(byWorld.values()).reduce(
    (a, arr) => a + arr.length,
    0
  );

  if (totalVisible === 0) {
    return (
      <p className="text-sm text-zinc-500 italic px-2 py-4">
        No buckets match the current filter.
      </p>
    );
  }

  const visibleWorlds = WORLD_ORDER.filter((w) => byWorld.has(w));

  return (
    <div className="flex flex-col gap-3">
      {visibleWorlds.map((world) => (
        <WorldSection
          key={world}
          world={world}
          buckets={byWorld.get(world)!}
          baseline={baseline}
        />
      ))}
    </div>
  );
}

// Shared event channel for the world-section expand/collapse buttons. Each
// section subscribes; firing a value here flips every section. Cheap pub/sub
// keeps the components decoupled from the main toolbar (which lives in
// DeepView) and avoids prop-drilling a "force-state" enum down through
// every section.
type WorldAllSignal = { kind: "open" | "closed"; ts: number };
const worldAllListeners = new Set<(s: WorldAllSignal) => void>();
function broadcastWorldAll(kind: "open" | "closed") {
  const sig: WorldAllSignal = { kind, ts: Date.now() };
  for (const fn of worldAllListeners) fn(sig);
}

function WorldSection({
  world,
  buckets,
  baseline,
}: {
  world: WorldKey;
  buckets: WorldBucket[];
  baseline: FlatTree | null;
}) {
  const [open, setOpen] = useState(true);
  // Listen for the broadcast from WorldSectionControls so "Expand all" /
  // "Collapse all" flip every section at once.
  useEffect(() => {
    const listener = (s: WorldAllSignal) => setOpen(s.kind === "open");
    worldAllListeners.add(listener);
    return () => {
      worldAllListeners.delete(listener);
    };
  }, []);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2.5 text-base font-semibold text-sky-300 flex items-center gap-2.5 hover:bg-white/5 rounded-t-lg ${
          open ? "border-b border-zinc-800" : ""
        }`}
        title={open ? "Collapse this world" : "Expand this world"}
      >
        <span className="w-3 text-zinc-500 select-none text-sm">
          {open ? "▾" : "▸"}
        </span>
        <span aria-hidden="true" className="text-lg">
          {WORLD_EMOJI[world]}
        </span>
        <span>{world}</span>
        <span className="ml-auto text-[11px] text-zinc-500 font-normal">
          {buckets.length} bucket{buckets.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div>
          {buckets.map((b) => (
            <WorldBucketRow key={b.id} bucket={b} baseline={baseline} />
          ))}
        </div>
      )}
    </section>
  );
}

function WorldBucketRow({
  bucket,
  baseline,
}: {
  bucket: WorldBucket;
  baseline: FlatTree | null;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!(bucket.node.children && bucket.node.children.length);
  const badgeClass =
    bucket.poolBadge === "Additive"
      ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
      : "bg-amber-500/10 text-amber-300 border-amber-500/30";
  const isZero = Math.abs(Number(bucket.node.val) || 0) < 1e-9;
  const ref = lookupRef(baseline, bucket.path);
  return (
    <div className="border-b border-zinc-800/60 last:border-b-0">
      <div
        className={`flex items-center gap-2 px-3 py-2 text-sm ${
          hasChildren ? "cursor-pointer hover:bg-white/5" : ""
        } ${isZero ? "opacity-50" : ""}`}
        onClick={() => hasChildren && setOpen((v) => !v)}
        title={bucket.node.note}
      >
        <span className="w-3 text-zinc-600 select-none flex-shrink-0">
          {hasChildren ? (open ? "▾" : "▸") : "•"}
        </span>
        <span className="flex-1 text-zinc-200 truncate font-medium">
          {bucket.node.name}
        </span>
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${badgeClass}`}
          title={
            bucket.poolBadge === "Additive"
              ? 'Adds to the additive pool (the "/100" sum)'
              : "Multiplies the post-processing chain"
          }
        >
          {bucket.poolBadge}
        </span>
        <RefBadge
          reference={ref}
          current={Number(bucket.node.val) || 0}
          fmt={bucket.node.fmt}
        />
        <span
          className={`font-mono tabular-nums w-24 text-right ${valColor(
            bucket.node.val,
            bucket.node.fmt
          )}`}
        >
          {formatVal(bucket.node.val, bucket.node.fmt)}
        </span>
      </div>
      {open && hasChildren && (
        <div className="bg-black/20 border-t border-zinc-800/60 px-3 py-2">
          <WorldBucketChildren
            nodes={bucket.node.children!}
            depth={0}
            parentPathStr={bucket.path}
            baseline={baseline}
          />
        </div>
      )}
    </div>
  );
}

function WorldBucketChildren({
  nodes,
  depth,
  parentPathStr,
  baseline,
}: {
  nodes: CorganNode[];
  depth: number;
  parentPathStr: string;
  baseline: FlatTree | null;
}) {
  return (
    <div>
      {nodes.map((c, i) => (
        <WorldBucketChildRow
          key={`${depth}-${i}-${c.name}`}
          node={c}
          depth={depth}
          siblings={nodes}
          siblingIndex={i}
          parentPathStr={parentPathStr}
          baseline={baseline}
        />
      ))}
    </div>
  );
}

function WorldBucketChildRow({
  node,
  depth,
  siblings,
  siblingIndex,
  parentPathStr,
  baseline,
}: {
  node: CorganNode;
  depth: number;
  siblings: CorganNode[];
  siblingIndex: number;
  parentPathStr: string;
  baseline: FlatTree | null;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!(node.children && node.children.length);
  const path = nodePath(parentPathStr, node, siblings, siblingIndex);
  const ref = lookupRef(baseline, path);
  return (
    <div style={{ paddingLeft: `${depth * 0.75}rem` }}>
      <div
        className={`flex items-center gap-2 py-0.5 text-xs ${
          hasChildren ? "cursor-pointer hover:bg-white/5 rounded" : ""
        }`}
        onClick={() => hasChildren && setOpen((v) => !v)}
        title={node.note}
      >
        <span className="w-3 text-zinc-700 select-none">
          {hasChildren ? (open ? "▾" : "▸") : "•"}
        </span>
        <span className="flex-1 text-zinc-300 truncate">
          {node.name}
          {node.note && (
            <span className="dr-node-note ml-1.5 text-zinc-600 italic text-[10px]">
              {node.note}
            </span>
          )}
        </span>
        <RefBadge
          reference={ref}
          current={Number(node.val) || 0}
          fmt={node.fmt}
        />
        <span
          className={`font-mono tabular-nums text-xs ${valColor(
            node.val,
            node.fmt
          )}`}
        >
          {formatVal(node.val, node.fmt)}
        </span>
      </div>
      {open && hasChildren && (
        <WorldBucketChildren
          nodes={node.children!}
          depth={depth + 1}
          parentPathStr={path}
          baseline={baseline}
        />
      )}
    </div>
  );
}
