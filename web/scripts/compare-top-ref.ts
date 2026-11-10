// TEMPORARY (deleted with lib/arkh): the Observed Max collectors, old (lib/arkh) against new (lib/game), on local saves only.
// Per stat: each family's ceiling, the paths only one side has, the values that differ, and ms per character. --maps: the map lib/arkh's
// pickers and gamePools' bestMap give each character.
//
// Run (from web/):  npx tsx scripts/compare-top-ref.ts [stat ...] [--maps] --saves-dir scripts/updater/golden/.cache --newest 5
// The stats are the keys of STATS; none given = all of them.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { collectReference, type StatCollectorConfig } from "./_shared/topStatCollector";
import { hackedSaveReason } from "./_shared/hackers";
import { bestMap, MAP_PICKS } from "./_shared/gamePools";
import { newestSaves } from "../lib/diagnose/characterize";
import { listCharacters } from "../lib/dropRate/extract";
import { bestDrMapIdx } from "../lib/arkh/stats/systems/dr2/maps";
import { bestAfkMapIdx } from "../lib/arkh/computeAfk";
import { bestExpMapIdx, combineExpPools, computeArkhExpPools } from "../lib/arkh/computeExp";
import { combineCoinPools, computeArkhCoinPools } from "../lib/arkh/computeCoin";
import { combineDropRateV2Pools, computeArkhDropRateV2Pools } from "../lib/arkh/computeDropRateV2";
import { combineArtifactPools, computeArkhArtifactPools } from "../lib/arkh/computeArtifactFind";
import { COIN_COLLECTOR } from "./update-top-coin";
import { EXP_COLLECTOR } from "./update-top-exp";
import { DR2_COLLECTOR } from "./update-top-dr2";
import { ARTIFACT_COLLECTOR } from "./update-top-artifact";
import { combineDamagePools, computeArkhDamagePools } from "../lib/arkh/computeDamage";
import { combineAfkPools, computeArkhAfkPools } from "../lib/arkh/computeAfk";
import { combineMultikillPools, computeArkhMultikillPools } from "../lib/arkh/computeMultikill";
import { DMG_COLLECTOR_MAP } from "../lib/damage/layers";
import { MK_COLLECTOR_MAP } from "../lib/multikill/layers";
import { DMG_COLLECTOR } from "./update-top-damage";
import { AFK_COLLECTOR } from "./update-top-afk";
import { MK_COLLECTOR } from "./update-top-multikill";

/** The old Damage collector's pools: lib/arkh's, with the Reliquarium forced off (val 0, "Carried" 0). */
function oldDamagePools(save: unknown, ci: number) {
  const pools = computeArkhDamagePools(save, ci, DMG_COLLECTOR_MAP);
  pools.l2relic = { items: pools.l2relic.items.map((it) => ({ ...it, val: 0, children: it.children?.map((c) => (c.name === "Carried" ? { ...c, val: 0 } : c)) })) };
  return pools;
}

/** stat -> its collector config on each engine: the new one is the collector's own, the old one the same config with lib/arkh's pools and combine
 *  (what the update-top-* scripts ran before). Task 5 adds DR V1. */
const STATS: Record<string, { old: StatCollectorConfig; neu: StatCollectorConfig }> = {
  coin: { neu: COIN_COLLECTOR, old: { ...COIN_COLLECTOR, computePools: (s, ci) => computeArkhCoinPools(s, ci, 301), combine: combineCoinPools } },
  exp: { neu: EXP_COLLECTOR, old: { ...EXP_COLLECTOR, computePools: (s, ci) => computeArkhExpPools(s, ci, bestExpMapIdx(s, ci)), combine: combineExpPools } },
  dr2: { neu: DR2_COLLECTOR, old: { ...DR2_COLLECTOR, computePools: (s, ci) => computeArkhDropRateV2Pools(s, ci, bestDrMapIdx(s, ci)), combine: combineDropRateV2Pools } },
  artifact: { neu: ARTIFACT_COLLECTOR, old: { ...ARTIFACT_COLLECTOR, computePools: computeArkhArtifactPools, combine: combineArtifactPools } },
  damage: { neu: DMG_COLLECTOR, old: { ...DMG_COLLECTOR, computePools: oldDamagePools, combine: combineDamagePools } },
  afk: { neu: AFK_COLLECTOR, old: { ...AFK_COLLECTOR, computePools: (s, ci) => computeArkhAfkPools(s, ci, bestAfkMapIdx(s, ci)), combine: combineAfkPools } },
  multikill: { neu: MK_COLLECTOR, old: { ...MK_COLLECTOR, computePools: (s, ci) => computeArkhMultikillPools(s, ci, MK_COLLECTOR_MAP), combine: combineMultikillPools } },
};

