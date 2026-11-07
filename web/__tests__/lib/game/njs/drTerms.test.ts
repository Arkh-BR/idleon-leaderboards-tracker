// Task 2 (DR plan): every leaf of TotalStats("Drop_Rarity") (N.js _customBlock_TotalStats "Drop_Rarity" @4190432, outside a dungeon: Ruling Y),
// by DR2_GROUPS source id, against lib/arkh's leaf of the same id (arkhDrLeaves) over every real save and character (relative 1e-9). Each term
// below is the N.js sub-expression of its source, written in the representation the leaf has in its group: the % points a pct group sums
// (the Σ of `1 + (1.4 DropRateLUK + Σ) / 100`, the post-processing `1 + x / 100` factors), a FACTOR for the mult groups, the amount an add
// group adds, the new total of the Cove (0 when it does not replace). The DR page's own total (the TotalStats block, the chip cap, the map
// rules) is Task 3: here the map is plain (251) except where the term reads it. N.js is the truth: a difference is a KNOWN entry with its
// evidence and a seeded proof, or a mismatch.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhDrLeaves, damageReasonSeeds, patchLukSnapshot, type Seed } from "../support/arkhOracle";
import { DR2_GROUPS } from "@/lib/arkh/stats/defs/drop-rate-v2";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { measurementBonusTotal, overkillQTY } from "@/lib/arkh/stats/systems/coin/gambit";
import { MissingSaveKey } from "@/lib/game/errors";
import { asNum, attr } from "@/lib/game/attr";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { listAt } from "@/lib/game/lists";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GuildBonuses } from "@/lib/game/njs/GuildBonuses";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Companions } from "@/lib/game/njs/Companions";
import { CompLV2 } from "@/lib/game/njs/CompLV2";
import { Shrine } from "@/lib/game/njs/Shrine";
import { Summoning } from "@/lib/game/njs/Summoning";
import { haveBan, Thingies } from "@/lib/game/njs/Thingies";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { Labb } from "@/lib/game/njs/Labb";
import { Breeding } from "@/lib/game/njs/Breeding";
import { StampBonusOfTypeX } from "@/lib/game/njs/StampBonusOfTypeX";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { MenagerieStuff } from "@/lib/game/njs/MenagerieStuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { Minehead } from "@/lib/game/njs/Minehead";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { Ninja } from "@/lib/game/njs/Ninja";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), not 216
const COVE_MAP = 216;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

/** DNSM.DropRateLUK after its curve @4190432: `1E3 > LUK ? (pow(LUK + 1, .37) - 1) / 40 : .5 x ((LUK - 1e3) / (LUK + 2500)) + .297`. */
function lukCurve(c: Ctx): number {
  const luk = TotalStats(c, "LUK");
  return 1e3 > luk ? (Math.pow(luk + 1, 0.37) - 1) / 40 : 0.5 * ((luk - 1e3) / (luk + 2500)) + 0.297;
}
const comp = (c: Ctx, n: number) => Companions(c, n);
const cardLv = (c: Ctx, card: string) => RunCodeOfTypeXforThingY(c, "CardLv", card);
/** The Cove line @4196607: `216 == CurrentMap && 17 == Holes[0][<the current character>]` (the raw element, loosely) replaces the total. */
const inCove = (c: Ctx) => COVE_MAP == c.map && 17 == attr(c, "Holes", 0, c.player);

