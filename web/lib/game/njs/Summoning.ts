import { asNum, asNumber, attr } from "../attr";
import { block, runtime, withPlayer, type Ctx } from "../ctx";
import { GrimoireUpg, MapDetails, Number2Letter, SummonEnemies, SummonUPG, UpgradeVault } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains, lengthOf, listAt, listOrMapAt } from "../lists";
import { AchieveStatus } from "./AchieveStatus";
import { Companions } from "./Companions";
import { DNSM_TomeQTYtot } from "./DNSM";
import { Dreamstuff } from "./Dreamstuff";
import { getbonus2 } from "./getbonus2";
import { getLOG } from "./getLOG";
import { GetSetBonus } from "./GetSetBonus";
import { JellyOperation } from "./JellyOperation";
import { Ninja } from "./Ninja";
import { Sailing } from "./Sailing";
import { Summoning2 } from "./Summoning2";
import { PORTED as Summoning2PORTED } from "../summoning2Ported";
import { Thingies } from "./Thingies";
import { range, type Ported } from "../ported";

/**
 * The names `Summoning` answers itself (`"X"==d` in its chain, @10878764 to @10931948; 71 of them). Any other name is handed to `Summoning2`; a name from
 * this list that is not ported here is NotPorted, as it does not reach Summoning2 either. __tests__/lib/game/njs/events.test.ts compares the list with N.js.
 */
export const SUMMONING_OWN_NAMES: ReadonlySet<string> = new Set([
  "RegionLockMulticharProg", "ArcadeGballsExtraPCT", "HighestLvPlayer", "GrimoireWraith", "RibbonShelfUnlocked", "RibbonBonus",
  "GrimoireBoneQTYbase", "GrimoireBoneType", "AllMasterclassDropz", "GrimoireBonesDropDEC", "AllMasterclassCostReduxPrefix",
  "AllMasterclassCostRedux", "First3MC_CostRedux", "GrimoireUpgCost", "GrimoireUpgUNLOCKED", "GrimoireUpgTotal", "GrimoireUpgBonus",
  "Grimoire_HP", "Grimoire_DMG", "Grimoire_ACC", "Grimoire_DEF", "Grimoire_MASTERY", "Grimoire_CRITPCT", "Grimoire_CRITDMG",
  "VaultUpgCost", "VaultUpgUNLOCKED", "VaultUpgMaxLV_most", "VaultUpgMaxLV", "VaultUpgTotal", "VaultUpgBonus", "VaultKillzTotal",
  "EventShopOwned", "RooNextUpgReq", "RooCost", "RooShinyMulti", "RooCatchRate", "RooCatchREQ", "RooCatchFishQTY", "RooCatchRate_S",
  "RooCatchREQ_S", "RooCatchRate_T", "RooCatchREQ_T", "RooShinyLuck", "RooTarOwned", "RooCost_T", "RooRESETbon", "RooMegafeather",
  "RooBonuses", "OwlCost", "TomeLvReq", "TomeBonus", "isTomeUnlocked", "TomePCT", "TomePTS", "EndlessUnlocked", "EndlessModifierID",
  "MaxMana", "ManaStart", "ManaRegen", "UnitSpd", "UnitHP", "UnitDMG", "UnitDODGE", "SummUpgBonus", "SummVictories", "UpgCost",
  "UnitCost", "RerollCost", "WinBonus", "SummEXPgain", "SpikePlacementDMG",
]);

/**
 * N.js `_customBlock_Summoning(d, b, e)` @10878764: one function, a chain of named sub-cases. Only the sub-cases the
 * Artifact Find port reaches. A name the chain does not answer is handed to `Summoning2(d, b, e)` (@10931948), where
 * `VotingBonusz`, `VotingBonuszMulti` and the `Meritoc…` sub-cases live.
 *
 * The Tutorial scene gates the game has in two of these are not modelled: VaultUpgBonus is `-1 == getCurrentSceneName().indexOf("Tutorial")
 * ? value : 0` and WinBonus opens with `if (-1 != getCurrentSceneName().indexOf("Tutorial")) return 0`. The scene is the running game's,
 * and a tracked account is in the world, not the Tutorial.
 */
