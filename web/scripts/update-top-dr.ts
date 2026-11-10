// Refresh the bundled top-player Drop Rate reference in
// lib/dropRate/topDropRate.ts (+ .meta.ts) from each top player's raw save,
// on lib/game: the /drop-rate page's own rows (lib/game/trackers/dropRateV1.ts
// v1Rows) and its own assembly (v1Assemble).
//
// HYPOTHETICAL-MAX model: every char of every candidate is measured at PEAK
// (its save's best Arcane drop map, MAP_PICKS.dr2 — never the Cove, 216 — and
// the chip gallery on); the BEST value seen per source (per row position:
// v1Rows keeps every V1 source at its position, so row i is the same source
// for everyone) is kept; the page's assembly then runs ONCE on that "best of
// each source" row set. The result is a single coherent tree whose total is
// HIGHER than any individual player — the theoretical ceiling a save would hit
// if it had everyone's best of every source. (It's a frankenstein: sources come
// from different players, so it's an aspirational max, not necessarily
// reachable. Combat-only bonuses like Active Drop Rate / multikill aren't in
// the save either.)
//
// The rules (user decision B, 2026-11-10), each on V1 source row ids:
//   · two accumulators, by the char's class: non-Elemental-Sorcerer and ES;
//   · the 8 card slots (card10 / card101, scripts/_shared/top8DrCards.ts);
//   · talents 279 / 24 gated into per-class profiles (V1_CLASS_TALENTS);
//   · the ES profile: the non-ES base with the ES chars' buffed Family Bonus 68 grafted in.
//
// Run (from web/):  npx tsx scripts/update-top-dr.ts   [--limit N] [--slow] [--saves-dir <dir> [--newest N]]
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { loadPlayers, mergeBest, type Pool, type StatCollectorConfig } from "./_shared/topStatCollector";
import { MAP_PICKS, pickMap } from "./_shared/gamePools";
import { capDrCards, patchCardFlatDisplay } from "./_shared/top8DrCards";
import { deriveGatedTalentsFor, allClassKeys, profileKey, findTalentNodePath, subtreePaths, type GatedTalent } from "./_shared/classGating";
import { v1Assemble, v1Ctx, v1Rows, type V1Rows } from "../lib/game/trackers/dropRateV1";
import { near } from "../lib/game/trackers/page";
import { TreeTotalMismatch } from "../lib/game/errors";
import { V1_CLASS_TALENTS, V1_SOURCES, type V1Pool } from "../lib/dropRate/v1Sources";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";
import { getCharClassKey } from "../lib/talentsLevel/charClass";

const OUTPUT_FILE = join(__dirname, "..", "lib", "dropRate", "topDropRate.ts");
const META_FILE = join(__dirname, "..", "lib", "dropRate", "topDropRate.meta.ts");

type Pools = Record<string, Pool>;
type Best = { player: string; char: string; total: number };
/** The per-character engine: the pools (v1Rows' positions) and the page's assembly over them. */
export type DrV1Engine = Pick<StatCollectorConfig, "computePools" | "combine">;

/** Each V1 source's place in the pools: id -> [pool, index]. */
const AT = new Map<string, [V1Pool, number]>();
{
  const n: Partial<Record<V1Pool, number>> = {};
  for (const s of V1_SOURCES) {
    const i = n[s.pool] ?? 0;
    AT.set(s.id, [s.pool, i]);
    n[s.pool] = i + 1;
  }
}
/** Talent number -> the id of the row that IS that talent ("… (Talent n)": 279, 24, 655, 239, and 328 for workbench). */
const TALENT_ROW = new Map<number, string>();
for (const s of V1_SOURCES) {
  const m = typeof s.name === "string" ? s.name.match(/\(Talent (\d+)\)$/) : null;
  if (m) TALENT_ROW.set(Number(m[1]), s.id);
}
const posOf = (id: string): [V1Pool, number] => {
  const at = AT.get(id);
  if (!at) throw new Error(`update-top-dr: no V1 source "${id}"`);
  return at;
};
const itemOf = (pools: Pools, id: string) => {
  const [p, i] = posOf(id);
  return pools[p].items[i];
};
/** The pools with some rows' values replaced (a copy: the items are other characters' nodes). */
function withVals(pools: Pools, vals: Map<string, number>): Pools {
  const out: Pools = {};
  for (const pn in pools) out[pn] = { items: [...pools[pn].items] };
  for (const [id, val] of vals) {
    const [p, i] = posOf(id);
    out[p].items[i] = { ...out[p].items[i], val };
  }
  return out;
}

