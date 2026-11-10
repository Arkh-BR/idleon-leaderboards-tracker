// The Drop Rate V1 tracker: the /drop-rate page's { tree, total } on lib/game. The number is the V2 page's, the one TotalStats("Drop_Rarity") call (the "Drop Rate" line of Player Info), so the tree
// is read out of that call's trace with the V2 adapter's source terms (trackers/dropRate.ts); only the rows are V1's, names and order, because the page's snapshots and Compare are keyed by them
// (lib/dropRate/v1Sources.ts, lib/dropRate/systems.ts, flattenTree's paths).
//
// N.js @4190432 outside a dungeon: base = 1 + 1.4 x LUK curve + Σ/100, under 5 the chip, then +2 bun_v, × Workbench, +0.3, × bun_p and the multipliers; on map 216 in cavern 17 the Cove replaces the
// total. V1 never had a Cove, so it is a root row only while it applies, and nothing else moves.
//
// The guard rebuilds the total from the rows' own numbers: a total off by more than float order (`near`) throws TreeTotalMismatch, so the page reads "incomplete" instead of a tree that does not add
// up. `runtime:` / `assumed:` notes stay under the root (Ruling L, trackers/page.ts): their rows are V1's, so nothing else can carry them.
import { categorizePoolItems, decorateSystem } from "@/lib/dropRate/systems";
import { EXPLAINERS } from "@/lib/dropRate/explain";
import type { ArkhNode } from "@/lib/dropRate/node";
import { V1_COVE, V1_SOURCES, type V1Pool, type V1Source } from "@/lib/dropRate/v1Sources";
import { assumed, makeCtx, seedBlock, type Ctx, type TraceNode } from "../ctx";
import { chipBonuses } from "../njs/chipBonuses";
import { TotalStats } from "../njs/TotalStats";
import { inCove, opsOf, SOURCES } from "./dropRate";
import { finishTree, migratedNote, near, stateOf } from "./page";

const sum = (rows: ArkhNode[]) => rows.reduce((a, r) => a + r.val, 0);
const ofRow = <T,>(v: T | ((c: Ctx, val: number) => T), c: Ctx, val: number): T => (typeof v === "function" ? (v as (c: Ctx, val: number) => T)(c, val) : v);

/** One of Post-Processing's first three steps, as a bucket of its own (the chain after them is grouped by system). */
const stepBucket = (row: ArkhNode, name: string, fmt: "+" | "x", note: string): ArkhNode => ({ name, val: row.val || (fmt === "x" ? 1 : 0), fmt, note, children: [row] });

export type V1Rows = Record<V1Pool, ArkhNode[]>;

/** V1_SOURCES by pool, in order: position i of a pool's rows is its i-th source. */
const BY_POOL = V1_SOURCES.reduce((m, s) => (m[s.pool].push(s), m), { base: [], addMain: [], addLUK2: [], chipDR: [], postFlat: [], postMult: [] } as Record<V1Pool, V1Source[]>);

/**
 * Every V1 source's row, by pool in V1_SOURCES' order, read out of a traced Ctx's one TotalStats("Drop_Rarity") call. None is dropped (`shown` is v1Assemble's), so a row's position is its source for every character: the
 * Observed Max collector takes the best per position. A save the game would not have the keys for (Ruling E) throws what the engine throws.
 */
export function v1Rows(ctx: Ctx): { rows: V1Rows; total: number; cove?: number; root: TraceNode; call: TraceNode } {
  if (!ctx.trace) throw new Error("Drop Rate: the tree is read from the trace, and this Ctx has none");
  const total = TotalStats(ctx, "Drop_Rarity"); // the one call
  const root = ctx.trace;
  const call = root.children.find((n) => n.block === "TotalStats" && "Drop_Rarity" === n.args[0] && "cached" !== n.note);
  if (!call) throw new Error('Drop Rate: no TotalStats("Drop_Rarity") call in the trace');
  const plain: Ctx = { ...ctx, trace: null }; // the rows' own reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const rowOf = (s: V1Source): ArkhNode => {
    const kept: ArkhNode[] = [];
    const ops = opsOf(call, used, kept, plain, s.id);
    const val = typeof s.from === "string" ? SOURCES[s.from].of(ops) : s.from(ops);
    const fmt = ofRow(s.fmt, plain, val);
    const note = ofRow(s.note, plain, val);
    // the block's calls are not V1's rows: only a read that failed stays, saying so
    const children = [...(EXPLAINERS[s.id]?.(plain, val) ?? []), ...kept.filter((k) => k.note?.startsWith("not read"))];
    return { name: ofRow(s.name, plain, val), val, ...(fmt ? { fmt } : {}), ...(note ? { note } : {}), ...(children.length ? { children } : {}) };
  };
  const rows = Object.fromEntries(Object.keys(BY_POOL).map((p) => [p, [] as ArkhNode[]])) as V1Rows;
  for (const s of V1_SOURCES) rows[s.pool].push(rowOf(s));
  const cove = inCove(plain) ? SOURCES.cove.of(opsOf(call, used, [], plain, "cove")) : undefined;
  return { rows, total, cove, root, call };
}

