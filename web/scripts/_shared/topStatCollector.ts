// Shared Observed Max collector for grouped stats (Coin Multi, EXP Multi…):
// every char of every candidate → the best value per source across the
// chars of the same CLASS FAMILY (beginner / warrior / archer / mage) → ONE
// combine() pass per family (the tree and the total come from the same math
// a real save uses) → per-class gating of class talents → a generated
// lib/<stat>/top*.ts (+ .meta.ts). Never publishes a shrunken reference.
//
// Why per family: stat-scaled sources (the Cash Bubbles use STR, AGI and WIS)
// mixed across classes made a reference no character can reach — the max STR
// of a warrior next to the max AGI of an archer and the max WIS of a mage.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Pool } from "../../lib/arkh/stats/tree-builder";
import type { ArkhNode } from "../../lib/arkh/node";
import { neutralValue, type StatGroup } from "../../lib/arkh/stats/defs/grouped";
import { flattenTree } from "../../lib/dropRate/treeFlatten";
import { listCharacters } from "../../lib/dropRate/extract";
import { gatherCandidates, fetchProfileSave } from "./itProfiles";
import { hackedSaveReason } from "./hackers";
import { allClassKeys, profileKey, type GatedTalent } from "./classGating";
import { classFamilyOfIndex, classFamilyOfKey, type ClassFamily } from "../../lib/talentsLevel/charClass";

export type StatCollectorConfig = {
  /** Stat name for logs and generated comments, e.g. "EXP Multi". */
  label: string;
  /** Leaderboard whose top 10 joins the candidates, e.g. "totalLevels". */
  focusBoard: string;
  root: string;
  groups: readonly StatGroup[];
  /** Pools for one character (the config picks the map). */
  computePools(save: any, charIdx: number): Record<string, Pool>;
  combine(pools: Record<string, Pool>): { tree: ArkhNode; total: number };
  gated: GatedTalent[];
  outputFile: string;
  metaFile: string;
  /** e.g. "TOP_EXP" → TOP_EXP_FLAT, TOP_EXP_GENERATED_AT, … */
  constPrefix: string;
  /** e.g. "topExpFlatForClass". */
  flatForClassFn: string;
  /** e.g. "scripts/update-top-exp.ts" (named in the generated comments). */
  scriptName: string;
};

type Best = { player: string; char: string; total: number };

export function mergeBest(acc: Record<string, Pool> | null, incoming: Record<string, Pool>): Record<string, Pool> {
  if (!acc) {
    const init: Record<string, Pool> = {};
    for (const pn in incoming) init[pn] = { items: [...incoming[pn].items], sum: 0, product: 0 };
    return init;
  }
  for (const pn in incoming) {
    const inc = incoming[pn];
    if (!acc[pn]) {
      acc[pn] = { items: [...inc.items], sum: 0, product: 0 };
      continue;
    }
    const cur = acc[pn];
    const n = Math.min(cur.items.length, inc.items.length);
    for (let i = 0; i < n; i++) {
      if ((Number(inc.items[i].val) || 0) > (Number(cur.items[i].val) || 0)) cur.items[i] = inc.items[i];
    }
  }
  return acc;
}

/** Best pools with some class talents set to their group's neutral value
 *  (0 in sums, 1 in products; the subtree goes too) → one combine() → flat. */
export function profileFlat(
  cfg: Pick<StatCollectorConfig, "root" | "groups" | "combine">,
  best: Record<string, Pool>,
  zeroTalentIds: number[]
): Record<string, number> {
  const clone: Record<string, Pool> = {};
  for (const pn in best) {
    const kind = cfg.groups.find((g) => g.key === pn)?.kind ?? "pct";
    const items = best[pn].items.map((it) =>
      zeroTalentIds.some((id) => it.name.endsWith(`(Talent ${id})`))
        ? { ...it, val: neutralValue(kind), children: undefined }
        : { ...it }
    );
    clone[pn] = { items, sum: 0, product: 0 };
  }
  const combined = cfg.combine(clone);
  const flat = flattenTree(combined.tree);
  flat[cfg.root] = combined.total;
  return flat;
}

/** Per family: base = every class-specific talent neutralised; each class
 *  profile adds back the talents its classes own, from that family's pools.
 *  The page merges {...familyBase, ...override}. */