export const Summoning: (ctx: Ctx, d: string, b: number, e: number) => number = block("Summoning", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "VaultUpgBonus":
      return vaultUpgBonus(ctx, b);
    case "EventShopOwned":
      return eventShopOwned(ctx, b);
    case "GrimoireUpgBonus":
      return grimoireUpgBonus(ctx, b);
    case "WinBonus":
      return winBonus(ctx, b);
    // @10880964: the Ribbon of tier b's multiplier
    case "RibbonBonus":
      return (
        1 +
        (Math.floor(5 * b + Math.floor(b / 2) * (4 + 6.5 * Math.floor(b / 5))) +
          (Math.floor(b / 4) * (GetSetBonus(ctx, "EMPEROR_SET", "Bonus", 0, 0) / 4) +
            (Math.floor(b / 10) * Dreamstuff(ctx, "CloudBonus", 73) + Math.floor(b / 20) * JellyOperation(ctx, "RoG_BonusQTY", 60, 0)))) /
          100
      );
    // @10906704: Roo megafeather b is owned while OptionsListAccount[279] is past b; the eleventh counts every one from 11 on
    case "RooMegafeather":
      return asNum(ctx, "OptionsListAccount", 279) > b ? (11 == b ? asNum(ctx, "OptionsListAccount", 279) - 11 : 1) : 0;
    case "RooBonuses":
      return rooBonuses(ctx, b);
    case "VaultKillzTotal":
      return vaultKillzTotal(ctx, b);
    case "SummUpgBonus":
      return summUpgBonus(ctx, b);
    case "TomeBonus":
      return tomeBonus(ctx, b);
    // @10880494: the Wraith form, `1 <= GetBuffBonuses(195,1) ? (100 < its BuffsActive timer ? 1 : 0) : 0`. The masterclass forms are not
    // counted (the Damage page's product decision), as in PlayerHPmax and PlayerAccTot
    case "GrimoireWraith":
      return runtime(ctx, "Summoning(GrimoireWraith)", "masterclass form, not counted");
    default:
      if (SUMMONING_OWN_NAMES.has(d)) throw new NotPorted("Summoning", d);
      return Summoning2(ctx, d, b, e); // @10931948: the tail of the chain
  }
});

/** The vaults whose bonus is plain level x value (`32==b||1==b||…` @10893206). */
const VAULT_PLAIN = new Set([32, 1, 6, 7, 8, 9, 13, 999, 33, 36, 40, 42, 43, 44, 49, 51, 52, 53, 57, 61, 89, 64, 70, 73, 74, 76, 79, 85, 86, 88]);

/**
 * `VaultUpgBonus` @10893206. A plain vault is `UpgVault[b] x UpgradeVault[b][5]`. Vault 0 adds a level past 25, 50 and 100, vault 60 past 25,
 * 50 and (x2..x10) 100..450 and times 1 + floor(level / 25) / 5; then every other vault is that level x value times 1 + VaultUpgBonus(32)
 * / 100 below 32, (61) below 61, (89) below 89 (vault 0 by 32, vault 60 by 61). From 89 on, a vault that is not plain is 0.
 */
function vaultUpgBonus(ctx: Ctx, b: number): number {
  const lv = () => asNum(ctx, "UpgVault", Math.round(b));
  const level = () => lv() * asNumber(vaultRow(b)[5]);
  if (VAULT_PLAIN.has(b)) return level();
  if (0 == b) return (level() + (Math.max(0, lv() - 25) + (Math.max(0, lv() - 50) + Math.max(0, lv() - 100)))) * (1 + Summoning(ctx, "VaultUpgBonus", 32, 0) / 100);
  if (60 == b) {
    const v = asNum(ctx, "UpgVault", 60);
    return (
      (v * asNumber(vaultRow(60)[5]) +
        (Math.max(0, v - 25) +
          (Math.max(0, v - 50) + (2 * Math.max(0, v - 100) + (3 * Math.max(0, v - 200) + (5 * Math.max(0, v - 300) + (7 * Math.max(0, v - 400) + 10 * Math.max(0, v - 450)))))))) *
      (1 + Math.floor(v / 25) / 5) *
      (1 + Summoning(ctx, "VaultUpgBonus", 61, 0) / 100)
    );
  }
  if (32 > b) return level() * (1 + Summoning(ctx, "VaultUpgBonus", 32, 0) / 100);
  if (61 > b) return level() * (1 + Summoning(ctx, "VaultUpgBonus", 61, 0) / 100);
  if (89 > b) return level() * (1 + Summoning(ctx, "VaultUpgBonus", 89, 0) / 100);
  return 0;
}
function vaultRow(b: number): readonly unknown[] {
  const row = UpgradeVault[b | 0];
  // the game indexes UpgradeVault[b][5] directly and would throw on a vault it does not have
  if (!row) throw new RangeError(`Summoning VaultUpgBonus: no vault ${b} in UpgradeVault`);
  return row;
}

