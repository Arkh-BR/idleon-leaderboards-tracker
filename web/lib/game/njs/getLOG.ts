import { block } from "../ctx";

/**
 * N.js `_customBlock_getLOG(a)` @4461003: ln(max(a, 1)) / 2.30259. The game's constant is a hair above ln 10, so the log of an exact
 * power of ten is a hair under its exponent and `Math.floor` of it is one below (floor(getLOG(1000)) is 2). Ported as it is.
 */
export const getLOG = block("getLOG", (_ctx, a: number) => Math.log(Math.max(a, 1)) / 2.30259);