export function buildFamilyReference(
  cfg: Pick<StatCollectorConfig, "root" | "groups" | "combine" | "gated">,
  bestByFamily: Partial<Record<ClassFamily, Record<string, Pool>>>
): {
  familyFlats: Partial<Record<ClassFamily, Record<string, number>>>;
  overrides: Record<string, Record<string, number>>;
  classProfile: Record<string, [ClassFamily, string]>;
  defaultFamily: ClassFamily;
  maxTotal: number;
} {
  const familyFlats: Partial<Record<ClassFamily, Record<string, number>>> = {};
  const overrides: Record<string, Record<string, number>> = {};
  const classProfile: Record<string, [ClassFamily, string]> = {};
  let maxTotal = 0;
  let defaultFamily: ClassFamily | null = null;
  for (const f of Object.keys(bestByFamily) as ClassFamily[]) {
    const flat = profileFlat(cfg, bestByFamily[f]!, cfg.gated.map((x) => x.id));
    familyFlats[f] = flat;
    if (defaultFamily === null || (flat[cfg.root] || 0) > (familyFlats[defaultFamily]![cfg.root] || 0)) defaultFamily = f;
    maxTotal = Math.max(maxTotal, flat[cfg.root] || 0);
  }
  for (const c of allClassKeys()) {
    const family = classFamilyOfKey(c);
    if (!family || !bestByFamily[family]) continue;
    const owned = cfg.gated.filter((x) => x.owners.has(c)).map((x) => x.id);
    const key = profileKey(owned);
    classProfile[c] = [family, key];
    const ok = `${family}:${key}`;
    if (key === "base" || overrides[ok]) continue;
    const pf = profileFlat(cfg, bestByFamily[family]!, cfg.gated.filter((x) => !owned.includes(x.id)).map((x) => x.id));
    const base = familyFlats[family]!;
    const d: Record<string, number> = {};
    for (const p in pf) if (base[p] !== pf[p]) d[p] = pf[p];
    overrides[ok] = d;
    maxTotal = Math.max(maxTotal, pf[cfg.root] || 0);
  }
  return { familyFlats, overrides, classProfile, defaultFamily: defaultFamily ?? "warrior", maxTotal };
}

