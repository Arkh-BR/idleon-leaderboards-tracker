// Test oracle for the Artifact Find port (a support module: vitest only collects *.test.ts).
//
// lib/arkh already matches the game for Artifact Find, so each lib/game term is compared against
// it over many real saves. It is a TEST HELPER only: lib/arkh is read for its values, never copied,
// and N.js stays the only source of truth (see KNOWN_ARKH_DIFFS for where the oracle is wrong).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { ARTI_GROUPS } from "@/lib/arkh/stats/defs/artifact-find";
import { computeArkhDamage, DMG_COLLECTOR_MAP } from "@/lib/arkh/computeDamage";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";
import { coin } from "@/lib/arkh/stats/systems/coin/coin";
import { combineMultikillPools, computeArkhMultikillPools } from "@/lib/arkh/computeMultikill";
import { MK_NODES, MK_POOLS } from "@/lib/arkh/stats/defs/multikill";
import { statCtx } from "@/lib/arkh/computeStat";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import { DR2_GROUPS } from "@/lib/arkh/stats/defs/drop-rate-v2";
import { AFK_POOLS, afkRate } from "@/lib/arkh/stats/defs/afk-gains";
import { DMG_LAYERS, DMG_MASTERY, DMG_RAT, dmgMastery, dmgMax } from "@/lib/arkh/stats/defs/damage";
import { charClassData } from "@/lib/arkh/save/data";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeAccuracy, computePlayerSpeed, computeStarSignBonus, computeWeaponPower, rval } from "@/lib/arkh/stats/systems/common/derived-damage";
import { computePlayerHPmax, computePlayerMPmax } from "@/lib/arkh/stats/systems/common/derived-stats";
import { computeStatueBonusGiven, computeTotalStat } from "@/lib/arkh/stats/systems/common/stats";
import { computeCardLv } from "@/lib/arkh/stats/systems/common/cards";
import { SIGN_BONUSES } from "@/lib/arkh/stats/systems/common/starSign";
import { goldFoodBonuses, gfoodBonusMULTIBreakdown } from "@/lib/arkh/stats/systems/common/goldenFood";
import { computePrayerReal, prayersReal } from "@/lib/arkh/stats/systems/w3/prayer";
import { totalGreenSigils } from "@/lib/arkh/stats/systems/w2/alchemy";
import { computeSummUpgBonus } from "@/lib/arkh/stats/systems/w6/summoning";
import { talent as talentResolver } from "@/lib/arkh/stats/systems/common/talent";
import { votingBonusz } from "@/lib/arkh/stats/systems/w2/voting";
import type { ArkhNode } from "@/lib/arkh/node";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { ClassStatTypes, ITEMS, PowerSuffixes } from "@/lib/game/data";
import { ReturnClasses } from "@/lib/game/njs/ReturnClasses";
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

// ---- Damage and the stats ----
// One compute per (save, ci, map) gives every Damage leaf and all 7 stats (Ruling S). A path save is also cached on
// disk, so a second run (and every porting task's loop) costs no lib/arkh compute: the file is keyed by the sha1 of the
// save bytes and stores the content hash of web/lib/arkh/**/*.ts (the oracle itself): a lib/arkh change is a miss.
// An object save stays in memory (identity-keyed, computed on a structuredClone). lib/arkh keeps module-level state,
// so each compute runs to completion before the next.

export type ArkhStat = "str" | "agi" | "wis" | "luk" | "maxHp" | "maxMp" | "accuracy";
const MAIN_STATS = { str: "STR", agi: "AGI", wis: "WIS", luk: "LUK" } as const;

type OracleEntry = { leaves: Record<string, number>; stats: Record<ArkhStat, number> };
// `afk` (character -> map -> leaves) is a section of its own: the AFK leaves never touch the Damage entries.
type DiskFile = { arkhHash: string; entries: Record<string, Record<string, OracleEntry>>; afk?: Record<string, Record<string, Record<string, number>>>; exp?: Record<string, Record<string, TreeEntry>>; dr?: Record<string, Record<string, TreeEntry>>; coin?: Record<string, Record<string, TreeEntry>> };
// the leaves of a descriptor's tree by source id, and lib/arkh's own total (EXP, Drop Rate, Coin)
type TreeEntry = { leaves: Record<string, number>; total: number };

// source id -> where it sits in the tree. Every id is unique across DMG_LAYERS, DMG_MASTERY and DMG_RAT (checked in the test).
const DMG_SLOT = new Map<string, { child: number; step: number; src: number }>();
DMG_LAYERS.forEach((layer, child) =>
  layer.steps.forEach((s, step) => {
    if ("sources" in s) s.sources.forEach((id, src) => DMG_SLOT.set(id, { child, step, src }));
  })
);
DMG_RAT.sources.forEach((id, src) => DMG_SLOT.set(id, { child: DMG_LAYERS.length, step: -1, src }));
DMG_MASTERY.sources.forEach((id, src) => DMG_SLOT.set(id, { child: DMG_LAYERS.length + 1, step: -1, src }));

function flattenLeaves(tree: ArkhNode): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, at] of DMG_SLOT) {
    const top = tree.children![at.child];
    const leaf = (at.step < 0 ? top : top.children![at.step]).children?.[at.src];
    if (!leaf) throw new Error(`arkhDamageLeaves: lib/arkh's tree has no node for "${id}"`);
    out[id] = leaf.val;
  }
  return out;
}

function computeEntry(parsed: any, ci: number, map: number, fresh: () => any): OracleEntry {
  const leaves = flattenLeaves(computeArkhDamage(parsed, ci, map).tree);
  loadSaveData(fresh()); // the damage compute may have written into `parsed`: the stats get their own copy
  const ctx = { saveData, charIdx: ci, activeCharIdx: ci };
  const stats = {
    str: computeTotalStat(MAIN_STATS.str, ci, ctx).computed,
    agi: computeTotalStat(MAIN_STATS.agi, ci, ctx).computed,
    wis: computeTotalStat(MAIN_STATS.wis, ci, ctx).computed,
    luk: computeTotalStat(MAIN_STATS.luk, ci, ctx).computed,
    maxHp: computePlayerHPmax(ci, ctx).val,
    maxMp: computePlayerMPmax(ci, ctx).val,
    accuracy: computeAccuracy(ci, ctx),
  } satisfies Record<ArkhStat, number>;
  return { leaves, stats };
}

/** The content hash of web/lib/arkh/**\/*.ts: what the disk cache is valid for. Computed once per process. */
let arkhHash: string | undefined;
export function arkhSourceHash(): string {
  if (arkhHash) return arkhHash;
  const h = createHash("sha1");
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".ts")) h.update(`${relative(WEB, p)}\0`).update(readFileSync(p)).update("\0");
    }
  };
  walk(join(WEB, "lib/arkh"));
  // Ruling B moved the oracle's shape and ids into these display configs: a change there invalidates the cache too
  for (const f of ["lib/afkGains/layers.ts", "lib/damage/layers.ts", "lib/expMulti/layers.ts", "lib/dropRateV2/layers.ts", "lib/coinMulti/layers.ts", "lib/multikill/layers.ts", "lib/statTracker/groups.ts", "lib/artifactFind/groups.ts"]) h.update(`${f}\0`).update(readFileSync(join(WEB, f))).update("\0");
  return (arkhHash = h.digest("hex"));
}

let cacheDir: string | null = resolve(WEB, "scripts/updater/golden/.cache/oracle");
/** Point the disk cache elsewhere (tests), or `null` to turn it off. Drops what was loaded from the old folder. */
export function setOracleCacheDir(dir: string | null): void {
  cacheDir = dir;
  diskByPath.clear();
}
/** Pretend lib/arkh's source hash is `h` (tests of the invalidation); `undefined` recomputes it. */
export function setArkhSourceHash(h: string | undefined): void {
  arkhHash = h;
  diskByPath.clear();
}

const diskByPath = new Map<string, { file: string; data: DiskFile }>();
const entryByObject = new WeakMap<object, Map<string, OracleEntry>>();

function diskOf(save: string): { file: string; data: DiskFile } {
  let d = diskByPath.get(save);
  if (!d) {
    const bytes = readFileSync(save);
    const file = cacheDir ? join(cacheDir, `${createHash("sha1").update(bytes).digest("hex")}.json`) : "";
    let data: DiskFile = { arkhHash: arkhSourceHash(), entries: {} };
    if (file && existsSync(file)) {
      try {
        const on = JSON.parse(readFileSync(file, "utf8")) as DiskFile;
        if (on.arkhHash === data.arkhHash) data = on; // a different lib/arkh hash is a miss
      } catch {
        /* unreadable cache file: recompute */
      }
    }
    diskByPath.set(save, (d = { file, data }));
  }
  return d;
}

function persist(d: { file: string; data: DiskFile }): void {
  if (!d.file) return;
  mkdirSync(dirname(d.file), { recursive: true });
  writeFileSync(d.file, JSON.stringify(d.data));
}

/**
 * The cache every (character, map) section shares: an object save is computed once on a structuredClone and kept by identity, a path
 * save is stored in the `section` of its sha1-keyed disk file (`{ [ci]: { [map]: T } }`). `compute` gets a parsed copy it may write into.
 */
type Section = "afk" | "exp" | "dr" | "coin" | "mk";
function sectionCache<T>(section: Section, compute: (parsed: any, ci: number, map: number) => T): (save: unknown, ci: number, map: number) => T {
  const byObject = new WeakMap<object, Map<string, T>>();
  return (save, ci, map) => {
    if (typeof save !== "string") {
      let per = byObject.get(save as object);
      if (!per) byObject.set(save as object, (per = new Map()));
      const key = `${ci}@${map}`;
      let e = per.get(key);
      if (!e) per.set(key, (e = compute(structuredClone(save), ci, map)));
      return e;
    }
    const d = diskOf(save);
    const slot = (((d.data as Record<string, any>)[section] ??= {})[ci] ??= {}) as Record<string, T>;
    let e = slot[map];
    if (!e) {
      e = slot[map] = compute(JSON.parse(readFileSync(save, "utf8")), ci, map);
      persist(d);
    }
    return e;
  };
}

function entryOf(save: unknown, ci: number, map: number): OracleEntry {
  if (typeof save !== "string") {
    let per = entryByObject.get(save as object);
    if (!per) entryByObject.set(save as object, (per = new Map()));
    const key = `${ci}@${map}`;
    let e = per.get(key);
    if (!e) per.set(key, (e = computeEntry(structuredClone(save), ci, map, () => structuredClone(save))));
    return e;
  }
  const d = diskOf(save);
  const slot = ((d.data.entries[ci] ??= {}) as Record<string, OracleEntry>);
  let e = slot[map];
  if (!e) {
    const text = readFileSync(save, "utf8");
    e = slot[map] = computeEntry(JSON.parse(text), ci, map, () => JSON.parse(text));
    persist(d);
  }
  return e;
}

/**
 * Every Damage source's `val` in lib/arkh's tree for character `ci` on `map`, by id: the layer, then the step of
 * DMG_LAYERS, then the index in the step's `sources` (Mastery and the arena are groups of their own). `save` is a
 * parsed envelope (memory cache by identity: do not edit it between calls) or the PATH of a save file (also cached on disk).
 */
export const arkhDamageLeaves = (save: unknown, ci: number, map: number): Record<string, number> => entryOf(save, ci, map).leaves;

/** One source of `arkhDamageLeaves`. Throws on an id that is not in the descriptor. */
export function arkhDamageLeaf(save: unknown, ci: number, map: number, sourceId: string): number {
  if (!DMG_SLOT.has(sourceId)) throw new Error(`arkhDamageLeaf: "${sourceId}" is not a Damage source`);
  return arkhDamageLeaves(save, ci, map)[sourceId];
}

// every pool key of the descriptor (layers, Mastery, the arena) -> its source ids; keys are unique (arkhOracle.test checks it)
const DMG_POOL = new Map<string, readonly string[]>([
  ...DMG_LAYERS.flatMap((l) => l.steps.flatMap((s) => ("sources" in s ? [[s.key, s.sources] as const] : []))),
  [DMG_MASTERY.key, DMG_MASTERY.sources],
  [DMG_RAT.key, DMG_RAT.sources],
]);

/** Every step key of the descriptor, with Mastery's and the arena's (what arkhOracle.test checks for duplicates). */
export const arkhDamagePoolKeys = (): string[] => [...DMG_LAYERS.flatMap((l) => l.steps.map((s) => s.key)), DMG_MASTERY.key, DMG_RAT.key];

/**
 * lib/arkh's Max damage and Mastery for character `ci` on `map`: its own dmgMax / dmgMastery (what its combine() returns) over the
 * leaves of arkhDamageLeaves, so a total costs no lib/arkh compute once the leaves are on disk (arkhOracle.test checks it against
 * computeArkhDamage). `save` as in arkhDamageLeaves.
 */
export function arkhDamage(save: unknown, ci: number, map: number): { max: number; mastery: number } {
  const leaves = arkhDamageLeaves(save, ci, map);
  const valsOf = (key: string) => (DMG_POOL.get(key) ?? []).map((id) => leaves[id]);
  return { max: dmgMax(valsOf), mastery: dmgMastery(valsOf) };
}

/**
 * The 7 stats lib/readings/compute.ts compares the readings with, from ONE loadSaveData (the same lib/arkh calls).
 * Map-independent: it shares the entry of the collector map (251), so a loop over leaves on 251 computes each character once.
 */
export const arkhStats = (save: unknown, ci: number): Record<ArkhStat, number> => entryOf(save, ci, DMG_COLLECTOR_MAP).stats;

export const arkhStat = (save: unknown, ci: number, stat: ArkhStat): number => arkhStats(save, ci)[stat];

/**
 * lib/arkh's move speed for character `ci` of the save at `path`, a multiplier to two decimals (1.75 = 175%), as PlayerSpeedBonus
 * @4139326 returns it. Not one of the cached stats: computed from a fresh load each call.
 */
export function arkhSpeed(path: string, ci: number): number {
  loadSaveData(JSON.parse(readFileSync(path, "utf8")));
  return computePlayerSpeed(ci, { saveData, charIdx: ci, activeCharIdx: ci } as never);
}

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
 * Session cache: the game builds DNSM.SetBonusTOTz once per session, from the equipment of whichever character asks first, and rebuilds
 * it only from UI code (`GetSetBonus(..., -1)` @7032277, @12633316), so the game shows this value only if that first read was on the
 * character; lib/game models "the cache as built for the current character" (see GetSetBonus.ts), as Minehead.ts does for button3.
 */
const GODSHARD_WORN = "GetSetBonus Bonus @11098422 gives the God Shard set's bonus (15) to a set worn whole (PartsOn 11 >= PartsReq 11) as well as to one permanently unlocked in OptionsListAccount[379]; lib/arkh's WinBonus counts it only when OptionsListAccount[379] names it, and this account's is 0. N.js builds that table (DNSM.SetBonusTOTz) once per session from the equipment of whichever character asks first and rebuilds it only from UI code (GetSetBonus(..., -1) @7032277, @12633316), so the game shows this only when the session's first read was on that character: lib/game models the cache as built for the current character";

/**
 * The character stats (Task 3): why lib/arkh's STR differs, by reason. Each reason is also a "seed" (statSeeds below): the lib/arkh number
 * for the one term, which, put in lib/game's cache in place of its own, makes lib/game equal lib/arkh (stats.test.ts checks every pair).
 * "tomeW8" is the stat's Tome bubble (W8, A9, M9), "signs" its two star-sign keys.
 */
