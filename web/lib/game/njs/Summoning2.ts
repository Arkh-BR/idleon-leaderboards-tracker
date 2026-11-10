import { asNum, asNumber, attr } from "../attr";
import { block, runtime, withPlayer, type Ctx } from "../ctx";
import { NinjaInfo, RandoListo2 } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { listAt } from "../lists";
import { playerCount } from "../player";
import { ArcaneType } from "./ArcaneType";
import { Windwalker } from "./Windwalker";
import { ArcadeBonus } from "./ArcadeBonus";
import { Companions } from "./Companions";
import { DNSM_AlchVials } from "./DNSM";
import { GamingStatType } from "./GamingStatType";
import { getLOG } from "./getLOG";
import { Holes } from "./Holes";
import { Holes2 } from "./Holes2";
import { JellyOperation } from "./JellyOperation";
import { MenagerieStuff } from "./MenagerieStuff";
import { ResearchStuff } from "./ResearchStuff";
import { SaltLick } from "./SaltLick";
import { SushiStuff } from "./SushiStuff";
import { Summoning } from "./Summoning";
import { Thingies } from "./Thingies";

/**
 * N.js `_customBlock_Summoning2(d, b, e)` @10931969: where `Summoning` hands every name it does not answer itself. Only the
 * sub-cases the Artifact Find port reaches. The scene gates the game has in `MeritocBonusz` and `VotingBonusz`
 * (`"GemShop"==getCurrentSceneName()`, the Tutorial and the character-select scene) are not modelled: the scene is the running
 * game's, and a tracked account is in the world.
 */
export const Summoning2: (ctx: Ctx, d: string, b: number, e: number) => number = block("Summoning2", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "ExpRateCook":
      return expRateCook(ctx);
    case "BonusAmountcook":
      return bonusAmountCook(ctx, b, e);
    case "MeritocBonusz":
      return meritocBonusz(ctx, b);
    case "MeritocCanVote":
      return 1 == attr(ctx, "OptionsListAccount", 472) ? 1 : 0; // @10932364
    case "MeritocBonuszMulti":
      return meritocBonuszMulti(ctx);
    case "VotingBonusz":
      return votingBonusz(ctx, b);
    case "VotingBonuszMulti":
      return votingBonuszMulti(ctx);
    // @10948857: Owl megafeather b is owned while OptionsListAccount[262] is past b; the ninth counts every one from 9 on
    case "OwlMegafeather":
      return asNum(ctx, "OptionsListAccount", 262) > b ? (9 == b ? asNum(ctx, "OptionsListAccount", 262) - 9 : 1) : 0;
    case "OwlBonuses":
      return owlBonuses(ctx, b);
    // @10935349: Cook Master meal b's multiplier, 1 + its level / (level + 5)
    case "BonusMultiCook": {
      listAt(ctx, "CookMaster", 0); // the game indexes CookMaster[0][b] directly
      const lv = asNum(ctx, "CookMaster", 0, b | 0);
      return 1 + (100 * lv) / (lv + 5) / 100;
    }
    default:
      throw new NotPorted("Summoning2", d);
  }
});

/** `ExpRateCook` @10934618: Cooking Mastery Exp/h. The factors in the game's order. */
function expRateCook(ctx: Ctx): number {
  return (
    2 *
    (1 + Summoning2(ctx, "BonusAmountcook", 0, 99) / 100) *
    (1 + Summoning2(ctx, "BonusAmountcook", 1, 99) / 100) *
    (1 + Summoning2(ctx, "BonusAmountcook", 2, 99) / 100) *
    (1 + MenagerieStuff(ctx, "BoostQTY", 21, 0) / 100) *
    (1 + Summoning2(ctx, "BonusAmountcook", 4, 99) / 100) *
    (1 + ResearchStuff(ctx, "Grid_Bonus", 190, 0) / 100) *
    (1 + (40 * GamingStatType(ctx, "SuperBitType", 68, 0)) / 100) *
    (1 + Summoning2(ctx, "BonusAmountcook", 5, 99) / 100) *
    (1 + 2 * Companions(ctx, 87)) *
    (1 + Holes2(ctx, "Fountain_BonTOT", 2, 17) / 100) *
    (1 + (DNSM_AlchVials(ctx, "7cookmastery") + (ArcadeBonus(ctx, 69) + SaltLick(ctx, 10))) / 100)
  );
}

/**
 * `BonusAmountcook` @10935566: with `e == 99` upgrade b's bonus, its per-point value times what it scales with; otherwise that per-point value,
 * RandoListo2[8][b] x CookMaster[2][b]. The two totals are the game's `DNSM.CkMst_AcLvT` and `CkMst_RbLvT`, filled once per session and built
 * here from the save.
 */
