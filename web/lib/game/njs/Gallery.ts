import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { chipBonuses } from "./chipBonuses";
import { CompLV2 } from "./CompLV2";
import { Companions } from "./Companions";
import { DNSM_AlchBubbles } from "./DNSM";
import { Minehead } from "./Minehead";
import { RandomEvent } from "./RandomEvent";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Stuff2 } from "./Stuff2";
import { Summoning } from "./Summoning";
import { SushiStuff } from "./SushiStuff";
import { Thingies } from "./Thingies";
import { itemDef } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_Gallery(d, b, e)` @11136034: one function, a chain of named sub-cases. Only the sub-cases the character stats reach.
 * The `Initialize…Bonuses` sub-cases build a DNSM cache once (or again with `b == -1`) and answer 1; the cache is `GalleryBonTOT` below.
 */
export const Gallery: (ctx: Ctx, d: string, b: number, e: number) => number = block("Gallery", (ctx, d: string, b: number, _e: number) => {
  const sailing = () => asNum(ctx, "Sailing", 3, 33);
  switch (d) {
    // @11136504
    case "PodiumsOwned_Lv2":
      return Math.round(
        2 * Thingies(ctx, "ClamWorkBonus", 0, 0) +
          (Math.min(2, RandomEvent(ctx, "KillroyBonuses", 3, 0)) +
            (Companions(ctx, 42) +
              Math.floor(asNum(ctx, "GemItemsPurchased", 40) / 2) +
              (Gallery(ctx, "PodiumsOwned_Lv3", 0, 0) +
                (Thingies(ctx, "LegendPTS_bonus", 9, 0) + Math.max(0, Math.min(2, Math.round(sailing()) - 2) - Math.min(1, Math.floor(sailing() / 5)))))))
      );
    // @11137042
    case "PodiumsOwned_Lv3":
      return Math.round(Math.floor(asNum(ctx, "GemItemsPurchased", 40) / 3) + Math.min(1, Math.floor(sailing() / 5)) + Gallery(ctx, "PodiumsOwned_Lv4", 0, 0));
    // @11137293
    case "PodiumsOwned_Lv4":
      return Math.round(
        Math.min(1, Companions(ctx, 28)) +
          Math.min(1, CompLV2(ctx, 28)) +
          (Summoning(ctx, "EventShopOwned", 29, 0) + (Math.min(1, Math.floor(sailing() / 6)) + (Math.min(1, Math.floor(sailing() / 7)) + Thingies(ctx, "Have_ban_m", 0, 0))))
      );
    // @11137679: the Gallery is open once the character has cleared map 250 (KillsLeft2Advance[250][0] <= 0)
    case "GalleryBonusSystemON":
      return 0 >= asNum(ctx, "KillsLeft2Advance", 250, 0) ? 1 : 0;
    // @11137789
    case "GalleryBonusMulti":
      return (
        1 +
        (3 * asNum(ctx, "Spelunk", 13, 4) +
          (10 * chipBonuses(ctx, "troph") +
            (3 * Thingies(ctx, "ClamWorkBonus", 7, 0) +
              (RandomEvent(ctx, "KillroyBonuses", 3, 0) +
                (Math.min(20, DNSM_AlchBubbles(ctx, "Y13")) +
                  (Math.min(RunCodeOfTypeXforThingY(ctx, "CardLv", "w7a11"), 10) + (Companions(ctx, 49) + SushiStuff(ctx, "RoG_BonusQTY", 54, 0)))))))) /
          100
      );
    // @11144304: the Hatrack, once map 50 is cleared
    case "PremHatBonusesSystemON":
      return 0 >= asNum(ctx, "KillsLeft2Advance", 50, 0) ? 1 : 0;
    // @11144415
    case "HatrackBonusMulti":
      return 1 + (listAt(ctx, "Spelunk", 46).length + (Companions(ctx, 31) + 10 * Summoning(ctx, "EventShopOwned", 30, 0) + (Minehead(ctx, "BonusQTY", 21, 0) + SushiStuff(ctx, "RoG_BonusQTY", 36, 0)))) / 100;
    // @11146686: the Cape Vine, once map 100 is cleared
    case "CapevineBonusesSystemON":
      return 0 >= asNum(ctx, "KillsLeft2Advance", 100, 0) ? 1 : 0;
    // @11146799: cape b counts whole when it is one of the golden vines (or b is 999), else a quarter
    case "CapevineBonusMulti": {
      const multi = 1 + (listAt(ctx, "Spelunk", 54).length + Companions(ctx, 105)) / 100;
      return Stuff2(ctx, "GoldCapeVinesOwned", 0, 0) > b || 999 == b ? multi : 0.25 * multi;
    }
    // @11138262, @11141627, @11144678, @11147071: build the cache when absent (or always, with b == -1: the Gallery UI's rebuild) and
    // answer 1. The cache here (GalleryBonTOT) is built from the save at every read, so both forms are the same
    case "InitializeTrophyBonuses":
    case "InitializeNametagBonuses":
    case "InitializePremHatBonuses":
    case "InitializeCapeBonuses":
      return 1;
    default:
      throw new NotPorted("Gallery", d);
  }
});

const STAT_LIST = "Weapon_Power,STR,AGI,WIS,LUK,Defence".split(","); // DNSM.GalleryDT

/** An item's two unique stats (when its UQ text is not "0") and its STAT_LIST stats, times `multi`, added into `map` (the caches' step). */
function addItem(map: Map<string, number>, item: Readonly<Record<string, unknown>>, multi: number, stats: Map<string, number> = map, statsFrom: ReadonlyMap<string, number> = map) {
  for (let b = 0; b < 2; b++) {
    const txt = item[`UQ${Math.round(b + 1)}txt`];
    if ("0" != txt) map.set(hString(txt), asNumber(map.get(hString(txt))) + multi * asNumber(item[`UQ${Math.round(b + 1)}val`]));
  }
  for (const s of STAT_LIST) stats.set(s, asNumber(statsFrom.get(s)) + multi * asNumber(item[s]));
}

/**
 * The four Gallery caches `TotalStats` reads, by stat name: `DNSM.GalleryTrophyBonTOT` (@11138262), `GalleryNametagBonTOT` (@11141627),
 * `PremHatBonTOT` (@11144678) and `CapeVineBonTOT` (@11147071). The game builds each once per session, the first time it is asked, and
 * keeps it across a character switch; its multipliers read the current player's chips and bubbles (GalleryBonusMulti), so this models the
 * cache as built for the current character (the God Shard set's precedent, GetSetBonus.ts).
 *  - Trophy: each trophy placed (Spelunk[16][e] >= 1, item "Trophy" + it) at 0.3 x GalleryBonusMulti, from slot 48 on at 1 / 1.5 / 2 / 2.5
 *    by the podium level (PodiumsOwned_Lv2..4 above the slot);
 *  - Nametag: each nametag (Spelunk[17][e] >= 1, item "EquipmentNametag" + e, "6b" for 6) at 1 / 1.6 / 2 / 2.3 / 2.5 by its level, times
 *    GalleryBonusMulti;
 *  - PremHat: each hat of the Hatrack (Spelunk[46]) times HatrackBonusMulti;
 *  - CapeVine: each cape of the vine (Spelunk[54]) times CapevineBonusMulti(e). Its stats step reads `PremHatBonTOT` where it means its
 *    own map (`g = PremHatBonTOT` @11147071): each cape sets STR (and the other STAT_LIST stats) to the Hatrack's total plus its own, and
 *    the last cape's stands. Ported as the game has it.
 */
export function GalleryBonTOT(ctx: Ctx, which: "Trophy" | "Nametag" | "PremHat" | "CapeVine"): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  switch (which) {
    case "Trophy": {
      const placed = listAt(ctx, "Spelunk", 16);
      for (let e = 0; e < placed.length; e++) {
        let multi = 0.3; // DNSM.GalleryDN2
        if (48 <= e)
          multi =
            Gallery(ctx, "PodiumsOwned_Lv4", 0, 0) > e - 48 ? 2.5 : Gallery(ctx, "PodiumsOwned_Lv3", 0, 0) > e - 48 ? 2 : Gallery(ctx, "PodiumsOwned_Lv2", 0, 0) > e - 48 ? 1.5 : 1;
        multi = multi * Gallery(ctx, "GalleryBonusMulti", 0, 0);
        if (1 <= asNum(ctx, "Spelunk", 16, e)) addItem(map, itemDef(`Trophy${Math.round(asNum(ctx, "Spelunk", 16, e))}`), multi);
      }
      return map;
    }
    case "Nametag": {
      const tags = listAt(ctx, "Spelunk", 17);
      for (let e = 0; e < tags.length; e++) {
        if (!(1 <= asNum(ctx, "Spelunk", 17, e))) continue;
        const multi = asNumber("1,1.6,2,2.3,2.5".split(",")[Math.min(4, Math.round(asNum(ctx, "Spelunk", 17, e) - 1)) | 0]) * Gallery(ctx, "GalleryBonusMulti", 0, 0);
        addItem(map, itemDef(6 == e ? "EquipmentNametag6b" : `EquipmentNametag${e}`), multi);
      }
      return map;
    }
    case "PremHat": {
      const hats = listAt(ctx, "Spelunk", 46);
      for (let e = 0; e < hats.length; e++) addItem(map, itemDef(hString(attr(ctx, "Spelunk", 46, e))), Gallery(ctx, "HatrackBonusMulti", 0, 0));
      return map;
    }
    case "CapeVine": {
      const capes = listAt(ctx, "Spelunk", 54);
      // the stats step reads PremHatBonTOT; the game would throw (null.h) were it never built, which the Hatrack is before the Cape Vine
      const hats = GalleryBonTOT(ctx, "PremHat");
      for (let e = 0; e < capes.length; e++) addItem(map, itemDef(hString(attr(ctx, "Spelunk", 54, e))), Gallery(ctx, "CapevineBonusMulti", e, 0), map, hats);
      return map;
    }
  }
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  PodiumsOwned_Lv2: true, PodiumsOwned_Lv3: true, PodiumsOwned_Lv4: true, GalleryBonusSystemON: true, GalleryBonusMulti: true,
  PremHatBonusesSystemON: true, HatrackBonusMulti: true, CapevineBonusesSystemON: true, CapevineBonusMulti: true,
  InitializeTrophyBonuses: true, InitializeNametagBonuses: true, InitializePremHatBonuses: true, InitializeCapeBonuses: true,
};