export const STAT_WHY: Record<string, string> = {
  vote2:
    `lib/arkh's AllStatPCT adds votingBonusz(2, undefined), the vote's bare value; N.js ArbitraryCode("AllStatPCT") @4061538 adds Summoning("VotingBonusz",2,0), which is NinjaInfo[38][1 + 3b] times VotingBonuszMulti while the vote is active (@10953438)`,
  gfood:
    `lib/arkh's golden food multi has min(4 x CardLv(cropfallEvent1) + 5 x CardLv(anni5Event1), 50) and the vote 26 without its multi; N.js GoldFoodBonuses @5056708 has min(4 x CardLv(cropfallEvent1), 50) + min(5 x CardLv(anni5Event1), 50) (@5057838) and Summoning("VotingBonusz",26,0) (@10953438). Seeded as two causes on their own inputs, gfoodCap (the card term) and gfoodVote26 (the vote), never as the whole GoldFoodBonuses value; the golden food multi's other differences are their own reasons: gfoodSign69 (star sign 69, below) and fam68 (Family Bonus 68, a factor of the talent 144 term)`,
  gfoodSign69:
    `GfoodBonusMULTI adds DNSM.StarSigns["69"] (Beanbie_Major; GoldFoodBonuses @5056708). N.js StarSigns @6540624 fills that map only with the signs StarSignsUnlocked has, and this account lacks sign 69, so the term is 0; lib/arkh counts it as 20 (starSignDropVal(69)) without that check. Seeding the key with lib/arkh's number closes the gap on its own`,
  fam68:
    `N.js AllTalentLV @4085148 reads DNSM.FamBonusQTYs["68"] as TalentCalc(-3) @4496063 leaves it (lib/arkh's own computeFamBonusQTYs gives the same number). lib/arkh's talent resolver works out the level of talent 144 (Family Guy) for that buff with forceSuperActive: true (talent.ts:1006-1010), which adds the Spelunk super-talent levels although 144 is not in the character's active preset (Spelunk[20+ci+12*preset] has no 144; e.g. 337 vs 222 on Ash_EB#0); N.js AllTalentLV adds AllTalMaxSUPERdn only when the talent is in that list`,
  tomeW8:
    "the Tome Strength bubble W8 is times floor(max(0, Tome - 5000) / 2000) (TalentCalc(-2) @4489669); lib/arkh's Tome total is IdleonToolbox's parsedData, lib/game's is lib/tome (Ruling K)",
  signs:
    "lib/arkh's STR star signs (computeStarSignStatBonuses, its own comment says it counts every listed sign) count a sign the Rift enables that StarSignsUnlocked lacks; N.js StarSigns @6540624 adds sign k of the first enabledStarSigns only when StarSignsUnlocked has StarSigns[k][0]",
  comp0: COMPANION_0_GATE,
  statues:
    "N.js ArbitraryCode StatueBonusGiven<n> @4039757 reads GA(\"StatueLevels\")[n][0], the current character's (the load fills it from StatueLevels_<player>); lib/arkh's computeStatueBonusGiven reads one list for every character (statueData, the first character's StatueLevels_0). They differ on a save whose characters' statue levels differ (1st_Giri, CSver 33; 24632463's statue 1)",
  pray6:
    "lib/arkh's accuracy (computePrayerReal(6, 0)) and its Damage prayer15 leaf (stats/systems/damage/damage.ts:686, computePrayerReal(15, 0)) read the equipped-prayer branch only; N.js prayersReal @7829537 has a second branch: with the Super Bit 9 or 39 and no prayer equipped (DNSM.PrayNonEq, every PrayersActive slot -1), every unlocked prayer but 5 gives round((.2 x SB9 + .2 x SB39 + .2 x SB53) x PrayerInfo[d][3] x max(1, 1 + (lv - 1) / 10)) (lib/arkh's own prayersReal has it; its accuracy does not call it)",
  vault4:
    "N.js TotalStats(\"Accuracy\") @4185692 adds Summoning(\"VaultUpgBonus\",4,0), the Vault's Bullseye (UpgVault[4] x UpgradeVault[4][5] x (1 + vault 32 / 100), @10893206); lib/arkh's accuracy adds computeSummUpgBonus(4), the Summoning upgrade 4 (Summon[0][4] x SummonUPG[4][6]), another table. It shows only where TotalStats(\"Accuracy\") is not lost below 1e-9 of the (DN / 4)^1.4 term",
  buff273:
    "lib/arkh's computePlayerSpeed has no GetBuffBonuses(273,1); N.js PlayerSpeedBonus @4139326 adds it (@4140733) with talent 266, the PctMoveSpd stamp and OptionsListAccount[438], and GetBuffBonuses @4279371 reads _BuffIDsOn, which the HUD actor fills from the save's BuffsActive (@4931241): a character whose saved BuffsActive has 273 (Strafe) running gets its talent number",
  signsSpeed:
    "lib/arkh's MoveSpd star signs (computeStarSignBonus) count a sign the Rift enables that StarSignsUnlocked lacks; N.js StarSigns @6540624 adds sign k of the first enabledStarSigns only when StarSignsUnlocked has StarSigns[k][0] (PlayerSpeedBonus reads DNSM.StarSigns.MoveSpd)",
  buff288:
    "lib/arkh's accuracy stubs GetBuffBonuses(288,2) to 0 (\"runtime buff, not in save\"); N.js GetBuffBonuses @4279371 reads _BuffIDsOn, which the HUD actor fills from the save's BuffsActive (@4931241), so a character whose saved BuffsActive has 288 running gets its talent number (curve 2), as for buff 94",
  redox:
    "N.js counts the items of _ItemsAndStorageOWNED (ActorEvents_232 @5989516) from the current character's inventory (CountInventory @7042726 reads InventoryOrder) plus the storage chest; lib/arkh's invStorageOwned (stats/systems/w6/upg-totals.ts:79) adds every character's inventory",
  powerSuffix:
    "N.js TotalStats @4158761 counts a power stat item by item: on the equipment (EquipmentOrder[0]) an item whose name contains one of PowerSuffixes (Mining, Choppin, Fishing, Catching, Trapping, Worship, Dung) gives its Weapon_Power to that skill's power only (@4159070: \"YESstats\" when the suffix is the power's own), so a choppin hat or a fishing ring adds nothing to Weapon_Power; lib/arkh's computeWeaponPower (derived-damage.ts:220) adds every equipped item's Weapon_Power",
  signsDmg:
    "lib/arkh's computeStarSignBonus (starSign.ts:48) adds every sign of its SIGN_BONUSES table for the key (PctDmg: signs 0, 32, 51, 53, 54, 70), skipping only negative values below the enabled count; N.js StarSigns @6540624 adds a sign only when it is worn or is one of the first RiftStuff(\"enabledStarSigns\") whose name StarSignsUnlocked has (the same cause as \"signs\", for the Damage % key)",
  signsExp:
    "lib/arkh's Main EXP star signs (computeStarSignBonus(\"MainXP\")) count a sign the Rift enables that StarSignsUnlocked lacks; N.js StarSigns @6540624 adds sign k of the first enabledStarSigns only when StarSignsUnlocked has StarSigns[k][0] (ExpMulti(0) @4260536 reads DNSM.StarSigns.MainXP; proved by PROOF_PATCHES.signsExp, the missing sign names added to the character): the cause of `signs` and `signsSpeed` on the Main EXP key",
  lukSnapshot:
    "N.js ExpMulti(0) @4260536 starts from a live `x._customBlock_TotalStats(\"LUK\")` for the LUK curve (and the curve x talent 35 term); lib/arkh's exp.ts `luk` and `talent35` read `statList[ci][3]`, PVStatList_<ci>[3], which the game writes at save time as `PersonalValuesMap.StatList = [TotalStats(\"STR\"), TotalStats(\"AGI\"), TotalStats(\"WIS\"), TotalStats(\"LUK\"), Lv0[0]]` (@15076361): a snapshot of the total, equal to lib/game's value on a fresh save and stale on an older one. Proved by giving lib/arkh's envelope lib/game's TotalStats(\"LUK\") in PVStatList_<ci>[3]",
  holesLoad251:
    "N.js runs the load step DoOnceREAL < 251.3 (OnPlayStart3 @6420350) on an older save: when Holes[24][0..4] are all above 30 it zeroes Holes[22][10..15], the levels of the measurements 10 to 15 (lib/game/migrations ports it). lib/arkh reads the save as stored: HourZero (DoOnceREAL 248.3) keeps its measurement 15 at level 197 there, while the game has it at 0. Proved by giving lib/arkh's envelope the Holes[22] the load step leaves",
  statSnapshot:
    "N.js ArbitraryCode(\"MonsterCash\") @4047005 reads a live `x._customBlock_TotalStats(\"STR\")` (\"AGI\", \"WIS\") for the Cash bubbles; lib/arkh's coin.ts bubbleSTR, bubbleAGI and bubbleWIS read `statList[ci][0..2]`, PVStatList_<ci>[0..2], the snapshot the game writes at save time (@15076361, the cause of lukSnapshot): stale on any save older than its last stat change. Proved by giving lib/arkh's envelope lib/game's TotalStats in PVStatList_<ci>[i]",
  glimboUnleveled:
    "N.js multiplies the Drop Rate by Math.max(1, Minehead(\"GlimboDRmulti\",0,0)) (@4195647), and GlimboDRmulti (@11198811) is `1 <= Grid_Bonus(168, 0) ? 1 + Grid_Bonus(168, 2) / 100 : 1`: 1 while grid square 168 has no value. lib/arkh's leaf is its grid helper's node, 0 for a square below level 1 (stats/systems/w4/lab.ts grid.resolve). The group is max(1, ·), so the total is the same; proved by lib/game's Grid_Bonus(168, 0) being below 1 and lib/arkh's leaf being that 0",
  buff108:
    "a product decision of the Damage page (the plan's Global Constraints): the active buff 108 is not counted, a runtime leaf in lib/game; lib/arkh counts it while the saved BuffsActive has it, and N.js PlayerHPmax @4147120 multiplies the % by 1 - GetBuffBonuses(108,1) / 100",
};

