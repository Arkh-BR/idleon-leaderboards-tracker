import { asNumber } from "../attr";
import { block } from "../ctx";
import { ClassAccountBonus, ClassFamilyBonuses } from "../data";
import { hString } from "../hstring";
import { ArbitraryCode5Inputs, curve5 } from "./ArbitraryCode5Inputs";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_FamilyBonsuesREAL(d, b, e)` @6539580: class `d`'s family bonus `b` (0 or 1) at character level `e`: the curve
 * ClassFamilyBonuses[d] ([1..3] for b == 0, [4..6] else) at the levels past ClassAccountBonus[d][1], rounded, at least 0.
 */
export const FamilyBonsuesREAL = block("FamilyBonsuesREAL", (ctx, d: number, b: number, e: number) => {
  const row = (ClassFamilyBonuses as unknown as readonly (readonly unknown[])[])[d | 0];
  const account = (ClassAccountBonus as unknown as readonly (readonly unknown[])[])[d | 0];
  // the game indexes both rows directly and would throw on a class it does not have
  if (!row || !account) throw new RangeError(`FamilyBonsuesREAL: no class ${d} in ClassFamilyBonuses / ClassAccountBonus`);
  const level = Math.max(0, Math.round(e - asNumber(account[1])));
  const [name, x, y] = 0 == b ? [hString(row[3]), asNumber(row[1]), asNumber(row[2])] : [hString(row[6]), asNumber(row[4]), asNumber(row[5])];
  // a class with no such bonus has "_" constants (NaN) and the curve "txt", which answers 0: the game passes the NaN, `block` would refuse it
  return Number.isNaN(x) || Number.isNaN(y) ? curve5(name, x, y, level) : ArbitraryCode5Inputs(ctx, name, x, y, level, 0, 0);
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