/** `EventShopOwned` @10899434: Event Shop item `b` is owned when its letter (Number2Letter[b]) is in OptionsListAccount[311]. */
function eventShopOwned(ctx: Ctx, b: number): number {
  return -1 != hString(attr(ctx, "OptionsListAccount", 311)).indexOf(hString(Number2Letter[b | 0])) ? 1 : 0;
}

/** The grimoire upgrades that are plain level x value (`9==b||11==b||…` @10885504); every other one is times 1 + GrimoireUpgBonus(36) / 100. */
const GRIMOIRE_PLAIN = new Set([9, 11, 26, 36, 39, 17, 32, 45]);
function grimoireUpgBonus(ctx: Ctx, b: number): number {
  const row = GrimoireUpg[b | 0];
  // the game indexes GrimoireUpg[b][5] directly
  if (!row) throw new RangeError(`Summoning GrimoireUpgBonus: no upgrade ${b} in GrimoireUpg`);
  const level = asNum(ctx, "Grimoire", Math.round(b)) * asNumber(row[5]);
  return GRIMOIRE_PLAIN.has(b) ? level : level * (1 + Summoning(ctx, "GrimoireUpgBonus", 36, 0) / 100);
}

/**
 * `DNSM.SummWinBonus`, the table `WinBonus` fills before it answers (@10927394, rebuilt on every call with b == -1 and
 * on the first one otherwise): 32 buckets, one per Winner Bonus, holding the sum of
 *  - the bonus value of every Summoning enemy the account has beaten (`Summon[1]`, rift enemies skipped): SummonEnemies[7],
 *    in the bucket SummonEnemies[5] - 1;
 *  - then one more per Endless round (OptionsListAccount[319] of them): SummonEnemies[10] in bucket SummonEnemies[9] - 1, the
 *    tables repeating every 40 rounds.
 * The indices are taken like the game does, `x | 0` on a JS list, so an enemy that is not in SummonEnemies[0] (indexOf -1) lands on
 * the property "-1" of the array and changes no bucket.
 */
export function summWinBonus(ctx: Ctx): number[] {
  const out: number[] = new Array(32).fill(0);
  const beaten = listAt(ctx, "Summon", 1);
  const [names, , , , , bucketOf, , valueOf, , roundBucket, roundValue] = SummonEnemies as unknown as readonly unknown[][];
  for (let g = 0, n = beaten.length; g < n; g++) {
    if (0 == hString(beaten[g]).indexOf("rift")) continue; // N.js `0 != (""+Summon[1][g]).indexOf("rift")`
    const enemy = names.indexOf(beaten[g]);
    const bucket = Math.round(asNumber(bucketOf[enemy | 0]) - 1);
    out[bucket | 0] = asNumber(out[bucket | 0]) + asNumber(valueOf[enemy | 0]);
  }
  for (let g = 0, rounds = asNum(ctx, "OptionsListAccount", 319) | 0; g < rounds; g++) {
    const i = g - 40 * Math.floor(g / 40);
    const bucket = Math.round(asNumber(roundBucket[i]) - 1);
    out[bucket | 0] = asNumber(out[bucket | 0]) + asNumber(roundValue[i]);
  }
  return out;
}

