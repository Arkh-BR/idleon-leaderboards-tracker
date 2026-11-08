import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { HoleFountUPG, HolesInfo, RandoListo2 } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { ArcaneType } from "./ArcaneType";
import { getLOG } from "./getLOG";
import { Holes } from "./Holes";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/** N.js `_customBlock_Holes2(d, b, e)` @11035686. Only the sub-cases the Artifact Find port, AFK, Drop Rate and Coin reach. */
export const Holes2: (ctx: Ctx, d: string, b: number, e: number) => number = block("Holes2", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "Fountain_BonTOT":
      return fountainBonTOT(ctx, b, e);
    // @11055213: the marble bonus of the fountain upgrade (b, e): 1 at level 0, else 1.5 + 0.5 x level.
    // `0 == Holes[32][b][e]` is the raw element: a level the save has no entry for is not 0 there.
    case "Fountain_MarbleBon": {
      listAt(ctx, "Holes", 32, b | 0); // the game indexes Holes[32][b][e] directly
      return 0 == attr(ctx, "Holes", 32, b | 0, e | 0) ? 1 : 1.5 + 0.5 * asNum(ctx, "Holes", 32, b | 0, e | 0);
    }
    // @11057837: Crystal Glunko upgrade b, its level OptionsListAccount[630 + b] times its value RandoListo2[13][b]
    case "Cglunko_upgBon":
      return asNum(ctx, "OptionsListAccount", Math.round(630 + b)) * asNumber((RandoListo2 as unknown as readonly (readonly unknown[])[])[13][b | 0]);
    // @11055359: the Cove's Drop Rate (what TotalStats("Drop_Rarity") gives on map 216 in cavern 17), with u(i) = Cglunko_upgBon(i):
    // (1 + (u1 + u17 + u21) / 100) (1 + u3 / 100) (1 + u12 / 100) (1 + u10 x Bdig / 100) (1 + u22 x Pdig / 100)
    // x (1 + u4 x ceil(getLOG(OptionsListAccount[668])) / 100) x (1 + u18 x ceil(getLOG(OptionsListAccount[200])) / 100)
    case "Cglunko_DR":
      return (
        (1 + (Holes2(ctx, "Cglunko_upgBon", 1, 0) + (Holes2(ctx, "Cglunko_upgBon", 17, 0) + Holes2(ctx, "Cglunko_upgBon", 21, 0))) / 100) *
        (1 + Holes2(ctx, "Cglunko_upgBon", 3, 0) / 100) *
        (1 + Holes2(ctx, "Cglunko_upgBon", 12, 0) / 100) *
        (1 + (Holes2(ctx, "Cglunko_upgBon", 10, 0) * Holes2(ctx, "Cglunko_Bdig", 0, 0)) / 100) *
        (1 + (Holes2(ctx, "Cglunko_upgBon", 22, 0) * Holes2(ctx, "Cglunko_Pdig", 0, 0)) / 100) *
        (1 + (Holes2(ctx, "Cglunko_upgBon", 4, 0) * Math.ceil(getLOG(ctx, asNum(ctx, "OptionsListAccount", 668)))) / 100) *
        (1 + (Holes2(ctx, "Cglunko_upgBon", 18, 0) * Math.ceil(getLOG(ctx, asNum(ctx, "OptionsListAccount", 200)))) / 100)
      );
    // @11056120: the digits of the six blue shapes, ceil(getLOG(OptionsListAccount[654 + i])) summed
    case "Cglunko_Bdig":
      return digits6(ctx, 654);
    // @11056742: the same for the six purple shapes, OptionsListAccount[660..665]
    case "Cglunko_Pdig":
      return digits6(ctx, 660);
    // @11057363: the Cove's AFK gains rate, (10 + the Crystal Glunko upgrades 8 and 13) / 100
    case "Cglunko_AFKgains":
      return (10 + (Holes2(ctx, "Cglunko_upgBon", 8, 0) + Holes2(ctx, "Cglunko_upgBon", 13, 0))) / 100;
    // @11039204: bonus 7 of the Gambit, 0 below its point requirement, else HolesInfo[71][b] = "value|scale|…": value x getLOG(points) when scale is 1, else value.
    // (The Tutorial-scene guard is not modelled: a tracked account is in the world. b == 0 has its own formula, not reached by Coin.)
    case "GambitBonuses": {
      if (7 != b) throw new NotPorted("Holes2", `GambitBonuses:b=${b}`);
      if (Holes(ctx, "GambitPts", 777, 0) < Holes(ctx, "GambitPtsREQ", b, 0)) return 0;
      const [value, scale] = hString((HolesInfo as unknown as readonly (readonly unknown[])[])[71][b | 0]).split("|");
      return 1 == asNumber(scale) ? asNumber(value) * getLOG(ctx, Holes(ctx, "GambitPts", 777, 0)) : asNumber(value);
    }
    // @11039137: the points bonus b needs
    case "GambitPtsREQ":
      return 2e3 + 1e3 * (b + 1) * (1 + b / 5) * Math.pow(1.26, b);
    // @11038274: 99 = the six challenges summed (the last pair first), 777 = that times the multi; else challenge b, from its best v = Holes[11][65 + b]:
    // 100 (b == 0) or 200 x (v + 3 floor(v / 10) + 10 floor(v / 60))
    case "GambitPts": {
      if (99 == b) return Holes(ctx, "GambitPts", 0, 0) + (Holes(ctx, "GambitPts", 1, 0) + (Holes(ctx, "GambitPts", 2, 0) + (Holes(ctx, "GambitPts", 3, 0) + (Holes(ctx, "GambitPts", 4, 0) + Holes(ctx, "GambitPts", 5, 0)))));
      if (777 == b) return Holes(ctx, "GambitPts", 99, 0) * Holes(ctx, "GambitPTSmulti", 0, 0);
      listAt(ctx, "Holes", 11); // the game indexes Holes[11][65 + b] directly
      const v = asNum(ctx, "Holes", 11, Math.round(b + 65));
      return (0 == b ? 100 : 200) * (v + (3 * Math.floor(v / 10) + 10 * Math.floor(v / 60)));
    }
    // @11037796: 1 + (measurement 13 + study 13 + Bolaia upgrade 78 + monument (2, 7) + jars 23 and 30 + Arcane upgrade 47) / 100
    case "GambitPTSmulti":
      return (
        1 +
        (Holes(ctx, "MeasurementBonusTOTAL", 13, 0) +
          Holes(ctx, "StudyBolaiaBonuses", 13, 0) +
          (Holes(ctx, "B_UPG", 78, 10) + (Holes(ctx, "MonumentROGbonuses", 2, 7) + (Holes(ctx, "JarCollectibleBonus", 23, 0) + (Holes(ctx, "JarCollectibleBonus", 30, 0) + ArcaneType(ctx, "ArcaneUpgBonus", 47, 0)))))) /
          100
      );
    // @11041625: study b, Holes[26][b] x HolesInfo[70][b]. The chain's other branches need e == 99, b == 9 or b == 3 (the Tutorial-scene guard is not modelled)
    case "StudyBolaiaBonuses":
      if (13 != b || 0 != e) throw new NotPorted("Holes2", `StudyBolaiaBonuses:b=${b},e=${e}`);
      listAt(ctx, "Holes", 26); // the game indexes Holes[26][b] directly
      return asNum(ctx, "Holes", 26, b | 0) * asNumber((HolesInfo as unknown as readonly (readonly unknown[])[])[70][b | 0]);
    // @11036326: jar b, Holes[24][b] x the second field of HolesInfo[67][b] x (1 + legend talent 29 / 100)
    case "JarCollectibleBonus":
      listAt(ctx, "Holes", 24); // the game indexes Holes[24][b] directly
      return asNum(ctx, "Holes", 24, b | 0) * asNumber(hString((HolesInfo as unknown as readonly (readonly unknown[])[])[67][b | 0]).split("|")[1]) * (1 + Thingies(ctx, "LegendPTS_bonus", 29, 0) / 100);
    default:
      throw new NotPorted("Holes2", d);
  }
});

