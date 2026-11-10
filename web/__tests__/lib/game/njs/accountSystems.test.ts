// Task 7 (Damage plan): the account-system terms DamageDealed("Max") reads (Summoning, Holes, Farming, Spelunk, Divinity, Workbench, Rift,
// Gaming, Thingies, Sailing, Breeding, Minehead, Research and the already-ported systems' leaves). Each is compared with lib/arkh's leaf of
// the same id over every real save and character (relative 1e-9, map 251 unless the term reads the map); N.js is the truth, so a difference
// is a KNOWN entry with its evidence and a seeded proof, or a mismatch. A describe body never reads a save: states load lazily inside `it`.
import { afterAll, afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, PROOF_PATCHES, arkhDamageLeaf, arkhStatSeeds, damageReasonSeeds, type ArkhStat, type Seed } from "../support/arkhOracle";
import { ClassStatTypes } from "@/lib/game/data";
import { ReturnClasses } from "@/lib/game/njs/ReturnClasses";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope, type GameState } from "@/lib/game/state";
import { Labb } from "@/lib/game/njs/Labb";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { Summoning } from "@/lib/game/njs/Summoning";
import { Summoning2 } from "@/lib/game/njs/Summoning2";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { getLOG } from "@/lib/game/njs/getLOG";
import { asNum } from "@/lib/game/attr";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { RiftStuff } from "@/lib/game/njs/RiftStuff";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { Thingies } from "@/lib/game/njs/Thingies";
import { Sailing } from "@/lib/game/njs/Sailing";
import { Breeding } from "@/lib/game/njs/Breeding";
import { Minehead } from "@/lib/game/njs/Minehead";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { Divinity } from "@/lib/game/njs/Divinity";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { GetBribeBonus } from "@/lib/game/njs/GetBribeBonus";
import { Ninja } from "@/lib/game/njs/Ninja";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { Companions } from "@/lib/game/njs/Companions";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