/** [save, reason, characters (absent = all)], found by seeding each mismatch (stats.test.ts proves each). */
type DiffRow = readonly [save: string, reason: string, cis?: readonly number[]];
const STAT_DIFFS: Partial<Record<ArkhStat | "speed", readonly DiffRow[]>> = {
  str: [
  ["100Cotton.json", "vote2"],
  ["Ash_EB.json", "fam68", [0]],
  ["AvacadoSqueeze.json", "gfood"],
  ["B0schi.json", "gfood"],
  ["BopeBrancis.json", "gfood"],
  ["Chalalaa.json", "gfood"],
  ["Crezar.json", "gfood"],
  ["Einyen.json", "gfood"],
  ["Fanmail.json", "gfood"],
  ["FenrirAdra.json", "gfood"],
  ["Flipper143.json", "tomeW8"],
  ["Flipper143.json", "gfood"],
  ["Fluffle_Puff.json", "gfood"],
  ["Frans813.json", "gfood"],
  ["Frostymart.json", "fam68", [0]],
  ["FrozenBody.json", "fam68", [1]],
  ["Glaives.json", "signs"],
  ["Glaives.json", "gfoodSign69"],
  ["GoddessFreia.json", "gfood"],
  ["Jrod11.json", "vote2"],
  ["Jrod11.json", "fam68", [4, 7]],
  ["Koweabooo.json", "tomeW8"],
  ["Koweabooo.json", "fam68", [8]],
  ["Koweabooo.json", "comp0", [10]],
  ["MarleyLongbott.json", "gfood"],
  ["Maspoofio.json", "gfood"],
  ["Maspoofio.json", "fam68", [7]],
  ["PerkOne.json", "gfood"],
  ["Rinkzate.json", "vote2"],
  ["Shironee.json", "gfood"],
  ["Snowyzxd.json", "gfood"],
  ["TinTim.json", "gfood"],
  ["TomerBuff.json", "gfood"],
  ["Yosh6400.json", "gfood"],
  ["airbolt.json", "gfood"],
  ["astarm.json", "gfood"],
  ["big_guy69123.json", "signs"],
  ["big_guy69123.json", "gfoodSign69"],
  ["big_guy69123.json", "fam68", [5]],
  ["biggums3.json", "gfood"],
  ["kONYYY.json", "gfood"],
  ["liiiiiiiiiiiig.json", "gfood"],
  ["ryujinsan.json", "gfood"],
  ["zadavi.json", "gfood"],
  ["01010111001.json", "vote2"],
  ["0xEXCEED.json", "vote2"],
  ["0xEXCEED.json", "fam68", [5]],
  ["26515665165165.json", "vote2"],
  ["26515665165165.json", "gfood"],
  ["arkhe-2026-09-23.json", "tomeW8"],
  ["arkhe-it-profile-2026-09-24.json", "vote2"]
  ],
  agi: [
    ["100Cotton.json", "vote2"],
    ["Ash_EB.json", "fam68", [0]],
    ["AvacadoSqueeze.json", "gfood"],
    ["B0schi.json", "gfood"],
    ["BopeBrancis.json", "gfood"],
    ["Chalalaa.json", "gfood"],
    ["Crezar.json", "gfood"],
    ["Einyen.json", "gfood"],
    ["Fanmail.json", "gfood"],
    ["FenrirAdra.json", "gfood"],
    ["Flipper143.json", "gfood"],
    ["Flipper143.json", "tomeW8"],
    ["Fluffle_Puff.json", "gfood"],
    ["Frans813.json", "gfood"],
    ["Frostymart.json", "fam68", [0]],
    ["FrozenBody.json", "fam68", [1]],
    ["Glaives.json", "gfoodSign69"],
    ["Glaives.json", "signs"],
    ["GoddessFreia.json", "gfood"],
    ["Jrod11.json", "vote2"],
    ["Jrod11.json", "fam68", [4, 7]],
    ["Koweabooo.json", "tomeW8"],
    ["Koweabooo.json", "fam68", [8]],
    ["Koweabooo.json", "comp0", [10]],
    ["MarleyLongbott.json", "gfood"],
    ["Maspoofio.json", "gfood"],
    ["Maspoofio.json", "fam68", [7]],
    ["PerkOne.json", "gfood"],
    ["Rinkzate.json", "vote2"],
    ["Shironee.json", "gfood"],
    ["Snowyzxd.json", "gfood"],
    ["TinTim.json", "gfood"],
    ["TomerBuff.json", "gfood"],
    ["Yosh6400.json", "gfood"],
    ["airbolt.json", "gfood"],
    ["astarm.json", "gfood"],
    ["big_guy69123.json", "gfoodSign69"],
    ["big_guy69123.json", "signs"],
    ["big_guy69123.json", "fam68", [5]],
    ["biggums3.json", "gfood"],
    ["kONYYY.json", "gfood"],
    ["liiiiiiiiiiiig.json", "gfood"],
    ["ryujinsan.json", "gfood"],
    ["zadavi.json", "gfood"],
    ["01010111001.json", "vote2"],
    ["0xEXCEED.json", "vote2"],
    ["0xEXCEED.json", "fam68", [5]],
    ["26515665165165.json", "vote2"],
    ["26515665165165.json", "gfood"],
    ["arkhe-2026-09-23.json", "tomeW8"],
    ["arkhe-it-profile-2026-09-24.json", "vote2"],
  ],
  wis: [
    ["100Cotton.json", "vote2"],
    ["Ash_EB.json", "fam68", [0]],
    ["AvacadoSqueeze.json", "gfood"],
    ["B0schi.json", "gfood"],
    ["BopeBrancis.json", "gfood"],
    ["Chalalaa.json", "gfood"],
    ["Crezar.json", "gfood"],
    ["Dandy2009.json", "signs"],
    ["Dasvidanya.json", "signs"],
    ["Einyen.json", "gfood"],
    ["Fanmail.json", "gfood"],
    ["FenrirAdra.json", "gfood"],
    ["Flipper143.json", "gfood"],
    ["Flipper143.json", "tomeW8"],
    ["Fluffle_Puff.json", "gfood"],
    ["Frans813.json", "gfood"],
    ["Frostymart.json", "fam68", [0]],
    ["FrozenBody.json", "fam68", [1]],
    ["GIM_SSS.json", "signs"],
    ["Glaives.json", "gfoodSign69"],
    ["Glaives.json", "signs"],
    ["GoddessFreia.json", "gfood"],
    ["Jrod11.json", "vote2"],
    ["Jrod11.json", "fam68", [4, 7]],
    ["Koweabooo.json", "tomeW8"],
    ["Koweabooo.json", "fam68", [8]],
    ["Koweabooo.json", "comp0", [10]],
    ["MarleyLongbott.json", "gfood"],
    ["Maspoofio.json", "gfood"],
    ["Maspoofio.json", "fam68", [7]],
    ["PerkOne.json", "gfood"],
    ["PulseIRL.json", "signs"],
    ["Rinkzate.json", "vote2"],
    ["Shironee.json", "gfood"],
    ["Snowyzxd.json", "gfood"],
    ["TinTim.json", "gfood"],
    ["TomerBuff.json", "gfood"],
    ["Yosh6400.json", "gfood"],
    ["airbolt.json", "gfood"],
    ["astarm.json", "gfood"],
    ["big_guy69123.json", "gfoodSign69"],
    ["big_guy69123.json", "signs"],
    ["big_guy69123.json", "fam68", [5]],
    ["biggums3.json", "gfood"],
    ["kONYYY.json", "gfood"],
    ["liiiiiiiiiiiig.json", "gfood"],
    ["ryujinsan.json", "gfood"],
    ["zadavi.json", "gfood"],
    ["01010111001.json", "vote2"],
    ["0xEXCEED.json", "vote2"],
    ["0xEXCEED.json", "fam68", [5]],
    ["26515665165165.json", "vote2"],
    ["26515665165165.json", "gfood"],
    ["arkhe-2026-09-23.json", "tomeW8"],
    ["arkhe-it-profile-2026-09-24.json", "vote2"],
  ],
  luk: [
    ["100Cotton.json", "vote2"],
    ["Ash_EB.json", "fam68", [0]],
    ["AvacadoSqueeze.json", "gfood"],
    ["B0schi.json", "gfood"],
    ["BopeBrancis.json", "gfood"],
    ["Chalalaa.json", "gfood"],
    ["Crezar.json", "gfood"],
    ["Dasvidanya.json", "signs"],
    ["Einyen.json", "gfood"],
    ["Fanmail.json", "gfood"],
    ["FenrirAdra.json", "gfood"],
    ["Flipper143.json", "gfood"],
    ["Fluffle_Puff.json", "gfood"],
    ["Frans813.json", "gfood"],
    ["Frostymart.json", "fam68", [0]],
    ["FrozenBody.json", "signs"],
    ["FrozenBody.json", "fam68", [1]],
    ["Glaives.json", "gfoodSign69"],
    ["Glaives.json", "signs"],
    ["GoddessFreia.json", "gfood"],
    ["Jrod11.json", "vote2"],
    ["Jrod11.json", "fam68", [4, 7]],
    ["Koweabooo.json", "fam68", [8]],
    ["Koweabooo.json", "comp0", [10]],
    ["MarleyLongbott.json", "gfood"],
    ["Maspoofio.json", "gfood"],
    ["Maspoofio.json", "fam68", [7]],
    ["PerkOne.json", "gfood"],
    ["Rinkzate.json", "vote2"],
    ["Shironee.json", "gfood"],
    ["Snowyzxd.json", "gfood"],
    ["TinTim.json", "gfood"],
    ["TomerBuff.json", "gfood"],
    ["Yosh6400.json", "gfood"],
    ["airbolt.json", "gfood"],
    ["astarm.json", "gfood"],
    ["big_guy69123.json", "gfoodSign69"],
    ["big_guy69123.json", "signs"],
    ["big_guy69123.json", "fam68", [5]],
    ["biggums3.json", "gfood"],
    ["kONYYY.json", "gfood"],
    ["liiiiiiiiiiiig.json", "gfood"],
    ["ryujinsan.json", "gfood"],
    ["zadavi.json", "gfood"],
    ["01010111001.json", "vote2"],
    ["0xEXCEED.json", "vote2"],
    ["0xEXCEED.json", "fam68", [5]],
    ["26515665165165.json", "vote2"],
    ["26515665165165.json", "gfood"],
    ["arkhe-it-profile-2026-09-24.json", "vote2"],
  ],
  // Accuracy is built on the class's second stat (PlayerAccTot @4151358): that stat's reasons reach only the characters whose second stat
  // it is, so the rows name them; then accuracy's own (pray6, vault4, buff288, statues). Found by seeding each mismatch, one reason at a time
  accuracy: [
    ["100Cotton.json", "vote2"],
    ["100Cotton.json", "buff288", [9]],
    ["1st_Giri.json", "statues", [3, 10]],
    ["Ash_EB.json", "fam68", [0]],
    ["Ash_EB.json", "pray6"],
    ["AvacadoSqueeze.json", "gfood"],
    ["AvacadoSqueeze.json", "buff288", [9]],
    ["Azza2Bad.json", "buff288", [2]],
    ["B0schi.json", "gfood"],
    ["BopeBrancis.json", "gfood"],
    ["Brokami.json", "pray6", [10]],
    ["Chalalaa.json", "gfood"],
    ["Crezar.json", "gfood"],
    ["Crezar.json", "pray6", [1, 4]],
    ["Dandy2009.json", "signs", [0, 3, 6]],
    ["Dandy2009.json", "vault4"],
    ["Dandy2009.json", "pray6", [10]],
    ["Dasvidanya.json", "signs", [1, 4, 6, 7, 10]],
    ["Drukez.json", "buff288", [4]],
    ["Einyen.json", "gfood"],
    ["Fanmail.json", "gfood"],
    ["FenrirAdra.json", "gfood"],
    ["Flipper143.json", "gfood"],
    ["Flipper143.json", "tomeW8", [0, 1, 2, 3, 4, 5, 7, 8, 9]],
    ["Flipper143.json", "pray6", [10]],
    ["Fluffle_Puff.json", "gfood"],
    ["Frans813.json", "gfood"],
    ["Frostymart.json", "fam68", [0]],
    ["Frostymart.json", "pray6", [9]],
    ["FrozenBody.json", "pray6"],
    ["FrozenBody.json", "vault4", [0, 1, 3, 4, 5, 6, 7, 8, 9, 10]],
    ["FrozenBody.json", "fam68", [1]],
    ["FrozenBody.json", "signs", [8]],
    ["GIM_SSS.json", "signs", [0, 2, 7]],
    ["Glaives.json", "gfoodSign69"],
    ["Glaives.json", "signs"],
    ["Glaives.json", "pray6"],
    ["Glaives.json", "buff288", [1]],
    ["GoddessFreia.json", "gfood"],
    ["Grandesz.json", "buff288", [3]],
    ["Jrod11.json", "vote2"],
    ["Jrod11.json", "fam68", [4, 7]],
    ["Jrod11.json", "pray6", [10]],
    ["Koweabooo.json", "tomeW8", [0, 1, 2, 3, 4, 5, 6, 8, 9]],
    ["Koweabooo.json", "fam68", [8]],
    ["Koweabooo.json", "comp0", [10]],
    ["MarleyLongbott.json", "gfood"],
    ["Maspoofio.json", "gfood"],
    ["Maspoofio.json", "fam68", [7]],
    ["PerkOne.json", "gfood"],
    ["PulseIRL.json", "signs", [0, 3, 4, 5]],
    ["Rinkzate.json", "vote2"],
    ["Rinkzate.json", "buff288", [1]],
    ["Shironee.json", "gfood"],
    ["Snowyzxd.json", "gfood"],
    ["TinTim.json", "gfood"],
    ["TomerBuff.json", "gfood"],
    ["Yosh6400.json", "gfood"],
    ["airbolt.json", "gfood"],
    ["astarm.json", "gfood"],
    ["big_guy69123.json", "gfoodSign69"],
    ["big_guy69123.json", "signs"],
    ["big_guy69123.json", "vault4"],
    ["big_guy69123.json", "pray6", [4, 8, 10]],
    ["big_guy69123.json", "fam68", [5]],
    ["biggums3.json", "gfood"],
    ["bluestar3112.json", "buff288", [6]],
    ["kONYYY.json", "gfood"],
    ["liiiiiiiiiiiig.json", "gfood"],
    ["ryujinsan.json", "gfood"],
    ["ryujinsan.json", "buff288", [9]],
    ["suk69.json", "buff288", [2]],
    ["zadavi.json", "gfood"],
    ["01010111001.json", "vote2"],
    ["01010111001.json", "vault4"],
    ["01010111001.json", "buff288", [3]],
    ["0celot8.json", "vault4"],
    ["0xEXCEED.json", "vote2"],
    ["0xEXCEED.json", "fam68", [5]],
    ["26515665165165.json", "vote2"],
    ["26515665165165.json", "gfood"],
    ["arkhe-2026-09-23.json", "tomeW8", [0, 1, 2, 3, 4, 5, 7, 8, 9, 10]],
    ["arkhe-2026-09-23.json", "buff288", [9]],
    ["arkhe-it-profile-2026-09-24.json", "vote2"],
    ["arkhe-live-2026-09-23.json", "buff288", [9]],
    ["arkhe-live-2026-09-24.json", "buff288", [9]],
  ],
  // The move speed (PlayerSpeedBonus @4139326): AGI's reasons where they move the whole %, and its own (buff273, signsSpeed, statues)
  speed: [
    ["100Cotton.json", "buff273", [4, 9]],
    ["1st_Giri.json", "statues", [3, 10]],
    ["1st_Giri.json", "buff273", [4]],
    ["ARKHE.json", "buff273", [9]],
    ["Ash_EB.json", "buff273", [8]],
    ["AvacadoSqueeze.json", "buff273", [9]],
    ["Azza2Bad.json", "buff273", [2]],
    ["B0schi.json", "buff273", [5]],
    ["Baker333.json", "buff273", [4]],
    ["Bangada.json", "buff273", [0]],
    ["BopeBrancis.json", "buff273", [2]],
    ["Brokami.json", "buff273", [6]],
    ["Bubbafrumps.json", "buff273", [2, 5]],
    ["Chalalaa.json", "buff273", [5]],
    ["Crezar.json", "buff273", [2, 6]],
    ["Dragami.json", "buff273", [2]],
    ["Dragonlzl.json", "buff273", [6]],
    ["Drukez.json", "buff273", [4]],
    ["FenrirAdra.json", "buff273", [1, 5, 9]],
    ["Flipper143.json", "buff273", [5]],
    ["FlipsyThEVicti.json", "buff273", [1, 7, 9]],
    ["Fluffle_Puff.json", "buff273", [3]],
    ["Frostymart.json", "buff273", [2, 7, 10]],
    ["FrozenBody.json", "buff273", [2]],
    ["GIM_SSS.json", "buff273", [4, 9]],
    ["Glaives.json", "buff273", [1]],
    ["GoddessFreia.json", "buff273", [0]],
    ["Grandesz.json", "buff273", [0, 3]],
    ["Hyucan.json", "buff273", [5]],
    ["Jrod11.json", "buff273", [6]],
    ["Koweabooo.json", "buff273", [1]],
    ["MarleyLongbott.json", "buff273", [5]],
    ["Maspoofio.json", "buff273", [2, 4]],
    ["Pontinhas.json", "buff273", [1, 4]],
    ["PulseIRL.json", "buff273", [2]],
    ["Riltin.json", "buff273", [1, 4]],
    ["Rinkzate.json", "buff273", [1, 4]],
    ["Scotchz.json", "buff273", [4]],
    ["Seavik.json", "buff273", [2]],
    ["Shadow_x_Vanish.json", "buff273", [10]],
    ["Snowyzxd.json", "buff273", [3, 7]],
    ["TheSpease.json", "buff273", [7]],
    ["TinTim.json", "buff273", [2, 6, 9]],
    ["TomerBuff.json", "buff273", [5]],
    ["WarSkepp.json", "buff273", [5]],
    ["airbolt.json", "buff273", [5]],
    ["astarm.json", "buff273", [9]],
    ["big_guy69123.json", "signs", [0, 7]],
    ["big_guy69123.json", "signsSpeed"],
    ["biggums3.json", "buff273", [0, 3]],
    ["blickter.json", "buff273", [2]],
    ["bluestar3112.json", "buff273", [4]],
    ["breakinbrad.json", "buff273", [2, 6]],
    ["dida123.json", "buff273", [1, 4]],
    ["enilyn.json", "buff273", [2]],
    ["joelok.json", "buff273", [5]],
    ["liiiiiiiiiiiig.json", "buff273", [3, 5]],
    ["ryujinsan.json", "buff273", [3, 5, 9]],
    ["suk69.json", "buff273", [2, 9]],
    ["xBlackpearl.json", "buff273", [5]],
    ["01010111001.json", "buff273", [3, 8]],
    ["0xEXCEED.json", "buff273", [4]],
    ["24632463.json", "buff273", [1, 4]],
    ["24632463.json", "statues", [3]],
    ["26515665165165.json", "buff273", [2, 5]],
    ["5OhTree.json", "buff273", [7, 9]],
    ["arkhe-2026-09-23.json", "buff273", [9]],
    ["arkhe-live-2026-09-23.json", "buff273", [9]],
    ["arkhe-live-2026-09-24.json", "buff273", [9]],
    ["arkhe-live-2026-10-30.json", "buff273", [9]],
    ["arkhe-live-2026-11-01-postupdate.json", "buff273", [9]],
    ["arkhe-live-2026-11-01.json", "buff273", [9]],
    ["arkhe-live-2026-11-03-arkhe.json", "buff273", [9]],
    ["arkhe-live-2026-11-03-farkhe.json", "buff273", [9]],
    ["arkhe-live-2026-11-03-markhe-noweapon.json", "buff273", [9]],
    ["arkhe-live-2026-11-03-markhe-weapon.json", "buff273", [9]],
  ],
};

/** Max HP's own reasons: the characters whose saved BuffsActive has the buff 108 running, and the per-character statue levels. */
const BUFF_108: readonly DiffRow[] = [
    ["1st_Giri.json", "statues", [3, 10]],
    ["100Cotton.json", "buff108", [0]],
    ["Baker333.json", "buff108", [3]],
    ["Bubbafrumps.json", "buff108", [3]],
    ["Riltin.json", "buff108", [0]],
    ["Shadow_x_Vanish.json", "buff108", [7]],
    ["joelok.json", "buff108", [0]],
    ["ryujinsan.json", "buff108", [0]],
    ["01010111001.json", "buff108", [2]],
    ["26515665165165.json", "buff108", [3]],
];

/**
 * The golden food multi's causes (STAT_WHY.gfood, gfoodSign69, fam68) for a GoldFoodBonuses leaf of `stat`: the cap grouping and the vote 26 on the saves the STR rows
 * name "gfood", the star sign 69, the fam68 of the tc470 rows. `bigGuy` is the characters of big_guy69123 whose leaf is not 0 (a golden food of the effect): its
 * sign 69 and fam68 (character 5) differences show only there.
 */