function bonusAmountCook(ctx: Ctx, b: number, e: number): number {
  if (99 != e) {
    listAt(ctx, "CookMaster", 2); // the game indexes CookMaster[2][b] directly
    return asNumber((RandoListo2 as unknown as readonly (readonly unknown[])[])[8][b | 0]) * asNum(ctx, "CookMaster", 2, b | 0);
  }
  const perPoint = Summoning2(ctx, "BonusAmountcook", b, 0);
  if (0 == b) return getLOG(ctx, asNum(ctx, "CookMaster", 1, 3)) * perPoint;
  if (1 == b) {
    let levels = 0;
    for (let c = 0, n = playerCount(ctx); c < n; c++) levels += asNum(withPlayer(ctx, c), "Lv0", 10);
    return Math.max(0, levels - 1e3) * perPoint;
  }
  if (2 == b) return Math.max(0, asNum(ctx, "Meals", 0, 73) - 75) * perPoint;
  if (3 == b) return 250 * (perPoint / (25 + perPoint));
  if (4 == b) {
    let ranks = 0;
    for (let f = 0, n = listAt(ctx, "Ribbon").length - 28; f < n; f++) ranks += asNum(ctx, "Ribbon", 28 + f);
    return ranks * perPoint;
  }
  return (asNum(ctx, "CookMaster", 1, 0) + 1) * perPoint;
}

/** `DNSM.OwlBonus`'s six bonuses: base value and position in the cycle of OptionsListAccount[255] upgrades (@10950288). */
const OWL = [5, 10, 2, 4, 1, 2];

/**
 * `OwlBonuses` @10950288: Owl bonus `b` of `DNSM.OwlBonus`, a list the game fills on the first call (and when `b == -1`; here it is built
 * from the save each time). Bonus i is OWL[i] x (1 + legend talent 26 / 100) x (1 + Companion 51) x (1 + the megafeathers' total / 100)
 * x max(0, ceil((OptionsListAccount[255] - i) / 6)), the total 100 each for megafeathers 1, 3, 5, 7, 100 for the first of the ninth and 50
 * for each one past it. `b == -1` answers 0 (the rebuild).
 */
function owlBonuses(ctx: Ctx, b: number): number {
  if (-1 == b) return 0;
  const all = // DNSM.OwlBonusAll
    100 * Summoning(ctx, "OwlMegafeather", 1, 0) +
    (100 * Summoning(ctx, "OwlMegafeather", 3, 0) +
      (100 * Summoning(ctx, "OwlMegafeather", 5, 0) +
        (100 * Summoning(ctx, "OwlMegafeather", 7, 0) + (100 * Math.min(1, Summoning(ctx, "OwlMegafeather", 9, 0)) + 50 * Math.max(0, Summoning(ctx, "OwlMegafeather", 9, 0) - 1)))));
  const i = b | 0;
  // the game answers undefined for a bonus past the six, which the caller would turn into NaN
  if (!(0 <= i && i < OWL.length)) throw new RangeError(`Summoning2 OwlBonuses: no Owl bonus ${b}`);
  const upgrades = asNum(ctx, "OptionsListAccount", 255);
  return OWL[i] * (1 + Thingies(ctx, "LegendPTS_bonus", 26, 0) / 100) * (1 + Companions(ctx, 51)) * (1 + all / 100) * Math.max(0, Math.ceil((upgrades - i) / 6));
}

/** `MeritocBonusz` @10932012: Meritoc bonus `b` is NinjaInfo[41][1 + 3b] x the Meritoc multi while it is the one in force (OptionsListAccount[453] == b), else 0. */
function meritocBonusz(ctx: Ctx, b: number): number {
  return b == attr(ctx, "OptionsListAccount", 453) ? asNumber(NinjaInfo[41][Math.round(1 + 3 * b)]) * Summoning(ctx, "MeritocBonuszMulti", 0, 0) : 0;
}

/**
 * `MeritocBonuszMulti` @10932455: 0 until the character's kills left on map 250's portal (KillsLeft2Advance[250][0]) are used up; then
 * (1 + Companion 161 / 100) x (min(1, max(.25, .25 + MeritocCanVote)) + the boosts / 100). The boosts are written with N.js's own
 * precedence: `a + (…) / 100`, not `(a + …) / 100`.
 */
function meritocBonuszMulti(ctx: Ctx): number {
  listAt(ctx, "KillsLeft2Advance", 250); // the game indexes KillsLeft2Advance[250][0] directly
  if (!(0 >= asNum(ctx, "KillsLeft2Advance", 250, 0))) return 0;
  return (
    (1 + Companions(ctx, 161) / 100) *
    (Math.min(1, Math.max(0.25, 0.25 + Summoning2(ctx, "MeritocCanVote", 0, 0))) +
      (5 * Thingies(ctx, "ClamWorkBonus", 3, 0) +
        (Companions(ctx, 39) +
          (Thingies(ctx, "LegendPTS_bonus", 24, 0) +
            (ArcadeBonus(ctx, 59) +
              (20 * Summoning(ctx, "EventShopOwned", 23, 0) + (SushiStuff(ctx, "RoG_BonusQTY", 51, 0) + JellyOperation(ctx, "RoG_BonusQTY", 33, 0))))))) /
        100)
  );
}

