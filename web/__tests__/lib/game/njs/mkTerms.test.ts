// Task 2 (Multikill plan): every source of WorkbenchStuff("MultiKillTOTAL") (N.js @7810403), by MK_POOLS id, against lib/arkh's leaf of the same id (arkhMkLeaves) over every
// real save and character (relative 1e-9). Each term is the N.js sub-expression of its source, in the amount its half adds: the 9 terms of MultiKill_base (@7808345), the 18 of
// MultiKill_perTier (@7805748), the tier (OverkillStuffs "2"), the two map rules and the activation flag (OverkillStuffs "3", a status row). The page's own total is Task 3.
// N.js is the truth: a difference is a KNOWN entry with its evidence and a seeded proof, or a mismatch.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhMkLeaves, damageReasonSeeds, type Seed } from "../support/arkhOracle";
import { MK_POOLS } from "@/lib/arkh/stats/defs/multikill";
import { MissingSaveKey } from "@/lib/game/errors";
import { asNum, attr } from "@/lib/game/attr";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { Breeding } from "@/lib/game/njs/Breeding";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { Holes } from "@/lib/game/njs/Holes";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { Sailing } from "@/lib/game/njs/Sailing";
import { SaltLick } from "@/lib/game/njs/SaltLick";
import { StampBonusOfTypeX } from "@/lib/game/njs/StampBonusOfTypeX";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";

const MAP = 251;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

/** The lib/game term of each lib/arkh leaf, as MultiKillTOTAL uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // MultiKill_base @7808345
  sign47: (c) => DNSM_StarSigns(c, "MultiKill"),
  saltLick8: (c) => SaltLick(c, 8),
  stampC19: (c) => StampBonusOfTypeX(c, "Overkill"),
  deathNoteBuilding: (c) => 2 * asNum(c, "TowerInfo", 2),
  etc29: (c) => EtcBonuses(c, "29"),
  ach148: (c) => Math.min(5, AchieveStatus(c, 148)),
  ach122: (c) => 6 * AchieveStatus(c, 122),
  ach123: (c) => 2 * AchieveStatus(c, 123),
  talent654: (c) => ArbitraryCode(c, "StatueOnyxOwned") * GetTalentNumber(c, 1, 654),
  // MultiKill_perTier @7805748
  deathNoteWorld: (c) => WorkbenchStuff(c, "OverkillQTY", Math.floor(c.map / 50), 0),
  deathNoteMini: (c) => WorkbenchStuff(c, "OverkillQTY", 7, 0),
  vialOverkill: (c) => DNSM_AlchVials(c, "Overkill"),
  buff46: (c) => GetBuffBonuses(c, 46, 2),
  talent58: (c) => getbonus2(c, 1, 58, -1) * Math.floor(asNum(c, "OptionsListAccount", 158) / 5),
  arcade8: (c) => ArcadeBonus(c, 8),
  artifact26: (c) => Sailing(c, "ArtifactBonus", 26, 0),
  buff469: (c) => GetBuffBonuses(c, 469, 2),
  chipMkill: (c) => chipBonuses(c, "mkill"),
  etc71: (c) => EtcBonuses(c, "71"),
  meas9: (c) => Holes(c, "MeasurementBonusTOTAL", 9, 0),
  card80: (c) => CardBonusREAL(c, 80),
  sign78: (c) => DNSM_StarSigns(c, "78"),
  prayer16: (c) => prayersReal(c, 16, 0),
  shiny4: (c) => Breeding(c, "ShinyBonusS", "Nah", 4, -1),
  box13b: (c) => DNSM_BoxRewards(c, "13b"),
  bubbleMKtier: (c) => DNSM_AlchBubbles(c, "MKtierACTIVE"),
  cardSet11: (c) => CardSetBonuses(c, 0, "11"),
  // the map rules, inline in both halves: `300<=CurrentMap` (@7806815, @7808872), `216==CurrentMap&&17==Holes[0][me]` (@7808002, @7810065)
  softCap: (c) => (300 <= c.map ? 1 : 0),
  cove: (c) => (216 == c.map && 17 == (attr(c, "Holes", 0, c.player) as number) ? 1 : 0),
};

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be. */
const OWN: Record<string, string[]> = {
  tier: ['RunCodeOfTypeXforThingY["OverkillStuffs","2"]', 'DamageDealed["Max"]'],
  active: ['RunCodeOfTypeXforThingY["OverkillStuffs","3"]', 'DamageDealed["Max"]', "PlayerAccTot[]"],
  talent58: ["getbonus2[1,58,-1]"],
  prayer16: ["prayersReal[16,0]"],
};
Object.freeze(OWN);

/** The maps each term is checked on: 251 for all, plus the maps of the terms that read CurrentMap. */
const MAPS_OF: Record<string, number[]> = { deathNoteWorld: [MAP, 301, 216], tier: [MAP, 301, 216, 306], active: [MAP, 301, 216, 306], softCap: [MAP, 301], cove: [MAP, 216] };
const mapsOf = (id: string): number[] => MAPS_OF[id] ?? [MAP];