const GOLDFOOD_ROWS = (stat: "afk" | "exp" | "dr" | "coin", source: string, bigGuy: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) => [
  ...[...new Set(STAT_DIFFS.str!.filter(([, r]) => r === "gfood").map(([save]) => save))].flatMap((save) =>
    (["gfoodVote26", "gfoodCap"] as const).map((reason) => ({ stat, save, source, reason, why: STAT_WHY.gfood }))
  ),
  { stat, save: "Glaives.json", source, reason: "gfoodSign69", why: STAT_WHY.gfoodSign69 },
  ...bigGuy.map((ci) => ({ stat, save: "big_guy69123.json", ci, source, reason: "gfoodSign69", why: STAT_WHY.gfoodSign69 })),
  ...([["Ash_EB.json", 0], ["Frostymart.json", 0], ["FrozenBody.json", 1], ["Jrod11.json", 4], ["Jrod11.json", 7], ["Koweabooo.json", 8], ["big_guy69123.json", 5], ["0xEXCEED.json", 5], ["Maspoofio.json", 7]] as const)
    .filter(([save, ci]) => save !== "big_guy69123.json" || bigGuy.includes(ci))
    .map(([save, ci]) => ({ stat, save, ci, source, reason: "fam68", why: STAT_WHY.fam68 })),
];

/** Sets PVStatList_<ci>[at] (STR, AGI, WIS, LUK: STAT_WHY.lukSnapshot, statSnapshot) of an envelope to `stat`: the proof of a snapshot reason runs lib/arkh on this envelope. */
export function patchLukSnapshot(data: Record<string, unknown>, ci: number, stat: number, at = 3): void {
  const k = `PVStatList_${ci}`;
  const v = data[k];
  const list = (typeof v === "string" ? JSON.parse(v) : [...(v as unknown[])]) as unknown[];
  list[at] = stat;
  data[k] = typeof v === "string" ? JSON.stringify(list) : list;
}

