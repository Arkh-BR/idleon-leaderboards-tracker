// Task 2 (AFK plan): every leaf of AFKgainrates("Fighting") (N.js _customBlock_AFKgainrates), except the three map-rule nodes (clamworks306,
// cglunkoCove, afkType: Task 3), against lib/arkh's leaf of the same id over every real save and character (relative 1e-9). `d == "Fighting"`
// skips the first block (`if ("Fighting" != d)`, with TalentEnh(79), CardBonusREAL(46)...), so the sum is Tasks merit + the ALL block + the
// fight terms. N.js is the truth: a difference is a KNOWN entry with its evidence and a seeded proof, or a mismatch.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhAfkLeaves, arkhStatSeeds } from "../support/arkhOracle";
import { MissingSaveKey } from "@/lib/game/errors";
import { asNum } from "@/lib/game/attr";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { listAt } from "@/lib/game/lists";
import { DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { GetBribeBonus } from "@/lib/game/njs/GetBribeBonus";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GuildBonuses } from "@/lib/game/njs/GuildBonuses";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { Windwalker } from "@/lib/game/njs/Windwalker";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { FlurboShop } from "@/lib/game/njs/FlurboShop";
import { Divinity } from "@/lib/game/njs/Divinity";
import { Companions } from "@/lib/game/njs/Companions";
import { Shrine } from "@/lib/game/njs/Shrine";
import { TalentCalc } from "@/lib/game/njs/TalentCalc";
import { Summoning } from "@/lib/game/njs/Summoning";
import { haveBan } from "@/lib/game/njs/Thingies";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena; not 306 / 216
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

