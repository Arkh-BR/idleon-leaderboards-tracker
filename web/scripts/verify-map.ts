// verify-map: how far do we trust each N.js block a lib/game tracker reaches? From web/:
//
//   npx tsx scripts/verify-map.ts <StatKey> [--reading <id>]
//
// Runs the stat's tracker on a reading's save (the given one, else the latest with a value for
// that stat) with the trace on, and writes reports/verify-<stat>.md: per block, validated (by which
// readings), derived or runtime, and the N.js calls its direct children lack. A node with no N.js
// slice to compare is marked "unchecked (no N.js slice)" and counted in the header: it is not clean.
// A block counts as validated when a reading has a value (main stat or extra) for a stat whose trace
// holds it, so every other stat with a tracker is traced too (on its latest reading whose private
// save is present). A (reading, stat) pair in the reading's knownGaps does not validate.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { njsFunction, njsSlice } from "@/lib/diagnose/njsCalls";
import { notPorted, traceNodes, verifyMap, verifyReport, verifySummary } from "@/lib/diagnose/verifyMap";
import { makeCtx, type TraceNode } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { loadReadings, readingSave, readingValues, READINGS_DIR } from "@/lib/readings/registry";
import type { Reading, StatKey } from "@/lib/readings/types";
import { loadNjs } from "@/scripts/njs-calls";

const USAGE = "usage: npx tsx scripts/verify-map.ts <StatKey> [--reading <id>]   (e.g. damage)";

function main(argv: string[]) {
  const args = [...argv];
  const i = args.indexOf("--reading");
  const readingId = i < 0 ? undefined : args.splice(i, 2)[1];
  if ((i >= 0 && !readingId) || args.length !== 1) throw new Error(USAGE);
  const stat = args[0] as StatKey;
  if (!Object.hasOwn(TRACKERS, stat)) throw new Error(`No lib/game tracker for ${stat} yet`);

  const all = loadReadings();
  const hasValue = (r: Reading, s: StatKey) => readingValues(r).some((v) => v.stat === s);
  const latestFirst = (s: StatKey) =>
    all.filter((r) => hasValue(r, s)).sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
  const chosen = readingId ? all.find((r) => r.id === readingId) : latestFirst(stat)[0];
  if (!chosen) throw new Error(readingId ? `no reading ${readingId} in fixtures/readings.json` : `no reading with a ${stat} value in fixtures/readings.json`);
  if (!hasValue(chosen, stat)) throw new Error(`reading ${chosen.id} has no ${stat} value (it has ${readingValues(chosen).map((v) => v.stat).join(", ")})`);

  /** The stat's tracker trace on the reading's save; null when the private save is absent. */
  const traceOf = (r: Reading, s: StatKey): TraceNode | null => {
    const save = readingSave(r);
    if (!save) return null;
    const ctx = makeCtx(buildGameState(save as GameEnvelope), { player: r.charIdx, map: r.map, trace: true });
    TRACKERS[s]!(ctx);
    return ctx.trace;
  };

  const trace = traceOf(chosen, stat);
  if (!trace) throw new Error(`save of reading ${chosen.id} is missing (${join(READINGS_DIR, chosen.saveFile)})`);
  const blocksOf = new Map<StatKey, Set<string>>([[stat, new Set(traceNodes(trace).map((n) => n.block))]]);
  for (const s of Object.keys(TRACKERS) as StatKey[]) {
    if (blocksOf.has(s)) continue;
    for (const r of latestFirst(s)) {
      const t = traceOf(r, s);
      if (t) {
        blocksOf.set(s, new Set(traceNodes(t).map((n) => n.block)));
        break;
      }
    }
  }
  const rows = verifyMap(trace, all, (b) => [...blocksOf].filter(([, blocks]) => blocks.has(b)).map(([s]) => s));

  // The node's slice of the live N.js (njsSlice); a node without one is reported as unchecked.
  const norm = loadNjs();
  const fns = new Map<string, ReturnType<typeof njsFunction>>();
  const njsTextOf = (n: TraceNode): string | undefined => {
    if (!fns.has(n.block)) fns.set(n.block, njsFunction(norm, n.block));
    const fn = fns.get(n.block);
    return fn && njsSlice(fn, n.args);
  };
  const ported = notPorted(trace, njsTextOf);

  const md = verifyReport({ stat, reading: chosen, traced: [...blocksOf.keys()] }, rows, ported);
  const out = `reports/verify-${stat}.md`; // relative to web/, the cwd of `npx tsx`
  mkdirSync("reports", { recursive: true });
  writeFileSync(out, md);
  console.log(`${out}: ${verifySummary(rows, ported)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
