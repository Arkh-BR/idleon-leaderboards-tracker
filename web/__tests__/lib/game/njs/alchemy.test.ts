// Task 6 (Damage plan): the alchemy, stamp, statue, prayer, shrine, lab, atom and Bubba terms DamageDealed("Max") and ("Mastery") read. Each is
// compared with lib/arkh's leaf of the same id over every real save and character (relative 1e-9); N.js is the truth, so a difference is a
// KNOWN entry with its evidence and a seeded proof, or a mismatch.
import { afterAll, afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhDamageLeaf, arkhStatSeeds, arkhTotalGreenSigils, type ArkhStat } from "../support/arkhOracle";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";
import { StampBonusOfTypeX } from "@/lib/game/njs/StampBonusOfTypeX";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { DNSM_AlchBubbles, DNSM_AlchVials } from "@/lib/game/njs/DNSM";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Log2 } from "@/lib/game/njs/Log2";
import { PlayerHPmax } from "@/lib/game/njs/PlayerHPmax";
import { PlayerMPmax } from "@/lib/game/njs/PlayerMPmax";
import { PlayerSpeedBonus } from "@/lib/game/njs/PlayerSpeedBonus";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { Labb } from "@/lib/game/njs/Labb";
import { Bubbastuff } from "@/lib/game/njs/Bubbastuff";
import { Shrine } from "@/lib/game/njs/Shrine";
import { AtomCollider } from "@/lib/game/njs/AtomCollider";
import { SaltLick } from "@/lib/game/njs/SaltLick";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { asNum } from "@/lib/game/attr";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena
type Seed = [name: string, args: (string | number)[], value: number];
type StatKey = ArkhStat | "speed";
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const bubble = (k: string) => (c: Ctx) => DNSM_AlchBubbles(c, k);
const classStat = (stat: string) => (c: Ctx) => TotalStats(c, stat);

/** The lib/game term of each lib/arkh leaf, as DamageDealed uses it (the leaf of a factor source is the factor). */
const TERMS: Record<string, (c: Ctx) => number> = {
  stampBaseDmg: (c) => StampBonusOfTypeX(c, "BaseDmg"),
  stampPctDmg: (c) => StampBonusOfTypeX(c, "PctDmg"),
  statue0: (c) => ArbitraryCode(c, "StatueBonusGiven0"),
  statue22: (c) => ArbitraryCode(c, "StatueBonusGiven22"),
  bubbleHP: (c) => bubble("bdmgHP")(c) * getLOG(c, Math.max(PlayerHPmax(c) - 250, 1)),
  bubbleSPD: (c) => bubble("bdmgSPD")(c) * (Log2(c, Math.max(PlayerSpeedBonus(c) - 0.1, 0)) / 0.25),
  bubbleMP: (c) => bubble("bdmgMP")(c) * getLOG(c, Math.max(PlayerMPmax(c) - 150, 1)),
  sigil4: (c) => Labb(c, "SigilBonus", "Blank", 4, 0),
  bubbaRoG4: (c) => Bubbastuff(c, "BubbaRoG_Bonuses", 4, 0),
  bubbleW12: bubble("W12"),
  bubbleA12: bubble("A12"),
  bubbleM12: bubble("M12"),
  pctDmg1: bubble("pctDmg1"),
  pctDmg2: bubble("pctDmg2"),
  pctDmg3: bubble("pctDmg3"),
  bubbleW5: (c) => bubble("W5")(c) * Math.floor(Math.max(classStat("STR")(c), classStat("LUK")(c)) / 250),
  bubbleA5: (c) => bubble("A5")(c) * Math.floor(classStat("AGI")(c) / 250),
  bubbleM5: (c) => bubble("M5")(c) * Math.floor(classStat("WIS")(c) / 250),
  bubbleMastery: bubble("Mastery"),
  vial7dmg: (c) => 1 + DNSM_AlchVials(c, "7dmg") / 100,
  shrine0: (c) => Shrine(c, 0),
  atom9: (c) => AtomCollider(c, "AtomBonuses", 9, 0),
  saltLick9: (c) => SaltLick(c, 9),
  prayer15: (c) => prayersReal(c, 15, 0),
  penalty: (c) => Math.max((1 - GetTalentNumber(c, 1, 24) / 100) * (1 - GetBuffBonuses(c, 124, 2) / 100) * Math.max(0.01, 1 - (prayersReal(c, 6, 1) + prayersReal(c, 13, 1)) / 100), 0.05),
  mainframe0: (c) => MainframeBonus(c, 0),
  mainframe11: (c) => MainframeBonus(c, 11),
  mainframe110: (c) => MainframeBonus(c, 110),
  chipDmg: (c) => chipBonuses(c, "dmg"),
};


