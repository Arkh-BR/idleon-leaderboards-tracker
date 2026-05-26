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

import { useMemo, useState } from "react";
import type { CorganNode } from "@/lib/corgan/node";

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
// Classification — map a node name back to a game system bucket. Used by the
// "By System" view. We rely on name prefixes because the descriptor's source
// specs aren't propagated all the way down to the rendered tree.
// -----------------------------------------------------------------------------

type SystemKey =
  | "Talents"
  | "Stamps"
  | "Alchemy"
  | "Sigils"
  | "Prayers"
  | "Shrines"
  | "Arcade"
  | "Voting"
  | "Cards"
  | "Guild"
  | "Star Signs"
  | "Post Office"
  | "ETC Bonus"
  | "Shiny Pets"
  | "Companions"
  | "Win Bonus"
  | "Tomes"
  | "Grids/Lab"
  | "Chips"
  | "Dreams"
  | "Cloud Bonus"
  | "Golden Food"
  | "Achievements"
  | "Owl"
  | "Grimoire"
  | "Vault"
  | "Farming"
  | "Holes"
  | "Emperor"
  | "Set Bonus"
  | "Friends"
  | "Legends"
  | "Spelunk Shop"
  | "Bundles"
  | "OLA"
  | "Arcane Map"
  | "Sushi"
  | "Minehead"
  | "Pristine Charm"
  | "Glimbo"
  | "Workshop"
  | "Event Shop"
  | "LUK / Stats"
  | "Button"
  | "Other";

const SYSTEM_RULES: Array<{ key: SystemKey; match: RegExp }> = [
  { key: "Talents", match: /^Talent\b/i },
  { key: "Stamps", match: /^Stamp\b/i },
  { key: "Sigils", match: /^Sigil\b/i },
  { key: "Alchemy", match: /^(Bubble|Vial|Alchemy|DROPPIN|Cauldron|Atom)\b/i },
  { key: "Prayers", match: /^Prayer\b/i },
  { key: "Shrines", match: /^Shrine\b/i },
  { key: "Arcade", match: /^Arcade\b/i },
  { key: "Voting", match: /^Voting\b/i },
  { key: "Cards", match: /^(Card|CardSet|CardSingle)\b/i },
  { key: "Guild", match: /^Guild\b/i },
  { key: "Star Signs", match: /^(Star ?Sign|Seraph)\b/i },
  { key: "Post Office", match: /^(Post ?Office|PO )\b/i },
  { key: "ETC Bonus", match: /^(ETC|EtcBonus|Etc)\b/i },
  { key: "Shiny Pets", match: /^Shiny\b/i },
  { key: "Companions", match: /^(Companion|CompMulti)\b/i },
  { key: "Win Bonus", match: /^Win ?Bonus\b/i },
  { key: "Tomes", match: /^Tome\b/i },
  { key: "Grids/Lab", match: /^(Grid|Lab)\b/i },
  { key: "Chips", match: /^Chip\b/i },
  { key: "Dreams", match: /^Dream\b/i },
  { key: "Cloud Bonus", match: /^(Cloud|CloudBonus)\b/i },
  { key: "Golden Food", match: /^(Golden Food|GFood|GoldenFood)\b/i },
  { key: "Achievements", match: /^Achievement\b/i },
  { key: "Owl", match: /^Owl\b/i },
  { key: "Grimoire", match: /^Grimoire\b/i },
  { key: "Vault", match: /^Vault\b/i },
  { key: "Farming", match: /^(Farm|Crop|Exotic|Rank ?9)\b/i },
  { key: "Holes", match: /^(Hole|Upg ?\d|Meas|Monument)\b/i },
  { key: "Emperor", match: /^Emperor\b/i },
  { key: "Set Bonus", match: /^(Set Bonus|Efaunt|Kattlekruk Set|SECRET_SET)\b/i },
  { key: "Friends", match: /^Friend\b/i },
  { key: "Legends", match: /^Legend\b/i },
  { key: "Spelunk Shop", match: /^Spelunk\b/i },
  { key: "Bundles", match: /^(Bundle|Bun_)\b/i },
  { key: "OLA", match: /^(OLA|Sneaking)\b/i },
  { key: "Arcane Map", match: /^(Arcane|ArcaneMap)\b/i },
  { key: "Sushi", match: /^(Sushi|SushiRoG)\b/i },
  { key: "Minehead", match: /^Minehead\b/i },
  { key: "Pristine Charm", match: /^Pristine\b/i },
  { key: "Glimbo", match: /^Glimbo\b/i },
  { key: "Workshop", match: /^Workshop\b/i },
  { key: "Event Shop", match: /^(Event ?Shop|EventShop)\b/i },
  { key: "LUK / Stats", match: /^(LUK|Total LUK|Sub-1000|Over-1000)\b/i },
  { key: "Button", match: /^Button\b/i },
];

