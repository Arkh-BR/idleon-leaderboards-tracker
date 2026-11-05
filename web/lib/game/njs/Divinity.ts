import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { GodsInfo } from "../data";
import { NotPorted } from "../errors";
import { skillLevel } from "../player";
import { Companions } from "./Companions";
import { DNSM_AlchBubbles } from "./DNSM";
import { Holes } from "./Holes";
import { Ninja } from "./Ninja";
import { ResearchStuff } from "./ResearchStuff";
import { Thingies } from "./Thingies";
import { withPlayer } from "../ctx";
import type { Ported } from "../ported";

const god = (g: number): readonly unknown[] => {
  const row = (GodsInfo as unknown as readonly (readonly unknown[])[])[g | 0];
  // the game indexes GodsInfo[g][...] directly and would throw on a god it does not have
  if (!row) throw new RangeError(`Divinity: no god ${g} in GodsInfo`);
  return row;
};

/**
 * N.js `_customBlock_Divinity(d, b, e)` @10756776: one function, a chain of named sub-cases. Only the sub-cases the character stats reach.
 * Both open with a Tutorial-scene guard (`return 0`); a tracked account is in the world, so it is not modelled.
 */
export const Divinity: (ctx: Ctx, d: string, b: number, e: number) => number = block("Divinity", (ctx, d: string, b: number, e: number) => {
  switch (d) {
    case "Bonus_Minor":
      return bonusMinor(ctx, b, e);
    case "DivMinorBonus":
      return divMinorBonus(ctx, b, e);
    // @10758317: god b's blessing, Divinity[28 + b] x GodsInfo[b][14] x (1 + .05 x Emporium 33 x max(0, Divinity[25] - 10)); b == 2 has a rule
    // of its own (SkillStats AllEfficiencies) that is not ported
    case "BlesssBonus":
      if (2 == b) throw new NotPorted("Divinity", "BlesssBonus:b=2");
      return asNum(ctx, "Divinity", (28 + b) | 0) * asNumber(god(b)[14]) * (1 + 0.05 * Ninja(ctx, "EmporiumBonus", 33, 0) * Math.max(0, asNum(ctx, "Divinity", 25) - 10));
    default:
      throw new NotPorted("Divinity", d);
  }
});

/**
 * `Bonus_Minor` @10761439 for character `b` and the minor bonus kind `e` (GodsInfo[g][13]; `BminorDivQdl` lists the 10 gods' kinds).
 * Every god's minor bonus counts with Companion 0, the pocket god of that kind (Holes), the Research square 173 for kind 2, or the gem shop
 * item 9 for kind 0: then the god whose kind is `e` (the first, `indexOf`). Else the god the character is linked to (Divinity[b + 12])
 * when its kind is `e`, or the god of the Divinity talent 505 (its level's last digit) when that god is unlocked (below Divinity[25]).
 * The `b == -1` total over every character is not ported.
 */
function bonusMinor(ctx: Ctx, b: number, e: number): number {
  if (-1 == b) throw new NotPorted("Divinity", "Bonus_Minor:b=-1");
  const kinds = Array.from({ length: 10 }, (_, f) => asNumber(god(f)[13])); // DNSM.BminorDivQdl
  if (
    1 == Companions(ctx, 0) ||
    1 == Holes(ctx, "PocketDivOwned", e, 0) ||
    (1 <= ResearchStuff(ctx, "Grid_Bonus", 173, 0) && 2 == e) ||
    (1 == attr(ctx, "GemItemsPurchased", 9) && 0 == e)
  )
    return Divinity(ctx, "DivMinorBonus", b, kinds.indexOf(e));
  if (-1 == attr(ctx, "Divinity", (b + 12) | 0)) return 0;
  const linked = asNum(ctx, "Divinity", (b + 12) | 0);
  if (asNumber(god(linked)[13]) == e) return Divinity(ctx, "DivMinorBonus", b, linked);
  const t505 = skillLevel(ctx, 505, b | 0);
  const g505 = t505 - 10 * Math.floor(t505 / 10);
  if (0 < t505 && asNumber(god(g505)[13]) == e && asNum(ctx, "Divinity", 25) > g505) return Divinity(ctx, "DivMinorBonus", b, g505);
  return 0;
}

/**
 * `DivMinorBonus` @10764659: god `e`'s minor bonus for character `b`: max(1, the Big P bubble Y2ACTIVE) x (1 + the Coral Kid upgrade 3 / 100)
 * x lv / (60 + lv) x GodsInfo[GodsInfo[e][13]][3], lv = the character's Lv0[14] (its Divinity level). The bubble is the current player's.
 */
function divMinorBonus(ctx: Ctx, b: number, e: number): number {
  const bubble = Math.max(1, DNSM_AlchBubbles(ctx, "Y2ACTIVE"));
  const value = asNumber(god(asNumber(god(e)[13]))[3]);
  if (ctx.player == b) {
    const lv = asNum(ctx, "Lv0", 14);
    return bubble * (((1 + Thingies(ctx, "CoralKidUpgBonus", 3, 0) / 100) * lv) / (60 + lv)) * value;
  }
  const lv = asNum(withPlayer(ctx, b | 0), "Lv0", 14);
  const l = (1 + Thingies(ctx, "CoralKidUpgBonus", 3, 0) / 100) * lv;
  return bubble * (l / (60 + lv)) * value;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { Bonus_Minor: true, DivMinorBonus: true, BlesssBonus: [0, 1, 3, 4, 5, 6, 7, 8, 9] };