/** lib/game's engine: the page's rows on the DR map with the chip gallery on, refused (TreeTotalMismatch) when they don't rebuild the game's total, as the page is. */
export const DR_V1_ENGINE: DrV1Engine = {
  computePools: (save, ci) => {
    const { rows, total, cove } = v1Rows(v1Ctx(save, ci, pickMap(save, ci, MAP_PICKS.dr2), { chipGalleryActive: true }));
    const { expected } = v1Assemble(rows, cove);
    if (!near(expected, total)) throw new TreeTotalMismatch(total, expected);
    return Object.fromEntries(Object.entries(rows).map(([p, items]) => [p, { items }]));
  },
  combine: (pools) => {
    const { children, expected } = v1Assemble(Object.fromEntries(Object.entries(pools).map(([p, x]) => [p, x.items])) as V1Rows);
    return { tree: { name: "Drop Rate", val: expected, fmt: "x", children }, total: expected };
  },
};

export type DrReference = {
  baseFlat: Record<string, number>;
  overrides: Record<string, Record<string, number>>;
  classProfile: Record<string, string>;
  bestPlayer: Best | null;
  maxProfileTotal: number;
  gated: GatedTalent[];
  fbGrafted: number;
  scanned: number;
  skipped: string[];
  /** "player/char" of every character the engine refused. */
  refusedChars: string[];
  log: string[];
};

