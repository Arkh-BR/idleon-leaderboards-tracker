// Refresh the bundled top-player Drop Rate reference in
// lib/dropRate/topDropRate.ts by fetching each top player's raw save from
// the IT profiles endpoint and running OUR corgan DR engine on it.
//
// HYPOTHETICAL-MAX model: for every char of every candidate we resolve the
// DR pools at PEAK (highest-arcane map + chip gallery on), then keep the
// BEST value seen per source (per pool item index — sources are emitted in
// a fixed order, so item i is the same source for everyone). After scanning
// everyone we recompute the DR formula (dropRateDesc.combine) on that
// "best of each source" pool set. The result is a single coherent tree
// whose total is HIGHER than any individual player — the theoretical
// ceiling a save would hit if it had everyone's best of every source.
// (It's a frankenstein: sources come from different players, so it's an
// aspirational max, not necessarily reachable. Combat-only bonuses like
// Active Drop Rate / multikill aren't in the save either.)
//
// Run:  npx tsx web/scripts/update-top-dr.ts
// Knobs: --limit N   cap candidate set (smoke test)
//        --slow       1500ms between players
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeCorganDRPools, combineDRPools } from "../lib/corgan/computeDR";
import type { Pool } from "../lib/corgan/stats/tree-builder";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";
import { getCharClassKey } from "../lib/talentsLevel/charClass";
import { buildMapOptions } from "../lib/dropRate/arcaneBonus";
import {
  reconcileSharedMultipliers,
  sumMulti,
  type SharedMultiplier,
} from "./_shared/reconcile";
import {
  accumulateOps,
  chooseOps,
  recomputeFrankenstein,
} from "./_shared/frankenstein";
import {
  deriveGatedTalents,
  allClassKeys,
  profileKey,
  findTalentNodePath,
  subtreePaths,
} from "./_shared/classGating";
import type { CorganNode } from "../lib/corgan/node";

// Account-wide multipliers that are emitted under many owned items, so
// best-per-path can leave them reading different values per row (each item
// is won by a different owner). Reconcile each to ONE frankenstein-max value
// (1 + Σ best-of-each-sub-source / 100) shown consistently everywhere.
// Extend this list if another shared "1 + Σ/100" multiplier surfaces.
const DR_SHARED_MULTIPLIERS: SharedMultiplier[] = [
  { name: "Gallery Bonus Multi", recompute: sumMulti },
  { name: "Hatrack Bonus Multi", recompute: sumMulti },
];

const argv = process.argv.slice(2);
const SLOW = argv.includes("--slow");
const THROTTLE_MS = SLOW ? 1500 : 400;
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
})();

const OUTPUT_FILE = join(__dirname, "..", "lib", "dropRate", "topDropRate.ts");
const META_FILE = join(__dirname, "..", "lib", "dropRate", "topDropRate.meta.ts");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Best = { player: string; char: string; total: number };

