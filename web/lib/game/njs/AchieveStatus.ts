import { attr } from "../attr";
import { block } from "../ctx";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_AchieveStatus(c)` @7792603: what achievement `c` is worth once it is done (AchieveReg[c] is -1, loose): 5 for a few,
 * 10 for 108, 20 for 99, 104 and 112, else 1; 0 while it is not done.
 */
export const AchieveStatus = block("AchieveStatus", (ctx, c: number) =>
  -1 == attr(ctx, "AchieveReg", c | 0)
    ? 4 == c || 27 == c || 37 == c || 44 == c || 107 == c || 109 == c || 117 == c
      ? 5
      : 108 == c
        ? 10
        : 99 == c || 104 == c || 112 == c
          ? 20
          : 1
    : 0
);

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
