// Thingies("LoreEpiBon", 3, 0) at controlled Tome scores. The score is DNSM.TomeQTYtot (Ruling K), which is seeded on the Ctx here
// (seedBlock: a module mock cannot reach it, Thingies -> DNSM -> Summoning -> Thingies is a cycle) so the test can put any total in: the
// formula against a hand computation. The real score is used in w7Systems.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, gameCtx } from "../support/saves";
import { seedBlock, type Ctx } from "@/lib/game/ctx";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Summoning } from "@/lib/game/njs/Summoning";
import { Thingies } from "@/lib/game/njs/Thingies";
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];

/** ARKHE with Spelunk[13][2] = `unlocked` lore episodes and the Tome score `score` (a new state each time: the blocks are cached per Ctx). */
function lore(score: number, unlocked = 10): Ctx {
  const env = JSON.parse(readFileSync(BASE, "utf8"));
  const spelunk = typeof env.data.Spelunk === "string" ? JSON.parse(env.data.Spelunk) : env.data.Spelunk;
  spelunk[13][2] = unlocked;
  env.data.Spelunk = spelunk;
  return tomeAt(gameCtx(env, 0), score);
}
/** `c` with the Tome score `score` (DNSM.TomeQTYtot of its character and map). */
const tomeAt = (c: Ctx, score: number): Ctx => (seedBlock(c, "DNSM.TomeQTYtot", [], score), c);
const term = (c: Ctx, b = 3) => Thingies(c, "LoreEpiBon", b, 0);
const boost = (c: Ctx) => 1 + (Summoning(c, "GrimoireUpgBonus", 17, 0) + GetSetBonus(c, "TROLL_SET", "Bonus", 0, 0)) / 100;

describe.skipIf(GOLDEN_SAVES.length === 0)("Thingies LoreEpiBon at controlled Tome scores", () => {
  it("episode 3 ('100|3000') at 13000 points is boost x 100 x p / (25 + p), p = floor(10000 / 100) ^ .7 = 100 ^ .7", () => {
    const c = lore(13000);
    const p = Math.pow(100, 0.7);
    expect(p).toBeCloseTo(25.1188643150958, 12);
    expect(p / (25 + p)).toBeCloseTo(0.5011858241075506, 12); // 25.1188643150958 / 50.1188643150958
    expect(term(c)).toBeCloseTo(boost(c) * 100 * (p / (25 + p)), 12);
  });
  it("the power counts whole hundreds: 3199 and 3100 points are the same, 3200 is one more", () => {
    const at = (t: number) => term(lore(t));
    expect(at(3199)).toBe(at(3100));
    expect(at(3200)).toBeGreaterThan(at(3100));
    expect(at(3100)).toBeGreaterThan(0); // floor(100 / 100) = 1, 1 ^ .7 = 1: 1 / 26
  });
  it("is 0 up to the entry's start (3000), at 0 points, and for an episode not unlocked yet", () => {
    expect(term(lore(3000))).toBe(0);
    expect(term(lore(3099))).toBe(0);
    expect(term(lore(0))).toBe(0);
    expect(term(lore(13000, 3))).toBe(0);
    expect(term(lore(13000, 4))).toBeGreaterThan(0);
  });
  it("a Tome score of 0 is a score: no episode has anything", () => {
    for (const b of [0, 3, 10]) expect(term(lore(0), b), `b=${b}`).toBe(0);
  });
  it("the score is the one DNSM.TomeQTYtot gives", () => {
    expect(term(lore(250000))).toBeGreaterThan(term(lore(13000)));
  });
});
