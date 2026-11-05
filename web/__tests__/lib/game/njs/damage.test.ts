// Task 8 (Damage plan): DamageDealed (@4105019), the terms it computes inline, its totals and the game's own readings.
//  1. The inline terms (the ones no other function owns: the primary stat, the weapon power ones, the talents, the Post Office, the map
//     rules...) against lib/arkh's leaf of the same id, as the earlier tasks did for theirs (relative 1e-9; a difference is a KNOWN entry
//     with its evidence and a seeded proof, or a mismatch).
//  2. DamageDealed("Max") and ("Mastery") against lib/arkh's Max and Mastery on every real save and character, on map 251, the arena (43),
//     the Clamworks (306) and a neutral map (150, where the readings were taken). A pair whose total differs must be closed by the KNOWN
//     entries of its leaves and of the stats the leaves read: every one of them is proved at once (support/arkhOracle's seeds and patches,
//     the same ones the leaf loops use), never listed again here.
//  3. The 4 in-game Damage readings, in the game's display format.
//  4. Two characters in one Ctx.
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, afterEach, describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  GOLDEN_SAVES,
  KNOWN_ARKH_DIFFS,
  PROOF_PATCHES,
  arkhDamageLeaf,
  arkhStatSeeds,
  damageReasonSeeds,
  type ArkhStat,
  type Seed,
} from "../support/arkhOracle";
import { DAMAGE_REFUSALS, clearDamageProofs, seededCtx } from "../support/damageProof";
import { asNum, asNumber, attr } from "@/lib/game/attr";
import { ClassStatTypes } from "@/lib/game/data";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";
import { computeTome } from "@/lib/tome/compute";
import { formatGameValue, normalizeGameText, parseGameValue } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { DamageDealed } from "@/lib/game/njs/DamageDealed";
import { DNSM_AlchBubbles, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { getLOG } from "@/lib/game/njs/getLOG";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { Holes } from "@/lib/game/njs/Holes";
import { PlayerHPmax } from "@/lib/game/njs/PlayerHPmax";
import { PlayerMPmax } from "@/lib/game/njs/PlayerMPmax";
import { PlayerSpeedBonus } from "@/lib/game/njs/PlayerSpeedBonus";
import { ReturnClasses } from "@/lib/game/njs/ReturnClasses";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { haveBan } from "@/lib/game/njs/Thingies";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { Windwalker } from "@/lib/game/njs/Windwalker";
import { listAt, listOrMapAt } from "@/lib/game/lists";
import { hString } from "@/lib/game/hstring";

// count computeTome's runs (the account's Tome score, one per state): the original still runs
vi.mock("@/lib/tome/compute", async (orig) => {
  const m = await orig<typeof import("@/lib/tome/compute")>();
  return { ...m, computeTome: vi.fn(m.computeTome) };
});

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const REFUSALS = DAMAGE_REFUSALS;

// ---- the inline terms ----

/** DN.DamageDealtSTATtype @4107309: the first class's primary stat x (1 + talents 95, 455, 20 and the W6 / A6 / M6 bubbles / 100). */
const statType = (c: Ctx) =>
  TotalStats(c, hString(ClassStatTypes[`${ReturnClasses(attr(c, "CharacterClass") as number)[0]}`][0])) *
  (1 + (GetTalentNumber(c, 1, 95) + (GetTalentNumber(c, 1, 455) + GetTalentNumber(c, 1, 20)) + (bubble(c, "W6") + (bubble(c, "A6") + bubble(c, "M6")))) / 100);
const bubble = DNSM_AlchBubbles;
const minigame0 = (c: Ctx) => asNumber((c.state.get("FamValMinigameHiscores") as unknown[])[0]);
const gtn = GetTalentNumber;

/** The lib/game term of each lib/arkh leaf, as DamageDealed uses it (a factor leaf is the factor). Offsets: DamageDealed @4105019. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // the base damage, @4107948
  wpSquared: (c) => Math.pow((TotalStats(c, "Weapon_Power") * (1 + (gtn(c, 1, 97) + (gtn(c, 1, 277) + (gtn(c, 1, 457) + Holes(c, "CosmoBonusQTY", 2, 4)))) / 100) + gtn(c, 1, 5)) / 3, 2),
  statType,
  statWpFloor: (c) => Math.min(150, 2 * TotalStats(c, "Weapon_Power") + statType(c)),
  boxBaseDmg: (c) => DNSM_BoxRewards(c, "basedmg"),
  // the damage %, @4111563 and @4112687
  statPow: (c) => Math.pow(statType(c), 0.7),
  talent113: (c) => gtn(c, 1, 113),
  talent86: (c) => getLOG(c, PlayerHPmax(c)) * gtn(c, 1, 86),
  talent446: (c) => getLOG(c, PlayerMPmax(c)) * gtn(c, 1, 446),
  talent284: (c) => gtn(c, 1, 284) * (Math.min(100, asNum(c, "Lv0", 2)) / 10),
  talent463: (c) => gtn(c, 2, 463) * Math.floor(minigame0(c) / 25),
  talent290: (c) => gtn(c, 1, 290) * Math.floor(Math.min(PlayerSpeedBonus(c) - 1, 10) / 0.15),
  talent649: (c) => getLOG(c, asNum(c, "OptionsListAccount", 161)) * gtn(c, 1, 649),
  talent638: (c) => getLOG(c, asNum(c, "OptionsListAccount", 71)) * gtn(c, 1, 638),
  talent658: (c) => Math.min(ArbitraryCode(c, "TotalQuestsComplete"), gtn(c, 1, 658)),
  // the multipliers, @4114294
  dream6: (c) => 1 + asNum(c, "Dream", 6) / 10,
  buff108: (c) => GetBuffBonuses(c, 108, 2), // a runtime 0 (product decision); lib/arkh's leaf is 0 too
  starSignPctDmg: (c) => DNSM_StarSigns(c, "PctDmg"),
  divinity507: (c) => Math.max(0, asNum(c, "Divinity", 25) - 10) * getbonus2(c, 1, 507, -1),
  level50: (c) => Math.floor(Math.max(0, asNum(c, "Lv0", 0) - 200) / 50) * getbonus2(c, 1, 50, -1),
  box12c: (c) => DNSM_BoxRewards(c, "12c"),
  box21c: (c) => DNSM_BoxRewards(c, "21c"),
  box23c: (c) => DNSM_BoxRewards(c, "23c"),
  fam20: (c) => DNSM_FamBonusQTYs(c, "20"),
  compass48: (c) => Windwalker(c, "CompassBonus", 48, 0),
  ola419: (c) => asNum(c, "OptionsListAccount", 419),
  talent6: (c) => gtn(c, 1, 6),
  ola435: (c) => asNum(c, "OptionsListAccount", 435),
  // @4118934 and after
  royalStatue0: (c) => 1 + RoyalG(c, "StatueBon", 0, 0) / 100,
  weeklyBoss: (c) => (Object.hasOwn(listOrMapAt(c, "WeeklyBoss"), "g") ? 1 + Math.min(150, asNum(c, "WeeklyBoss", "g")) / 100 : 1),
  cactolyte: (c) => {
    if (!(0 == (attr(c, "QuestComplete", "Cactolyte3") as number) && 2 == (attr(c, "CharacterClass") as number))) return 1;
    let n = 0;
    const order = listAt(c, "InventoryOrder");
    for (let e = 0; e < order.length; e++) if ("Quest47" == hString(order[e])) n += asNum(c, "ItemQuantity", e);
    return 1 <= n ? 0.5 : 1;
  },
  ola232: (c) => 1 + (10 * Math.floor((96 + asNum(c, "OptionsListAccount", 232)) / 100)) / 100,
  crystal6: (c) => 1 + Math.min(1.5 * RunCodeOfTypeXforThingY(c, "CardLv", "Crystal6"), 15) / 100,
  bundleA: (c) => (1 == haveBan(c, "bon_a") ? 1.5 : 1),
  fam80: (c) => 1 + DNSM_FamBonusQTYs(c, "80") / 100,
  // the map rules: lib/arkh's leaf of map 306 is the factor 1 / 100^Menagerie[5][2], of the arena the rat damage (0 elsewhere)
  map306: (c) => (306 == c.map ? 1 / Math.pow(100, asNum(c, "Menagerie", 5, 2)) : 1),
  ratDmg: (c) => (43 == c.map ? RoyalG(c, "RatDMG", 0, 0) : 0),
  // Mastery, @4106867
  talent113b: (c) => -gtn(c, 2, 113),
  talent123: (c) => gtn(c, 1, 123),
};

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be (the proof would hold by construction). */
const OWN: Record<string, string[]> = {
  wpSquared: ['TotalStats["Weapon_Power"]'],
  statType: ['TotalStats["STR"]', 'TotalStats["AGI"]', 'TotalStats["WIS"]', 'TotalStats["LUK"]'],
  statWpFloor: ['TotalStats["Weapon_Power"]'],
  boxBaseDmg: ['DNSM.BoxRewards["basedmg"]'],
  statPow: ['TotalStats["STR"]', 'TotalStats["AGI"]', 'TotalStats["WIS"]', 'TotalStats["LUK"]'],
  talent113: ["GetTalentNumber[1,113]"],
  talent86: ["PlayerHPmax[]", "GetTalentNumber[1,86]"],
  talent446: ["PlayerMPmax[]", "GetTalentNumber[1,446]"],
  talent284: ["GetTalentNumber[1,284]"],
  talent463: ["GetTalentNumber[2,463]"],
  talent290: ["PlayerSpeedBonus[]", "GetTalentNumber[1,290]"],
  talent649: ["GetTalentNumber[1,649]"],
  talent638: ["GetTalentNumber[1,638]"],
  talent658: ['ArbitraryCode["TotalQuestsComplete"]', "GetTalentNumber[1,658]"],
  buff108: ["GetBuffBonuses[108,2]"],
  starSignPctDmg: ['DNSM.StarSigns["PctDmg"]'],
  divinity507: ["getbonus2[1,507,-1]"],
  level50: ["getbonus2[1,50,-1]"],
  box12c: ['DNSM.BoxRewards["12c"]'],
  box21c: ['DNSM.BoxRewards["21c"]'],
  box23c: ['DNSM.BoxRewards["23c"]'],
  fam20: ['DNSM.FamBonusQTYs["20"]'],
  compass48: ['Windwalker["CompassBonus",48,0]'],
  talent6: ["GetTalentNumber[1,6]"],
  royalStatue0: ['RoyalG["StatueBon",0,0]'],
  crystal6: ['RunCodeOfTypeXforThingY["CardLv","Crystal6"]'],
  fam80: ['DNSM.FamBonusQTYs["80"]'],
  ratDmg: ['RoyalG["RatDMG",0,0]'],
  talent113b: ["GetTalentNumber[2,113]"],
  talent123: ["GetTalentNumber[1,123]"],
};
Object.freeze(OWN);

/** The maps a term is compared on (map 251 when absent): the map rules on their own map. */
const TERM_MAPS: Record<string, number[]> = { map306: [306, MAP], ratDmg: [43, MAP] };

/** The leaves built on a stat: a pair that differs through the stat carries the stat's KNOWN reasons (their seeds close it). */
const MAIN: Record<string, ArkhStat> = { STR: "str", AGI: "agi", WIS: "wis", LUK: "luk" };
const primary = (c: Ctx): ArkhStat => MAIN[`${ClassStatTypes[`${ReturnClasses(asNum(c, "CharacterClass"))[0]}`][0]}`];
const INHERIT: Record<string, (c: Ctx) => (ArkhStat | "speed")[]> = {
  statType: (c) => [primary(c)],
  statPow: (c) => [primary(c)],
  statWpFloor: (c) => [primary(c)],
  talent86: () => ["maxHp"],
  talent446: () => ["maxMp"],
  talent290: () => ["speed"],
};

/** The KNOWN pairs each inline term has, exactly (a stale entry or a new difference fails). */
const EXPECT_KNOWN: Record<string, number> = { wpSquared: 19, statType: 445, statPow: 445, talent86: 141, talent446: 134, talent463: 9, divinity507: 9, talent6: 8, starSignPctDmg: 33 };
/** The terms that read the Tome (through a stat, the talents' levels or the family bonuses), which HourZero refuses. */
const REFUSING = new Set(["wpSquared", "statType", "statWpFloor", "statPow", "talent86", "talent446", "talent284", "talent463", "talent290", "divinity507", "fam20", "talent6", "fam80", "talent123"]);

// ---- shared state ----

const states = new Map<string, GameState>();
const ctxs = new Map<string, Ctx>();
afterEach(() => ctxs.clear()); // one test's cached blocks are not the next one's: keeps the worker's memory flat
afterAll(() => {
  states.clear();
  ctxs.clear();
  clearDamageProofs();
});
function stateOf(path: string): GameState {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
}
function ctxOf(path: string, map: number): Ctx {
  const k = `${path}|${map}`;
  let c = ctxs.get(k);
  if (!c) ctxs.set(k, (c = makeCtx(stateOf(path), { player: 0, map })));
  return c;
}
const seeded = seededCtx;

describe.skipIf(GOLDEN_SAVES.length === 0)("DamageDealed's inline terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      let pairs = 0;
      let nonNeutral = 0;
      let known = 0;
      let direct = 0; // pairs a KNOWN entry of the term covers: each must really differ, or the entry is stale
      let directClosed = 0;
      const refused = new Set<string>();
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          for (const map of TERM_MAPS[id] ?? [MAP]) {
            let got: number;
            try {
              got = TERMS[id](withPlayer(ctxOf(path, map), ci));
            } catch (e) {
              if (!(e instanceof MissingSaveKey)) throw e;
              refused.add(`${basename(path)}: ${e.key}`);
              continue;
            }
            const want = arkhDamageLeaf(path, ci, map, id);
            pairs++;
            if (Math.abs(want) > 1e-12 && Math.abs(want - 1) > 1e-12) nonNeutral++;
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci);
            if (entries.length) direct++;
            if (rel(got, want)) continue;
            // a KNOWN difference is proved, not skipped: the term's own entries (a patch, or lib/arkh's number for the cause, seeded), and
            // for a term built on a stat the stat's reasons
            const seeds: Seed[] = [];
            let proofState = state;
            const patch = (r: string) => {
              const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
              PROOF_PATCHES[r](env.data as Record<string, unknown>, ci, state.charNames.length);
              proofState = buildGameState(env);
            };
            for (const r of entries.map((d) => d.reason!)) {
              if (PROOF_PATCHES[r]) patch(r);
              else seeds.push(...damageReasonSeeds(path, ci, r));
            }
            for (const stat of INHERIT[id]?.(withPlayer(ctxOf(path, map), ci)) ?? []) {
              for (const r of [...new Set(KNOWN_ARKH_DIFFS.filter((d) => d.stat === stat && d.save === basename(path) && (d.ci ?? ci) === ci).map((d) => d.source))]) {
                if (PROOF_PATCHES[r]) patch(r);
                else seeds.push(...arkhStatSeeds(path, ci, [r], stat));
              }
            }
            if (!seeds.length && proofState === state) {
              mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
              continue;
            }
            for (const [name, args] of seeds) expect(OWN[id] ?? [], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
            const proved = TERMS[id](seeded(proofState, ci, map, seeds));
            expect(rel(proved, got), `${id} ${basename(path)}#${ci}: the seeds changed nothing`).toBe(false);
            if (rel(proved, want)) {
              known++;
              if (entries.length) directClosed++;
            } else mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, seeded ${proved}`);
          }
        }
      }
      console.info(`[damage ${id}] ${pairs} pairs, ${nonNeutral} not neutral, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(directClosed, "pairs a KNOWN entry covers vs those that differ and are closed (a stale entry no longer differs)").toBe(direct);
      expect(known, "KNOWN pairs").toBe(EXPECT_KNOWN[id] ?? 0);
      expect([...refused].sort()).toEqual(REFUSING.has(id) ? REFUSALS : []);
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 900_000);
  }
});

