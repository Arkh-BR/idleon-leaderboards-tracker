// characterize: do the old and the new engine of a stat agree on every real save? From web/:
//
//   npx tsx scripts/characterize.ts <stat>        (stats: artifactFind)
//
// Runs both engines on every character of every save envelope (golden/.cache + saves-fresh), writes
// reports/characterize-<stat>.md, and exits 1 when the spec's switch criteria are not met: a row that is
// neither in the oracle's KNOWN_ARKH_DIFFS, a pre-migration refusal (MissingSaveKey below CSver 34.05, for one of the
// keys the stat may be refused for) nor an error lib/arkh has too. The time of the two engines is reported, not judged:
// the user accepted lib/game's cost on 2026-11-04 (warm-switch parity, spec risk "Desempenho").
// The known-diff list lives in a test-support file: this is a script, not app code, so it imports it from there.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
// first: the oracle sets the `window` shim lib/arkh reads
import { KNOWN_ARKH_DIFFS, goldenSaves } from "@/__tests__/lib/game/support/arkhOracle";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { characterize, classify, type Engine, type Row, type Verdict } from "@/lib/diagnose/characterize";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { computeGameArtifactFind } from "@/lib/game/trackers/artifactFind";

/** The keys a pre-migration save may be refused for, per stat: any other missing key on an old save is a gap, not age. */
const ARTIFACT_FIND_REFUSABLE = (key: string) => /^(Tome rows |(Spelunk|Research|Sushi|Holes)(\[|$))/.test(key);

const ENGINES: Record<string, { arkh: Engine; game: Engine; refusable?: (key: string) => boolean }> = {
  artifactFind: { arkh: computeArkhArtifactFind, game: computeGameArtifactFind, refusable: ARTIFACT_FIND_REFUSABLE },
};

const USAGE = `usage: npx tsx scripts/characterize.ts <stat>   (${Object.keys(ENGINES).join(", ")})`;

const num = (x: number | undefined) => (x === undefined ? "—" : String(x));

function main(argv: string[]): number {
  if (argv.length !== 1) throw new Error(USAGE);
  const stat = argv[0];
  const engines = ENGINES[stat];
  if (!engines) throw new Error(`no engines registered for ${stat}\n${USAGE}`);

  const csvers = new Map<string, number | undefined>();
  const csverOf = (path: string) => {
    if (!csvers.has(path)) csvers.set(path, JSON.parse(readFileSync(path, "utf8")).data?.CSver);
    return csvers.get(path);
  };
  const saves = goldenSaves();
  if (saves.length === 0) throw new Error("no real saves on this machine (scripts/updater/golden/.cache, scripts/updater/.cache/saves-fresh)");

  // One call of each engine first (on a current save: an old one is refused before the engine does any work): lazy
  // module setup is not the engine's cost.
  const warm = saves.find((p) => csverOf(p) === CURRENT_CSVER) ?? saves[0];
  for (const engine of [engines.arkh, engines.game]) {
    try {
      engine(JSON.parse(readFileSync(warm, "utf8")), 0);
    } catch {
      // a refusal still loaded the engine
    }
  }

  const { rows, pairs, msA, msB } = characterize(saves, engines.arkh, engines.game);

  const verdicts = rows.map((r) => ({ r, v: classify(r, KNOWN_ARKH_DIFFS, csverOf(r.save), engines.refusable) }));
  const of = (v: Verdict) => verdicts.filter((x) => x.v === v).map((x) => x.r);
  const known = of("known");
  const refused = of("refused");
  const shared = of("shared");
  const unexplained = of("unexplained");

  const at = (r: Row) => `${basename(r.save)}#${r.ci}`;
  const out: string[] = [];
  const h = (s: string) => out.push("", `## ${s}`, "");
  out.push(`# characterize ${stat}`, "", `a = lib/arkh (computeArkhArtifactFind), b = lib/game (computeGameArtifactFind). ${saves.length} saves, ${pairs} (save, character) pairs.`);
  h("Criteria");
  out.push(
    `- known diffs: ${known.length} pairs (each in KNOWN_ARKH_DIFFS with its N.js evidence)`,
    `- refused: ${refused.length} pairs in ${new Set(refused.map((r) => r.save)).size} saves (lib/game MissingSaveKey on a save below CSver 34.05, for a key the stat may be refused for, Ruling E)`,
    `- shared errors (both engines throw): ${shared.length}`,
    `- unexplained: ${unexplained.length}${unexplained.length ? "  <- BLOCKS THE SWITCH" : ""}`,
    `- time over all pairs: lib/arkh ${msA.toFixed(0)} ms, lib/game ${msB.toFixed(0)} ms (game/arkh = ${(msB / msA).toFixed(2)}; informational, the cost was accepted on 2026-11-04)`,
    `- matching pairs (relative difference <= 1e-9): ${pairs - rows.length}`
  );
  if (unexplained.length) {
    h("Unexplained");
    for (const r of unexplained) out.push(`- ${at(r)}: ${r.error ?? `arkh ${num(r.a)}, game ${num(r.b)}, rel ${r.rel?.toExponential(3)}`}`);
  }
  h("Known diffs");
  for (const r of known) {
    const sources = KNOWN_ARKH_DIFFS.filter((d) => d.save === basename(r.save) && (d.ci ?? r.ci) === r.ci).map((d) => d.source);
    out.push(`- ${at(r)}: arkh ${num(r.a)}, game ${num(r.b)}, rel ${r.rel?.toExponential(3)}; sources ${sources.join(", ")}`);
  }
  out.push("", "Evidence per entry (KNOWN_ARKH_DIFFS):", "");
  const why = new Map<string, string[]>();
  for (const d of KNOWN_ARKH_DIFFS) why.set(d.why, [...(why.get(d.why) ?? []), `${d.save}${d.ci === undefined ? "" : `#${d.ci}`} ${d.source}`]);
  for (const [text, who] of why) out.push(`- ${who.join("; ")}`, `  - ${text}`);
  h("Refused (pre-migration saves)");
  const bySave = new Map<string, Row[]>();
  for (const r of refused) bySave.set(r.save, [...(bySave.get(r.save) ?? []), r]);
  for (const [save, rs] of bySave) {
    const keys = [...new Set(rs.map((r) => r.errB!.message.split(/[:\n]/)[0]))];
    out.push(`- ${basename(save)} (CSver ${csverOf(save)}): ${rs.length} pairs, ${rs[0].errB!.name}: ${keys.join(" | ")}`);
  }
  if (shared.length) {
    h("Shared errors");
    for (const r of shared) out.push(`- ${at(r)}: ${r.error}`);
  }

  const file = `reports/characterize-${stat}.md`; // relative to web/, the cwd of `npx tsx`
  mkdirSync("reports", { recursive: true });
  writeFileSync(file, out.join("\n") + "\n");
  console.log(
    `${file}: ${pairs} pairs, ${known.length} known, ${refused.length} refused (${bySave.size} saves), ${shared.length} shared, ${unexplained.length} unexplained; ` +
      `lib/arkh ${msA.toFixed(0)} ms, lib/game ${msB.toFixed(0)} ms (x${(msB / msA).toFixed(2)})`
  );
  return unexplained.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
