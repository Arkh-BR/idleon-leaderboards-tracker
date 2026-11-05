import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { PrayerInfo } from "../data";
import { listAt } from "../lists";
import { GamingStatType } from "./GamingStatType";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_prayersReal(d, b)` @7829537: prayer `d`'s bonus (`b` = 0) or curse (`b` = 1), PrayerInfo[d][3 + b] x max(1, 1 + (its
 * level PrayersUnlocked[d] - 1) / 10) rounded, while the character has it equipped (PrayersActive). With the Super Bit 9 or 39 and no
 * prayer equipped at all (DNSM.PrayNonEq), every unlocked prayer but 5 gives its bonus x .2 per Super Bit 9, 39 and 53, and no curse.
 * DNSM.PrayNonEq is built on the first call and kept for the session; here it is built for the current character.
 */
export const prayersReal = block("prayersReal", (ctx, d: number, b: number) => {
  const active = listAt(ctx, "PrayersActive"); // the game reads its length and indexOf
  let nonEq = 0; // DNSM.PrayNonEq: 1 when every slot is -1
  for (let g = 0; g < active.length; g++) {
    if (-1 == (active[g] as number)) {
      if (g == active.length - 1) nonEq = 1;
    } else break;
  }
  const info = (PrayerInfo as unknown as readonly (readonly unknown[])[])[d | 0];
  // the game indexes PrayerInfo[d][...] directly and would throw on a prayer it does not have
  if (!info) throw new RangeError(`prayersReal: no prayer ${d} in PrayerInfo`);
  const level = () => Math.max(1, 1 + (asNum(ctx, "PrayersUnlocked", d | 0) - 1) / 10);
  const bit = (n: number) => GamingStatType(ctx, "SuperBitType", n, 0);
  if ((1 != bit(9) && 1 != bit(39)) || 1 != nonEq) return -1 != active.indexOf(d) ? Math.round(asNumber(info[(3 + b) | 0]) * level()) : 0;
  return 5 != d && 1 != b && 0.5 < asNum(ctx, "PrayersUnlocked", d | 0) ? Math.round((0.2 * bit(9) + (0.2 * bit(39) + 0.2 * bit(53))) * asNumber(info[3]) * level()) : 0;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
