import { asNumber, attr } from "../attr";
import { block } from "../ctx";
import { NjEQ } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";

/** N.js `_customBlock_Ninja(d, b, e)` @10844735. Only the sub-cases the Artifact Find port reaches. */
export const Ninja = block("Ninja", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
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
