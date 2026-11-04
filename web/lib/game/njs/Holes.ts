import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { CosmoUpgrades, HolesInfo } from "../data";
import { InvalidSaveValue, NotPorted } from "../errors";
import { listAt } from "../lists";
import { getLOG } from "./getLOG";
import { Holes2 } from "./Holes2";
import type { Ported } from "../ported";

/** N.js `_customBlock_Holes(d, b, e)` @10990457. Only the sub-cases the Artifact Find port reaches. */
export const Holes: (ctx: Ctx, d: string, b: number, e: number) => number = block("Holes", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @10996050: Bolaia upgrade `b`
    case "B_UPG":
      return bUpg(ctx, b);
    // @11002068: Cosmo upgrade (b, e) of the Holes: level x value, rounded down; (2, 1) is 3 to the level, at least 1
    case "CosmoBonusQTY": {
      const level = Math.round(4 + b);
      listAt(ctx, "Holes", level); // the game indexes Holes[4 + b][e] directly
      if (2 == b && 1 == e) return Math.floor(Math.max(1, Math.pow(3, asNum(ctx, "Holes", level, e | 0))));
      const upgrade = CosmoUpgrades[b | 0]?.[e | 0];
      // the game indexes CosmoUpgrades[b][e][0] directly
      if (!upgrade) throw new RangeError(`Holes CosmoBonusQTY: no Cosmo upgrade (${b}, ${e}) in CosmoUpgrades`);
      return Math.floor(asNumber(upgrade[0]) * asNum(ctx, "Holes", level, e | 0));
    }
    // @11014436: monument (b, e)
    case "MonumentROGbonuses":
      return monumentROGbonuses(ctx, b, e);
    default:
      throw new NotPorted("Holes", d);
  }
});

/**
 * `B_UPG` @10996050. It opens with `0 == Holes.length || 0 == Holes[13][b|0]` (the upgrade is not bought: 0; the flag is the raw
 * element, so a null is not 0), then a chain on b; only b == 55 is ported: 10 x floor(getLOG(Holes[9][11])).
 */
function bUpg(ctx: Ctx, b: number): number {
  const holes = attr(ctx, "Holes");
  if (!Array.isArray(holes)) throw new InvalidSaveValue("Holes", "an array", holes);
  if (0 == holes.length) return 0;
  listAt(ctx, "Holes", 13); // the game indexes Holes[13][b] directly
  if (0 == attr(ctx, "Holes", 13, b | 0)) return 0;
  if (55 != b) throw new NotPorted("Holes", `B_UPG:b=${b}`);
  listAt(ctx, "Holes", 9);
  return 10 * Math.floor(getLOG(ctx, asNum(ctx, "Holes", 9, 11)));
}

/**
 * `MonumentROGbonuses` @11014436: the multiplier (the game keeps it in the scratch `DNSM.HoleozDN`; here it is a local, which is the
 * same because every use of the scratch is preceded by a write, even across the recursion) starts at 1. Unless e == 9 it becomes
 * 1 + monument (b, 9) / 100, plus the Cosmo upgrade (0, 0) / 100; then, for b < 3, times 1 + the fountain column 13 of b / 100.
 * With i = round(10 b + e) and L = Holes[15][i], HolesInfo[37][i] = k picks the shape: under 30, L x k x max(1, multiplier);
 * else .1 x ceil(10 x L / (250 + L) x k x max(1, multiplier)).
 */
function monumentROGbonuses(ctx: Ctx, b: number, e: number): number {
  let multi = 1;
  if (9 != e) {
    multi = 1 + Holes(ctx, "MonumentROGbonuses", b, 9) / 100;
    multi = multi + Holes(ctx, "CosmoBonusQTY", 0, 0) / 100;
  }
  if (0 == b) multi = multi * (1 + Holes2(ctx, "Fountain_BonTOT", 0, 13) / 100);
  if (1 == b) multi = multi * (1 + Holes2(ctx, "Fountain_BonTOT", 1, 13) / 100);
  if (2 == b) multi = multi * (1 + Holes2(ctx, "Fountain_BonTOT", 2, 13) / 100);
  const i = Math.round(10 * b + e);
  listAt(ctx, "Holes", 15); // the game indexes Holes[15][i] directly
  const level = asNum(ctx, "Holes", 15, i); // the game reads it up to three times; it is the same value
  const k = asNumber((HolesInfo as unknown as readonly (readonly unknown[])[])[37][i]);
  if (30 > k) return level * k * Math.max(1, multi);
  return 0.1 * Math.ceil(10 * (level / (250 + level)) * k * Math.max(1, multi));
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { B_UPG: [55], CosmoBonusQTY: true, MonumentROGbonuses: true };
