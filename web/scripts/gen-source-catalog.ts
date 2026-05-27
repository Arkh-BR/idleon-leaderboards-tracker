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

// Closed-form formula spec captured from the corgan tree's "Formula
// Result" child note (e.g. "decay(40,50,50)"). x1/x2 are the game
// constants; the third number (lv at gen time) is the level — we don't
// store it because the runtime reads the live level kid value.
type FormulaSpec = { type: string; x1: number; x2: number };

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
  /** Closed-form formula spec — when set, the runtime computes the
   *  parent as formulaEval(type, x1, x2, levelKid) × any x-fmt kids.
   *  Captured by detectFormulaSpec() from the corgan tree's "Formula
   *  Result" child note. */
  formulaSpec?: FormulaSpec;
  /** Game-constant per-level rate captured from a hidden "Per Level"
   *  child (skipped from the UI). Consumed by the levelPerLevelProduct
   *  formulaKey to compute parent = level × perLevelConst × Π(x-fmt). */
  perLevelConst?: number;
  /** Game-constant set-bonus value (e.g. Efaunt Set = 25). Consumed
   *  by ownershipToggle: parent = idle + Owned/Unlocked-kid × delta,
   *  where idle = (fmt === "x" ? 1 : 0) and delta = bonusConst − idle.
   *  Covers set bonuses (Unlocked), bundles + companions (Owned). */
  bonusConst?: number;
  /** Game-constant slot-24 contribution per 40-win endless cycle.
   *  Consumed by endlessWinsBonus: parent ≈ count × perCycleConst/40.
   *  Captured from the (hidden) "Per 40-Cycle Bonus" child at gen time. */
  perCycleConst?: number;
  /** Mage Family Bonus 68 decay constants (ClassAccountBonus[34]).
   *  Lifted from the (hidden) Formula x1 / Formula x2 / Lv Offset kids
   *  at gen time so the data comes from the save's customlists.js
   *  rather than being hardcoded into the runtime handler. */
  familyBonusConsts?: { x1: number; x2: number; lvOffset: number };
  /** The Family Guy (Talent 144) decay constants. Lifted from the
   *  (hidden) Tal144 Formula x1 / Tal144 Formula x2 kids at gen time
   *  for the same reason — data-driven, not hardcoded. */
  familyGuyConsts?: { x1: number; x2: number };
  /** Pre-fill the max input with refValue on first page load. Used
   *  for "Points Invested" rows where the max-DR-research default IS
   *  the refValue (= max book lv cap). Without this flag, the input
   *  stays blank until the user types — leaving the parent's min()
   *  cascade returning null. Marked rows get seeded via the page
   *  load runtime hook. */
  autoFill?: boolean;
};

// Catalog-only placeholders / safety nets — never trackable sources.
// Also drops synthetic "Formula Result" rows the Corgan lib surfaces
// under Guild/Stamp/Post Office/Exotic-59 bonuses: the parent's value
// IS the formula result, so the child just duplicates the number with
// no editable input — pure noise in the max-values tool.
const SKIP_NAMES = new Set([
  "No active sources",
  "Available DR Items (not equipped)",
  "Available DR Obols (not equipped)",
  "Not Unlocked",
  "Formula Result",
  // Per-level rate (game constant per upgrade — Equinox Symbols=5, all
  // others=1). Captured as perLevelConst on the parent and consumed by
  // the levelPerLevelProduct formula; not editable on its own.
  "Per Level",
  // Arcane Map intermediates: Raw Bonus is the uncapped log-formula
  // output, Capped Bonus is min(Raw, Cap). The parent IS the capped
  // value — its CUSTOM_FORMULAS["Arcane Map Bonus"] already reads
  // Map Kills + Cap and applies the cap, so the intermediates were
  // duplicate noise. After the skip the row has just Map Kills + Cap
  // as editable inputs and the parent auto-recomputes.
  "Raw Bonus",
  "Capped Bonus",
  // Talent 655 intermediate: Per Skull = decay(25, 100, effLv). The
  // parent's CUSTOM_FORMULAS["Boss Battle Spillover (Talent 655)"]
  // handler folds this into total = perSkull × Skulls × Active using
  // Base + Bonus from siblings, so the standalone row was dead weight.
  "Per Skull",
  // Endless summoning per-cycle slot-24 contribution — game constant
  // for the SummonEnemies registry, lifted onto Endless Wins Bonus's
  // perCycleConst at gen time and consumed by endlessWinsBonus.
  "Per 40-Cycle Bonus",
]);

