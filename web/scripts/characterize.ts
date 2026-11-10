// characterize: what does a stat's lib/game tracker give on every real save? From web/:
//
//   npx tsx scripts/characterize.ts <stat> [--map <n>] [--recent <n>]        (stats: artifactFind, damage, afkGains, expMulti, dropRateV2, coinMulti, multikill)
//
// Runs the tracker on every character of every save envelope (golden/.cache + saves-fresh, or the <n> newest with --recent), on map <n>
// (default 0; a stat with no map ignores it), and writes reports/characterize-<stat>[-<n>][-recent<n>].md: per pair the lib/game total, the
// trace's flagged leaves (`runtime:` / `assumed:`, values the save cannot give) and the refusals. Exits 1 when a pair is an error: anything
// thrown that is not a pre-migration refusal (MissingSaveKey below CSver 34.05, for a key the stat may be refused for, Ruling E).
// Whether a total is the game's is not this tool's question (lib/arkh, its old oracle, is gone): the in-game readings answer it
// (__tests__/readings/readings.save.test.ts, scripts/verify-map.ts).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AFK_REFUSABLE, ARTIFACT_FIND_REFUSABLE, COIN_REFUSABLE, DAMAGE_REFUSABLE, DR_REFUSABLE, EXP_REFUSABLE, MULTIKILL_REFUSABLE, characterize, classify, newestSaves, realSaves, type Engine, type Row, type Verdict } from "@/lib/diagnose/characterize";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { computeGameAfkGains } from "@/lib/game/trackers/afkGains";
import { computeGameArtifactFind } from "@/lib/game/trackers/artifactFind";
import { computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";
import { computeGameDamage } from "@/lib/game/trackers/damage";
import { computeGameDropRate } from "@/lib/game/trackers/dropRate";
import { computeGameExpMulti } from "@/lib/game/trackers/expMulti";
import { computeGameMultikill } from "@/lib/game/trackers/multikill";

/** Each stat's tracker on map `map`, the name the report prints, and the keys it may be refused for. */
const ENGINES: Record<string, (map: number) => { game: Engine; name: string; refusable: (key: string) => boolean }> = {
  artifactFind: () => ({ game: computeGameArtifactFind, name: "computeGameArtifactFind", refusable: ARTIFACT_FIND_REFUSABLE }),
  damage: (map) => ({ game: (save, ci) => computeGameDamage(save, ci, map), name: `computeGameDamage on map ${map}`, refusable: DAMAGE_REFUSABLE }),
  afkGains: (map) => ({ game: (save, ci) => computeGameAfkGains(save, ci, map), name: `computeGameAfkGains on map ${map}`, refusable: AFK_REFUSABLE }),
  expMulti: (map) => ({ game: (save, ci) => computeGameExpMulti(save, ci, map), name: `computeGameExpMulti on map ${map}`, refusable: EXP_REFUSABLE }),
  dropRateV2: (map) => ({ game: (save, ci) => computeGameDropRate(save, ci, map), name: `computeGameDropRate on map ${map}`, refusable: DR_REFUSABLE }),
  // Map 33 (and 3, 34, 35) has no monster: Coin and Multikill refuse there (InvalidSaveValue, Rulings TT and AAA), which is no age refusal, so it is an error on purpose.
  coinMulti: (map) => ({ game: (save, ci) => computeGameCoinMulti(save, ci, map), name: `computeGameCoinMulti on map ${map}`, refusable: COIN_REFUSABLE }),
  multikill: (map) => ({ game: (save, ci) => computeGameMultikill(save, ci, map), name: `computeGameMultikill on map ${map}`, refusable: MULTIKILL_REFUSABLE }),
};

const USAGE = `usage: npx tsx scripts/characterize.ts <stat> [--map <n>] [--recent <n>]   (${Object.keys(ENGINES).join(", ")})`;

function main(argv: string[]): number {
  const args = [...argv];
  const i = args.indexOf("--map");
  const mapArg = i < 0 ? undefined : args.splice(i, 2)[1];
  const r = args.indexOf("--recent");
  const recentArg = r < 0 ? undefined : args.splice(r, 2)[1];
  if ((i >= 0 && !/^\d+$/.test(mapArg ?? "")) || (r >= 0 && !/^[1-9]\d*$/.test(recentArg ?? "")) || args.length !== 1) throw new Error(USAGE);
  const map = Number(mapArg ?? 0);
  const stat = args[0];
  if (!ENGINES[stat]) throw new Error(`no tracker registered for ${stat}\n${USAGE}`);
  const engine = ENGINES[stat](map);

  const csvers = new Map<string, number | undefined>();
  const csverOf = (path: string) => {
    if (!csvers.has(path)) csvers.set(path, JSON.parse(readFileSync(path, "utf8")).data?.CSver);
    return csvers.get(path);
  };
  let saves = realSaves(resolve(".")); // web/, the cwd of `npx tsx`
  // --recent n: only the n most recently modified saves (the newest data)
  if (recentArg !== undefined) saves = newestSaves(saves, Number(recentArg));
  if (saves.length === 0) throw new Error("no real saves on this machine (scripts/updater/golden/.cache, scripts/updater/.cache/saves-fresh)");

  // One call first (on a current save: an old one is refused before the engine does any work): lazy module setup is not the engine's cost.
  const warm = saves.find((p) => csverOf(p) === CURRENT_CSVER) ?? saves[0];
  try {
    engine.game(JSON.parse(readFileSync(warm, "utf8")), 0);
  } catch {
    // a refusal still loaded the engine
  }

  const { rows, ms } = characterize(saves, engine.game);
  const verdicts = rows.map((row) => ({ row, v: classify(row, csverOf(row.save), engine.refusable) }));
  const of = (v: Verdict) => verdicts.filter((x) => x.v === v).map((x) => x.row);
  const [clean, flagged, refused, errors] = (["clean", "flagged", "refused", "error"] as const).map(of);

  const at = (row: Row) => `${basename(row.save)}#${row.ci}`;
  const out: string[] = [];
  const h = (s: string) => out.push("", `## ${s}`, "");
  out.push(`# characterize ${stat}`, "", `lib/game (${engine.name}). ${saves.length} saves, ${rows.length} (save, character) pairs, ${ms.toFixed(0)} ms in the engine.`);
  h("Summary");
  out.push(
    `- clean: ${clean.length} pairs (a total, no flagged leaf)`,
    `- flagged: ${flagged.length} pairs (a total that counts a value the save cannot give: runtime / assumed leaves below)`,
    `- refused: ${refused.length} pairs in ${new Set(refused.map((x) => x.save)).size} saves (MissingSaveKey on a save below CSver ${CURRENT_CSVER}, for a key the stat may be refused for, Ruling E)`,
    `- errors: ${errors.length}${errors.length ? "  <- look at these" : ""}`
  );
  if (errors.length) {
    h("Errors");
    for (const row of errors) out.push(`- ${at(row)}: ${row.err ? `${row.err.name}: ${row.err.message}` : `total ${row.total}`}`);
  }
  // a flagged leaf is the same read wherever the trace reaches it (the Tome score under every stat that reads it): listed once per
  // pair with how many times the tree has it, and its first path
  const leaves = (row: Row) => {
    const m = new Map<string, { n: number; path: string }>();
    for (const f of row.flagged) {
      const k = `${f.leaf}: ${f.note}`;
      m.set(k, { n: (m.get(k)?.n ?? 0) + 1, path: m.get(k)?.path ?? f.path });
    }
    return m;
  };
  h("Flagged leaves over all pairs");
  const pairsOf = new Map<string, number>();
  for (const row of flagged) for (const k of leaves(row).keys()) pairsOf.set(k, (pairsOf.get(k) ?? 0) + 1);
  for (const [k, n] of [...pairsOf].sort((a, b) => b[1] - a[1])) out.push(`- ${n === flagged.length ? "every flagged pair" : `${n} pairs`}: ${k}`);
  h("Pairs");
  out.push("The total of each pair, and its flagged leaves that not every flagged pair has (those are listed once, above).", "");
  for (const { row, v } of verdicts) {
    if (v === "refused" || v === "error") continue;
    out.push(`- ${at(row)}: ${row.total}`);
    for (const [k, { n, path }] of leaves(row)) if (pairsOf.get(k) !== flagged.length) out.push(`  - ${k}${n > 1 ? ` (x${n})` : ""}`, `    - at ${path}`);
  }
  h("Refused (pre-migration saves)");
  const bySave = new Map<string, Row[]>();
  for (const row of refused) bySave.set(row.save, [...(bySave.get(row.save) ?? []), row]);
  for (const [save, rs] of bySave) {
    const keys = [...new Set(rs.map((x) => x.err!.message.split(/[:\n]/)[0]))];
    out.push(`- ${basename(save)} (CSver ${csverOf(save)}): ${rs.length} pairs, ${rs[0].err!.name}: ${keys.join(" | ")}`);
  }

  const file = `reports/characterize-${stat}${mapArg === undefined ? "" : `-${map}`}${recentArg === undefined ? "" : `-recent${recentArg}`}.md`; // relative to web/
  mkdirSync("reports", { recursive: true });
  writeFileSync(file, out.join("\n") + "\n");
  console.log(`${file}: ${rows.length} pairs, ${clean.length} clean, ${flagged.length} flagged, ${refused.length} refused (${bySave.size} saves), ${errors.length} errors; ${ms.toFixed(0)} ms`);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
