// Task 3 (Damage plan): the character stats STR/AGI/WIS/LUK, HP, MP and Accuracy, the shared base Damage and the later trackers read.
// Each stat is compared with lib/arkh over every real save and character (relative 1e-9), and with the game's own text on the 4 Damage
// readings, in the Player Info display format. The move speed (PlayerSpeedBonus, which Damage also reads) is compared with lib/arkh too.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhPrayersReal, arkhSpeed, arkhStat, arkhStatSeeds, type ArkhStat } from "../support/arkhOracle";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { PlayerMPmax } from "@/lib/game/njs/PlayerMPmax";
import { PlayerHPmax } from "@/lib/game/njs/PlayerHPmax";
import { PlayerAccTot } from "@/lib/game/njs/PlayerAccTot";
import { PlayerSpeedBonus } from "@/lib/game/njs/PlayerSpeedBonus";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { formatGameValue } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatKey } from "@/lib/readings/types";

/** The lib/game value of each stat, as the Player Info panel shows it (before its display format); `speed` is the move speed Damage reads. */
const STATS: Partial<Record<ArkhStat | "speed", (c: Ctx) => number>> = {
  str: (c) => TotalStats(c, "STR"),
  agi: (c) => TotalStats(c, "AGI"),
  wis: (c) => TotalStats(c, "WIS"),
  luk: (c) => TotalStats(c, "LUK"),
  maxMp: (c) => PlayerMPmax(c),
  maxHp: (c) => PlayerHPmax(c),
  accuracy: (c) => PlayerAccTot(c),
  speed: (c) => PlayerSpeedBonus(c),
};

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena

/**
 * What the stats refuse (Ruling E), `<file>: <key>`. HourZero (CSver 23, DoOnceREAL 248.3): the Tome Strength bubbles are times the Tome
 * score, and lib/tome cannot score six Tome rows of a save this old: OptionsListAccount[443], [445], [446] are holes the load steps leave
 * (step 351 writes [449] on a 401-long list, step 371 pads from there), which the game reads as asNumber(undefined) = 0 and lib/tome as
 * missing. Not changed here: lib/tome is the Tome tracker's (Ruling K).
 */
const STAT_REFUSALS = ["HourZero.json: Tome rows 21,101,105,106,115,116"];
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

// One GameState per save, shared by all its characters (withPlayer) and by the tests.
const states = new Map<string, { ctx: Ctx; chars: number }>();
afterAll(() => states.clear());
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const save = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
    states.set(path, (s = { ctx: makeCtx(buildGameState(save), { player: 0, map: MAP }), chars: save.charNames.length }));
  }
  return s;
}

describe.skipIf(GOLDEN_SAVES.length === 0)("lib/game character stats against lib/arkh on every real save and character", () => {
  for (const stat of Object.keys(STATS) as (ArkhStat | "speed")[]) {
    it(stat, () => {
      const term = STATS[stat]!;
      const t0 = performance.now();
      const mismatches: string[] = [];
      const seen = new Set<number>();
      let pairs = 0;
      const refused = new Set<string>();
      let known = 0;
      let entryPairs = 0; // pairs some KNOWN entry covers: every one must really differ, or the entry is stale
      for (const path of GOLDEN_SAVES) {
        const { ctx, chars } = stateOf(path);
        for (let ci = 0; ci < chars; ci++) {
          let got: number;
          try {
            got = term(withPlayer(ctx, ci));
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          const want = stat === "speed" ? arkhSpeed(path, ci) : arkhStat(path, ci, stat);
          pairs++;
          seen.add(want);
          const covered = KNOWN_ARKH_DIFFS.some((d) => d.stat === stat && d.save === basename(path) && (d.ci ?? ci) === ci);
          if (covered) entryPairs++;
          if (rel(got, want)) continue;
          // a KNOWN difference is proved, not skipped: lib/arkh's number for the term it names, seeded into a fresh Ctx, closes the gap
          const reasons = KNOWN_ARKH_DIFFS.filter((d) => d.stat === stat && d.save === basename(path) && (d.ci ?? ci) === ci).map((d) => d.source);
          if (reasons.length) {
            const c = makeCtx(ctx.state, { player: ci, map: MAP });
            for (const [name, args, v] of arkhStatSeeds(path, ci, reasons, stat)) c.cache.set(`${ci}|${MAP}|${name}${JSON.stringify(args)}`, v);
            const seeded = term(c);
            if (rel(seeded, want)) {
              known++;
              continue;
            }
            mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}, with lib/arkh's ${reasons.join("+")} ${seeded}`);
          } else mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[stats ${stat}] ${pairs} pairs, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${seen.size} distinct, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches).toEqual([]);
      expect(known, "KNOWN pairs counted vs pairs the entries cover (a stale entry is one that no longer differs)").toBe(entryPairs);
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === stat && !names.has(d.save)).map((d) => d.save)).toEqual([]);
      expect(pairs).toBeGreaterThan(100);
      expect(seen.size).toBeGreaterThan(100);
      expect([...refused].sort()).toEqual(STAT_REFUSALS);
    }, 600_000);
  }
});

