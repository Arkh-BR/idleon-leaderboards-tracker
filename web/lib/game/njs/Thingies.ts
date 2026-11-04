import { asNum, asNumber, attr, SAVE_ATTRS } from "../attr";
import { block, type Ctx } from "../ctx";
import { EmperorBon, LegendTalents, Spelunky } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { opt } from "../state";
import { traceNode } from "../trace";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { DNSM_TomeQTYtot } from "./DNSM";
import { GetSetBonus } from "./GetSetBonus";
import { JellyOperation } from "./JellyOperation";
import { Summoning } from "./Summoning";

/** N.js `_customBlock_Thingies(d, b, e)` @10955095. Only the sub-cases the Artifact Find port reaches. */
export const Thingies = block("Thingies", (ctx, d: string, b: number, e: number) => {
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
  if (opt(ctx.state, SAVE_ATTRS.BundlesReceived.key) === undefined) {
    if (ctx.trace) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, "(absent)", ["BundlesReceived"], 0, 'absent: getLoadMap("BundlesReceived") @19927310 → {}'));
    return 0;
  }
  return 1 == attr(ctx, "BundlesReceived", "ban_i") ? 1 : 0;
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
  if (b < 0) throw new NotPorted("Thingies", `LoreEpiBon:${b}`); // the rebuild (-1) and the clamp Math.max(0, b)
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