/** The lib/game term of each lib/arkh leaf, as AFKgainrates("Fighting") adds it (the leaf of a source is the % it adds to the sum). */
const TERMS: Record<string, (c: Ctx) => number> = {
  // fight terms, N.js order (@4422xxx: `.4 + (...) / 100`)
  base: () => 40, // the literal .4 of `(.4 + Σ/100)`, shown by lib/arkh as a 40% source inside Σ
  fam8: (c) => DNSM_FamBonusQTYs(c, "8"),
  boxFightAFK: (c) => DNSM_BoxRewards(c, "fightAFK"),
  talent88: (c) => GetTalentNumber(c, 1, 88),
  bribe3: (c) => GetBribeBonus(c, "3"),
  talent268: (c) => GetTalentNumber(c, 1, 268),
  cardSet10: (c) => CardSetBonuses(c, 0, "10"),
  talent448: (c) => GetTalentNumber(c, 1, 448),
  talent621: (c) => GetTalentNumber(c, 1, 621),
  card43: (c) => CardBonusREAL(c, 43),
  talent79: (c) => GetTalentNumber(c, 1, 79),
  etc20: (c) => EtcBonuses(c, "20"),
  etc59: (c) => EtcBonuses(c, "59"),
  starFightAFK: (c) => DNSM_StarSigns(c, "FightAFK"),
  guild4: (c) => GuildBonuses(c, 4),
  prayer4: (c) => prayersReal(c, 4, 0),
  curse12: (c) => -prayersReal(c, 12, 1), // `prayersReal(4,0) - prayersReal(12,1)`
  chipFafk: (c) => chipBonuses(c, "fafk"),
  cardW6d1: (c) => RunCodeOfTypeXforThingY(c, "CardLv", "w6d1"),
  // ALL terms: AFKgainzzALL = merit (2) + ...
  merit: (c) => (asNum(c, "Tasks", 2, 1, 2) > c.player ? 2 : 0), // `Tasks[2][1][2] > GetPlayersUsernames.indexOf(UserInfo[0])`: the current character's index
  arcade6: (c) => ArcadeBonus(c, 6),
  compass57: (c) => Windwalker(c, "CompassBonus", 57, 0),
  voidSet: (c) => GetSetBonus(c, "VOID_SET", "Bonus", 0, 0),
  flurbo7: (c) => FlurboShop(c, 7),
  divMajor: (c) => 30 * Divinity(c, "Bonus_MAJOR", c.player, 0),
  divMinor5: (c) => Divinity(c, "Bonus_Minor", -1, 5),
  comp6: (c) => Companions(c, 6),
  comp25: (c) => Companions(c, 25),
  shrine8: (c) => Shrine(c, 8),
  talent650: (c) => TalentCalc(c, 650),
  winBonus11: (c) => Summoning(c, "WinBonus", 11, 0),
  goldFoodAllAFK: (c) => GoldFoodBonuses(c, "AllAFK"),
  cardW6d3: (c) => 1.5 * RunCodeOfTypeXforThingY(c, "CardLv", "w6d3"),
  roo5: (c) => Summoning(c, "RooBonuses", 5, 0),
  vote6: (c) => Summoning(c, "VotingBonusz", 6, 0),
  eventShop5: (c) => 20 * Summoning(c, "EventShopOwned", 5, 0),
  vault23: (c) => Summoning(c, "VaultUpgBonus", 23, 0),
  bunU: (c) => (1 == haveBan(c, "bun_u") ? 30 : 0), // `1 == BundlesReceived.bun_u && AFKgainzzALL += 30` (an absent BundlesReceived is the loader's empty map, Ruling H)
  // the MULTI factors: (1 + ArcaneType(...) / 100) * (1 + EtcBonuses("92") / 100)
  arcaneMapAfk: (c) => ArcaneType(c, "ArcaneMapMulti_bon", 2, 0),
  etc92: (c) => EtcBonuses(c, "92"),
};

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be. */
const OWN: Record<string, string[]> = {
  fam8: ['DNSM.FamBonusQTYs["8"]'], boxFightAFK: ['DNSM.BoxRewards["fightAFK"]'],
  talent88: ["GetTalentNumber[1,88]"], talent268: ["GetTalentNumber[1,268]"], talent448: ["GetTalentNumber[1,448]"], talent621: ["GetTalentNumber[1,621]"], talent79: ["GetTalentNumber[1,79]"],
  bribe3: ['GetBribeBonus["3"]'], cardSet10: ['CardSetBonuses[0,"10"]'], card43: ["CardBonusREAL[43]"], etc20: ['EtcBonuses["20"]'], etc59: ['EtcBonuses["59"]'], etc92: ['EtcBonuses["92"]'],
  starFightAFK: ['DNSM.StarSigns["FightAFK"]'], guild4: ["GuildBonuses[4]"], prayer4: ["prayersReal[4,0]"], curse12: ["prayersReal[12,1]"], chipFafk: ['chipBonuses["fafk"]'],
  cardW6d1: ['RunCodeOfTypeXforThingY["CardLv","w6d1"]'], cardW6d3: ['RunCodeOfTypeXforThingY["CardLv","w6d3"]'],
  arcade6: ["ArcadeBonus[6]"], compass57: ['Windwalker["CompassBonus",57,0]'], voidSet: ['GetSetBonus["VOID_SET","Bonus",0,0]'], flurbo7: ["FlurboShop[7]"],
  divMinor5: ['Divinity["Bonus_Minor",-1,5]'], comp6: ["Companions[6]"], comp25: ["Companions[25]"], shrine8: ["Shrine[8]"], talent650: ["TalentCalc[650]"],
  winBonus11: ['Summoning["WinBonus",11,0]'], goldFoodAllAFK: ['GoldFoodBonuses["AllAFK"]'], roo5: ['Summoning["RooBonuses",5,0]'], vote6: ['Summoning["VotingBonusz",6,0]'],
  eventShop5: ['Summoning["EventShopOwned",5,0]'], vault23: ['Summoning["VaultUpgBonus",23,0]'], arcaneMapAfk: ['ArcaneType["ArcaneMapMulti_bon",2,0]'],
};
Object.freeze(OWN);

