// Task 3 (Damage plan): the character stats STR/AGI/WIS/LUK, HP, MP and Accuracy, the shared base Damage and the later trackers read,
// against the game's own text on the 4 Damage readings, in the Player Info display format; and the move speed (PlayerSpeedBonus) gate of
// PlayerAccTot.
import { afterAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN_SAVES } from "../support/saves";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { PlayerMPmax } from "@/lib/game/njs/PlayerMPmax";
import { PlayerHPmax } from "@/lib/game/njs/PlayerHPmax";
import { PlayerAccTot } from "@/lib/game/njs/PlayerAccTot";
import { PlayerSpeedBonus } from "@/lib/game/njs/PlayerSpeedBonus";
import { formatGameValue } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatKey } from "@/lib/readings/types";

/** The lib/game value of each stat, as the Player Info panel shows it (before its display format); `speed` is the move speed Damage reads. */
const STATS: Partial<Record<StatKey | "speed", (c: Ctx) => number>> = {
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

describe("lib/game character stats against the game's own text (the Damage readings)", () => {
  const rows = loadReadings()
    .filter((r) => r.stat === "damage")
    .flatMap((r) => Object.entries(r.extra ?? {}).filter(([k]) => k in STATS).map(([stat, game]) => ({ r, stat: stat as StatKey, game })));
  it("the readings fixture has stat extras to compare", () => expect(rows.length).toBeGreaterThan(0));
  for (const { r, stat, game } of rows) {
    it.skipIf(!existsSync(join(READINGS_DIR, r.saveFile)))(`${r.id} ${stat}: ${game}`, () => {
      const ctx = makeCtx(buildGameState(readingSave(r) as GameEnvelope), { player: r.charIdx, map: r.map });
      expect(formatGameValue(stat, { value: STATS[stat]!(ctx) })).toBe(game);
    });
  }
});
