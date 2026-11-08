// Task 2 (Coin plan): every leaf of ArbitraryCode("MonsterCash") (N.js @4047005), by COIN_GROUPS source id, against lib/arkh's leaf of the same id
// (arkhCoinLeaves) over every real save and character (relative 1e-9). Each term below is the N.js sub-expression of its source, written in the
// representation the leaf has in its group (lib/arkh/stats/defs/coin-multi.ts): the amount a `pct` group sums (the Σ of `1 + Σ / 100`), the amount a
// `min4` or `raw` group adds to its 1. The Coin page's own total (the ArbitraryCode block, the map rules) is Task 3: here the map is 301 except where
// the term reads it. N.js is the truth: a difference is a KNOWN entry with its evidence and a seeded proof, or a mismatch.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhCoinLeaf, arkhCoinLeaves, damageReasonSeeds, patchLukSnapshot, type Seed } from "../support/arkhOracle";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";
import { MissingSaveKey } from "@/lib/game/errors";
import { asNum } from "@/lib/game/attr";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards } from "@/lib/game/njs/DNSM";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { getLOG } from "@/lib/game/njs/getLOG";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GuildBonuses } from "@/lib/game/njs/GuildBonuses";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Companions } from "@/lib/game/njs/Companions";
import { Summoning } from "@/lib/game/njs/Summoning";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { Breeding } from "@/lib/game/njs/Breeding";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Divinity } from "@/lib/game/njs/Divinity";
import { Ninja } from "@/lib/game/njs/Ninja";
import { FlurboShop } from "@/lib/game/njs/FlurboShop";
import { MealBonus } from "@/lib/game/njs/MealBonus";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { Stuff2 } from "@/lib/game/njs/Stuff2";
import { Holes } from "@/lib/game/njs/Holes";
import { Sailing } from "@/lib/game/njs/Sailing";
import { bundleAsNum, Thingies } from "@/lib/game/njs/Thingies";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { TalentCalc } from "@/lib/game/njs/TalentCalc";

const MAP = 301;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

const vault = (c: Ctx, n: number) => Summoning(c, "VaultUpgBonus", n, 0);
const kills = (c: Ctx, n: number) => Summoning(c, "VaultKillzTotal", n, 0);
/** A Cash bubble's term of the first group @4047005: DNSM.AlchBubbles[key] x floor(TotalStats(stat) / 250). */
const cashBubble = (c: Ctx, key: string, stat: string) => DNSM_AlchBubbles(c, key) * Math.floor(TotalStats(c, stat) / 250);