/** The page's rows under the root from v1Rows' rows (or the collector's best per position): `shown` drops a row, then V1's buckets. `expected`: the total the rows rebuild, the Cove's while it applies. */
export function v1Assemble(all: V1Rows, cove?: number): { children: ArkhNode[]; expected: number } {
  const pools = Object.fromEntries(Object.entries(all).map(([p, rows]) => [p, rows.filter((r, i) => BY_POOL[p as V1Pool][i]?.shown?.(r.val) ?? true)])) as V1Rows;
  const luk = pools.base[0];
  const lukC = 1.4 * luk.val;
  const addSum = sum(pools.addMain) + sum(pools.addLUK2);
  const chip = pools.chipDR[0];
  const before = 1 + lukC + addSum / 100;
  const chipApplied = before < 5 && 0 < chip.val ? Math.min(5 - before, chip.val / 100) : 0;
  const base = before + chipApplied;

  const [bunV, ola232] = pools.postFlat;
  const [workbench, ...chain] = pools.postMult;
  let rebuilt = (base + bunV.val) * workbench.val + ola232.val;
  for (const r of chain) rebuilt *= r.fmt === "x" ? r.val : 1 + r.val / 100;

  const children: ArkhNode[] = [
    {
      name: "LUK Scaling",
      val: lukC,
      fmt: "raw",
      defaultClosed: true,
      note: "Total LUK → curve → × 1.4 = added to the Total Sum (outside the /100)",
      children: [...(luk.children ?? []), { name: "× 1.4", val: lukC, fmt: "raw", note: "1.4 × lukScaling" }],
    },
    { name: "Additive Pool", val: addSum, fmt: "+", note: "Σ all additive sources (formerly Main + LUK2 pools)", children: categorizePoolItems([...pools.addMain, ...pools.addLUK2], "additive", "merge") },
    { name: "Total Sum", val: before, fmt: "raw", note: `1 + 1.4·LUK + addSum/100  =  1 + ${lukC.toFixed(2)} + ${addSum.toFixed(1)} / 100  — N.js formula` },
    { name: "Chip Cap-Break", val: chipApplied, fmt: "+", defaultClosed: true, note: 0 < chipApplied ? "Applies when base < 5×" : "Inactive (base ≥ 5× or no chip)", children: [chip] },
    {
      name: "Post-Processing",
      val: 0 < base ? rebuilt / base : 1,
      fmt: "x",
      note: "Applied to Total Sum (and Chip Cap-Break if active)",
      children: [
        stepBucket(bunV, decorateSystem("Bundles"), "+", "Added to Total Sum"),
        stepBucket(workbench, decorateSystem("Talents"), "x", "Multiplies the running total"),
        stepBucket(ola232, decorateSystem("Sneaking Mastery"), "+", "Added to the running total"),
        ...categorizePoolItems(chain, "multiplicative", "merge"),
      ],
    },
    ...(cove === undefined ? [] : [{ name: V1_COVE, val: cove, fmt: "raw" as const, note: "Map 216 (The Hole), cavern 17 (The Cove): replaces the whole Drop Rate" }]),
  ];
  return { children, expected: cove ?? rebuilt };
}

/** The page's result for the character and map of a traced Ctx (nothing computed on it yet). */
export function dropRateV1Tree(ctx: Ctx): { tree: ArkhNode; total: number } {
  const { rows, total, cove, root, call } = v1Rows(ctx);
  const { children, expected } = v1Assemble(rows, cove);
  const migrated = migratedNote(ctx.state);
  const tree: ArkhNode = { name: "Drop Rate", val: total, fmt: "x", ...(migrated ? { note: migrated } : {}), children };
  // every flagged call goes under the root: V1's rows have no place for a call's own note (the empty set: `used` here only says which call a source took)
  return finishTree(tree, total, { totalFromFlat: () => expected }, root, call, new Set(), [call], () => near(expected, total));
}

/** The page's Silkrode Motherboard toggle (undefined: what the character's chips say). The seed is on this Ctx's memo, so it moves this compute only, and the root says so when it differs from the save. */
export function forceTrophyChip(ctx: Ctx, on: boolean | undefined): void {
  if (on === undefined || on === 0 < chipBonuses(ctx, "troph")) return;
  const value = on ? 1 : 0;
  assumed(ctx, "Silkrode Motherboard (Chip 16)", `the page's chip toggle forces it ${on ? "on" : "off"}: this character ${on ? "does not have" : "has"} it in its lab`, value, 'chipBonuses("troph") @5163283, read by GalleryBonusMulti @11137789 and the trophy slot of TotalStats');
  seedBlock(ctx, "chipBonuses", ["troph"], value);
}

/** `computeArkhDropRate`'s counterpart: the envelope of a save, a character index and the map to compute on. */
export function computeGameDropRateV1(save: unknown, charIdx: number, mapIdx: number, opts?: { chipGalleryActive?: boolean }): { tree: ArkhNode; total: number } {
  return dropRateV1Tree(v1Ctx(save, charIdx, mapIdx, opts));
}

/** The traced Ctx computeGameDropRateV1 reads (v1Rows' input for the Observed Max collector). */
export function v1Ctx(save: unknown, charIdx: number, mapIdx: number, opts?: { chipGalleryActive?: boolean }): Ctx {
  const ctx = makeCtx(stateOf(save), { player: charIdx, map: mapIdx, trace: true });
  forceTrophyChip(ctx, opts?.chipGalleryActive);
  return ctx;
}
