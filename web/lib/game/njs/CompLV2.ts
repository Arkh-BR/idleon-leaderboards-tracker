import { asNumber } from "../attr";
import { block } from "../ctx";
import { DNSM_CompanionLVz } from "./DNSM";
import type { Ported } from "../ported";

/** N.js `_customBlock_CompLV2(d)` @10800363: 1 when companion `d` is at stage 2 (field 4 of its entry >= 1), else 0. */
export const CompLV2 = block("CompLV2", (ctx, d: number) => (1 <= asNumber(DNSM_CompanionLVz(ctx).get(`${d}`)) ? 1 : 0));

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
