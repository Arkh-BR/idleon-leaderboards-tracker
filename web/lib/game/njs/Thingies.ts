import { asNum, asNumber, attr, SAVE_ATTRS } from "../attr";
import { block, type Ctx } from "../ctx";
import { EmperorBon, LegendTalents, Spelunky, ZenithMarket } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains, listAt, listOrMapAt } from "../lists";
import { opt } from "../state";
import { traceNode } from "../trace";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { Companions } from "./Companions";
import { CompLV2 } from "./CompLV2";
import { DNSM_TomeQTYtot } from "./DNSM";
import { GetSetBonus } from "./GetSetBonus";
import { JellyOperation } from "./JellyOperation";
import { Summoning } from "./Summoning";
import { range, type Ported } from "../ported";

/** N.js `_customBlock_Thingies(d, b, e)` @10955095. Only the sub-cases the Artifact Find port and the character stats reach. */
export const Thingies: (ctx: Ctx, d: string, b: number, e: number) => number = block("Thingies", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    // @10970802: Spelunk legend talent `b` (talent level x the talent's per-level value, rounded)
    case "LegendPTS_bonus":
      return Math.round(asNum(ctx, "Spelunk", 18, b | 0) * asNumber(LegendTalents[b | 0][2]));
    // @10978278: the Bundle ban_i was bought
    case "Have_ban_i":
      return haveBanI(ctx);
    // @10969070: Clam Work bonus b is on while OptionsListAccount[464] is past b
    case "ClamWorkBonus":
      return asNum(ctx, "OptionsListAccount", 464) > b ? 1 : 0;
    case "EmperorBon":
      return emperorBon(ctx, b);
    // @10974601
    case "LoreEpiBon":
      return loreEpiBon(ctx, b);
    // @10978795, the next one: the Bundles ban_m and ban_o were bought (Ruling H, as Have_ban_i)
    // @10977895: 10 once the World 6 trophy (Trophy23) is in the card collection list Cards[1]. The game's cache check
    // (`D.mapContainsValue(DNSM, "STw6tr")`, a value test of a key name) never holds, so it is read again every call.
    case "HaveW6Trophy":
      return contains(attr(ctx, "Cards", 1), "Trophy23") ? 10 : 0;
    case "Have_ban_m":
      return haveBan(ctx, "ban_m");
    case "Have_ban_o":
      return haveBan(ctx, "ban_o");
    // @10972290: the levels a super talent gets, 50 + the legend talent 7 + the Zenith Market upgrade 5
    case "SuperTalentPTS_LVgiven":
      return Math.round(50 + (Thingies(ctx, "LegendPTS_bonus", 7, 0) + Thingies(ctx, "ZenithMarketBonus", 5, 0)));
    // @10959337: Zenith Market upgrade b, its value ZenithMarket[b][4] x its level Spelunk[45][b], rounded down
    case "ZenithMarketBonus": {
      const row = (ZenithMarket as unknown as readonly (readonly unknown[])[])[b | 0];
      // the game indexes ZenithMarket[b][4] directly and would throw on an upgrade it does not have
      if (!row) throw new RangeError(`Thingies ZenithMarketBonus: no upgrade ${b} in ZenithMarket`);
      listAt(ctx, "Spelunk", 45); // the game indexes Spelunk[45][b] directly
      return Math.floor(asNumber(row[4]) * asNum(ctx, "Spelunk", 45, b | 0));
    }
    // @10946237: Dancing Coral b: with e == 999 its value Spelunky[24][b] (CustomLists); else that times the levels the Tower (TowerInfo[18 + b]) is past 200
    case "DancingCoralBonus":
      if (999 == e) return asNumber((Spelunky as unknown as readonly (readonly unknown[])[])[24][b | 0]);
      return Thingies(ctx, "DancingCoralBonus", b, 999) * Math.max(0, asNum(ctx, "TowerInfo", Math.round(18 + b)) - 200);
    // @10963823: Coral Kid upgrade b: 2 is 20 x o / (25 + o) (o = OptionsListAccount[427 + b]), 3 is round(OptionsListAccount[427 + b]), 11 is round(OptionsListAccount[621])
    case "CoralKidUpgBonus":
      if (2 == b) return 20 * (asNum(ctx, "OptionsListAccount", Math.round(427 + b)) / (25 + asNum(ctx, "OptionsListAccount", Math.round(427 + b))));
      if (3 == b) return Math.round(asNum(ctx, "OptionsListAccount", Math.round(427 + b)));
      if (11 == b) return Math.round(asNum(ctx, "OptionsListAccount", 621));
      throw new NotPorted("Thingies", `CoralKidUpgBonus:b=${b}`);
    case "FriendBonusStatz":
      if (0 != b && 1 != b) throw new NotPorted("Thingies", `FriendBonusStatz:b=${b}`); // 2 is [~] (unreached.ts)
      return friendBonusStatz(ctx, b);
    // @10955906: the friend slots, round(min(20, 2 + Companion 44 + 2 x Companion 30 + Event Shop items 22 and 67))
    case "FriendBonusSlots":
      return Math.round(Math.min(20, 2 + (Companions(ctx, 44) + (2 * Companions(ctx, 30) + Summoning(ctx, "EventShopOwned", 22, 0) + Summoning(ctx, "EventShopOwned", 67, 0)))));
    // @10962274: friend bonus b for a friend's level e: k x min(1.5, .25 + min(3e4, max(0, e)) / (min(3e4, max(0, e)) + 12e3) x 1.5), k per bonus
    case "FriendBonusQTY": {
      const k = [100, 30, 50, 25, 30, 40, 10][b];
      if (k === undefined) return 0;
      const lv = Math.min(3e4, Math.max(0, e));
      return k * Math.min(1.5, 0.25 + (lv / (lv + 12e3)) * 1.5);
    }
    // @10960324: 1 + (100 x Companion 30 + 25 x CompLV2 44) / 100
    case "FriendBonusXtraMulti":
      return 1 + (100 * Companions(ctx, 30) + 25 * CompLV2(ctx, 44)) / 100;
    // @10962960: the Unstable Reliquarium (Quest105) is in the current character's inventory. The game keeps the answer for the session
    // (DNSM.RelqPoz, rebuilt with b == -1); here it is read from the save each time
    case "ReliquariumInPosession":
      return contains(attr(ctx, "InventoryOrder"), "Quest105") ? 1 : 0;
    // @10977138: the best Summoning stone trial of stone b, KRbest["SummzTrz" + b], or 0 when the account has none
    case "SumStoneTrialz": {
      const best = listOrMapAt(ctx, "KRbest") as Record<string, unknown>;
      return Object.hasOwn(best, `SummzTrz${b}`) ? asNum(ctx, "KRbest", `SummzTrz${b}`) : 0;
    }
    default:
      throw new NotPorted("Thingies", d);
  }
});