/**
 * `WinBonus` @10927394: Winner Bonus `b`. b == -1 is 0. The buckets 20, 22, 24 and 31 are the table's value as it is. Bonus 19 is
 * x 3.5 without the boosts Winner Bonus 31 and Emperor 8; 20..33 are without the x 3.5. Every other bonus, b = 3 among them, is the
 * bucket x 3.5 x the Ninja pristine charm 8
 * x the gem-shop purchase 11 x (1 + the winner-bonus boosts / 100), those being Artifact 32, Tasks[2][5][4] (capped at 10), the
 * achievements 379 and 373, the Winner Bonus 31 bucket, the Emperor bonus 8, the God Shard set and the Bundle ban_i.
 */
function winBonus(ctx: Ctx, b: number): number {
  const table = summWinBonus(ctx);
  if (-1 == b) return 0;
  if (20 == b || 22 == b || 24 == b || 31 == b) return table[b | 0];
  listAt(ctx, "Tasks", 2, 5); // the game indexes Tasks[2][5][4] directly
  const common = () => (1 + Ninja(ctx, "PristineBon", 8, 0) / 100) * (1 + (10 * asNum(ctx, "GemItemsPurchased", 11)) / 100);
  // 19: no Winner Bonus 31 and no Emperor bonus 8 in the boosts
  if (19 == b)
    return (
      3.5 * asNumber(table[b | 0]) *
      common() *
      (1 +
        (Sailing(ctx, "ArtifactBonus", 32, 0) +
          (Math.min(10, asNum(ctx, "Tasks", 2, 5, 4)) +
            (AchieveStatus(ctx, 379) + (AchieveStatus(ctx, 373) + (GetSetBonus(ctx, "GODSHARD_SET", "Bonus", 0, 0) + 50 * Thingies(ctx, "Have_ban_i", 0, 0)))))) /
          100)
    );
  const boosts = () =>
    1 +
    (Sailing(ctx, "ArtifactBonus", 32, 0) +
      (Math.min(10, asNum(ctx, "Tasks", 2, 5, 4)) +
        (AchieveStatus(ctx, 379) +
          (AchieveStatus(ctx, 373) +
            (Summoning(ctx, "WinBonus", 31, 0) +
              (Thingies(ctx, "EmperorBon", 8, 0) + (GetSetBonus(ctx, "GODSHARD_SET", "Bonus", 0, 0) + 50 * Thingies(ctx, "Have_ban_i", 0, 0)))))))) /
      100;
  // 20..33 (but 20, 22, 24, 31): without the 3.5
  if (20 <= b && 33 >= b) return asNumber(table[b | 0]) * common() * boosts();
  return 3.5 * asNumber(table[b | 0]) * common() * boosts();
}

/** `DNSM.RooBonus`'s seven bonuses' base values (@10906879). */
const ROO = [3, 3, 5, 2, 2, 0.5, 3];

/**
 * `RooBonuses` @10906879: Roo bonus `b` of `DNSM.RooBonus`, a list the game fills on the first call (and when `b == -1`; here it is built
 * from the save each time). Bonus i is ROO[i] x (1 + legend talent 26 / 100) x (1 + Companion 51) x (1 + the megafeathers' total / 100)
 * x max(0, ceil((OptionsListAccount[271] - i) / 7)), the total 50 each for megafeathers 1, 3, 6, 8, 50 for the first of the eleventh and
 * 25 for each one past it. `b == -1` answers 0 (the rebuild).
 */
function rooBonuses(ctx: Ctx, b: number): number {
  if (-1 == b) return 0;
  const all = // DNSM.RooBonusAll
    50 * Summoning(ctx, "RooMegafeather", 1, 0) +
    (50 * Summoning(ctx, "RooMegafeather", 3, 0) +
      (50 * Summoning(ctx, "RooMegafeather", 6, 0) +
        (50 * Summoning(ctx, "RooMegafeather", 8, 0) + (50 * Math.min(1, Summoning(ctx, "RooMegafeather", 11, 0)) + 25 * Math.max(0, Summoning(ctx, "RooMegafeather", 11, 0) - 1)))));
  const i = b | 0;
  // the game answers undefined for a bonus past the seven, which the caller would turn into NaN
  if (!(0 <= i && i < ROO.length)) throw new RangeError(`Summoning RooBonuses: no Roo bonus ${b}`);
  return ROO[i] * (1 + Thingies(ctx, "LegendPTS_bonus", 26, 0) / 100) * (1 + Companions(ctx, 51)) * (1 + all / 100) * Math.max(0, Math.ceil((asNum(ctx, "OptionsListAccount", 271) - i) / 7));
}