// Patterns matched by name — used alongside SKIP_NAMES for synthetic
// info rows whose name is dynamic (carries live save values inline).
const SKIP_PATTERNS: RegExp[] = [
  // "log₁₀(356841)" intermediate on Talent 328 — the parent's
  // CUSTOM_FORMULAS["Archlord Of The Pirates (Talent 328)"] handler
  // already computes log10 internally from Plunderous Kills.
  /^log₁₀\(/,
];

function isSkipped(name: string): boolean {
  if (SKIP_NAMES.has(name)) return true;
  for (let i = 0; i < SKIP_PATTERNS.length; i++) {
    if (SKIP_PATTERNS[i].test(name)) return true;
  }
  return false;
}

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
  // Achievement contribution: bonus × completed (completed is 0/1, or
  // a counter for stacking achievements). The auto-sum detector tags
  // these as "sum" because Σ("+" kids) happens to equal the parent
  // when completed = 1 — but that's a false positive: when completed
  // becomes 0 (or anything other than 1) the parent should DROP to
  // bonus × completed, not stay at bonus.
  if (sys === "Achievements") {
    const kids = node.children || [];
    if (
      kids.some((c) => c.name === "Completed") &&
      kids.some((c) => c.name === "Bonus" || /^Bonus\b/.test(c.name))
    ) {
      return "achievementContribution";
    }
  }
  // Talent "Bonus Levels" row: Σ of all contributing sources. The
  // children are emitted as fmt:"raw" (Symbols of Beyond, family
  // bonus, etc) but the parent is fmt:"+", so the generic sum detector
  // misses it. Tag specifically so the runtime sums every kid.
  // Requires children — otherwise the row is a leaf and the user
  // edits it directly (e.g. "Tal144 Bonus Levels" inside Family Guy
  // Multi, which is a leaf carrying the precomputed ATL sum).
  if (
    sys === "Talents" &&
    node.name === "Bonus Levels" &&
    (node.children || []).length > 0
  ) {
    return "talentBonusSum";
  }
  // Cloud Bonuses Sum (inside Nonstop Studies): same pattern — sum
  // every kid regardless of fmt.
  if (node.name === "Cloud Bonuses Sum") {
    return "talentBonusSum";
  }
  // Summoning WinBonus 24 = Normal Wins Bonus + Endless Wins Bonus.
  if (node.name === "Summoning WinBonus 24") {
    return "summoningWinBonus24";
  }
  // Family Bonus 68 (Mage) = floor(decay(20, 350, max(0, lv − 69)) × multi).
  // The Family Guy multi (Talent 144) is the active char's buff.
  if (node.name === "Family Bonus 68 (Mage)") {
    return "familyBonus68Mage";
  }
  // Best Mage Lv (inside Family Bonus 68) = max of per-char Lv kids.
  // Lets the user edit any single char's level and see Best Mage Lv
  // bump automatically.
  if (node.name === "Best Mage Lv" && (node.children || []).length > 0) {
    return "maxOfKids";
  }
  // Family Guy Multi (× — potential buff) = 1 + decay(x1, x2, Base +
  // Bonus) / 100. Four editable kids ("Base Level", "Bonus Levels",
  // "Tal144 Formula x1", "Tal144 Formula x2") — the formula is driven
  // by data sourced from talentParams(144). Whether the buff applies
  // is decided dynamically by the familyBonus68Mage handler based on
  // Lava's iteration order — this row just exposes the POTENTIAL
  // buff strength.
  if (
    node.name === "Family Guy Multi (×) — potential buff" &&
    (node.children || []).length > 0
  ) {
    return "familyGuyMulti";
  }
  // Base Level (inside Family Guy Multi) — gated by min(Points
  // Invested, Max Book Lv Cap). The two-child structure means a row
  // with EXACTLY 2 kids whose names are "Points Invested" and "Max
  // Book Lv Cap". Editing either bubbles up: if the user lifts the
  // cap (Library/Salt Lick) but hasn't invested points, Base Level
  // still reflects what was actually spent.
  if (node.name === "Base Level" && (node.children || []).length === 2) {
    const kidNames = (node.children || []).map((c) => c.name).sort();
    if (
      kidNames[0] === "Max Book Lv Cap" &&
      kidNames[1] === "Points Invested"
    ) {
      return "minOfChildren";
    }
  }
  // Max Book Lv Cap — the N.js maxBookLv formula (round(100 + 25 +
  // SaltLick + W3 Merit + Achievement 145 + Atom 7 + Fury Relic +
  // Summoning WB 19)). Wrapped by the Base Level min() gate above.
  if (node.name === "Max Book Lv Cap" && (node.children || []).length > 0) {
    return "maxBookLvSum";
  }
  // Super Bit 47 Lv Bonus = max(0, floor((Player Lv − 500) / 100)).
  // Single Player Lv kid drives the formula — handler recomputes live.
  if (
    node.name === "Super Bit 47 Lv Bonus" &&
    (node.children || []).length === 1
  ) {
    return "superBit47LvBonus";
  }
  // NOTE: "Effective Level" is a LEAF and gets tagged via the
  // tagEffectiveLevelLeaves() post-process pass (not here, since
  // detectStructuralFormula only runs on entries with children).
  // maxBookLv sub-rows that are computed as `kid1 × kid2` (level × per).
  // Salt Lick 4 = Lv × Per Lv; W3 Merit Shop = Pts × Per Point;
  // Sovereign Fury Relic = Base × Tier. All share the same shape.
  if (
    (node.name === "Salt Lick 4" ||
      node.name === "W3 Merit Shop Unlock" ||
      node.name === "Sovereign Fury Relic") &&
    (node.children || []).length === 2
  ) {
    return "twoChildProduct";
  }
  // Lv 1 Oxygen Atom = 10 × min(Atom 7 Lv, 1). Boolean-style: flat 10
  // if unlocked (Lv ≥ 1), 0 otherwise. Single Lv kid.
  if (node.name === "Lv 1 Oxygen Atom" && (node.children || []).length === 1) {
    return "atomLv1Bonus";
  }
  // Summoning Winner Bonus 19 — N.js multiplicative chain:
  //   val = Raw × Higher Bonus Multi × Winner Multi
  // Higher Bonus Multi (a sub-parent) is itself Base × Pristine × Gem.
  if (
    node.name === "Summoning Winner Bonus 19" &&
    (node.children || []).length > 0
  ) {
    return "summoningWB19Product";
  }
  // Higher Bonus Multi groups Base × Pristine × Gem into one row that
  // surfaces the "X× higher bonus" multiplier the in-game tooltip shows.
  if (
    node.name === "Higher Bonus Multi" &&
    (node.children || []).length > 0
  ) {
    return "higherBonusMulti"; // product of Base × Pristine × Gem
  }
  // Crystal Comb / Gem Shop / Winner Multi sub-formulas inside the
  // Summoning Winner Bonus 19 row.
  if (
    node.name === "Crystal Comb Pristine Charm" &&
    (node.children || []).length === 1
  ) {
    return "pristineMulti"; // 1 + Pristine 8 Bonus / 100
  }
  if (node.name === "Gem Shop Multi" && (node.children || []).length === 1) {
    return "gemShopMulti"; // 1 + 10 × Gem Items 11 / 100
  }
  if (
    node.name === "Winner Multi (combined)" &&
    (node.children || []).length > 0
  ) {
    return "winnerMultiCombined"; // 1 + (Σ additive contributors) / 100
  }
  // Sovereign Winz Lantern (Artifact 32, inside Winner Multi) =
  // Base × Tier — same shape as Sovereign Fury Relic (Artifact 21),
  // reuses twoChildProduct.
  if (
    node.name === "Sovereign Winz Lantern" &&
    (node.children || []).length === 2
  ) {
    return "twoChildProduct";
  }
  // Endless Wins Bonus = floor(count / 40) × perCycle + partial.
  if (node.name === "Endless Wins Bonus") {
    return "endlessWinsBonus";
  }
  // Vault Mastery: a multiplier row of the form (1 + masteryLv/100)
  // with a single "Mastery Lv" child. Tag so the runtime recomputes
  // the multi live when the user bumps the level.
  if (sys === "Vault") {
    if (node.name === "Mastery") {
      const kids = node.children || [];
      if (kids.length === 1 && kids[0].name === "Mastery Lv") {
        return "vaultMastery";
      }
    }
  }
  // Ownership-gated bonus rows: a 0/1 toggle gates a game-constant
  // bonus. Three shapes:
  //   1. [Unlocked]            — set bonuses (bonusConst lifted from parent)
  //   2. [Owned]                — bundles (bonusConst lifted from parent)
  //   3. [Owned, Bonus]         — companions (Bonus child carries the
  //                               value; auto-sum would false-positive
  //                               to "stuck at Bonus" when Owned=0)
  // All three go through ownershipToggle; the handler picks where to
  // read the constant from based on which kids are present.
  {
    const kids = node.children || [];
    if (kids.length === 1) {
      const childName = kids[0].name;
      if (childName === "Unlocked" || childName === "Owned") {
        return "ownershipToggle";
      }
    }
    if (kids.length === 2) {
      const names = kids.map((k) => k.name).sort();
      if (names[0] === "Bonus" && names[1] === "Owned") {
        return "ownershipToggle";
      }
    }
  }
  return null;
}

/** Look at a corgan node's children for a "Per Level" leaf — the game
 *  constant rate (e.g. Dream 10 = 5 DR / level, all others = 1). When
 *  present, returns the rate so we can lift it onto the parent entry
 *  and drive a formula even though we hide the row from the UI. */
function detectPerLevelConst(node: CorganNode): number | null {
  const kids = node.children || [];
  const pl = kids.find((c) => c.name === "Per Level");
  if (!pl) return null;
  const v = Number(pl.val);
  return Number.isFinite(v) ? v : null;
}

/** Look at a corgan node's children for a "Formula Result" leaf whose
 *  note encodes the closed-form spec used to compute the parent's value
 *  (e.g. "decay(40,50,50)"). Returns the spec with the level stripped
 *  off (level is read live from the level kid at runtime) — null if
 *  no Formula Result child or note doesn't match the expected shape. */
function detectFormulaSpec(node: CorganNode): FormulaSpec | null {
  const rx =
    /^([a-zA-Z]+)\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*-?\d+(?:\.\d+)?\s*\)/;
  // Talents and any other parents emit the canonical spec on their own
  // note as "type(x1,x2,lvAtGenTime)". Check that first so we don't
  // miss it when there isn't a Formula Result child.
  if (node.note) {
    const m = rx.exec(node.note);
    if (m) return { type: m[1], x1: Number(m[2]), x2: Number(m[3]) };
  }
  // Legacy shape: spec lives on a "Formula Result" leaf (Guild, Stamp,
  // Post Office, Exotic 59).
  const kids = node.children || [];
  const fr = kids.find((c) => c.name === "Formula Result");
  if (!fr || !fr.note) return null;
  const m = rx.exec(fr.note);
  if (!m) return null;
  return { type: m[1], x1: Number(m[2]), x2: Number(m[3]) };
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
  "Boss Battle Spillover (Talent 655)",
  "Divinity Minor 2 (Arctis)",
  "Equinox Symbols (Dream 10)",
]);

/** Human-readable formula descriptions appended to the row's note for
 *  per-name CUSTOM_FORMULAS rows. Gives the user a clue what's being
 *  computed without having to read the JS handler. */