/**
 * The vote in force, the game's `ActorEvents_670._GenINFO[36]` (PixelHelperActor[25]). No code changes it after the actor is
 * created (@12441129): it is `GenINFO[31][0]`, and GenINFO[31] starts as [1, 2, 3, 4] with the server's `voteCategories` laid over it
 * (@12439339). So the vote in force is the first of the server's `voteCategories`, or 1 when the server sent none.
 *
 * It is a server answer, not a save value: the envelope's `serverVars` is the capture of it. A null `serverVars` is no capture at
 * all: no vote is known to be in force, shown in the trace as not counted. A `serverVars` without `voteCategories` is refused.
 */
export function activeVote(ctx: Ctx): unknown {
  const vars = ctx.state.serverVars;
  if (vars === null) {
    runtime(ctx, "voteCategories", "envelope.serverVars is null: no server answer, so no vote is known to be in force");
    return undefined;
  }
  const list = vars.voteCategories;
  if (list === undefined) throw new MissingSaveKey("envelope.serverVars.voteCategories");
  if (!Array.isArray(list)) throw new InvalidSaveValue("envelope.serverVars.voteCategories", "an array", list);
  return list.length > 0 ? list[0] : 1;
}

/**
 * `VotingBonusz` @10953438: vote `b` is NinjaInfo[38][1 + 3b] x the voting multi while it is the vote in force, else 0. Vote 1 also counts
 * while the character has not reached the world the vote in force asks for: `worldsReached < NinjaInfo[38][2 + 3 max(1, vote)]`.
 */
function votingBonusz(ctx: Ctx, b: number): number {
  if (1 == b) {
    const vote = activeVote(ctx);
    if (vote === undefined) return 0; // no server answer: no vote is known to be in force (activeVote's runtime leaf says so)
    return 1 == vote || worldsReached(ctx) < asNumber(NinjaInfo[38][Math.round(2 + 3 * Math.max(1, asNumber(vote)))])
      ? asNumber(NinjaInfo[38][Math.round(1 + 3 * b)]) * Summoning(ctx, "VotingBonuszMulti", 0, 0)
      : 0;
  }
  return b == activeVote(ctx) ? asNumber(NinjaInfo[38][Math.round(1 + 3 * b)]) * Summoning(ctx, "VotingBonuszMulti", 0, 0) : 0;
}

/**
 * The portal actor's `ActorEvents_201._GenINFO[58]` (PixelHelperActor[3]), which its init sets (@5542319): 1, then 2..7 for each of the
 * town portals of maps 0, 50, 100, 150, 200 and 250 whose kills the current character has used up (KillsLeft2Advance[m][0] <= 0), the last
 * one that holds winning. Under the masterclass forms Compass Tempest and Tesseract Arcanist it reads Windwalker / ArcaneType
 * CanWeEnterPortal instead; the forms are not counted (the Damage page's product decision), shown as runtime leaves.
 */
function worldsReached(ctx: Ctx): number {
  if (1 == Windwalker(ctx, "CompassTempest", 0, 0)) throw new Error("unreachable");
  if (1 == ArcaneType(ctx, "TesseractArcanist", 0, 0)) throw new Error("unreachable");
  let worlds = 1;
  [0, 50, 100, 150, 200, 250].forEach((m, k) => {
    listAt(ctx, "KillsLeft2Advance", m); // the game indexes KillsLeft2Advance[m][0] directly
    if (0 >= asNum(ctx, "KillsLeft2Advance", m, 0)) worlds = k + 2;
  });
  return worlds;
}

/**
 * `VotingBonuszMulti` @10954376: (1 + Companion 161 / 100) x (1 + Meritoc 9 / 100) x (1 + the voting boosts / 100): Companions 41 and
 * 19, the Dream[13] bonus, Cosmo upgrade (2, 3), Winner Bonus 22, 17 per Event Shop item 7 and 13 per item 16, Palette 32, the
 * Spelunk legend talent 22 and Sushi 50.
 */
function votingBonuszMulti(ctx: Ctx): number {
  return (
    (1 + Companions(ctx, 161) / 100) *
    (1 + Summoning2(ctx, "MeritocBonusz", 9, 0) / 100) *
    (1 +
      (Companions(ctx, 41) +
        asNum(ctx, "Dream", 13) +
        (Holes(ctx, "CosmoBonusQTY", 2, 3) +
          (Summoning(ctx, "WinBonus", 22, 0) +
            (17 * Summoning(ctx, "EventShopOwned", 7, 0) +
              13 * Summoning(ctx, "EventShopOwned", 16, 0) +
              (Companions(ctx, 19) +
                (GamingStatType(ctx, "PaletteBonus", 32, 0) + (Thingies(ctx, "LegendPTS_bonus", 22, 0) + SushiStuff(ctx, "RoG_BonusQTY", 50, 0)))))))) /
        100)
  );
}

export { PORTED } from "../summoning2Ported";
