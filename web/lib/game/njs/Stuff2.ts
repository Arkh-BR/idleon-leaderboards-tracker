import { asNum, attr } from "../attr";
import { assumed, block, type Ctx } from "../ctx";
import { CardStuff } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { Companions } from "./Companions";
import { Summoning } from "./Summoning";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/** N.js `_customBlock_Stuff2(d, b, e)` @10982106. Only the sub-cases the Artifact Find port and Coin reach. */
export const Stuff2 = block("Stuff2", (ctx, d: string, _b: number, _e: number) => {
  switch (d) {
    // @10989439: the Purple Chest Slugs are Event Shop item 48
    case "PurpleChestSlugsOwned":
      return Math.round(Summoning(ctx, "EventShopOwned", 48, 0));
    // @10990303: the golden cape vines, 1 + OptionsListAccount[669] + 3 with the Bundle ban_o
    case "GoldCapeVinesOwned":
      return Math.round(1 + (asNum(ctx, "OptionsListAccount", 669) + 3 * Thingies(ctx, "Have_ban_o", 0, 0)));
    // @10989192: 1 + Companion 38 (Balloonfish)
    case "CoinDropMulti":
      return 1 + Companions(ctx, 38);
    case "CardsCollected":
      return cardsCollected(ctx);
    default:
      throw new NotPorted("Stuff2", d);
  }
});

/**
 * `CardsCollected` @10982933, `DNSM.UnqCardzCol`: the rows of CardStuff (not "Blank") the account has at least one of (Cards[0][name] >= 1). The game
 * counts it on the first call of the session and again only when the card codex opens (`Stuff2("CardsCollected", -1, 0)` @12534191); here it is counted
 * from the save, stated as an assumption.
 */
function cardsCollected(ctx: Ctx): number {
  let n = 0;
  for (const group of CardStuff as unknown as readonly (readonly (readonly unknown[])[])[]) {
    for (const row of group) {
      if ("Blank" == row[0] || attr(ctx, "Cards", 0, hString(row[0])) === undefined) continue; // Object.prototype.hasOwnProperty.call(Cards[0].h, name)
      if (1 <= asNum(ctx, "Cards", 0, hString(row[0]))) n = Math.round(n + 1);
    }
  }
  return assumed(ctx, "DNSM.UnqCardzCol", "cards collected, counted from the save (the game counts them once a session and when the card codex opens)", n, "Stuff2 CardsCollected @10982933 fills DNSM.UnqCardzCol on its first call, and on the codex's -1 call @12534191; a card found since is not in the game's count until then");
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { PurpleChestSlugsOwned: true, GoldCapeVinesOwned: true, CoinDropMulti: true, CardsCollected: true };