/**
 * `DNSM.EmperorBon`, the table `EmperorBon` fills the first time it is asked (@10979748, and when b == -1): 12 buckets; for each of the
 * OptionsListAccount[369] Emperor fights g, bucket CustomLists.EmperorBon[2][g mod 48] gains CustomLists.EmperorBon[1][that bucket].
 * Here it is built from the save each time.
 */
function emperorBonTable(ctx: Ctx): number[] {
  const table: number[] = new Array(12).fill(0);
  const [, gain, bucketOf] = EmperorBon as unknown as readonly unknown[][];
  for (let g = 0, n = asNum(ctx, "OptionsListAccount", 369) | 0; g < n; g++) {
    const bucket = asNumber(bucketOf[g - 48 * Math.floor(g / 48)]) | 0;
    table[bucket] = asNumber(table[bucket]) + asNumber(gain[bucket]);
  }
  return table;
}

/** `EmperorBon` @10979748: bucket b of that table, times 1 + (Arcane upgrade 48 + Arcade 51 + Jelly upgrade 28) / 100, rounded down. */
function emperorBon(ctx: Ctx, b: number): number {
  return Math.floor(asNumber(emperorBonTable(ctx)[b | 0]) * (1 + (ArcaneType(ctx, "ArcaneUpgBonus", 48, 0) + (ArcadeBonus(ctx, 51) + JellyOperation(ctx, "RoG_BonusQTY", 28, 0))) / 100));
}

/**
 * `1 == BundlesReceived.h.ban_i` @10978278. Ruling H: a save without the `BundlesReceived` key is an account that never bought a
 * bundle, not a pre-migration save. The loader `u.getLoadMap("BundlesReceived")` @19927310 has no CSver gate, so it always gives a map,
 * and an absent key gives the empty one. Only here is that read as the empty map (Ruling E still holds for the CSver-gated keys);
 * the trace shows it as an `(absent)` leaf instead of a silent zero.
 */
function haveBanI(ctx: Ctx): number {
  return haveBan(ctx, "ban_i");
}
export function haveBan(ctx: Ctx, bundle: string): number {
  if (bundlesAbsent(ctx)) return 0;
  return 1 == attr(ctx, "BundlesReceived", bundle) ? 1 : 0;
}

/** `c.asNumber(BundlesReceived.h[bundle])` (the Cove's `Math.min(1, ...)` in AFKgainrates @4448129); an absent BundlesReceived is the empty map: 0 (Ruling H). */
export function bundleAsNum(ctx: Ctx, bundle: string): number {
  if (bundlesAbsent(ctx)) return 0;
  return asNum(ctx, "BundlesReceived", bundle);
}

