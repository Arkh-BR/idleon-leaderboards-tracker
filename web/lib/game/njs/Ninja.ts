import { asNum, asNumber, attr } from "../attr";
import { block } from "../ctx";
import { NinjaInfo, NjEQ, Number2Letter } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/** N.js `_customBlock_Ninja(d, b, e)` @10844735. Only the sub-cases the Artifact Find port reaches. */
export const Ninja = block("Ninja", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @10844773: the floors unlocked, min(12, the Summoning actor's GenINFO[87]) (ActorEvents_623): its create starts it at 1 and, @11705691,
    // makes it min(12, f + 2) for each door f of NinjaInfo[3] whose HP is gone (DoorMaxHP(f) - Ninja[100][f] <= 0), the last one winning.
    // A door broken while the game runs adds 1 to it (@11422165), which the save holds as the door's damage at the next create
    case "FloorsUnlocked": {
      listAt(ctx, "Ninja", 100); // the game indexes Ninja[100][f] directly
      let floor = 1; // GenINFO[87]
      for (let f = 0, n = (NinjaInfo as unknown as readonly (readonly unknown[])[])[3].length; f < n; f++) {
        if (0 >= Ninja(ctx, "DoorMaxHP", f, 0) - asNum(ctx, "Ninja", 100, f)) floor = Math.min(12, f + 2);
      }
      return Math.min(12, floor);
    }
    // @10852439: door b's HP, NinjaInfo[3][b], or 0 while OptionsListAccount[231] is below [232]
    case "DoorMaxHP":
      return asNum(ctx, "OptionsListAccount", 231) < asNum(ctx, "OptionsListAccount", 232) ? 0 : asNumber((NinjaInfo as unknown as readonly (readonly unknown[])[])[3][b | 0]);
    // @10845956: Emporium item b is owned when its letter (Number2Letter[b]) is in Ninja[102][9]
    case "EmporiumBonus":
      listAt(ctx, "Ninja", 102); // the game indexes Ninja[102][9] directly
      return -1 != hString(attr(ctx, "Ninja", 102, 9)).indexOf(hString(Number2Letter[b | 0])) ? 1 : 0;
    // @10871214: Pristine Charm b: its bonus (NjTrP<b>[3]) once the charm is found (Ninja[107][b] == 1), else 0
    case "PristineBon": {
      listAt(ctx, "Ninja", 107); // the game indexes Ninja[107][b] directly
      if (1 != attr(ctx, "Ninja", 107, b | 0)) return 0;
      const charm = (NjEQ as Record<string, readonly unknown[]>)[`NjTrP${b}`];
      // the game indexes NjEQ["NjTrP" + b][3] directly and would throw on a charm it does not have
      if (!charm) throw new RangeError(`Ninja PristineBon: no charm NjTrP${b} in NjEQ`);
      return asNumber(charm[3]);
    }
    default:
      throw new NotPorted("Ninja", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { EmporiumBonus: true, PristineBon: true, FloorsUnlocked: true, DoorMaxHP: true };
