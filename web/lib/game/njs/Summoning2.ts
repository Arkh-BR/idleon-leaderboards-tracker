import { asNum, asNumber, attr } from "../attr";
import { block, runtime, type Ctx } from "../ctx";
import { NinjaInfo } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { listAt } from "../lists";
import { ArcadeBonus } from "./ArcadeBonus";
import { Companions } from "./Companions";
import { GamingStatType } from "./GamingStatType";
import { Holes } from "./Holes";
import { JellyOperation } from "./JellyOperation";
import { SushiStuff } from "./SushiStuff";
import { Summoning } from "./Summoning";
import { Thingies } from "./Thingies";
import { range, type Ported } from "../ported";

/**
 * N.js `_customBlock_Summoning2(d, b, e)` @10931969: where `Summoning` hands every name it does not answer itself. Only the
 * sub-cases the Artifact Find port reaches. The scene gates the game has in `MeritocBonusz` and `VotingBonusz`
 * (`"GemShop"==getCurrentSceneName()`, the Tutorial and the character-select scene) are not modelled: the scene is the running
 * game's, and a tracked account is in the world.
 */
export const Summoning2: (ctx: Ctx, d: string, b: number, e: number) => number = block("Summoning2", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
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
    default:
      throw new NotPorted("Summoning2", d);
  }
});

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
function activeVote(ctx: Ctx): unknown {
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
 * `VotingBonusz` @10953438: vote `b` is NinjaInfo[38][1 + 3b] x the voting multi while it is the vote in force, else 0. Vote 1
 * has a rule of its own (it also counts while a character has not reached the world the vote in force asks for): NotPorted.
 */
function votingBonusz(ctx: Ctx, b: number): number {
  if (1 == b) throw new NotPorted("Summoning2", "VotingBonusz:b=1");
  return b == activeVote(ctx) ? asNumber(NinjaInfo[38][Math.round(1 + 3 * b)]) * Summoning(ctx, "VotingBonuszMulti", 0, 0) : 0;
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

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  MeritocBonusz: true,
  MeritocCanVote: true,
  MeritocBonuszMulti: true,
  VotingBonusz: [0, ...range(2, 40)], // not 1 (NotPorted); 40 is past the vote categories the game lists
  VotingBonuszMulti: true,
};
