// Verification map: for each N.js block a tracker reaches, how far do we trust it?
//   validated: a reading of a stat whose trace contains the block exists (readings = which)
//   runtime:   every appearance is a value the save cannot give (counted as 0)
//   derived:   neither; only ported from the N.js text
// "Not ported" is a separate question, a block whose N.js calls the trace lacks (notPorted).

import { callDiff, njsCalls, traceCalls, type Call } from "@/lib/diagnose/njsCalls";
import type { TraceNode } from "@/lib/game/trace";
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
    const ids = readings.filter((r) => stats.includes(r.stat)).map((r) => r.id);
    return ids.length ? { block, status: "validated", readings: ids } : { block, status: "derived" };
  });
}

/**
 * The calls the game's formula makes that a node's own children do not ("not ported"). For each
 * call that ran (not runtime, not cached) with N.js text, the text's calls against its DIRECT
 * children (a cached child counts, a runtime one does not). One entry per block+args; nothing
 * for a node that misses nothing. `njsTextOf` is the node's slice of the N.js, if it has one.
 */
export function notPorted(
  trace: TraceNode,
  njsTextOf: (node: TraceNode) => string | undefined
): { block: string; missing: Call[] }[] {
  const seen = new Set<string>();
  const out: { block: string; missing: Call[] }[] = [];
  for (const n of traceNodes(trace)) {
    if (isRuntime(n) || n.note === "cached") continue;
    const key = n.block + JSON.stringify(n.args);
    if (seen.has(key)) continue;
    const text = njsTextOf(n);
    if (text === undefined) continue;
    seen.add(key);
    const direct = traceCalls({ ...n, children: n.children.map((c) => ({ ...c, children: [] })) });
    const { missing } = callDiff(njsCalls(text), direct);
    if (missing.length) out.push({ block: n.block, missing });
  }
  return out;
}
