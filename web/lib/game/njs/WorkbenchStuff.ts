import { asNum, asNumber, attr } from "../attr";
import { assumed, block, withPlayer, type Ctx } from "../ctx";
import { DeathNoteMobs, MapAFKtarget, NinjaInfo } from "../data";
import { hString } from "../hstring";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { skillLevel } from "../player";
import { AchieveStatus } from "./AchieveStatus";
import { ArbitraryCode } from "./ArbitraryCode";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { ArcadeBonus } from "./ArcadeBonus";
import { AtomCollider } from "./AtomCollider";
import { Breeding } from "./Breeding";
import { Bubbastuff } from "./Bubbastuff";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { chipBonuses } from "./chipBonuses";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_StarSigns } from "./DNSM";
import { EtcBonuses } from "./EtcBonuses";
import { GamingStatType } from "./GamingStatType";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { getbonus2 } from "./getbonus2";
import { getLOG } from "./getLOG";
import { GetTalentNumber, talentCurves } from "./GetTalentNumber";
import { GuildBonuses } from "./GuildBonuses";
import { Holes } from "./Holes";
import { Holes2 } from "./Holes2";
import { boxLevel } from "./PostOfficeINFO";
import { prayersReal } from "./prayersReal";
import { RiftStuff } from "./RiftStuff";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Sailing } from "./Sailing";
import { SaltLick } from "./SaltLick";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { accountKillsOn, Summoning } from "./Summoning";
import type { Ported } from "../ported";

/** N.js `_customBlock_WorkbenchStuff(d, b, e)` @7801627: one function, a chain of named sub-cases. Only the sub-cases the trackers reach. */
export const WorkbenchStuff: (ctx: Ctx, d: string, b: number, e: number) => number = block("WorkbenchStuff", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @7825061: (1 + best talent 508 x getLOG(OptionsListAccount[152]) / 100) x (1 + best talent 208 x getLOG(OptionsListAccount[329]) / 100)
    case "AdditionExtraDMG":
      return (
        (1 + (getbonus2(ctx, 1, 508, -1) * getLOG(ctx, asNum(ctx, "OptionsListAccount", 152))) / 100) *
        (1 + (getbonus2(ctx, 1, 208, -1) * getLOG(ctx, asNum(ctx, "OptionsListAccount", 329))) / 100)
      );
    // @7824907: 1 + best talent 328 x getLOG(OptionsListAccount[139]) / 100, the Class EXP and Drop Rate multiplier of the Workbench
    case "AdditionExtraEXPnDR":
      return 1 + (getbonus2(ctx, 1, 328, -1) * getLOG(ctx, asNum(ctx, "OptionsListAccount", 139))) / 100;
    case "ConstMasteryBonus":
      return constMasteryBonus(ctx, b);
    case "DeathNoteRank":
      return deathNoteRank(ctx, b, e);
    case "PlayerBuildSpd":
      return playerBuildSpd(ctx, b);
    case "OverkillQTY":
      // domain of this case: page -1 and pages >= 8 throw (RangeError below); a map's page (floor(map / 50), 7) never reaches them
      return overkillQTY(ctx, b);
    case "MultiKill_perTier":
      return multiKillPerTier(ctx, e);
    case "MultiKill_base":
      return multiKillBase(ctx);
    // @7810403: the "MULTIKILL: X%" line of the AFK Info panel
    case "MultiKillTOTAL":
      return Math.floor(WorkbenchStuff(ctx, "MultiKill_base", 0, 0) + RunCodeOfTypeXforThingY(ctx, "OverkillStuffs", "2") * WorkbenchStuff(ctx, "MultiKill_perTier", 0, 0));
    default:
      throw new NotPorted("WorkbenchStuff", d);
  }
});

/** The construction actor's thresholds, `ActorEvents_481._GenINFO[112]` (its init @9087150). */
const TOWER_STEPS = [250, 500, 750, 1e3, 1250, 1500, 2500];

/**
 * `ConstMasteryBonus` @7802747: 0 below Rift 40; else, with T the construction actor's `_GenINFO[111]` (its init @9087150 sums TowerInfo[0..26];
 * the actor, PixelHelperActor[8], is built at the game's start, so its GenINFO is always that long): 0 = floor(T / 10), 1 = 2 x floor((T -
 * 750) / 10), 2 = 5 x floor((T - 1250) / 10), each at least 0. The others are not ported.
 */