// Merge an incoming pool set into the running best-per-source accumulator.
function mergeBest(
  acc: Record<string, Pool> | null,
  incoming: Record<string, Pool>
): Record<string, Pool> {
  if (!acc) {
    const init: Record<string, Pool> = {};
    for (const pn in incoming) {
      init[pn] = { items: [...incoming[pn].items], sum: 0, product: 0 };
    }
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
      if ((Number(inc.items[i].val) || 0) > (Number(cur.items[i].val) || 0)) {
        cur.items[i] = inc.items[i];
      }
    }
  }
  return acc;
}

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  // Same logic as the Tome collector, but the top-10 focus board is the
  // Drop Rate ranking (the players that actually define the DR ceiling).
  const candidates = await gatherCandidates({
    limit: LIMIT ?? undefined,
    focusBoard: "dropRate",
  });
  console.log(`  ✓ ${candidates.length} candidates`);

  let bestTotal: Best | null = null;

  // Two reference groups, split by the ACTIVE char's class — because the Mage
  // family bonus (Talent 68) is buffed by the Family Guy talent only when the
  // active char IS the Elemental Sorcerer. Computing over non-ES chars gives
  // the unbuffed FB68 every other class actually has; the ES group keeps the
  // buffed value. Each group is a granular best-per-path map (the max any
  // single char reached per node path) + op detection for the frankenstein
  // recompute + the most-complete structure tree + the best-of-each-source
  // pool set for the headline total.
  type GroupAcc = {
    bestPools: Record<string, Pool> | null;
    bestFlat: Record<string, number>;
    opSets: Map<string, Set<string>>;
    structure: CorganNode | null;
    structPaths: number;
  };
  const newGroup = (): GroupAcc => ({
    bestPools: null,
    bestFlat: {},
    opSets: new Map(),
    structure: null,
    structPaths: -1,
  });
  const nonES = newGroup();
  const es = newGroup();
  let scanned = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const tag = `[${i + 1}/${candidates.length}]`;
    process.stdout.write(`  ${tag} ${name.padEnd(20)}`);
    const save = await fetchProfileSave(name);
    if (!save) {
      console.log("  · skipped (no save)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let chars: { charIndex: number; charName: string }[] = [];
    try {
      chars = listCharacters(save);
    } catch {
      console.log("  · skipped (parse)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    // Peak setup for this save: the map with the highest arcane factor
    // (account-wide AFK kills, same for every char) + chip gallery on.
    const maps = buildMapOptions(save);
    const bestMapIdx = maps.reduce(
      (a, b) => (b.factor > a.factor ? b : a),
      maps[0]
    ).index;
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const pools = computeCorganDRPools(save, ch.charIndex, bestMapIdx, {
          chipGalleryActive: true,
        });
        // Per-char full tree: its total drives the "best real player"
        // headline, and every node feeds the granular best-per-path map.
        // combine doesn't mutate the pool items, so the bestPools references
        // used for the frankenstein total below stay intact.
        const combined = combineDRPools(pools);
        const total = combined.total;
        if (total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
        // Route into the ES or non-ES group by the active char's class.
        const grp =
          getCharClassKey(save, ch.charIndex) === "Elemental_Sorcerer"
            ? es
            : nonES;
        const f = flattenTree(combined.tree);
        for (const p in f) {
          const v = f[p];
          if (grp.bestFlat[p] === undefined || v > grp.bestFlat[p])
            grp.bestFlat[p] = v;
        }
        accumulateOps(combined.tree, grp.opSets);
        const nPaths = Object.keys(f).length;
        if (nPaths > grp.structPaths) {
          grp.structPaths = nPaths;
          grp.structure = combined.tree;
        }
        grp.bestPools = mergeBest(grp.bestPools, pools);
      } catch {
        // skip a char that fails to compute (e.g. no class)
      }
    }
    if (!bestTotal || playerBest > bestTotal.total) {
      bestTotal = { player: name, char: playerBestChar, total: playerBest };
    }
    scanned++;
    console.log(`  ✓ best ${playerBest.toFixed(2)}x (${playerBestChar})`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  if (!nonES.bestPools || !nonES.structure) {
    console.error("× no non-ES pools collected, aborting");
    process.exit(1);
  }

  // Finalize a group: frankenstein-recompute its aggregates, reconcile shared
  // multipliers, and pin the root to its best-of-each-source total.
  const finalizeGroup = (grp: GroupAcc) => {
    for (const pn in grp.bestPools!) {
      let sum = 0;
      let product = 1;
      for (const it of grp.bestPools![pn].items) {
        const v = Number(it.val) || 0;
        sum += v;
        product *= v !== 0 ? v : 1;
      }
      grp.bestPools![pn].sum = sum;
      grp.bestPools![pn].product = product;
    }
    const total = combineDRPools(grp.bestPools!).total;
    const { flat, recomputed } = recomputeFrankenstein(
      grp.structure!,
      grp.bestFlat,
      chooseOps(grp.opSets)
    );
    reconcileSharedMultipliers(flat, DR_SHARED_MULTIPLIERS);
    flat["Drop Rate"] = total;
    return { flat, total, recomputed };
  };

  const nonRes = finalizeGroup(nonES);

  // ── Per-class gating ────────────────────────────────────────────────
  // Class-specific DR talents (Robbing Hood 279 / Curse of Mr Looty Booty 24)
  // can't be had by every class. From the non-ES reference build a BASE with
  // none of them + per-profile OVERRIDES that add back only the talents a
  // class owns (with the affected additive aggregates + recomputed total).
  // The Elemental Sorcerer gets its own profile from the ES reference (its
  // Family Bonus 68 is buffed by Family Guy; every other class's is not).
  const TALENTS_BUCKET = "Drop Rate / Additive Pool / 🎯 Talents";
  const ADDITIVE_POOL = "Drop Rate / Additive Pool";
  const TOTAL_SUM = "Drop Rate / Total Sum";
  const flat = nonRes.flat;
  const gated = deriveGatedTalents();
  const talPaths = new Map<number, { value: number; paths: string[] }>();
  for (const g of gated) {
    const np = findTalentNodePath(flat, g.id);
    if (np) talPaths.set(g.id, { value: flat[np], paths: subtreePaths(flat, np) });
  }

  // Recompute the DR total with a set of talent items zeroed (non-ES pools).
  const totalWithout = (removeIds: number[]): number => {
    const clone: Record<string, Pool> = {};
    for (const pn in nonES.bestPools!) {
      clone[pn] = {
        items: nonES.bestPools![pn].items.map((it) => ({ ...it })),
        sum: 0,
        product: 0,
      };
    }
    for (const pn in clone) {
      for (const it of clone[pn].items) {
        if (removeIds.some((id) => it.name.endsWith(`(Talent ${id})`))) it.val = 0;
      }
      let sum = 0;
      let product = 1;
      for (const it of clone[pn].items) {
        const v = Number(it.val) || 0;
        sum += v;
        product *= v !== 0 ? v : 1;
      }
      clone[pn].sum = sum;
      clone[pn].product = product;
    }
    return combineDRPools(clone).total;
  };

  const buildProfileFlat = (ownedIds: number[]): Record<string, number> => {
    const m: Record<string, number> = { ...flat };
    let removedSum = 0;
    const removeIds: number[] = [];
    for (const g of gated) {
      if (ownedIds.includes(g.id)) continue;
      removeIds.push(g.id);
      const tp = talPaths.get(g.id);
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
    const owned = gated.filter((g) => g.owners.has(c)).map((g) => g.id);
    const key = profileKey(owned);
    classProfile[c] = key;
    if (!profileOwned.has(key)) profileOwned.set(key, owned);
  }

  const baseFlat = buildProfileFlat([]); // no class-specific talents
  const overrides: Record<string, Record<string, number>> = {};
  let maxProfileTotal = baseFlat["Drop Rate"] || 0;
  // Override = the paths whose value differs from base. base and every
  // profile share the same path set (account-wide sources + the same talent
  // subtree shapes), so a plain {...base, ...override} merge on the page
  // reconstructs each profile — no path deletions needed.
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
  // Elemental Sorcerer profile — the non-ES base (correct LUK + account-wide
  // ceilings), with the BUFFED Family Bonus 68 grafted in (only the ES's own
  // Family Guy buffs it). Computing the ES over ES chars alone would
  // undersample LUK (real ES chars aren't DR-built), so we keep base and just
  // overlay the buffed FB68 subtree + bump the containing Bonus/Effective
  // Levels by the delta. The DR impact of the +levels is negligible, so the
  // total stays the base ceiling.
  const FB68_NAME = "Family Bonus 68 (Mage)";
  const esFlat: Record<string, number> = { ...baseFlat };
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
      if ((q === p || q.startsWith(pre)) && es.bestFlat[q] != null) {
        esFlat[q] = es.bestFlat[q];
      }
    }
    // Bump the containing Bonus Levels + Effective Level by the FB68 delta.
    const bonusPath = p.slice(0, p.lastIndexOf(" / "));
    const effPath = bonusPath.slice(0, bonusPath.lastIndexOf(" / "));
    if (esFlat[bonusPath] != null) esFlat[bonusPath] += delta;
    if (esFlat[effPath] != null) esFlat[effPath] += delta;
    fbGrafted++;
  }
  if (fbGrafted > 0) {
    classProfile["Elemental_Sorcerer"] = "ES";
    addOverride("ES", esFlat);
  }

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · non-ES recomputed ${nonRes.recomputed} aggregates · FB68 grafted onto ${fbGrafted} ES talent(s)`);
  console.log(
    `  · gated talents: ${gated.map((g) => g.id).join(", ") || "none"} → profiles: ${Object.keys(overrides).concat(["base"]).join(", ")}`
  );
  console.log(`  · ${Object.keys(baseFlat).length} base reference paths`);
  console.log(`  · best per-class ceiling: ${maxProfileTotal.toFixed(2)}x`);
  console.log(
    `  · best real player: ${bestTotal?.total.toFixed(2)}x by ${bestTotal?.player} (${bestTotal?.char})`
  );

  emitFiles(baseFlat, overrides, classProfile, bestTotal, maxProfileTotal, scanned);
}

function emitFiles(
  baseFlat: Record<string, number>,
  overrides: Record<string, Record<string, number>>,
  classProfile: Record<string, string>,
  best: Best | null,
  hypotheticalTotal: number,
  scanned: number
) {
  const now = new Date().toISOString();

  // Metadata file — small, safe to import statically (powers the toggle's
  // headline without pulling in the large path table).
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
  writeFileSync(META_FILE, meta);
  console.log(`\n✓ Wrote ${META_FILE}`);

  // Flat table — large, lazy-loaded only when the user opts into the
  // comparison. Keyed by the same nodePath() scheme treeFlatten uses so it
  // drops straight into DeepView as a comparison baseline.
  //
  // PER CLASS: TOP_DR_FLAT is the BASE profile (no class-specific talents).
  // TOP_DR_PROFILE_OVERRIDES adds, per profile, the class-specific talent(s)
  // a class owns plus the recomputed additive aggregates + total. A class
  // maps to a profile via TOP_DR_CLASS_PROFILE; topDrFlatForClass() merges
  // base + override (classes the talent doesn't belong to simply lack its
  // paths, so its 🎯 doesn't render).
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

  const out: string[] = [
    "// Top-player Drop Rate reference — GRANULAR best-per-path, frankenstein-",
    "// recomputed aggregates, gated PER CLASS. Every value is the max any",
    "// single scanned (player, char) reached for that node path; aggregates",
    "// are rebuilt from their maxed children; class-specific talents (Robbing",
    "// Hood 279 / Curse of Mr Looty Booty 24) appear only in the profiles of",
    "// classes that own them. Use topDrFlatForClass(classKey).",
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
  ];
  writeFileSync(OUTPUT_FILE, out.join("\n"));
  console.log(`✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
