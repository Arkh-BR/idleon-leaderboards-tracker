import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { SigilDesc } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { Sailing } from "./Sailing";
import { Summoning2 } from "./Summoning2";
import type { Ported } from "../ported";

/** N.js `_customBlock_Labb(d, b, e, f)` @7978532: one function, a chain of named sub-cases. Only the sub-cases the character stats reach. */
export const Labb = block("Labb", (ctx, d: string, _b: string, e: number, _f: number) => {
  switch (d) {
    // @7986539: sigil e at its tier CauldronP2W[4][1 + 2e] (below -.1 none; then the values SigilDesc[e][3], [4], [8], [10], [12] for
    // the tiers 0..4), times 1 + Artifact 16 and 1 + Meritoc bonus 21 / 100. The Tutorial scene answers 50, which a tracked account is not on.
    case "SigilBonus": {
      const row = (SigilDesc as unknown as readonly (readonly unknown[])[])[e | 0];
      // the game indexes SigilDesc[e][...] directly and would throw on a sigil it does not have
      if (!row) throw new RangeError(`Labb SigilBonus: no sigil ${e} in SigilDesc`);
      listAt(ctx, "CauldronP2W", 4); // the game indexes CauldronP2W[4][1 + 2e] directly
      const tier = asNum(ctx, "CauldronP2W", 4, (1 + 2 * e) | 0);
      if (-0.1 > tier) return 0;
      const value = 0.5 > tier ? row[3] : 1.5 > tier ? row[4] : 2.5 > tier ? row[8] : 3.5 > tier ? row[10] : row[12];
      return asNumber(value) * (1 + Sailing(ctx, "ArtifactBonus", 16, 0)) * (1 + Summoning2(ctx, "MeritocBonusz", 21, 0) / 100);
    }
    // @7985612: the sigils at their purple tier (CauldronP2W[4][1 + 2d] >= 3) of the 24; the game counts them once per session
    case "TotalPurpleSigils": {
      listAt(ctx, "CauldronP2W", 4); // the game indexes CauldronP2W[4][1 + 2d] directly
      let n = 0; // DNSM.SigTotPup
      for (let f = 0; f < 24; f++) if (3 <= asNum(ctx, "CauldronP2W", 4, 1 + 2 * f)) n = Math.round(n + 1);
      return Math.round(n);
    }
    default:
      throw new NotPorted("Labb", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { SigilBonus: true, TotalPurpleSigils: true };