/** Kills on map `m` by one character: MapDetails[m][0][0] (the kills the map's portal needs) minus its KillsLeft2Advance[m][0]. */
function killsOn(ctx: Ctx, m: number): number {
  listAt(ctx, "KillsLeft2Advance", m); // the game indexes KillsLeft2Advance[m][0] directly
  return asNumber((MapDetails as unknown as readonly (readonly (readonly unknown[])[])[])[m][0][0]) - asNum(ctx, "KillsLeft2Advance", m, 0);
}
/** The account's kills on map `m`: the current character's, then every other character's (PlayerDATABASE but UserInfo[0]). */
export function accountKillsOn(ctx: Ctx, m: number): number {
  let total = killsOn(ctx, m); // DNSM.VaultKillzDN4
  for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (t !== ctx.player) total = total + killsOn(withPlayer(ctx, t), m);
  return total;
}

/**
 * `VaultKillzTotal` @10895474: entry `b` of `DNSM.VaultKillzTOT`, a list the game builds on the first call of the session and keeps (it
 * reads only save data, so here it is built from the save each time):
 *  - 0..3: the account's kills on the maps 14, 24, 13 and 8;
 *  - 4..7: floor(getLOG(those)), 0 below 10 kills;
 *  - 8: the Tasks[3][0..3] entries equal to 1 (one running count over the four worlds);
 *  - 9: the sum of min(100, level) over the bubbles of the cauldrons 0..3 (CauldronInfo[0..3]), rounded at each step;
 *  - 10: the account's kills on map 101, 11: floor(getLOG(those)) (no 10-kill floor).
 */
function vaultKillzTotal(ctx: Ctx, b: number): number {
  const tot: number[] = []; // DNSM.VaultKillzTOT
  for (const m of [14, 24, 13, 8]) tot.push(accountKillsOn(ctx, m));
  for (let g = 0; g < 4; g++) tot.push(10 > tot[g] ? 0 : Math.floor(getLOG(ctx, tot[g])));
  let dn4 = 0;
  for (let g = 0; g < 4; g++) {
    const tasks = listOrMapAt(ctx, "Tasks", 3, g) as Record<number, unknown>; // the game reads Tasks[3][g].length
    for (let l = 0, n = lengthOf(tasks); l < n; l++) if (1 == tasks[l]) dn4 = dn4 + 1;
  }
  tot.push(dn4);
  dn4 = 0;
  for (let g = 0; g < 4; g++) {
    const bubbles = listOrMapAt(ctx, "CauldronInfo", g); // the game reads CauldronInfo[g].length (the cloud keeps it as a map)
    for (let l = 0, n = lengthOf(bubbles); l < n; l++) dn4 = Math.round(dn4 + Math.min(100, asNum(ctx, "CauldronInfo", g, l)));
  }
  tot.push(dn4);
  dn4 = accountKillsOn(ctx, 101);
  tot.push(dn4);
  tot.push(Math.floor(getLOG(ctx, dn4)));
  // the game answers undefined past the twelve entries, which the caller would turn into NaN
  if (!(0 <= (b | 0) && (b | 0) < tot.length)) throw new RangeError(`Summoning VaultKillzTotal: no entry ${b}`);
  return tot[b | 0];
}

/**
 * `SummUpgBonus` @10921822: Summoning upgrade `b` is DNSM.SumUpgMoltoz x Summon[0][b] x SummonUPG[b][6]. The multi is 1, or for an upgrade
 * Holes[28] lists, 2 + max(0, getbonus2(1, 597, -1) / 100 - 1) + SummUpgBonus(78) / 100; then, while the Summoning stone trial of the
 * upgrade's stone (KRbest["SummzTrz" + SummonUPG[b][2]]) is above 0 and SummonUPG[b][10] is 1, times 1 + that trial.
 */
