// The KNOWN propagation of the Damage totals (a support module: vitest only collects *.test.ts), shared by njs/damage.test.ts (DamageDealed
// against lib/arkh) and trackers/damage.test.ts (the page's adapter against lib/arkh): a pair whose total differs must be closed by the KNOWN
// entries of its Damage leaves and of the stats the leaves read, every one of them proved at once (support/arkhOracle's seeds and patches),
// never listed again.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhStatSeeds, damageReasonSeeds, type ArkhStat, type Seed } from "./arkhOracle";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";

/** The stats Damage's leaves read: a KNOWN row of one of them can move the total. */
export const DAMAGE_STATS: readonly (ArkhStat | "speed")[] = ["str", "agi", "wis", "luk", "maxHp", "maxMp", "accuracy", "speed"];

/** The pairs per map whose total differs and the KNOWN entries close (an exact count: a stale entry or a new difference fails). */
export const EXPECT_TOTAL_KNOWN: Record<number, { max: number; mastery: number }> = { 251: { max: 656, mastery: 0 }, 43: { max: 0, mastery: 0 }, 306: { max: 656, mastery: 0 }, 150: { max: 656, mastery: 0 } };

/** What DamageDealed refuses (Ruling E): the stats read the Tome, which lib/tome cannot score on HourZero (see stats.test.ts). */
export const DAMAGE_REFUSALS = ["HourZero.json: Tome rows 21,101,105,106,115,116"];

/** Character `ci` of the save has a KNOWN row of a Damage leaf or of a stat the leaves read. */
export const hasDamageKnown = (path: string, ci: number): boolean =>
  KNOWN_ARKH_DIFFS.some((d) => d.save === basename(path) && (d.ci ?? ci) === ci && (d.stat === "damage" || DAMAGE_STATS.includes(d.stat as ArkhStat)));

/** Seeds a fresh Ctx's cache: each [block, args, value] answers that call for character `ci` on `map`. */
export const seededCtx = (state: GameState, ci: number, map: number, seeds: readonly Seed[]): Ctx => {
  const c = makeCtx(state, { player: ci, map });
  for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
  return c;
};

/**
 * Every KNOWN cause of character `ci`'s Damage: the reasons of its Damage leaves (`stat: "damage"` rows) and of the stats they read (the
 * stats' rows), proved together: the patches (a save read lib/arkh makes differently) applied to one fresh state, the seeds (lib/arkh's
 * number for each cause, on the narrowest block) put in its cache. Map-independent, so computed once per pair.
 */
export type DamageProof = { reasons: string[]; seeds: Seed[]; patches: string[] };
const proofs = new Map<string, DamageProof>();
/** Drops the proofs kept so far (the worker's memory). */
export const clearDamageProofs = () => proofs.clear();

export function damageProof(path: string, ci: number): DamageProof {
  const k = `${path}#${ci}`;
  let p = proofs.get(k);
  if (p) return p;
  const rows = KNOWN_ARKH_DIFFS.filter((d) => d.save === basename(path) && (d.ci ?? ci) === ci && (d.stat === "damage" || DAMAGE_STATS.includes(d.stat as ArkhStat)));
  p = { reasons: [], seeds: [], patches: [] };
  // lib/arkh's numbers come from one load of the save per call (arkhStatSeeds): the reasons whose seed does not depend on the stat go in one
  // call; only the stat's own star signs and Tome bubble ("signs", "tomeW8") are asked per stat
  const anyStat = new Set<string>();
  const perStat = new Map<ArkhStat | "speed", Set<string>>();
  const own = new Set<string>(); // the Damage reasons damageReasonSeeds proves itself (tome, pray6, powerSuffix)
  for (const d of rows) {
    const damage = d.stat === "damage";
    const reason = damage ? d.reason! : d.source;
    p.reasons.push(`${damage ? d.source : d.stat}:${reason}`);
    // the weapon power's suffix rule is seeded on TotalStats("Weapon_Power") here: its patch may have to move the power onto the weapon,
    // whose own power Minehead("WepPowDmgPCT") reads too
    if (damage && reason === "powerSuffix") own.add(reason);
    else if (PROOF_PATCHES[reason]) {
      if (!p.patches.includes(reason)) p.patches.push(reason);
    } else if (damage && (reason === "tome" || reason === "pray6")) own.add(reason);
    else if (!damage && (reason === "signs" || reason === "tomeW8")) (perStat.get(d.stat as ArkhStat) ?? perStat.set(d.stat as ArkhStat, new Set()).get(d.stat as ArkhStat)!).add(reason);
    else anyStat.add(reason);
  }
  for (const r of own) p.seeds.push(...damageReasonSeeds(path, ci, r));
  if (anyStat.size) p.seeds.push(...arkhStatSeeds(path, ci, [...anyStat], "str"));
  for (const [stat, reasons] of perStat) p.seeds.push(...arkhStatSeeds(path, ci, [...reasons], stat));
  proofs.set(k, p);
  return p;
}

/** A Ctx for character `ci` on `map` with the proof applied: the patches on a fresh state of the save (else `state`), the seeds in its cache. */
export function damageProvedCtx(path: string, ci: number, map: number, proof: DamageProof, state: GameState): Ctx {
  if (proof.patches.length) {
    const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
    for (const r of proof.patches) PROOF_PATCHES[r](env.data as Record<string, unknown>, ci, state.charNames.length);
    state = buildGameState(env);
  }
  return seededCtx(state, ci, map, proof.seeds);
}
