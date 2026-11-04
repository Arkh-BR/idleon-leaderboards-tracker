import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { GrimoireUpg, Number2Letter, SummonEnemies, UpgradeVault } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { AchieveStatus } from "./AchieveStatus";
import { GetSetBonus } from "./GetSetBonus";
import { Ninja } from "./Ninja";
import { Sailing } from "./Sailing";
import { Summoning2 } from "./Summoning2";
import { Thingies } from "./Thingies";

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
    default:
      if (SUMMONING_OWN_NAMES.has(d)) throw new NotPorted("Summoning", d);
      return Summoning2(ctx, d, b, e); // @10931948: the tail of the chain
  }
});

/** The vaults whose bonus is plain level x value (`32==b||1==b||…` @10893206). */
const VAULT_PLAIN = new Set([32, 1, 6, 7, 8, 9, 13, 999, 33, 36, 40, 42, 43, 44, 49, 51, 52, 53, 57, 61, 89, 64, 70, 73, 74, 76, 79, 85, 86, 88]);

/**
 * `VaultUpgBonus` @10893206. A plain vault is `UpgVault[b] x UpgradeVault[b][5]`. Every other vault 61..88 is that times
 * (1 + VaultUpgBonus(89) / 100); the ones below 61 (0, 60 and the rest) are times VaultUpgBonus 32 or 61 and have their own
 * shapes, which nothing here reaches: NotPorted. From 89 on, a vault that is not plain is 0.
 */
function vaultUpgBonus(ctx: Ctx, b: number): number {
  const level = () => asNum(ctx, "UpgVault", Math.round(b)) * asNumber(vaultRow(b)[5]);
  if (VAULT_PLAIN.has(b)) return level();
  if (b < 61) throw new NotPorted("Summoning", `VaultUpgBonus:b=${b}`);
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

/** The grimoire upgrades that are plain level x value (`9==b||11==b||…` @10885504). The others are times GrimoireUpgBonus 36: NotPorted. */
const GRIMOIRE_PLAIN = new Set([9, 11, 26, 36, 39, 17, 32, 45]);
function grimoireUpgBonus(ctx: Ctx, b: number): number {
  if (!GRIMOIRE_PLAIN.has(b)) throw new NotPorted("Summoning", `GrimoireUpgBonus:b=${b}`);
  const row = GrimoireUpg[b | 0];
  // the game indexes GrimoireUpg[b][5] directly
  if (!row) throw new RangeError(`Summoning GrimoireUpgBonus: no upgrade ${b} in GrimoireUpg`);
  return asNum(ctx, "Grimoire", Math.round(b)) * asNumber(row[5]);
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
function summWinBonus(ctx: Ctx): number[] {
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
 * `WinBonus` @10927394: Winner Bonus `b`. b == -1 is 0. The buckets 20, 22, 24 and 31 are the table's value as it is. Bonus 19 and
 * 20..33 have shapes of their own (NotPorted). Every other bonus, b = 3 among them, is the bucket x 3.5 x the Ninja pristine charm 8
 * x the gem-shop purchase 11 x (1 + the winner-bonus boosts / 100), those being Artifact 32, Tasks[2][5][4] (capped at 10), the
 * achievements 379 and 373, the Winner Bonus 31 bucket, the Emperor bonus 8, the God Shard set and the Bundle ban_i.
 */
function winBonus(ctx: Ctx, b: number): number {
  const table = summWinBonus(ctx);
  if (-1 == b) return 0;
  if (20 == b || 22 == b || 24 == b || 31 == b) return table[b | 0];
  if (19 == b || (20 <= b && 33 >= b)) throw new NotPorted("Summoning", `WinBonus:b=${b}`);
  listAt(ctx, "Tasks", 2, 5); // the game indexes Tasks[2][5][4] directly
  return (
    3.5 * asNumber(table[b | 0]) *
    (1 + Ninja(ctx, "PristineBon", 8, 0) / 100) *
    (1 + (10 * asNum(ctx, "GemItemsPurchased", 11)) / 100) *
    (1 +
      (Sailing(ctx, "ArtifactBonus", 32, 0) +
        (Math.min(10, asNum(ctx, "Tasks", 2, 5, 4)) +
          (AchieveStatus(ctx, 379) +
            (AchieveStatus(ctx, 373) +
              (Summoning(ctx, "WinBonus", 31, 0) +
                (Thingies(ctx, "EmperorBon", 8, 0) +
                  (GetSetBonus(ctx, "GODSHARD_SET", "Bonus", 0, 0) + 50 * Thingies(ctx, "Have_ban_i", 0, 0)))))))) /
        100)
  );
}