function summUpgBonus(ctx: Ctx, b: number): number {
  const row = (SummonUPG as unknown as readonly (readonly unknown[])[])[b | 0];
  // the game indexes SummonUPG[b][2], [6] and [10] directly
  if (!row) throw new RangeError(`Summoning SummUpgBonus: no upgrade ${b} in SummonUPG`);
  let multi = 1; // DNSM.SumUpgMoltoz
  listAt(ctx, "Holes"); // D.contains(Holes[28], b): a missing Holes[28] contains nothing, a missing Holes throws
  if (contains(attr(ctx, "Holes", 28), b)) multi = 2 + (Math.max(0, getbonus2(ctx, 1, 597, -1) / 100 - 1) + Summoning(ctx, "SummUpgBonus", 78, 0) / 100);
  const stone = asNumber(row[2]);
  if (0 < Thingies(ctx, "SumStoneTrialz", stone, 0) && 1 == asNumber(row[10])) multi = multi * (1 + Thingies(ctx, "SumStoneTrialz", stone, 0));
  listAt(ctx, "Summon", 0); // the game indexes Summon[0][b] directly
  return multi * asNum(ctx, "Summon", 0, b | 0) * asNumber(row[6]);
}

/**
 * `TomeBonus` @10911395, Tome bonus `b`: 0 = 10 x floor(Tome / 100)^.7; 1 = 4 x floor(max(0, Tome - 4000) / 100)^.7 while OptionsListAccount[196] is 1; 2 = 2 x floor(max(0, Tome - 8000) / 100)^.7 while
 * OptionsListAccount[197] is 1 (the raw element, loosely); 6 = 4 x floor(Tome / 1000)^.4 once Event Shop item 0 is owned; 7 = 3 x
 * floor(Tome / 1000)^.3 once Event Shop item 27 is owned; each times 1 + (Grimoire upgrade 17 + the TROLL set bonus) / 100. The others are
 * not ported. Tome is the Tome actor's GenInfo[84], DNSM_TomeQTYtot (Ruling K); the game
 * answers 0 while that actor's GenInfo is null, which it is only before the actor is built (its constructor sets it, @5770597), so it is
 * never null here.
 */
function tomeBonus(ctx: Ctx, b: number): number {
  const boost = () => 1 + (Summoning(ctx, "GrimoireUpgBonus", 17, 0) + GetSetBonus(ctx, "TROLL_SET", "Bonus", 0, 0)) / 100;
  if (0 == b) return 10 * Math.pow(Math.floor(DNSM_TomeQTYtot(ctx) / 100), 0.7) * boost();
  // @10911815
  if (1 == b) return 1 == attr(ctx, "OptionsListAccount", 196) ? 4 * Math.pow(Math.floor(Math.max(0, DNSM_TomeQTYtot(ctx) - 4e3) / 100), 0.7) * boost() : 0;
  if (2 == b) return 1 == attr(ctx, "OptionsListAccount", 197) ? 2 * Math.pow(Math.floor(Math.max(0, DNSM_TomeQTYtot(ctx) - 8e3) / 100), 0.7) * boost() : 0;
  if (6 == b) return 1 == Summoning(ctx, "EventShopOwned", 0, 0) ? 4 * Math.pow(Math.floor(DNSM_TomeQTYtot(ctx) / 1e3), 0.4) * boost() : 0;
  if (7 == b) return 1 == Summoning(ctx, "EventShopOwned", 27, 0) ? 3 * Math.pow(Math.floor(DNSM_TomeQTYtot(ctx) / 1e3), 0.3) * boost() : 0;
  throw new NotPorted("Summoning", `TomeBonus:b=${b}`);
}

/** What this module covers (lib/game/ported.ts): its own sub-cases, then the tail of the chain, Summoning2's. */
export const PORTED: Ported = {
  ...(Summoning2PORTED as Record<string, true | readonly number[]>),
  VaultUpgBonus: range(0, 1000), // every vault; from 89 on 0 when not plain (999 is plain)
  EventShopOwned: true,
  GrimoireUpgBonus: range(0, GrimoireUpg.length),
  WinBonus: range(-1, 34),
  RibbonBonus: true,
  RooMegafeather: true,
  RooBonuses: range(-1, 7),
  VaultKillzTotal: range(0, 12),
  SummUpgBonus: range(0, SummonUPG.length),
  TomeBonus: [0, 1, 2, 6, 7],
  GrimoireWraith: true, // runtime(): the masterclass form is not counted
};
