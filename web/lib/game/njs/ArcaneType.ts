import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { ArcaneUpg } from "../data";
import { NotPorted } from "../errors";

/** N.js `_customBlock_ArcaneType(d, b, e)` @11083241. Only the sub-cases the Artifact Find port reaches. */
export const ArcaneType = block("ArcaneType", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "ArcaneUpgBonus":
      return arcaneUpgBonus(ctx, b, e);
    default:
      throw new NotPorted("ArcaneType", d);
  }
});

/** The Arcane upgrades whose bonus is plain level x value (`3==b||7==b||…` @11084516). The others are times ArcaneUpgBonus 39: NotPorted. */
const ARCANE_PLAIN = new Set([3, 7, 8, 10, 13, 16, 20, 25, 26, 28, 33, 35, 39, 40, 43, 45, 48, 57, 58]);

/** `ArcaneUpgBonus` @11084516: Arcane[b] x ArcaneUpg[b][5]; e == 999 is the game's way to ask for something else (0 here). */
function arcaneUpgBonus(ctx: Ctx, b: number, e: number): number {
  if (!ARCANE_PLAIN.has(b)) throw new NotPorted("ArcaneType", `ArcaneUpgBonus:b=${b}`);
  if (999 == e) return 0;
  const row = ArcaneUpg[b | 0];
  // the game indexes ArcaneUpg[b][5] directly
  if (!row) throw new RangeError(`ArcaneType ArcaneUpgBonus: no upgrade ${b} in ArcaneUpg`);
  return asNum(ctx, "Arcane", b | 0) * asNumber(row[5]);
}
