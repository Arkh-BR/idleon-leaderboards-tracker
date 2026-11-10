import { block } from "../ctx";
import { NotPorted } from "../errors";
import { getbonus2 } from "./getbonus2";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_TalentEnh(d)` @10797675: DNSM.TalENHNC[d], 0 when absent. TalentEnh(-1) (from TalentCalc(-9) @4515107) rebuilds the map from the account's
 * best talent 49 (getbonus2(1,49,-1)); 43 is 1 from 175 on (@10798746). The game reads the map as last rebuilt; here it is worked out from the save. Only 43.
 */
export const TalentEnh = block("TalentEnh", (ctx, d: number) => {
  if (43 != d) throw new NotPorted("TalentEnh", `d=${d}`);
  return 175 <= getbonus2(ctx, 1, 49, -1) ? 1 : 0;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [43];
