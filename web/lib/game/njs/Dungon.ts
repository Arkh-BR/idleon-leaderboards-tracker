import { block } from "../ctx";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Dungon()` @7831096: which dungeon the player is in, from the map (`CurrentMap`, here `ctx.map`): 0 on the dungeon
 * lobbies 39, 70 and 118, 1 to 3 inside the dungeons 40, 71 and 119, else -1.
 */
export const Dungon = block("Dungon", (ctx) =>
  39 == ctx.map || 70 == ctx.map || 118 == ctx.map ? 0 : 40 == ctx.map ? 1 : 71 == ctx.map ? 2 : 119 == ctx.map ? 3 : -1
);

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