function classifyNode(name: string): SystemKey {
  for (const rule of SYSTEM_RULES) {
    if (rule.match.test(name)) return rule.key;
  }
  return "Other";
}

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
  globalOpen: boolean;
  searchTerm: string;
  hideZero: boolean;
  root: CorganNode;
  stats: TreeStats;
  expandToken: number; // bumping this forces a re-mount → resets local open
};

function TreeRow({
  node,
  depth,
  parentPath,
  globalOpen,
  searchTerm,
  hideZero,
  root,
  stats,
  expandToken,
}: TreeRowProps) {
  // Local override of the global open/closed state. Reset whenever expand-all
  // is toggled (via the expandToken key) so the user can still drill in/out.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  void expandToken;
  const hasChildren = !!(node.children && node.children.length);
  const open = openOverride !== null ? openOverride : globalOpen;
  const arrow = hasChildren ? (open ? "▾" : "▸") : "·";

  // Hide-zero: drop the node entirely if val is ~0 AND no descendant is
  // non-zero. We need to check descendants because pool containers have
  // val=sum which can be huge while individual zero leaves are inside.
  // Skipping the recursive walk when hideZero is off is critical for perf —
  // otherwise every TreeRow walks its whole subtree on each render, which
  // becomes O(N²) over the full ~700-node tree and freezes the page when
  // the user expands everything.
  const hasNonZeroDescendant = useMemo(() => {
    if (!hideZero) return true;
    if (Math.abs(node.val) > 1e-9) return true;
    if (!hasChildren) return false;
    function walk(n: CorganNode): boolean {
      if (Math.abs(n.val) > 1e-9) return true;
      for (const c of n.children || []) if (walk(c)) return true;
      return false;
    }
    return (node.children || []).some(walk);
  }, [node, hasChildren, hideZero]);
  if (hideZero && !hasNonZeroDescendant) return null;

  // Search filter — only filter on LEAVES; containers stay if any descendant
  // matches. Empty search disables filtering entirely.
  const matchesSearch = useMemo(() => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    function walk(n: CorganNode): boolean {
      if (n.name.toLowerCase().includes(q)) return true;
      if (n.note && n.note.toLowerCase().includes(q)) return true;
      for (const c of n.children || []) if (walk(c)) return true;
      return false;
    }
    return walk(node);
  }, [node, searchTerm]);
  if (!matchesSearch) return null;

  // Pool-weight badge — for leaves under one of the additive pools, compute
  // their % of the pool sum so the user sees "this source = 32% of LUK2 pool".
  const path = [...parentPath, node.name];
  let weightBadge: { label: string; tone: "weak" | "med" | "strong" } | null = null;
  if (!hasChildren && (node.fmt === "+" || node.fmt === "x")) {
    const pool = findPoolForPath(root, path);
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

  // Search highlighting on the node label itself
  const nameSpan = useMemo(() => {
    if (!searchTerm) return node.name;
    const q = searchTerm.toLowerCase();
    const lower = node.name.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return node.name;
    return (
      <>
        {node.name.slice(0, idx)}
        <mark className="bg-amber-500/30 text-amber-200 rounded px-0.5">
          {node.name.slice(idx, idx + q.length)}
        </mark>
        {node.name.slice(idx + q.length)}
      </>
    );
  }, [node.name, searchTerm]);

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1 border-b border-white/5 text-sm ${
          hasChildren ? "cursor-pointer hover:bg-white/5" : ""
        }`}
        style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        onClick={() => hasChildren && setOpenOverride(!open)}
        title={node.note}
      >
        <span className="w-4 text-zinc-500 select-none flex-shrink-0">
          {arrow}
        </span>
        <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-zinc-200">
          {nameSpan}
          {node.note && (
            <span className="ml-2 text-[10px] text-zinc-500 italic">
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
              key={`${depth}-${i}-${c.name}-${expandToken}`}
              node={c}
              depth={depth + 1}
              parentPath={path}
              globalOpen={globalOpen}
              searchTerm={searchTerm}
              hideZero={hideZero}
              root={root}
              stats={stats}
              expandToken={expandToken}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// "By System" rendering — flatten all leaves, bucket by classifyNode(), render
// each bucket as a collapsible group with each source as a row showing value,
// path (where it lives in the formula tree), and any sub-detail children.
// -----------------------------------------------------------------------------

type LeafEntry = {
  node: CorganNode;
  path: string[]; // full path from root, excluding root itself
};

function collectLeaves(root: CorganNode): LeafEntry[] {
  // We pick "interesting" levels: any node directly under one of the pools.
  // Going deeper would duplicate source breakdown (e.g. base level, bonus
  // levels) outside its natural context — those belong in Tree view.
  const POOL_NAMES = new Set([
    "Main Additive Pool",
    "LUK2 Additive Pool",
    "Post-Processing",
    "Chip Cap-Break",
    "LUK Scaling",
  ]);
  const out: LeafEntry[] = [];
  function walk(n: CorganNode, path: string[]) {
    const here = [...path, n.name];
    const kids = n.children || [];
    // If this node's parent is a pool, treat THIS as the "source" entry and
    // stop recursing — its children are sub-computations belonging to it.
    const parentIsPool = path.length > 0 && POOL_NAMES.has(path[path.length - 1]);
    if (parentIsPool) {
      out.push({ node: n, path: here });
      return;
    }
    for (const c of kids) walk(c, here);
  }
  walk(root, []);
  return out;
}

function SystemView({
  root,
  searchTerm,
  hideZero,
}: {
  root: CorganNode;
  searchTerm: string;
  hideZero: boolean;
}) {
  const leaves = useMemo(() => collectLeaves(root), [root]);
  const grouped = useMemo(() => {
    const map = new Map<SystemKey, LeafEntry[]>();
    for (const l of leaves) {
      const key = classifyNode(l.node.name);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    // Sort entries inside each group by absolute val desc (biggest first)
    for (const [, arr] of map) {
      arr.sort((a, b) => Math.abs(b.node.val) - Math.abs(a.node.val));
    }
    return map;
  }, [leaves]);

  const orderedKeys = useMemo(() => {
    // Sort groups by total absolute val desc so heaviest hitters are on top
    const totals = new Map<SystemKey, number>();
    for (const [k, arr] of grouped) {
      const t = arr.reduce((a, e) => a + Math.abs(e.node.val), 0);
      totals.set(k, t);
    }
    return Array.from(grouped.keys()).sort(
      (a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0)
    );
  }, [grouped]);

  const q = searchTerm.toLowerCase();
  let visibleCount = 0;
  const rendered = orderedKeys.map((key) => {
    const entries = grouped.get(key) ?? [];
    const visibleEntries = entries.filter((e) => {
      if (hideZero && Math.abs(e.node.val) < 1e-9) return false;
      if (searchTerm) {
        const matchesName =
          e.node.name.toLowerCase().includes(q) ||
          (e.node.note ?? "").toLowerCase().includes(q) ||
          key.toLowerCase().includes(q);
        if (!matchesName) return false;
      }
      return true;
    });
    if (visibleEntries.length === 0) return null;
    visibleCount += visibleEntries.length;
    // Group total: sum for all-additive groups, product for all-multiplicative,
    // null when mixed (showing it would be misleading).
    const fmts = new Set(visibleEntries.map((e) => e.node.fmt));
    let groupTotal: number | null = null;
    let groupFmt: string | undefined;
    if (fmts.size === 1) {
      const fmt = visibleEntries[0].node.fmt;
      if (fmt === "+") {
        groupTotal = visibleEntries.reduce(
          (a, e) => a + (Number(e.node.val) || 0),
          0
        );
        groupFmt = "+";
      } else if (fmt === "x") {
        groupTotal = visibleEntries.reduce(
          (a, e) => a * (Number(e.node.val) || 1),
          1
        );
        groupFmt = "x";
      }
    }
    return (
      <SystemGroup
        key={key}
        title={key}
        entries={visibleEntries}
        total={groupTotal}
        totalFmt={groupFmt}
      />
    );
  });

  if (visibleCount === 0) {
    return (
      <p className="text-sm text-zinc-500 italic px-2 py-4">
        No sources match the current filter.
      </p>
    );
  }
  return <div className="flex flex-col gap-3">{rendered}</div>;
}

function SystemGroup({
  title,
  entries,
  total,
  totalFmt,
}: {
  title: SystemKey;
  entries: LeafEntry[];
  total: number | null;
  totalFmt: string | undefined;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
      >
        <span className="w-4 text-zinc-500">{open ? "▾" : "▸"}</span>
        <span className="font-semibold text-sky-300 text-sm flex-1">
          {title}
          <span className="ml-2 text-[10px] text-zinc-500 font-normal">
            {entries.length} source{entries.length === 1 ? "" : "s"}
          </span>
        </span>
        {total !== null ? (
          <span
            className={`font-mono tabular-nums text-sm ${valColor(total, totalFmt)}`}
          >
            {formatVal(total, totalFmt)}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-600 italic">mixed fmt</span>
        )}
      </button>
      {open && (
        <div className="border-t border-zinc-800">
          {entries.map((e, i) => (
            <SystemRow key={`${title}-${i}-${e.node.name}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function SystemRow({ entry }: { entry: LeafEntry }) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!(entry.node.children && entry.node.children.length);
  // Path label: strip root + immediate pool, keep mid context
  // e.g. ["Drop Rate","Main Additive Pool","Talent 279","Bonus Levels"]
  //   → "Main Additive Pool"
  const poolName = entry.path.length >= 2 ? entry.path[entry.path.length - 2] : "";
  return (
    <div className="border-b border-zinc-800/50 last:border-b-0">
      <div
        className={`flex items-center gap-2 px-4 py-1.5 text-sm ${
          hasChildren ? "cursor-pointer hover:bg-white/5" : ""
        }`}
        onClick={() => hasChildren && setOpen((v) => !v)}
        title={entry.node.note}
      >
        <span className="w-3 text-zinc-600 select-none flex-shrink-0">
          {hasChildren ? (open ? "▾" : "▸") : ""}
        </span>
        <span className="flex-1 text-zinc-200 truncate">
          {entry.node.name}
          {entry.node.note && (
            <span className="ml-2 text-[10px] text-zinc-500 italic">
              {entry.node.note}
            </span>
          )}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap">
          {poolName}
        </span>
        <span
          className={`font-mono tabular-nums w-24 text-right ${valColor(
            entry.node.val,
            entry.node.fmt
          )}`}
        >
          {formatVal(entry.node.val, entry.node.fmt)}
        </span>
      </div>
      {open && hasChildren && (
        <div className="pl-8 pr-3 pb-2 bg-black/30 border-t border-zinc-800/50">
          <DeepChildren nodes={entry.node.children!} depth={0} />
        </div>
      )}
    </div>
  );
}

