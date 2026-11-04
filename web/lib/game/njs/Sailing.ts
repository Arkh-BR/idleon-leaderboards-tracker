import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { ArtifactInfo } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { listAt } from "../lists";
import { ArcadeBonus } from "./ArcadeBonus";
import { Breeding } from "./Breeding";
import { CaptBonusCalc } from "./CaptBonusCalc";
import { CompLV2 } from "./CompLV2";
import { Companions } from "./Companions";
import { DNSM_AlchVials, DNSM_StarSigns } from "./DNSM";
import { FarmingStuffs } from "./FarmingStuffs";
import { GamingStatType } from "./GamingStatType";
import { GetBribeBonus } from "./GetBribeBonus";
import { Holes } from "./Holes";
import { JellyOperation } from "./JellyOperation";
import { MainframeBonus } from "./MainframeBonus";
import { MenagerieStuff } from "./MenagerieStuff";
import { Minehead } from "./Minehead";
import { NONdummies60 } from "./NONdummies";
import { Ninja } from "./Ninja";
import { RandomEvent } from "./RandomEvent";
import { ResearchStuff } from "./ResearchStuff";
import { Stuff2 } from "./Stuff2";
import { SushiStuff } from "./SushiStuff";
import { Summoning } from "./Summoning";
import { Thingies } from "./Thingies";

/**
 * N.js `_customBlock_Sailing(d, b, e)` @10690910: one function, a chain of named sub-cases. Only the
 * sub-cases (and, inside ArtifactBonus, the artifact indices) the Artifact Find port reaches.
 */
export const Sailing: (ctx: Ctx, d: string, b: number, e: number) => number = block("Sailing", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "ArtifactBonus":
      return artifactBonus(ctx, b, e);
    case "BoatArtiMulti":
      return boatArtiMulti(ctx, b);
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
  // N.js tests the raw element, `0==Sailing[3][l]` (loose): a null element is not 0, so it takes the base (and, being no tier,
  // no multiplier below). attr reads a null element as undefined. An index past the end of the list is a 0, not a null: the
  // game pads Sailing[3] with 0 up to 60 right after the load (@6437706, @6443117).
  const list = attr(ctx, "Sailing", 3);
  if (!Array.isArray(list)) throw new InvalidSaveValue("Sailing[3]", "an array", list);
  const cell = b < list.length ? attr(ctx, "Sailing", 3, b) : 0;
  const tier = asNumber(cell);
  let v = cell == 0 ? 0 : asNumber(info[3]);
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

/** `c.asNumber(Boats[b|0][0])`: the captain of boat `b`. The game indexes `Boats[b]` directly and would throw on a missing row; the cell is a c.asNumber (an absent one is 0). */
function boatCaptain(ctx: Ctx, b: number): number {
  listAt(ctx, "Boats", b | 0);
  return asNum(ctx, "Boats", b | 0, 0);
}

/**
 * `BoatArtiMulti` @10700072 for boat `b`, the Artifact Find the Skill Info shows (the page reads boat 0): one additive pool, then 23
 * factors, in N.js order and with N.js's parentheses, so the floats are the game's:
 *   max(1, (1 + pool / 100) x star sign 61 x ... x max(1, 1.02 ^ Spelunk[6].length x Super Bit 26)).
 * Every term is the call the game makes, with its literal arguments (the adapter in trackers/artifactFind.ts finds each one in the trace by
 * them). `DNSM.StarSigns["61"]` and `DNSM.AlchVials["6turtle"]` are the game's caches, ported as DNSM_StarSigns / DNSM_AlchVials;
 * `NONdummies[60]` is NONdummies60; `Boats[b|0][0]` is boatCaptain (a strict row, then the cell); `Spelunk[6].length` is a strict read (the game would throw without the list).
 */
function boatArtiMulti(ctx: Ctx, b: number): number {
  return Math.max(
    1,
    (1 +
      (Sailing(ctx, "ArtifactBonus", 3, 0) +
        (CaptBonusCalc(ctx, 3, boatCaptain(ctx, b)) +
          (Breeding(ctx, "ShinyBonusS", "Nah", 21, -1) +
            (20 * RandomEvent(ctx, "FractalIslandBonus", 3, 999) +
              (GetBribeBonus(ctx, "34") +
                (25 * Math.min(30, NONdummies60(ctx)) +
                  (ArcadeBonus(ctx, 32) +
                    ArcadeBonus(ctx, 66) +
                    (Holes(ctx, "B_UPG", 55, 0) +
                      (FarmingStuffs(ctx, "StickerBonus", 2, 99) +
                        (ResearchStuff(ctx, "Grid_Bonus", 109, 0) + Summoning(ctx, "VaultUpgBonus", 63, 0))))))))))) /
        100) *
      (1 + DNSM_StarSigns(ctx, "61") / 100) *
      (1 + FarmingStuffs(ctx, "StickerBonus", 2, 100) / 100) *
      MenagerieStuff(ctx, "NightmarinerBon", 0, 0) *
      Math.max(1, Math.min(2, 1 + 2 * Companions(ctx, 154)) + CompLV2(ctx, 154)) *
      Math.max(1, RandomEvent(ctx, "KillroyBonuses", 0, 0)) *
      (1 + Minehead(ctx, "Button_Bonuses", 3, 0) / 100) *
      (1 + ResearchStuff(ctx, "Grid_Bonus", 106, 0) / 100) *
      (1 + DNSM_AlchVials(ctx, "6turtle") / 100) *
      Math.max(1, Math.pow(1.5, Stuff2(ctx, "PurpleChestSlugsOwned", 0, 0))) *
      (1 + SushiStuff(ctx, "RoG_BonusQTY", 7, 0) / 100) *
      (1 + Summoning(ctx, "WinBonus", 3, 0) / 100) *
      (1 + JellyOperation(ctx, "RoG_BonusQTY", 19, 0) / 100) *
      Sailing(ctx, "DaveyJonesBonus", b, 0) *
      (1 + MainframeBonus(ctx, 14) / 100) *
      (1 + Thingies(ctx, "LoreEpiBon", 3, 0) / 100) *
      (1 + Ninja(ctx, "PristineBon", 2, 0) / 100) *
      (1 + Summoning(ctx, "VotingBonusz", 20, 0) / 100) *
      (1 + Companions(ctx, 43)) *
      Math.max(1, Companions(ctx, 56) / 5) *
      (1 + Holes(ctx, "MonumentROGbonuses", 1, 2) / 100) *
      (1 + FarmingStuffs(ctx, "ExoticBonusQTY", 45, 0) / 100) *
      (1 + GamingStatType(ctx, "PaletteBonus", 5, 0) / 100) *
      Math.max(1, Math.pow(1.02, listAt(ctx, "Spelunk", 6).length) * GamingStatType(ctx, "SuperBitType", 26, 0))
  );
}
