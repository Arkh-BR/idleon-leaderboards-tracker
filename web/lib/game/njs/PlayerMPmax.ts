import { block } from "../ctx";
import { NotPorted } from "../errors";
import { CardBonusREAL } from "./CardBonusREAL";
import { DNSM_AlchBubbles, DNSM_BoxRewards } from "./DNSM";
import { Dungon } from "./Dungon";
import { GetTalentNumber } from "./GetTalentNumber";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { TotalStats } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_PlayerMPmax()` @4150047: the character's Max MP, the product of three entries (DN.PlayerMPmaxLIST): the base (10,
 * card 3, the BaseMP bubble and stamp, talent 1, total WIS and the post office's baseMP), the % (talents 452 and 272, the post office's
 * pctMP and card 29) and 1. In a dungeon it is DungeonStat("MP"), not ported.
 */
export const PlayerMPmax = block("PlayerMPmax", (ctx) => {
  if (-1 != Dungon(ctx)) throw new NotPorted("PlayerMPmax", "Dungon!=-1");
  const list = [
    10 + CardBonusREAL(ctx, 3) + DNSM_AlchBubbles(ctx, "BaseMP") + StampBonusOfTypeX(ctx, "BaseMP") + (GetTalentNumber(ctx, 1, 1) + (TotalStats(ctx, "WIS") + DNSM_BoxRewards(ctx, "baseMP"))),
    (1 + (GetTalentNumber(ctx, 1, 452) + GetTalentNumber(ctx, 1, 272)) / 100) * (1 + (DNSM_BoxRewards(ctx, "pctMP") + CardBonusREAL(ctx, 29)) / 100),
    1,
  ];
  return list[0] * list[1] * list[2];
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