/** The lib/game term of each lib/arkh leaf, as DamageDealed uses it (the leaf of a factor source is the factor). Offsets: DamageDealed @4105019. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // Summoning (@10878764) and Summoning2 (@10931969)
  owl1: (c) => Summoning(c, "OwlBonuses", 1, 0), // base damage, @4105019+... (DamageDealtLIST[0])
  vault0: (c) => Summoning(c, "VaultUpgBonus", 0, 0),
  vault20: (c) => Summoning(c, "VaultUpgBonus", 20, 0) * Summoning(c, "VaultKillzTotal", 5, 0),
  vault27: (c) => Summoning(c, "VaultUpgBonus", 27, 0) * Summoning(c, "VaultKillzTotal", 6, 0), // damage %, DamageDealtLIST[1]
  vault15: (c) => Summoning(c, "VaultUpgBonus", 15, 0) * asNum(c, "OptionsListAccount", 338),
  vault10: (c) => 0.4 * Summoning(c, "VaultUpgBonus", 10, 0),
  owl2: (c) => Summoning(c, "OwlBonuses", 2, 0),
  roo4: (c) => Summoning(c, "RooBonuses", 4, 0),
  vault80: (c) => Summoning(c, "VaultUpgBonus", 80, 0),
  win0: (c) => Summoning(c, "WinBonus", 0, 0), // x (1 + it / 100)
  summUpg79: (c) => 1 + Summoning(c, "SummUpgBonus", 79, 0) / 100, // multipliers, DamageDealtLIST[2]
  grimoire35: (c) => Summoning(c, "GrimoireUpgBonus", 35, 0),
  vault41: (c) => Summoning(c, "VaultUpgBonus", 41, 0) * getLOG(c, asNum(c, "OptionsListAccount", 346)),
  tome0: (c) => Summoning(c, "TomeBonus", 0, 0),
  voting1: (c) => 1 + Summoning(c, "VotingBonusz", 1, 0) / 100,
  tome6: (c) => 1 + (Summoning(c, "TomeBonus", 6, 0) + (AchieveStatus(c, 371) + AchieveStatus(c, 384))) / 100,
  meritoc5: (c) => 1 + Summoning2(c, "MeritocBonusz", 5, 0) / 100,
  // Holes (@10990457) and Holes2 (@11035686)
  bUpg57: (c) => Holes(c, "B_UPG", 57, 0), // damage %, the talents' sum
  monument06: (c) => Holes(c, "MonumentROGbonuses", 0, 6),
  bUpg84: (c) => Holes(c, "B_UPG", 84, 100),
  cglunko19: (c) => 1 + Holes2(c, "Cglunko_upgBon", 19, 0) / 100,
  fountain16: (c) => 1 + Holes2(c, "Fountain_BonTOT", 1, 16) / 100,
  // Farming (@10817671), Workbench (@7801627), Rift (@10789971), Gaming (@10732554), Thingies (@10955095), Sailing (@10690910), Breeding
  // (@7929099), Minehead (@11186658), Spelunk (@11099923), Divinity (@10756776) and the systems ported before (Arcade, Bribes, Ninja, Dream,
  // Companions, Achievements, Jelly, Sushi), as DamageDealed reads them
  arcade0: (c) => ArcadeBonus(c, 0),
  lankRank14: (c) => FarmingStuffs(c, "LankRankUpgBonus", 14, 0),
  bribe30: (c) => GetBribeBonus(c, "30"),
  bribe20: (c) => GetBribeBonus(c, "20"),
  spelunkShop64: (c) => Spelunk(c, "ShopUpgBonus", 64, 0),
  divMinor7: (c) => Divinity(c, "Bonus_Minor", c.player, 7), // GetPlayersUsernames.indexOf(UserInfo[0]): the current character
  workbench: (c) => WorkbenchStuff(c, "AdditionExtraDMG", 0, 0),
  eclipse: (c) => 1 + RiftStuff(c, "eclipseSkulls", 0) / 100,
  palette34: (c) => 1 + GamingStatType(c, "PaletteBonus", 34, 0) / 100,
  pristine0: (c) => 1 + Ninja(c, "PristineBon", 0, 0) / 100,
  friend0: (c) => Thingies(c, "FriendBonusStatz", 0, 0),
  artifact25: (c) => Sailing(c, "ArtifactBonus", 25, 0),
  shiny5: (c) => Breeding(c, "ShinyBonusS", "Nah", 5, -1),
  msa0: (c) => GamingStatType(c, "MSA_Bonus", 0, 0),
  shimmer178: (c) => asNum(c, "OptionsListAccount", 178) * Dreamstuff(c, "AllShimmerBonuses", 0),
  cropSC0: (c) => FarmingStuffs(c, "CropSCbonus", 0, 0),
  riftEtc0: (c) => RiftStuff(c, "RiftSkillETC", 0),
  artifact2: (c) => Sailing(c, "ArtifactBonus", 2, 0),
  artifact8: (c) => Sailing(c, "ArtifactBonus", 8, 0),
  constMastery1: (c) => WorkbenchStuff(c, "ConstMasteryBonus", 1, 0),
  exotic41: (c) => FarmingStuffs(c, "ExoticBonusQTY", 41, 0),
  artifact27: (c) => Sailing(c, "ArtifactBonus", 27, 0),
  artifact29: (c) => Sailing(c, "ArtifactBonus", 29, 0),
  arcade46: (c) => ArcadeBonus(c, 46),
  comp10: (c) => Companions(c, 10),
  comp156: (c) => Companions(c, 156),
  petArena2: (c) => 20 * Breeding(c, "PetArenaBonus", "0", 2, 0),
  petArena15: (c) => 40 * Breeding(c, "PetArenaBonus", "0", 15, 0),
  achievements: (c) => {
    const a = (n: number) => AchieveStatus(c, n);
    return 2 * a(58) + 3 * a(59) + (5 * a(60) + 5 * a(62)) + 2 * a(119) + 3 * a(120) + (5 * a(121) + 4 * a(189) + 2 * a(185) + 3 * a(186) + (5 * a(187) + (a(240) + a(280)) + 3 * a(297) + (2 * a(303) + (2 * a(364) + (4 * a(354) + 3 * a(375))))));
  },
  bless7: (c) => Divinity(c, "BlesssBonus", 7, 0),
  bless8: (c) => Divinity(c, "BlesssBonus", 8, 0),
  minehead0: (c) => 1 + Minehead(c, "BonusQTY", 0, 0) / 100,
  wepPowDmg: (c) => 1 + Minehead(c, "WepPowDmgPCT", 0, 0) / 100,
  jelly37: (c) => 1 + JellyOperation(c, "RoG_BonusQTY", 37, 0) / 100,
  coralKid11: (c) => Math.pow(1 + Thingies(c, "CoralKidUpgBonus", 11, 0) / 100, Math.max(0, asNum(c, "Divinity", 25) - 35)),
  sushi49: (c) => 1 + SushiStuff(c, "RoG_BonusQTY", 49, 0) / 100,
  superBit64: (c) => 1 + 0.1 * GamingStatType(c, "SuperBitType", 64, 0),
  sticker: (c) => Math.max(1, FarmingStuffs(c, "StickerDMGmulti", 0, 0)),
  killroy: (c) => 1 + Math.max(0, Math.min(2, RiftStuff(c, "KillroyDMG", 0) / 100)),
  companions: (c) => Math.max(1, (1 + Companions(c, 12)) * (1 + Companions(c, 33)) * (1 + 2 * Companions(c, 160)) * (1 + 0.5 * Companions(c, 168)) * (1 + Companions(c, 170))),
  // lib/arkh's leaf is the exponent: 4 / (5 + OptionsListAccount[473]) while the Reliquarium is carried, else 0
  reliquarium: (c) => (1 == Thingies(c, "ReliquariumInPosession", 0, 0) ? 4 / (5 + asNum(c, "OptionsListAccount", 473)) : 0),
  // @4124114: x (1 + min(100, TotalGreenSigils x Grid_Bonus(127)) / 100)
  greenSigils: (c) => 1 + Math.min(100, Labb(c, "TotalGreenSigils", "0", 0, 0) * ResearchStuff(c, "Grid_Bonus", 127, 0)) / 100,
};

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be (the proof would hold by construction). */
const OWN: Record<string, string[]> = {
  owl1: ['Summoning["OwlBonuses",1,0]'],
  vault0: ['Summoning["VaultUpgBonus",0,0]'],
  vault20: ['Summoning["VaultUpgBonus",20,0]', 'Summoning["VaultKillzTotal",5,0]'],
  vault27: ['Summoning["VaultUpgBonus",27,0]', 'Summoning["VaultKillzTotal",6,0]'],
  vault15: ['Summoning["VaultUpgBonus",15,0]'],
  vault10: ['Summoning["VaultUpgBonus",10,0]'],
  owl2: ['Summoning["OwlBonuses",2,0]'],
  roo4: ['Summoning["RooBonuses",4,0]'],
  vault80: ['Summoning["VaultUpgBonus",80,0]'],
  win0: ['Summoning["WinBonus",0,0]'],
  summUpg79: ['Summoning["SummUpgBonus",79,0]'],
  grimoire35: ['Summoning["GrimoireUpgBonus",35,0]'],
  vault41: ['Summoning["VaultUpgBonus",41,0]'],
  tome0: ['Summoning["TomeBonus",0,0]'],
  voting1: ['Summoning["VotingBonusz",1,0]'],
  tome6: ['Summoning["TomeBonus",6,0]', "AchieveStatus[371]", "AchieveStatus[384]"],
  meritoc5: ['Summoning2["MeritocBonusz",5,0]'],
  bUpg57: ['Holes["B_UPG",57,0]'],
  monument06: ['Holes["MonumentROGbonuses",0,6]'],
  bUpg84: ['Holes["B_UPG",84,100]'],
  cglunko19: ['Holes2["Cglunko_upgBon",19,0]'],
  fountain16: ['Holes2["Fountain_BonTOT",1,16]'],
  arcade0: ['ArcadeBonus[0]'],
  lankRank14: ['FarmingStuffs["LankRankUpgBonus",14,0]'],
  bribe30: ['GetBribeBonus["30"]'],
  bribe20: ['GetBribeBonus["20"]'],
  spelunkShop64: ['Spelunk["ShopUpgBonus",64,0]'],
  divMinor7: Array.from({ length: 12 }, (_, p) => `Divinity["Bonus_Minor",${p},7]`),
  workbench: ['WorkbenchStuff["AdditionExtraDMG",0,0]'],
  eclipse: ['RiftStuff["eclipseSkulls",0]'],
  palette34: ['GamingStatType["PaletteBonus",34,0]'],
  pristine0: ['Ninja["PristineBon",0,0]'],
  friend0: ['Thingies["FriendBonusStatz",0,0]'],
  artifact25: ['Sailing["ArtifactBonus",25,0]'],
  shiny5: ['Breeding["ShinyBonusS","Nah",5,-1]'],
  msa0: ['GamingStatType["MSA_Bonus",0,0]'],
  shimmer178: ['Dreamstuff["AllShimmerBonuses",0]'],
  cropSC0: ['FarmingStuffs["CropSCbonus",0,0]'],
  riftEtc0: ['RiftStuff["RiftSkillETC",0]'],
  artifact2: ['Sailing["ArtifactBonus",2,0]'],
  artifact8: ['Sailing["ArtifactBonus",8,0]'],
  constMastery1: ['WorkbenchStuff["ConstMasteryBonus",1,0]'],
  exotic41: ['FarmingStuffs["ExoticBonusQTY",41,0]'],
  artifact27: ['Sailing["ArtifactBonus",27,0]'],
  artifact29: ['Sailing["ArtifactBonus",29,0]'],
  arcade46: ['ArcadeBonus[46]'],
  comp10: ['Companions[10]'],
  comp156: ['Companions[156]'],
  petArena2: ['Breeding["PetArenaBonus","0",2,0]'],
  petArena15: ['Breeding["PetArenaBonus","0",15,0]'],
  achievements: [58, 59, 60, 62, 119, 120, 121, 189, 185, 186, 187, 240, 280, 297, 303, 364, 354, 375].map((n) => `AchieveStatus[${n}]`),
  bless7: ['Divinity["BlesssBonus",7,0]'],
  bless8: ['Divinity["BlesssBonus",8,0]'],
  minehead0: ['Minehead["BonusQTY",0,0]'],
  wepPowDmg: ['Minehead["WepPowDmgPCT",0,0]'],
  jelly37: ['JellyOperation["RoG_BonusQTY",37,0]'],
  coralKid11: ['Thingies["CoralKidUpgBonus",11,0]'],
  sushi49: ['SushiStuff["RoG_BonusQTY",49,0]'],
  superBit64: ['GamingStatType["SuperBitType",64,0]'],
  sticker: ['FarmingStuffs["StickerDMGmulti",0,0]'],
  killroy: ['RiftStuff["KillroyDMG",0]'],
  companions: ['Companions[12]', 'Companions[33]', 'Companions[160]', 'Companions[168]', 'Companions[170]'],
  reliquarium: ['Thingies["ReliquariumInPosession",0,0]'],
  greenSigils: ['Labb["TotalGreenSigils","0",0,0]', 'ResearchStuff["Grid_Bonus",127,0]'],
};
Object.freeze(OWN);