function constMasteryBonus(ctx: Ctx, b: number): number {
  if (!(0 == b || 1 == b || 2 == b)) throw new NotPorted("WorkbenchStuff", `ConstMasteryBonus:b=${b}`);
  listAt(ctx, "Rift"); // the game indexes Rift[0] directly
  if (40 > asNum(ctx, "Rift", 0)) return 0;
  let towers = 0; // ActorEvents_481._GenINFO[111]
  for (let f = 0; f < 27; f++) towers += asNum(ctx, "TowerInfo", f);
  if (0 == b) return Math.max(0, Math.floor(towers / 10));
  if (1 == b) return Math.max(0, 2 * Math.floor((towers - TOWER_STEPS[2]) / 10));
  return Math.max(0, 5 * Math.floor((towers - TOWER_STEPS[4]) / 10));
}

/**
 * `DeathNoteRank` @7805536: the Death Note rank of `b` kills. With e == 7842 one table (100, 250, 1e3, 5e3, 25e3, 1e5, 1e6), else the other:
 * 0 below 25e3, 1 below 1e5, 2 below 25e4, 3 below 5e5, 4 below 1e6, 5 below 5e6, 7 below 1e8, 20 past 1e9 with the Rift bonus 3, else 10.
 */
function deathNoteRank(ctx: Ctx, b: number, e: number): number {
  if (7842 == e) return 100 > b ? 0 : 250 > b ? 1 : 1e3 > b ? 2 : 5e3 > b ? 3 : 25e3 > b ? 4 : 1e5 > b ? 5 : 1e6 > b ? 7 : 10;
  return 25e3 > b ? 0 : 1e5 > b ? 1 : 25e4 > b ? 2 : 5e5 > b ? 3 : 1e6 > b ? 4 : 5e6 > b ? 5 : 1e8 > b ? 7 : 1e9 < b && 1 == RiftStuff(ctx, "riftBonus", 3) ? 20 : 10;
}

/**
 * `OverkillQTY` @7810614: page `b` of the Death Note, entry b of `DNSM.OKqtyZZ`, a table of 8 the game builds on a call that finds it
 * absent (or with b == -1). Page w < 7 is the sum, over the monsters of DeathNoteMobs[w], of DeathNoteRank(the account's kills on the
 * monster's map, 0): the map is MapAFKtarget.indexOf(monster), the kills MapDetails[map][0][0] - KillsLeft2Advance[map][0] of the current
 * character and then of every other one (a monster with no map counts DeathNoteRank(0, 0)); page 7 sums DeathNoteRank(Ninja[105][f], 7842)
 * over the NinjaInfo[30] minibosses. The call that builds the table answers 0, every later one the entry: the table only reads save data,
 * so here it is built from the save each time and the entry is given, as a read after the build (the session's first read answers 0).
 */
function overkillQTY(ctx: Ctx, b: number): number {
  const table: number[] = []; // DNSM.OKqtyZZ
  for (let e = 0; e < 8; e++) {
    let n = 0; // DummyNumber5
    if (7 == e) {
      const minis = (NinjaInfo as unknown as readonly (readonly unknown[])[])[30];
      listAt(ctx, "Ninja", 105); // the game indexes Ninja[105][f] directly
      for (let f = 0; f < minis.length; f++) n = n + WorkbenchStuff(ctx, "DeathNoteRank", asNum(ctx, "Ninja", 105, f), 7842);
    } else {
      const mobs = (DeathNoteMobs as unknown as readonly (readonly unknown[])[])[e];
      for (let g = 0; g < mobs.length; g++) {
        const map = (MapAFKtarget as unknown as readonly unknown[]).indexOf(mobs[g]); // DummyNumber3
        n = n + WorkbenchStuff(ctx, "DeathNoteRank", 0 <= map ? accountKillsOn(ctx, map) : 0, 0);
      }
    }
    table.push(n);
  }
  // the game answers undefined for a page past the 8, which the callers' sums would turn into NaN
  if (!(0 <= (b | 0) && (b | 0) < table.length)) throw new RangeError(`WorkbenchStuff OverkillQTY: no Death Note page ${b}`);
  return assumed(ctx, "DNSM.OKqtyZZ", "the Death Note table built from the save (the game's first read of it in a session answers 0)", table[b | 0], "OverkillQTY @7810614: the call that finds DNSM.OKqtyZZ absent builds it and answers 0, every later one reads the entry; counted as a later read");
}