// ---- the totals ----

// The KNOWN propagation (proofs, expected counts) lives in support/damageProof: the adapter test (trackers/damage.test.ts) runs the same one.

// The totals themselves (Max and Mastery on every real save, character and map, with the KNOWN propagation and refusals) are checked once, by the
// adapter test (trackers/damage.test.ts, maps 251/43/306/150/40): it computes the same DamageDealed calls, so a second loop only doubled the ~2 min per map.

// ---- the game's own text ----

describe("DamageDealed against the game's own text (the Damage readings, Player Info's Min~Max)", () => {
  const rows = loadReadings().filter((r) => r.stat === "damage");
  it("the readings fixture has the 4 Damage readings", () => expect(rows.length).toBe(4));
  for (const r of rows) {
    // a known engine gap (fixtures/readings.json `knownGaps`) keeps the exact assert and runs through it.fails: it turns red the day it matches
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("damage") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const c = makeCtx(buildGameState(readingSave(r) as GameEnvelope), { player: r.charIdx, map: r.map });
      const site = formatGameValue("damage", { value: DamageDealed(c, "Max"), min: DamageDealed(c, "Min") });
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
    // it.fails passes on any throw: a known gap must also stay as small as it is (farkhe: Max and Min ~1.15e-6 under the game)
    if (r.knownGaps?.includes("damage"))
      it.skipIf(!existsSync(join(READINGS_DIR, r.saveFile)))(`${r.id}: the known gap stays below 2e-6 relative`, () => {
        const c = makeCtx(buildGameState(readingSave(r) as GameEnvelope), { player: r.charIdx, map: r.map });
        const [min, max] = r.game.split("~");
        expect(Math.abs(DamageDealed(c, "Max") / parseGameValue("damage", max) - 1)).toBeLessThan(2e-6);
        expect(Math.abs(DamageDealed(c, "Min") / parseGameValue("damage", min) - 1)).toBeLessThan(2e-6);
      });
  }
});

