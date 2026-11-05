import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { Spelunky } from "../data";
import { NotPorted } from "../errors";
import { Companions } from "./Companions";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Bubbastuff(d, b, e)` @11153625..11163213: one function, a chain of named sub-cases. Only the sub-cases Damage and
 * the stats reach (Ruling C): the Bubba Return-on-Gift bonus and the megaflesh milestones it adds up.
 */
export const Bubbastuff: (ctx: Ctx, d: string, b: number, e: number) => number = block("Bubbastuff", (ctx, d: string, b: number, _e: number) => {
  switch (d) {
    // @11162595: the megaflesh milestones owned (1, 3, 6, 9 and every one past 11, 20% each: DNSM.Bubba_RoG_all) lift Spelunky[33][b] times the
    // tiers Bubba[1][3] gives this slot (one more every 7 levels from b - 1).
    case "BubbaRoG_Bonuses": {
      const all = 20 * Bubbastuff(ctx, "MegafleshOwned", 1, 0) + (20 * Bubbastuff(ctx, "MegafleshOwned", 3, 0) + (20 * Bubbastuff(ctx, "MegafleshOwned", 6, 0) + (20 * Bubbastuff(ctx, "MegafleshOwned", 9, 0) + 20 * Bubbastuff(ctx, "MegafleshOwned", 11, 0))));
      const row = (Spelunky as unknown as readonly (readonly unknown[])[])[33];
      // the game indexes Spelunky[33][round(b)] directly
      if (!row || !(Math.round(b) in row)) throw new RangeError(`Bubbastuff BubbaRoG_Bonuses: no slot ${b} in Spelunky[33]`);
      return Math.max(0, (1 + all / 100) * (1 + Companions(ctx, 51)) * asNumber(row[Math.round(b)]) * Math.ceil((asNum(ctx, "Bubba", 1, 3) - (b - 1)) / 7));
    }
    // @11163213: milestone b is owned when Bubba[1][8] is past it; the 11th counts each one past it
    case "MegafleshOwned":
      return asNum(ctx, "Bubba", 1, 8) > b ? (11 == b ? asNum(ctx, "Bubba", 1, 8) - 11 : 1) : 0;
    default:
      throw new NotPorted("Bubbastuff", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { BubbaRoG_Bonuses: true, MegafleshOwned: true };
