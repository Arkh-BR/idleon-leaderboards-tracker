import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { ShrineInfo } from "../data";
import { listAt } from "../lists";
import { MainframeBonus } from "./MainframeBonus";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Sailing } from "./Sailing";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Shrine(d)` @7828132: shrine `d`'s bonus, from `DNSM.ShrineStuffz723`, the list the game builds at the map load (and
 * with `d == -1`; the call that builds it answers 0, the later ones the list). A shrine counts on the map it stands on (ShrineInfo[b][0]),
 * on any map of its world with the lab bonus 5, or anywhere with Artifact 0; and only from level 1 (ShrineInfo[b][3] > .5): (1 + 5 x the
 * Boss3B card level / 100) x ((level - 1) x the per-level value + the base). The map is `ctx.map`. The PlayerSelect scene answers 0, which a
 * tracked account is not on.
 */
export const Shrine = block("Shrine", (ctx, d: number) => {
  const b = d | 0;
  listAt(ctx, "ShrineInfo", b); // the game indexes ShrineInfo[b][0] and [3] directly
  const row = (ShrineInfo as unknown as readonly (readonly unknown[])[])[b];
  // the game reads ShrineStuffz723[d], one of 9, and would answer undefined past them
  if (!row || !(b < 9)) throw new RangeError(`Shrine: no shrine ${d}`);
  const at = asNum(ctx, "ShrineInfo", b, 0);
  const here = 1 <= Sailing(ctx, "ArtifactBonus", 0, 0) || ctx.map == at || (1 == MainframeBonus(ctx, 5) && Math.floor(ctx.map / 50) == Math.floor(at / 50));
  if (!(here && 0.5 < asNum(ctx, "ShrineInfo", b, 3))) return 0;
  return (1 + (5 * RunCodeOfTypeXforThingY(ctx, "CardLv", "Boss3B")) / 100) * ((asNum(ctx, "ShrineInfo", b, 3) - 1) * asNumber(row[3]) + asNumber(row[2]));
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