/** What each term refuses (Ruling E), by leaf id: lib/tome cannot score HourZero (see stats.test.ts, equipCards.test.ts). */
const HOURZERO: string[] = []; // HourZero, the one save lib/tome could not score, is out of the parity corpus (PARITY_EXCLUDED, support/arkhOracle.ts): nothing is refused
// the same Tome refusal reaches every term built on the talent levels (AllTalentLV -> FamBonusQTYs, the Tome bubble W8): the family bonus 8,
// the fight talents and the Divinity god levels (Bonus_Minor)
const TOME_TERMS = new Set(["goldFoodAllAFK", "fam8", "talent88", "talent268", "talent448", "talent79", "divMinor5"]);
/** The pairs per leaf whose difference a KNOWN entry closes, as a literal (a stale entry or a new difference fails): the totals of the report. */
const EXPECT_KNOWN: Record<string, number> = { talent448: 8, winBonus11: 2, divMinor5: 1, goldFoodAllAFK: 337 };
const REFUSALS = (id: string): string[] => (TOME_TERMS.has(id) ? HOURZERO : []);

/**
 * The maps a term is checked on: 251 for all, plus, for the map-dependent ones, the maps that make them differ: Shrine(8) counts on the
 * shrine's own map (ShrineInfo[8][0]) and in its world with Mainframe 5; the Arcane map bonus reads MapBon[map][2] (slot 2, kills) and is 0 when the map's
 * MapBon row has fewer than 3 slots.
 */
function mapsOf(id: string, ctx: Ctx): number[] {
  if (id === "shrine8") return [...new Set([MAP, asNum(ctx, "ShrineInfo", 8, 0)])];
  if (id === "arcaneMapAfk") {
    const out = [MAP];
    const rows = listAt(ctx, "MapBon");
    for (let m = 0; m < rows.length && out.length < 5; m++) if (asNum(ctx, "MapBon", m, 2) > 0) out.push(m);
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

describe.skipIf(GOLDEN_SAVES.length === 0)("AFKgainrates Fighting terms against lib/arkh on every real save and character", () => {
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
          const base = makeCtx(state, { player: ci, map: MAP });
          // the extra maps come from the save (ShrineInfo, MapBon): a save without them fails here, it is not checked on 251 alone
          const maps = mapsOf(id, base);
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
            const want = arkhAfkLeaves(path, ci, map)[id];
            pairs++;
            seen.add(want);
            if (want !== 0) nonZero++;
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "afk" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci);
            if (entries.length) entryPairs++;
            if (rel(got, want)) continue;
            // a KNOWN difference is proved, not skipped: lib/arkh's number for the term it names, seeded into a fresh Ctx, closes the gap
            if (entries.length) {
              const c = makeCtx(state, { player: ci, map });
              const seeds = arkhStatSeeds(path, ci, entries.map((d) => d.reason!), "str");
              // negative controls: a seed is never the cache key of the leaf under test (the proof would hold by construction)...
              for (const [name, args] of seeds) expect(OWN[id] ?? [], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
              for (const [name, args, v] of seeds) c.cache.set(`${ci}|${map}|${name}${JSON.stringify(args)}`, v);
              const seeded = TERMS[id](c);
              // ...and the seeds do something: the seeded value is not the unseeded one
              expect(rel(seeded, got), `${id} ${basename(path)}#${ci}: the seeds changed nothing`).toBe(false);
              if (rel(seeded, want)) {
                known++;
                continue;
              }
              mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}, with lib/arkh's ${entries.map((d) => d.reason).join("+")} ${seeded}`);
              continue;
            }
            mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
          }
        }
      }
      console.info(`[afkTerms ${id}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${seen.size} distinct, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, Number(process.env.AFK_MAX ?? 20))).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover (a stale entry is one that no longer differs)").toBe(entryPairs);
      expect(known, "KNOWN pairs, literally").toBe(EXPECT_KNOWN[id] ?? 0);
      expect(pairs).toBeGreaterThan(500); // saves x characters (about 1150 on 251)
      expect([...refused].sort()).toEqual(REFUSALS(id));
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "afk" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 600_000);
  }
});