/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be (the proof would hold by construction). */
const OWN: Record<string, string[]> = {
  stampBaseDmg: ['StampBonusOfTypeX["BaseDmg"]'],
  stampPctDmg: ['StampBonusOfTypeX["PctDmg"]'],
  statue0: ['ArbitraryCode["StatueBonusGiven0"]'],
  statue22: ['ArbitraryCode["StatueBonusGiven22"]'],
  bubbleHP: ['DNSM.AlchBubbles["bdmgHP"]', "PlayerHPmax[]", "getLOG[1]"],
  bubbleSPD: ['DNSM.AlchBubbles["bdmgSPD"]', "PlayerSpeedBonus[]"],
  bubbleMP: ['DNSM.AlchBubbles["bdmgMP"]', "PlayerMPmax[]"],
  sigil4: ['Labb["SigilBonus","Blank",4,0]'],
  bubbaRoG4: ['Bubbastuff["BubbaRoG_Bonuses",4,0]'],
  bubbleW12: ['DNSM.AlchBubbles["W12"]'],
  bubbleA12: ['DNSM.AlchBubbles["A12"]'],
  bubbleM12: ['DNSM.AlchBubbles["M12"]'],
  pctDmg1: ['DNSM.AlchBubbles["pctDmg1"]'],
  pctDmg2: ['DNSM.AlchBubbles["pctDmg2"]'],
  pctDmg3: ['DNSM.AlchBubbles["pctDmg3"]'],
  bubbleW5: ['DNSM.AlchBubbles["W5"]', 'TotalStats["STR"]', 'TotalStats["LUK"]'],
  bubbleA5: ['DNSM.AlchBubbles["A5"]', 'TotalStats["AGI"]'],
  bubbleM5: ['DNSM.AlchBubbles["M5"]', 'TotalStats["WIS"]'],
  bubbleMastery: ['DNSM.AlchBubbles["Mastery"]'],
  vial7dmg: ['DNSM.AlchVials["7dmg"]'],
  shrine0: ["Shrine[0]"],
  atom9: ['AtomCollider["AtomBonuses",9,0]'],
  saltLick9: ["SaltLick[9]"],
  prayer15: ["prayersReal[15,0]"],
  penalty: ["prayersReal[6,1]", "prayersReal[13,1]"],
  mainframe0: ["MainframeBonus[0]"],
  mainframe11: ["MainframeBonus[11]"],
  mainframe110: ["MainframeBonus[110]"],
  chipDmg: ['chipBonuses["dmg"]'],
};
Object.freeze(OWN);

/** The leaves built on a stat the stats' KNOWN rows cover: a pair that differs through the stat carries the stat's reasons (their seeds close it). */
const INHERIT: Record<string, StatKey[]> = {
  bubbleHP: ["maxHp"],
  bubbleSPD: ["speed"],
  bubbleMP: ["maxMp"],
  bubbleW5: ["str", "luk"],
  bubbleA5: ["agi"],
  bubbleM5: ["wis"],
};

/** The KNOWN pairs each leaf has, exactly (a stale entry or a new difference fails). */
const EXPECT_KNOWN: Record<string, number> = { statue0: 6, statue22: 1, bubbleHP: 441, bubbleSPD: 121, bubbleMP: 476, bubbleW5: 195, bubbleA5: 105, bubbleM5: 135, prayer15: 40 };

/** What each term refuses (Ruling E): the terms built on a stat read the Tome (lib/tome cannot score HourZero, see stats.test.ts). */
const HOURZERO = ["bubbleHP", "bubbleSPD", "bubbleMP", "bubbleW12", "bubbleA12", "bubbleM12", "pctDmg1", "pctDmg2", "pctDmg3", "bubbleW5", "bubbleA5", "bubbleM5", "bubbleMastery", "statue0", "penalty"];

