// Task 8 (Damage plan): DamageDealed (@4105019) against the game's own readings, in the game's display format, and two characters in one Ctx.
// A describe body never reads a save: states load lazily inside `it`.
import { GOLDEN_SAVES } from "../support/saves";
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { makeCtx, withPlayer } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { formatGameValue, normalizeGameText, parseGameValue } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import { DamageDealed } from "@/lib/game/njs/DamageDealed";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena

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
  it("the second character's terms are computed for it, nothing mixes, and the account's state is built once", () => {
    const state = buildGameState(JSON.parse(readFileSync(ARKHE!, "utf8")) as GameEnvelope);
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
    // the account's heavy part is built once: the state (one GameState for both). The Tome score is the current character's (the game
    // counts it for the one logged in), each counted on a cache of its own: none of its 124 tasks' points reach the caller's cache
    expect(withPlayer(ctx, 8).state).toBe(ctx.state);
    for (const p of [0, 8]) expect(ctx.cache.get(`${p}|${MAP}|DNSM.TomeQTYtot[]`), `Tome for ${p}`).toBeGreaterThan(3000);
    expect([...ctx.cache.keys()].some((k) => k.includes('Summoning["TomePTS"'))).toBe(false);
  }, 120_000);
});