/** The pure part of a run: players' saves in, the reference out. A character the engine refuses is counted and named, never fatal. */
export function collectDrReference(saves: Iterable<{ name: string; save: unknown }>, engine: DrV1Engine = DR_V1_ENGINE): DrReference {
  // Two reference groups, split by the char's class — because the Mage family
  // bonus (Talent 68) is buffed by the Family Guy talent only when the active
  // char IS the Elemental Sorcerer. Computing over non-ES chars gives the
  // unbuffed FB68 every other class actually has; the ES group keeps the buffed
  // value. Each group keeps the best-of-each-source pool set (which drives BOTH
  // the total and the displayed breakdown via one combine() pass) plus a
  // granular best-per-path map (still needed to seed observed card star levels
  // for the 8-slot cap and to graft the buffed ES Family Bonus 68).
  type Group = { bestPools: Pools | null; bestFlat: Record<string, number> };
  const nonES: Group = { bestPools: null, bestFlat: {} };
  const es: Group = { bestPools: null, bestFlat: {} };
  let bestPlayer: Best | null = null;
  let scanned = 0;
  const skipped: string[] = [];
  const refusedChars: string[] = [];
  const log: string[] = [];

  for (const { name, save } of saves) {
    let chars: { charIndex: number; charName: string }[] = [];
    try {
      chars = save ? listCharacters(save as any) : [];
    } catch {
      chars = [];
    }
    if (chars.length === 0) {
      skipped.push(`${name}: no characters`);
      continue;
    }
    let playerBest = 0;
    let playerBestChar = "";
    let ok = 0;
    for (const ch of chars) {
      try {
        const pools = engine.computePools(save, ch.charIndex);
        // Per-char full tree: its total drives the "best real player" headline, and every node feeds the granular best-per-path map.
        const combined = engine.combine(pools);
        if (combined.total > playerBest) {
          playerBest = combined.total;
          playerBestChar = ch.charName;
        }
        const grp = getCharClassKey(save as any, ch.charIndex) === "Elemental_Sorcerer" ? es : nonES;
        const f = flattenTree(combined.tree);
        for (const p in f) if (grp.bestFlat[p] === undefined || f[p] > grp.bestFlat[p]) grp.bestFlat[p] = f[p];
        grp.bestPools = mergeBest(grp.bestPools, pools);
        ok++;
      } catch (e) {
        const why = e instanceof Error ? `${e.name}: ${e.message.split("\n")[0]}` : String(e);
        refusedChars.push(`${name}/${ch.charName}`);
        log.push(`  ! refused ${name}/${ch.charName}: ${why}`);
      }
    }
    if (ok === 0) {
      skipped.push(`${name}: every character refused`);
      continue;
    }
    if (!bestPlayer || playerBest > bestPlayer.total) bestPlayer = { player: name, char: playerBestChar, total: playerBest };
    scanned++;
    log.push(`  ✓ ${name} best ${playerBest.toFixed(2)}x (${playerBestChar})`);
  }
  if (!nonES.bestPools) throw new Error("no non-ES pools collected");

  // The 8 card slots: the two card rows take the best-8 pick's sums; the displayed breakdown AND the headline total then come from the SAME
  // combine() pass over the best-of-each-source pools. patchCardFlatDisplay expands the card nodes to the full obtainable catalog; its additive
  // delta is 0 here (the tree already carries the capped sum), so it shifts no ancestor.
  const cardSel = capDrCards(nonES.bestFlat);
  const best = withVals(nonES.bestPools, new Map([["card10", cardSel.additiveSum], ["card101", cardSel.multiSum]]));
  const combined = engine.combine(best);
  const flat = flattenTree(combined.tree);
  patchCardFlatDisplay(flat, cardSel);
  flat["Drop Rate"] = combined.total;

  // ── Per-class gating ────────────────────────────────────────────────
  // Class-specific DR talents (Robbing Hood 279 / Curse of Mr Looty Booty 24) can't be had by every class. From the non-ES reference build a
  // BASE with none of them + per-profile OVERRIDES that add back only the talents a class owns (with the affected additive aggregates +
  // recomputed total). The Elemental Sorcerer gets its own profile (its Family Bonus 68 is buffed by Family Guy; every other class's is not).
  const TALENTS_BUCKET = "Drop Rate / Additive Pool / 🎯 Talents";
  const ADDITIVE_POOL = "Drop Rate / Additive Pool";
  const TOTAL_SUM = "Drop Rate / Total Sum";
  const gated = deriveGatedTalentsFor(V1_CLASS_TALENTS);
  const gatedRows = gated.map((x) => TALENT_ROW.get(x.id)!);
  const talPaths = new Map<number, { value: number; paths: string[] }>();
  for (const x of gated) {
    const np = findTalentNodePath(flat, x.id);
    if (np) talPaths.set(x.id, { value: flat[np], paths: subtreePaths(flat, np) });
  }
  /** The DR total with some talent rows zeroed (non-ES pools). */
  const totalWithout = (removeIds: number[]): number => engine.combine(withVals(best, new Map(removeIds.map((id) => [TALENT_ROW.get(id)!, 0])))).total;

  const buildProfileFlat = (ownedIds: number[]): Record<string, number> => {
    const m: Record<string, number> = { ...flat };
    let removedSum = 0;
    const removeIds: number[] = [];
    for (const x of gated) {
      if (ownedIds.includes(x.id)) continue;
      removeIds.push(x.id);
      const tp = talPaths.get(x.id);
      if (!tp) continue;
      removedSum += tp.value;
      for (const p of tp.paths) delete m[p];
    }
    if (removedSum) {
      if (m[TALENTS_BUCKET] != null) m[TALENTS_BUCKET] -= removedSum;
      if (m[ADDITIVE_POOL] != null) m[ADDITIVE_POOL] -= removedSum;
      if (m[TOTAL_SUM] != null) m[TOTAL_SUM] -= removedSum / 100;
    }
    m["Drop Rate"] = totalWithout(removeIds);
    return m;
  };

  // class → profile key (talent gating), and the owned-id set per profile.
  const classProfile: Record<string, string> = {};
  const profileOwned = new Map<string, number[]>();
  for (const c of allClassKeys()) {
    const owned = gated.filter((x) => x.owners.has(c)).map((x) => x.id);
    const key = profileKey(owned);
    classProfile[c] = key;
    if (!profileOwned.has(key)) profileOwned.set(key, owned);
  }

  const baseFlat = buildProfileFlat([]); // no class-specific talents
  const overrides: Record<string, Record<string, number>> = {};
  let maxProfileTotal = baseFlat["Drop Rate"] || 0;
  // Override = the paths whose value differs from base. base and every profile share the same path set (account-wide sources + the same talent
  // subtree shapes), so a plain {...base, ...override} merge on the page reconstructs each profile — no path deletions needed.
  const addOverride = (key: string, pf: Record<string, number>) => {
    const d: Record<string, number> = {};
    for (const k in pf) if (baseFlat[k] !== pf[k]) d[k] = pf[k];
    overrides[key] = d;
    maxProfileTotal = Math.max(maxProfileTotal, pf["Drop Rate"] || 0);
  };
  for (const [key, owned] of profileOwned) {
    if (key === "base") continue;
    addOverride(key, buildProfileFlat(owned));
  }

  // Elemental Sorcerer profile — the non-ES base (correct LUK + account-wide ceilings), with the BUFFED Family Bonus 68 grafted in (only the ES's
  // own Family Guy buffs it). Computing the ES over ES chars alone would undersample LUK (real ES chars aren't DR-built), so we keep base and
  // overlay the buffed FB68 subtree + bump the containing Bonus/Effective Levels. The total is recomputed by swapping the rows of the talents
  // that hold a grafted FB68 directly (…/<row (Talent n)>/Effective Level/Bonus Levels/Family Bonus 68) for the ES group's best of those rows.
  const FB68_NAME = "Family Bonus 68 (Mage)";
  const esFlat: Record<string, number> = { ...baseFlat };
  const esRows = new Set<string>();
  let fbGrafted = 0;
  for (const p of Object.keys(baseFlat)) {
    if (!p.endsWith(FB68_NAME)) continue;
    const esVal = es.bestFlat[p];
    if (esVal == null) continue;
    const delta = esVal - baseFlat[p];
    if (delta <= 0) continue;
    // Overlay the buffed FB68 subtree from the ES computations.
    const pre = p + " / ";
    for (const q of Object.keys(baseFlat)) {
      if ((q === p || q.startsWith(pre)) && es.bestFlat[q] != null) esFlat[q] = es.bestFlat[q];
    }
    // Bump the containing Bonus Levels + Effective Level by the FB68 delta.
    const bonusPath = p.slice(0, p.lastIndexOf(" / "));
    const effPath = bonusPath.slice(0, bonusPath.lastIndexOf(" / "));
    if (esFlat[bonusPath] != null) esFlat[bonusPath] += delta;
    if (esFlat[effPath] != null) esFlat[effPath] += delta;
    const segs = p.split(" / ");
    const m = segs[segs.length - 4]?.match(/\(Talent (\d+)\)/);
    const row = m ? TALENT_ROW.get(Number(m[1])) : undefined;
    if (row) esRows.add(row);
    fbGrafted++;
  }
  if (fbGrafted > 0) {
    // The ES total: base pools (gated 279/24 zeroed) with the FB68-bearing talent rows swapped to their buffed ES versions.
    const vals = new Map<string, number>();
    for (const id of esRows) vals.set(id, Number(itemOf(es.bestPools!, id).val) || 0);
    for (const id of gatedRows) vals.set(id, 0);
    esFlat["Drop Rate"] = engine.combine(withVals(best, vals)).total;
    classProfile["Elemental_Sorcerer"] = "ES";
    addOverride("ES", esFlat);
  }

  return { baseFlat, overrides, classProfile, bestPlayer, maxProfileTotal, gated, fbGrafted, scanned, skipped, refusedChars, log };
}