/** The KNOWN pairs each leaf has, exactly (a stale entry or a new difference fails). */
const EXPECT_KNOWN: Record<string, number> = { greenSigils: 1, win0: 2, tome0: 196, tome6: 33, lankRank14: 8, workbench: 9, divMinor7: 1, sticker: 1, artifact8: 10, artifact25: 445 };

/** What each term refuses (Ruling E), as `<file>: <key>`. */
const HOURZERO: string[] = []; // HourZero, the one save lib/tome could not score, is out of the parity corpus (PARITY_EXCLUDED, support/arkhOracle.ts): nothing is refused
const REFUSED: Record<string, string[]> = Object.fromEntries(["tome0", "tome6", "lankRank14", "divMinor7", "workbench", "artifact25", "artifact8"].map((id) => [id, HOURZERO]));

/** The maps a term is compared on (map 251 when absent). */
const MAPS: Record<string, (c: Ctx) => number[]> = {};

/** The leaves built on a stat the stats' KNOWN rows cover: a pair that differs through the stat carries the stat's reasons (their seeds close it). */
const MAIN: Record<string, ArkhStat> = { STR: "str", AGI: "agi", WIS: "wis", LUK: "luk" };
const INHERIT: Record<string, (c: Ctx) => ArkhStat[]> = {
  // artifact 25 is floor(the class's primary stat / 100)
  artifact25: (c) => [MAIN[`${ClassStatTypes[`${ReturnClasses(asNum(c, "CharacterClass"))[0]}`][0]}`]],
};

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