function bundlesAbsent(ctx: Ctx): boolean {
  if (opt(ctx.state, SAVE_ATTRS.BundlesReceived.key) !== undefined) return false;
  if (ctx.trace) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, "(absent)", ["BundlesReceived"], 0, 'absent: getLoadMap("BundlesReceived") @19927310 → {}'));
  return true;
}

/**
 * `LoreEpiBon` @10974601: entry `b` of `DNSM.LoreEpiBon`, a list the game fills on the first call (and when `b == -1`, the rebuild, not
 * ported; here it is built from the save each time) with one entry per lore episode of Spelunky[20]: 0 while the episode is not unlocked
 * (`Spelunk[13][2] > g` is false), else, for Spelunky[21][g] = "a|from" and p = floor(max(0, Tome - from) / 100) ^ .7,
 * (1 + (Grimoire upgrade 17 + the TROLL set bonus) / 100) x a x max(0, p / (25 + p)).
 *
 * Tome is the Tome actor's `GenInfo[84]` (ActorEvents_229), the account's Tome score: `DNSM_TomeQTYtot`, our own `computeTome` standing in
 * for that runtime value (Ruling K).
 */
function loreEpiBon(ctx: Ctx, b: number): number {
  if (b < 0) throw new NotPorted("Thingies", `LoreEpiBon:b=${b}`); // the rebuild (-1) and the clamp Math.max(0, b)
  const episodes = (Spelunky as unknown as readonly (readonly unknown[])[])[20].length;
  const g = Math.max(0, b) | 0;
  // the game answers undefined for an episode past the list, which the caller would turn into NaN
  if (g >= episodes) throw new RangeError(`Thingies LoreEpiBon: no lore episode ${b} in Spelunky[20]`);
  listAt(ctx, "Spelunk", 13); // the game indexes Spelunk[13][2] directly
  if (!(asNum(ctx, "Spelunk", 13, 2) > g)) return 0;
  const [value, from] = hString((Spelunky as unknown as readonly (readonly unknown[])[])[21][g]).split("|");
  const tome = DNSM_TomeQTYtot(ctx);
  const p = Math.pow(Math.floor(Math.max(0, tome - asNumber(from)) / 100), 0.7);
  return (1 + (Summoning(ctx, "GrimoireUpgBonus", 17, 0) + GetSetBonus(ctx, "TROLL_SET", "Bonus", 0, 0)) / 100) * asNumber(value) * Math.max(0, p / (25 + p));
}

/**
 * `FriendBonusStatz` @10960432: the friends' bonus `b` (of 20): OptionsListAccount[476] lists the friends as "stat,level;stat,level…"; the
 * first FriendBonusSlots of them with a stat below 18 each set entry `stat` to FriendBonusQTY(stat, level) (a later friend with the same
 * stat replaces it), and the entry is times FriendBonusXtraMulti. The game keeps the table for the session (DNSM.FrendBonzStatz, rebuilt
 * with b == -1); here it is built from the save each time.
 */
function friendBonusStatz(ctx: Ctx, b: number): number {
  const table: number[] = new Array(20).fill(0); // DNSM.FrendBonzStatz
  const list = hString(attr(ctx, "OptionsListAccount", 476));
  if ("0" != list && "" != list) {
    const friends = list.split(";");
    for (let e = 0, f = Math.min(Thingies(ctx, "FriendBonusSlots", 0, 0), friends.length) | 0; e < f; e++) {
      const [stat, level] = `${friends[e]}`.split(",");
      if (18 > asNumber(stat)) table[asNumber(stat) | 0] = Thingies(ctx, "FriendBonusQTY", asNumber(stat), asNumber(level));
    }
  }
  return asNumber(table[Math.max(0, b) | 0]) * Thingies(ctx, "FriendBonusXtraMulti", 0, 0);
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  LegendPTS_bonus: true, Have_ban_i: true, ClamWorkBonus: true, EmperorBon: true, LoreEpiBon: range(0, 30),
  HaveW6Trophy: true, Have_ban_m: true, Have_ban_o: true, SuperTalentPTS_LVgiven: true, ZenithMarketBonus: true, CoralKidUpgBonus: [2, 3, 11], DancingCoralBonus: true, SumStoneTrialz: true,
  FriendBonusStatz: [0, 1] /* 2: only SkillStats AllEfficiencies (unreached.ts) */, FriendBonusSlots: true, FriendBonusQTY: true, FriendBonusXtraMulti: true, ReliquariumInPosession: true,
};