export function renderTopFiles(
  cfg: Pick<StatCollectorConfig, "label" | "constPrefix" | "flatForClassFn" | "scriptName"> & { outputFile?: string },
  familyFlats: Partial<Record<ClassFamily, Record<string, number>>>,
  overrides: Record<string, Record<string, number>>,
  classProfile: Record<string, [ClassFamily, string]>,
  defaultFamily: ClassFamily,
  best: Best | null,
  hypotheticalTotal: number,
  scanned: number,
  now: string
): { data: string; meta: string } {
  const P = cfg.constPrefix;
  const dataName = cfg.outputFile ? basename(cfg.outputFile) : "the data file";
  const meta = [
    `// Top-player ${cfg.label} reference — metadata only (small, statically`,
    `// imported). The path table lives in ${dataName} and is lazy-loaded.`,
    `// Both auto-refreshed by ${cfg.scriptName}.`,
    "",
    `export const ${P}_GENERATED_AT = ${JSON.stringify(now)};`,
    `export const ${P}_PLAYERS_SCANNED = ${scanned};`,
    `// Best ${cfg.label} a single CLASS's best-of-each-source build reaches.`,
    `export const ${P}_HYPOTHETICAL_TOTAL = ${hypotheticalTotal};`,
    `// Highest ${cfg.label} of a single real player, for context.`,
    `export const ${P}_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
    "",
  ].join("\n");

  const obj = (m: Record<string, number>) => {
    const lines: string[] = ["{"];
    for (const path of Object.keys(m).sort()) {
      if (!Number.isFinite(m[path])) continue;
      lines.push(`    ${JSON.stringify(path)}: ${m[path]},`);
    }
    lines.push("  }");
    return lines.join("\n");
  };
  const entries = (m: Record<string, Record<string, number> | undefined>) =>
    Object.keys(m)
      .sort()
      .filter((k) => m[k])
      .map((k) => `  ${JSON.stringify(k)}: ${obj(m[k]!)},`)
      .join("\n");

  const data = [
    `// Top-player ${cfg.label} reference — per CLASS FAMILY (beginner / warrior /`,
    `// archer / mage), the best-of-each-source pools of that family's chars run`,
    `// through ONE combine() pass (the same math a real save uses), gated PER`,
    `// CLASS for the formula's class talents. Use ${cfg.flatForClassFn}(classKey).`,
    "// Large file: lazy-load it, don't import statically.",
    `// Generated ${now} · ${scanned} players. Refresh: ${cfg.scriptName}.`,
    "",
    "type FlatMap = Readonly<Record<string, number>>;",
    "",
    `export const ${P}_FAMILY_FLAT: Readonly<Record<string, FlatMap>> = {`,
    entries(familyFlats),
    "};",
    "",
    `// Keyed "family:profile" — the class talents a profile adds back.`,
    `export const ${P}_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {`,
    entries(overrides),
    "};",
    "",
    `// class key → [family, talent profile]`,
    `export const ${P}_CLASS_PROFILE: Readonly<Record<string, readonly [string, string]>> = ${JSON.stringify(classProfile)};`,
    "",
    `// Family used when no class is known (the highest-reaching one).`,
    `export const ${P}_DEFAULT_FAMILY = ${JSON.stringify(defaultFamily)};`,
    "",
    `/** The top ${cfg.label} reference for a class — its family's base merged with its profile. */`,
    `export function ${cfg.flatForClassFn}(classKey: string | null | undefined): FlatMap {`,
    `  const [family, profile] = (classKey && ${P}_CLASS_PROFILE[classKey]) || [${P}_DEFAULT_FAMILY, "base"];`,
    `  const base = ${P}_FAMILY_FLAT[family] ?? ${P}_FAMILY_FLAT[${P}_DEFAULT_FAMILY];`,
    `  const override = ${P}_PROFILE_OVERRIDES[\`\${family}:\${profile}\`];`,
    `  return override ? { ...base, ...override } : base;`,
    "}",
    "",
  ].join("\n");
  return { data, meta };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runTopCollector(cfg: StatCollectorConfig, argv: string[] = process.argv.slice(2)): Promise<void> {
  const THROTTLE_MS = argv.includes("--slow") ? 1500 : 400;
  const i = argv.indexOf("--limit");
  const LIMIT = i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
  // Never publish a shrunken reference (the Tome cron lesson); --limit is a smoke test.
  const MIN_PLAYERS = LIMIT ? 1 : 20;

  // --saves-dir <dir>: read already-downloaded profile envelopes (<name>.json)
  // instead of the network — same hacked-save guard as fetchProfileSave.
  const d = argv.indexOf("--saves-dir");
  const savesDir = d >= 0 ? argv[d + 1] : null;
  const loadSave = savesDir
    ? async (name: string) => {
        const j = JSON.parse(readFileSync(join(savesDir, `${name}.json`), "utf8").replace(/^﻿/, ""));
        return j?.data && Array.isArray(j.charNames) && !hackedSaveReason(j) ? j : null;
      }
    : fetchProfileSave;

  console.log(savesDir ? `→ Reading saves from ${savesDir}…` : "→ Gathering candidates from leaderboards…");
  const candidates = savesDir
    ? readdirSync(savesDir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).slice(0, LIMIT ?? undefined)
    : await gatherCandidates({ limit: LIMIT ?? undefined, focusBoard: cfg.focusBoard });
  console.log(`  ✓ ${candidates.length} candidates`);

  const bestByFamily: Partial<Record<ClassFamily, Record<string, Pool>>> = {};
  let bestTotal: Best | null = null;
  let scanned = 0;
  let skipped = 0;

  for (let k = 0; k < candidates.length; k++) {
    const name = candidates[k];
    process.stdout.write(`  [${k + 1}/${candidates.length}] ${name.padEnd(20)}`);
    const save = await loadSave(name);
    let chars: { charIndex: number; charName: string }[] = [];
    try {
      chars = save ? listCharacters(save) : [];
    } catch {
      chars = [];
    }
    if (!save || chars.length === 0) {
      console.log("  · skipped");
      skipped++;
      if (!savesDir && k < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const pools = cfg.computePools(save, ch.charIndex);
        const total = cfg.combine(pools).total;
        if (Number.isFinite(total) && total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
        const family = classFamilyOfIndex(Number(save.data?.[`CharacterClass_${ch.charIndex}`]));
        if (family) bestByFamily[family] = mergeBest(bestByFamily[family] ?? null, pools);
      } catch {
        // skip a char that fails to compute
      }
    }
    if (!bestTotal || playerBest > bestTotal.total) bestTotal = { player: name, char: playerBestChar, total: playerBest };
    scanned++;
    console.log(`  ✓ best ${playerBest.toExponential(3)}x (${playerBestChar})`);
    if (!savesDir && k < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  if (!Object.keys(bestByFamily).length || scanned < MIN_PLAYERS) {
    console.error(`× only ${scanned} players scanned (< ${MIN_PLAYERS}); refusing to publish`);
    process.exit(1);
  }

  const ref = buildFamilyReference(cfg, bestByFamily);

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · gated talents: ${cfg.gated.map((x) => x.id).join(", ") || "none"}`);
  for (const f of Object.keys(ref.familyFlats) as ClassFamily[]) console.log(`  · ${f.padEnd(8)} ceiling: ${(ref.familyFlats[f]![cfg.root] || 0).toExponential(3)}x`);
  console.log(`  · best per-class ceiling: ${ref.maxTotal.toExponential(3)}x`);
  console.log(`  · best real player: ${bestTotal?.total.toExponential(3)}x by ${bestTotal?.player} (${bestTotal?.char})`);

  const { data, meta } = renderTopFiles(cfg, ref.familyFlats, ref.overrides, ref.classProfile, ref.defaultFamily, bestTotal, ref.maxTotal, scanned, new Date().toISOString());
  writeFileSync(cfg.metaFile, meta);
  console.log(`\n✓ Wrote ${cfg.metaFile}`);
  writeFileSync(cfg.outputFile, data);
  console.log(`✓ Wrote ${cfg.outputFile}`);
}
