// verify-map: how far do we trust each N.js block a lib/game tracker reaches? From web/:
//
//   npx tsx scripts/verify-map.ts <StatKey> [--reading <id>]
//
// Runs the stat's tracker on a reading's save (the given one, else the latest of that stat) with
// the trace on, and writes reports/verify-<stat>.md: per block, validated (by which readings),
// derived or runtime, and the N.js calls its direct children lack. A block counts as validated
// when a reading exists for a stat whose trace holds it, so every other stat with a tracker is
// traced too (on its latest reading whose private save is present).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { callKey, njsFunction, njsNamedBlock, njsNumericBranch } from "@/lib/diagnose/njsCalls";
import { notPorted, traceNodes, verifyMap } from "@/lib/diagnose/verifyMap";
import { makeCtx, type TraceNode } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { loadReadings, readingSave, READINGS_DIR } from "@/lib/readings/registry";
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
  const latestFirst = (s: StatKey) =>
    all.filter((r) => r.stat === s).sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
  const chosen = readingId ? all.find((r) => r.id === readingId) : latestFirst(stat)[0];
  if (!chosen) throw new Error(readingId ? `no reading ${readingId} in fixtures/readings.json` : `no reading of ${stat} in fixtures/readings.json`);
  if (chosen.stat !== stat) throw new Error(`reading ${chosen.id} is a ${chosen.stat} reading, not ${stat}`);

  /** The tracker's trace on the reading's save; null when the private save is absent. */
  const traceOf = (r: Reading): TraceNode | null => {
    const save = readingSave(r);
    if (!save) return null;
    const ctx = makeCtx(buildGameState(save as GameEnvelope), { player: r.charIdx, map: r.map, trace: true });
    TRACKERS[r.stat]!(ctx);
    return ctx.trace;
  };

  const trace = traceOf(chosen);
  if (!trace) throw new Error(`save of reading ${chosen.id} is missing (${join(READINGS_DIR, chosen.saveFile)})`);
  const blocksOf = new Map<StatKey, Set<string>>([[stat, new Set(traceNodes(trace).map((n) => n.block))]]);
  for (const s of Object.keys(TRACKERS) as StatKey[]) {
    if (blocksOf.has(s)) continue;
    for (const r of latestFirst(s)) {
      const t = traceOf(r);
      if (t) {
        blocksOf.set(s, new Set(traceNodes(t).map((n) => n.block)));
        break;
      }
    }
  }
  const rows = verifyMap(trace, all, (b) => [...blocksOf].filter(([, blocks]) => blocks.has(b)).map(([s]) => s));

  // The node's slice of the live N.js: its function, then the named block / numeric branch its arguments pick.
  const norm = loadNjs();
  const fns = new Map<string, ReturnType<typeof njsFunction>>();
  const njsTextOf = (n: TraceNode): string | undefined => {
    if (!fns.has(n.block)) fns.set(n.block, njsFunction(norm, n.block));
    const fn = fns.get(n.block);
    if (!fn) return undefined;
    const [a0, a1] = n.args;
    if (typeof a0 !== "string") return fn.body;
    const named = njsNamedBlock(fn.body, a0);
    return named !== undefined && typeof a1 === "number" ? njsNumericBranch(named, a1, fn.params) : named;
  };
  const missing = new Map<string, Set<string>>();
  for (const e of notPorted(trace, njsTextOf)) {
    const set = missing.get(e.block) ?? missing.set(e.block, new Set()).get(e.block)!;
    for (const c of e.missing) set.add(callKey(c));
  }

  const count = (status: string) => rows.filter((r) => r.status === status).length;
  const cell = (s: string) => s.replaceAll("|", "\\|");
  const md = [
    `# Verification map: ${stat}`,
    "",
    `Traced on reading \`${chosen.id}\` (${chosen.charName}, map ${chosen.map}). Stats traced for coverage: ${[...blocksOf.keys()].join(", ")}.`,
    `${rows.length} blocks: ${count("validated")} validated, ${count("derived")} derived, ${count("runtime")} runtime; ${missing.size} with N.js calls missing.`,
    "",
    "| block | status | readings | missing N.js calls |",
    "|---|---|---|---|",
    ...rows.map(
      (r) => `| ${r.block} | ${r.status} | ${r.status === "validated" ? r.readings.join(", ") : ""} | ${cell([...(missing.get(r.block) ?? [])].join(", "))} |`
    ),
    "",
  ].join("\n");
  const out = `reports/verify-${stat}.md`; // relative to web/, the cwd of `npx tsx`
  mkdirSync("reports", { recursive: true });
  writeFileSync(out, md);
  console.log(`${out}: ${rows.length} blocks (${count("validated")} validated, ${count("derived")} derived, ${count("runtime")} runtime), ${missing.size} with calls missing`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