// Render sub-children fully expanded (depth-unlimited) for SystemRow drill-in
function DeepChildren({
  nodes,
  depth,
}: {
  nodes: CorganNode[];
  depth: number;
}) {
  return (
    <div>
      {nodes.map((c, i) => (
        <div
          key={`${depth}-${i}-${c.name}`}
          style={{ paddingLeft: `${depth * 0.75}rem` }}
        >
          <div
            className="flex items-center gap-2 py-0.5 text-xs"
            title={c.note}
          >
            <span className="w-3 text-zinc-700">•</span>
            <span className="flex-1 text-zinc-400 truncate">
              {c.name}
              {c.note && (
                <span className="ml-1 text-[10px] text-zinc-600 italic">
                  {c.note}
                </span>
              )}
            </span>
            <span
              className={`font-mono tabular-nums text-xs ${valColor(
                c.val,
                c.fmt
              )}`}
            >
              {formatVal(c.val, c.fmt)}
            </span>
          </div>
          {c.children && c.children.length > 0 && (
            <DeepChildren nodes={c.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function DeepView({ tree }: { tree: CorganNode | null }) {
  const [layout, setLayout] = useState<"tree" | "system">("tree");
  const [searchTerm, setSearchTerm] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(true);
  const [expandToken, setExpandToken] = useState(0);

  const stats = useMemo(() => computeStats(tree), [tree]);

  if (!tree) {
    return (
      <p className="text-sm text-zinc-500 italic">
        Load a save above to populate the deep view.
      </p>
    );
  }

  return (
    <div className="font-sans">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded border border-zinc-800 bg-zinc-950/60">
        {/* Layout toggle */}
        <div
          role="tablist"
          className="inline-flex gap-1 p-0.5 rounded bg-zinc-950 border border-zinc-800"
        >
          <button
            type="button"
            onClick={() => setLayout("tree")}
            className={`px-2 py-1 text-xs rounded ${
              layout === "tree"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Hierarchical view — pool → source → sub-source"
          >
            🌳 Tree
          </button>
          <button
            type="button"
            onClick={() => setLayout("system")}
            className={`px-2 py-1 text-xs rounded ${
              layout === "system"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Flat grouping by game system (Talents, Stamps, Cards…)"
          >
            📚 By System
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Search source name or note…"
          className="flex-1 min-w-[180px] px-2 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
        />

        {/* Hide-zero toggle */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="accent-sky-500"
          />
          Hide zero
        </label>

        {/* Expand/collapse all — only meaningful in tree layout */}
        {layout === "tree" && (
          <div className="inline-flex gap-1">
            <button
              type="button"
              onClick={() => {
                setGlobalOpen(true);
                setExpandToken((v) => v + 1);
              }}
              className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              title="Open every node"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => {
                setGlobalOpen(false);
                setExpandToken((v) => v + 1);
              }}
              className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              title="Close every node"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {/* Summary stats line */}
      <div className="text-[11px] text-zinc-500 mb-3 px-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-zinc-300">{stats.nodeCount}</span> total nodes
        </span>
        <span>
          <span className="text-zinc-300">{stats.leafCount}</span> leaf sources
        </span>
        <span>
          <span className="text-emerald-400">{stats.nonZeroLeafCount}</span>{" "}
          non-zero
        </span>
        <span>
          max depth <span className="text-zinc-300">{stats.maxDepth}</span>
        </span>
        <span className="text-zinc-600 italic">
          Every source down to its formula inputs, including sub-source layers.
        </span>
      </div>

      {/* Content */}
      {layout === "tree" ? (
        <div className="rounded border border-zinc-800 bg-zinc-950/40">
          <TreeRow
            node={tree}
            depth={0}
            parentPath={[]}
            globalOpen={globalOpen}
            searchTerm={searchTerm}
            hideZero={hideZero}
            root={tree}
            stats={stats}
            expandToken={expandToken}
          />
        </div>
      ) : (
        <SystemView root={tree} searchTerm={searchTerm} hideZero={hideZero} />
      )}
    </div>
  );
}