/** The lib/game term of each lib/arkh leaf, as ArbitraryCode("MonsterCash") uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  bubbleSTR: (c) => cashBubble(c, "CashSTR", "STR"),
  bubbleAGI: (c) => cashBubble(c, "CashAGI", "AGI"),
  bubbleWIS: (c) => cashBubble(c, "CashWIS", "WIS"),
  comp24: (c) => Companions(c, 24),
  comp38: (c) => Stuff2(c, "CoinDropMulti", 0, 0) - 1,
  comp45: (c) => Companions(c, 45),
  comp159: (c) => Companions(c, 159),
  eventShop9: (c) => 0.5 * Summoning(c, "EventShopOwned", 9, 0),
  eventShop20: (c) => 0.6 * Summoning(c, "EventShopOwned", 20, 0),
  etc77: (c) => EtcBonuses(c, "77"),
  sushi18: (c) => SushiStuff(c, "RoG_BonusQTY", 18, 0),
  sushi37: (c) => SushiStuff(c, "RoG_BonusQTY", 37, 0),
  grid149: (c) => ResearchStuff(c, "Grid_Bonus", 149, 0),
  grid169: (c) => ResearchStuff(c, "Grid_Bonus", 169, 0),
  etc100: (c) => EtcBonuses(c, "100"),
  goldSet: (c) => GetSetBonus(c, "GOLD_SET", "Bonus", 0, 0),
  bunY: (c) => 250 * bundleAsNum(c, "bun_y"),
  dustWalker: (c) => Math.max(1, getbonus2(c, 1, 433, -1)) * getLOG(c, asNum(c, "OptionsListAccount", 362)),
  mealCash: (c) => MealBonus(c, "Cash"),
  roo6: (c) => Summoning(c, "RooBonuses", 6, 0),
  vote34: (c) => Summoning(c, "VotingBonusz", 34, 0),
  arena5: (c) => 0.5 * Breeding(c, "PetArenaBonus", "0", 5, 0),
  arena14: (c) => Breeding(c, "PetArenaBonus", "0", 14, 0),
  statue19: (c) => ArbitraryCode(c, "StatueBonusGiven19") / 100,
  vault34: (c) => vault(c, 34) * kills(c, 8),
  vault37: (c) => vault(c, 37) * kills(c, 9),
  pristine16: (c) => Ninja(c, "PristineBon", 16, 0),
  prayer8: (c) => prayersReal(c, 8, 0),
  divMinor3: (c) => Divinity(c, "Bonus_Minor", -1, 3),
  talent657: (c) => GetTalentNumber(c, 1, 657),
  vialCash: (c) => DNSM_AlchVials(c, "MonsterCash"),
  etc3: (c) => EtcBonuses(c, "3"),
  card11: (c) => CardBonusREAL(c, 11),
  cardW5b1: (c) => 7 * RunCodeOfTypeXforThingY(c, "CardLv", "w5b1"),
  talent22: (c) => GetTalentNumber(c, 1, 22),
  flurbo4: (c) => FlurboShop(c, 4),
  arcade10: (c) => ArcadeBonus(c, 10),
  arcade11: (c) => ArcadeBonus(c, 11),
  box13c: (c) => DNSM_BoxRewards(c, "13c"),
  guild8: (c) => GuildBonuses(c, 8) * (1 + Math.floor(c.map / 50)),
  goldFood: (c) => GoldFoodBonuses(c, "MonsterCash"),
  vault17: (c) => vault(c, 17) * getLOG(c, asNum(c, "OptionsListAccount", 340)),
  ach235: (c) => 5 * AchieveStatus(c, 235),
  ach350: (c) => 10 * AchieveStatus(c, 350),
  ach376: (c) => 20 * AchieveStatus(c, 376),
  vault2: (c) => vault(c, 2),
  vault14: (c) => vault(c, 14) * kills(c, 4),
  vault31: (c) => vault(c, 31) * kills(c, 7),
  ola420: (c) => asNum(c, "OptionsListAccount", 420),
  vault70: (c) => vault(c, 70) * Stuff2(c, "CardsCollected", 0, 0),
};
/** The sources not ported yet: the guard below names them until their family lands. */
const OPEN = new Set<string>(["gambit7", "artifact1", "friend5", "mainframe9", "cropSC4", "talent643", "talent644"]);

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be. */
const OWN: Record<string, string[]> = {
  dustWalker: ["getbonus2[1,433,-1]"], grid149: ['ResearchStuff["Grid_Bonus",149,0]'], grid169: ['ResearchStuff["Grid_Bonus",169,0]'], divMinor3: ['Divinity["Bonus_Minor",-1,3]'], prayer8: ["prayersReal[8,0]"],
  mealCash: ['MealBonus["Cash"]'], statue19: ['ArbitraryCode["StatueBonusGiven19"]'], goldFood: ['GoldFoodBonuses["MonsterCash"]'], talent643: ["TalentCalc[643]", 'RunCodeOfTypeXforThingY["OverkillStuffs","2"]'],
};
Object.freeze(OWN);

/** The KNOWN reasons proved on lib/arkh's side: what each writes into lib/arkh's envelope for character `ci`. */
const ARKH_SIDE: Record<string, (data: Record<string, unknown>, ci: number, c: Ctx) => void> = Object.fromEntries(
  (["STR", "AGI", "WIS"] as const).map((stat, at) => [`snapshot${stat}`, (d: Record<string, unknown>, ci: number, c: Ctx) => patchLukSnapshot(d, ci, TotalStats(c, stat), at)])
);

/** What each term refuses (Ruling E): lib/tome cannot score HourZero (see stats.test.ts, equipCards.test.ts). */
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"];
// the Tome refusal reaches every term built on a talent level (AllTalentLV -> FamBonusQTYs) or on a stat (TotalStats, DamageDealed)
const TOME_TERMS = new Set(["bubbleSTR", "bubbleAGI", "bubbleWIS", "goldFood", "divMinor3", "talent22", "talent643"]);
const REFUSALS = (id: string): string[] => (TOME_TERMS.has(id) ? HOURZERO : []);
/** The pairs per leaf whose difference a KNOWN entry closes, as a literal (a stale entry or a new difference fails). */
const EXPECT_KNOWN: Record<string, number> = {
  bubbleSTR: 1126, bubbleAGI: 1121, bubbleWIS: 1129, grid149: 1, grid169: 1, dustWalker: 9, mealCash: 2, statue19: 1, prayer8: 43, divMinor3: 1, goldFood: 326, talent643: 2,
};
/** The pairs per leaf: 106 saves x characters (1163 on one map), less the refused ones, plus the extra maps of the map-dependent ones. */
const PAIRS: Record<string, number> = { bubbleSTR: 1153, bubbleAGI: 1153, bubbleWIS: 1153, goldFood: 1153, divMinor3: 1153, talent22: 1162, guild8: 2326, talent643: 2306 };