// ---- two characters in one Ctx ----

const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");

describe.skipIf(!ARKHE)("two characters in one Ctx (ARKHE #0 and #8)", () => {
  it("the second character's terms are computed for it, nothing mixes, and the account's state and Tome score are built once", () => {
    const state = buildGameState(JSON.parse(readFileSync(ARKHE!, "utf8")) as GameEnvelope);
    vi.mocked(computeTome).mockClear();
    const ctx = makeCtx(state, { player: 0, map: MAP });
    const computed: string[] = [];
    const set = ctx.cache.set.bind(ctx.cache);
    ctx.cache.set = (k: string, v: number) => (computed.push(k), set(k, v));

    const first = DamageDealed(ctx, "Max");
    const firstKeys = new Set(computed);
    computed.length = 0;
    const second = DamageDealed(withPlayer(ctx, 8), "Max");

    // the two characters differ, and each value is the one a Ctx of its own gives
    expect(second).not.toBe(first);
    expect(second).toBe(DamageDealed(makeCtx(state, { player: 8, map: MAP }), "Max"));
    expect(DamageDealed(ctx, "Max")).toBe(first); // character 0's cached value is untouched
    expect(first).toBe(DamageDealed(makeCtx(state, { player: 0, map: MAP }), "Max"));
    // the second character's pass computed its own blocks (its key starts with its index), none of the first one's again
    expect(computed.length).toBeGreaterThan(1000);
    expect(computed.every((k) => k.startsWith("8|"))).toBe(true);
    expect(computed.some((k) => firstKeys.has(k))).toBe(false);
    // its class, talents and equipment give other values (per-character terms); the account's systems give the same ones
    // both characters computed the call (a key neither has would pass toBe(undefined) and not.toBe on undefined vacuously)
    const value = (p: number, call: string) => {
      const v = ctx.cache.get(`${p}|${MAP}|${call}`);
      expect(v, `${call} for character ${p}`).toBeDefined();
      return v;
    };
    for (const call of ['TotalStats["STR"]', 'TotalStats["Weapon_Power"]', "GetTalentNumber[1,95]", "PlayerHPmax[]"]) expect(value(8, call), call).not.toBe(value(0, call));
    for (const call of ["ArcadeBonus[0]", 'Summoning["VaultUpgBonus",0,0]', "Companions[12]", 'Sailing["ArtifactBonus",2,0]']) expect(value(8, call), call).toBe(value(0, call));
    // the account's heavy parts are built once: the state (one GameState for both) and the Tome score (computeTome, once per state)
    expect(withPlayer(ctx, 8).state).toBe(ctx.state);
    expect(vi.mocked(computeTome)).toHaveBeenCalledTimes(1);
  }, 120_000);
});
