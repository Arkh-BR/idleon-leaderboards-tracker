// characterize: do the old and the new engine of a stat agree on every real save? From web/:
//
//   npx tsx scripts/characterize.ts <stat> [--map <n>]        (stats: artifactFind, damage, afkGains, expMulti, dropRateV2, coinMulti, multikill)
//
// Runs both engines on every character of every save envelope (golden/.cache + saves-fresh), on map <n> (default 0; a stat with
// no map ignores it), writes reports/characterize-<stat>[-<n>].md, and exits 1 when the spec's switch criteria are not met: a row that is
// neither in the oracle's KNOWN_ARKH_DIFFS, a pre-migration refusal (MissingSaveKey below CSver 34.05, for one of the
// keys the stat may be refused for) nor an error lib/arkh has too. The time of the two engines is reported, not judged:
// the user accepted lib/game's cost on 2026-11-04 (warm-switch parity, spec risk "Desempenho").
// The known-diff list lives in a test-support file: this is a script, not app code, so it imports it from there.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
// first: the oracle sets the `window` shim lib/arkh reads
import { KNOWN_ARKH_DIFFS, goldenSaves } from "@/__tests__/lib/game/support/arkhOracle";
import { DAMAGE_STATS } from "@/__tests__/lib/game/support/damageProof";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { computeArkhDamage } from "@/lib/arkh/computeDamage";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { AFK_REFUSABLE, ARTIFACT_FIND_REFUSABLE, COIN_REFUSABLE, DAMAGE_REFUSABLE, DR_REFUSABLE, EXP_REFUSABLE, MULTIKILL_REFUSABLE, characterize, classify, type Engine, type Row, type Verdict } from "@/lib/diagnose/characterize";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { MapAFKtarget } from "@/lib/game/data";
import { keptTargetCloses } from "@/__tests__/lib/game/support/afkKept";
import { afkTarget } from "@/lib/game/afkTarget";
import { makeCtx } from "@/lib/game/ctx";
import { stateOf } from "@/lib/game/trackers/page";
import { computeGameAfkGains } from "@/lib/game/trackers/afkGains";
import { computeGameArtifactFind } from "@/lib/game/trackers/artifactFind";
import { computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";
import { computeGameDamage } from "@/lib/game/trackers/damage";
import { computeGameDropRate } from "@/lib/game/trackers/dropRate";
import { computeGameExpMulti } from "@/lib/game/trackers/expMulti";
import { computeGameMultikill } from "@/lib/game/trackers/multikill";

type KnownDiff = (typeof KNOWN_ARKH_DIFFS)[number];
/**
 * Each stat's two engines on map `map`, the names the report prints, the keys it may be refused for, and which KNOWN_ARKH_DIFFS entries
 * explain a differing total: the stat's own, and for Damage those of the stats its leaves read too (support/damageProof).
 */
const ENGINES: Record<string, (map: number) => { arkh: Engine; game: Engine; names: string; refusable: (key: string) => boolean; known: (d: KnownDiff) => boolean; explains?: (row: Row) => string | undefined }> = {
  artifactFind: () => ({
    arkh: computeArkhArtifactFind,
    game: computeGameArtifactFind,
    names: "a = lib/arkh (computeArkhArtifactFind), b = lib/game (computeGameArtifactFind)",
    refusable: ARTIFACT_FIND_REFUSABLE,
    known: (d) => (d.stat ?? "artifactFind") === "artifactFind",
  }),
  damage: (map) => ({
    arkh: (save, ci) => computeArkhDamage(save, ci, map),
    game: (save, ci) => computeGameDamage(save, ci, map),
    names: `a = lib/arkh (computeArkhDamage), b = lib/game (computeGameDamage), on map ${map}`,
    refusable: DAMAGE_REFUSABLE,
    known: (d) => d.stat === "damage" || DAMAGE_STATS.some((s) => s === d.stat),
  }),
  afkGains: (map) => ({
    arkh: (save, ci) => computeArkhAfkGains(save, ci, map),
    game: (save, ci) => computeGameAfkGains(save, ci, map),
    names: `a = lib/arkh (computeArkhAfkGains), b = lib/game (computeGameAfkGains), on map ${map}`,
    refusable: AFK_REFUSABLE,
    known: (d) => d.stat === "afk",
    // Ruling V: the AFK target follows the map unless the character's saved target is kept (the Cove's map 216 names Nothing, so a
    // character fighting elsewhere keeps its fight): lib/arkh uses the map's target, so the two differ by design. Explained only when
    // forcing the map's target makes lib/game equal lib/arkh (support/afkKept): a second difference stays unexplained.
    explains: (r) => {
      const env = JSON.parse(readFileSync(r.save, "utf8"));
      const t = afkTarget(makeCtx(stateOf(env), { player: r.ci, map }));
      if (t === String((MapAFKtarget as unknown as readonly unknown[])[map])) return undefined;
      return r.a !== undefined && keptTargetCloses(env, r.ci, map, r.a) ? `kept AFK target ${t} (Ruling V)` : undefined;
    },
  }),
  expMulti: (map) => ({
    arkh: (save, ci) => computeArkhExpMulti(save, ci, map),
    game: (save, ci) => computeGameExpMulti(save, ci, map),
    names: `a = lib/arkh (computeArkhExpMulti), b = lib/game (computeGameExpMulti), on map ${map}`,
    refusable: EXP_REFUSABLE,
    // a KNOWN row that names maps explains only those maps; EXP needs no kept-target waiver (Ruling II: the medallion follows ctx.map)
    known: (d) => d.stat === "exp" && (d.maps?.includes(map) ?? true),
  }),
  dropRateV2: (map) => ({
    arkh: (save, ci) => computeArkhDropRateV2(save, ci, map),
    game: (save, ci) => computeGameDropRate(save, ci, map),
    names: `a = lib/arkh (computeArkhDropRateV2), b = lib/game (computeGameDropRate), on map ${map}`,
    refusable: DR_REFUSABLE,
    // a KNOWN "dr" row is per source and names no map: it explains the pair on every map (the Cove only replaces the total). A glimboUnleveled
    // row explains no total (the group is max(1, ·), the total is the same), as in njs/dropRate.test.ts
    known: (d) => d.stat === "dr" && d.reason !== "glimboUnleveled",
  }),
  coinMulti: (map) => ({
    arkh: (save, ci) => computeArkhCoinMulti(save, ci, map),
    game: (save, ci) => computeGameCoinMulti(save, ci, map),
    names: `a = lib/arkh (computeArkhCoinMulti), b = lib/game (computeGameCoinMulti), on map ${map}`,
    refusable: COIN_REFUSABLE,
    // a KNOWN row that names maps explains only those maps (signsDmg: the multikill tier of talent 643). gfoodVote26 moves no Coin total
    // (njs/coinMulti.test.ts INERT: seeding it leaves all 308 pairs where they are), so it explains nothing. Map 33 has no monster: the
    // block refuses there (InvalidSaveValue, Ruling TT), which is no age refusal, so it stays unexplained on purpose.
    known: (d) => d.stat === "coin" && d.reason !== "gfoodVote26" && (d.maps?.includes(map) ?? true),
  }),
  multikill: (map) => ({
    arkh: (save, ci) => computeArkhMultikill(save, ci, map),
    game: (save, ci) => computeGameMultikill(save, ci, map),
    names: `a = lib/arkh (computeArkhMultikill), b = lib/game (computeGameMultikill), on map ${map}`,
    refusable: MULTIKILL_REFUSABLE,
    // The "mk" rows name their maps and characters; each moves the total on its own pair (njs/multikill.test.ts: inert {} on every map), so
    // each one explains a differing total. Map 33 (and 3, 34, 35) has no monster: the block refuses there (InvalidSaveValue, Ruling AAA),
    // which is no age refusal, so it stays unexplained on purpose.
    known: (d) => d.stat === "mk" && (d.maps?.includes(map) ?? true),
  }),
};

const USAGE = `usage: npx tsx scripts/characterize.ts <stat> [--map <n>]   (${Object.keys(ENGINES).join(", ")})`;

const num = (x: number | undefined) => (x === undefined ? "—" : String(x));

function main(argv: string[]): number {
  const args = [...argv];
  const i = args.indexOf("--map");
  const mapArg = i < 0 ? undefined : args.splice(i, 2)[1];
  if ((i >= 0 && !/^\d+$/.test(mapArg ?? "")) || args.length !== 1) throw new Error(USAGE);
  const map = Number(mapArg ?? 0);
  const stat = args[0];
  if (!ENGINES[stat]) throw new Error(`no engines registered for ${stat}\n${USAGE}`);
  const engines = ENGINES[stat](map);
  const knownDiffs = KNOWN_ARKH_DIFFS.filter(engines.known);

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

  const keptNote = new Map<Row, string>();
  const verdicts = rows.map((r) => {
    let v = classify(r, knownDiffs, csverOf(r.save), engines.refusable);
    const note = v === "unexplained" && !r.error ? engines.explains?.(r) : undefined;
    if (note) (v = "known"), keptNote.set(r, note);
    return { r, v };
  });
  const of = (v: Verdict) => verdicts.filter((x) => x.v === v).map((x) => x.r);
  const known = of("known");
  const refused = of("refused");
  const shared = of("shared");
  const unexplained = of("unexplained");

  const at = (r: Row) => `${basename(r.save)}#${r.ci}`;
  const out: string[] = [];
  const h = (s: string) => out.push("", `## ${s}`, "");
  out.push(`# characterize ${stat}`, "", `${engines.names}. ${saves.length} saves, ${pairs} (save, character) pairs.`);
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
    const sources = knownDiffs.filter((d) => d.save === basename(r.save) && (d.ci ?? r.ci) === r.ci).map((d) => (d.stat && d.stat !== stat ? `${d.stat}:${d.source}` : d.source));
    out.push(`- ${at(r)}: arkh ${num(r.a)}, game ${num(r.b)}, rel ${r.rel?.toExponential(3)}; sources ${[...sources, keptNote.get(r)].filter(Boolean).join(", ")}`);
  }
  out.push("", "Evidence per entry (KNOWN_ARKH_DIFFS):", "");
  const why = new Map<string, string[]>();
  for (const d of knownDiffs) why.set(d.why, [...(why.get(d.why) ?? []), `${d.save}${d.ci === undefined ? "" : `#${d.ci}`} ${d.source}`]);
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

  const file = `reports/characterize-${stat}${mapArg === undefined ? "" : `-${map}`}.md`; // relative to web/, the cwd of `npx tsx`
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
