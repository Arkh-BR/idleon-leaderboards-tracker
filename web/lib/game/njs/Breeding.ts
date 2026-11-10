import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { PetStats, RANDOlist } from "../data";
import { MissingSaveKey, NotPorted } from "../errors";
import { MenagerieStuff } from "./MenagerieStuff";
import { DNSM_CalcTalentMAP } from "./TalentCalc";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Breeding(d, b, e, f)` @7929099: one function, a chain of named sub-cases. Only the
 * sub-cases the Artifact Find port reaches.
 */
export const Breeding = block("Breeding", (ctx, d: string, b: string, e: number, f: number) => {
  switch (d) {
    case "ShinyBonusS":
      return shinyBonusS(ctx, e);
    // @7937936: the `"Lv"` form, the level of pet `f` of group `e`; the `"REQ"` form is not ported
    case "SpecialPassives":
      if (b !== "Lv") throw new NotPorted("Breeding", `SpecialPassives:b=${b}`);
      return specialPassivesLv(ctx, e, f);
    // @7932815: reads the breeding actor's GenINFO[110], which it fills from the save
    case "TotPetsFound":
      return totPetsFound(ctx);
    // @7932219: 1 once the Pet Arena waves cleared (CalcTalentMAP "arena") pass e
    case "PetArenaBonus":
      return DNSM_CalcTalentMAP(ctx, "arena") > e ? 1 : 0;
    // @7932401, the next one: 1 once the Crucible waves cleared (CalcTalentMAP "arenaCruc") pass e; b ("0") is not read
    case "PetArenaCrucBonus":
      return DNSM_CalcTalentMAP(ctx, "arenaCruc") > e ? 1 : 0;
    // @7939419: pet f of group e's breedability multi, 1 + ln(max(1, (Breeding[e + 13][f] + 1)^0.725)), once the breeding actor's
    // GenINFO[53][0] is 1 (its create @10094920: Breeding[2][3] above 0), else 1; b ("0") is not read
    case "2ndMulti":
      return secondMulti(ctx, e, f);
    default:
      throw new NotPorted("Breeding", d);
  }
});

/** The shiny counts of pet group `q` (0..3): Breeding[22 + q]. The game indexes the row directly and would throw on a missing one. */
function requireShinyRow(ctx: Ctx, q: number): void {
  if (attr(ctx, "Breeding", 22 + q) === undefined) throw new MissingSaveKey(`Breeding[${22 + q}]`);
}

/**
 * `ShinyBonusS` @7930106, for passive `e` (the second number of `Breeding("ShinyBonusS","Nah",e,-1)`).
 * The game fills the map DNSM.ShinyBonusS on the first call (and returns 0 on the Tutorial scene, which a
 * tracked account is not on): for each of the 4 pet groups `q`, each pet `g` whose shiny count
 * Breeding[22 + q][g] is above 0 adds round(level x RANDOlist[92][passive]) to its passive's total,
 * with the passive = RANDOlist[90][PetStats[q][g][5]] and the level SpecialPassives "Lv". `e`'s total is the answer.
 */
function shinyBonusS(ctx: Ctx, e: number): number {
  const totals = new Map<string, number>();
  for (const pet of shinyPets(ctx)) totals.set(pet.key, asNumber(totals.get(pet.key)) + pet.val);
  return asNumber(totals.get(`${e}`));
}

/** A pet with a shiny count (Breeding[22 + group][pet] > 0): its passive (the key of `ShinyBonusS`), its level, the value per level RANDOlist[92][passive], and round(level x value). */
export type ShinyPet = { group: number; pet: number; key: string; exp: number; level: number; per: number; val: number };

/** The pets `ShinyBonusS` adds up, in the game's order (each group `q` 0..3, each pet `g` of PetStats[q]). */
export function shinyPets(ctx: Ctx): ShinyPet[] {
  const out: ShinyPet[] = [];
  for (let q = 0; q < 4; q++) {
    requireShinyRow(ctx, q);
    for (let g = 0, n = PetStats[q].length; g < n; g++) {
      if (!(0 < asNum(ctx, "Breeding", 22 + q, g))) continue;
      const passive = asNumber(RANDOlist[90][asNumber(PetStats[q][g][5]) | 0]);
      const level = Breeding(ctx, "SpecialPassives", "Lv", q, g);
      const per = asNumber(RANDOlist[92][passive | 0]);
      out.push({ group: q, pet: g, key: `${passive}`, exp: asNum(ctx, "Breeding", 22 + q, g), level, per, val: Math.round(level * per) });
    }
  }
  return out;
}

/**
 * `SpecialPassives` "Lv" @7937936: a shiny pet starts at level 1; going through the table of
 * `19 + 10 x (Menagerie unlock 11)` steps, each step `g` whose threshold floor((1 + (g+1)^1.6) x 1.7^(g+1))
 * is below the pet's shiny count Breeding[22 + e][f] makes it level g + 2. The last step passed wins.
 */
function specialPassivesLv(ctx: Ctx, e: number, f: number): number {
  requireShinyRow(ctx, e);
  let level = 1;
  for (let g = 0, steps = Math.round(19 + 10 * MenagerieStuff(ctx, "UnlockOwned", 11, 0)); g < steps; g++) {
    if (asNum(ctx, "Breeding", e + 22, f | 0) > Math.floor((1 + Math.pow(g + 1, 1.6)) * Math.pow(1.7, g + 1))) level = g + 2;
  }
  return level;
}

/**
 * `TotPetsFound`: the breeding actor's GenINFO[110] @10102075, the sum of Breeding[1][i] over the first
 * GenINFO[71] = max(3, OptionsListAccount[117]) worlds (@10096199; the actor never changes GenINFO[71]).
 */
function totPetsFound(ctx: Ctx): number {
  const worlds = Math.max(3, asNum(ctx, "OptionsListAccount", 117));
  // the game indexes Breeding[1] directly and would throw on a missing list
  if (attr(ctx, "Breeding", 1) === undefined) throw new MissingSaveKey("Breeding[1]");
  let total = 0;
  for (let i = 0; i < (worlds | 0); i++) total += asNum(ctx, "Breeding", 1, i);
  return total;
}

/** `2ndMulti` @7939419. The game indexes Breeding[2][3] (the actor's create) and Breeding[e + 13][f] directly and would throw on a missing row. */
function secondMulti(ctx: Ctx, e: number, f: number): number {
  if (attr(ctx, "Breeding", 2) === undefined) throw new MissingSaveKey("Breeding[2]");
  if (!(0 < asNum(ctx, "Breeding", 2, 3))) return 1;
  if (attr(ctx, "Breeding", (e + 13) | 0) === undefined) throw new MissingSaveKey(`Breeding[${(e + 13) | 0}]`);
  return 1 + Math.log(Math.max(1, Math.pow(asNum(ctx, "Breeding", (e + 13) | 0, f | 0) + 1, 0.725)));
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { ShinyBonusS: true, SpecialPassives: ["Lv"], TotPetsFound: true, PetArenaBonus: true, PetArenaCrucBonus: true, "2ndMulti": true };