/** The maps a term is checked on: 301 for all, plus 251 for the two that read CurrentMap (another world for the guild term; E 2 against 5 and another monster for the tier). */
const mapsOf = (id: string): number[] => (id === "guild8" || id === "talent643" ? [MAP, 251] : [MAP]);

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

describe("the Coin term table covers every source of lib/arkh's descriptor", () => {
  it("has one term per COIN_GROUPS source, no more", () => {
    expect([...Object.keys(TERMS), ...OPEN].sort()).toEqual(COIN_GROUPS.flatMap((g) => g.sources).sort());
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)('ArbitraryCode("MonsterCash") terms against lib/arkh on every real save and character', () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const seen = new Set<number>();
      let pairs = 0;
      let nonZero = 0;
      let known = 0;
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
            const want = arkhCoinLeaves(path, ci, map)[id];
            pairs++;
            seen.add(want);
            if (want !== 0) nonZero++;
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "coin" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
            if (entries.length) entryPairs++;
            if (rel(got, want)) continue;
            // the reasons of ARKH_SIDE are proved on lib/arkh's side: its envelope gets what lib/game reads, and its leaf must then be lib/game's
            if (entries.length && entries.every((d) => ARKH_SIDE[d.reason!])) {
              const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
              for (const d of entries) ARKH_SIDE[d.reason!](env.data as Record<string, unknown>, ci, withPlayer(ctx, ci));
              const patched = arkhCoinLeaf(env, ci, map, id);
              expect(rel(patched, want), `${id} ${basename(path)}#${ci}: the patch changed nothing`).toBe(false);
              if (rel(patched, got)) {
                known++;
                continue;
              }
              mismatches.push(`${id} ${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with lib/arkh's envelope patched ${patched}`);
              continue;
            }
            if (entries.length) {
              // the cause is either a save patch (PROOF_PATCHES) or lib/arkh's number for it, seeded
              const seeds: Seed[] = [];
              let proofState = state;
              for (const r of entries.map((d) => d.reason!)) {
                if (PROOF_PATCHES[r]) {
                  const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
                  PROOF_PATCHES[r](env.data as Record<string, unknown>, ci, state.charNames.length);
                  proofState = buildGameState(env);
                } else seeds.push(...damageReasonSeeds(path, ci, r));
              }
              const c = makeCtx(proofState, { player: ci, map });
              // negative controls: a seed is never the cache key of the leaf under test (the proof would hold by construction)...
              for (const [name, args] of seeds) expect(OWN[id] ?? [], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
              for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
              const seeded = TERMS[id](withPlayer(c, ci));
              // ...and the seeds do something: the seeded value is not the unseeded one
              expect(rel(seeded, got), `${id} ${basename(path)}#${ci}: the seeds changed nothing`).toBe(false);
              if (rel(seeded, want)) {
                known++;
                continue;
              }
              mismatches.push(`${id} ${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with lib/arkh's ${entries.map((d) => d.reason).join("+")} ${seeded}`);
              continue;
            }
            mismatches.push(`${id} ${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
          }
        }
      }
      if (process.env.COIN_DUMP) writeFileSync(`${process.env.COIN_DUMP}/${id}.txt`, [...mismatches, ...[...refused].map((r) => `refused ${r}`)].join("\n"));
      console.info(`[coinTerms ${id}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${seen.size} distinct, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, Number(process.env.COIN_MAX ?? 20))).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover (a stale entry is one that no longer differs)").toBe(entryPairs);
      expect(known, "KNOWN pairs, literally").toBe(EXPECT_KNOWN[id] ?? 0);
      expect(pairs, "saves x characters x maps").toBe(PAIRS[id] ?? 1163);
      expect([...refused].sort()).toEqual(REFUSALS(id));
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "coin" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 600_000);
  }
});
