import { asNum, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { MissingSaveKey, NotPorted } from "../errors";

/**
 * N.js `_customBlock_MenagerieStuff(d, b, e)` @5176140: one function, a chain of named sub-cases. Only the sub-cases the Artifact Find port reaches.
 * It opens with `if (0 == Menagerie.length) return 0`: the game starts with `Menagerie = []` (@6586152) and the loader
 * replaces it only for CSver >= 34 (@19945057), so an empty list is a legal state and every sub-case is 0.
 */
export const MenagerieStuff: (ctx: Ctx, d: string, b: number, e: number) => number = block("MenagerieStuff", (ctx, d: string, b: number, _e: number) => {
  const menagerie = attr(ctx, "Menagerie"); // a save without the key is still refused (attr throws)
  if (Array.isArray(menagerie) && menagerie.length === 0) return 0;
  switch (d) {
    // @5182775: Menagerie unlock `b` is owned when its flag, Menagerie[2][b], is at least 1
    case "UnlockOwned":
      // the game indexes Menagerie[2] directly and would throw on a missing list
      if (attr(ctx, "Menagerie", 2) === undefined) throw new MissingSaveKey("Menagerie[2]");
      return 1 <= asNum(ctx, "Menagerie", 2, b | 0) ? 1 : 0;
    // @5184717: with unlock 13, the Nightmariner grows with the boats' upgrades: 1 + 1999 x T / (T + 1e4) for b == 0
    // (the game has 499 in place of 1999 for any other b, which nothing here asks for)
    case "NightmarinerBon": {
      if (b !== 0) throw new NotPorted("MenagerieStuff", `NightmarinerBon:b=${b}`);
      if (1 != MenagerieStuff(ctx, "UnlockOwned", 13, 0)) return 1;
      const t = MenagerieStuff(ctx, "NightmarinerTotLV", 0, 0);
      return Math.max(1, 1 + 1999 * (t / (t + 1e4)));
    }
    // @5184248: DNSM.NghMrTOT
    case "NightmarinerTotLV":
      return nightmarinerTotLV(ctx);
    default:
      throw new NotPorted("MenagerieStuff", d);
  }
});

/**
 * `NightmarinerTotLV`: the sum, over the first 20 boats, of what loot + speed upgrades (Boats[i][3] + [5])
 * exceed 600. The game fills DNSM.NghMrTOT with this on the first call and keeps it for the session; here
 * it is computed from the save each time.
 */
function nightmarinerTotLV(ctx: Ctx): number {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    // the game indexes Boats[i] directly and would throw on a missing row
    if (attr(ctx, "Boats", i) === undefined) throw new MissingSaveKey(`Boats[${i}]`);
    total += Math.max(0, asNum(ctx, "Boats", i, 3) + asNum(ctx, "Boats", i, 5) - 600);
  }
  return total;
}