const CUSTOM_FORMULA_NOTES: Record<string, string> = {
  "Arcane Map Bonus":
    "min(Cap, raw) where raw = (2·max(0,lg10−3.5) + max(0,lg2−12))·(lg10/2.5) + min(2, kills/1000) + max(0, 5·(lg10−5))",
  "Drop Rate Additive (Tome 2)": "Base × Tome Multi",
  "Drop Rate Multi (Tome 7)": "Base × Tome Multi",
  "Archlord Of The Pirates (Talent 328)":
    "1 + (Talent Value × log10(Plunderous Kills)) / 100",
  "Glimbo DR Multi":
    "1 + (gridVal × floor(Total Trades / 100)) / 100 where gridVal = lv × shape × max(1, allMulti)",
  "Boss Battle Spillover (Talent 655)":
    "decay(25, 100, Base Level) × Skulls Beaten  (star talent — no external bonus levels, Base gates the bonus)",
  "Divinity Minor 2 (Arctis)":
    "ceil(max(1, Y2) × (1 + Coral/100) × Lv/(60+Lv) × God)",
  "Equinox Symbols (Dream 10)":
    "round(Base Max + Summoning WinBonus 24 + 10·SuperBit35 + 4·CloudBonus[30])",
};

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
    if (isSkipped(child.name)) continue;
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
      // Closed-form spec (decay/add/bigBase/...) wins — it carries the
      // exact game formula, so we don't want a generic Σ/Π detector
      // overriding it with a false-positive structural match.
      const spec = detectFormulaSpec(child);
      const perLv = detectPerLevelConst(child);
      if (spec) {
        entry.formulaSpec = spec;
        entry.formulaKey = "closedFormFormula";
        entry.agg = "custom";
        // Surface the game constants on the row so the user sees what's
        // being computed (e.g. "decay(40, 50)" on Gold Charm). If the
        // note ALREADY contains the matching "type(x1,x2,lv)" pattern
        // (corgan emits it for talents), strip that — the lv at gen
        // time is misleading once the user starts editing.
        const formulaNote = `${spec.type}(${spec.x1}, ${spec.x2})`;
        const stripRx = new RegExp(
          `^${spec.type}\\(\\s*${spec.x1}\\s*,\\s*${spec.x2}\\s*,\\s*-?\\d+(?:\\.\\d+)?\\s*\\)\\s*—?\\s*`
        );
        const cleaned = entry.note ? entry.note.replace(stripRx, "").trim() : "";
        entry.note = cleaned ? `${cleaned} — ${formulaNote}` : formulaNote;
      } else if (perLv !== null) {
        // Game-constant per-level rate row (Equinox Symbols=5,
        // Vault/Grimoire/Spelunk=1). Formula: level × perLv × any
        // x-fmt multipliers. The "Per Level" child itself is hidden
        // by SKIP_NAMES — we lifted the constant up here.
        entry.perLevelConst = perLv;
        entry.formulaKey = "levelPerLevelProduct";
        entry.agg = "custom";
        const rateNote = `per level: ${perLv}`;
        entry.note = entry.note ? `${entry.note} — ${rateNote}` : rateNote;
      } else {
        const fkey = detectStructuralFormula(child, sys);
        if (fkey) {
          entry.formulaKey = fkey;
          entry.agg = "custom";
          // Set-bonus rows carry their game-constant bonus value as
          // the parent's val (when unlocked at gen time). Surface it
          // as bonusConst so the runtime can compute parent = const ×
          // unlocked-kid regardless of save state.
          if (fkey === "ownershipToggle") {
            entry.bonusConst = Number(child.val) || 0;
            const bn = `bonus: ${entry.bonusConst}`;
            entry.note = entry.note ? `${entry.note} — ${bn}` : bn;
          }
          // Endless Wins Bonus: lift the per-cycle game constant from
          // the (now hidden) "Per 40-Cycle Bonus" child onto the parent
          // entry so the runtime handler can compute count × const / 40.
          if (fkey === "endlessWinsBonus") {
            const perKid = (child.children || []).find(
              (k) => k.name === "Per 40-Cycle Bonus"
            );
            entry.perCycleConst = perKid ? Number(perKid.val) || 0 : 0;
            const pn = `per cycle: ${entry.perCycleConst}`;
            entry.note = entry.note ? `${entry.note} — ${pn}` : pn;
          }
        } else {
          const agg = detectAgg(child, child.children || []);
          if (agg) entry.agg = agg;
          // Append a friendly formula description for per-name custom
          // handlers so the user sees what's being computed.
          if (agg === "custom" && CUSTOM_FORMULA_NOTES[child.name]) {
            const fn = CUSTOM_FORMULA_NOTES[child.name];
            entry.note = entry.note ? `${entry.note} — ${fn}` : fn;
          }
        }
      }
    }
    out.push(entry);
  }
  return out;
}

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
// charIdx 2 (zArkhe), mapIdx 0 (Town, factor 1) — the same baseline the
// rest of the tooling uses. Research mode is on so every talent's Base
// Level / Points Invested defaults to the Max Book Lv Cap (the catalog
// snapshot becomes the ceiling, not the actual save state).
const r = computeCorganDropRate(raw, 2, 0, { useMaxResearchBaseLevel: true });

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
      if (isSkipped(src.name)) continue;
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
        const spec = detectFormulaSpec(src);
        const perLv = detectPerLevelConst(src);
        if (spec) {
          entry.formulaSpec = spec;
          entry.formulaKey = "closedFormFormula";
          entry.agg = "custom";
          const formulaNote = `${spec.type}(${spec.x1}, ${spec.x2})`;
          // Strip the gen-time "type(x1,x2,lv)" if it's already on the
          // note (corgan emits this for talents); we don't want the
          // stale lv showing once the user starts editing.
          const stripRx = new RegExp(
            `^${spec.type}\\(\\s*${spec.x1}\\s*,\\s*${spec.x2}\\s*,\\s*-?\\d+(?:\\.\\d+)?\\s*\\)\\s*—?\\s*`
          );
          const cleaned = entry.note ? entry.note.replace(stripRx, "").trim() : "";
          entry.note = cleaned ? `${cleaned} — ${formulaNote}` : formulaNote;
        } else if (perLv !== null) {
          entry.perLevelConst = perLv;
          entry.formulaKey = "levelPerLevelProduct";
          entry.agg = "custom";
          const rateNote = `per level: ${perLv}`;
          entry.note = entry.note ? `${entry.note} — ${rateNote}` : rateNote;
        } else {
          const fkey = detectStructuralFormula(src, sys);
          if (fkey) {
            entry.formulaKey = fkey;
            entry.agg = "custom";
            if (fkey === "ownershipToggle") {
              entry.bonusConst = Number(src.val) || 0;
              const bn = `bonus: ${entry.bonusConst}`;
              entry.note = entry.note ? `${entry.note} — ${bn}` : bn;
            }
          } else {
            const agg = detectAgg(src, src.children || []);
            if (agg) entry.agg = agg;
            if (agg === "custom" && CUSTOM_FORMULA_NOTES[src.name]) {
              const fn = CUSTOM_FORMULA_NOTES[src.name];
              entry.note = entry.note ? `${entry.note} — ${fn}` : fn;
            }
          }
        }
      }
      sources.push(entry);
    }
  }
}

/** Lift hidden formula-constant kids onto their parent entry.
 *
 *  Some agg parents (Family Bonus 68, Family Guy Multi) carry their
 *  decay constants as kids at the corgan source level — so the values
 *  are sourced from familyBonusParams(34) / talentParams(144) at gen
 *  time, NOT hardcoded into the runtime handler. But those constants
 *  shouldn't show up as visible rows in the max-values tool (they're
 *  game-fixed, not user-research inputs), so this pass:
 *    1. Detects the constant kids by name
 *    2. Lifts their values onto entry.familyBonusConsts / .familyGuyConsts
 *    3. Removes them from entry.children
 *
 *  Net effect: the runtime tree shows only the user-research inputs
 *  (Best Mage Lv, Family Guy Multi, Base Level, Bonus Levels) while
 *  the formula constants live as metadata that the handler reads. When
 *  a different save is pasted, the bundle re-emits everything from
 *  customlists.js — including the constants — so they automatically
 *  stay in sync with whatever game version the save targets. */
function liftFormulaConsts(entry: SourceEntry): void {
  if (entry.children && entry.children.length) {
    if (entry.formulaKey === "familyBonus68Mage") {
      const consts: Partial<{ x1: number; x2: number; lvOffset: number }> = {};
      const remaining: SourceEntry[] = [];
      for (const k of entry.children) {
        if (k.name === "Formula x1") consts.x1 = k.refValue;
        else if (k.name === "Formula x2") consts.x2 = k.refValue;
        else if (k.name === "Lv Offset") consts.lvOffset = k.refValue;
        else remaining.push(k);
      }
      if (consts.x1 != null && consts.x2 != null && consts.lvOffset != null) {
        entry.familyBonusConsts = consts as { x1: number; x2: number; lvOffset: number };
        entry.children = remaining;
      }
    } else if (entry.formulaKey === "familyGuyMulti") {
      const consts: Partial<{ x1: number; x2: number }> = {};
      const remaining: SourceEntry[] = [];
      for (const k of entry.children) {
        if (k.name === "Tal144 Formula x1") consts.x1 = k.refValue;
        else if (k.name === "Tal144 Formula x2") consts.x2 = k.refValue;
        else remaining.push(k);
      }
      if (consts.x1 != null && consts.x2 != null) {
        entry.familyGuyConsts = consts as { x1: number; x2: number };
        entry.children = remaining;
      }
    }
    // Recurse — Family Guy Multi lives inside Family Bonus 68's kids,
    // both nested under a talent's Bonus Levels row.
    for (const k of entry.children) liftFormulaConsts(k);
  }
}