/** What each term refuses (Ruling E): lib/tome cannot score HourZero (see stats.test.ts, equipCards.test.ts): the Tome reaches the bubbles' table and, through the stats, DamageDealed and PlayerAccTot. */
const TOME_TERMS = new Set(["bubbleMKtier", "tier", "active"]);
const REFUSALS = (id: string): string[] => (TOME_TERMS.has(id) ? ["HourZero.json: Tome rows 21,101,105,106,115,116"] : []);
/** The pairs per leaf and reason whose difference a KNOWN entry closes, as a literal (a stale entry or a new difference fails). */
const EXPECT_KNOWN: Record<string, Record<string, number>> = { tier: { signsDmg: 7, "signs@wis": 1 } };
/** The pairs per leaf: 106 saves x characters (1163 on one map), less HourZero's 10 where it is refused, times the maps of the map-dependent ones. */
const PAIRS = (id: string): number => (1163 - (TOME_TERMS.has(id) ? 10 : 0)) * mapsOf(id).length;

const states = new Map<string, { state: ReturnType<typeof buildGameState>; chars: number }>();
afterAll(() => states.clear());
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const save = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
    states.set(path, (s = { state: buildGameState(save), chars: save.charNames.length }));
  }
  return s;
}

/** Term `id` with the causes `reasons` applied: the save patches on one fresh state, lib/arkh's seeds in its cache. The seeds of a reason are never the term's own key. */
function provedTerm(id: string, path: string, ci: number, map: number, reasons: readonly string[]): number {
  const patches = reasons.filter((r) => PROOF_PATCHES[r]);
  let state = stateOf(path).state;
  if (patches.length) {
    const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
    for (const r of patches) PROOF_PATCHES[r](env.data as Record<string, unknown>, ci, state.charNames.length);
    state = buildGameState(env);
  }
  const seeds: Seed[] = reasons.filter((r) => !PROOF_PATCHES[r]).flatMap((r) => damageReasonSeeds(path, ci, r));
  for (const [name, args] of seeds) expect(OWN[id] ?? [], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
  const c = makeCtx(state, { player: ci, map });
  for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
  return TERMS[id](withPlayer(c, ci));
}

describe.skipIf(GOLDEN_SAVES.length === 0)('WorkbenchStuff("MultiKillTOTAL") terms against lib/arkh on every real save and character', () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const seen = new Set<number>();
      let pairs = 0;
      let nonZero = 0;
      let known = 0;
      const perReason: Record<string, number> = {};
      let entryPairs = 0; // pairs some KNOWN entry covers: every one must really differ, or the entry is stale
      const refused = new Set<string>();
      for (const path of GOLDEN_SAVES) {
        const { state, chars } = stateOf(path);
        for (let ci = 0; ci < chars; ci++) {
          for (const map of mapsOf(id)) {
            const ctx = makeCtx(state, { player: ci, map });
            let got: number;
            try {
              got = TERMS[id](withPlayer(ctx, ci));
            } catch (e) {
              if (!(e instanceof MissingSaveKey)) throw e;
              refused.add(`${basename(path)}: ${e.key}`);
              continue;
            }
            const want = arkhMkLeaves(path, ci, map)[id];
            pairs++;
            seen.add(want);
            if (want !== 0) nonZero++;
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "mk" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
            if (entries.length) entryPairs++;
            if (rel(got, want)) continue;
            if (entries.length) {
              const reasons = entries.map((d) => d.reason!);
              const seeded = provedTerm(id, path, ci, map, reasons);
              expect(rel(seeded, got), `${id} ${basename(path)}#${ci}@${map}: the seeds changed nothing`).toBe(false);
              if (!rel(seeded, want)) {
                mismatches.push(`${id} ${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with lib/arkh's ${reasons.join("+")} ${seeded}`);
                continue;
              }
              // drop-one: every reason listed is needed for this pair
              if (reasons.length > 1) for (const r of reasons) expect(rel(provedTerm(id, path, ci, map, reasons.filter((x) => x !== r)), want), `${id} ${basename(path)}#${ci}@${map}: ${r} is not needed`).toBe(false);
              known++;
              for (const r of reasons) perReason[r] = (perReason[r] ?? 0) + 1;
              continue;
            }
            mismatches.push(`${id} ${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
          }
        }
      }
      console.info(`[mkTerms ${id}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${seen.size} distinct, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 40)).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover (a stale entry is one that no longer differs)").toBe(entryPairs);
      expect(perReason, "KNOWN pairs per reason, literally").toEqual(EXPECT_KNOWN[id] ?? {});
      expect(pairs, "saves x characters x maps").toBe(PAIRS(id));
      expect([...refused].sort()).toEqual(REFUSALS(id));
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "mk" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 600_000);
  }
});
