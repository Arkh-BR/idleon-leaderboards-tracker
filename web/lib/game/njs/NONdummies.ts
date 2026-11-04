// NONdummies is the game's scratch list for things it counts once, when a map loads. It is not in the
// save (Ruling A), so each slot the port reads is a function that replays the loading code.
import { attr } from "../attr";
import { block } from "../ctx";
import { InvalidSaveValue } from "../errors";

/**
 * NONdummies[60] @10634225: how many of the first 30 captains are of type 6. The game counts them in the
 * code that runs when a map loads with `200 == CurrentMap` (the W5 town, `runLater(20)` @10624152) and
 * keeps the number for the session, so Skill Info only has the term once someone has been in that town.
 * The tracker counts it always (user decision of 2026-11-03: the readings 160Q before the town, 167Q after).
 */
export const NONdummies60 = block("NONdummies.60", (ctx) => {
  const captains = attr(ctx, "Captains");
  if (!Array.isArray(captains)) throw new InvalidSaveValue("Captains", "an array", captains);
  let n = 0;
  for (let g = 0, end = Math.min(30, captains.length) | 0; g < end; g++) {
    if (attr(ctx, "Captains", g, 0) == 6) n++; // N.js `6==Captains[g][0]`: loose equality
  }
  return n;
});
