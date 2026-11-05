import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { SaltLicks } from "../data";
import type { Ported } from "../ported";

/** N.js `_customBlock_SaltLick(d)` @7829254: Salt Lick upgrade `d`, its level SaltLick[d] times its value SaltLicks[d][3], when the level is above 0. */
export const SaltLick = block("SaltLick", (ctx, d: number) => {
  if (!(0 < asNum(ctx, "SaltLick", d | 0))) return 0;
  const row = (SaltLicks as unknown as readonly (readonly unknown[])[])[d | 0];
  // the game indexes SaltLicks[d][3] directly and would throw on an upgrade it does not have
  if (!row) throw new RangeError(`SaltLick: no upgrade ${d} in SaltLicks`);
  return asNum(ctx, "SaltLick", d | 0) * asNumber(row[3]);
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