// The two halves are the game's text, each with its own copy of the soft cap, so multikillEdges.test.ts compares them with N.js token for token; `f` is the DNSM field N.js keeps them in.
/**
 * `MultiKill_perTier` @7805748: the 18 per-tier terms into DNSM.MKtzioDN, the soft cap from map 300 on (a caller's e = 8675309, the W7 notice's raw sum, skips it), then the Crystal
 * Glunko Cove, which replaces the sum on map 216 in cavern 17.
 */
function multiKillPerTier(ctx: Ctx, e: number): number {
  let f =
    WorkbenchStuff(ctx, "OverkillQTY", Math.floor(ctx.map / 50), 0) +
    (WorkbenchStuff(ctx, "OverkillQTY", 7, 0) +
      (DNSM_AlchVials(ctx, "Overkill") +
        (GetBuffBonuses(ctx, 46, 2) + getbonus2(ctx, 1, 58, -1) * Math.floor(asNum(ctx, "OptionsListAccount", 158) / 5)) +
        (ArcadeBonus(ctx, 8) +
          (Sailing(ctx, "ArtifactBonus", 26, 0) + GetBuffBonuses(ctx, 469, 2)) +
          (chipBonuses(ctx, "mkill") +
            (EtcBonuses(ctx, "71") + Holes(ctx, "MeasurementBonusTOTAL", 9, 0) + (CardBonusREAL(ctx, 80) + DNSM_StarSigns(ctx, "78")) + (prayersReal(ctx, 16, 0) + Breeding(ctx, "ShinyBonusS", "Nah", 4, -1)))) +
          (DNSM_BoxRewards(ctx, "13b") + (DNSM_AlchBubbles(ctx, "MKtierACTIVE") + CardSetBonuses(ctx, 0, "11"))))));
  300 <= ctx.map && 8675309 != e && (250 <= f ? (f = 98.14 + (f - 250) / 50) : 200 <= f ? (f = 95.6 + (f - 200) / 20) : 150 <= f ? (f = 90.6 + (f - 150) / 10) : 100 <= f ? (f = 80.6 + (f - 100) / 5) : 50 <= f ? (f = 47.3 + (f - 50) / 1.5) : 20 <= f && (f = 20 + (f - 20) / 1.1));
  216 == ctx.map && 17 == attr(ctx, "Holes", 0, ctx.player) && (f = Holes2(ctx, "Cglunko_MKtier", 0, 0));
  return f;
}

/** `MultiKill_base` @7808345: the 9 base terms into DNSM.MKtzioDN2, the same soft cap from map 300 on, then the Cove. */
function multiKillBase(ctx: Ctx): number {
  let f =
    DNSM_StarSigns(ctx, "MultiKill") +
    SaltLick(ctx, 8) +
    (StampBonusOfTypeX(ctx, "Overkill") + 2 * asNum(ctx, "TowerInfo", 2)) +
    (EtcBonuses(ctx, "29") + (Math.min(5, AchieveStatus(ctx, 148)) + (6 * AchieveStatus(ctx, 122) + (2 * AchieveStatus(ctx, 123) + ArbitraryCode(ctx, "StatueOnyxOwned") * GetTalentNumber(ctx, 1, 654)))));
  300 <= ctx.map && (250 <= f ? (f = 98.14 + (f - 250) / 50) : 200 <= f ? (f = 95.6 + (f - 200) / 20) : 150 <= f ? (f = 90.6 + (f - 150) / 10) : 100 <= f ? (f = 80.6 + (f - 100) / 5) : 50 <= f ? (f = 47.3 + (f - 50) / 1.5) : 20 <= f && (f = 20 + (f - 20) / 1.1));
  216 == ctx.map && 17 == attr(ctx, "Holes", 0, ctx.player) && (f = Holes2(ctx, "Cglunko_MKbase", 0, 0));
  return f;
}