/** Shrine 0 counts on its own map (the save's ShrineInfo[0][0]), on any map of its world with the lab bonus 5, or anywhere with Artifact 0. */
const MAPS: Record<string, (c: Ctx) => number[]> = { shrine0: (c) => [MAP, asNum(c, "ShrineInfo", 0, 0), asNum(c, "ShrineInfo", 0, 0) + 1] };

const states = new Map<string, GameState>();
const ctxs = new Map<string, Ctx>();
afterEach(() => ctxs.clear()); // a leaf's cached blocks are not the next one's: keeps the worker's memory flat
afterAll(() => {
  states.clear();
  ctxs.clear();
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
/** The save with character `ci` given the first character's statue levels: what lib/arkh reads for every character (the `statues` reason). */
function withChar0Statues(path: string, ci: number, map: number): Ctx {
  const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
  const d = env.data as Record<string, unknown>;
  d[`StatueLevels_${ci}`] = d["StatueLevels_0"];
  return makeCtx(buildGameState(env), { player: ci, map });
}

describe.skipIf(GOLDEN_SAVES.length === 0)("alchemy, stamp, statue, prayer, shrine and lab terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      let pairs = 0;
      let nonZero = 0;
      let known = 0;
      let direct = 0; // pairs a direct KNOWN entry covers: each must really differ, or the entry is stale
      let directClosed = 0;
      const refused = new Set<string>();
      for (const path of GOLDEN_SAVES) {
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          for (const map of (MAPS[id] ?? (() => [MAP]))(ctxOf(path, MAP))) {
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
            if (want !== 0) nonZero++;
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci);
            if (entries.length) direct++;
            if (rel(got, want)) continue;
            // a KNOWN difference is proved, not skipped: lib/arkh's number for the cause it names, put in a fresh Ctx, closes the gap
            const seeds: Seed[] = [];
            let ctx = makeCtx(state, { player: ci, map });
            let patched = false;
            for (const r of entries.map((d) => d.reason!)) {
              if (r === "statues") {
                ctx = withChar0Statues(path, ci, map);
                patched = true;
              } else if (r === "pray6") seeds.push(["GamingStatType", ["SuperBitType", 9, 0], 0], ["GamingStatType", ["SuperBitType", 39, 0], 0]);
              else throw new Error(`alchemy.test: no seed for reason ${r}`);
            }
            for (const stat of INHERIT[id] ?? []) {
              const reasons = [...new Set(KNOWN_ARKH_DIFFS.filter((d) => d.stat === stat && d.save === basename(path) && (d.ci ?? ci) === ci).map((d) => d.source))];
              if (reasons.length) seeds.push(...arkhStatSeeds(path, ci, reasons, stat));
            }
            if (!seeds.length && !patched) {
              mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
              continue;
            }
            // negative controls: a seed is never the cache key of the leaf under test, and the seeds do something
            for (const [name, args] of seeds) expect(OWN[id], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
            for (const [name, args, v] of seeds) ctx.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
            const seeded = TERMS[id](ctx);
            expect(rel(seeded, got), `${id} ${basename(path)}#${ci}: the seeds changed nothing`).toBe(false);
            if (rel(seeded, want)) {
              known++;
              if (entries.length) directClosed++;
              continue;
            }
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, seeded ${seeded}`);
          }
        }
      }
      console.info(`[alchemy ${id}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(directClosed, "pairs a direct KNOWN entry covers vs those that differ and are closed (a stale entry no longer differs)").toBe(direct);
      expect(known, "KNOWN pairs").toBe(EXPECT_KNOWN[id] ?? 0);
      expect([...refused].sort()).toEqual(HOURZERO.includes(id) ? ["HourZero.json: Tome rows 21,101,105,106,115,116"] : []);
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 900_000);
  }
});

// greenSigils is 1 + min(100, TotalGreenSigils x ResearchStuff("Grid_Bonus", 127)) / 100: the sigil count is this task's, the grid is Task 7's
describe.skipIf(GOLDEN_SAVES.length === 0)("Labb TotalGreenSigils against lib/arkh on every real save", () => {
  it("counts the same sigils", () => {
    let nonZero = 0;
    for (const path of GOLDEN_SAVES) {
      const got = Labb(ctxOf(path, MAP), "TotalGreenSigils", "0", 0, 0);
      const want = arkhTotalGreenSigils(path);
      if (want > 0) nonZero++;
      expect(got, basename(path)).toBe(want);
    }
    expect(nonZero).toBeGreaterThan(0);
  }, 120_000);
});
