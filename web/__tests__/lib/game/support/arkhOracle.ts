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
 * lib/arkh's whole Artifact Find tree for character `ci` (root = the total, then the groups, then the sources), cached like
 * `arkhArtifactLeaf` and shared with it: the tracker adapter test compares names, formats, notes and the total against it.
 * Do not edit the returned tree. Same `save` rules as `arkhArtifactLeaf`.
 */
export const arkhArtifactTree = (save: unknown, ci: number): ArkhNode => treeOf(save, ci);

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

/**
 * What every lib/game loop over the real saves refuses (Ruling E), as `<file>: <key>`, sorted: nothing. The game's load steps are
 * replayed on an older save (lib/game/migrations), back to the oldest real one (HourZero, DoOnceREAL 248.3); a save older than the
 * steps ported (DoOnceREAL < OLDEST_GATE) would be refused for every read, and no real save is.
 */
export const UNPORTED_REFUSALS: readonly string[] = [];

/** The lib/game Ctx for character `ci` of a parsed save, on map 0 (what Artifact Find uses). */
export const gameCtx = (save: unknown, ci: number, trace?: boolean): Ctx =>
  makeCtx(buildGameState(save as GameEnvelope), { player: ci, map: 0, trace });

const COMPANION_0_GATE =
  "Companions(0) @10799980 is 0 below Lv0[14] = 2 (`0==d&&2>c.asNumber(Lv0[14])?0:…`); Koweabooo#10 has Lv0_10[14] = 1. lib/arkh's companionBonus has no such gate, so its Grid_Bonus_Allmulti @11179174 keeps the +5 of `5*min(1, Research[0][173]*Companions(0))` (game 1.16, arkh 1.21). Raising Lv0_10[14] to 2 makes lib/game equal lib/arkh (accountUpgrades.test.ts)";

const TOME_SOURCE =
  "lib/arkh reads IdleonToolbox's parsedData tome total; lib/game uses lib/tome (N.js port, validated in game 2026-11-03) for the Tome actor's GenInfo[84] @5778865 (the Lore Episode reads it). With the total forced to IdleonToolbox's number for this save, lib/game equals lib/arkh (loreEpi.test.ts)";
/** The saves whose loreEpi3 differs only because the Tome total of lib/tome is not the one IdleonToolbox stamped (checked in loreEpi.test.ts). */
const TOME_SOURCE_SAVES = [
  "1st_Giri.json", "24632463.json", "Dragonlzl.json", "Exrom.json", "FenrirAdra.json", "Flipper143.json", "GIM_SSS.json", "Grandesz.json",
  "Koweabooo.json", "arkhe-2026-09-23.json", "bluestar3112.json", "breakinbrad.json", "hellzd4nt3.json", "joelok.json",
]; // only full-coverage saves: a save with a Tome row lib/tome cannot compute is refused (IncompleteTome), not a difference. The older ones
// (below CSver 34) are scored after the game's load steps (lib/game/migrations): IdleonToolbox's 118 rows have none of the Royal Guardian
// rows (107..109) the load gives them, and it stamped its number on the save as stored

/**
 * 0celot8 (DoOnceREAL 367.1) and 5OhTree (340.1) run the load step DoOnceREAL < 378 (@6459191), which resets OptionsListAccount[200], the
 * account's highest Drop Rate, to 1. The Tome's TomeQTY[18] reads it (@5746828) only after `_customEvent_TomeQTY` raised it to the live
 * `TotalStats("Drop_Rarity")` (@5739715), so the game never scores the reset 1: it scores the live Drop Rate, which this engine does not
 * compute. lib/game keeps the reset value and says so in an `assumed:` leaf (DROP_RATE_RECORD, lib/game/migrations); IdleonToolbox scored
 * the stored record (0celot8: 251.24, 458 points against lib/tome's 38).
 */
const TOME_AFTER_RESET = `${TOME_SOURCE}. On top of that, this save runs the load step DoOnceREAL < 378 (@6459191), which resets OptionsListAccount[200] (the highest Drop Rate) to 1: TomeQTY[18] reads it (@5746828) only after _customEvent_TomeQTY raised it to the live TotalStats("Drop_Rarity") (@5739715), which is not ported, so lib/game scores the reset value under an assumed: leaf and IdleonToolbox the stored record; the game scores the live Drop Rate`;

/**
 * HourZero's characters 1 and 9 wear all 11 parts of the God Shard set, which the account never unlocked for good (OptionsListAccount[379]
 * is 0, [380] is 0). N.js's GetSetBonus("GODSHARD_SET", "Bonus") gives the set's bonus to a set worn whole (`PartsOn >= PartsReq`,
 * @11098422) as well as to one named in OptionsListAccount[379]; lib/arkh's Winner Bonus counts it only when it is named there.
 */
const GODSHARD_WORN = "GetSetBonus Bonus @11098422 gives the God Shard set's bonus (15) to a set worn whole (PartsOn 11 >= PartsReq 11) as well as to one permanently unlocked in OptionsListAccount[379]; lib/arkh's WinBonus counts it only when OptionsListAccount[379] names it, and this account's is 0";

/**
 * Where N.js proves lib/arkh wrong and lib/game keeps the N.js value. `save` is the file name of the
 * GOLDEN_SAVES entry, `ci` omitted means every character; `why` cites the `@offset` evidence.
 */
export const KNOWN_ARKH_DIFFS: { save: string; ci?: number; source: string; why: string }[] = [
  { save: "Koweabooo.json", ci: 10, source: "grid109", why: COMPANION_0_GATE },
  { save: "Koweabooo.json", ci: 10, source: "grid106", why: COMPANION_0_GATE },
  { save: "Koweabooo.json", ci: 10, source: "sticker2add", why: COMPANION_0_GATE },
  { save: "Koweabooo.json", ci: 10, source: "sticker2mult", why: COMPANION_0_GATE }, // 0 on every real save; differs only with Menagerie unlock 22 forced
  // Task 8: the Minehead presses are multiplied by 1 + Grid_Bonus(125, 0) / 100, whose Grid_Bonus_Allmulti has the same Companions(0) term
  // The game keeps DNSM.Button_Bonsuz for the whole session, built with the Companions(0) gate of the character that first asks (rebuilt
  // only from the Minehead UI @13189253, @13417222, @13417985, @13418698): it shows this value only if the first Minehead read was on this character
  { save: "Koweabooo.json", ci: 10, source: "button3", why: `${COMPANION_0_GATE}. The Minehead cache is per session in the game, not per character: lib/game models it as built for the current character (Minehead.ts), so the game shows this value only if the session's first Minehead read was on this character` },
  // Ruling K: the Tome score of the Lore Episode is lib/tome's, not IdleonToolbox's (ci omitted: every character)
  ...TOME_SOURCE_SAVES.map((save) => ({ save, source: "loreEpi3", why: TOME_SOURCE })),
  { save: "0celot8.json", source: "loreEpi3", why: TOME_AFTER_RESET },
  { save: "5OhTree.json", source: "loreEpi3", why: TOME_AFTER_RESET },
  { save: "HourZero.json", ci: 1, source: "win3", why: GODSHARD_WORN },
  { save: "HourZero.json", ci: 9, source: "win3", why: GODSHARD_WORN },
];