/** The lib/game term of each lib/arkh leaf, as TotalStats("Drop_Rarity") uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // base: 1 + (1.4 x DropRateLUK + Σ) / 100 as a pct group, so the LUK source is 140 x the curve
  luk: (c) => 140 * lukCurve(c),
  talent279: (c) => GetTalentNumber(c, 1, 279),
  box11: (c) => DNSM_BoxRewards(c, "DropRate"),
  etc2: (c) => EtcBonuses(c, "2"),
  etc102: (c) => EtcBonuses(c, "102"),
  bubble: (c) => DNSM_AlchBubbles(c, "DropRate"),
  card10: (c) => CardBonusREAL(c, 10),
  talent24: (c) => GetTalentNumber(c, 1, 24),
  starSigns: (c) => DNSM_StarSigns(c, "Drop"),
  guild10: (c) => GuildBonuses(c, 10),
  cardSet5: (c) => CardSetBonuses(c, 0, "5"),
  cardSet6: (c) => CardSetBonuses(c, 0, "6"),
  shrine4: (c) => Shrine(c, 4),
  prayer7: (c) => prayersReal(c, 7, 0),
  sigil11: (c) => Labb(c, "SigilBonus", "Blank", 11, 0),
  shiny0: (c) => Breeding(c, "ShinyBonusS", "Nah", 0, -1),
  arcade27: (c) => ArcadeBonus(c, 27),
  comp3: (c) => comp(c, 3),
  comp50: (c) => comp(c, 50),
  stamp: (c) => StampBonusOfTypeX(c, "DropRate"),
  talent655: (c) => GetTalentNumber(c, 1, 655) * asNum(c, "OptionsListAccount", 189),
  dream10: (c) => 5 * asNum(c, "Dream", 10),
  win9: (c) => Summoning(c, "WinBonus", 9, 0),
  tome2: (c) => Summoning(c, "TomeBonus", 2, 0),
  // DropRateLUK2, in N.js order
  mini5a: (c) => Math.min(1.5 * cardLv(c, "mini5a"), 10),
  caveCards: (c) => Math.min(4 * cardLv(c, "caveC") + 6 * cardLv(c, "caveD"), 100),
  anni4: (c) => Math.min(2 * cardLv(c, "anni4Event1"), 20),
  luckEvent: (c) => Math.min(3 * cardLv(c, "luckEvent1"), 25),
  goldFood: (c) => GoldFoodBonuses(c, "DropRatez"),
  ach377: (c) => 6 * AchieveStatus(c, 377),
  ach381: (c) => 4 * AchieveStatus(c, 381),
  owl4: (c) => Summoning(c, "OwlBonuses", 4, 0),
  rank9: (c) => FarmingStuffs(c, "LankRankUpgBonus", 9, 0),
  vote27: (c) => Summoning(c, "VotingBonusz", 27, 0),
  hole46: (c) => Holes(c, "B_UPG", 46, 0),
  cropSC7: (c) => FarmingStuffs(c, "CropSCbonus", 7, 0),
  grimoire44: (c) => Summoning(c, "GrimoireUpgBonus", 44, 0),
  vault18: (c) => Summoning(c, "VaultUpgBonus", 18, 0),
  meas15: (c) => Holes(c, "MeasurementBonusTOTAL", 15, 0),
  comp22: (c) => comp(c, 22),
  comp158: (c) => comp(c, 158),
  hole82: (c) => Holes(c, "B_UPG", 82, 20),
  monument: (c) => Holes(c, "MonumentROGbonuses", 2, 6),
  emperor11: (c) => Thingies(c, "EmperorBon", 11, 0),
  efaunt: (c) => GetSetBonus(c, "EFAUNT_SET", "Bonus", 0, 0),
  exotic59: (c) => FarmingStuffs(c, "ExoticBonusQTY", 59, 0),
  friend3: (c) => Thingies(c, "FriendBonusStatz", 3, 0),
  legend1: (c) => Thingies(c, "LegendPTS_bonus", 1, 0),
  spelunk50: (c) => Spelunk(c, "ShopUpgBonus", 50, 0),
  comp111: (c) => comp(c, 111),
  talent239: (c) => GetTalentNumber(c, 1, 239) * (RoyalG(c, "TotalStatz", 0, 0) / 1),
  // back in Σ
  grid173: (c) => ResearchStuff(c, "Grid_Bonus", 173, 0),
  comp132: (c) => comp(c, 132),
  // the chip, an add group under 5: chipBonuses("dr") / 100
  chip: (c) => chipBonuses(c, "dr") / 100,
  bunV: (c) => (1 == haveBan(c, "bun_v") ? 2 : 0),
  workbench: (c) => WorkbenchStuff(c, "AdditionExtraEXPnDR", 0, 0),
  ola232: (c) => (1 <= asNum(c, "OptionsListAccount", 232) ? 0.3 : 0),
  bunP: (c) => (1 == haveBan(c, "bun_p") ? 1.2 : 1),
  // post-processing, % of `1 + x / 100` or a factor
  arcane: (c) => ArcaneType(c, "ArcaneMapMulti_bon", 0, 0),
  statue1: (c) => RoyalG(c, "StatueBon", 1, 0),
  menagerie24: (c) => MenagerieStuff(c, "BoostQTY", 24, 0),
  card101: (c) => CardBonusREAL(c, 101),
  family32: (c) => DNSM_FamBonusQTYs(c, "32"),
  comp168x: (c) => 1 + 0.3 * comp(c, 168),
  comp132x: (c) => 1 + (Math.min(0.5, comp(c, 132)) + 0.2 * CompLV2(c, 132)),
  sushi48: (c) => SushiStuff(c, "RoG_BonusQTY", 48, 0),
  jelly14: (c) => JellyOperation(c, "RoG_BonusQTY", 14, 0),
  glimbo: (c) => Minehead(c, "GlimboDRmulti", 0, 0), // inside Math.max(1, ·): the group is max1
  tome7: (c) => Summoning(c, "TomeBonus", 7, 0),
  etc99: (c) => EtcBonuses(c, "99"),
  minehead0: (c) => Minehead(c, "BonusQTY", 0, 0),
  cloud69: (c) => 5 * Dreamstuff(c, "CloudBonus", 69),
  pristine3: (c) => Ninja(c, "PristineBon", 3, 0),
  etc91: (c) => EtcBonuses(c, "91"),
  vial: (c) => DNSM_AlchVials(c, "7drMulto"),
  // Math.max(1, min(1.3, 1 + Companions(26)) x (1 + .5 Companions(160))): one max1 group of two factors
  comp26: (c) => Math.min(1.3, 1 + comp(c, 26)),
  comp160: (c) => 1 + 0.5 * comp(c, 160),
  comp50x: (c) => Math.min(1.01, 1 + comp(c, 50) / 2500), // inside Math.max(1, ·): the group is max1
  cove: (c) => (inCove(c) ? Holes2(c, "Cglunko_DR", 0, 0) : 0),
};

/** The leaves whose rows a later family of this task ports: skipped until its commit (the set empties as each family lands). */
const PENDING = new Set<string>(["hole46", "meas15", "cove", "friend3", "talent239", "glimbo"]);

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be. */
const OWN: Record<string, string[]> = {
  luk: ['TotalStats["LUK"]'], starSigns: ['DNSM.StarSigns["Drop"]'], goldFood: ['GoldFoodBonuses["DropRatez"]'], workbench: ['WorkbenchStuff["AdditionExtraEXPnDR",0,0]'],
  tome2: ['Summoning["TomeBonus",2,0]'], tome7: ['Summoning["TomeBonus",7,0]'], family32: ['DNSM.FamBonusQTYs["32"]'], shiny0: ['Breeding["ShinyBonusS","Nah",0,-1]'],
  talent239: ["GetTalentNumber[1,239]", 'RoyalG["TotalStatz",0,0]'], prayer7: ["prayersReal[7,0]"],
};
Object.freeze(OWN);