describe.skipIf(GOLDEN_SAVES.length === 0)("account-system terms against lib/arkh on every real save and character", () => {
  for (const id of Object.keys(TERMS)) {
    it(id, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      let pairs = 0;
      let nonZero = 0;
      let known = 0;
      let direct = 0; // pairs a KNOWN entry covers: each must really differ, or the entry is stale
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
            if (Math.abs(want) > 1e-12 && Math.abs(want - 1) > 1e-12) nonZero++; // neither 0 (a % term) nor 1 (a factor)
            const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci);
            if (entries.length) direct++;
            if (rel(got, want)) continue;
            // a KNOWN difference is proved, not skipped: lib/arkh's number for the cause it names, put in a fresh Ctx, closes the gap
            const seeds: Seed[] = [];
            let proofState = state;
            for (const r of entries.map((d) => d.reason!)) {
              // the shared proofs (support/arkhOracle): a patch for a cause that is a save read, else lib/arkh's number seeded
              if (PROOF_PATCHES[r]) {
                const env = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
                PROOF_PATCHES[r](env.data as Record<string, unknown>, ci, state.charNames.length);
                proofState = buildGameState(env);
                continue;
              }
              seeds.push(...damageReasonSeeds(path, ci, r));
            }
            for (const stat of INHERIT[id]?.(withPlayer(ctxOf(path, map), ci)) ?? []) {
              const reasons = [...new Set(KNOWN_ARKH_DIFFS.filter((d) => d.stat === stat && d.save === basename(path) && (d.ci ?? ci) === ci).map((d) => d.source))];
              if (reasons.length) seeds.push(...arkhStatSeeds(path, ci, reasons, stat));
            }
            if (!seeds.length && proofState === state) {
              mismatches.push(`${basename(path)}#${ci}@${map}: game ${got}, arkh ${want}`);
              continue;
            }
            // negative controls: a seed is never the cache key of the leaf under test, and the seeds do something
            for (const [name, args] of seeds) expect(OWN[id], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
            const ctx = makeCtx(proofState, { player: ci, map });
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
      console.info(`[account ${id}] ${pairs} pairs, ${nonZero} not neutral, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`);
      if (mismatches.length) console.info(`[account ${id}] mismatched saves: ${[...new Set(mismatches.map((m) => m.split("#")[0]))].join(" ")}`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(directClosed, "pairs a KNOWN entry covers vs those that differ and are closed (a stale entry no longer differs)").toBe(direct);
      expect(known, "KNOWN pairs").toBe(EXPECT_KNOWN[id] ?? 0);
      expect([...refused].sort()).toEqual(REFUSED[id] ?? []);
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 900_000);
  }
});
