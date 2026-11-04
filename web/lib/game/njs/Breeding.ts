import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { PetStats, RANDOlist } from "../data";
import { MissingSaveKey, NotPorted } from "../errors";
import { MenagerieStuff } from "./MenagerieStuff";

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
      if (b !== "Lv") throw new NotPorted("Breeding", `SpecialPassives:${b}`);
      return specialPassivesLv(ctx, e, f);
    // @7932815: reads the breeding actor's GenINFO[110], which it fills from the save
    case "TotPetsFound":
      return totPetsFound(ctx);
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
  for (let q = 0; q < 4; q++) {
    requireShinyRow(ctx, q);
    for (let g = 0, n = PetStats[q].length; g < n; g++) {
      if (!(0 < asNum(ctx, "Breeding", 22 + q, g))) continue;
      const passive = asNumber(RANDOlist[90][asNumber(PetStats[q][g][5]) | 0]);
      const key = `${passive}`;
      totals.set(key, asNumber(totals.get(key)) + Math.round(Breeding(ctx, "SpecialPassives", "Lv", q, g) * asNumber(RANDOlist[92][passive | 0])));
    }
  }
  return asNumber(totals.get(`${e}`));
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
