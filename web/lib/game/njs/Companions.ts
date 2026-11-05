import { asNum } from "../attr";
import { block } from "../ctx";
import { DNSM_CompanionBon } from "./DNSM";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Companions(d)` @10799980: companion `d`'s bonus, read from the DNSM.CompanionBon the
 * game fills at every map load (DNSM_CompanionBon): 0 when the account does not own it (or no token
 * activated it). Companion 0 also needs the character at level 2 (`Lv0[14]`), and 918 is always 0.
 */
export const Companions = block("Companions", (ctx, d: number) => {
  if (918 == d) return 0;
  const v = DNSM_CompanionBon(ctx).get(`${d}`);
  if (v === undefined) return 0;
  if (0 == d && 2 > asNum(ctx, "Lv0", 14)) return 0;
  return v;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