/**
 * `Fountain_BonTOT` @11045841: entry (b, e) of `DNSM.FountBonT`, rounded. The game fills that table the first time it is asked (and
 * when b == -1) with, for each of the 3 fountains d and 20 upgrades f,
 *   MarbleBon(d, f) x Holes[31][d][f] x CustomLists.HoleFountUPG[d][f][6],
 * each entry independent of the others. Here the one entry asked is computed from the save each time (the replay of that
 * iteration). The rebuild (b == -1) and anything outside the 3 x 20 table are not ported. The fill indexes the rows of Holes[31] and
 * Holes[32] of all 3 fountains, so it throws (and the port refuses) when any of the 6 is missing, whichever entry is asked.
 */
function fountainBonTOT(ctx: Ctx, b: number, e: number): number {
  if (!Number.isInteger(b) || !Number.isInteger(e) || b < 0 || b > 2 || e < 0 || e > 19) throw new NotPorted("Holes2", `Fountain_BonTOT:b=${b},e=${e}`);
  for (let d = 0; d < 3; d++) {
    // the fill indexes Holes[31][d][f] and Holes[32][d][f] directly
    listAt(ctx, "Holes", 31, d);
    listAt(ctx, "Holes", 32, d);
  }
  const marble = Holes2(ctx, "Fountain_MarbleBon", b, e);
  const upgrade = (HoleFountUPG as unknown as readonly (readonly (readonly unknown[])[])[])[b][e];
  return Math.round(marble * asNum(ctx, "Holes", 31, b, e) * asNumber(upgrade[6]));
}

/** `ceil(getLOG(OLA[from])) + (ceil(getLOG(OLA[from + 1])) + (… + ceil(getLOG(OLA[from + 5]))))`, in the game's order (the last pair first). */
function digits6(ctx: Ctx, from: number): number {
  const d = (i: number) => Math.ceil(getLOG(ctx, asNum(ctx, "OptionsListAccount", from + i)));
  return d(0) + (d(1) + (d(2) + (d(3) + (d(4) + d(5)))));
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  Fountain_BonTOT: [0, 1, 2], Fountain_MarbleBon: true, Cglunko_upgBon: true, Cglunko_AFKgains: true, Cglunko_DR: true, Cglunko_Bdig: true, Cglunko_Pdig: true,
  GambitBonuses: [7], GambitPtsREQ: true, GambitPts: true, GambitPTSmulti: true, StudyBolaiaBonuses: [13], JarCollectibleBonus: true,
};
