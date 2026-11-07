import { asNum, asNumber, attr } from "../attr";
import { block, withPlayer, type Ctx } from "../ctx";
import { CosmoUpgrades, GodsInfo, HolesInfo } from "../data";
import { InvalidSaveValue, NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { DNSM_TomeQTYtot } from "./DNSM";
import { cropCount } from "./FarmingStuffs";
import { getLOG } from "./getLOG";
import { Holes2 } from "./Holes2";
import { WorkbenchStuff } from "./WorkbenchStuff";
import type { Ported } from "../ported";

/** N.js `_customBlock_Holes(d, b, e)` @10990457. Only the sub-cases the Artifact Find port, the character stats and Drop Rate reach. */
export const Holes: (ctx: Ctx, d: string, b: number, e: number) => number = block("Holes", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @10996050: Bolaia upgrade `b`
    case "B_UPG":
      return bUpg(ctx, b, e);
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
    // @11007027: measurement b, its base bonus times the multi of its kind (HolesInfo[52][b])
    case "MeasurementBonusTOTAL":
      return Holes(ctx, "MeasurementBaseBonus", b, 0) * Holes(ctx, "MeasurementMulti", asNumber((HolesInfo as unknown as readonly (readonly unknown[])[])[52][b | 0]), 0);
    // @11002948: (1 + Cosmo (1, 3) / 100) x, with v = HolesInfo[55][b] and its level L = Holes[22][b]: v without "TOT" x L / (100 + L) when v has
    // "TOT", else v x L (StringTools.replace removes every "TOT")
    case "MeasurementBaseBonus": {
      const v = hString((HolesInfo as unknown as readonly (readonly unknown[])[])[55][b | 0]);
      listAt(ctx, "Holes", 22); // the game indexes Holes[22][b] directly
      if (-1 != v.indexOf("TOT")) return (1 + Holes(ctx, "CosmoBonusQTY", 1, 3) / 100) * ((asNumber(v.replaceAll("TOT", "")) * asNum(ctx, "Holes", 22, b | 0)) / (100 + asNum(ctx, "Holes", 22, b | 0)));
      return (1 + Holes(ctx, "CosmoBonusQTY", 1, 3) / 100) * asNumber(v) * asNum(ctx, "Holes", 22, b | 0);
    }
    // @11006771: the multi of measurement kind b, from q = MeasurementQTYfound(b, 99): 1 + 18 q / 100 below 5, else 1 + (18 q + 8 (q - 5)) / 100
    case "MeasurementMulti":
      return 5 > Holes(ctx, "MeasurementQTYfound", b, 99)
        ? 1 + (18 * Holes(ctx, "MeasurementQTYfound", b, 99)) / 100
        : 1 + (18 * Holes(ctx, "MeasurementQTYfound", b, 99) + 8 * (Holes(ctx, "MeasurementQTYfound", b, 99) - 5)) / 100;
    case "MeasurementQTYfound":
      return measurementQTYfound(ctx, b, e);
    // @10991634: the god of minor bonus kind b is in a pocket: the first pocket (Holes[11][29]) with Cosmo (2, 0) above 0, the second
    // ([11][30]) with it above 1
    case "PocketDivOwned": {
      listAt(ctx, "Holes", 11); // the game indexes Holes[11][29] directly
      const kind = (slot: number) => {
        const god = (GodsInfo as unknown as readonly (readonly unknown[])[])[asNum(ctx, "Holes", 11, slot) | 0];
        // the game indexes GodsInfo[g][13] directly and would throw on a god it does not have
        if (!god) throw new RangeError(`Holes PocketDivOwned: no god ${asNum(ctx, "Holes", 11, slot)} in GodsInfo`);
        return asNumber(god[13]);
      };
      if (kind(29) == b && 0 < Holes(ctx, "CosmoBonusQTY", 2, 0)) return 1;
      return kind(30) == b && 1 < Holes(ctx, "CosmoBonusQTY", 2, 0) ? 1 : 0;
    }
    default:
      throw new NotPorted("Holes", d);
  }
});

/**
 * `B_UPG` @10996050. It opens with `0 == Holes.length || 0 == Holes[13][b|0]` (the upgrade is not bought: 0; the flag is the raw
 * element, so a null is not 0), then a chain on b; ported: 46 = 5 x Holes[11][26], 47 = 25 x Holes[11][26], 55 = 10 x floor(getLOG(Holes[9][11])), 57 = 20 x floor(getLOG(Holes[9][1])),
 * 82..84 = e x Holes[11][55]. The others are not reached (49 and the 50, 79, 98 it calls only from SkillStats AllEfficiencies).
 */
function bUpg(ctx: Ctx, b: number, e: number): number {
  const holes = attr(ctx, "Holes");
  if (!Array.isArray(holes)) throw new InvalidSaveValue("Holes", "an array", holes);
  if (0 == holes.length) return 0;
  listAt(ctx, "Holes", 13); // the game indexes Holes[13][b] directly
  if (0 == attr(ctx, "Holes", 13, b | 0)) return 0;
  if (46 == b) {
    listAt(ctx, "Holes", 11);
    return 5 * asNum(ctx, "Holes", 11, 26);
  }
  if (47 == b) {
    listAt(ctx, "Holes", 11);
    return 25 * asNum(ctx, "Holes", 11, 26);
  }
  if (55 == b) {
    listAt(ctx, "Holes", 9);
    return 10 * Math.floor(getLOG(ctx, asNum(ctx, "Holes", 9, 11)));
  }
  if (57 == b) {
    listAt(ctx, "Holes", 9);
    return 20 * Math.floor(getLOG(ctx, asNum(ctx, "Holes", 9, 1)));
  }
  if (82 == b || 83 == b || 84 == b) {
    listAt(ctx, "Holes", 11);
    return e * asNum(ctx, "Holes", 11, 55);
  }
  throw new NotPorted("Holes", `B_UPG:b=${b}`);
}

