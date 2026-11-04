// Verification map: for each N.js block a tracker reaches, how far do we trust it?
//   validated: a reading with a value for a stat whose trace contains the block exists (readings =
//              which); a (reading, stat) pair in the reading's knownGaps does not count
//   runtime:   every appearance is a value the save cannot give (counted as 0)
//   derived:   neither; only ported from the N.js text
// "Not ported" is a separate question, a block whose N.js calls the trace lacks (notPorted). A node
// with no N.js slice to compare is "unchecked", reported as such, never as a clean block.

import { callDiff, callKey, njsCalls, traceCalls, type Call } from "@/lib/diagnose/njsCalls";
import type { TraceNode } from "@/lib/game/trace";
import { readingValues } from "@/lib/readings/registry";
import type { Reading, StatKey } from "@/lib/readings/types";

export type VerifyRow =
  | { block: string; status: "validated"; readings: string[] }
  | { block: string; status: "derived" | "runtime" };

const isRuntime = (n: TraceNode) => n.note?.startsWith("runtime:") === true;

/** Every node under `trace` (not the root), depth-first in call order. */
export const traceNodes = (trace: TraceNode): TraceNode[] => trace.children.flatMap((n) => [n, ...traceNodes(n)]);

/** One row per block, in order of first appearance. Runtime wins only if every appearance is runtime. */
export function verifyMap(
  trace: TraceNode,
  readings: Reading[],
  readingStatOf: (block: string) => StatKey[]
): VerifyRow[] {
  const allRuntime = new Map<string, boolean>(); // insertion order = first appearance
  for (const n of traceNodes(trace)) allRuntime.set(n.block, (allRuntime.get(n.block) ?? true) && isRuntime(n));
  return [...allRuntime].map(([block, onlyRuntime]): VerifyRow => {
    if (onlyRuntime) return { block, status: "runtime" };
    const stats = readingStatOf(block);
    const covers = (r: Reading) => readingValues(r).some((v) => stats.includes(v.stat) && !r.knownGaps?.includes(v.stat));
    const ids = readings.filter(covers).map((r) => r.id);
    return ids.length ? { block, status: "validated", readings: ids } : { block, status: "derived" };
  });
}

/** A node's entry in notPorted: the game calls its children lack, or `unchecked` (no N.js slice, `missing` empty). */
export type NotPorted = { block: string; missing: Call[]; unchecked?: true };

/**
 * The calls the game's formula makes that a node's own children do not ("not ported"). For each
 * call that ran (not runtime, not cached) with N.js text, the text's calls against its DIRECT
 * children (a cached child counts, a runtime one does not). One entry per block+args; nothing
 * for a node that misses nothing. `njsTextOf` is the node's slice of the N.js, if it has one; a
 * node without one has nothing to compare and comes back as `unchecked: true`, so it cannot pass
 * for a checked-and-clean node.
 */
export function notPorted(trace: TraceNode, njsTextOf: (node: TraceNode) => string | undefined): NotPorted[] {
  const seen = new Set<string>();
  const out: NotPorted[] = [];
  for (const n of traceNodes(trace)) {
    if (isRuntime(n) || n.note === "cached") continue;
    const key = n.block + JSON.stringify(n.args);
    if (seen.has(key)) continue;
    seen.add(key);
    const text = njsTextOf(n);
    if (text === undefined) {
      out.push({ block: n.block, missing: [], unchecked: true });
      continue;
    }
    const direct = traceCalls({ ...n, children: n.children.map((c) => ({ ...c, children: [] })) });
    const { missing } = callDiff(njsCalls(text), direct);
    if (missing.length) out.push({ block: n.block, missing });
  }
  return out;
}

const UNCHECKED = "unchecked (no N.js slice)";

/** The report's counts line (also what the CLI prints). */
export function verifySummary(rows: VerifyRow[], ported: NotPorted[]): string {
  const count = (status: string) => rows.filter((r) => r.status === status).length;
  const withMissing = new Set(ported.filter((e) => e.missing.length).map((e) => e.block)).size;
  const unchecked = ported.filter((e) => e.unchecked).length;
  return `${rows.length} blocks: ${count("validated")} validated, ${count("derived")} derived, ${count("runtime")} runtime; ${withMissing} with N.js calls missing; ${unchecked} nodes unchecked (no N.js slice).`;
}

/** The markdown report: one row per block; a block with an unchecked node says so in its last cell. */
export function verifyReport(
  head: { stat: StatKey; reading: Pick<Reading, "id" | "charName" | "map">; traced: StatKey[] },
  rows: VerifyRow[],
  ported: NotPorted[]
): string {
  const cells = new Map<string, Set<string>>();
  for (const e of ported) {
    const set = cells.get(e.block) ?? cells.set(e.block, new Set()).get(e.block)!;
    for (const c of e.missing) set.add(callKey(c));
    if (e.unchecked) set.add(UNCHECKED);
  }
  const cell = (s: string) => s.replaceAll("|", "\\|");
  return [
    `# Verification map: ${head.stat}`,
    "",
    `Traced on reading \`${head.reading.id}\` (${head.reading.charName}, map ${head.reading.map}). Stats traced for coverage: ${head.traced.join(", ")}.`,
    verifySummary(rows, ported),
    "",
    "| block | status | readings | missing N.js calls |",
    "|---|---|---|---|",
    ...rows.map(
      (r) => `| ${r.block} | ${r.status} | ${r.status === "validated" ? r.readings.join(", ") : ""} | ${cell([...(cells.get(r.block) ?? [])].join(", "))} |`
    ),
    "",
  ].join("\n");
}
