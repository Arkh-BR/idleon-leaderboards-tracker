import { asNum } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import type { Ported } from "../ported";

/** N.js `_customBlock_Spelunk(d, b, e)` @11099923. Only the sub-cases the Artifact Find port reaches. */
export const Spelunk = block("Spelunk", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @11100719: lore note b of the first Spelunking list is found (Spelunk[0][b] >= 1)
    case "DoWeHaveLoreN1":
      listAt(ctx, "Spelunk", 0); // the game indexes Spelunk[0][b] directly
      return 1 <= asNum(ctx, "Spelunk", 0, b | 0) ? 1 : 0;
    // @11100450: the sixth card star, from the third lore note (Spelunk[0][2] >= 1)
    case "6starCards":
      listAt(ctx, "Spelunk", 0); // the game indexes Spelunk[0][2] directly
      return 1 <= asNum(ctx, "Spelunk", 0, 2) ? 1 : 0;
    default:
      throw new NotPorted("Spelunk", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { DoWeHaveLoreN1: true, "6starCards": true };