const argv = process.argv.slice(2);
const flag = (f: string) => {
  const k = argv.indexOf(f);
  return k >= 0 ? argv[k + 1] : undefined;
};
const dir = flag("--saves-dir");
const newest = Number(flag("--newest"));
if (!dir || !(newest > 0)) {
  console.error("× needs --saves-dir <dir> --newest <N> (local saves only)");
  process.exit(1);
}
const values = new Set([dir, flag("--newest")]);
const asked = argv.filter((a) => !a.startsWith("--") && !values.has(a));
const unknown = asked.filter((s) => !STATS[s]);
if (unknown.length) {
  console.error(`× unknown stat(s): ${unknown.join(", ")} (known: ${Object.keys(STATS).join(", ") || "none yet"})`);
  process.exit(1);
}

const files = newestSaves(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)), newest);
const saves = files
  .map((f) => ({ name: basename(f, ".json"), save: JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) }))
  .filter(({ save }) => save?.data && Array.isArray(save.charNames) && !hackedSaveReason(save));
console.log(`→ ${saves.length} saves: ${saves.map((s) => s.name).join(", ")}`);
const chars = saves.reduce((n, s) => n + listCharacters(s.save).length, 0);

if (argv.includes("--maps")) {
  const pickers = {
    dr2: bestDrMapIdx,
    afk: bestAfkMapIdx,
    exp: bestExpMapIdx,
  } satisfies Record<keyof typeof MAP_PICKS, (save: any, ci: number) => number>;
  for (const [stat, arkh] of Object.entries(pickers) as [keyof typeof MAP_PICKS, (s: unknown, ci: number) => number][]) {
    const { score, accept } = MAP_PICKS[stat];
    let ms = 0;
    for (const { name, save } of saves) {
      const row: string[] = [];
      for (const ch of listCharacters(save)) {
        const old = arkh(save, ch.charIndex);
        const t0 = performance.now();
        let neu: number | string;
        try {
          neu = bestMap(save, ch.charIndex, score, accept);
        } catch (e) {
          neu = `refused (${e instanceof Error ? e.message : e})`;
        }
        ms += performance.now() - t0;
        row.push(old === neu ? `${ch.charName} ${neu}` : `${ch.charName} ${old} ≠ ${neu}`);
      }
      console.log(`  ${stat} ${name}: ${row.join(" · ")}`);
    }
    console.log(`  ${stat} bestMap: ${(ms / chars).toFixed(0)} ms/character`);
  }
}

const flatOf = (r: ReturnType<typeof collectReference>, f: string) => (r.ref.familyFlats as Record<string, Record<string, number>>)[f] ?? {};
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);

const stats = asked.length ? asked : Object.keys(STATS);
if (!stats.length && !argv.includes("--maps")) console.log("  no stat configured yet (Tasks 3-5 add them to STATS)");
for (const stat of stats) {
  const { old, neu } = STATS[stat];
  const run = (cfg: StatCollectorConfig) => {
    const t0 = performance.now();
    const r = collectReference(cfg, saves);
    return { r, msPerChar: (performance.now() - t0) / chars };
  };
  const a = run(old);
  const b = run(neu);
  console.log(`\n== ${stat}: old ${a.msPerChar.toFixed(0)} ms/character, new ${b.msPerChar.toFixed(0)} ms/character · refused old ${a.r.refusedChars.length}, new ${b.r.refusedChars.length}`);
  for (const l of b.r.log.filter((l) => l.includes("refused"))) console.log(`  new${l}`);
  const families = [...new Set([...Object.keys(a.r.ref.familyFlats), ...Object.keys(b.r.ref.familyFlats)])].sort();
  for (const f of families) {
    const fa = flatOf(a.r, f);
    const fb = flatOf(b.r, f);
    console.log(`  ${f.padEnd(8)} ceiling old ${(fa[old.root] ?? NaN).toExponential(4)} · new ${(fb[neu.root] ?? NaN).toExponential(4)}`);
    const onlyOld = Object.keys(fa).filter((p) => !(p in fb));
    const onlyNew = Object.keys(fb).filter((p) => !(p in fa));
    const differ = Object.keys(fa).filter((p) => p in fb && rel(fa[p], fb[p]) > 1e-9);
    for (const p of onlyOld) console.log(`    only old: ${p} = ${fa[p]}`);
    for (const p of onlyNew) console.log(`    only new: ${p} = ${fb[p]}`);
    for (const p of differ) console.log(`    differs:  ${p}: old ${fa[p]} · new ${fb[p]}`);
  }
}
