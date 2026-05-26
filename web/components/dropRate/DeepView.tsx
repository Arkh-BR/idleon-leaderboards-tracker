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
 *  Returns { main, tag } where tag includes its parens (or null if absent). */
function splitEntityTag(name: string): { main: string; tag: string | null } {
  const m = name.match(/^(.*?)\s*(\([A-Za-z][A-Za-z ]*?\s+[\w,\-]+\))\s*$/);
  if (!m) return { main: name, tag: null };
  return { main: m[1].trim(), tag: m[2] };
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
// Classification — bucket each tree node into a game-system SystemKey.
//
// Since entity-names started wrapping each source in "<Friendly Name>
// (<System> <id>)", the in-name system tag is now the most reliable signal
// for classification. The classifier:
//   1. Extracts the parenthesized "(System id)" tag at the end of the name
//      and matches it against TAG_TO_SYSTEM.
//   2. Falls back to a prefix/anywhere regex set (SYSTEM_RULES) for sources
//      that didn't get an entity-name tag (e.g. wrappers like "Star Signs",
//      "Farming rank9", "Cavern upg46").
//   3. Never falls through to "Other" — every leaf currently in the DR tree
//      maps somewhere. If a new pool source ever lands without a rule, it'll
//      still classify as "Other" so it shows up clearly.
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

// Map the inner system tag (lowercased, e.g. "talent" / "post office" /
// "stamp") to its SystemKey. This is the primary classification path: every
// entity-name-tagged label like "Robbing Hood (Talent 279)" matches via
// extractSystemTag below.
const TAG_TO_SYSTEM: Record<string, SystemKey> = {
  talent: "Talents",
  stamp: "Stamps",
  card: "Cards",
  cardset: "Cards",
  cardsingle: "Cards",
  prayer: "Prayers",
  shrine: "Shrines",
  arcade: "Arcade",
  achievement: "Achievements",
  "star sign": "Star Signs",
  "post office": "Post Office",
  vial: "Alchemy",
  bubble: "Alchemy",
  sigil: "Sigils",
  companion: "Companions",
  compmulti: "Companions",
  friend: "Friends",
  shiny: "Shiny Pets",
  tome: "Tomes",
  grid: "Grids/Lab",
  lab: "Grids/Lab",
  chip: "Chips",
  dream: "Dreams",
  "cloud bonus": "Cloud Bonus",
  cloudbonus: "Cloud Bonus",
  owl: "Owl",
  grimoire: "Grimoire",
  vault: "Vault",
  farm: "Farming",
  hole: "Holes",
  emperor: "Emperor",
  set: "Set Bonus",
  "set bonus": "Set Bonus",
  legend: "Legends",
  legendpts: "Legends",
  spelunk: "Spelunk Shop",
  spelunkshop: "Spelunk Shop",
  bundle: "Bundles",
  ola: "OLA",
  sneaking: "OLA",
  "arcane map": "Arcane Map",
  arcanemap: "Arcane Map",
  arcane: "Arcane Map",
  sushi: "Sushi",
  sushirog: "Sushi",
  minehead: "Minehead",
  pristine: "Pristine Charm",
  glimbo: "Glimbo",
  workshop: "Workshop",
  "event shop": "Event Shop",
  eventshop: "Event Shop",
  button: "Button",
  goldenfood: "Golden Food",
  "golden food": "Golden Food",
  gfood: "Golden Food",
  etcbonus: "ETC Bonus",
  etc: "ETC Bonus",
  voting: "Voting",
  guild: "Guild",
  "win bonus": "Win Bonus",
  winbonus: "Win Bonus",
  "win ": "Win Bonus", // tag form "(win 9)" used by summoning win bonus
  breeding: "Shiny Pets", // tag form "(breeding shiny 0)"
  summoning: "Win Bonus",
  meas: "Holes", // tag form "(hole:meas15)" wraps via hole prefix actually
};

// Pull out the "(System Tag)" suffix label() appends. Returns the lowercased
// tag minus the numeric id, e.g. "Robbing Hood (Talent 279)" → "talent".
// Returns null when there's no trailing tag (e.g. wrappers / sub-sources).
function extractSystemTag(name: string): string | null {
  // Match "(<words>+ <id-or-key>)" at end, case-insensitive. The id portion
  // can be alphanumeric (e.g. "A38", "mini5a") plus brackets/commas.
  const m = name.match(/\(([A-Za-z ]+?)\s+[\w,\-]+\)\s*$/);
  if (!m) return null;
  return m[1].toLowerCase().trim();
}

// Higher-level grouping shown as a sub-header in the By System layout. Each
// SystemKey rolls up under a Category, and visually we sort by Category first
// (so all character-progression sources cluster together, separate from
// world-specific bonuses, multipliers, etc.).
type Category =
  | "Character"
  | "Worlds"
  | "Boosts & Sets"
  | "Multipliers";

// Fallback rules for sources without entity-name tags (wrappers, world-
// abstracted entries like "Farming rank9" / "Cavern upg46" / "RoG Bonus 48").
// Order matters: more-specific rules first. Each matches against the FULL
// node name (not just prefix) via `match.test()`.
const SYSTEM_RULES: Array<{
  key: SystemKey;
  match: RegExp;
  icon: string;
  category: Category;
}> = [
  // Character
  { key: "LUK / Stats", match: /^(LUK|Total LUK|Sub-1000|Over-1000)\b/i, icon: "🍀", category: "Character" },
  { key: "Talents", match: /^Talent\b/i, icon: "📚", category: "Character" },
  { key: "Star Signs", match: /^(Star ?Signs?|Seraph)\b/i, icon: "✨", category: "Character" },
  { key: "Cards", match: /^(Card|CardSet|CardSingle)\b/i, icon: "🃏", category: "Character" },
  { key: "Achievements", match: /^Achievement\b/i, icon: "🏅", category: "Character" },
  { key: "Companions", match: /^(Companion|CompMulti)\b/i, icon: "🐾", category: "Character" },
  { key: "Friends", match: /^Friend\b/i, icon: "🤝", category: "Character" },

  // World systems
  { key: "Stamps", match: /^Stamp\b/i, icon: "📜", category: "Worlds" },
  { key: "Alchemy", match: /^(Bubble|Vial|Alchemy|DROPPIN|Cauldron|Atom)\b/i, icon: "⚗️", category: "Worlds" },
  { key: "Post Office", match: /^(Post ?Office|PO )\b/i, icon: "📮", category: "Worlds" },
  { key: "Arcade", match: /^Arcade\b/i, icon: "🎮", category: "Worlds" },
  { key: "Voting", match: /^Voting\b/i, icon: "🗳️", category: "Worlds" },
  { key: "Sigils", match: /^Sigil\b/i, icon: "🔮", category: "Worlds" },
  { key: "Prayers", match: /^Prayer\b/i, icon: "🙏", category: "Worlds" },
  { key: "Shrines", match: /^Shrine\b/i, icon: "⛩️", category: "Worlds" },
  { key: "Guild", match: /^Guild\b/i, icon: "🛡️", category: "Worlds" },
  // Shiny Pets — the breeding wrapper labels DR contributions as "Breeding N".
  { key: "Shiny Pets", match: /^(Shiny|Breeding)\b/i, icon: "🐉", category: "Worlds" },
  { key: "Tomes", match: /^Tome\b/i, icon: "📖", category: "Worlds" },
  { key: "Grids/Lab", match: /^(Grid|Lab)\b/i, icon: "🔬", category: "Worlds" },
  { key: "Chips", match: /^Chip\b/i, icon: "💎", category: "Worlds" },
  { key: "Dreams", match: /^Dream\b/i, icon: "💭", category: "Worlds" },
  { key: "Cloud Bonus", match: /^(Cloud|CloudBonus)\b/i, icon: "☁️", category: "Worlds" },
  // Owl — both "Owl 4" and the "Summoning Owl" wrapper land here.
  { key: "Owl", match: /^(Owl|Summoning Owl)\b/i, icon: "🦉", category: "Worlds" },
  { key: "Grimoire", match: /^Grimoire\b/i, icon: "📕", category: "Worlds" },
  { key: "Vault", match: /^Vault\b/i, icon: "🏦", category: "Worlds" },
  // Farming wrapper labels are "Farming rank9", "Farming cropSC7" etc.
  { key: "Farming", match: /^(Farm|Farming|Crop|Exotic|Rank ?9)\b/i, icon: "🌾", category: "Worlds" },
  // Holes — caverns / measurements / monuments / generic upgrades all live
  // under the Holes system (W5 Caverns of the Divine).
  { key: "Holes", match: /^(Hole|Cavern|Measurement|Meas|Monument|Upg ?\d)\b/i, icon: "🕳️", category: "Worlds" },
  { key: "Emperor", match: /^Emperor\b/i, icon: "👑", category: "Worlds" },
  { key: "Legends", match: /^Legend\b/i, icon: "⚔️", category: "Worlds" },
  { key: "Spelunk Shop", match: /^(Spelunk|Spelunking)\b/i, icon: "🪨", category: "Worlds" },
  // Sushi — the sushi RoG (Ring of Gold) bonuses are labelled "RoG Bonus N".
  { key: "Sushi", match: /^(Sushi|SushiRoG|RoG)\b/i, icon: "🍣", category: "Worlds" },
  { key: "Minehead", match: /^Minehead\b/i, icon: "⛏️", category: "Worlds" },
  { key: "Button", match: /^Button\b/i, icon: "🔘", category: "Worlds" },

  // Boosts & Sets
  { key: "Golden Food", match: /^(Golden Food|GFood|GoldenFood)\b/i, icon: "🍔", category: "Boosts & Sets" },
  // ETC Bonus — wrapper names like "EtcBonuses(2)" have no space before the
  // paren, so match without requiring a word boundary after "Etc".
  { key: "ETC Bonus", match: /^(ETC|EtcBonus|EtcBonuses|Etc)/i, icon: "🎁", category: "Boosts & Sets" },
  // Set Bonus — the equipment-set wrapper labels are "Smithing efaunt",
  // "Smithing KATTLEKRUK_SET", etc.
  { key: "Set Bonus", match: /^(Set Bonus|Smithing|Efaunt|Kattlekruk Set|SECRET_SET)\b/i, icon: "🎽", category: "Boosts & Sets" },
  { key: "Bundles", match: /^(Bundle|Bun_)\b/i, icon: "📦", category: "Boosts & Sets" },
  { key: "Pristine Charm", match: /^Pristine\b/i, icon: "🌟", category: "Boosts & Sets" },
  { key: "OLA", match: /^(OLA|Sneaking)\b/i, icon: "🥷", category: "Boosts & Sets" },
  { key: "Event Shop", match: /^(Event ?Shop|EventShop)\b/i, icon: "🛍️", category: "Boosts & Sets" },
  // Win Bonus — both literal "Win Bonus" labels and the "Summoning N" wrapper
  // (summoning win-bonus contributions) belong here.
  { key: "Win Bonus", match: /^(Win ?Bonus|Summoning)\b/i, icon: "🏆", category: "Boosts & Sets" },

  // Multipliers (post-processing chain)
  { key: "Glimbo", match: /^Glimbo\b/i, icon: "🎲", category: "Multipliers" },
  { key: "Workshop", match: /^Workshop\b/i, icon: "🛠️", category: "Multipliers" },
  { key: "Arcane Map", match: /^(Arcane|ArcaneMap)\b/i, icon: "🗺️", category: "Multipliers" },
];

/** Classify a node into a SystemKey via:
 *    1. The "(System id)" entity-name tag if present (most reliable).
 *    2. The prefix/anywhere SYSTEM_RULES regexes (for wrapper-style labels).
 *  Returns "Other" only when both miss — the smoke test verifies this never
 *  happens for any leaf in the current descriptor. */
function classifyNode(name: string): SystemKey {
  const tag = extractSystemTag(name);
  if (tag) {
    const sys = TAG_TO_SYSTEM[tag];
    if (sys) return sys;
    // Special-case the multi-word tag prefixes — "(post office N)" has tag
    // "post office" with a space, already handled. Try just the first word.
    const firstWord = tag.split(/\s+/)[0];
    if (TAG_TO_SYSTEM[firstWord]) return TAG_TO_SYSTEM[firstWord];
  }
  for (const rule of SYSTEM_RULES) {
    if (rule.match.test(name)) return rule.key;
  }
  return "Other";
}

function systemMeta(key: SystemKey): { icon: string; category: Category } {
  for (const rule of SYSTEM_RULES) {
    if (rule.key === key) return { icon: rule.icon, category: rule.category };
  }
  return { icon: "•", category: "Multipliers" };
}

const CATEGORY_ORDER: Category[] = [
  "Character",
  "Worlds",
  "Boosts & Sets",
  "Multipliers",
];

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

  // Group leaves by SystemKey; entries within each system sorted by absolute
  // val descending so the heaviest hitters appear first.
  const grouped = useMemo(() => {
    const map = new Map<SystemKey, LeafEntry[]>();
    for (const l of leaves) {
      const key = classifyNode(l.node.name);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => Math.abs(b.node.val) - Math.abs(a.node.val));
    }
    return map;
  }, [leaves]);

  // Within each category, order systems by total absolute val descending —
  // so "Talents" surfaces before "Friends" in Character, etc.
  const orderedByCategory = useMemo(() => {
    const totals = new Map<SystemKey, number>();
    for (const [k, arr] of grouped) {
      totals.set(k, arr.reduce((a, e) => a + Math.abs(e.node.val), 0));
    }
    const byCategory = new Map<Category, SystemKey[]>();
    for (const k of grouped.keys()) {
      const cat = systemMeta(k).category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(k);
    }
    for (const [, arr] of byCategory) {
      arr.sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
    }
    return byCategory;
  }, [grouped]);

  const q = searchTerm.toLowerCase();

  // Compute the visible-entry set per system once (search + hide-zero), then
  // render category-by-category.
  type VisibleSystem = {
    key: SystemKey;
    entries: LeafEntry[];
    total: number;
    activeCount: number;
    totalCount: number;
    groupTotal: number | null;
    groupFmt: string | undefined;
  };
  const visibleByCategory = new Map<Category, VisibleSystem[]>();
  let visibleCount = 0;
  for (const cat of CATEGORY_ORDER) {
    const keys = orderedByCategory.get(cat) ?? [];
    for (const key of keys) {
      const entries = grouped.get(key) ?? [];
      const filteredEntries = entries.filter((e) => {
        if (hideZero && Math.abs(e.node.val) < 1e-9) return false;
        if (searchTerm) {
          const matches =
            e.node.name.toLowerCase().includes(q) ||
            (e.node.note ?? "").toLowerCase().includes(q) ||
            key.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      });
      if (filteredEntries.length === 0) continue;
      visibleCount += filteredEntries.length;

      // Active count: entries with non-zero val within the unfiltered group
      const activeCount = entries.filter(
        (e) => Math.abs(Number(e.node.val) || 0) > 1e-9
      ).length;

      // Group total: sum for all-additive, product for all-multiplicative, or
      // null when entries mix formats (showing a single total is misleading).
      const fmts = new Set(filteredEntries.map((e) => e.node.fmt));
      let groupTotal: number | null = null;
      let groupFmt: string | undefined;
      if (fmts.size === 1) {
        const fmt = filteredEntries[0].node.fmt;
        if (fmt === "+") {
          groupTotal = filteredEntries.reduce(
            (a, e) => a + (Number(e.node.val) || 0),
            0
          );
          groupFmt = "+";
        } else if (fmt === "x") {
          groupTotal = filteredEntries.reduce(
            (a, e) => a * (Number(e.node.val) || 1),
            1
          );
          groupFmt = "x";
        }
      }
      const totalAbs = filteredEntries.reduce(
        (a, e) => a + Math.abs(e.node.val),
        0
      );
      if (!visibleByCategory.has(cat)) visibleByCategory.set(cat, []);
      visibleByCategory.get(cat)!.push({
        key,
        entries: filteredEntries,
        total: totalAbs,
        activeCount,
        totalCount: entries.length,
        groupTotal,
        groupFmt,
      });
    }
  }

  if (visibleCount === 0) {
    return (
      <p className="text-sm text-zinc-500 italic px-2 py-4">
        No sources match the current filter.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {CATEGORY_ORDER.filter((c) => visibleByCategory.has(c)).map((cat) => (
        <section key={cat} aria-label={cat}>
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2 px-1 font-semibold">
            {cat}
          </h3>
          <div className="flex flex-col gap-2">
            {visibleByCategory.get(cat)!.map((sys) => (
              <SystemGroup
                key={sys.key}
                title={sys.key}
                entries={sys.entries}
                total={sys.groupTotal}
                totalFmt={sys.groupFmt}
                activeCount={sys.activeCount}
                totalCount={sys.totalCount}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SystemGroup({
  title,
  entries,
  total,
  totalFmt,
  activeCount,
  totalCount,
}: {
  title: SystemKey;
  entries: LeafEntry[];
  total: number | null;
  totalFmt: string | undefined;
  /** Sources with val !== 0 BEFORE the hide-zero filter is applied. Lets us
   *  show "12 / 18 active" so users see what fraction of the system they've
   *  actually unlocked vs is available. */
  activeCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(true);
  const meta = systemMeta(title);
  const hasActivity = activeCount > 0;
  return (
    <div
      className={`rounded-lg border bg-zinc-950/40 transition-colors ${
        hasActivity
          ? "border-zinc-800 hover:border-zinc-700"
          : "border-zinc-900 opacity-70"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 rounded-t-lg"
      >
        <span className="w-4 text-zinc-500 flex-shrink-0">{open ? "▾" : "▸"}</span>
        <span className="text-lg flex-shrink-0" aria-hidden="true">
          {meta.icon}
        </span>
        <span className="font-semibold text-sky-300 text-sm flex-1 truncate">
          {title}
          <span className="ml-2 text-[10px] text-zinc-500 font-normal">
            <span className={hasActivity ? "text-emerald-400" : "text-zinc-600"}>
              {activeCount}
            </span>
            <span className="text-zinc-700"> / </span>
            <span>{totalCount}</span>{" "}
            <span className="text-zinc-600">active</span>
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
  const isZero = Math.abs(Number(entry.node.val) || 0) < 1e-9;
  const POOL_BADGES: Record<string, string> = {
    "Main Additive Pool": "bg-blue-500/10 text-blue-300 border-blue-500/30",
    "LUK2 Additive Pool": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    "Post-Processing": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Chip Cap-Break": "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
    "LUK Scaling": "bg-sky-500/10 text-sky-300 border-sky-500/30",
  };
  const poolBadgeClass =
    POOL_BADGES[poolName] || "bg-zinc-800/40 text-zinc-500 border-zinc-700/60";
  // Short label for the pool badge — strip "Pool" suffix to save space.
  const poolShort = poolName
    .replace(/\s*Pool$/, "")
    .replace(/-Processing$/, " Mult")
    .replace(/^LUK Scaling$/, "LUK")
    .replace(/^Chip Cap-Break$/, "Chip");
  return (
    <div className="border-b border-zinc-800/50 last:border-b-0">
      <div
        className={`flex items-center gap-2 px-4 py-2 text-sm ${
          hasChildren ? "cursor-pointer hover:bg-white/5" : ""
        } ${isZero ? "opacity-50" : ""}`}
        onClick={() => hasChildren && setOpen((v) => !v)}
        title={entry.node.note}
      >
        <span className="w-3 text-zinc-600 select-none flex-shrink-0">
          {hasChildren ? (open ? "▾" : "▸") : "•"}
        </span>
        <span className="flex-1 text-zinc-200 min-w-0">
          {(() => {
            const { main, tag } = splitEntityTag(entry.node.name);
            return (
              <span className="truncate">
                {main}
                {tag && (
                  <span className="ml-1.5 text-zinc-500 font-normal text-[0.85em]">
                    {tag}
                  </span>
                )}
              </span>
            );
          })()}
          {entry.node.note && (
            <span className="block text-[10px] text-zinc-500 italic mt-0.5 truncate">
              {entry.node.note}
            </span>
          )}
        </span>
        {poolName && (
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${poolBadgeClass}`}
            title={`Lives under "${poolName}" in the formula tree`}
          >
            {poolShort}
          </span>
        )}
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
              {(() => {
                const { main, tag } = splitEntityTag(c.name);
                return tag ? (
                  <>
                    {main}
                    <span className="ml-1 text-zinc-600 text-[0.85em]">{tag}</span>
                  </>
                ) : (
                  c.name
                );
              })()}
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
      {/* Controls bar — slightly raised so it visually separates from the
          tree below; not sticky to avoid stacking with the page TopNav. */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-900/60">
          {/* Layout toggle */}
          <div
            role="tablist"
            className="inline-flex gap-0.5 p-0.5 rounded-md bg-zinc-950 border border-zinc-800"
          >
            <button
              type="button"
              onClick={() => setLayout("tree")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                layout === "tree"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
              }`}
              title="Hierarchical view — pool → source → sub-source"
            >
              🌳 Tree
            </button>
            <button
              type="button"
              onClick={() => setLayout("system")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                layout === "system"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
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
            className="flex-1 min-w-[180px] px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500/60"
          />

          {/* Hide-zero toggle */}
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="accent-sky-500"
            />
            Hide zero
          </label>

          {/* Expand/collapse all — only meaningful in tree layout. Both
              buttons persist to localStorage, so a reload keeps the state. */}
          {layout === "tree" && (
            <div className="inline-flex gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                title="Open every node"
              >
                ⤢ All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                title="Close every node"
              >
                ⤡ None
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
          )}
        </div>
      </div>

      {/* Summary stats line */}
      <div className="text-[11px] text-zinc-500 mb-3 px-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-zinc-300 font-mono">{stats.nodeCount}</span>{" "}
          total nodes
        </span>
        <span>
          <span className="text-zinc-300 font-mono">{stats.leafCount}</span>{" "}
          leaf sources
        </span>
        <span>
          <span className="text-emerald-400 font-mono">
            {stats.nonZeroLeafCount}
          </span>{" "}
          non-zero
        </span>
        <span>
          max depth{" "}
          <span className="text-zinc-300 font-mono">{stats.maxDepth}</span>
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
            expandState={expandState}
            onToggle={toggleNode}
            searchTerm={searchTerm}
            hideZeroMap={hideZeroMap}
            searchMatchMap={searchMatchMap}
            root={tree}
            stats={stats}
          />
        </div>
      ) : (
        <SystemView root={tree} searchTerm={searchTerm} hideZero={hideZero} />
      )}
    </div>
  );
}
