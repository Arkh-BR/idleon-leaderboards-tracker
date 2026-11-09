// The Drop Rate V1 tree on lib/game against lib/arkh's, path by path (a support module: vitest only collects *.test.ts). flattenTree's paths are the page's contract: snapshots and the Compare are keyed by them.
//
// lib/arkh is the comparison target only: where it is wrong the tree follows N.js and the path goes in V1_KNOWN with the evidence.
import "./arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { type ArkhNode } from "@/lib/dropRate/node";
import { nodePath } from "@/lib/dropRate/treeFlatten";
import { V1_COVE, V1_SOURCES, type V1Pool } from "@/lib/dropRate/v1Sources";
import { computeGameDropRateV1 } from "@/lib/game/trackers/dropRateV1";

export type V1Diff = { missing: string[]; extra: string[]; value: string[]; meta: string[] };

/** The V1 sources whose rows are built (lib/dropRate/explain): each family's task adds its ids. */
const BUILT: readonly string[] = ["talent279", "talent24", "talent655", "talent239", "workbench", "etc2", "etc91", "etc99", "etc102", "efaunt",
  "rank9", "cropSC7", "exotic59", "hole46", "hole82", "meas15", "monument", "caveDR", "grimoire44", "spelunk50", "legend1", "emperor11", "grid173", "glimbo", "minehead0", "menagerie24", "pristine3", "rog", "vial",
  "card10", "card101", "mini5a", "anni4", "luckEvent", "comp3", "comp50", "comp22", "comp158", "comp111", "comp132", "comp132x", "comp168x", "comp26", "comp160", "comp50x", "goldFood", "stampA38", "bubble", "starSigns", "prayer7", "shiny0", "sigil11", "cardSet5", "cardSet6",
  "lukScaling", "shrine4", "arcade27", "guild10", "postOffice11", "win9", "tome2", "dream10", "ach377", "ach381", "owl4", "vote27", "vault18", "friend3", "chip", "bunV", "ola232", "bunP", "arcane", "statue1", "family32", "tome7", "cloud69"];
/** V1 source ids whose rows aren't built yet: differences below them are ignored. Task 7 asserts it is empty. */
export const PENDING = new Set(V1_SOURCES.map((s) => s.id).filter((id) => !BUILT.includes(id)));

/** A path where lib/arkh is wrong, with its N.js evidence. The value of the buckets and totals above such a path differs with it. */
export const V1_KNOWN: { path: RegExp; why: string; /** false: only a row differs, the aggregates above it do not move */ moves?: false }[] = [
  {
    path: /^Drop Rate \/ LUK Scaling(?: \/ .*)?$/, // the row and its children (Total LUK, the curve and its note, × 1.4): all of them move with the LUK
    why: "N.js TotalStats(\"Drop_Rarity\") starts from a live `x._customBlock_TotalStats(\"LUK\")` for DropRateLUK (@4190488); lib/arkh's lukScaling (stats/systems/common/stats.ts readRawLuk) reads PVStatList_<ci>[3], the TotalStats(\"LUK\") the game wrote at save time (@15076361), stale on any save older than the last stat change. dropRateV1.test.ts proves it: with lib/game's LUK in PVStatList_<ci>[3], lib/arkh's row is the game's",
  },
  {
    path: / \/ Family Guy Multi \(×\) — potential buff( \/ Super Levels)?$/,
    why: "N.js TalentCalc(-3) reads GetTalentNumber(1,144) @4498035, whose AllTalentLV @4085148 gives the super levels only when Spelunk[20 + player + 12 x preset] lists 144; lib/arkh forces the super levels on (talent.ts forceSuperActive), for characters that do not have it (Family Guy Multi 1.3556 vs the game's 1.3484 on ARKHE's characters without 144 listed), so its row is above the game's and has a Super Levels row the game has no levels for",
  },
  {
    path: / \/ All Multi \/ Dream Challenge (?:71|72|76) \(Cloud Bonus (?:71|72|76)\)$/,
    why: "N.js ResearchStuff(\"Grid_Bonus_Allmulti\") @11179175 adds Dreamstuff(\"CloudBonus\", 71), 72 and 76 (1 each while the weekly boss d_<n> is undefeated) to the multi every grid square gets; lib/arkh's gridAllMulti (systems/w4/lab.ts) adds them to the value but lists no row for them, so the All Multi row of squares 173 and 168 has these children and the rows sum to its value",
  },
  {
    path: / \/ (?:Drop Rate Summoning Win \(Summoning 9\) \/ Winner Multi|Winner Multi \(combined\)) \/ Bundle ban_i$/,
    why: "N.js WinBonus @10927394 (@10930921, the branch of the bonuses not 19 or 20..33) adds 50*Thingies(\"Have_ban_i\") (@10978279, BundlesReceived.ban_i == 1) to the winners' boosts; lib/arkh's _winBonusParts (w6/summoning.ts) adds banI to winnerSum but lists no row for it (Winner Multi (combined) under Winner Bonus 19 is the same), so Winner Multi's rows do not sum to its value. The game's tree has the row, only while the bundle is owned (the value above it is the same)",
    moves: false,
  },
];