/** [save, characters] whose EXP LUK curve differs from lib/arkh's (found by running expTerms.test.ts without the entries; the test proves each by seeding the base LUK). */
const LUK_BASE_ROWS: readonly (readonly [string, readonly number[]])[] = [["100Cotton.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["1st_Giri.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["21ucky4u.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ARKHE.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AoDCthulhu.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Arlong.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AvacadoSqueeze.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Azza2Bad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["B0schi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Baker333.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bangada.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["BopeBrancis.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bubbafrumps.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Chalalaa.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Cheap_Jokes_ok.json", [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]], ["Crezar.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dandy2009.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dasvidanya.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragonlzl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Drukez.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Einyen.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Exrom.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["F1N4L_1.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fanmail.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FenrirAdra.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["Flipper143.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FlipsyThEVicti.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fluffle_Puff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frans813.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frostymart.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GIM_SSS.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GoddessFreia.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Grandesz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Hyucan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Koweabooo.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MarleyLongbott.json", [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]], ["Maspoofio.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MeatyLock.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Norton_Goldman.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pepega777.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PerkOne.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pontinhas.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PulseIRL.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Riltin.json", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Rinkzate.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Scotchz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Seavik.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Shadow_x_Vanish.json", [0, 3, 4, 5, 7, 8, 9, 10]], ["Shironee.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Skvimpan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Snowyzxd.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TheSpease.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TinTim.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TomerBuff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["WarSkepp.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Yosh6400.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["airbolt.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["astarm.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["big_guy69123.json", [0, 3, 7]], ["biggums3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["blickter.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["bluestar3112.json", [0, 1, 3, 4, 5, 6, 7, 8, 9, 10]], ["breakinbrad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["dida123.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["enilyn.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["haki34.json", [2, 3, 4, 5, 6, 7, 8, 9, 10]], ["hellzd4nt3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["jobenty.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["joelok.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["kONYYY.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["liiiiiiiiiiiig.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["lunaonline.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ryujinsan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["suk69.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["xBlackpearl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["zadavi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["01010111001.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["0celot8.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["0xEXCEED.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["24632463.json", [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]], ["26515665165165.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["5OhTree.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-it-profile-2026-09-24.json", [1, 4, 6, 7, 8, 9]], ["arkhe-live-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-09-24.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-live-2026-10-30.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-01-postupdate.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-01.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-03-arkhe.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-farkhe.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-noweapon.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-weapon.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]]];
const T35_BASE_ROWS: readonly (readonly [string, readonly number[]])[] = [["100Cotton.json", [6]], ["1st_Giri.json", [6]], ["21ucky4u.json", [6]], ["ARKHE.json", [6]], ["AoDCthulhu.json", [9]], ["Arlong.json", [6]], ["Ash_EB.json", [6]], ["AvacadoSqueeze.json", [4]], ["Azza2Bad.json", [6]], ["B0schi.json", [7]], ["Baker333.json", [9]], ["Bangada.json", [6]], ["BopeBrancis.json", [6]], ["Brokami.json", [5]], ["Bubbafrumps.json", [7]], ["Cheap_Jokes_ok.json", [9]], ["Crezar.json", [3]], ["Dandy2009.json", [9]], ["Dasvidanya.json", [6]], ["Dragami.json", [6]], ["Dragonlzl.json", [3]], ["Drukez.json", [6]], ["Einyen.json", [4]], ["Exrom.json", [6]], ["F1N4L_1.json", [6]], ["Fanmail.json", [9]], ["FenrirAdra.json", [6]], ["Flipper143.json", [6]], ["FlipsyThEVicti.json", [6]], ["Fluffle_Puff.json", [6]], ["Frans813.json", [7]], ["Frostymart.json", [6, 8]], ["FrozenBody.json", [8]], ["GIM_SSS.json", [6]], ["Glaives.json", [6]], ["GoddessFreia.json", [8]], ["Grandesz.json", [7]], ["Hyucan.json", [7]], ["Jrod11.json", [3]], ["Koweabooo.json", [7]], ["MarleyLongbott.json", [6]], ["Maspoofio.json", [9]], ["MeatyLock.json", [9]], ["Norton_Goldman.json", [9]], ["Pepega777.json", [7]], ["PerkOne.json", [6]], ["Pontinhas.json", [6]], ["PulseIRL.json", [7]], ["Riltin.json", [6]], ["Rinkzate.json", [6]], ["Scotchz.json", [6]], ["Seavik.json", [6]], ["Shironee.json", [6]], ["Skvimpan.json", [8]], ["Snowyzxd.json", [6]], ["TheSpease.json", [6]], ["TinTim.json", [4, 8]], ["TomerBuff.json", [8]], ["WarSkepp.json", [6]], ["Yosh6400.json", [7]], ["airbolt.json", [7]], ["astarm.json", [6]], ["big_guy69123.json", [7]], ["biggums3.json", [5]], ["blickter.json", [6, 8]], ["bluestar3112.json", [7]], ["breakinbrad.json", [4]], ["dida123.json", [9]], ["enilyn.json", [5]], ["haki34.json", [9]], ["hellzd4nt3.json", [7]], ["jobenty.json", [2]], ["joelok.json", [7]], ["kONYYY.json", [6]], ["liiiiiiiiiiiig.json", [6]], ["lunaonline.json", [9]], ["ryujinsan.json", [6]], ["suk69.json", [8, 10]], ["xBlackpearl.json", [7]], ["zadavi.json", [5]], ["01010111001.json", [7]], ["0celot8.json", [6]], ["0xEXCEED.json", [8]], ["24632463.json", [8]], ["26515665165165.json", [6]], ["5OhTree.json", [4]], ["arkhe-2026-09-23.json", [6]], ["arkhe-it-profile-2026-09-24.json", [6]], ["arkhe-live-2026-09-23.json", [6]], ["arkhe-live-2026-09-24.json", [6]], ["arkhe-live-2026-10-30.json", [6]], ["arkhe-live-2026-11-01-postupdate.json", [6]], ["arkhe-live-2026-11-01.json", [6]], ["arkhe-live-2026-11-03-arkhe.json", [6]], ["arkhe-live-2026-11-03-farkhe.json", [6]], ["arkhe-live-2026-11-03-markhe-noweapon.json", [6]], ["arkhe-live-2026-11-03-markhe-weapon.json", [6]]];

/** [Cash bubble, its pairs whose floor(stat / 250) moves]: lib/game's live TotalStats against PVStatList (found by running coinTerms.test.ts without the entries; the test proves each). */
const COIN_SNAPSHOT_ROWS: readonly (readonly [string, readonly (readonly [string, readonly number[]])[]])[] = [
  ["bubbleSTR", [["100Cotton.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["1st_Giri.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["21ucky4u.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ARKHE.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AoDCthulhu.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Arlong.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AvacadoSqueeze.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Azza2Bad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["B0schi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Baker333.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bangada.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["BopeBrancis.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bubbafrumps.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Chalalaa.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Cheap_Jokes_ok.json", [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]], ["Crezar.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dandy2009.json", [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]], ["Dasvidanya.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragonlzl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Drukez.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Einyen.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Exrom.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["F1N4L_1.json", [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fanmail.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FenrirAdra.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Flipper143.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FlipsyThEVicti.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fluffle_Puff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frans813.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frostymart.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GIM_SSS.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 7, 8, 9, 10]], ["GoddessFreia.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Grandesz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Hyucan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Koweabooo.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MarleyLongbott.json", [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]], ["Maspoofio.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MeatyLock.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Norton_Goldman.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pepega777.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PerkOne.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pontinhas.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PulseIRL.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Riltin.json", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Rinkzate.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Scotchz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Seavik.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Shadow_x_Vanish.json", [0, 3, 4, 5, 7, 8, 9, 10]], ["Shironee.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Skvimpan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Snowyzxd.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TheSpease.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TinTim.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TomerBuff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["WarSkepp.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Yosh6400.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["airbolt.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["astarm.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["big_guy69123.json", [0, 1, 2, 3, 6, 7]], ["biggums3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["blickter.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["bluestar3112.json", [0, 1, 3, 4, 5, 6, 7, 8, 9, 10]], ["breakinbrad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["dida123.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["enilyn.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["haki34.json", [2, 3, 4, 5, 6, 8, 9, 10]], ["hellzd4nt3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["jobenty.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["joelok.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["kONYYY.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["liiiiiiiiiiiig.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["lunaonline.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ryujinsan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["suk69.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["xBlackpearl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["zadavi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["01010111001.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["0celot8.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["0xEXCEED.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["24632463.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["26515665165165.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["5OhTree.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-it-profile-2026-09-24.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-09-24.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-live-2026-10-30.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-01-postupdate.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-01.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-03-arkhe.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-farkhe.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-noweapon.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-weapon.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]]]],
  ["bubbleAGI", [["100Cotton.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["1st_Giri.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["21ucky4u.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ARKHE.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AoDCthulhu.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Arlong.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AvacadoSqueeze.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Azza2Bad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["B0schi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Baker333.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bangada.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["BopeBrancis.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bubbafrumps.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Chalalaa.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Cheap_Jokes_ok.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Crezar.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dandy2009.json", [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]], ["Dasvidanya.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragonlzl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Drukez.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Einyen.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Exrom.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["F1N4L_1.json", [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fanmail.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FenrirAdra.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Flipper143.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FlipsyThEVicti.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fluffle_Puff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frans813.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frostymart.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GIM_SSS.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GoddessFreia.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Grandesz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Hyucan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Koweabooo.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MarleyLongbott.json", [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]], ["Maspoofio.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MeatyLock.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Norton_Goldman.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pepega777.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PerkOne.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pontinhas.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PulseIRL.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Riltin.json", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Rinkzate.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Scotchz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Seavik.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Shadow_x_Vanish.json", [0, 3, 4, 5, 7, 8, 9, 10]], ["Shironee.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Skvimpan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Snowyzxd.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TheSpease.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TinTim.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TomerBuff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["WarSkepp.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Yosh6400.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["airbolt.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["astarm.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["big_guy69123.json", [0]], ["biggums3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["blickter.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["bluestar3112.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["breakinbrad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["dida123.json", [0, 1, 3, 4, 5, 6, 7, 8, 9, 10]], ["enilyn.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["haki34.json", [2, 3, 4, 5, 6, 8, 9, 10]], ["hellzd4nt3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["jobenty.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["joelok.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["kONYYY.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["liiiiiiiiiiiig.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["lunaonline.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ryujinsan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["suk69.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["xBlackpearl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["zadavi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["01010111001.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["0celot8.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["0xEXCEED.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["24632463.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["26515665165165.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["5OhTree.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-it-profile-2026-09-24.json", [0, 1, 4, 5, 6, 7, 8, 9]], ["arkhe-live-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-09-24.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-live-2026-10-30.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-01-postupdate.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-01.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-03-arkhe.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-farkhe.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-noweapon.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-weapon.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]]]],
  ["bubbleWIS", [["100Cotton.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["1st_Giri.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["21ucky4u.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ARKHE.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AoDCthulhu.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Arlong.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["AvacadoSqueeze.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Azza2Bad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["B0schi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Baker333.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bangada.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["BopeBrancis.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Bubbafrumps.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Chalalaa.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Cheap_Jokes_ok.json", [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]], ["Crezar.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dandy2009.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dasvidanya.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragami.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Dragonlzl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Drukez.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Einyen.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Exrom.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["F1N4L_1.json", [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fanmail.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FenrirAdra.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Flipper143.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FlipsyThEVicti.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Fluffle_Puff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frans813.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Frostymart.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GIM_SSS.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["GoddessFreia.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Grandesz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Hyucan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Koweabooo.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MarleyLongbott.json", [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]], ["Maspoofio.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["MeatyLock.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Norton_Goldman.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pepega777.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PerkOne.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Pontinhas.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["PulseIRL.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Riltin.json", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Rinkzate.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Scotchz.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Seavik.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Shadow_x_Vanish.json", [0, 3, 4, 5, 7, 8, 9, 10]], ["Shironee.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Skvimpan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Snowyzxd.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TheSpease.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TinTim.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["TomerBuff.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["WarSkepp.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Yosh6400.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["airbolt.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["astarm.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["big_guy69123.json", [0, 1, 3, 5]], ["biggums3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["blickter.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["bluestar3112.json", [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]], ["breakinbrad.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["dida123.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["enilyn.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["haki34.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["hellzd4nt3.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["jobenty.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["joelok.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["kONYYY.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["liiiiiiiiiiiig.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["lunaonline.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["ryujinsan.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["suk69.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["xBlackpearl.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["zadavi.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["01010111001.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["0celot8.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["0xEXCEED.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["24632463.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["26515665165165.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["5OhTree.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-it-profile-2026-09-24.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-09-23.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-09-24.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["arkhe-live-2026-10-30.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-01-postupdate.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-01.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["arkhe-live-2026-11-03-arkhe.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-farkhe.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-noweapon.json", [1, 2, 3, 4, 5, 6, 7, 9, 10]], ["arkhe-live-2026-11-03-markhe-weapon.json", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]]]],
];

/** STAT_WHY.lukSnapshot for the Drop Rate's LUK curve (proved the same way, on lib/arkh's side). */
const LUK_SNAPSHOT_DR =
  "N.js TotalStats(\"Drop_Rarity\") starts from a live `x._customBlock_TotalStats(\"LUK\")` for DropRateLUK (@4190488); lib/arkh's DR `luk` (lukScaling, stats/systems/common/stats.ts readRawLuk) reads `statList[ci][3]`, PVStatList_<ci>[3], the TotalStats(\"LUK\") snapshot the game writes at save time (@15076361): equal to lib/game's value on a fresh save and stale on an older one. Proved by giving lib/arkh's envelope lib/game's TotalStats(\"LUK\") in PVStatList_<ci>[3]";

/**
 * Where N.js proves lib/arkh wrong and lib/game keeps the N.js value. `save` is the file name of the
 * GOLDEN_SAVES entry, `ci` omitted means every character; `why` cites the `@offset` evidence.
 */
export const KNOWN_ARKH_DIFFS: {
  /** Which tracker `source` belongs to; absent = "artifactFind". For "damage", `source` is a Damage source id; for "afk", an AFK source id (arkhAfkLeaves); for "dr", a DR2_GROUPS source id (arkhDrLeaves). */
  stat?: "artifactFind" | "damage" | "afk" | "exp" | "dr" | "coin" | "mk" | ArkhStat | "speed";
  save: string;
  ci?: number;
  /** The maps the entry covers (absent = every map the term is checked on): a map-dependent EXP term (the medallion gate) differs only on some. */
  maps?: readonly number[];
  source: string;
  /** The STAT_WHY reason whose lib/arkh number (arkhStatSeeds) closes the gap: set on a Damage source, whose `source` is the leaf id. */
  reason?: string;
  why: string;
}[] = [
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
  // Max MP is built on WIS and Max HP on STR: their reasons carry over, and HP adds the active buff 108 where a character has it running
  ...(Object.entries({ ...STAT_DIFFS, maxMp: STAT_DIFFS.wis, maxHp: [...STAT_DIFFS.str!, ...BUFF_108] }) as [ArkhStat | "speed", readonly DiffRow[]][]).flatMap(([stat, rows]) =>
    rows!.flatMap(([save, source, cis]) => (cis ?? [undefined]).map((ci) => ({ stat, save, ...(ci === undefined ? {} : { ci }), source, why: STAT_WHY[source] })))
  ),
  // Task 4: tc470 = GTN(1,470) x stamps / 10. The stamp count agrees; the talent's level carries lib/arkh's fam68 error (Family Bonus 68 in
  // AllTalentLV), which the other TalentCalc terms hide on these characters only because their curves are saturated or the talent is unlearned
  ...(
    [["Ash_EB.json", 0], ["Frostymart.json", 0], ["FrozenBody.json", 1], ["Jrod11.json", 4], ["Jrod11.json", 7], ["Koweabooo.json", 8], ["big_guy69123.json", 5], ["0xEXCEED.json", 5]] as const
  ).map(([save, ci]) => ({ stat: "damage" as const, save, ci, source: "tc470", reason: "fam68", why: STAT_WHY.fam68 })),
  // Task 5: the golden food terms (GoldFoodBonuses "BaseDamage" and "Damage") share the stats' golden food multi, so they carry its three reasons
  // (each proved by seeding lib/arkh's number, equipCards.test.ts): the cap grouping and the vote 26 (the saves the STR rows name "gfood",
  // every character), the star sign 69 (Glaives; big_guy69123 where it has a golden food of the effect), and the fam68 of GetTalentNumber(1,209) x
  // CalcTalentMAP(209) in the multi (the characters of the tc470 rows, as AllTalentLV feeds that talent too, and Maspoofio#7, where it is the
  // residue of the two "gfood" causes: 869987.0191 seeded vs lib/arkh's 869987.8146, closed to 1e-15 by fam68)
  ...(["goldFoodBase", "goldFoodDmg"] as const).flatMap((source) => [
    ...[...new Set(STAT_DIFFS.str!.filter(([, r]) => r === "gfood").map(([save]) => save))].flatMap((save) =>
      (["gfoodVote26", "gfoodCap"] as const).map((reason) => ({ stat: "damage" as const, save, source, reason, why: STAT_WHY.gfood }))
    ),
    { stat: "damage" as const, save: "Glaives.json", source, reason: "gfoodSign69", why: STAT_WHY.gfoodSign69 },
    ...(source === "goldFoodBase" ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [3, 4]).map((ci) => ({ stat: "damage" as const, save: "big_guy69123.json", ci, source, reason: "gfoodSign69", why: STAT_WHY.gfoodSign69 })),
    ...(
      [["Ash_EB.json", 0], ["Frostymart.json", 0], ["FrozenBody.json", 1], ["Jrod11.json", 4], ["Jrod11.json", 7], ["Koweabooo.json", 8], ["big_guy69123.json", 5], ["0xEXCEED.json", 5], ["Maspoofio.json", 7]] as const
    ).filter(([save]) => source === "goldFoodBase" || save !== "big_guy69123.json").map(([save, ci]) => ({ stat: "damage" as const, save, ci, source, reason: "fam68", why: STAT_WHY.fam68 })),
  ]),
  // Task 5: the meals' Total Damage (MealBonus "TotDmg") carries the Winner bonus in its multi: the God Shard set worn whole, as win3
  { stat: "damage" as const, save: "HourZero.json", ci: 1, source: "mealTotDmg", reason: "godshard", why: GODSHARD_WORN },
  { stat: "damage" as const, save: "HourZero.json", ci: 9, source: "mealTotDmg", reason: "godshard", why: GODSHARD_WORN },
  // Task 6: the statue leaves carry the stats' `statues` reason (lib/arkh gives every character the first one's statue levels), proved in
  // alchemy.test.ts by giving the character that list in the state (not by seeding the leaf's own block)
  ...(
    [["statue0", "1st_Giri.json", 3], ["statue0", "1st_Giri.json", 10], ["statue0", "24632463.json", 3], ["statue0", "HourZero.json", 8], ["statue22", "HourZero.json", 8]] as const
  ).map(([source, save, ci]) => ({ stat: "damage" as const, save, ci, source, reason: "statues", why: STAT_WHY.statues })),
  // Task 6: prayersReal(15, 0) with the Super Bit 9 / 39 and no prayer equipped (the `pray6` reason): lib/arkh's leaf has only the equipped branch
  ...(
    [["Ash_EB.json", 0, 11], ["Brokami.json", 10, 1], ["Crezar.json", 1, 1], ["Crezar.json", 4, 1], ["Dandy2009.json", 10, 1], ["Flipper143.json", 10, 1], ["Frostymart.json", 9, 1], ["FrozenBody.json", 0, 11], ["Glaives.json", 0, 11], ["Jrod11.json", 10, 1]] as const
  ).flatMap(([save, from, n]) => Array.from({ length: n }, (_, k) => ({ stat: "damage" as const, save, ci: from + k, source: "prayer15", reason: "pray6", why: STAT_WHY.pray6 }))),
  // Task 7: the account-system leaves (accountSystems.test.ts). Grid_Bonus(127) is x max(1, Grid_Bonus_Allmulti), whose Companions(0) term is
  // gated in N.js and not in lib/arkh (the comp0 reason, Koweabooo#10)
  { stat: "damage" as const, save: "Koweabooo.json", ci: 10, source: "greenSigils", reason: "comp0", why: COMPANION_0_GATE },
  // Summoning("WinBonus",0): its boosts have GetSetBonus("GODSHARD_SET"), the God Shard set worn whole (as win3)
  { stat: "damage" as const, save: "HourZero.json", ci: 1, source: "win0", reason: "godshard", why: GODSHARD_WORN },
  { stat: "damage" as const, save: "HourZero.json", ci: 9, source: "win0", reason: "godshard", why: GODSHARD_WORN },
  // Summoning("TomeBonus",0) and (6) are powers of the Tome score (Ruling K): lib/tome's against IdleonToolbox's stamped total. tome6 moves
  // only where floor(Tome / 1000) differs; big_guy69123's lore episodes do not move, its Tome bonus 0 does
  ...[...TOME_SOURCE_SAVES, "big_guy69123.json"].map((save) => ({ stat: "damage" as const, save, source: "tome0", reason: "tome", why: TOME_SOURCE })),
  ...["0celot8.json", "5OhTree.json"].map((save) => ({ stat: "damage" as const, save, source: "tome0", reason: "tome", why: TOME_AFTER_RESET })),
  ...["Flipper143.json", "Koweabooo.json", "arkhe-2026-09-23.json"].map((save) => ({ stat: "damage" as const, save, source: "tome6", reason: "tome", why: TOME_SOURCE })),
  // getbonus2(1, b, -1), the best over every character, adds the "all talent levels" (AllTalentLVz), which read DNSM.FamBonusQTYs["68"]: the
  // fam68 reason on the characters of the tc470 rows (Maspoofio#7 as in the golden food; big_guy69123#5 moves only the Workbench's talents)
  ...(["lankRank14", "workbench"] as const).flatMap((source) =>
    (
      [["Ash_EB.json", 0], ["Frostymart.json", 0], ["FrozenBody.json", 1], ["Jrod11.json", 4], ["Jrod11.json", 7], ["Koweabooo.json", 8], ["Maspoofio.json", 7], ["0xEXCEED.json", 5], ...(source === "workbench" ? [["big_guy69123.json", 5] as const] : [])] as const
    ).map(([save, ci]) => ({ stat: "damage" as const, save, ci, source, reason: "fam68", why: STAT_WHY.fam68 }))
  ),
  // Bonus_Minor and Grid_Bonus_Allmulti (through StickerDMGmulti's Grid_Bonus(47)) carry the Companions(0) gate
  ...(["divMinor7", "sticker"] as const).map((source) => ({ stat: "damage" as const, save: "Koweabooo.json", ci: 10, source, reason: "comp0", why: COMPANION_0_GATE })),
  // Sailing("ArtifactBonus",8) is getLOG of every character's WorkbenchStuff("PlayerBuildSpd"), whose talent 131 term counts the Redox Salts
  // (Refinery1) of the storage actor's _ItemsAndStorageOWNED (@5989516): the CURRENT character's inventory (ActorEvents_29._ItemsOwnedMap,
  // CountInventory @7042726 reads InventoryOrder) plus the storage chest. lib/arkh's invStorageOwned (w6/upg-totals.ts:79) sums EVERY
  // character's inventory: Einyen's character 8 carries 2e8 of them, so every other character differs (accountSystems.test.ts gives the
  // current character the others' salts and lib/game equals lib/arkh)
  ...[0, 1, 2, 3, 4, 5, 6, 7, 9, 10].map((ci) => ({ stat: "damage" as const, save: "Einyen.json", ci, source: "artifact8", reason: "redox", why: STAT_WHY.redox })),
  // Task 8: DamageDealed's own terms (damage.test.ts). The talents read with getbonus2 / GetTalentNumber carry the fam68 of AllTalentLV, on
  // the characters of the tc470 rows (and Maspoofio#7, as in the golden food), the base damage's weapon power too
  ...(["wpSquared", "talent463", "divinity507", "talent6"] as const).flatMap((source) =>
    (
      [["Ash_EB.json", 0], ["Frostymart.json", 0], ["FrozenBody.json", 1], ["Jrod11.json", 4], ["Jrod11.json", 7], ["Koweabooo.json", 8], ["big_guy69123.json", 5], ["0xEXCEED.json", 5], ...(source === "talent6" ? [] : [["Maspoofio.json", 7] as const])] as const
    ).map(([save, ci]) => ({ stat: "damage" as const, save, ci, source, reason: "fam68", why: STAT_WHY.fam68 }))
  ),
  // the weapon power: a suffixed item (a choppin hat, fishing rings) counts for its skill's power only; and the boost foods' statue 3
  ...([["Dandy2009.json", 3], ["Norton_Goldman.json", 7], ["big_guy69123.json", 8], ["bluestar3112.json", 1], ["FrozenBody.json", 1]] as const).map(([save, ci]) => ({ stat: "damage" as const, save, ci, source: "wpSquared", reason: "powerSuffix", why: STAT_WHY.powerSuffix })),
  ...[3, 5, 10].map((ci) => ({ stat: "damage" as const, save: "1st_Giri.json", ci, source: "wpSquared", reason: "statues", why: `${STAT_WHY.statues}. TotalFoodBonuses("WeaponPowerBoosts") multiplies each food by FoodBonuses, whose boost foods read StatueBonusGiven3` })),
  // the Damage % star signs: lib/arkh counts every sign of its table
  ...["Dasvidanya.json", "Glaives.json", "big_guy69123.json"].map((save) => ({ stat: "damage" as const, save, source: "starSignPctDmg", reason: "signsDmg", why: STAT_WHY.signsDmg })),
  // Task 2 (AFK plan): the leaves of AFKgainrates("Fighting") (afkTerms.test.ts), by AFK source id. Each is proved by seeding lib/arkh's number
  // for the reason into a fresh Ctx; the reasons are the ones the Damage and stat rows above already carry.
  // GetTalentNumber(1,448) (Fighting AFK talent): the fam68 of AllTalentLV, on the characters of the tc470 rows (the other AFK talents are
  // saturated or unlearned on them)
  ...([["Ash_EB.json", 0], ["Frostymart.json", 0], ["FrozenBody.json", 1], ["Jrod11.json", 4], ["Jrod11.json", 7], ["Koweabooo.json", 8], ["big_guy69123.json", 5], ["0xEXCEED.json", 5]] as const).map(([save, ci]) => ({
    stat: "afk" as const, save, ci, source: "talent448", reason: "fam68", why: STAT_WHY.fam68,
  })),
  // Summoning("WinBonus",11): the boosts have GetSetBonus("GODSHARD_SET"), the God Shard set worn whole (as win0 and win3)
  ...([1, 9] as const).map((ci) => ({ stat: "afk" as const, save: "HourZero.json", ci, source: "winBonus11", reason: "godshard", why: GODSHARD_WORN })),
  // Divinity("Bonus_Minor", -1, 5) counts Companions(0) (@10761439), the gate of Koweabooo#10
  { stat: "afk" as const, save: "Koweabooo.json", ci: 10, source: "divMinor5", reason: "comp0", why: COMPANION_0_GATE },
  // GoldFoodBonuses("AllAFK") has the stats' golden food multi: the same four causes as goldFoodBase (see GOLDFOOD_ROWS)
  ...GOLDFOOD_ROWS("afk", "goldFoodAllAFK"),
  // Task 2 (EXP plan): the leaves of ExpMulti(0) (expTerms.test.ts), by EXP source id, proved as the AFK ones are
  ...GOLDFOOD_ROWS("exp", "goldFood"),
  // the fam68 of AllTalentLV: getbonus2(1, b, -1), the best over every character, adds the "all talent levels" of each, which read DNSM.FamBonusQTYs["68"];
  // the characters of the tc470 rows (Maspoofio#7 and big_guy69123#5 included: their Workbench and Titan talents are not saturated)
  ...(["workbench", "talent434"] as const).flatMap((source) =>
    ([["Ash_EB.json", [0]], ["Frostymart.json", [0]], ["FrozenBody.json", [1]], ["Jrod11.json", [4, 7]], ["Koweabooo.json", [8]], ["Maspoofio.json", [7]], ["big_guy69123.json", [5]], ["0xEXCEED.json", [5]]] as const).flatMap(([save, cis]) =>
      cis.map((ci) => ({ stat: "exp" as const, save, ci, source, reason: "fam68", why: STAT_WHY.fam68 }))
    )
  ),
  // the Shiny Medallion factor, max(1, getbonus2(1, 429, -1)), only where the map's monster has its medallion: the same fam68 characters on the maps below
  // (map 251 included; big_guy69123#5 only on map 59). Map 40 (the dungeon frogG, where the gate is open too) is also proved by the EXP adapter test (trackers/expMulti.test.ts).
  ...([["Ash_EB.json", [0], [251, 1, 2, 8, 9, 40]], ["Frostymart.json", [0], [251, 1, 2, 8, 9, 40]], ["FrozenBody.json", [1], [251, 1, 2, 14, 16, 40]], ["Jrod11.json", [4, 7], [251, 1, 2, 8, 9, 40]], ["Koweabooo.json", [8], [251, 1, 2, 8, 9, 40]], ["Maspoofio.json", [7], [251, 1, 2, 8, 9, 40]], ["big_guy69123.json", [5], [59]], ["0xEXCEED.json", [5], [251, 1, 2, 8, 9, 40]]] as const).flatMap(([save, cis, maps]) =>
    cis.map((ci) => ({ stat: "exp" as const, save, ci, maps, source: "medallion429", reason: "fam68", why: STAT_WHY.fam68 }))
  ),
  // the EXP page's Companions(0) gate (Koweabooo#10): Grid_Bonus_Allmulti under the research squares and the Sticker, Divinity Bonus_Minor and the Minehead presses
  ...(["gridExp", "sticker0", "divMinor4", "button8"] as const).map((source) => ({ stat: "exp" as const, save: "Koweabooo.json", ci: 10, source, reason: "comp0", why: COMPANION_0_GATE })),
  // Summoning("WinBonus",23): the boosts have GetSetBonus("GODSHARD_SET"), the God Shard set worn whole (as win0, win3, winBonus11)
  ...([1, 9] as const).map((ci) => ({ stat: "exp" as const, save: "HourZero.json", ci, source: "win23", reason: "godshard", why: GODSHARD_WORN })),
  // ArbitraryCode("StatueBonusGiven10"): the statue bonus scales with talents (the fam68 of the tc470 rows, as workbench), and HourZero#8 has its own
  // statue levels (the statues reason: lib/arkh reads the first character statue list)
  ...([["Ash_EB.json", [0]], ["Frostymart.json", [0]], ["FrozenBody.json", [1]], ["Jrod11.json", [4, 7]], ["Koweabooo.json", [8]], ["Maspoofio.json", [7]], ["big_guy69123.json", [5]], ["0xEXCEED.json", [5]]] as const).flatMap(([save, cis]) =>
    cis.map((ci) => ({ stat: "exp" as const, save, ci, source: "statue10", reason: "fam68", why: STAT_WHY.fam68 }))
  ),
  { stat: "exp" as const, save: "HourZero.json", ci: 8, source: "statue10", reason: "statues", why: STAT_WHY.statues },
  // StarSigns.MainXP: lib/arkh counts every sign the Rift enables (the signs reason, on the Main EXP key)
  ...["Drukez.json", "Glaives.json", "big_guy69123.json"].map((save) => ({ stat: "exp" as const, save, source: "starSignMainXP", reason: "signsExp", why: STAT_WHY.signsExp })),
  // prayersReal(0, 0) and (2, 0): the Super Bit 9 / 39 branch with no prayer equipped (the pray6 reason, as Damage's prayer15)
  ...(["prayer0", "prayer2"] as const).flatMap((source) =>
    ([["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [10]], ["Crezar.json", [1, 4]], ["Dandy2009.json", [10]], ["Flipper143.json", [10]], ["Frostymart.json", [9]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [10]], ["big_guy69123.json", [4, 8, 10]]] as const).flatMap(([save, cis]) =>
      cis.map((ci) => ({ stat: "exp" as const, save, ci, source, reason: "pray6", why: STAT_WHY.pray6 }))
    )
  ),
  // the LUK curve: the saved TotalStats("LUK") snapshot where N.js recomputes it live (STAT_WHY.lukSnapshot). Every pair whose curve moves; talent35 is the same curve times
  // talent 35, so it differs where the class has the talent
  ...(["luk", "talent35"] as const).flatMap((source) =>
    (source === "luk" ? LUK_BASE_ROWS : T35_BASE_ROWS).flatMap(([save, cis]) => cis.map((ci) => ({ stat: "exp" as const, save, ci, source, reason: "lukSnapshot", why: STAT_WHY.lukSnapshot })))
  ),
  // Task 2 (DR plan): the leaves of TotalStats("Drop_Rarity") (drTerms.test.ts), by DR source id, proved as the EXP ones are
  // DropRateLUK: the same live TotalStats("LUK") against lib/arkh's PVStatList_<ci>[3] snapshot (its lukScaling, stats/systems/common/stats.ts readRawLuk), on the
  // same characters as the EXP curve
  ...LUK_BASE_ROWS.flatMap(([save, cis]) => cis.map((ci) => ({ stat: "dr" as const, save, ci, source: "luk", reason: "lukSnapshot", why: LUK_SNAPSHOT_DR }))),
  // GoldFoodBonuses("DropRatez"): the golden food multi's four causes; of big_guy69123 only character 7 wears a Drop Rate golden food
  ...GOLDFOOD_ROWS("dr", "goldFood", [7]),
  // getbonus2(1, b, -1), the best over every character, carries the fam68 of AllTalentLV: the Land Rank upgrade 9 (talent 207) and the Workbench (talent 328)
  ...(["rank9", "workbench"] as const).flatMap((source) =>
    ([["Ash_EB.json", [0]], ["Frostymart.json", [0]], ["FrozenBody.json", [1]], ["Jrod11.json", [4, 7]], ["Koweabooo.json", [8]], ["Maspoofio.json", [7]], ["0xEXCEED.json", [5]], ...(source === "workbench" ? [["big_guy69123.json", [5]] as const] : [])] as const).flatMap(([save, cis]) =>
      cis.map((ci) => ({ stat: "dr" as const, save, ci, source, reason: "fam68", why: STAT_WHY.fam68 }))
    )
  ),
  // the Companions(0) gate (Koweabooo#10): Grid_Bonus_Allmulti under the grid squares 173 and 168
  ...(["grid173", "glimbo"] as const).map((source) => ({ stat: "dr" as const, save: "Koweabooo.json", ci: 10, source, reason: "comp0", why: COMPANION_0_GATE })),
  // Summoning("WinBonus",9): the boosts have GetSetBonus("GODSHARD_SET"), the God Shard set worn whole (as win0, win3, winBonus11, win23)
  ...([1, 9] as const).map((ci) => ({ stat: "dr" as const, save: "HourZero.json", ci, source: "win9", reason: "godshard", why: GODSHARD_WORN })),
  // Summoning("TomeBonus",2) and (7) are powers of the Tome score (Ruling K), as tome0 and tome6: 2 reads max(0, Tome - 8000), so it moves on the saves of tome0;
  // 7 reads floor(Tome / 1000), so on those of tome6
  ...[...TOME_SOURCE_SAVES, "big_guy69123.json"].map((save) => ({ stat: "dr" as const, save, source: "tome2", reason: "tome", why: TOME_SOURCE })),
  ...["0celot8.json", "5OhTree.json"].map((save) => ({ stat: "dr" as const, save, source: "tome2", reason: "tome", why: TOME_AFTER_RESET })),
  ...["Flipper143.json", "Koweabooo.json", "arkhe-2026-09-23.json"].map((save) => ({ stat: "dr" as const, save, source: "tome7", reason: "tome", why: TOME_SOURCE })),
  // prayersReal(7, 0): the Super Bit 9 / 39 branch with no prayer equipped (the pray6 reason, as EXP's prayer0)
  ...([["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [10]], ["Crezar.json", [1, 4]], ["Dandy2009.json", [10]], ["Flipper143.json", [10]], ["Frostymart.json", [9]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [10]], ["big_guy69123.json", [4, 8, 10]]] as const).flatMap(([save, cis]) =>
    cis.map((ci) => ({ stat: "dr" as const, save, ci, source: "prayer7", reason: "pray6", why: STAT_WHY.pray6 }))
  ),
  // Holes("MeasurementBonusTOTAL",15): HourZero runs the load step that zeroes the measurements 10 to 15
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ci) => ({ stat: "dr" as const, save: "HourZero.json", ci, source: "meas15", reason: "holesLoad251", why: STAT_WHY.holesLoad251 })),
  // Minehead("GlimboDRmulti"): 1 in N.js where grid square 168 has no value, lib/arkh's grid node 0
  ...[["HourZero.json", 10], ["big_guy69123.json", 11]].flatMap(([save, n]) =>
    Array.from({ length: n as number }, (_, ci) => ({ stat: "dr" as const, save: save as string, ci, source: "glimbo", reason: "glimboUnleveled", why: STAT_WHY.glimboUnleveled }))
  ),
  // Task 2 (Coin plan): the leaves of ArbitraryCode("MonsterCash") (coinTerms.test.ts), by COIN_GROUPS source id
  // the Cash bubbles: lib/game's live TotalStats against the PVStatList snapshot lib/arkh reads (STAT_WHY.statSnapshot); every pair where floor(stat / 250) moves
  ...COIN_SNAPSHOT_ROWS.flatMap(([source, rows]) => rows.flatMap(([save, cis]) => cis.map((ci) => ({ stat: "coin" as const, save, ci, source, reason: `snapshot${source.slice(6)}`, why: STAT_WHY.statSnapshot })))),
  // the Companions(0) gate (Koweabooo#10): Grid_Bonus_Allmulti under the research squares and Divinity Bonus_Minor
  ...(["grid149", "grid169", "divMinor3"] as const).map((source) => ({ stat: "coin" as const, save: "Koweabooo.json", ci: 10, source, reason: "comp0", why: COMPANION_0_GATE })),
  // getbonus2(1, 433, -1): the best over every character adds the "all talent levels" of each, which read DNSM.FamBonusQTYs["68"] (the characters of the tc470 rows)
  ...([["Ash_EB.json", [0]], ["Frostymart.json", [0]], ["FrozenBody.json", [1]], ["Jrod11.json", [4, 7]], ["Koweabooo.json", [8]], ["Maspoofio.json", [7]], ["big_guy69123.json", [5]], ["0xEXCEED.json", [5]]] as const).flatMap(([save, cis]) =>
    cis.map((ci) => ({ stat: "coin" as const, save, ci, source: "dustWalker", reason: "fam68", why: STAT_WHY.fam68 }))
  ),
  // prayersReal(8, 0): the Super Bit 9 / 39 branch with no prayer equipped (the pray6 reason, as the Drop Rate's prayer7)
  ...([["Ash_EB.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Brokami.json", [10]], ["Crezar.json", [1, 4]], ["Dandy2009.json", [10]], ["Flipper143.json", [10]], ["Frostymart.json", [9]], ["FrozenBody.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Glaives.json", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ["Jrod11.json", [10]], ["big_guy69123.json", [4, 8, 10]]] as const).flatMap(([save, cis]) =>
    cis.map((ci) => ({ stat: "coin" as const, save, ci, source: "prayer8", reason: "pray6", why: STAT_WHY.pray6 }))
  ),
  // the Pecunia statue: HourZero#8 has its own statue levels (the statues reason)
  { stat: "coin" as const, save: "HourZero.json", ci: 8, source: "statue19", reason: "statues", why: STAT_WHY.statues },
  // MealBonus("Cash"): the boosts have GetSetBonus("GODSHARD_SET"), the God Shard set worn whole (as the Drop Rate's and EXP's WinBonus terms)
  ...([1, 9] as const).map((ci) => ({ stat: "coin" as const, save: "HourZero.json", ci, source: "mealCash", reason: "godshard", why: GODSHARD_WORN })),
  // GoldFoodBonuses("MonsterCash"): the golden food multi's causes (no golden food of the effect on big_guy69123's characters: the star sign 69 and fam68 there do not show)
  ...GOLDFOOD_ROWS("coin", "goldFood", []),
  // talent 643's tier: on maps 301 and 40 the star signs of the Damage % (signsDmg) alone put lib/arkh's Max past a multikill tier lib/game's does not reach, on this save
  ...([7, 9] as const).map((ci) => ({ stat: "coin" as const, save: "big_guy69123.json", ci, maps: [301, 40] as const, source: "talent643", reason: "signsDmg", why: `OverkillStuffs("2") @4095676 compares the Max damage (DamageDealed @4105019) with the HP tiers; lib/arkh's Max is higher here because of the Damage % star signs alone (${STAT_WHY.signsDmg}), and it crosses a tier lib/game's does not (on map 301, 3 against 2). Lib/arkh's other Damage causes on this save (tome, gfoodSign69) do not move the tier` })),
  // Task 2 (Multikill plan): the damage tier. OverkillStuffs("2") @4095676 compares the Max damage (DamageDealed @4105019) with the HP tiers, so lib/arkh's Max causes move it only where they cross one (8 pairs of 4612 on the leaf's maps, 10 more on the maps only the total runs on: 14, 40 and 150); each pair names the cause that closes it on its own (#0@40 needs two, see its second entry)
  ...([["big_guy69123.json", 0, [40]], ["big_guy69123.json", 1, [14]], ["big_guy69123.json", 2, [40]], ["big_guy69123.json", 4, [14]], ["big_guy69123.json", 5, [40]], ["big_guy69123.json", 6, [251, 216, 150]], ["big_guy69123.json", 7, [301, 40]], ["big_guy69123.json", 8, [251]], ["big_guy69123.json", 9, [301, 40]], ["big_guy69123.json", 10, [251, 216, 14, 150]]] as const).map(([save, ci, maps]) => ({ stat: "mk" as const, save, ci, maps, source: "tier", reason: "signsDmg", why: `lib/arkh's Max is about 1.28 x lib/game's here because of the Damage % star signs (${STAT_WHY.signsDmg}), and it crosses a tier lib/game's does not. It is the one cause that closes every pair of these but #0@40 on its own (the next largest, powerSuffix on character 8, is x 1.04)` })),
  { stat: "mk" as const, save: "big_guy69123.json", ci: 0, maps: [40] as const, source: "tier", reason: "gfoodSign69", why: `On this pair the signsDmg entry above needs a second cause: lib/arkh's Max crosses tier 49 only with the Damage % star signs and the golden food's sign 69 together (${STAT_WHY.gfoodSign69}); neither alone reaches it` },
  { stat: "mk" as const, save: "Dandy2009.json", ci: 7, maps: [251] as const, source: "tier", reason: "signs@wis", why: `lib/arkh's Max is 1.006 x lib/game's through the character's WIS (${STAT_WHY.signs.replace(/STR star signs/, "WIS star signs")}) and crosses tier 44, which lib/game's does not reach. Proved by lib/arkh's WIS star sign keys in place of lib/game's` },
];

/**
 * The lib/arkh numbers behind each STAT_WHY reason, as lib/game `block` calls to seed (block name, its args, lib/arkh's value): put in the
 * cache of a fresh lib/game Ctx for character `ci`, they make lib/game compute what lib/arkh does. lib/arkh is run on the save at `path`.
 */
/**
 * The main stat whose lib/arkh terms a stat's KNOWN reasons seed: Max MP is built on WIS (PlayerMPmax @4150047), Max HP on STR (@4147120),
 * Accuracy on the class's second stat (PlayerAccTot @4151358, ClassStatTypes[first class][1]), worked out per character.
 */
export const SEED_STAT: Partial<Record<ArkhStat | "speed", keyof typeof MAIN_STATS | "accuracy">> = { str: "str", agi: "agi", wis: "wis", luk: "luk", maxMp: "wis", maxHp: "str", accuracy: "accuracy", speed: "agi" };

/** The statues each stat reads (StatueBonusGiven<n>): HP's 4 and, through its boost foods (FoodBonuses @4125641), 3; the move speed's 1 and 3; accuracy's 14 and the move speed's. */
const STATUES_READ: Partial<Record<ArkhStat | "speed", readonly number[]>> = { maxHp: [3, 4], speed: [1, 3], accuracy: [1, 3, 14] };

/**
 * lib/arkh's own prayersReal(d, b), the one with both branches (the Super Bit one included): what the pray6 reason says lib/arkh's
 * accuracy should have called.
 */
export function arkhPrayersReal(path: string, ci: number, d: number, b: number): number {
  loadSaveData(JSON.parse(readFileSync(path, "utf8")));
  return prayersReal(d, b, ci, saveData).val;
}

/**
 * lib/arkh's Labb("TotalGreenSigils"): the sigils at level >= 4 (its `greenSigils` leaf is 1 + min(100, this x Grid_Bonus(127))/100, whose
 * Grid_Bonus is the Research port of Task 7, so the count itself is what Task 6 compares).
 */
export function arkhTotalGreenSigils(path: string): number {
  loadSaveData(JSON.parse(readFileSync(path, "utf8")));
  return totalGreenSigils(saveData);
}

/**
 * TalentCalc(616) as lib/arkh computes it, one value per character: min(talent 616, floor(the highest level among the characters whose
 * class is below 6 / 10)). lib/arkh folds it into its Weapon Power leaf (derived-damage.ts, "TalentCalc(616)"), so the term has no leaf
 * of its own: this is that very expression, built from lib/arkh's own talent resolver. It is a COPY of derived-damage.ts:338-353 (the
 * class < 6 walk and the floor(level / 10) cap): update it with them. It drops lib/arkh's try/catch to 0 (a throw here fails the test).
 */
export function arkhTc616(path: string): number[] {
  loadSaveData(JSON.parse(readFileSync(path, "utf8")));
  const lv0 = (saveData as any).lv0AllData;
  let top = 0;
  charClassData.forEach((cls, i) => {
    if (Number(cls) < 6 && (Number(lv0?.[i]?.[0]) || 0) > top) top = Number(lv0[i][0]);
  });
  return charClassData.map((_, ci) => (top > 0 ? Math.min(rval(talentResolver, 616, { saveData, charIdx: ci, activeCharIdx: ci }), Math.floor(top / 10)) : 0));
}

export function arkhStatSeeds(path: string, ci: number, reasons: readonly string[], forStat: ArkhStat | "speed"): [name: string, args: (string | number)[], value: number][] {
  const seedStat = SEED_STAT[forStat] ?? "str";
  loadSaveData(JSON.parse(readFileSync(path, "utf8")));
  const ctx = { saveData, charIdx: ci, activeCharIdx: ci } as never;
  const second = ClassStatTypes[`${ReturnClasses(Number(charClassData[ci]))[0]}`]?.[1];
  const stat = seedStat !== "accuracy" ? seedStat : (Object.keys(MAIN_STATS) as (keyof typeof MAIN_STATS)[]).find((k) => MAIN_STATS[k] === second)!;
  const STAT = MAIN_STATS[stat];
  const tree = computeTotalStat(STAT, ci, ctx).tree;
  const tomeBubble = ({ str: "W8", agi: "A9", wis: "M9" } as Record<string, string>)[stat];
  const find = (n: ArkhNode, test: (n: ArkhNode) => boolean): ArkhNode | undefined => (test(n) ? n : (n.children ?? []).map((k) => find(k, test)).find(Boolean));
  const at = (name: string) => {
    const n = find(tree, (x) => x.name === name);
    if (!n) throw new Error(`arkhStatSeeds: no "${name}" in lib/arkh's STR tree`);
    return n.val;
  };
  const out: [string, (string | number)[], number][] = [];
  // "gfood" is two causes (gfoodVote26 + gfoodCap, STAT_WHY.gfood), each seeded on its own input: never the whole GoldFoodBonuses value
  for (const r of reasons.flatMap((x) => (x === "gfood" ? ["gfoodVote26", "gfoodCap"] : [x]))) {
    if (r === "vote2") out.push(["Summoning", ["VotingBonusz", 2, 0], votingBonusz(2, undefined, saveData)]);
    // Damage's golden food leaves (Task 5) are the leaf under test, so they are NOT seeded with their own value: the two causes of "gfood" are
    // seeded on their own inputs, lib/arkh's number for each. The vote 26 as lib/arkh reads it (without its multi), and the card term: lib/arkh
    // caps the SUM min(4 x CardLv(cropfallEvent1) + 5 x CardLv(anni5Event1), 50); N.js caps each term, so a CardLv(cropfallEvent1) of
    // (lib/arkh's capped sum) / 4 with CardLv(anni5Event1) at 0 gives lib/game that very sum
    else if (r === "gfoodVote26") out.push(["Summoning", ["VotingBonusz", 26, 0], votingBonusz(26, undefined, saveData)]);
    else if (r === "gfoodCap") {
      loadSaveData(JSON.parse(readFileSync(path, "utf8")));
      const capped = Math.min(4 * computeCardLv("cropfallEvent1", saveData) + 5 * computeCardLv("anni5Event1", saveData), 50);
      out.push(["RunCodeOfTypeXforThingY", ["CardLv", "cropfallEvent1"], capped / 4], ["RunCodeOfTypeXforThingY", ["CardLv", "anni5Event1"], 0]);
    }
    else if (r === "gfoodSign69") {
      const n = gfoodBonusMULTIBreakdown(ci, saveData).items.find((i) => i.name.startsWith("Star Sign 69"));
      if (!n) throw new Error("arkhStatSeeds: no Star Sign 69 in lib/arkh's golden food multi");
      out.push(["DNSM.StarSigns", ["69"], n.val]);
    }
    else if (r === "tomeW8") out.push(["DNSM.AlchBubbles", [tomeBubble], at(`AlchBubble ${tomeBubble}`)]);
    else if (r === "signs") out.push(["DNSM.StarSigns", [STAT], at(`StarSigns.${STAT}`)], ["DNSM.StarSigns", [`pct${STAT}`], at(`StarSigns.pct${STAT}`)]);
    else if (r === "comp0") out.push(["Companions", [0], 1]);
    else if (r === "statues") {
      const read = STATUES_READ[forStat];
      if (!read) throw new Error(`arkhStatSeeds: ${forStat} reads no statue`);
      for (const n of read) out.push(["ArbitraryCode", [`StatueBonusGiven${n}`], computeStatueBonusGiven(n, ci, saveData).val]);
    } else if (r === "buff108") {
      const n = find(computePlayerHPmax(ci, ctx) as unknown as ArkhNode, (x) => !!x.name?.startsWith("Buff 108"));
      if (!n) throw new Error("arkhStatSeeds: no Buff 108 in lib/arkh's Max HP");
      out.push(["GetBuffBonuses", [108, 1], -n.val]);
    }
    // lib/arkh counts the God Shard set only when OptionsListAccount[379] names it (GODSHARD_WORN): 0 on the accounts that wear it whole without it
    else if (r === "godshard") out.push(["GetSetBonus", ["GODSHARD_SET", "Bonus", 0, 0], 0]);
    else if (r === "pray6") out.push(["prayersReal", [6, 0], computePrayerReal(6, 0, ci, saveData).val]);
    else if (r === "vault4") out.push(["Summoning", ["VaultUpgBonus", 4, 0], computeSummUpgBonus(4, saveData, ci).val]);
    else if (r === "buff288") out.push(["GetBuffBonuses", [288, 2], 0]);
    else if (r === "buff273") out.push(["GetBuffBonuses", [273, 1], 0]);
    else if (r === "signsSpeed") out.push(["DNSM.StarSigns", ["MoveSpd"], computeStarSignBonus("MoveSpd", ci, saveData)]);
    else if (r === "fam68") {
      const n = find(talentResolver.resolve(10, ctx), (x) => x.name.startsWith("Family Bonus 68"));
      if (!n) throw new Error("arkhStatSeeds: no Family Bonus 68 in lib/arkh's talent 10");
      out.push(["DNSM.FamBonusQTYs", ["68"], n.val]);
    } else throw new Error(`arkhStatSeeds: no seed for ${r}`);
  }
  return out;
}

export type Seed = [name: string, args: (string | number)[], value: number];
/** A KNOWN reason proved on the save instead of the cache (its cause is a save read, not a block): the save's `data` edited in place. */
export type Patch = (data: Record<string, unknown>, ci: number, chars: number) => void;

/**
 * The KNOWN reasons proved on the save: edited so lib/game reads what lib/arkh does, then a fresh state is built from it.
 *  - statues: character `ci` gets the first character's statue levels, the one list lib/arkh reads for every character (STAT_WHY.statues);
 *  - redox: the current character also carries every other character's Redox Salts (Refinery1), as lib/arkh counts every inventory
 *    (STAT_WHY.redox);
 *  - powerSuffix: the Weapon_Power of the equipped items whose name has a power suffix is moved onto the first other counted item (not
 *    the weapon, whose own power Minehead("WepPowDmgPCT") reads, unless it is the only one), where N.js counts it, as lib/arkh counts every
 *    item (STAT_WHY.powerSuffix);
 *  - signsDmg: character `ci` also wears every sign lib/arkh's table gives the Damage % key, so each is active (STAT_WHY.signsDmg).
 */
export const PROOF_PATCHES: Record<string, Patch> = {
  statues: (d, ci) => {
    d[`StatueLevels_${ci}`] = d["StatueLevels_0"];
  },
  redox: (d, ci, chars) => {
    const get = (k: string) => (typeof d[k] === "string" ? JSON.parse(d[k] as string) : d[k]) as unknown[];
    let others = 0;
    for (let c = 0; c < chars; c++) if (c !== ci) get(`InventoryOrder_${c}`).forEach((x, i) => x === "Refinery1" && (others += Number(get(`ItemQTY_${c}`)[i])));
    d[`InventoryOrder_${ci}`] = [...get(`InventoryOrder_${ci}`), "Refinery1"];
    d[`ItemQTY_${ci}`] = [...get(`ItemQTY_${ci}`), others];
  },
  powerSuffix: (d, ci) => {
    const get = (k: string) => (typeof d[k] === "string" ? JSON.parse(d[k] as string) : d[k]) as Record<string, any>;
    const order = get(`EquipOrder_${ci}`)[0] as Record<string, string>;
    const own = get(`EMm0_${ci}`) ?? {};
    const suffixed = (n: string) => (PowerSuffixes as readonly string[]).some((x) => n.includes(x));
    let moved = 0;
    for (let O = 0; O < 16; O++) if (order[O] && order[O] !== "Blank" && suffixed(order[O])) moved += Number((ITEMS as any)[order[O]]?.Weapon_Power ?? 0) + Number(own[O]?.Weapon_Power ?? 0);
    // slots 8, 10, 12 and 14 can be skipped (the Hatrack, the Gallery, the Cape Vine): take a plain slot, the weapon (1) only when no other is
    const to = [0, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15, 1].find((O) => order[O] && order[O] !== "Blank" && !suffixed(order[O]));
    if (to === undefined) throw new Error(`powerSuffix: no other item to carry the power on character ${ci}`);
    own[to] = { ...(own[to] ?? {}), Weapon_Power: Number(own[to]?.Weapon_Power ?? 0) + moved };
    d[`EMm0_${ci}`] = own;
  },
  // signsExp: character `ci` also wears every sign lib/arkh's table gives the Main EXP key (2, 24, 52), so each is active (STAT_WHY.signsExp)
  signsExp: (d, ci) => {
    const k = `PVtStarSign_${ci}`;
    d[k] = `${d[k] ?? ""}${Object.keys(SIGN_BONUSES.MainXP).join(",")},`;
  },
  signsDmg: (d, ci) => {
    const k = `PVtStarSign_${ci}`;
    d[k] = `${d[k] ?? ""}${Object.keys(SIGN_BONUSES.PctDmg).join(",")},`;
  },
};

/**
 * The seeds that prove a Damage source's KNOWN `reason` (a `stat: "damage"` row) on character `ci`: lib/arkh's number for the cause, on the
 * narrowest block it names. The reasons a patch proves (PROOF_PATCHES) have none.
 *  - tome (TOME_SOURCE, Ruling K): the Tome score lib/arkh reads, IdleonToolbox's total stamped on the file, in place of lib/tome's;
 *  - powerSuffix, for a term that reads the weapon power through other blocks (the total): lib/arkh's weapon power on TotalStats("Weapon_Power")
 *    (a term that reads that block itself, wpSquared, is proved by PROOF_PATCHES.powerSuffix instead);
 *  - pray6: no Super Bit 9 / 39, which makes N.js prayersReal take the equipped-prayer branch, the only one lib/arkh's leaf has;
 *  - `<reason>@<stat>` (signs@wis): arkhStatSeeds' for that main stat;
 *  - every other reason: arkhStatSeeds' (comp0, godshard, fam68, and the golden food's gfoodVote26 / gfoodCap / gfoodSign69).
 */
export function damageReasonSeeds(path: string, ci: number, reason: string): Seed[] {
  const [own, stat] = reason.split("@"); // `<reason>@<stat>`: a reason asked per main stat (signs, tomeW8), lib/arkh's number on that stat's own keys
  if (stat) return arkhStatSeeds(path, ci, [own], stat as ArkhStat);
  if (reason === "powerSuffix") {
    loadSaveData(JSON.parse(readFileSync(path, "utf8")));
    return [["TotalStats", ["Weapon_Power"], computeWeaponPower(ci, { saveData, charIdx: ci, activeCharIdx: ci } as never)]];
  }
  if (PROOF_PATCHES[reason]) return [];
  if (reason === "tome") {
    const env = JSON.parse(readFileSync(path, "utf8"));
    const it = Number(env.extraData?.totalTomePoints ?? env.parsedData?.totalTomePoints);
    if (!Number.isFinite(it)) throw new Error(`${path}: no IdleonToolbox Tome total`);
    return [["DNSM.TomeQTYtot", [], it]];
  }
  if (reason === "pray6") return [["GamingStatType", ["SuperBitType", 9, 0], 0], ["GamingStatType", ["SuperBitType", 39, 0], 0]];
  return arkhStatSeeds(path, ci, [reason], "str");
}

// ---- AFK Gains ----
// Same cache design as Damage (sectionCache): a path save is cached on disk (the `afk` section of the sha1-keyed file), an object save in memory.
const AFK_FIGHT_ALL = [...AFK_POOLS[0].sources, ...AFK_POOLS[1].sources];

// The tree of computeArkhAfkGains: [0] = the fight + ALL pool (its children, in AFK_POOLS order), [1] = arcane, [2] = etc92 (each
// holds its source node only when the value is non-zero), then the three rules nodes (clam, cove, type), always present.
function afkLeavesOf(parsed: any, ci: number, map: number): Record<string, number> {
  const kids = computeArkhAfkGains(parsed, ci, map).tree.children!;
  const pool = kids[0].children!;
  if (pool.length !== AFK_FIGHT_ALL.length) throw new Error(`arkhAfkLeaves: lib/arkh's pool has ${pool.length} sources, AFK_POOLS has ${AFK_FIGHT_ALL.length}`);
  const out: Record<string, number> = {};
  AFK_FIGHT_ALL.forEach((id, i) => (out[id] = pool[i].val));
  out.arcaneMapAfk = kids[1].children?.[0]?.val ?? 0;
  out.etc92 = kids[2].children?.[0]?.val ?? 0;
  [out.clamworks306, out.cglunkoCove, out.afkType] = [kids[3].val, kids[4].val, kids[5].val];
  return out;
}

/**
 * Every AFK source's `val` in lib/arkh's Fighting AFK tree for character `ci` on `map`, by AFK_POOLS source id: the 19 `fight` and 19
 * `ALL` sources (the Σ pool, the 40 base included), then the five nodes the rate multiplies in, whose ids are AFK_POOLS's too:
 *   arcaneMapAfk  the arcane map bonus slot 2, in % (G2 = 1 + it / 100)
 *   etc92         the AFK Gains Multi equipment bonus, in % (G3 = 1 + it / 100)
 *   clamworks306  R1, 0.2 on map 306 else 1
 *   cglunkoCove   R2, the Cove's rate on map 216 in cavern 17 (replaces everything), else 0
 *   afkType       R3, 1 for a fight (or the Cove), 0 when the map's AFK target is not a fight
 * `arkhAfkRate` rebuilds the total from these with lib/arkh's own `afkRate`. `save` as in arkhDamageLeaves.
 */
export const arkhAfkLeaves = sectionCache("afk", afkLeavesOf);

/** lib/arkh's AFK gains rate (a fraction: 1.5 = 150%, before the panel's floor(100 x)): its own `afkRate` over `arkhAfkLeaves`. */
export function arkhAfkRate(save: unknown, ci: number, map: number): number {
  const l = arkhAfkLeaves(save, ci, map);
  return afkRate({
    sum: AFK_FIGHT_ALL.reduce((a, id) => a + l[id], 0),
    arcane: l.arcaneMapAfk,
    etc92: l.etc92,
    clam: l.clamworks306,
    cove: l.cglunkoCove,
    type: l.afkType,
  });
}

// ---- EXP Multi ----
// Same cache design as AFK: the `exp` section of the sha1-keyed file (path save), identity-keyed memory (object save).
/** The name lib/arkh gives each EXP source node (stable across the real saves): expEntryOf checks the tree against it, so a reorder inside a group of the same length fails loudly. */
const EXP_SOURCE_NAMES: Record<string, string> = {
  workbench: "Archlord Of The Pirates (Talent 328)",
  bunQ: "EXP Bundle",
  superbit19: "Noobie Gains (Super Bit 19)",
  medallion429: "Shiny Medallions (Talent 429)",
  comp37: "Whallamus (Companion 37)",
  comp33: "Chippy (Companion 33)",
  comp160: "Glunko The Massive (Companion 160)",
  comp32: "Whale (Companion 32)",
  arenaCruc15: "1.20x Class EXP (Pet Arena Crucible 15)",
  menagerie23: "Menagerie Boost: Class EXP gain (Boost 23)",
  comp168: "Crystal Glunko (Companion 168)",
  comp34: "Bunny (Companion 34)",
  comp145: "Eggroll (Companion 145)",
  jelly30: "Surrage (Jelly Obstruction 31)",
  jelly62: "Tribunal Helmet (Jelly Obstruction 63)",
  comp128: "Baby Troll (Companion 128)",
  gridExp: "Legendary Fevers (Research Grid 130·131·132·152)",
  sticker0: "Mega Mongo Sticker (Sticker 0)",
  superbit63: "Experienced Gamer (Super Bit 63)",
  zenith9: "Classy Gogo (Zenith Market 9)",
  comp50: "Santa Snake (Companion 50)",
  etc84: "Bonus Class EXP (Equipment)",
  card100: "Class EXP Multi Cards (Card Type 100)",
  arcade60: "Class XP Multi Arcade Bonus (Arcade 60)",
  vialClassExp: "Crabomayse (Vial 83)",
  talent434: "Slayer Abominator (Talent 434)",
  arcane1: "Arcane Map Bonus: Class EXP",
  bigFish4: "Advice on Being Smart (Big Fish 4)",
  dancingCoral3: "Class EXP (Dancing Coral 3)",
  coralKid: "Coral Kid Upgrade 2",
  cardSet12: "Class EXP Multi Set Bonus (Card Set 12)",
  bubba6: "XP Multi (Bubba RoG 6)",
  sushi15: "Tobiko Temaki (Sushi Tier 16)",
  cloud70: "Palette Lv. 100 (Equinox Challenge 70)",
  fountain16: "Class EXP Boost (Fountain 16)",
  royalStatue3: "Royal Statue: Class Exp",
  classy: "Classy Discoveries",
  etc78: "Class EXP Multi (Equipment)",
  luk: "LUK Scaling (Class EXP)",
  talent35: "Lucky Charms (Talent 35)",
  etc4: "XP from Monsters (Equipment)",
  boxMonsterExp: "Box of Unwanted Stats (Post Office 3c)",
  food: "Food (Class EXP)",
  starSignMainXP: "Star Signs: Main EXP",
  vialMonsterExp: "Mimicraugh (Vial 17)",
  bubbleExp: "Grind Time (Kazam Cauldron)",
  card44: "Monster EXP Cards (Card Type 44)",
  merit3: "Merit: EXP for Lowest-Level Character",
  vault12: "Baby on Board (Vault 12)",
  cardSet0: "EXP if below Lv 50 Set Bonus (Card Set 0)",
  mealClexp: "Class EXP Meals (below Lv 120)",
  weeklyBoss: "Weekly Boss",
  newbie: "Newbie Bracket",
  divMinor4: "Class EXP (Divinity Minor Bonus 4)",
  cardSet5: "Card Set 5 (Damage · Drop · EXP)",
  statue10: "EXP Statue (Statue 10)",
  talent632: "Just EXP (Talent 632)",
  shrine5: "Summereading Shrine (Shrine 5)",
  saltLick3: "Class EXP and Skill EXP (Salt Lick 3)",
  prayer0: "Big Brain Time (Prayer 0)",
  prayer2: "Unending Energy (Prayer 2)",
  prayer9: "The Royal Sampler (Prayer 9) (curse)",
  flurbo2: "Class Exp (Flurbo Shop 2)",
  ach57: "Dungeon Pinch (Achievement 57)",
  ach357: "Unreal Overgrowth (Achievement 357)",
  ach61: "2 Minute Meal (Achievement 61)",
  ach124: "Dungeon Slap (Achievement 124)",
  ach188: "Capitalist Win (Achievement 188)",
  arcade12: "Class EXP Gain Arcade Bonus (Arcade 12)",
  sigil8: "Metal Exterior Sigil (Sigil 8)",
  ach286: "No Krakens? ): (Achievement 286)",
  shiny1: "Class EXP Shiny Pet (Breeding 1)",
  msa4: "MSA Totalizer (Class EXP)",
  talent55: "EXP Cultivation (Talent 55)",
  cardSpring: "Bubbulyte (Card springEvent1)",
  comp3: "Crystal Custard (Companion 3)",
  comp50add: "Santa Snake (Companion 50)",
  shimmer179: "Island Shimmer",
  goldFood: "Golden Nigiri (Golden Food)",
  owl0: "Bonuses of Orion (Owl Upgrade 0)",
  vote15: "Class EXP from Monsters (Weekly Vote 15)",
  monument1_6: "Justice Monument: Class EXP Gain",
  compass51: "Moon of Experience (Compass 51)",
  hole47: "Gloomie Expie (Cavern Upgrade 47)",
  win23: "Class EXP (Winner Bonus 23)",
  grimoire24: "Skull of Major Experience (Grimoire 24)",
  vault3: "Wicked Smart (Vault 3)",
  vault35: "Schoolin' the Fish (Vault 35)",
  hole83: "Sanctum of EXP (Cavern Upgrade 83)",
  ironSet: "Iron Set",
  exotic50: "Intelleaf (Exotic Market 50)",
  ola421: "Class EXP from Monsters (Hoops Shop 2)",
  stampClassxp: "Gud EXP Stamp (Stamp A44)",
  friend1: "Class EXP Gain (Friend Bonus 1)",
  comp47: "Baby Boa (Companion 47)",
  comp111: "Clammie (Companion 111)",
  button8: "Class XP (Minehead Button 8)",
  comp128add: "Baby Troll (Companion 128)",
};

// The tree of computeArkhExpMulti: one child per EXP_GROUPS group, whose children are its sources in order (a grouped descriptor).
function expEntryOf(parsed: any, ci: number, map: number): TreeEntry {
  const { tree, total } = computeArkhExpMulti(parsed, ci, map);
  const leaves: Record<string, number> = {};
  EXP_GROUPS.forEach((g, i) => {
    const kids = tree.children![i].children!;
    if (kids.length !== g.sources.length) throw new Error(`arkhExpLeaves: lib/arkh's ${g.key} has ${kids.length} sources, EXP_GROUPS has ${g.sources.length}`);
    g.sources.forEach((id, k) => {
      // by name too, not by index alone: a same-length reorder of a group in lib/arkh would otherwise pair the wrong leaves
      if (kids[k].name !== EXP_SOURCE_NAMES[id]) throw new Error(`arkhExpLeaves: lib/arkh's ${g.key}[${k}] is "${kids[k].name}", EXP_GROUPS expects ${id} ("${EXP_SOURCE_NAMES[id]}")`);
      leaves[id] = kids[k].val;
    });
  });
  return { leaves, total };
}

const expEntry = sectionCache("exp", expEntryOf);

/**
 * Every EXP source's `val` in lib/arkh's EXP Multi tree for character `ci` on `map`, by EXP_GROUPS source id (as the tree holds it:
 * a factor for the `mult` groups, a percentage for the `pct` ones). Recombine with `applyGroupStep` over EXP_GROUPS (mult / pct,
 * max1 on g04) to get lib/arkh's total. `save` as in arkhDamageLeaves.
 */
export function arkhExpLeaves(save: unknown, ci: number, map: number): Record<string, number> {
  return expEntry(save, ci, map).leaves;
}

/** lib/arkh's own EXP Multi total (computeArkhExpMulti(...).total): the oracle for the whole tree. */
export function arkhExpMulti(save: unknown, ci: number, map: number): number {
  return expEntry(save, ci, map).total;
}

// ---- Drop Rate (V2): same design as EXP. The tree of computeArkhDropRateV2 has one child per DR2_GROUPS group, whose children are its sources in order.
function drEntryOf(parsed: any, ci: number, map: number): TreeEntry {
  const { tree, total } = computeArkhDropRateV2(parsed, ci, map);
  const leaves: Record<string, number> = {};
  DR2_GROUPS.forEach((g, i) => {
    const kids = tree.children![i].children!;
    if (kids.length !== g.sources.length) throw new Error(`arkhDrLeaves: lib/arkh's ${g.key} has ${kids.length} sources, DR2_GROUPS has ${g.sources.length}`);
    g.sources.forEach((id, k) => (leaves[id] = kids[k].val));
  });
  return { leaves, total };
}

const drEntry = sectionCache("dr", drEntryOf);

/**
 * Every Drop Rate source's `val` in lib/arkh's DR V2 tree for character `ci` on `map`, by DR2_GROUPS source id (as the tree holds it:
 * a factor for the `mult` groups, a percentage for the `pct` ones). Recombine with `applyGroupStep` over DR2_GROUPS from 1 to get lib/arkh's total.
 * `save` as in arkhDamageLeaves.
 */
export function arkhDrLeaves(save: unknown, ci: number, map: number): Record<string, number> {
  return drEntry(save, ci, map).leaves;
}

/** lib/arkh's own Drop Rate V2 total (computeArkhDropRateV2(...).total): the oracle for the whole tree. */
export function arkhDropRate(save: unknown, ci: number, map: number): number {
  return drEntry(save, ci, map).total;
}

// ---- Coin Multi: same design as DR. The tree of computeArkhCoinMulti has one child per COIN_GROUPS group, whose children are its sources in order.
/** What the tracker adapter test compares of lib/arkh's Coin tree besides its numbers: names, formats and notes (the root, the groups, every source by id) and the node count. */
export type CoinShape = { root: Shape; groups: Shape[]; sources: Record<string, Shape>; nodes: number };
type Shape = { name: string; fmt?: string; note?: string };
const shapeOf = (n: { name: string; fmt?: string; note?: string }): Shape => ({ name: n.name, ...(n.fmt === undefined ? {} : { fmt: n.fmt }), ...(n.note === undefined ? {} : { note: n.note }) });
const countNodes = (n: { children?: readonly any[] | null }): number => 1 + (n.children ?? []).reduce((a: number, c: any) => a + countNodes(c), 0);

function coinEntryOf(parsed: any, ci: number, map: number): TreeEntry & { shape: CoinShape } {
  const { tree, total } = computeArkhCoinMulti(parsed, ci, map);
  const leaves: Record<string, number> = {};
  const shape: CoinShape = { root: shapeOf(tree), groups: [], sources: {}, nodes: countNodes(tree) };
  COIN_GROUPS.forEach((g, i) => {
    const kids = tree.children![i].children!;
    if (kids.length !== g.sources.length) throw new Error(`arkhCoinLeaves: lib/arkh's ${g.key} has ${kids.length} sources, COIN_GROUPS has ${g.sources.length}`);
    shape.groups.push(shapeOf(tree.children![i]));
    g.sources.forEach((id, k) => {
      leaves[id] = kids[k].val;
      shape.sources[id] = shapeOf(kids[k]);
    });
  });
  return { leaves, total, shape };
}

const coinEntry = sectionCache("coin", coinEntryOf);

/**
 * Every Coin Multi source's `val` in lib/arkh's tree for character `ci` on `map`, by COIN_GROUPS source id (as the tree holds it: the
 * percentage for a `pct` group, the bare value for `raw` and `min4`). Recombine with `applyGroupStep` over COIN_GROUPS from 1 to get
 * lib/arkh's total. `save` as in arkhDamageLeaves.
 */
export const arkhCoinLeaves = (save: unknown, ci: number, map: number): Record<string, number> => coinEntry(save, ci, map).leaves;

/** One Coin source of lib/arkh on an envelope, resolved alone (the resolver the tree calls, `coin.resolve`): a proof that patches the envelope of ~1100 characters per leaf cannot afford the whole tree (about 1 s each). */
export function arkhCoinLeaf(env: any, ci: number, map: number, id: string): number {
  loadSaveData(structuredClone(env));
  return coin.resolve(id, statCtx(env, ci, map)).val;
}

/** lib/arkh's Coin tree's names, formats, notes and node count for character `ci` on `map` (cached with the leaves). `save` as in arkhDamageLeaves. */
export const arkhCoinShape = (save: unknown, ci: number, map: number): CoinShape => coinEntry(save, ci, map).shape;

/** lib/arkh's own Coin Multi total (computeArkhCoinMulti(...).total): the oracle for the whole tree. */
export const arkhCoinMulti = (save: unknown, ci: number, map: number): number => coinEntry(save, ci, map).total;

// ---- Multikill: lib/arkh's tree is not grouped (root children: Base / Damage Tier / per Tier / Active, rules inside the halves), so the leaves are
// read from its pools (the sources of each MK_POOLS pool, in order). One buildPools per entry: the tree is its combine(), as computeArkhMultikill's buildTree does.
/** A node of lib/arkh's Multikill tree as the tracker adapter test compares it: a half's sources stop there (lib/arkh's own detail below them is no contract), the tier's and the status's rows are whole. */
export type MkShape = Shape & { val: number; children?: MkShape[] };
type MkEntry = { leaves: Record<string, number>; total: number; shape: MkShape; nodes: number };

const mkShape = (n: ArkhNode, source = false): MkShape => ({
  ...shapeOf(n),
  val: n.val,
  ...(n.children && !source ? { children: n.children.map((c) => mkShape(c, n.name === MK_NODES.base || n.name === MK_NODES.perTier)) } : {}),
});

function mkEntryOf(parsed: any, ci: number, map: number): MkEntry {
  const pools = computeArkhMultikillPools(parsed, ci, map);
  const { tree, total } = combineMultikillPools(pools);
  const leaves: Record<string, number> = {};
  for (const [key, ids] of Object.entries(MK_POOLS)) {
    const items = pools[key].items;
    if (items.length !== ids.length) throw new Error(`arkhMkLeaves: lib/arkh's ${key} pool has ${items.length} sources, MK_POOLS has ${ids.length}`);
    ids.forEach((id, k) => (leaves[id] = items[k].val));
  }
  return { leaves, total, shape: mkShape(tree), nodes: countNodes(tree) };
}

const mkEntry = sectionCache("mk", mkEntryOf);

/**
 * Every Multikill source's `val` in lib/arkh's pools for character `ci` on `map`, by MK_POOLS id (`tier`, `softCap` 0/1, `cove` 0/1 and
 * `active` included). Recombine with `mkTotal` (sums of the `base` and `perTier` ids, `tier`, `softCap`, `cove`) to get lib/arkh's total; the
 * Cove's two replacement values are the children of its source and are not leaves. `save` as in arkhDamageLeaves.
 */
export const arkhMkLeaves = (save: unknown, ci: number, map: number): Record<string, number> => mkEntry(save, ci, map).leaves;

/** lib/arkh's Multikill tree (see MkShape) and its whole node count for character `ci` on `map` (cached with the leaves). `save` as in arkhDamageLeaves. */
export const arkhMkShape = (save: unknown, ci: number, map: number): { shape: MkShape; nodes: number } => mkEntry(save, ci, map);

/** lib/arkh's own Multikill total (computeArkhMultikill(...).total): the oracle for the whole tree. */
export const arkhMultikill = (save: unknown, ci: number, map: number): number => mkEntry(save, ci, map).total;