/** The two generated files' text (names, constants and shape are the page's contract). */
export function renderDrFiles(r: Pick<DrReference, "baseFlat" | "overrides" | "classProfile" | "bestPlayer" | "maxProfileTotal" | "scanned">, now: string): { data: string; meta: string } {
  const { baseFlat, overrides, classProfile, bestPlayer: best, maxProfileTotal: hypotheticalTotal, scanned } = r;
  // Metadata file — small, safe to import statically (powers the toggle's headline without pulling in the large path table).
  const meta = [
    "// Top-player Drop Rate reference — metadata only (small, statically",
    "// imported). The large path→value table lives in topDropRate.ts and is",
    "// lazy-loaded on demand. Both auto-refreshed by scripts/update-top-dr.ts.",
    "",
    `export const TOP_DR_GENERATED_AT = ${JSON.stringify(now)};`,
    `export const TOP_DR_PLAYERS_SCANNED = ${scanned};`,
    "// Best DR achievable by a single CLASS's frankenstein save (the highest",
    "// per-class ceiling — class-specific talents are gated by class, so this",
    "// is reachable in principle, unlike the all-classes-combined number).",
    `export const TOP_DR_HYPOTHETICAL_TOTAL = ${hypotheticalTotal};`,
    "// Highest DR of a single real player, for context.",
    `export const TOP_DR_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
    "",
  ].join("\n");

  // Flat table — large, lazy-loaded only when the user opts into the comparison. Keyed by the same nodePath() scheme treeFlatten uses so it
  // drops straight into DeepView as a comparison baseline.
  //
  // PER CLASS: TOP_DR_FLAT is the BASE profile (no class-specific talents). TOP_DR_PROFILE_OVERRIDES adds, per profile, the class-specific
  // talent(s) a class owns plus the recomputed additive aggregates + total. A class maps to a profile via TOP_DR_CLASS_PROFILE;
  // topDrFlatForClass() merges base + override (classes the talent doesn't belong to simply lack its paths, so its 🎯 doesn't render).
  const obj = (m: Record<string, number>) => {
    const lines: string[] = ["{"];
    for (const path of Object.keys(m).sort()) {
      lines.push(`    ${JSON.stringify(path)}: ${m[path]},`);
    }
    lines.push("  }");
    return lines.join("\n");
  };
  const overrideEntries = Object.keys(overrides)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${obj(overrides[k])},`)
    .join("\n");

  const data = [
    "// Top-player Drop Rate reference — best-of-each-source pool set run through",
    "// ONE combine() pass (the same DR math a real save uses), gated PER CLASS.",
    "// Every source is the max any single scanned (player, char) reached; the",
    "// tree + total come from the same pass, so Total Sum × Post-Processing",
    "// reconstructs the headline exactly. Class-specific talents (Robbing Hood",
    "// 279 / Curse of Mr Looty Booty 24) appear only in the profiles of classes",
    "// that own them. Use topDrFlatForClass(classKey).",
    "// Large file: lazy-load it, don't import statically.",
    `// Generated ${now} · ${scanned} players. Refresh: scripts/update-top-dr.ts.`,
    "",
    "type FlatMap = Readonly<Record<string, number>>;",
    "",
    `export const TOP_DR_FLAT: FlatMap = ${obj(baseFlat)};`,
    "",
    "export const TOP_DR_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {",
    overrideEntries,
    "};",
    "",
    `export const TOP_DR_CLASS_PROFILE: Readonly<Record<string, string>> = ${JSON.stringify(classProfile, null, 2)};`,
    "",
    "/** The top-DR reference map for a class — the base profile merged with",
    " *  the class's profile override (class-specific talents it can have). */",
    "export function topDrFlatForClass(classKey: string | null | undefined): FlatMap {",
    "  const profile = classKey ? TOP_DR_CLASS_PROFILE[classKey] : undefined;",
    "  const override = profile ? TOP_DR_PROFILE_OVERRIDES[profile] : undefined;",
    "  return override ? { ...TOP_DR_FLAT, ...override } : TOP_DR_FLAT;",
    "}",
    "",
  ].join("\n");
  return { data, meta };
}