const hits = new Set<RegExp>();
/** The V1_KNOWN rows no comparison needed so far: a stale row is one lib/arkh no longer gets wrong. */
export const knownUnused = (): string[] => V1_KNOWN.filter((k) => !hits.has(k.path)).map((k) => k.path.source);

type Row = { path: string; node: ArkhNode; trail: readonly string[] };
function rowsOf(root: ArkhNode): Map<string, Row> {
  const out = new Map<string, Row>();
  const walk = (node: ArkhNode, parent: string, trail: readonly string[], siblings: ArkhNode[], i: number) => {
    const path = nodePath(parent, node, siblings, i);
    const here = [...trail, node.name];
    out.set(path, { path, node, trail: here });
    (node.children ?? []).forEach((k, j, all) => walk(k, path, here, all, j));
  };
  walk(root, "", [], [root], 0);
  return out;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

const ALT_NAMES: Record<string, string[]> = { glimbo: ["Glimbo DR Multi", "Glimbo Insider Trading Secrets (Grid 168)"] };
const POOLS_AT: Record<string, readonly V1Pool[]> = { "Additive Pool": ["addMain", "addLUK2"], "Post-Processing": ["postFlat", "postMult"], "Chip Cap-Break": ["chipDR"] };
const rowId = (top: string, name: string): string | undefined =>
  V1_SOURCES.find((s) => POOLS_AT[top]?.includes(s.pool) && (s.name === name || ALT_NAMES[s.id]?.includes(name)))?.id;

/** The path is below a source still pending. */
function belowPending(r: Row): boolean {
  const [, top] = r.trail;
  if (top === "LUK Scaling") return 2 < r.trail.length && PENDING.has("lukScaling");
  if (top === "Chip Cap-Break") return 3 < r.trail.length && PENDING.has("chip");
  if (r.trail.length <= 4) return false;
  const id = rowId(top, r.trail[3]);
  return id !== undefined && PENDING.has(id);
}

/** A root row of lib/game's own that lib/arkh has no such thing as: the `runtime:` / `assumed:` statements (Ruling L). */
const flags = (n: ArkhNode): boolean => /^(runtime|assumed):/.test(n.note ?? "") || (n.children ?? []).some(flags);

/** The aggregates a different LUK Scaling moves: the root and what depends on the base. The Additive Pool does not depend on LUK, its rows are compared one by one. */
const AGGREGATE = (path: string) => /^Drop Rate$|^Drop Rate \/ (Total Sum|Chip Cap-Break|Post-Processing)$/.test(path);

export function compareV1(save: unknown, ci: number, map: number, opts: { chipGalleryActive?: boolean } = {}): V1Diff {
  const mine = computeGameDropRateV1(save, ci, map, opts).tree;
  const theirs = computeArkhDropRate(structuredClone(save), ci, map, opts).tree;
  const a = rowsOf(mine);
  const b = rowsOf(theirs);
  // the Cove: the game's total replaces lib/arkh's, which has no Cove (N.js @4196607), and the row says so; nothing else changes
  let aggregatesMove = mine.children!.some((c) => c.name === V1_COVE);
  const explained = (path: string): boolean => {
    const k = V1_KNOWN.find((row) => row.path.test(path));
    if (k) {
      hits.add(k.path);
      if (false !== k.moves) aggregatesMove = true;
    }
    return !!k;
  };
  const ownRows = new Set(mine.children!.filter((c) => !["LUK Scaling", "Additive Pool", "Total Sum", "Chip Cap-Break", "Post-Processing"].includes(c.name) && flags(c)).map((c) => c.name));
  const out: V1Diff = { missing: [], extra: [], value: [], meta: [] };

  for (const [path, r] of b) if (!a.has(path) && !belowPending(r) && !explained(path)) out.missing.push(path);
  for (const [path, r] of a) if (!b.has(path) && !belowPending(r) && !ownRows.has(r.trail[1]) && r.trail[1] !== V1_COVE && !explained(path)) out.extra.push(path);
  for (const [path, r] of a) {
    const t = b.get(path);
    if (!t || belowPending(r)) continue;
    if (!near(r.node.val, t.node.val) && !explained(path)) out.value.push(`${path}: game ${r.node.val}, arkh ${t.node.val}`);
    if (r.node.fmt !== t.node.fmt && !explained(path)) out.meta.push(`${path}: fmt ${r.node.fmt} vs ${t.node.fmt}`);
    if (r.node.note !== t.node.note && !explained(path)) out.meta.push(`${path}: note ${JSON.stringify(r.node.note)} vs ${JSON.stringify(t.node.note)}`);
  }
  const notAggregate = (line: string) => !AGGREGATE(line.slice(0, line.indexOf(":")));
  if (aggregatesMove) {
    out.value = out.value.filter(notAggregate);
    out.meta = out.meta.filter(notAggregate);
  }
  return out;
}
