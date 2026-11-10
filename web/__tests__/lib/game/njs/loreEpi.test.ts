// Thingies("LoreEpiBon", 3, 0) at controlled Tome scores. The score is DNSM.TomeQTYtot (Ruling K), which is mocked here so the test can
// put any total in: the formula against a hand computation, against lib/arkh at other scores, and the proof that the KNOWN_ARKH_DIFFS
// entries of the term come from the Tome source alone (with the total forced to IdleonToolbox's number, lib/game equals lib/arkh on every
// save). The real score is used in w7Systems.test.ts.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const tome = vi.hoisted(() => ({ total: 13000 }));
vi.mock("@/lib/game/njs/DNSM", async (orig) => ({ ...(await orig<typeof import("@/lib/game/njs/DNSM")>()), DNSM_TomeQTYtot: () => tome.total }));

import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhArtifactLeaf, gameCtx } from "../support/arkhOracle";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { MissingSaveKey } from "@/lib/game/errors";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Summoning } from "@/lib/game/njs/Summoning";
import { Thingies } from "@/lib/game/njs/Thingies";

const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const BASE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json") ?? GOLDEN_SAVES[0];

/** ARKHE with Spelunk[13][2] = `unlocked` lore episodes and the Tome score `score` (a new state each time: the blocks are cached per Ctx). */
function lore(score: number, unlocked = 10): Ctx {
  tome.total = score;
  const env = JSON.parse(readFileSync(BASE, "utf8"));
  const spelunk = typeof env.data.Spelunk === "string" ? JSON.parse(env.data.Spelunk) : env.data.Spelunk;
  spelunk[13][2] = unlocked;
  env.data.Spelunk = spelunk;
  return gameCtx(env, 0);
}
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

  it("at other Tome scores, on every real save, lib/game equals lib/arkh given the same score", () => {
    for (const score of [0, 3000, 3100, 13000, 250000, 5e7]) {
      const mismatches: string[] = [];
      const seen = new Set<number>();
      let pairs = 0;
      for (const path of GOLDEN_SAVES) {
        const env = JSON.parse(readFileSync(path, "utf8"));
        delete env.parsedData;
        env.extraData = { totalTomePoints: score }; // what lib/arkh reads
        tome.total = score; // what lib/game reads
        const ctx = gameCtx(env, 0);
        for (let ci = 0; ci < env.charNames.length; ci++) {
          let got: number;
          try {
            got = term(withPlayer(ctx, ci));
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            continue; // the saves older than the load steps ported (UNPORTED_REFUSALS, pinned in w7Systems.test.ts)
          }
          const want = arkhArtifactLeaf(env, ci, "loreEpi3");
          pairs++;
          seen.add(want);
          if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[lore forced Tome ${score}] ${pairs} pairs, ${mismatches.length} mismatches, ${seen.size} distinct`);
      expect(mismatches, `Tome ${score}`).toEqual([]);
      expect(pairs).toBeGreaterThan(1000);
      if (score >= 3100) expect(seen.size).toBeGreaterThan(5);
    }
  }, 300_000);

  it("the KNOWN_ARKH_DIFFS of loreEpi3 come from the Tome source alone: with the total forced to IdleonToolbox's number, lib/game equals lib/arkh on every save", () => {
    const mismatches: string[] = [];
    let pairs = 0;
    let differing = 0;
    for (const path of GOLDEN_SAVES) {
      const env = JSON.parse(readFileSync(path, "utf8"));
      const itTotal = Number(env.extraData?.totalTomePoints ?? env.parsedData?.totalTomePoints);
      expect(Number.isFinite(itTotal), basename(path)).toBe(true);
      tome.total = itTotal; // lib/arkh reads exactly this number from the file
      const ctx = gameCtx(env, 0);
      for (let ci = 0; ci < env.charNames.length; ci++) {
        let got: number;
        try {
          got = term(withPlayer(ctx, ci));
        } catch (e) {
          if (!(e instanceof MissingSaveKey)) throw e;
          continue;
        }
        pairs++;
        const want = arkhArtifactLeaf(path, ci, "loreEpi3");
        if (!rel(got, want)) mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
      }
      if (KNOWN_ARKH_DIFFS.some((d) => d.source === "loreEpi3" && d.save === basename(path))) differing++;
    }
    console.info(`[lore Tome = IdleonToolbox's] ${pairs} pairs, ${mismatches.length} mismatches, ${differing} known saves (names, not files)`);
    expect(mismatches).toEqual([]);
    expect(pairs).toBeGreaterThan(1000);
    expect(differing).toBeGreaterThan(10); // the entries exist: this proof covers them
  }, 300_000);
});