/** The KNOWN reasons proved on lib/arkh's side (as lukSnapshot in expTerms.test.ts): what each writes into lib/arkh's envelope for character `ci`. */
const ARKH_SIDE: Record<string, (data: Record<string, unknown>, ci: number, c: Ctx) => void> = {
  // PVStatList_<ci>[3] gets lib/game's live TotalStats("LUK") (STAT_WHY.lukSnapshot)
  lukSnapshot: (d, ci, c) => patchLukSnapshot(d, ci, TotalStats(c, "LUK")),
};

/** What each term refuses (Ruling E): lib/tome cannot score HourZero (see stats.test.ts, equipCards.test.ts). */
const HOURZERO = ["HourZero.json: Tome rows 21,101,105,106,115,116"];
// the Tome refusal reaches every term built on the talent levels (AllTalentLV -> FamBonusQTYs, the Tome bubbles) or on a stat (TotalStats LUK)
const TOME_TERMS = new Set(["luk", "bubble", "goldFood", "tome2", "rank9", "workbench", "family32", "talent279", "talent24"]);
/** The pairs per leaf whose difference a KNOWN entry closes, as a literal (a stale entry or a new difference fails): the totals of the report. */
const EXPECT_KNOWN: Record<string, number> = {
  luk: 1121, goldFood: 327, rank9: 8, workbench: 9, grid173: 1, win9: 2, tome2: 196, tome7: 33, prayer7: 43,
};
/** The pairs per leaf: 106 saves x characters (1163 on map 251), less HourZero's 10 characters where a term refuses, plus the extra maps of the map-dependent ones. */
const PAIRS: Record<string, number> = {
  luk: 1153, bubble: 1153, goldFood: 1153, tome2: 1153, rank9: 1153, workbench: 1153, family32: 1153, talent279: 1160, talent24: 1162, arcane: 5775, shrine4: 2326,
};
const REFUSALS = (id: string): string[] => (TOME_TERMS.has(id) ? HOURZERO : []);

