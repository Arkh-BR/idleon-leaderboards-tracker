import { asNum, asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { afkTarget } from "../afkTarget";
import { CardStuff, MONSTERS } from "../data";
import { InvalidSaveValue, NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains, listAt } from "../lists";
import { AchieveStatus } from "./AchieveStatus";
import { ArcaneType } from "./ArcaneType";
import { Companions } from "./Companions";
import { DamageDealed } from "./DamageDealed";
import { Divinity } from "./Divinity";
import { DNSM_FamBonusQTYs } from "./DNSM";
import { GamingStatType } from "./GamingStatType";
import { GetSetBonus } from "./GetSetBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { Holes } from "./Holes";
import { PlayerAccTot } from "./PlayerAccTot";
import { prayersReal } from "./prayersReal";
import { RiftStuff } from "./RiftStuff";
import { RoyalG } from "./RoyalG";
import { Spelunk } from "./Spelunk";
import { Summoning } from "./Summoning";
import { Thingies } from "./Thingies";
import { skillLevel } from "../player";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_RunCodeOfTypeXforThingY(d, b)` @4079431: one function, a chain of named sub-cases, `b` a string. Only the
 * sub-cases the character stats reach.
 */
export const RunCodeOfTypeXforThingY: (ctx: Ctx, d: string, b: string) => number = block("RunCodeOfTypeXforThingY", (ctx, d: string, b: string) => {
  switch (d) {
    case "CardLv":
      return cardLv(ctx, b);
    // @4084887: the talents no "all talent levels" bonus reaches
    case "TalentBannedforAllLV": {
      const n = asNumber(b);
      return (49 <= n && 59 >= n) || 149 == n || 374 == n || 539 == n || 505 == n || 614 < n ? 1 : 0;
    }
    case "AllTalentLV":
    case "AllTalentLVz":
      return allTalentLV(ctx, d, b, () => DNSM_FamBonusQTYs(ctx, "68"));
    case "OverkillStuffs":
      return overkillStuffs(ctx, b);
    default:
      throw new NotPorted("RunCodeOfTypeXforThingY", d);
  }
});

// @njs MonsterRespawnTimeReset
/**
 * The HP of the monster the character is AFK on, `MonsterDefinitionsGET[AFKtarget].MonsterHPTotal` (Rulings V and GG: lib/game/afkTarget.ts). The table is the
 * game data as `performETCaction("MonsterRespawnTimeReset")` @6508363 leaves it (each scene load runs it, @15305666): every monster's HP times
 * 1 + (the curses of the prayers 0, 7 and 8) / 100 when any is not 0, then the Clamworks clam's set to Thingies("Clamz_HP"), so the clam is never cursed.
 * The table it copies has the Rift's monster at RiftStuff("mobHP", 0): the Rift scene writes it there (@20359437) before a character can be AFK on it, so it is cursed like the others.
 * The game would throw on a target the table does not have ("Z", "Filler", ...).
 */
function monsterHPTotal(ctx: Ctx): number {
  const target = afkTarget(ctx);
  const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[target];
  if (!mob) throw new InvalidSaveValue("AFKtarget", "a MonsterDefinitions key", target);
  if ("w7a6" == target) return Thingies(ctx, "Clamz_HP", 0, 0);
  const hp = "riftAll" == target ? RiftStuff(ctx, "mobHP", 0) : asNumber(mob.MonsterHPTotal);
  if (0 != prayersReal(ctx, 0, 1) || 0 != prayersReal(ctx, 7, 1) || 0 != prayersReal(ctx, 8, 1)) return hp * (1 + (prayersReal(ctx, 0, 1) + (prayersReal(ctx, 7, 1) + prayersReal(ctx, 8, 1))) / 100);
  return hp;
}

/**
 * `MonsterDefinitionsGET[AFKtarget].Defence`: the game data as `performETCaction("MonsterRespawnTimeReset")` leaves it (@6516949): on a save with Holes, the Motherlode's four
 * targets have Holes("MotherlodeEffBase", i, 0) instead, the fish's divided by 4. The other writes of a monster's Defence happen in a running game: the bosses' parts on the maps 29 and 66
 * (@6530517), the crystal mobs' spawn (@4559629) and the Hound caveA while its fight runs (@12130700); no real save has any of them as its AFK target. The game would throw on a target the table does not have.
 */
function monsterDefence(ctx: Ctx): number {
  const target = afkTarget(ctx);
  const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[target];
  if (!mob) throw new InvalidSaveValue("AFKtarget", "a MonsterDefinitions key", target);
  const at = ["Motherlode", "Bug14", "MotherlodeTREE", "MotherlodeFISH"].indexOf(target);
  if (0 <= at && 0 != listAt(ctx, "Holes").length) return 3 == at ? Holes(ctx, "MotherlodeEffBase", 3, 0) / 4 : Holes(ctx, "MotherlodeEffBase", at, 0);
  return asNumber(mob.Defence);
}

/**
 * `OverkillStuffs` @4095676 for b == "2", the multikill tier on the AFK target: 1, and f + 2 for every step f < 50 the Max damage reaches (HP x E^(f + 2), in
 * N.js's order HP x E x E^(f + 1)), stopping at the first it does not, so at most 51. E (DNSM.OverkillEXPONENT) is 5 from map 300 on, else 2. There is no
 * check of the kind of map: a town or a dungeon whose target the table has counts like any other. For b == "3" (@4097281), whether the multikill applies at all: the Max damage
 * reaches HP x E, the Death Note is built (TowerInfo[2] > .5) and PlayerAccTot beats 1.5 x the target's Defence.
 */
function overkillStuffs(ctx: Ctx, b: string): number {
  const exponent = 300 <= ctx.map ? 5 : 2; // DNSM.OverkillEXPONENT
  if ("3" == b) return DamageDealed(ctx, "Max") >= monsterHPTotal(ctx) * exponent && 0.5 < asNum(ctx, "TowerInfo", 2) && PlayerAccTot(ctx) > 1.5 * monsterDefence(ctx) ? 1 : 0;
  if ("2" != b) throw new NotPorted("RunCodeOfTypeXforThingY", `OverkillStuffs:b=${b}`); // N.js: `2 == c.asNumber(b)`; every caller passes a literal string
  let tier = 1; // DNSM.S2Nz4
  for (let f = 0; 50 > f; f++) {
    if (DamageDealed(ctx, "Max") >= monsterHPTotal(ctx) * exponent * Math.pow(exponent, f + 1)) tier = f + 2;
    else break;
  }
  return tier;
}

/**
 * The card info map, `ActorEvents_312`'s `GenINFO[45]`: the actor's create @7493547 maps every card name `CardStuff[g][q][0]` to its
 * row `CardStuff[g][q]` (a later row of the same name replaces an earlier one). Game data only, so built once.
 */
const CARD_INFO: ReadonlyMap<string, readonly unknown[]> = (() => {
  const m = new Map<string, readonly unknown[]>();
  for (const group of CardStuff as unknown as readonly (readonly (readonly unknown[])[])[]) for (const row of group) m.set(hString(row[0]), row);
  return m;
})();

/**
 * `CardLv` @4083568: the star level of card `b`. 1 once the account has one (`Cards[0][b] > 0`), then f + 2 for every tier f the card
 * count passes: `CardStuff row[2] x (f + 1 + floor(f/3) + 16 floor(f/4) + 100 floor(f/5))^2` (the boss card Boss3B has its own curve,
 * 1.5 (f + 1 + floor(f/3))^2). There are 4 tiers, plus one with Rift 45 and one with the sixth Spelunking star. A card named in
 * OptionsListAccount[603] is at least 7, one in [155] at least 6. The `GenINFO.length < 46` branch (the card actor not created yet)
 * gives 0; a running game has the actor, so it is not modelled.
 */
function cardLv(ctx: Ctx, b: string): number {
  let lv = 0; // DNSM.cardLvCalco
  if (0 < asNum(ctx, "Cards", 0, b)) lv = 1;
  for (let f = 0, e = Math.round(4 + (RiftStuff(ctx, "5starCards", 0) + Spelunk(ctx, "6starCards", 0, 0))); f < e; f++) {
    if ("Boss3B" == b) {
      if (asNum(ctx, "Cards", 0, b) > 1.5 * Math.pow(f + 1 + Math.floor(f / 3), 2)) lv = f + 2;
    } else {
      const row = CARD_INFO.get(b);
      // the game indexes GenINFO[45][b][2] directly and would throw on a card it does not have
      if (!row) throw new RangeError(`RunCodeOfTypeXforThingY CardLv: no card ${b} in CardStuff`);
      if (asNum(ctx, "Cards", 0, b) > asNumber(row[2]) * Math.pow(f + 1 + (Math.floor(f / 3) + (16 * Math.floor(f / 4) + 100 * Math.floor(f / 5))), 2)) lv = f + 2;
    }
  }
  if (contains(hString(attr(ctx, "OptionsListAccount", 603)).split(","), b) && 7 > lv) return 7;
  if (contains(hString(attr(ctx, "OptionsListAccount", 155)).split(","), b) && 6 > lv) return 6;
  return lv;
}

/** `GA("Spelunk")[i].indexOf(t)`: the super talents a character set, a list of talent ids (strict `indexOf`, as the game's). */
function superTalentIndex(ctx: Ctx, i: number, t: number): number {
  return listAt(ctx, "Spelunk", Math.round(i)).indexOf(t);
}

/**
 * `AllTalentLV` / `AllTalentLVz` @4085148: the levels every talent gets on top of its own, for talent `b` ("t" or, for `AllTalentLVz`,
 * "t|player": `getbonus2` asks it for another character). 0 for a talent the current player has not learned (`AllTalentLV` only) and for
 * the banned ones. Else, capped at 9999 (the Royal Guardian Armory upgrade 55 for the talents 225..239):
 * the talents 149, 374 and 539, achievement 291, the family bonus 68, companion 1, the minor Divinity bonus of the god of index 2,
 * Dream[12], OptionsListAccount[232], Grimoire 39, the Kattlekruk set, Arcane 57 (at most 5) and the Super Bit 47 over level 500; then,
 * past the cap, the super talent bonus when `t` is one of the character's super talents (Spelunk[20 + player + 12 x preset]; for `AllTalentLVz`
 * both presets of that player). Every term but the super talent reads the current player, as the game does.
 * `fam68` is `DNSM.FamBonusQTYs["68"]` as the game reads it: the cache, except while `TalentCalc(-3)` rebuilds that cache, when the
 * game reads the half-built map (DNSM_FamBonusQTYs passes it).
 */
export function allTalentLV(ctx: Ctx, d: string, b: string, fam68: () => number): number {
  const t = asNumber(b.split("|")[0]);
  if (!(0.5 < skillLevel(ctx, t | 0) || "AllTalentLVz" == d)) return 0;
  if (1 == RunCodeOfTypeXforThingY(ctx, "TalentBannedforAllLV", b)) return 0;
  let cap = 9999; // DNSM.AllTalMaxCapFR
  if (225 <= t && 239 >= t) cap = RoyalG(ctx, "ArmoryUpgBonus", 55, 0);
  let who = ctx.player; // DNSM.AllTalWhichPlayer: GetPlayersUsernames.indexOf(UserInfo[0])
  if ("AllTalentLVz" == d) who = asNumber(b.split("|")[1]);
  const superDn =
    "AllTalentLVz" == d
      ? Math.max(0, Math.min(1, Math.max(superTalentIndex(ctx, 20 + who, t), superTalentIndex(ctx, 20 + (who + 12), t)) + 1)) * Thingies(ctx, "SuperTalentPTS_LVgiven", 0, 0)
      : Math.max(0, Math.min(1, superTalentIndex(ctx, 20 + (who + 12 * asNum(ctx, "PlayerStuff", 1)), t) + 1)) * Thingies(ctx, "SuperTalentPTS_LVgiven", 0, 0);
  return Math.floor(
    Math.min(
      cap,
      GetTalentNumber(ctx, 1, 149) +
        (GetTalentNumber(ctx, 1, 374) + (GetTalentNumber(ctx, 1, 539) + AchieveStatus(ctx, 291))) +
        (Math.floor(fam68()) +
          (Companions(ctx, 1) +
            (Math.ceil(Divinity(ctx, "Bonus_Minor", ctx.player, 2)) +
              (asNum(ctx, "Dream", 12) +
                5 * Math.floor((97 + asNum(ctx, "OptionsListAccount", 232)) / 100) +
                (Summoning(ctx, "GrimoireUpgBonus", 39, 0) +
                  (GetSetBonus(ctx, "KATTLEKRUK_SET", "Bonus", 0, 0) +
                    (Math.min(5, ArcaneType(ctx, "ArcaneUpgBonus", 57, 0)) +
                      Math.max(0, Math.floor(((asNum(ctx, "Lv0", 0) - 500) / 100) * GamingStatType(ctx, "SuperBitType", 47, 0))))))))))
    ) + superDn
  );
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { CardLv: true, TalentBannedforAllLV: true, AllTalentLV: true, AllTalentLVz: true, OverkillStuffs: ["2", "3"] };