// Hide formula constants from the visible tree, lift them onto entry
// metadata so handlers read from there (not from hardcoded literals).
for (const s of sources) liftFormulaConsts(s);

/** Mark "Points Invested" rows for pre-fill at page load. The max-DR-
 *  research default for these rows IS the catalog refValue (= Max
 *  Book Lv Cap), so seeding maxValue lets the min() cascade compute
 *  Base Level on open without the user having to type. */
function markAutoFill(entry: SourceEntry): void {
  if (entry.name === "Points Invested") entry.autoFill = true;
  if (entry.children) {
    for (const k of entry.children) markAutoFill(k);
  }
}
for (const s of sources) markAutoFill(s);

/** Tag "Effective Level" rows with the kid-reading effectiveLevelSum
 *  handler. Effective Level is now the PARENT of Base Level + Bonus
 *  Levels (instead of being a sibling leaf), so the handler reads its
 *  own kids and returns the sum. Post-process pass because the entry
 *  may already be tagged or detected by other rules and we want to
 *  override the formulaKey for these specific rows. */
function tagEffectiveLevelRows(entry: SourceEntry): void {
  if (entry.name === "Effective Level") {
    entry.formulaKey = "effectiveLevelSum";
    entry.agg = "custom";
  }
  if (entry.children) {
    for (const k of entry.children) tagEffectiveLevelRows(k);
  }
}
for (const s of sources) tagEffectiveLevelRows(s);

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
.row .name .name-with-note {
  display: flex; flex-direction: column; gap: 2px;
  overflow: hidden; min-width: 0;
}
.row .name .formula-note {
  font-size: 10px; color: var(--ink-mute);
  font-style: italic;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
body.notes-hidden .row .name .formula-note { display: none; }
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

/* Sub-row indentation — fixed step (24px / level) plus a subtle
   left-border guide so deeper nests stay readable. Each depth class
   adds a left border whose color fades with depth, giving the tree a
   visual rail without going full ASCII tree art. */
.row.depth-1, .row.depth-2, .row.depth-3,
.row.depth-4, .row.depth-5, .row.depth-6,
.row.depth-7, .row.depth-8, .row.depth-9, .row.depth-10 {
  font-size: 11px;
  background-image: linear-gradient(
    to right,
    rgba(56, 189, 248, 0.18) 0,
    rgba(56, 189, 248, 0.18) 1px,
    transparent 1px
  );
  background-repeat: no-repeat;
}
.row.depth-1  { padding-left: 24px;  background-position: 12px 0; }
.row.depth-2  { padding-left: 48px;  background-position: 36px 0; }
.row.depth-3  { padding-left: 72px;  background-position: 60px 0; }
.row.depth-4  { padding-left: 96px;  background-position: 84px 0; }
.row.depth-5  { padding-left: 120px; background-position: 108px 0; }
.row.depth-6  { padding-left: 144px; background-position: 132px 0; }
.row.depth-7  { padding-left: 168px; background-position: 156px 0; }
.row.depth-8  { padding-left: 192px; background-position: 180px 0; }
.row.depth-9  { padding-left: 216px; background-position: 204px 0; }
.row.depth-10 { padding-left: 240px; background-position: 228px 0; }
.row.depth-1 .name, .row.depth-2 .name, .row.depth-3 .name,
.row.depth-4 .name, .row.depth-5 .name, .row.depth-6 .name,
.row.depth-7 .name, .row.depth-8 .name,
.row.depth-9 .name, .row.depth-10 .name {
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
    <label><input type="checkbox" id="hide-notes" /> Hide notes</label>
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
    hideNotes: "dr-max-values.hide-notes.v2",
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
  var hideNotes = localStorage.getItem(STORAGE.hideNotes) === "1";
  var filterText = "";
  var filterMode = "all"; // "all" | "blank" | "filled"
  var hideZero = false;
  if (hideNotes) document.body.classList.add("notes-hidden");

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

  /** Find a sibling SourceEntry of the given node by name. Used by
   *  the effectiveLevelSum handler (and any other cross-sibling
   *  formulas) since handlers normally only see their own kids.
   *  Walks up via parentByChildId, then scans the parent's children. */
  function findSibling(nodeId, siblingName) {
    var parentId = parentByChildId.get(nodeId);
    if (!parentId) return null;
    var parent = sourceById.get(parentId);
    if (!parent || !parent.children) return null;
    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i].name === siblingName) return parent.children[i];
    }
    return null;
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
  /** Effective Max for a source. STRICT MODE: empty leaves return null
   *  so any formula that depends on them also yields null. The point
   *  is that formula rows should only display a value once their
   *  research inputs are stipulated — otherwise they'd be silently
   *  filling in catalog refs and pretending those are user-confirmed
   *  ceilings. Use ← ref or = Fill blanks with ref to seed leaves with
   *  the current save's values. */
  function effectiveValue(src) {
    if (src.agg) {
      var v = computeAgg(src);
      if (v === null || !Number.isFinite(v)) return null;
      return v;
    }
    var e = values[src.id];
    if (e && typeof e.maxValue === "number") return e.maxValue;
    return null;
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
  /** Closed-form formula evaluator — 1:1 port of formulas.ts
   *  formulaEval. The game's universal ArbitraryCode5Inputs helper used
   *  by stamps, guild bonuses, post office, talents, bubbles, etc. */
  function formulaEval(type, x1, x2, lv) {
    switch (type) {
      case "add":
        return x2 !== 0
          ? ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1
          : x1 * lv;
      case "addLower": return x1 + x2 * (lv + 1);
      case "addDECAY":
        return lv < 50001
          ? x1 * lv
          : x1 * Math.min(50000, lv) +
              ((lv - 50000) / (lv - 50000 + 150000)) * x1 * 50000;
      case "decay": return (x1 * lv) / (lv + x2);
      case "decayLower":
        return (x1 * (lv + 1)) / (lv + 1 + x2) - (x1 * lv) / (lv + x2);
      case "decayMulti": return 1 + (x1 * lv) / (lv + x2);
      case "decayMultiLower":
        return (x1 * (lv + 1)) / (lv + 1 + x2) - (x1 * lv) / (lv + x2);
      case "bigBase": return x1 + x2 * lv;
      case "bigBaseLower": return x2;
      case "intervalAdd": return x1 + Math.floor(lv / x2);
      case "intervalAddLower":
        return Math.max(Math.floor((lv + 1) / x2), 0) - Math.max(Math.floor(lv / x2), 0);
      case "reduce": return x1 - x2 * lv;
      case "reduceLower": return x1 - x2 * (lv + 1);
      case "PtsSpentOnGuildBonus":
        return ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1 - x2 * lv;
      default: return 0;
    }
  }

  /** "Has any kid been explicitly filled" — checks effectiveValue
   *  (which is null when the user hasn't typed a max AND there's no
   *  formula). Cap-research handlers use this to gate computation:
   *  no active input → return null → no auto-echo of refValue. */
  function _hasAnyActive(kids) {
    for (var i = 0; i < kids.length; i++) {
      if (effectiveValue(kids[i]) !== null) return true;
    }
    return false;
  }

  /** Resolve a named child's effective value for custom formula handlers.
   *  Returns null when the child is missing OR unfilled, so handlers
   *  can early-return null to keep the strict-mode propagation. */
  function kid(kids, namePattern) {
    var rx = namePattern instanceof RegExp ? namePattern : new RegExp("^" + namePattern + "$");
    for (var i = 0; i < kids.length; i++) {
      if (rx.test(kids[i].name)) {
        var v = effectiveValue(kids[i]);
        return v === null ? null : (Number(v) || 0);
      }
    }
    return null;
  }
  var CUSTOM_FORMULAS = {
    // ── Structural keys (catalog tags rows via formulaKey) ──────────
    "friendContribution": function (_p, kids) {
      // STRICT: contrib = 25 × min(1, 0.2 + c/(c + 3000)) where c = clamp(score, 0, 12000)
      var score = kid(kids, /^Score$/);
      if (score === null) return null;
      var c = Math.min(12000, Math.max(0, score));
      return 25 * Math.min(1, 0.2 + c / (c + 3000));
    },
    "levelPerLevelProduct": function (p, kids) {
      // parent = levelKid × perLevelConst × Π(x-fmt kids). The
      // perLevelConst is a game constant (Equinox 5, all others 1)
      // captured at gen time; "Per Level" itself is skipped from the
      // UI. The level kid is the first non-x-fmt remaining child
      // (Level / Dream Upgrade Level / Shop Level / etc.).
      var per = p && Number(p.perLevelConst);
      if (!per && per !== 0) return null;
      var lvl = null;
      for (var i = 0; i < kids.length && lvl === null; i++) {
        if (kids[i].fmt !== "x") {
          var v = effectiveValue(kids[i]);
          if (v !== null) lvl = Number(v) || 0;
        }
      }
      if (lvl === null) return null;
      var multi = 1;
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].fmt === "x") {
          var mv = effectiveValue(kids[j]);
          if (mv === null) return null;
          var mn = Number(mv);
          if (mn > 0) multi *= mn;
        }
      }
      return lvl * per * multi;
    },
    "ownershipToggle": function (p, kids) {
      // STRICT MODE — same contract as the global "sum"/"product"
      // handlers and the family-bonus handlers. Every VISIBLE kid in
      // the row must be stipulated; if any is unfilled, the parent
      // is null.
      //
      // Two row shapes:
      //   A. Owned (or Unlocked) only — set bonuses, bundles. The bonus
      //      value lives as HIDDEN metadata on the parent entry
      //      (p.bonusConst, lifted from the gen-time corgan tree).
      //   B. Owned + Bonus kids — companions. Bonus is the editable
      //      delta (game emits Bonus=N where N is the additive
      //      contribution); STRICT on it too.
      //
      // Formula: parent = idle + owned × delta where
      //   idle  = 1 for x-fmt rows, 0 for +-fmt rows
      //   delta = bonusKid (shape B) or bonusConst − idle (shape A)
      var idle = p.fmt === "x" ? 1 : 0;
      // Detect shape by checking which kids exist by name. A row with
      // a Bonus kid is shape B regardless of the user's input state —
      // the structure determines the contract.
      var hasOwned = false, hasUnlocked = false, hasBonus = false;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].name === "Owned") hasOwned = true;
        else if (kids[i].name === "Unlocked") hasUnlocked = true;
        else if (kids[i].name === "Bonus") hasBonus = true;
      }
      // STRICT: read Owned/Unlocked via effectiveValue (kid()). null
      // means the user hasn't stipulated whether they own/unlocked it
      // — propagate null instead of silently using the catalog refValue.
      var owned = null;
      if (hasOwned) owned = kid(kids, /^Owned$/);
      else if (hasUnlocked) owned = kid(kids, /^Unlocked$/);
      if (owned === null) return null;
      if (hasBonus) {
        // Shape B (companion): STRICT on Bonus. If the user hasn't
        // committed to a bonus value, the contribution is null —
        // matches familyGuyMulti requiring Base+Bonus both stipulated.
        //
        // The Bonus kid carries the REAL bonus value (e.g. Mr Pig
        // bonus=2 for ×2 multi). Delta-from-idle is computed here so
        // the formula remains uniform across +-fmt and x-fmt rows:
        //   parent = idle + owned × (bonus − idle)
        //   owned=1 → bonus; owned=0 → idle
        var bk = kid(kids, /^Bonus$/);
        if (bk === null) return null;
        return idle + owned * (bk - idle);
      }
      // Shape A (set bonus / bundle): bonusConst is the hidden game
      // constant (analogous to familyBonusConsts on FB68 — sourced from
      // the corgan tree at gen time, not hardcoded in this handler).
      var bn = p && Number(p.bonusConst);
      if (!Number.isFinite(bn)) return null;
      return idle + owned * (bn - idle);
    },
    "familyGuyMulti": function (p, kids) {
      // 1 + decay(x1, x2, Base + Bonus) / 100. LENIENT MODE: kids fall
      // back to refValue when the user hasn't edited them, so the
      // cascade from Base Level's sub-tree (Salt Lick, Fury Relic,
      // etc.) flows up uninterrupted. Editing a leaf deep inside Base
      // Level recomputes all the way up to Family Bonus 68 here.
      //
      // Decay constants live as HIDDEN metadata on the parent entry
      // (p.familyGuyConsts) — lifted at gen time from talentParams(144)
      // so the values come from the save's customlists.js.
      //
      // Lava's algorithm: the buff is applied AFTER FB68 stores its
      // unbuffed value (familyBonus68Mage handler does the store-then
      // -buff in iteration order). This row just exposes the POTENTIAL
      // buff strength.
      var consts = p && p.familyGuyConsts;
      if (!consts || consts.x1 == null || consts.x2 == null) return null;
      // STRICT: both Base Level and Bonus Levels must have an effective
      // value (no refValue fallback). Mirrors global "sum"/"product"
      // contract — clearing either nulls the multi → cascade up.
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var base = kidStrict("Base Level");
      var bonus = kidStrict("Bonus Levels");
      if (base === null || bonus === null) return null;
      var effLv = base + bonus;
      if (effLv <= 0) return 1;
      // decay formula: (x1 * lv) / (lv + x2)
      var tal144Val = (consts.x1 * effLv) / (effLv + consts.x2);
      return 1 + tal144Val / 100;
    },
    "maxOfKids": function (_p, kids) {
      // STRICT max across kids — null if ANY kid is unfilled. Mirrors
      // global "sum"/"product" contract.
      if (!kids.length) return null;
      var best = -Infinity;
      for (var i = 0; i < kids.length; i++) {
        var v = effectiveValue(kids[i]);
        if (v === null) return null;
        if (v > best) best = v;
      }
      return best === -Infinity ? null : best;
    },
    "effectiveLevelSum": function (_p, kids) {
      // STRICT: Effective Level = Base Level + Bonus Levels. Reads
      // KIDS by name (Base + Bonus are now CHILDREN of Effective Level,
      // not siblings). Lets the user edit either and see Effective
      // Level recompute live.
      var base = null, bonus = null;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].name === "Base Level") base = kids[i];
        else if (kids[i].name === "Bonus Levels") bonus = kids[i];
      }
      if (!base || !bonus) return null;
      var bv = effectiveValue(base);
      var nv = effectiveValue(bonus);
      if (bv === null || nv === null) return null;
      return bv + nv;
    },
    "superBit47LvBonus": function (_p, kids) {
      // STRICT: max(0, floor((Player Lv − 500) / 100)). Single kid
      // (Player Lv) — if null, returns null. Mirrors the inline N.js
      // computation used inside computeAllTalentLVz when SuperBit 47
      // is unlocked.
      if (kids.length < 1) return null;
      var lv = effectiveValue(kids[0]);
      if (lv === null) return null;
      return Math.max(0, Math.floor((Number(lv) - 500) / 100));
    },
    "minOfChildren": function (_p, kids) {
      // STRICT min across kids — null if ANY kid is unfilled. Used by
      // the Talent 144 Base Level row to gate the value at min(Points
      // Invested, Max Book Lv Cap): you only get the talent levels you
      // ACTUALLY spent points on, capped at what the maxBookLv formula
      // allows. Both kids must be stipulated for the result to compute.
      if (!kids.length) return null;
      var worst = Infinity;
      for (var i = 0; i < kids.length; i++) {
        var v = effectiveValue(kids[i]);
        if (v === null) return null;
        if (v < worst) worst = v;
      }
      return worst === Infinity ? null : worst;
    },
    "familyBonus68Mage": function (p, kids) {
      // Replicates Lava's N.js single-pass algorithm — iterates each
      // Elemental Sorcerer (cls 34) char in account order. For each:
      //   v = decay(x1, x2, max(0, char.lv - lvOffset))
      //   if v > best: best = v   ← store UNBUFFED first
      //     if char is ACTIVE: best = v × familyGuyMulti   ← buffed
      // Iteration ORDER matters: an active char whose unbuffed value
      // doesn't beat the running best can still WIN if their buffed
      // value does — but only if they iterate AFTER the current best.
      //
      // LENIENT MODE: kids fall back to refValue when unedited so the
      // cascade from deep sub-trees (Salt Lick → Base Level → Family
      // Guy Multi → here) flows up. Editing any leaf cascades all the
      // way to this final FB68 value.
      //
      // Decay constants live as HIDDEN metadata on the parent entry
      // (p.familyBonusConsts) — lifted at gen time from
      // familyBonusParams(34) so the values come from the save's
      // customlists.js, not hardcoded.
      var consts = p && p.familyBonusConsts;
      if (!consts || consts.x1 == null || consts.x2 == null || consts.lvOffset == null) {
        return null;
      }
      // Locate kids by name.
      var bestMageLvKid = null;
      var familyGuyMultiKid = null;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].name === "Best Mage Lv") bestMageLvKid = kids[i];
        else if (kids[i].name === "Family Guy Multi (×) — potential buff") familyGuyMultiKid = kids[i];
      }
      if (!bestMageLvKid || !bestMageLvKid.children || !bestMageLvKid.children.length) {
        return null;
      }
      // STRICT: Family Guy Multi must have effectiveValue — no refValue
      // fallback. Mirrors global "sum"/"product" contract.
      var familyGuyMulti = familyGuyMultiKid
        ? effectiveValue(familyGuyMultiKid)
        : null;
      if (familyGuyMulti === null) return null;
      var best = 0;
      for (var j = 0; j < bestMageLvKid.children.length; j++) {
        var charKid = bestMageLvKid.children[j];
        var charLv = effectiveValue(charKid);
        if (charLv === null) return null; // strict
        var n = Math.max(0, charLv - consts.lvOffset);
        if (n <= 0) continue;
        // decay(x1, x2, n) = (x1 * n) / (n + x2)
        var v = (consts.x1 * n) / (n + consts.x2);
        if (v > best) {
          // Step 1: store unbuffed first (Lava's order)
          best = v;
          // Step 2: if this iteration is the active char, apply buff
          var isActive =
            charKid.note && charKid.note.indexOf("ACTIVE") >= 0;
          if (isActive && familyGuyMulti > 1) {
            best = v * familyGuyMulti;
          }
        }
      }
      return Math.floor(best);
    },
    "summoningWinBonus24": function (_p, kids) {
      // STRICT: slot 24 = Normal + Endless. Both kids must have
      // effectiveValue. No refValue fallback — clearing either kid
      // nulls the sum (cascade up).
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var n = kidStrict("Normal Wins Bonus");
      var e = kidStrict("Endless Wins Bonus");
      if (n === null || e === null) return null;
      return n + e;
    },
    "endlessWinsBonus": function (p, kids) {
      // STRICT: floor(count/40) × perCycle. The Endless Wins Count kid
      // must have effectiveValue — no refValue fallback. perCycleConst
      // is the hidden game constant from gen time.
      var per = p && Number(p.perCycleConst);
      if (!Number.isFinite(per)) return null;
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var count = kidStrict("Endless Wins Count");
      if (count === null) return null;
      return count * (per / 40);
    },
    "talentBonusSum": function (_p, kids) {
      // Sum of every contributor to a talent's bonus levels — kids
      // are emitted as fmt:"raw" (Symbols of Beyond, family bonus,
      // divinity, etc.) so the generic Σ rule (matching parent fmt)
      // would skip them. Empty bonus levels are 0, not null — an
      // inactive talent with no contributors is meaningful state.
      var total = 0;
      for (var i = 0; i < kids.length; i++) {
        var v = effectiveValue(kids[i]);
        if (v === null) return null;
        total += Number(v) || 0;
      }
      return total;
    },
    "twoChildProduct": function (_p, kids) {
      // STRICT product of two kids — mirrors the global "sum" contract.
      // If ANY kid is null (unedited OR cleared by user), returns null
      // and the cascade nulls up to Base Level → Family Guy Multi → FB68.
      // No refValue fallback: clearing a leaf actively nulls the result.
      //
      // Used by Salt Lick 4 / W3 Merit Shop / Sovereign Fury Relic.
      // To seed every leaf with the gen-time refValue at once, use the
      // page's "Fill Blanks with Ref" button (or per-row ← ref).
      if (kids.length < 2) return null;
      var v0 = effectiveValue(kids[0]);
      if (v0 === null) return null;
      var v1 = effectiveValue(kids[1]);
      if (v1 === null) return null;
      return v0 * v1;
    },
    "atomLv1Bonus": function (_p, kids) {
      // STRICT 10 × min(Atom 7 Lv, 1) — null if the Lv kid is unfilled.
      if (kids.length < 1) return null;
      var lv = effectiveValue(kids[0]);
      if (lv === null) return null;
      return 10 * Math.min(Number(lv) || 0, 1);
    },
    "summoningWB19Product": function (_p, kids) {
      // STRICT: Summoning Winner Bonus 19 = Raw × Higher Bonus × Winner.
      // (Higher Bonus Multi itself wraps Base × Pristine × Gem.) Reads
      // each direct child by name; any null kid → null (cascade up).
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var raw = kidStrict("Summoning Battles");
      var higher = kidStrict("Higher Bonus Multi");
      var winner = kidStrict("Winner Multi (combined)");
      if (raw === null || higher === null || winner === null) {
        return null;
      }
      return raw * higher * winner;
    },
    "higherBonusMulti": function (_p, kids) {
      // STRICT: Higher Bonus Multi = Base × Pristine × Gem. This is the
      // multiplier the in-game tooltip displays as "X× higher bonus".
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var base = kidStrict("Base Multi");
      var pristine = kidStrict("Crystal Comb Pristine Charm");
      var gem = kidStrict("Gem Shop Multi");
      if (base === null || pristine === null || gem === null) return null;
      return base * pristine * gem;
    },
    "pristineMulti": function (_p, kids) {
      // STRICT: 1 + Pristine 8 Bonus / 100.
      if (kids.length < 1) return null;
      var pristine8 = effectiveValue(kids[0]);
      if (pristine8 === null) return null;
      return 1 + (Number(pristine8) || 0) / 100;
    },
    "gemShopMulti": function (_p, kids) {
      // STRICT: 1 + 10 × Gem Items 11 / 100.
      if (kids.length < 1) return null;
      var gemItems = effectiveValue(kids[0]);
      if (gemItems === null) return null;
      return 1 + (10 * (Number(gemItems) || 0)) / 100;
    },
    "winnerMultiCombined": function (_p, kids) {
      // STRICT: 1 + (Σ additive contributors) / 100. Sums all kids
      // (Sovereign Fury Lantern + W3 Merit + Regalis + Spectre Stars +
      // Godshard Set) — any null kid → null.
      var sum = 0;
      for (var i = 0; i < kids.length; i++) {
        var v = effectiveValue(kids[i]);
        if (v === null) return null;
        sum += Number(v) || 0;
      }
      return 1 + sum / 100;
    },
    "maxBookLvSum": function (_p, kids) {
      // STRICT sum of every maxBookLv contributor wrapped in Math.round
      // — exact port of N.js line 12252 (maxBookLv = Math.round(125 +
      // SaltLick + W3 Merit + ...)). The summoning bonus comes in as a
      // float (e.g. 75.62), so without rounding the Base Level shows
      // decimal noise; Lava clamps to integer.
      //
      // STRICT: if ANY kid is null (unfilled or cleared), returns null
      // — cascade nulls up to Family Guy Multi → FB68 → talent value.
      var total = 0;
      for (var i = 0; i < kids.length; i++) {
        var v = effectiveValue(kids[i]);
        if (v === null) return null;
        total += Number(v) || 0;
      }
      return Math.round(total);
    },
    "vaultMastery": function (_p, kids) {
      // Vault upgrade mastery multiplier: 1 + masteryLv / 100. Each
      // mastery node mirrors the corresponding vd[32/61/89] level in
      // the save — bumping the level here lets us research what the
      // upgrade tops out at without the corgan pipeline.
      var lv = kid(kids, /^Mastery Lv$/);
      if (lv === null) return null;
      return 1 + lv / 100;
    },
    "closedFormFormula": function (p, kids) {
      // p.formulaSpec = { type, x1, x2 } captured from the parent's own
      // note OR a "Formula Result" child note. The third input (lv)
      // comes from a named "level" kid (Guild Points / Stamp Level /
      // Points Invested / Level / Effective Level), or — talent-shape
      // — from Base Level + Bonus Levels when Effective Level isn't
      // filled in by the user.
      //
      // x1 and x2 can ALSO be exposed as editable kids ("Formula x1",
      // "Formula x2") — when present they override the spec, letting
      // the user research alternate constants.
      var spec = p && p.formulaSpec;
      if (!spec) return null;
      // STRICT on x1/x2 when the kids are PRESENT in the tree: if the
      // user cleared Formula x1, the handler returns null instead of
      // silently falling back to spec.x1. For rows WITHOUT Formula
      // x1/x2 kids visible, the spec values are the canonical source.
      var x1KidNode = null, x2KidNode = null;
      for (var ki = 0; ki < kids.length; ki++) {
        if (kids[ki].name === "Formula x1") x1KidNode = kids[ki];
        else if (kids[ki].name === "Formula x2") x2KidNode = kids[ki];
      }
      var x1;
      if (x1KidNode) {
        var x1v = effectiveValue(x1KidNode);
        if (x1v === null) return null;
        x1 = Number(x1v) || 0;
      } else {
        x1 = spec.x1;
      }
      var x2;
      if (x2KidNode) {
        var x2v = effectiveValue(x2KidNode);
        if (x2v === null) return null;
        x2 = Number(x2v) || 0;
      } else {
        x2 = spec.x2;
      }
      var lv = null;
      var levelNames = [
        "Guild Points",
        "Stamp Level",
        "Points Invested",
        "Level",
        "Effective Level",
      ];
      for (var i = 0; i < kids.length && lv === null; i++) {
        if (levelNames.indexOf(kids[i].name) >= 0) {
          var vv = effectiveValue(kids[i]);
          if (vv !== null) lv = Number(vv) || 0;
        }
      }
      // Talent-shape fallback: derive effLv from Base Level + Bonus
      // Levels so the user only has to fill those two to drive the
      // whole chain. "Base Level" may carry an owner suffix for
      // best-char talents (e.g. "Base Level (owner: zArkhe)"). Use a
      // .startsWith match via a single-line regex that the template
      // literal can encode safely.
      if (lv === null) {
        var base = null;
        var bonus = kid(kids, /^Bonus Levels$/);
        for (var bi = 0; bi < kids.length; bi++) {
          if (kids[bi].name === "Base Level" ||
              kids[bi].name.indexOf("Base Level (owner") === 0) {
            var bv = effectiveValue(kids[bi]);
            if (bv !== null) { base = Number(bv) || 0; break; }
          }
        }
        if (base !== null && bonus !== null) lv = base + bonus;
      }
      if (lv === null) {
        for (var j = 0; j < kids.length && lv === null; j++) {
          if (
            kids[j].fmt === "raw" &&
            kids[j].name !== "Active"
          ) {
            var vv2 = effectiveValue(kids[j]);
            if (vv2 !== null) lv = Number(vv2) || 0;
          }
        }
      }
      if (lv === null) return null;
      var raw = formulaEval(spec.type, x1, x2, lv);
      // Multiply in any x-fmt children (Exalted ×, Certified Stamp
      // Book ×, etc.). Strict null mode.
      var multi = 1;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].fmt === "x") {
          var mv = effectiveValue(kids[k]);
          if (mv === null) return null;
          var mn = Number(mv);
          if (mn > 0) multi *= mn;
        }
      }
      var result = raw * multi;
      // Optional Active 0/1 toggle gates the whole contribution.
      // fmt-aware: x-fmt rows idle to 1, +-fmt to 0.
      var act = kid(kids, /^Active$/);
      if (act !== null) {
        var idle = p.fmt === "x" ? 1 : 0;
        result = idle + act * (result - idle);
      }
      return result;
    },
    "achievementContribution": function (_p, kids) {
      // bonus × completed (completed = 0/1 toggle, or a stack counter).
      // NOTE: the regex MUST NOT use \\b — this string lives in a
      // template literal at gen time, so \\b would evaluate to the
      // backspace char (0x08) before reaching the browser. Use a
      // plain $ anchor instead.
      var completed = kid(kids, /^Completed$/);
      var bonus = kid(kids, /^Bonus$/);
      if (completed === null || bonus === null) return null;
      return bonus * completed;
    },
    // ── Per-name keys ───────────────────────────────────────────────
    "Arcane Map Bonus": function (_p, kids) {
      // STRICT: needs Map Kills filled. Cap is optional — formula
      // without a cap caps internally based on talent 589 etc., but
      // that's not a leaf here so we just skip the cap when absent.
      var kills = kid(kids, /^Map Kills$/);
      if (kills === null) return null;
      if (kills < 1) return 0;
      var cap = kid(kids, /^Cap$/);
      var lg = Math.log(Math.max(kills, 1)) / Math.LN10;
      var lg2 = Math.log(Math.max(kills, 1)) / Math.LN2;
      var raw = (2 * Math.max(0, lg - 3.5) + Math.max(0, lg2 - 12)) * (lg / 2.5) +
                Math.min(2, kills / 1000) +
                Math.max(5 * (lg - 5), 0);
      return cap === null ? raw : Math.min(cap, raw);
    },
    "Drop Rate Additive (Tome 2)": function (_p, kids) {
      var base = kid(kids, /^Base$/);
      var multi = kid(kids, /^Tome Multi$/);
      if (base === null || multi === null) return null;
      return base * multi;
    },
    "Drop Rate Multi (Tome 7)": function (_p, kids) {
      var base = kid(kids, /^Base$/);
      var multi = kid(kids, /^Tome Multi$/);
      if (base === null || multi === null) return null;
      return base * multi;
    },
    "Equinox Symbols (Dream 10)": function (_p, kids) {
      // STRICT: round(Base Max + Summoning WB 24 + 10×SuperBit 35 +
      // 4×Cloud 30). All four kids must have effectiveValue — no
      // refValue fallback. Clearing any kid nulls the result.
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var base = kidStrict("Base Max");
      var summ = kidStrict("Summoning WinBonus 24");
      var sb35 = kidStrict("SuperBit 35 (×10)");
      var c30 = kidStrict("Cloud 30 (×4)");
      if (base === null || summ === null || sb35 === null || c30 === null) return null;
      return Math.round(base + summ + sb35 + c30);
    },
    "Divinity Minor 2 (Arctis)": function (_p, kids) {
      // STRICT: ceil(max(1, Y2) × (1 + Coral/100) × Lv/(60+Lv) × God).
      // All four kids must have effectiveValue — no refValue fallback.
      function kidStrict(name) {
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].name === name) {
            var v = effectiveValue(kids[i]);
            return v === null ? null : (Number(v) || 0);
          }
        }
        return null;
      }
      var lv = kidStrict("Divinity Lv");
      var y2 = kidStrict("Bubble Y2 Active");
      var coral = kidStrict("Coral Kid 3");
      var god = kidStrict("God Minor X1(2)");
      if (lv === null || y2 === null || coral === null || god === null) return null;
      if (lv <= 0) return 0;
      return Math.ceil(
        Math.max(1, y2) * (1 + coral / 100) * (lv / (60 + lv)) * god
      );
    },
    "Boss Battle Spillover (Talent 655)": function (_p, kids) {
      // Star talent — Base Level alone gates the contribution
      // (level 0 → 0 already), so no Active toggle. Game formula:
      // perSkull = decay(25, 100, Base Level); total = perSkull ×
      // Skulls Beaten.
      var skulls = kid(kids, /^Skulls Beaten$/);
      var base = kid(kids, /^Base Level$/);
      if (skulls === null || base === null) return null;
      var perSkull = (25 * base) / (base + 100);
      return perSkull * skulls;
    },
    "Archlord Of The Pirates (Talent 328)": function (_p, kids) {
      // total = 1 + (talVal × log10(plunder)) / 100, gated by Active.
      var talVal = kid(kids, /^Talent Value$/);
      var plunder = kid(kids, /^Plunderous Kills$/);
      if (talVal === null || plunder === null) return null;
      var act = kid(kids, /^Active$/);
      // Inactive talent contributes ×1 (x-fmt idle).
      if (act === 0) return 1;
      if (plunder < 1) return 1;
      var raw = 1 + (talVal * (Math.log(Math.max(plunder, 1)) / Math.LN10)) / 100;
      // act === null means no Active kid — treat as active.
      return act === null || act === 1 ? raw : 1 + (act * (raw - 1));
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
      if (trades === null || lv === null || shape === null || am === null) return null;
      var perLv = 1; // per-level bonus on grid 168
      var gridVal = lv * perLv * shape * Math.max(1, am);
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
        patchEntry(s.id, { maxValue: v });
      } else {
        // Formula explicitly returned null (cap-research gate failed
        // because no active kid, or strict-null short-circuited).
        // Clear any stale maxValue from a previous recompute so the
        // UI reflects "no result", not the cached value.
        var e = values[s.id];
        if (e && typeof e.maxValue === "number") {
          patchEntry(s.id, { maxValue: undefined });
        }
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

    // 2. Copy from a specific child (strict: null if the source is null)
    if (typeof rule === "string" && rule.indexOf("copy:") === 0) {
      var target = rule.slice(5);
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].name === target) {
          var cv = effectiveValue(kids[i]);
          return cv === null ? null : (Number(cv) || 0);
        }
      }
      return null;
    }

    var matching = kids.filter(function (c) { return c.fmt === parent.fmt; });
    // STRICT MODE: if ANY contributing child is null (unfilled), the
    // whole aggregation is null — bubble that up so formula rows only
    // display once their inputs are stipulated.
    if (rule === "sum") {
      if (matching.length === 0) return null;
      var s = 0;
      for (var a = 0; a < matching.length; a++) {
        var sv = effectiveValue(matching[a]);
        if (sv === null) return null;
        s += Number(sv) || 0;
      }
      return s;
    }
    if (rule === "product") {
      if (matching.length === 0) return null;
      var p = 1;
      for (var b = 0; b < matching.length; b++) {
        var pv = effectiveValue(matching[b]);
        if (pv === null) return null;
        p *= Number(pv) || 1;
      }
      return p;
    }
    if (rule === "additiveMulti") {
      var adds = kids.filter(function (c) { return c.fmt === "+"; });
      if (adds.length === 0) return null;
      var am = 1;
      for (var x = 0; x < adds.length; x++) {
        var av = effectiveValue(adds[x]);
        if (av === null) return null;
        am *= 1 + (Number(av) || 0) / 100;
      }
      return am;
    }
    if (rule === "productAB") {
      // base × multi: pick the single "x" child and ONE non-"x" child
      // whose product (currently) matches the parent — that pair stays
      // the canonical formula even as values change.
      var multis = kids.filter(function (c) { return c.fmt === "x"; });
      var bases = kids.filter(function (c) { return c.fmt !== "x"; });
      if (multis.length !== 1 || bases.length === 0) return null;
      // Strictly require BOTH the multi and the canonical base to be
      // filled before publishing a product. The canonical base picks
      // by ref-product match, same as before.
      var mVal = effectiveValue(multis[0]);
      if (mVal === null) return null;
      var m = Number(mVal) || 1;
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
      var bvAB = effectiveValue(canon);
      if (bvAB === null) return null;
      return (Number(bvAB) || 0) * m;
    }
    return null;
  }
  function hasFormula(src) { return !!src.agg; }
  // Direct lookup table for the rendered max inputs — populated during
  // renderRow, cleared at the start of every render(). Replaces the
  // CSS.escape-based querySelector which was silently missing parents
  // whose canonical IDs contain spaces / slashes / emojis (Score, in
  // particular: clearing it wasn't waking up the friend contribution
  // formula).
  var inputBySourceId = new Map();

  /** Full re-render with focus + selection preserved. Used by the
   *  typing path so each keystroke can refresh every formula ancestor
   *  even if some live outside the currently-rendered tree, without
   *  yanking the caret away mid-edit. */
  function renderKeepFocus() {
    var active = document.activeElement;
    var activeId = active && active.getAttribute &&
      active.getAttribute("data-source-id");
    var selS = null, selE = null;
    if (activeId) {
      try { selS = active.selectionStart; selE = active.selectionEnd; }
      catch (e) { /* type=number throws — ignore */ }
    }
    render();
    if (activeId) {
      var el = inputBySourceId.get(activeId);
      if (el) {
        el.focus();
        try { if (selS !== null) el.setSelectionRange(selS, selE); }
        catch (e) { /* same — type=number; that's fine */ }
      }
    }
  }
  function propagateUp(childId) {
    // Strategy: deepest-first walk over EVERY formula-tagged source.
    // Cheaper than threading through the ancestor chain and avoids any
    // subtle "I missed a parent" bugs. ~58 evaluations × O(children)
    // each, all native math, runs in single-digit ms even on the heavy
    // tree-flatten subtrees.
    void childId;
    recomputeAllFormulas();
    // Push every patched value into its rendered input (if any).
    eachSource(function (s) {
      if (!hasFormula(s)) return;
      var input = inputBySourceId.get(s.id);
      if (!input) return;
      var e = values[s.id];
      if (e && typeof e.maxValue === "number") {
        input.value = String(e.maxValue);
        input.classList.add("filled", "agg-driven");
        var r = input.closest(".row");
        if (r) { r.classList.add("has-max"); r.classList.remove("no-data"); }
      } else {
        input.value = "";
        input.classList.remove("filled", "agg-driven");
        var r2 = input.closest(".row");
        if (r2) { r2.classList.remove("has-max"); r2.classList.add("no-data"); }
      }
    });
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
    // Belt-and-braces: re-run every formula before we paint. The
    // various action handlers already do this through propagateUp,
    // but doing it here too guarantees the DOM always reflects the
    // current state of children — no "stale parent value" possible.
    recomputeAllFormulas();
    // Wipe the input-element index — every render() rebuilds the DOM,
    // so old references would point to detached nodes.
    inputBySourceId.clear();
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
    var isFormula = hasFormula(src);
    // Formula rows: pull the displayed Max LIVE from the children via
    // effectiveValue. Manual rows: read from the stored maxValue.
    var liveMax = isFormula ? effectiveValue(src) : (typeof entry.maxValue === "number" ? entry.maxValue : null);
    var hasMax = (typeof liveMax === "number") && Number.isFinite(liveMax);
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
    // Wrap name + formula-info subtitle so they stack vertically when
    // the row has a note (formula description, owner char, etc.).
    var nameBox = document.createElement("div");
    nameBox.className = "name-with-note";
    var nameText = document.createElement("span");
    nameText.className = "name-text";
    nameText.textContent = effectiveName(src);
    nameText.title = src.name;
    nameBox.appendChild(nameText);
    if (src.note) {
      var noteEl = document.createElement("span");
      noteEl.className = "formula-note";
      noteEl.textContent = src.note;
      noteEl.title = src.note;
      nameBox.appendChild(noteEl);
    }
    nameWrap.appendChild(nameBox);

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
    // Formula rows: liveMax IS the formula result (recomputed every
    // render from current children). Manual rows: the stored max.
    maxInput.value = hasMax ? String(liveMax) : "";
    if (hasMax) {
      maxInput.classList.add("filled");
      if (isFormula) maxInput.classList.add("agg-driven");
    }
    // Index the live input so propagateUp can find it instantly,
    // regardless of how exotic the source id is (slashes / emojis /
    // spaces / parens all live in catalog ids).
    inputBySourceId.set(src.id, maxInput);
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
      // Hard re-render with focus + caret preserved — guarantees every
      // formula ancestor reflects the new value even if the Map-based
      // direct update missed it for some reason (collapsed branch,
      // stale element reference, etc.).
      renderKeepFocus();
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
        render();
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
        // Full re-render as the safety net — propagateUp's Map lookup
        // covers the common case, but a hard render guarantees every
        // ancestor (including ones not currently in the visible tree)
        // refreshes from storage. The user explicitly reported the
        // propagation wasn't firing for Clean, so we err on the side
        // of correctness for this click path.
        render();
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
        render();
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
  var hideNotesChk = document.getElementById("hide-notes");
  hideNotesChk.checked = hideNotes;
  hideNotesChk.onchange = function () {
    hideNotes = hideNotesChk.checked;
    saveStr(STORAGE.hideNotes, hideNotes ? "1" : "0");
    document.body.classList.toggle("notes-hidden", hideNotes);
  };
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
      // Research mode: catalog overrides have to match the gen-time snapshot
      // shape, where every talent's Base Level / Points Invested defaults
      // to the Max Book Lv Cap.
      var r = DR.computeCorganDropRate(saveCache, charIdx, mapIdx, { useMaxResearchBaseLevel: true });
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

  // Pre-fill maxValue for autoFill entries (Points Invested rows) so
  // the min() cascade in Base Level resolves on page open instead of
  // staying null. Only seeds when no user value is stored yet — never
  // overwrites a user edit.
  function seedAutoFillEntries() {
    eachSource(function (s) {
      if (!s.autoFill) return;
      var e = values[s.id];
      if (e && typeof e.maxValue === "number") return; // user already set
      patchEntry(s.id, { maxValue: Number(s.refValue) || 0 });
    });
  }
  seedAutoFillEntries();

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
