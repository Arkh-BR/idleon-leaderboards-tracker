// Test oracle for the Artifact Find port (a support module: vitest only collects *.test.ts).
//
// lib/arkh already matches the game for Artifact Find, so each lib/game term is compared against
// it over many real saves. It is a TEST HELPER only: lib/arkh is read for its values, never copied,
// and N.js stays the only source of truth (see KNOWN_ARKH_DIFFS for where the oracle is wrong).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { ARTI_GROUPS } from "@/lib/arkh/stats/defs/artifact-find";
import type { ArkhNode } from "@/lib/arkh/node";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

// lib/arkh reads `window` when it runs; the happy-dom env has one, a bare node env does not.
const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const WEB = resolve(__dirname, "../../../..");

const DEFAULT_DIRS = ["scripts/updater/golden/.cache", "scripts/updater/.cache/saves-fresh"];

// A save envelope has a `charNames` array and a `data` object. The folders are mixed drop folders
// (golden/.cache also has `readings/` and other captures), so anything else is not a save.
function isEnvelope(path: string): boolean {
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(j?.charNames) && j.data !== null && typeof j.data === "object";
  } catch {
    return false; // not JSON at all
  }
}

/**
 * The save envelopes in `dirs` (default: the two real-save folders): the top-level `*.json` files that
 * parse to an envelope, as absolute paths, sorted. Subfolders (`readings/`) and any other JSON are left
 * out. A missing folder contributes nothing. Costs one JSON.parse per file, so about 0.5 s for the 106
 * real saves.
 */
export function goldenSaves(dirs: string[] = DEFAULT_DIRS): string[] {
  return dirs
    .map((d) => resolve(WEB, d))
    .flatMap((dir) =>
      existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)) : []
    )
    .filter(isEnvelope)
    .sort();
}

/**
 * Every real save envelope on this machine: `goldenSaves()` over `scripts/updater/golden/.cache` and
 * `scripts/updater/.cache/saves-fresh`. Both folders are gitignored, so this is `[]` when they are absent
 * (CI): tests that use it must `describe.skipIf(GOLDEN_SAVES.length === 0)`. Six names appear in both
 * folders with identical content (ARKHE, Arlong, ...), so those saves are listed twice.
 */
export const GOLDEN_SAVES: string[] = goldenSaves();

// Ruling D: lib/arkh holds module-level state and the many per-source tests all read the same few
// trees, so a tree is computed once per (save, ci). A path is keyed by the path; an object by identity.
const byPath = new Map<string, ArkhNode>();
const byObject = new WeakMap<object, Map<number, ArkhNode>>();

function treeOf(save: unknown, ci: number): ArkhNode {
  if (typeof save === "string") {
    const key = `${save}#${ci}`;
    let tree = byPath.get(key);
    if (!tree) byPath.set(key, (tree = computeArkhArtifactFind(JSON.parse(readFileSync(save, "utf8")), ci).tree));
    return tree;
  }
  let perCi = byObject.get(save as object);
  if (!perCi) byObject.set(save as object, (perCi = new Map()));
  let tree = perCi.get(ci);
  // Defensive copy: lib/arkh is built to write into the envelope it is given (none of the 106 real saves
  // is touched by Artifact Find today), and the caller may feed the same save to gameCtx.
  if (!tree) perCi.set(ci, (tree = computeArkhArtifactFind(structuredClone(save), ci).tree));
  return tree;
}

/**
 * The `val` of source `sourceId` in lib/arkh's Artifact Find tree for character `ci`: the group in
 * `ARTI_GROUPS`, then the index of the source in that group's `sources`. That is the term as
 * `BoatArtiMulti` uses it: before the `/100` for a `pct` group, the whole factor for a `mult` group.
 *
 * `save` is a parsed envelope or the PATH of a save file (a GOLDEN_SAVES entry, parsed on first use).
 * Prefer the path in loops over many sources. An object is cached by identity: do not edit it between
 * calls. Pass a fresh object per synthetic variant; objects are cached by identity.
 */
export function arkhArtifactLeaf(save: unknown, ci: number, sourceId: string): number {
  const gi = ARTI_GROUPS.findIndex((grp) => grp.sources.includes(sourceId));
  if (gi < 0) throw new Error(`arkhArtifactLeaf: "${sourceId}" is not a source of any ARTI_GROUPS group`);
  const leaf = treeOf(save, ci).children?.[gi]?.children?.[ARTI_GROUPS[gi].sources.indexOf(sourceId)];
  if (!leaf) throw new Error(`arkhArtifactLeaf: lib/arkh's tree has no node for "${sourceId}"`);
  return leaf.val;
}

/** The lib/game Ctx for character `ci` of a parsed save, on map 0 (what Artifact Find uses). */
export const gameCtx = (save: unknown, ci: number, trace?: boolean): Ctx =>
  makeCtx(buildGameState(save as GameEnvelope), { player: ci, map: 0, trace });

/**
 * Where N.js proves lib/arkh wrong and lib/game keeps the N.js value. `save` is the file name of the
 * GOLDEN_SAVES entry, `ci` omitted means every character; `why` cites the `@offset` evidence.
 */
export const KNOWN_ARKH_DIFFS: { save: string; ci?: number; source: string; why: string }[] = [];
