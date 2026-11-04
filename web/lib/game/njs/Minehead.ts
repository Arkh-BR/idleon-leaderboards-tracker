import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { NotPorted } from "../errors";
import { Companions } from "./Companions";
import { ResearchStuff } from "./ResearchStuff";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Minehead(d, b, e)` @11186658: one function, a chain of named sub-cases. Only the sub-cases the Artifact Find port
 * reaches (`GlimboTotalTrades` @11198303 is only reached from `Grid_Bonus` square 168 with `e == 2`, which throws NotPorted).
 */
export const Minehead: (ctx: Ctx, d: string, b: number, e: number) => number = block("Minehead", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    case "Button_Bonuses":
      return buttonBonuses(ctx, b);
    // @11204526: the bonus of one press on button slot b
    case "Button_BonusPerTime":
      return asNumber("2 3 2 2 4 5 4 25 5".split(" ")[b | 0]);
    // @11204610: what the companion 147 and the Research grid square 125 add to every press
    case "Button_BonusMULTI":
      return (1 + Companions(ctx, 147) / 100) * (1 + ResearchStuff(ctx, "Grid_Bonus", 125, 0) / 100);
    default:
      throw new NotPorted("Minehead", d);
  }
});

/**
 * `Button_Bonuses` @11204738: slot `b` of `DNSM.Button_Bonsuz`, a list of 9 the game fills on the first call (and when `e == -1`; here it
 * is built from the save each time). The account has pressed OptionsListAccount[594] times; press `f` belongs to slot
 * `floor(f / 5) mod 9` and adds `Button_BonusPerTime(slot) x Button_BonusMULTI`, one press at a time (a float sum, not a product).
 * The game calls the two helpers on every press; they are constants of the loop, so each is called once per slot here.
 *
 * The cache is per session, not per character: the game fills `Button_Bonsuz` once, with the Companions(0) gate (`Lv0[14] >= 2`, a
 * character's level) of whichever character asks first, rebuilds it only from the Minehead UI (the `Button_Bonuses(0, -1)` calls
 * @13189253, @13417222, @13417985, @13418698), and keeps it across a character switch (DNSM is only swapped around LocalSave
 * @6064029/@6068047 and cleared at logout @22164148). This replay models "the cache as built for the current character", so the game
 * shows this value only if the session's first Minehead read was on that character; for a character whose `Lv0[14]` is below 2 it can
 * differ from what another character's session shows. It is not a per-character term in the game.
 */
function buttonBonuses(ctx: Ctx, b: number): number {
  const slots: number[] = new Array(9).fill(0);
  const perPress: number[] = [];
  for (let f = 0, presses = asNum(ctx, "OptionsListAccount", 594) | 0; f < presses; f++) {
    const slot = Math.round(Math.floor(f / 5) - 9 * Math.floor(Math.floor(f / 5) / 9));
    perPress[slot] ??= Minehead(ctx, "Button_BonusPerTime", slot, 0) * Minehead(ctx, "Button_BonusMULTI", 0, 0);
    slots[slot] = asNumber(slots[slot]) + perPress[slot];
  }
  // the game answers undefined for a slot past the 9, which the caller would turn into NaN
  if (!(0 <= (b | 0) && (b | 0) < slots.length)) throw new RangeError(`Minehead Button_Bonuses: no button slot ${b}`);
  return slots[b | 0];
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { Button_Bonuses: true, Button_BonusPerTime: true, Button_BonusMULTI: true };
