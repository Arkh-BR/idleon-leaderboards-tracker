import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { GamingPalette, Number2Letter } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { Spelunk } from "./Spelunk";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_GamingStatType(d, b, e)` @10732554: one function, a chain of named sub-cases. Only the sub-cases the Artifact
 * Find port reaches.
 */
export const GamingStatType: (ctx: Ctx, d: string, b: number, e: number) => number = block("GamingStatType", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    case "PaletteBonus":
      return paletteBonus(ctx, b);
    // @10746582: Super Bit b is owned when its letter (Number2Letter[b]) is in Gaming[12]
    case "SuperBitType":
      return -1 != hString(attr(ctx, "Gaming", 12)).indexOf(hString(Number2Letter[b | 0])) ? 1 : 0;
    // @10727986: the Worship bonuses, a function of the totems' waves once the bonus's Super Bit is owned: 0 (Super Bit 7) is
    // floor(waves / 10), 4 (Super Bit 11, the Class EXP one) is 1.12 x floor(waves / 10). The waves are the construction actor's
    // _GenINFO[114], its init's sum of TotemInfo[0] (@9087700; the actor is built at the game's start, so its GenINFO is longer than 114)
    case "MSA_Bonus": {
      if (0 != b && 4 != b) throw new NotPorted("GamingStatType", `MSA_Bonus:b=${b}`);
      if (1 != GamingStatType(ctx, "SuperBitType", 0 == b ? 7 : 11, 0)) return 0;
      const totems = listAt(ctx, "TotemInfo", 0); // the init reads TotemInfo[0].length
      let waves = 0; // ActorEvents_481._GenINFO[114]
      for (let f = 0; f < totems.length; f++) waves = waves + asNum(ctx, "TotemInfo", 0, f);
      return 0 == b ? Math.floor(waves / 10) : 1.12 * Math.floor(waves / 10);
    }
    default:
      throw new NotPorted("GamingStatType", d);
  }
});

/**
 * `PaletteBonus` @10734871: the palette shade `b`'s bonus, from `DNSM.PaletteBonz`, a table the game builds on the first call (b == -1
 * rebuilds it; here it is built from the save each time). It has one entry per shade g = 0..36 and, at 37, the shades' total level:
 *   level x value, or level / (level + 25) x value when the shade's GamingPalette[g][5] is 1 (level = Spelunk[9][g]);
 *   times 2 + .5 x Super Bit 59 for the shades the Super Bits 49, 51, 52, 54, 58 and 61 double (25, 13, 31, 18, 3 and 12);
 *   times 1 + Spelunk legend talent 10 / 100;
 *   times max(1, 1 + Spelunk[49][g] + floor(Spelunk[49][g] / 2));
 *   times 1 + .5 if the Spelunk lore note 8 is found.
 * b == -1 is 0.
 */
function paletteBonus(ctx: Ctx, b: number): number {
  listAt(ctx, "Spelunk", 9); // the game indexes Spelunk[9][g] and Spelunk[49][g] directly
  listAt(ctx, "Spelunk", 49);
  const table: number[] = [];
  let total = 0; // DNSM.PaletteDNz
  for (let g = 0; g < 37; g++) {
    const level = asNum(ctx, "Spelunk", 9, g);
    const shade = GamingPalette[g];
    // the game indexes GamingPalette[g][4] directly
    if (!shade) throw new RangeError(`GamingStatType PaletteBonus: no shade ${g} in GamingPalette`);
    table.push(1 == asNumber(shade[5]) ? (level / (level + 25)) * asNumber(shade[4]) : level * asNumber(shade[4]));
    total = total + level;
    if (
      (1 == GamingStatType(ctx, "SuperBitType", 49, 0) && 25 == g) ||
      (1 == GamingStatType(ctx, "SuperBitType", 51, 0) && 13 == g) ||
      (1 == GamingStatType(ctx, "SuperBitType", 52, 0) && 31 == g) ||
      (1 == GamingStatType(ctx, "SuperBitType", 54, 0) && 18 == g) ||
      (1 == GamingStatType(ctx, "SuperBitType", 58, 0) && 3 == g) ||
      (1 == GamingStatType(ctx, "SuperBitType", 61, 0) && 12 == g)
    )
      table[g] = asNumber(table[g]) * (2 + 0.5 * GamingStatType(ctx, "SuperBitType", 59, 0));
    table[g] =
      asNumber(table[g]) *
      (1 + Thingies(ctx, "LegendPTS_bonus", 10, 0) / 100) *
      Math.max(1, 1 + (asNum(ctx, "Spelunk", 49, g) + Math.floor(asNum(ctx, "Spelunk", 49, g) / 2))) *
      (1 + 0.5 * Spelunk(ctx, "DoWeHaveLoreN1", 8, 0));
  }
  table.push(Math.round(total));
  if (-1 == b) return 0;
  const v = table[b | 0];
  // the game reads PaletteBonz[b] and would pass undefined on
  if (v === undefined) throw new RangeError(`GamingStatType PaletteBonus: no shade ${b}`);
  return v;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { PaletteBonus: true, SuperBitType: true, MSA_Bonus: [0, 4] };
