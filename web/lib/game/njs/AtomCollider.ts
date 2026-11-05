import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { AtomInfo } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_AtomCollider(d, b, e)` @10773799: one function, a chain of named sub-cases. Only the sub-cases the character
 * stats reach. The Tutorial-scene guard (`return 0`) is not modelled: a tracked account is in the world.
 */
export const AtomCollider = block("AtomCollider", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @10774777: atom b, its level Atoms[b] times its value AtomInfo[b][4]; atom 0 times OptionsListAccount[134] (at most 90), atom 5 is
    // twice the tower levels over 50 (AtomBonCalc1), atom 8 is (1 + that / 100) to the power of the meals at 30 or more (AtomBonCalc2).
    // The game fills AtomBonCalc1/2 once per session from the account's towers and meals; here they are read when needed.
    case "AtomBonuses": {
      const row = (AtomInfo as unknown as readonly (readonly unknown[])[])[b | 0];
      // the game indexes AtomInfo[b][4] directly and would throw on an atom it does not have
      if (!row) throw new RangeError(`AtomCollider AtomBonuses: no atom ${b} in AtomInfo`);
      const value = asNum(ctx, "Atoms", b | 0) * asNumber(row[4]); // DNSM.AtomBonDN
      if (0 == b) return Math.min(90, value * asNum(ctx, "OptionsListAccount", 134));
      if (5 == b) {
        let towers = 0; // DNSM.AtomBonCalc1
        for (let f = 0; f < 9; f++) if (50 < asNum(ctx, "TowerInfo", 9 + f)) towers = towers + Math.max(0, asNum(ctx, "TowerInfo", 9 + f) - 50);
        return 2 * towers;
      }
      if (8 == b) {
        let meals = 0; // DNSM.AtomBonCalc2
        for (let f = 0, n = listAt(ctx, "Meals", 0).length; f < n; f++) if (30 <= asNum(ctx, "Meals", 0, f)) meals += 1;
        return Math.pow(1 + value / 100, meals);
      }
      return value;
    }
    default:
      throw new NotPorted("AtomCollider", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { AtomBonuses: true };