/**
 * The count of `item` in the storage actor's `_ItemsAndStorageOWNED` (ActorEvents_232, PixelHelperActor[5]): the current character's
 * inventory (ActorEvents_29._ItemsOwnedMap, CountInventory @7042726) plus the storage chest, a map the actor rebuilds on its "z" trigger
 * (@5989516), which every inventory and storage change fires. The constructor leaves it empty (@6071985) until the first one: that is
 * runtime state, stood in by the count as it stands after one (Ruling J).
 */
export function itemsAndStorageOwned(ctx: Ctx, item: string): number {
  let n = 0;
  const order = listAt(ctx, "InventoryOrder");
  for (let e = 0; e < order.length; e++) if ("Blank" != order[e] && item == hString(order[e])) n += asNum(ctx, "ItemQuantity", e);
  const chest = listAt(ctx, "ChestOrder");
  for (let b = 0; b < chest.length; b++) if (item == hString(chest[b])) n += asNum(ctx, "ChestQuantity", b);
  return assumed(ctx, `_ItemsAndStorageOWNED.${item}`, "items counted in this character's inventory and the storage, as the game counts them after an inventory change", n, "ActorEvents_232._ItemsAndStorageOWNED (@5989516) is empty until its first rebuild in the session; counted as rebuilt");
}

/**
 * `PlayerBuildSpd` @7814745, the build speed of character `b` (b >= 0; any other b is 1): 3 (Lv0[8] / 2 + .7)^1.6 x (1 + Lv0[8] x the
 * Construction bubble / 100) x (1 + the build boosts / 100) x (1 + Winner Bonus 13 / 100) x (1 + Palette 25 / 100) x (1 + the 6turtle vial
 * / 100) x (1 + talent 131 x (Atom 1 + getLOG(Redox Salts owned)) / 100). Lv0, the Post Office box 17 and talent 131's level are
 * character b's (PlayerDATABASE); the bubble, the vial, the equipment (EtcBonuses 30) and the rest are the current character's, as the
 * game reads its caches. The storage actor's map is never null once built (its constructor sets it), so the shorter branch for a null one
 * is not reached.
 */
function playerBuildSpd(ctx: Ctx, b: number): number {
  if (!(0 <= b)) return 1;
  const of = withPlayer(ctx, b | 0);
  const lv = asNum(of, "Lv0", 8);
  const f = 3 * Math.pow(lv / 2 + 0.7, 1.6);
  const g = 1 + (lv * DNSM_AlchBubbles(ctx, "Construction")) / 100;
  const l =
    1 +
    (StampBonusOfTypeX(ctx, "BuildProd") +
      0.25 * boxLevel(of, 17) +
      (GuildBonuses(ctx, 5) +
        (EtcBonuses(ctx, "30") +
          (Math.min(5, 5 * AchieveStatus(ctx, 153)) +
            (WorkbenchStuff(ctx, "ConstMasteryBonus", 2, 0) +
              (DNSM_AlchVials(ctx, "Contspd") +
                ArcadeBonus(ctx, 44) +
                (Summoning(ctx, "VotingBonusz", 18, 0) + (Summoning(ctx, "VaultUpgBonus", 48, 0) * Summoning(ctx, "VaultKillzTotal", 11, 0) + Bubbastuff(ctx, "BubbaRoG_Bonuses", 1, 0))))))))) /
      100;
  const r = (1 + Summoning(ctx, "WinBonus", 13, 0) / 100) * (1 + GamingStatType(ctx, "PaletteBonus", 25, 0) / 100) * (1 + DNSM_AlchVials(ctx, "6turtle") / 100);
  const t = talentCurves(131);
  const talent = ArbitraryCode5Inputs(ctx, hString(t[2]), asNumber(t[0]), asNumber(t[1]), skillLevel(ctx, 131, b | 0), 0, 0);
  return f * g * l * r * (1 + (talent * (AtomCollider(ctx, "AtomBonuses", 1, 0) + getLOG(ctx, itemsAndStorageOwned(ctx, "Refinery1")))) / 100);
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { AdditionExtraDMG: true, AdditionExtraEXPnDR: true, ConstMasteryBonus: [0, 1, 2], DeathNoteRank: true, PlayerBuildSpd: true, OverkillQTY: true, MultiKill_perTier: true, MultiKill_base: true, MultiKillTOTAL: true };
