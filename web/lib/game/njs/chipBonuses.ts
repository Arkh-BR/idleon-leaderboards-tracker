import { asNum, asNumber, attr } from "../attr";
import { block } from "../ctx";
import { ChipDesc } from "../data";
import { hString } from "../hstring";
import { listAt } from "../lists";

/**
 * N.js `_customBlock_chipBonuses(d)` @5163283: `DNSM.ChipBbonusz[d]`, the sum of the chip bonus of the equipped chips whose kind is `d`
 * (0 when none is). The map is not in the save: the game rebuilds it for the current player when the player is not the one it was last
 * built for (ActionBlock `RecalcChipBonuses` @7956839): a new map, then for each of the 7 slots of Lab[1 + player] that is not -1
 * (`-1 != slot`, loose), `ChipBbonusz[ChipDesc[slot][10]] += ChipDesc[slot][11]`. Here it is built each time, for the key asked.
 * The Lab and the chip kinds are the account's, so the key and the slots are all there is to read.
 */
export const chipBonuses = block("chipBonuses", (ctx, d: string) => {
  const slots = 1 + ctx.player;
  listAt(ctx, "Lab", slots); // the game indexes Lab[1 + player][slot] directly
  let total: number | undefined; // ChipBbonusz[d]: absent until a chip of this kind is added
  for (let h = 0; h < 7; h++) {
    if (-1 == attr(ctx, "Lab", slots, h)) continue; // the raw slot, loosely: a null or absent one is not empty
    const index = asNum(ctx, "Lab", slots, h) | 0; // `ChipDesc[c.asNumber(Lab[1 + p][H]) | 0]`: an absent slot reads chip 0, with an (absent) leaf
    const chip = (ChipDesc as unknown as readonly (readonly unknown[])[])[index];
    // the game indexes ChipDesc[slot][10] directly and would throw on a chip it does not have
    if (!chip) throw new RangeError(`chipBonuses: no chip ${index} in ChipDesc`);
    if (hString(chip[10]) === d) total = asNumber(total) + asNumber(chip[11]);
  }
  return asNumber(total);
});
