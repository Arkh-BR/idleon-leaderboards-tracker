// Task 5 (Damage plan): the equipment, card, set, food and meal terms DamageDealed("Max") and ("Mastery") read: EtcBonuses (16, 45, 72, 75,
// 104, 21), CardBonusREAL (4, 42, 96, 21), CardSetBonuses(0,"5"), CardLv("fallEvent2"), GetSetBonus("LUSTRE_SET"), the base damage food
// (the loop DamageDealed inlines over FoodSlotsOwned, = TotalFoodBonuses("BaseDmgBoosts")), GoldFoodBonuses (BaseDamage, Damage) and
// MealBonus("TotDmg"). Each is compared with lib/arkh's leaf of the same id over every real save and character (relative 1e-9); N.js is
// the truth, so a difference is a KNOWN entry with its evidence and a seeded proof, or a mismatch.
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhDamageLeaf, arkhStatSeeds } from "../support/arkhOracle";
import { MissingSaveKey } from "@/lib/game/errors";
import { makeCtx, withPlayer, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { TotalFoodBonuses } from "@/lib/game/njs/TotalFoodBonuses";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { MealBonus } from "@/lib/game/njs/MealBonus";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena
/** What each term refuses (Ruling E): the golden food multi reads the Tome (VotingBonusz...), which lib/tome cannot score on HourZero (see stats.test.ts). */
const HOURZERO: string[] = []; // HourZero, the one save lib/tome could not score, is out of the parity corpus (PARITY_EXCLUDED, support/arkhOracle.ts): nothing is refused
const REFUSALS = (id: string) => (id === "goldFoodBase" || id === "goldFoodDmg" ? HOURZERO : []);
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));

/** The lib/game term of each lib/arkh leaf, as DamageDealed uses it (the leaf of a factor source is the factor). */
const TERMS: Record<string, (c: Ctx) => number> = {
  etc16: (c) => EtcBonuses(c, "16"), // @4105019+3990, added to the base
  etc45: (c) => EtcBonuses(c, "45"),
  etc21: (c) => EtcBonuses(c, "21"), // Mastery
  etc72: (c) => 1 + EtcBonuses(c, "72") / 100,
  etc75: (c) => 1 + EtcBonuses(c, "75") / 100,
  etc104: (c) => 1 + EtcBonuses(c, "104") / 100,
  card4: (c) => CardBonusREAL(c, 4),
  card42: (c) => CardBonusREAL(c, 42),
  card21: (c) => CardBonusREAL(c, 21), // Mastery
  card96: (c) => 1 + CardBonusREAL(c, 96) / 100,
  cardSet5: (c) => CardSetBonuses(c, 0, "5"),
  cardFallEvent2: (c) => RunCodeOfTypeXforThingY(c, "CardLv", "fallEvent2"),
  lustreSet: (c) => GetSetBonus(c, "LUSTRE_SET", "Bonus", 0, 0),
  foodBaseDmg: (c) => TotalFoodBonuses(c, "BaseDmgBoosts"),
  goldFoodBase: (c) => GoldFoodBonuses(c, "BaseDamage"),
  goldFoodDmg: (c) => GoldFoodBonuses(c, "Damage"),
  mealTotDmg: (c) => MealBonus(c, "TotDmg"),
};

/** The block key(s) each term reads directly (`<Fn><args as JSON>`): what a seed must never be. */
const OWN: Record<string, string[]> = {
  etc16: ['EtcBonuses["16"]'], etc45: ['EtcBonuses["45"]'], etc21: ['EtcBonuses["21"]'], etc72: ['EtcBonuses["72"]'], etc75: ['EtcBonuses["75"]'], etc104: ['EtcBonuses["104"]'],
  card4: ["CardBonusREAL[4]"], card42: ["CardBonusREAL[42]"], card21: ["CardBonusREAL[21]"], card96: ["CardBonusREAL[96]"],
  cardSet5: ['CardSetBonuses[0,"5"]'], cardFallEvent2: ['RunCodeOfTypeXforThingY["CardLv","fallEvent2"]'], lustreSet: ['GetSetBonus["LUSTRE_SET","Bonus",0,0]'],
  foodBaseDmg: ['TotalFoodBonuses["BaseDmgBoosts"]'], goldFoodBase: ['GoldFoodBonuses["BaseDamage"]'], goldFoodDmg: ['GoldFoodBonuses["Damage"]'], mealTotDmg: ['MealBonus["TotDmg"]'],
};
Object.freeze(OWN);

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

describe.skipIf(GOLDEN_SAVES.length === 0)("equipment, card, set, food and meal terms against lib/arkh on every real save and character", () => {
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
        const { ctx, chars } = stateOf(path);
        for (let ci = 0; ci < chars; ci++) {
          let got: number;
          try {
            got = TERMS[id](withPlayer(ctx, ci));
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${basename(path)}: ${e.key}`);
            continue;
          }
          const want = arkhDamageLeaf(path, ci, MAP, id);
          pairs++;
          seen.add(want);
          if (want !== 0) nonZero++;
          const entries = KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && d.save === basename(path) && (d.ci ?? ci) === ci);
          if (entries.length) entryPairs++;
          if (rel(got, want)) continue;
          // a KNOWN difference is proved, not skipped: lib/arkh's number for the term it names, seeded into a fresh Ctx, closes the gap
          if (entries.length) {
            const c = makeCtx(ctx.state, { player: ci, map: MAP });
            const seeds = arkhStatSeeds(path, ci, entries.map((d) => d.reason!), "str");
            // negative controls: a seed is never the cache key of the leaf under test (the proof would hold by construction)...
            for (const [name, args] of seeds) expect(OWN[id], `${id} seeded on its own key ${name}${JSON.stringify(args)}`).not.toContain(`${name}${JSON.stringify(args)}`);
            for (const [name, args, v] of seeds) c.cache.set(`${ci}|${MAP}|${name}${JSON.stringify(args)}`, v);
            const seeded = TERMS[id](c);
            // ...and the seeds do something: the seeded value is not the unseeded one
            expect(rel(seeded, got), `${id} ${basename(path)}#${ci}: the seeds changed nothing`).toBe(false);
            if (rel(seeded, want)) {
              known++;
              continue;
            }
            mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}, with lib/arkh's ${entries.map((d) => d.reason).join("+")} ${seeded}`);
            continue;
          }
          mismatches.push(`${basename(path)}#${ci}: game ${got}, arkh ${want}`);
        }
      }
      console.info(`[equipCards ${id}] ${pairs} pairs, ${nonZero} nonzero, ${known} known, ${mismatches.length} mismatches, ${refused.size} refused, ${seen.size} distinct, ${Math.round(performance.now() - t0)} ms`);
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(known, "KNOWN pairs vs pairs the entries cover (a stale entry is one that no longer differs)").toBe(entryPairs);
      expect(pairs).toBeGreaterThan(1000);
      expect([...refused].sort()).toEqual(REFUSALS(id));
      const names = new Set(GOLDEN_SAVES.map((p) => basename(p)));
      expect(KNOWN_ARKH_DIFFS.filter((d) => d.stat === "damage" && d.source === id && !names.has(d.save)).map((d) => d.save)).toEqual([]);
    }, 600_000);
  }
});
