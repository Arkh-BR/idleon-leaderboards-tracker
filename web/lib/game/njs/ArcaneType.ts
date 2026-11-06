import { asNum, asNumber } from "../attr";
import { block, runtime, type Ctx } from "../ctx";
import { ArcaneUpg } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { ArcadeBonus } from "./ArcadeBonus";
import { Companions } from "./Companions";
import { FarmingStuffs } from "./FarmingStuffs";
import { GamingStatType } from "./GamingStatType";
import { getLOG } from "./getLOG";
import { getbonus2 } from "./getbonus2";
import { Log2 } from "./Log2";
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
    // @11087291: the Arcane map bonus of slot `b` (0..2) on the current map, min(its cap, ArcaneMapMulti of MapBon[map][b])
    case "ArcaneMapMulti_bon":
      return arcaneMapMultiBon(ctx, b, e);
    // @11088416: the cap of the Arcane map bonus, 100 x (getbonus2(1, 589, -1) - 1) + min(10, the Arcane upgrade 58)
    case "ArcaneMapMulti_bonMAX":
      return 100 * (getbonus2(ctx, 1, 589, -1) - 1) + Math.min(10, ArcaneType(ctx, "ArcaneUpgBonus", 58, 0));
    // @11086725: the bonus of `b` kills on a map, 0 below 1 kill
    case "ArcaneMapMulti":
      return 1 > b ? 0 : (2 * Math.max(0, getLOG(ctx, b) - 3.5) + Math.max(0, Log2(ctx, b) - 12)) * (getLOG(ctx, b) / 2.5) + (Math.min(2, b / 1e3) + Math.max(5 * (getLOG(ctx, b) - 5), 0));
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

/**
 * `ArcaneMapMulti_bon` @11087291: 0 when the current map's MapBon row has fewer than 3 slots, else min(cap, ArcaneMapMulti(MapBon[map][b])). The game
 * keeps the three values in DNSM.ArcMultBon, a cache it refills on every scene load (the HUD actor's init @13125719, called @13134922), every
 * 10 s while the Tesseract Arcanist form is on (@13145961) and on each draw of the stats panel (@3802185), so it follows the map the character
 * is on. A save has no session, so this is that fill for ctx.map (what e == 99 builds), computed for slot `b` only. Accepted gap: the game shows
 * the last refill, while the save's kills (MapBon[map][2]) have kept growing since; the page shows the save's.
 */
function arcaneMapMultiBon(ctx: Ctx, b: number, _e: number): number {
  if (3 > listAt(ctx, "MapBon", ctx.map).length) return 0;
  if (!(b === 0 || b === 1 || b === 2)) throw new NotPorted("ArcaneType", `ArcaneMapMulti_bon:b=${b}`); // ArcMultBon has three entries
  return Math.min(ArcaneType(ctx, "ArcaneMapMulti_bonMAX", 0, 0), ArcaneType(ctx, "ArcaneMapMulti", asNum(ctx, "MapBon", ctx.map, b), 0));
}

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
export const PORTED: Ported = {
  ArcaneUpgBonus: [...ARCANE_PLAIN], PrismaBonusMult: true, TesseractArcanist: true, ArcaneMapMulti_bon: [0, 1, 2], ArcaneMapMulti_bonMAX: true, ArcaneMapMulti: true,
};
