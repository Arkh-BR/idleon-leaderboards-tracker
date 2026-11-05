import { assumed, block } from "../ctx";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Dungon()` @7831096: which dungeon the player is in, from the map (`CurrentMap`, here `ctx.map`): 0 on the dungeon
 * lobbies 39, 70 and 118, 1 to 3 inside the dungeons 40, 71 and 119, else -1.
 *
 * Ruling Y (user decision 2026-11-05): on a dungeon map the Damage page shows the normal Max with a warning, as it did before, so a dungeon
 * map answers -1 under an `assumed:` leaf. Every dungeon branch reads this block (DamageDealed's head guard, PlayerHPmax / PlayerMPmax /
 * PlayerSpeedBonus, TotalStats' Dung items, GetTalentNumber's level 50, FoodBonuses, the lobby's buff list), so they all take the normal
 * path and none needs a stand-in of its own.
 * ponytail: engine-wide stand-in; a tracker that counts the dungeon run ports DungeonStat (@7831416) and drops it.
 */
export const Dungon = block("Dungon", (ctx) => {
  const d = 39 == ctx.map || 70 == ctx.map || 118 == ctx.map ? 0 : 40 == ctx.map ? 1 : 71 == ctx.map ? 2 : 119 == ctx.map ? 3 : -1;
  if (-1 == d) return d;
  return assumed(
    ctx,
    "Dungon()",
    "outside a dungeon (the dungeon run's own stats are not counted)",
    -1,
    `N.js Dungon() @7831096 is ${d} on map ${ctx.map}; the dungeon run's DungeonStat (@7831416) is not ported, so the normal stats are shown (Ruling Y)`
  );
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