async function main(argv: string[]) {
  const { loaded, minPlayers } = await loadPlayers(argv, "dropRate"); // the top-10 focus board is the Drop Rate ranking
  const t0 = performance.now();
  const r = collectDrReference(loaded);
  const ms = performance.now() - t0;
  for (const l of r.log) console.log(l);
  // Never publish a shrunken reference (the Tome cron lesson); --limit and --newest are smoke tests.
  if (r.scanned < minPlayers) {
    console.error(`× only ${r.scanned} players scanned (< ${minPlayers}); refusing to publish`);
    process.exit(1);
  }
  console.log(`\n✓ Scanned ${r.scanned} players (${r.skipped.length} skipped, ${r.refusedChars.length} characters refused) · ${(ms / Math.max(1, r.scanned)).toFixed(0)} ms/player`);
  if (r.refusedChars.length) console.log(`  · refused: ${r.refusedChars.join(", ")}`);
  console.log(`  · FB68 grafted onto ${r.fbGrafted} ES talent(s)`);
  console.log(`  · gated talents: ${r.gated.map((x) => x.id).join(", ") || "none"} → profiles: ${Object.keys(r.overrides).concat(["base"]).join(", ")}`);
  console.log(`  · ${Object.keys(r.baseFlat).length} base reference paths`);
  console.log(`  · best per-class ceiling: ${r.maxProfileTotal.toFixed(2)}x`);
  console.log(`  · best real player: ${r.bestPlayer?.total.toFixed(2)}x by ${r.bestPlayer?.player} (${r.bestPlayer?.char})`);

  const { data, meta } = renderDrFiles(r, new Date().toISOString());
  writeFileSync(META_FILE, meta);
  console.log(`\n✓ Wrote ${META_FILE}`);
  writeFileSync(OUTPUT_FILE, data);
  console.log(`✓ Wrote ${OUTPUT_FILE}`);
}

// Imported by the round-trip test and compare-top-ref without running the collector.
if (require.main === module) main(process.argv.slice(2)).catch((e) => {
  console.error(e);
  process.exit(1);
});
