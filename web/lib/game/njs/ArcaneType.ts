import { asNum, asNumber } from "../attr";
import { block, runtime, type Ctx } from "../ctx";
import { ArcaneUpg } from "../data";
import { NotPorted } from "../errors";
import { ArcadeBonus } from "./ArcadeBonus";
import { Companions } from "./Companions";
import { FarmingStuffs } from "./FarmingStuffs";
import { GamingStatType } from "./GamingStatType";
import { JellyOperation } from "./JellyOperation";
import { Labb } from "./Labb";
import { SushiStuff } from "./SushiStuff";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/** N.js `_customBlock_ArcaneType(d, b, e)` @11083241. Only the sub-cases the Artifact Find port, the character stats and Damage reach. */
export const ArcaneType: (ctx: Ctx, d: string, b: number, e: number) => number = block("ArcaneType", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "ArcaneUpgBonus":
      return arcaneUpgBonus(ctx, b, e);
    // @11086203: what a Prisma bubble is multiplied by, 2 + the boosts / 100, at most 5
    case "PrismaBonusMult":
      return Math.min(
        5,
        2 +
          (ArcaneType(ctx, "ArcaneUpgBonus", 45, 0) +
            (ArcadeBonus(ctx, 54) + (SushiStuff(ctx, "RoG_BonusQTY", 23, 0) + JellyOperation(ctx, "RoG_BonusQTY", 36, 0)) +
              (Thingies(ctx, "HaveW6Trophy", 0, 0) +
                (GamingStatType(ctx, "PaletteBonus", 28, 0) + (0.2 * Labb(ctx, "TotalPurpleSigils", "0", 0, 0) + FarmingStuffs(ctx, "ExoticBonusQTY", 48, 0))))) +
            (Thingies(ctx, "LegendPTS_bonus", 36, 0) + 50 * Companions(ctx, 88))) /
            100
      );
    // @11083284: the Tesseract Arcanist form, `.1 <= GetBuffBonuses(585,1) ? (1 == NONdummies[68] && 100 < its BuffsActive timer ? 1 : 0) : 0`.
    // The masterclass forms are not counted (the Damage page's product decision), as in PlayerAccTot
    case "TesseractArcanist":
      return runtime(ctx, "ArcaneType(TesseractArcanist)", "masterclass form, not counted");
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

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { ArcaneUpgBonus: [...ARCANE_PLAIN], PrismaBonusMult: true, TesseractArcanist: true };
