import { block } from "../ctx";
import type { Ported } from "../ported";

/** N.js `_customBlock_Log2(a)` @4461077: ln(max(a, 1)) / ln 2. Below 1 it is 0 (not negative). */
export const Log2 = block("Log2", (_ctx, a: number) => Math.log(Math.max(a, 1)) / Math.log(2));

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