describe.skipIf(GOLDEN_SAVES.length === 0)("PlayerAccTot's talent 641 (x (1 + talent / 100) when 1.99 < PlayerSpeedBonus(), N.js @4151358)", () => {
  // one real character, with the move speed and talent 641 put in the cache: the gate is the only thing that changes
  const acc = (speed: number, t641: number) => {
    const c = makeCtx(stateOf(GOLDEN_SAVES[0]).ctx.state, { player: 0, map: MAP });
    c.cache.set(`0|${MAP}|PlayerSpeedBonus[]`, speed);
    c.cache.set(`0|${MAP}|GetTalentNumber[2,641]`, t641);
    return PlayerAccTot(c);
  };
  it("is off at a speed of 199% or less (1.99 is not above 1.99)", () => {
    expect(acc(1.98, 50)).toBe(acc(1.98, 0));
    expect(acc(1.99, 50)).toBe(acc(1.99, 0));
  });
  it("multiplies above 199%, and the speed itself is not in the formula", () => {
    expect(acc(2, 50)).toBeGreaterThan(acc(2, 0));
    expect(acc(2, 0)).toBe(acc(1.98, 50));
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("the pray6 reason: lib/arkh's own prayersReal (both branches) is lib/game's", () => {
  it("on every character the reason covers", () => {
    const rows = KNOWN_ARKH_DIFFS.filter((d) => d.source === "pray6");
    let n = 0;
    for (const path of GOLDEN_SAVES) {
      const { ctx, chars } = stateOf(path);
      for (let ci = 0; ci < chars; ci++) {
        if (!rows.some((d) => d.save === basename(path) && (d.ci ?? ci) === ci)) continue;
        n++;
        expect(prayersReal(withPlayer(ctx, ci), 6, 0), `${basename(path)}#${ci}`).toBe(arkhPrayersReal(path, ci, 6, 0));
      }
    }
    expect(n).toBeGreaterThan(10);
  }, 600_000);
});

describe("lib/game character stats against the game's own text (the Damage readings)", () => {
  const rows = loadReadings()
    .filter((r) => r.stat === "damage")
    .flatMap((r) => Object.entries(r.extra ?? {}).filter(([k]) => k in STATS).map(([stat, game]) => ({ r, stat: stat as ArkhStat, game })));
  it("the readings fixture has stat extras to compare", () => expect(rows.length).toBeGreaterThan(0));
  for (const { r, stat, game } of rows) {
    it.skipIf(!existsSync(join(READINGS_DIR, r.saveFile)))(`${r.id} ${stat}: ${game}`, () => {
      const ctx = makeCtx(buildGameState(readingSave(r) as GameEnvelope), { player: r.charIdx, map: r.map });
      expect(formatGameValue(stat as StatKey, { value: STATS[stat]!(ctx) })).toBe(game);
    });
  }
});