/**
 * `MeasurementQTYfound` @11003537: what measurement kind `b` counts, q (kept in the scratch `DNSM.HoleozDNm`, a local here: every branch
 * writes it before reading it), and with `e == 99` the scaled value the multi uses:
 *   0  the Gloomie kills Holes[11][28]           99: getLOG(q)
 *   1  the crops found, D.mapCount(FarmCrop)     99: q / 14
 *   2  DNSM.TomeQTY[5], the account level        99: q / 500
 *   3  the Tome score (Tome actor GenInfo[84])  99: q / 2500
 *   4  DNSM.TomeQTY[11], every skill level       99: q / 5000 + max(0, q - 18000) / 1500
 *   5  0
 *   6  the Death Note, OverkillQTY 0..6 summed   99: q / 125
 *   7  Tasks[0][1][0]                            99: getLOG(q) / 2
 *   8  the cards found, Cards[1].length          99: q / 150
 *   9  the Bolaia studies, Holes[26] summed      99: q / 6
 *  10  Holes[11][63]                             99: max(0, getLOG(q) - 2)
 * and 0 for any other b. Kinds 2 and 4 read `DNSM.TomeQTY`, the table the Tome actor's TomeQTY event fills (@5739323; the game answers 0
 * while it is absent, before that event first runs): here the two entries are the event's own sums, taken from the save (TomeQTY[5]
 * @5742905, TomeQTY[11] @5745687), as the other session tables are built. Kind 3 is the Tome score (DNSM_TomeQTYtot, Ruling K).
 * Without `e == 99` the game returns q as it read it; here it is a number (asNumber of a raw read).
 */
function measurementQTYfound(ctx: Ctx, b: number, e: number): number {
  let q: number; // DNSM.HoleozDNm
  if (0 == b) {
    listAt(ctx, "Holes", 11); // the game indexes Holes[11][28] directly
    q = asNum(ctx, "Holes", 11, 28);
    return 99 == e ? getLOG(ctx, q) : q;
  }
  if (1 == b) {
    q = cropCount(ctx);
    return 99 == e ? q / 14 : q;
  }
  if (2 == b) {
    q = 0; // TomeQTY[5] @5742905: every character's Lv0[0]
    for (let g = 0, n = ctx.state.charNames.length; g < n; g++) q = q + asNum(withPlayer(ctx, g), "Lv0", 0);
    return 99 == e ? q / 500 : q;
  }
  if (3 == b) {
    q = DNSM_TomeQTYtot(ctx);
    return 99 == e ? q / 2500 : q;
  }
  if (4 == b) {
    q = 0; // TomeQTY[11] @5745687: every character's skill levels Lv0[1..21], each at least 0
    for (let g = 0, n = ctx.state.charNames.length; g < n; g++) for (let s = 0; s < 21; s++) q = q + Math.max(0, asNum(withPlayer(ctx, g), "Lv0", s + 1));
    return 99 == e ? q / 5e3 + Math.max(0, q - 18e3) / 1500 : q;
  }
  if (5 == b) return 0;
  if (6 == b) {
    q =
      WorkbenchStuff(ctx, "OverkillQTY", 0, 0) +
      (WorkbenchStuff(ctx, "OverkillQTY", 1, 0) +
        (WorkbenchStuff(ctx, "OverkillQTY", 2, 0) +
          (WorkbenchStuff(ctx, "OverkillQTY", 3, 0) + (WorkbenchStuff(ctx, "OverkillQTY", 4, 0) + (WorkbenchStuff(ctx, "OverkillQTY", 5, 0) + WorkbenchStuff(ctx, "OverkillQTY", 6, 0))))));
    return 99 == e ? q / 125 : q;
  }
  if (7 == b) {
    listAt(ctx, "Tasks", 0, 1); // the game indexes Tasks[0][1][0] directly
    q = asNum(ctx, "Tasks", 0, 1, 0);
    return 99 == e ? getLOG(ctx, q) / 2 : q;
  }
  if (8 == b) {
    q = listAt(ctx, "Cards", 1).length;
    return 99 == e ? q / 150 : q;
  }
  if (9 == b) {
    q = 0;
    for (let g = 0, n = listAt(ctx, "Holes", 26).length; g < n; g++) q = q + asNum(ctx, "Holes", 26, g);
    return 99 == e ? q / 6 : q;
  }
  if (10 == b) {
    listAt(ctx, "Holes", 11); // the game indexes Holes[11][63] directly
    q = asNum(ctx, "Holes", 11, 63);
    return 99 == e ? Math.max(0, getLOG(ctx, q) - 2) : q;
  }
  return 0;
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
export const PORTED: Ported = {
  B_UPG: [46, 47, 55, 57, 82, 83, 84], CosmoBonusQTY: true, MonumentROGbonuses: true, PocketDivOwned: true,
  MeasurementBonusTOTAL: true, MeasurementBaseBonus: true, MeasurementMulti: true, MeasurementQTYfound: true,
};
