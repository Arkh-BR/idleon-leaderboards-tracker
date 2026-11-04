import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { ArtifactInfo } from "../data";
import { MissingSaveKey, NotPorted } from "../errors";
import { ResearchStuff } from "./ResearchStuff";
import { Thingies } from "./Thingies";

/**
 * N.js `_customBlock_Sailing(d, b, e)` @10690910: one function, a chain of named sub-cases. Only the
 * sub-cases (and, inside ArtifactBonus, the artifact indices) the Artifact Find port reaches.
 */
export const Sailing = block("Sailing", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "ArtifactBonus":
      return artifactBonus(ctx, b, e);
    case "DaveyJonesBonus":
      return daveyJonesBonus(ctx, b);
    default:
      throw new NotPorted("Sailing", d);
  }
});

/** The artifacts whose value the game computes with a multiplier of its own besides the tier (`l` in the pass below). */
const OWN_MULTIPLIER = new Set([1, 2, 5, 8, 10, 11, 13, 18, 20, 23, 25, 27, 29, 999]);

/** Index 2..7 of the tier, the word in the artifact's text: `The_artifact's_main_bonus_is_<word>!` (ArtifactInfo[l][5], [7] ... [15]). */
const TIER_WORD = [, , "doubled", "tripled", "quadrupled", "quintupled", "sixtupled", "seventupled"];

/**
 * `ArtifactBonus` @10714975, for `e == 0` and an artifact with no multiplier of its own besides the
 * tier, plus artifact 3 (which scales with the player's level).
 *
 * With `b >= 0` the game does not compute anything here: it returns `DNSM.SailzArtiBonusL[b]`, a list
 * the pass `Sailing("ArtifactBonus", -1, 0)` fills for every artifact (called by TalentCalc(-9)
 * @4515107, and again whenever the player's data changes). That pass is the writer of the cache, so
 * this replays its iteration `l = b` for the current player: 0 when the artifact is not found, else
 * the base in ArtifactInfo[l][3], x Lv0[13] for artifact 3, x the tier where the artifact's text carries it.
 */
function artifactBonus(ctx: Ctx, b: number, e: number): number {
  if (e === 1) throw new NotPorted("Sailing", "ArtifactBonus:e=1"); // the 1==e branch: the tier's description number
  if (b < 0 || OWN_MULTIPLIER.has(b)) throw new NotPorted("Sailing", `ArtifactBonus:${b}`);
  const info = ArtifactInfo[b];
  if (!info) throw new RangeError(`Sailing ArtifactBonus: no artifact ${b} in ArtifactInfo`);
  // The game pads Sailing[3] with 0 up to 60 right after the load (@6437706, @6443117): an index past the end of the save's list is 0.
  const tier = asNum(ctx, "Sailing", 3, b);
  let v = tier === 0 ? 0 : asNumber(info[3]);
  if (b === 3) v *= asNum(ctx, "Lv0", 13);
  const word = TIER_WORD[tier];
  if (word !== undefined && info[2 * tier + 1] === `The_artifact's_main_bonus_is_${word}!`) v *= tier;
  return v;
}

/**
 * `DaveyJonesBonus` @10702897 for boat `b`: (1 + (50 per gem-shop purchase 8 + legend talent 11) / 100)
 * x (1 + 2 x clamp(floor((loot upgrades + speed upgrades + 99600) / 1e5) x research grid 105, 0, 1)).
 */
function daveyJonesBonus(ctx: Ctx, b: number): number {
  const i = b | 0;
  const first = 1 + (50 * asNum(ctx, "GemItemsPurchased", 8) + Thingies(ctx, "LegendPTS_bonus", 11, 0)) / 100;
  // the game indexes Boats[b] directly and would throw on a missing row
  if (attr(ctx, "Boats", i) === undefined) throw new MissingSaveKey(`Boats[${i}]`);
  const upgrades = asNum(ctx, "Boats", i, 3) + asNum(ctx, "Boats", i, 5);
  const reached = Math.floor((upgrades + 99600) / 1e5) * ResearchStuff(ctx, "Grid_Bonus", 105, 1);
  return first * (1 + 2 * Math.max(0, Math.min(1, reached)));
}