/**
 * The maps a term is checked on: 251 for all, plus, for the map-dependent ones, the maps that make them differ: the Arcane map bonus reads
 * MapBon[map][0] (slot 0, Drop Rate), Shrine(4) the shrine's own map (ShrineInfo[4][0]), and the Cove map 216.
 */
function mapsOf(id: string, ctx: Ctx): number[] {
  if (id === "shrine4") return [...new Set([MAP, asNum(ctx, "ShrineInfo", 4, 0)])];
  if (id === "cove") return [MAP, COVE_MAP];
  if (id === "arcane") {
    const out = [MAP];
    const rows = listAt(ctx, "MapBon");
    for (let m = 0; m < rows.length && out.length < 5; m++) if (asNum(ctx, "MapBon", m, 0) > 0) out.push(m);
    return out;
  }
  return [MAP];
}

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

describe("the DR term table covers every source of lib/arkh's descriptor", () => {
  it("has one term per DR2_GROUPS source, no more", () => {
    expect(Object.keys(TERMS).sort()).toEqual(DR2_GROUPS.flatMap((g) => g.sources).sort());
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("TotalStats(\"Drop_Rarity\") terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    (PENDING.has(id) ? it.skip : it)(id, () => {
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
          // the extra maps come from the save (ShrineInfo, MapBon): a save without them fails here, it is not checked on 251 alone
          const maps = mapsOf(id, makeCtx(state, { player: ci, map: MAP }));
          for (const map of maps) {
            const ctx = makeCtx(state, { player: ci, map });
            let got: number;
            try {
              got = TERMS[id](withPlayer(ctx, ci));
            } catch (e) {
              if (!(e instanceof MissingSaveKey)) throw e;
              refused.add(`${basename(path)}: ${e.key}`);
              continue;
            }
            const want = arkhDrLeaves(path, ci, map)[id];
            pairs++;
            seen.add(want);
            if (want !== 0) nonZero++;
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "dr" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
            if (entries.length) entryPairs++;
            if (rel(got, want)) continue;
            // a KNOWN difference is proved, not skipped: lib/arkh's number for the term it names, seeded into a fresh Ctx, closes the gap
            // the reasons of ARKH_SIDE are proved on lib/arkh's side: its envelope gets what lib/game reads, and its leaf must then be lib/game's
            if (entries.length && entries.every((d) => ARKH_SIDE[d.reason!])) {
              const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
              for (const d of entries) ARKH_SIDE[d.reason!](env.data as Record<string, unknown>, ci, withPlayer(ctx, ci));
              const patched = arkhDrLeaves(env, ci, map)[id];
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
      if (process.env.DR_DUMP) writeFileSync(`${process.env.DR_DUMP}/${id}.txt`, [...mismatches, ...[...refused].map((r) => `refused ${r}`)].join("\n"));
      console.info(`[drTerms ${id}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${seen.size} distinct, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, Number(process.env.DR_MAX ?? 20))).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover (a stale entry is one that no longer differs)").toBe(entryPairs);
      expect(known, "KNOWN pairs, literally").toBe(EXPECT_KNOWN[id] ?? 0);
      expect(pairs, "saves x characters x maps").toBe(PAIRS[id] ?? 1163);
      expect([...refused].sort()).toEqual(REFUSALS(id));
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "dr" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 600_000);
  }
});

/**
 * No real save has a character in cavern 17, so on map 216 the Cove leaf is 0 on both sides above: the Cove's own value (Holes2("Cglunko_DR"),
 * account-wide) is checked here on every save with character 0 put in cavern 17 (data.Holes[0][0] = 17 on a copy of the envelope), on map 216.
 */
describe.skipIf(GOLDEN_SAVES.length === 0 || PENDING.has("cove"))("the Cove (Holes2 Cglunko_DR) on every real save, character 0 in cavern 17", () => {
  it("equals lib/arkh's Cove leaf", () => {
    const mismatches: string[] = [];
    const seen = new Set<number>();
    for (const path of GOLDEN_SAVES) {
      const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
      const data = env.data as Record<string, unknown>;
      const holes = (typeof data.Holes === "string" ? JSON.parse(data.Holes) : data.Holes) as unknown[][] | undefined;
      if (!holes?.[0]) continue; // a save before the Hole has no caverns: the Cove line reads Holes[0] and is not reached there
      holes[0][0] = 17;
      data.Holes = typeof data.Holes === "string" ? JSON.stringify(holes) : holes;
      const ctx = makeCtx(buildGameState(env), { player: 0, map: COVE_MAP });
      const got = TERMS.cove(ctx);
      const want = arkhDrLeaves(env, 0, COVE_MAP).cove;
      seen.add(want);
      if (!rel(got, want)) mismatches.push(`${basename(path)}: game ${got}, arkh ${want}`);
    }
    console.info(`[drTerms cove@17] ${seen.size} distinct`);
    expect(mismatches).toEqual([]);
    expect(seen.size, "the saves give more than one Cove value").toBeGreaterThan(1);
  }, 600_000);
});

/**
 * The measurements' kinds the Drop Rate never reads (it reads measurement 15, kind HolesInfo[52][15] = 10): lib/arkh's gambit port has the
 * Death Note pages (WorkbenchStuff("OverkillQTY", w), kind 6) and the measurements 9 (kind 0) and 13 (kind 6), so those are checked here.
 */
describe.skipIf(GOLDEN_SAVES.length === 0 || PENDING.has("meas15"))("the Death Note and the measurements 9 and 13 against lib/arkh's gambit port", () => {
  it("equal on every real save", () => {
    const mismatches: string[] = [];
    let nonZero = 0;
    const refused = new Set<string>();
    const check = (path: string, what: string, got: () => number, want: number) => {
      try {
        const g = got();
        if (!rel(g, want)) mismatches.push(`${basename(path)} ${what}: game ${g}, arkh ${want}`);
      } catch (e) {
        if (!(e instanceof MissingSaveKey)) throw e;
        refused.add(`${basename(path)}: ${e.key}`);
      }
    };
    for (const path of GOLDEN_SAVES) {
      const { state } = stateOf(path);
      const ctx = makeCtx(state, { player: 0, map: MAP });
      loadSaveData(JSON.parse(readFileSync(path, "utf8")));
      for (let w = 0; w < 8; w++) {
        const want = overkillQTY(w, saveData);
        if (want !== 0) nonZero++;
        check(path, `OverkillQTY ${w}`, () => WorkbenchStuff(ctx, "OverkillQTY", w, 0), want);
      }
      for (const i of [9, 13]) check(path, `MeasurementBonusTOTAL ${i}`, () => Holes(ctx, "MeasurementBonusTOTAL", i, 0), measurementBonusTotal(i, saveData));
    }
    console.info(`[drTerms deathNote] ${nonZero} nonzero pages`);
    expect(mismatches.slice(0, 20)).toEqual([]);
    expect(nonZero).toBeGreaterThan(0);
    // HourZero (DoOnceREAL 248.3) has KillsLeft2Advance up to map 314: the game pads every character's list to the template's length when the account loads
    // (_customEvent_AddNewStuff @19909026, the pad @19916401), which lib/game/migrations does not replay, so a Death Note page that reads a map past it is refused (Ruling E)
    expect([...refused].sort()).toEqual(["HourZero.json: KillsLeft2Advance[315]"]);
  }, 600_000);
});
