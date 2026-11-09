import { asNum, asNumber, attr } from "../attr";
import { type Ctx } from "../ctx";
import { StarSigns as STAR_SIGNS } from "../data";
import { InvalidSaveValue, MissingSaveKey } from "../errors";
import { hString } from "../hstring";
import { contains } from "../lists";
import { charKey, opt } from "../state";
import { chipBonuses } from "./chipBonuses";
import { RiftStuff } from "./RiftStuff";
import { Summoning2 } from "./Summoning2";

/**
 * `PersonalValuesMap.StarSign` of the current player: the signs the character wears, as the text "69,49,26," (a trailing comma, `_` for
 * an empty slot). The cloud load @19924336 reads it from `PVtStarSign_<player>` (CSver 4 and up); when that is "" it takes
 * `"" + PVStarSign_<player>`, and "-1" becomes "0". The key is not in SAVE_ATTRS (a dynamic key of the loader's loop), so it is read here.
 */
export function equippedSignsText(ctx: Ctx): string {
  const text = opt(ctx.state, charKey("PVtStarSign", ctx.player));
  if (text === undefined) throw new MissingSaveKey(charKey("PVtStarSign", ctx.player));
  if (text !== "") return hString(text);
  const old = opt(ctx.state, charKey("PVStarSign", ctx.player));
  if (old === undefined) throw new MissingSaveKey(charKey("PVStarSign", ctx.player));
  return hString(old) === "-1" ? "0" : hString(old);
}

/**
 * N.js `_customBlock_StarSigns(d)` @6540624: it rebuilds `DNSM.StarSigns` for the current player every time it runs (a character
 * loads, a sign is changed), and this is that map (DNSM_StarSigns reads one key of it):
 *  - the list of active signs `StarSignsDL`: the signs worn and, for each of the first `RiftStuff("enabledStarSigns")` signs whose name
 *    the account has unlocked (StarSignsUnlocked), its index;
 *  - the table below, once over that list and, when the Silkrode Nanochip is the one star chip equipped (chipBonuses("star") is exactly 1)
 *    and the Rift enables no sign, a second time over the worn signs only; the keys that were negative after the first pass
 *    are put back after the second (`StarSignsDL2`), so only the positive bonuses double;
 *  - with Seraph Cosmos unlocked (@6563930), every positive value times max(1, min(2, 1 + chip x floor((999 + enabled) / 1000)))
 *    x (1 + Meritoc bonus 22 / 100) x min(5, (1.1 + min(Arcane[40], 10) / 100) ^ ceil((Lv0[18] + 1) / 20)).
 * A sign that is not active adds nothing; a key no sign gave is absent (the game reads it as 0). The `PersonalValuesMap == null` branch
 * (a new map, no signs) does not happen on a loaded character, whose map the load always fills.
 */
export function StarSignsMap(ctx: Ctx): Map<string, number> {
  const unlocked = unlockedSigns(ctx);
  const worn = () => equippedSignsText(ctx).split(",");
  let active = activeStarSigns(ctx); // DNSM.StarSignsDL
  const map = new Map<string, number>(); // DNSM.StarSigns
  const kept = new Map<string, number>(); // DNSM.StarSignsDL2
  const has = (sign: string) => contains(active, sign);
  const add = (key: string, v: number) => void map.set(key, v + asNumber(map.get(key)));
  const set = (key: string, v: number) => void map.set(key, v);
  const lv0 = asNum(ctx, "Lv0", 0);
  for (let k = 0; k < 2; k++) {
    if (!(0 == k || (1 == chipBonuses(ctx, "star") && !(1 <= RiftStuff(ctx, "enabledStarSigns", 0))))) continue;
    if (1 == k) {
      active = worn();
      for (const [w, v] of map) if (0 > v) kept.set(w, v);
    }
    // @6542438..@6563426: the table, mechanically translated from the N.js (`D.contains(StarSignsDL, "i")` is has("i"), `+=` is add)
    if (has("0")) {
      add("PctDmg", 1);
      add("STR", 3);
    }
    if (has("1")) {
      add("MoveSpd", 2);
      add("AGI", 3);
    }
    if (has("2")) {
      add("MainXP", 1);
      add("WIS", 3);
    }
    if (has("3")) {
      add("TalPts1", 3);
      add("LUK", 3);
    }
    if (has("4")) {
      add("MiningEff", 5);
      add("MultiOre", 20);
    }
    if (has("5")) {
      add("ChopEff", 5);
      add("MultiLog", 20);
    }
    if (has("6")) {
      add("FishEff", 5);
      add("MultiFish", 20);
    }
    if (has("7")) {
      add("CatchingEff", 5);
      add("MultiBug", 20);
    }
    if (has("8")) {
      add("MoveSpd", 4);
      if (worn().includes("8")) set("RingDrop", 1);
    }
    if (has("9")) {
      add("TimeCandy", 20);
    }
    if (has("10")) {
      add("ExpActive", 15);
    }
    if (has("11")) {
      add("CarryCap", 10);
    }
    if (has("12")) {
      add("DefPct", 6);
      add("WepPow", 2);
    }
    if (has("13")) {
      add("AccPct", 4);
      add("MoveSpd", 2);
    }
    if (has("14")) {
      add("Drop", 5);
    }
    if (has("15")) {
      add("STR", 8);
    }
    if (has("16")) {
      add("AGI", 8);
    }
    if (has("17")) {
      add("WIS", 8);
    }
    if (has("18")) {
      add("LUK", 8);
    }
    if (has("19")) {
      add("FightAFK", 2);
    }
    if (has("20")) {
      add("SkillAFK", 2);
    }
    if (has("21")) {
      add("Minigame", 30);
    }
    if (has("22")) {
      add("NoConsumeFood", 10);
      add("FoodEffect", 15);
    }
    if (has("23")) {
      add("TownSkillSpd", 10);
    }
    if (has("24")) {
      add("MainXP", 3);
    }
    if (has("25")) {
      add("CarryCap", 5);
      add("SkillAFK", 1);
      add("SkillProw", 2);
    }
    if (has("26")) {
      add("MobRespawn", 2);
    }
    if (has("27")) {
      add("BossDamage", 3);
      add("CritChance", 4);
    }
    if (has("28")) {
      if (28 > RiftStuff(ctx, "enabledStarSigns", 0) - 1) {
        set("TotalHP", -80);
        add("DefPct", -50);
      }
      add("FightAFK", 6);
    }
    if (has("29")) {
      if (29 > RiftStuff(ctx, "enabledStarSigns", 0) - 1) {
        add("FightAFK", -6);
        add("SkillAFK", -6);
      }
      add("CarryCap", 30);
    }
    if (has("30")) {
      add("SkillEXP", 3);
    }
    if (has("31")) {
      add("STR", 4);
      add("AGI", 4);
      add("WIS", 4);
      add("LUK", 4);
    }
    if (has("32")) {
      if (32 > RiftStuff(ctx, "enabledStarSigns", 0) - 1) {
        add("MoveSpd", -3);
      }
      add("DefPct", 5);
      add("PctDmg", 2);
    }
    if (has("34")) {
      add("pctSTR", 1);
      add("pctAGI", 1);
      add("pctWIS", 1);
      add("pctLUK", 1);
    }
    if (has("35")) {
      add("AccPct", 10);
    }
    if (has("36")) {
      add("DefPct", 10);
    }
    if (has("37")) {
      add("pctSTR", 3);
    }
    if (has("38")) {
      add("pctAGI", 3);
    }
    if (has("39")) {
      add("pctWIS", 3);
    }
    if (has("40")) {
      add("pctLUK", 3);
    }
    if (has("41")) {
      add("pctCardDrop", 15);
    }
    if (has("42")) {
      add("BossDamage", 3);
    }
    if (has("44")) {
      add("pctCritter", 2);
      add("TrapEff", 10);
    }
    if (has("45")) {
      add("ConstExp", 25);
    }
    if (has("46")) {
      add("WorshEff", 15);
      add("WorshExp", 15);
    }
    if (has("47")) {
      add("MultiKill", 15);
    }
    if (has("48")) {
      add("TC40p", 40);
    }
    if (has("49") && 59 < lv0) {
      add("MobRespawn", 4);
    }
    if (has("50") && 69 < lv0) {
      add("SkillEXP", 6);
    }
    if (has("51")) {
      add("PctDmg", 20);
      if (51 > RiftStuff(ctx, "enabledStarSigns", 0) - 1) {
        add("MoveSpd", -12);
      }
    }
    if (has("52") && 79 < lv0) {
      add("MainXP", 6);
    }
    if (has("53")) {
      add("PctDmg", 6);
    }
    if (has("54")) {
      add("PctDmg", 15);
      if (54 > RiftStuff(ctx, "enabledStarSigns", 0) - 1) {
        add("FightAFK", -7);
      }
    }
    if (has("55") && 89 < lv0) {
      add("SkillAFK", 4);
    }
    if (has("56") && 99 < lv0) {
      add("FightAFK", 4);
    }
    if (has("57")) {
      add("57a", 35);
      add("57b", 15);
    }
    if (has("58")) {
      add("58", 15);
    }
    if (has("59")) {
      add("59", 30);
    }
    if (has("60")) {
      add("60", 20);
    }
    if (has("61")) {
      add("61", 15);
    }
    if (has("62")) {
      add("62", 30);
    }
    if (has("63")) {
      add("63", 20);
    }
    if (has("64")) {
      add("STR", 50);
    }
    if (has("65")) {
      add("65", 3);
    }
    if (has("66")) {
      add("66", 20);
    }
    if (has("67")) {
      add("67", 15);
    }
    if (has("68")) {
      add("AGI", 50);
    }
    if (has("69")) {
      add("69", 20);
    }
    if (has("70")) {
      add("PctDmg", 25);
    }
    if (has("71")) {
      add("LUK", 50);
    }
    if (has("72")) {
      add("WIS", 50);
    }
    if (has("73")) {
      add("73", 12);
    }
    if (has("74")) {
      add("74", 15);
    }
    if (has("75")) {
      add("75", 10);
    }
    if (has("76")) {
      add("Drop", 12);
    }
    if (has("77")) {
      add("77", 20);
    }
    if (has("78")) {
      add("78", 3);  }
  }
  for (const [w, v] of kept) map.set(w, v);
  if (Object.hasOwn(unlocked, "Seraph_Cosmos")) {
    for (const [w, v] of map) {
      if (0 < v) {
        const t = seraphTerms(ctx);
        map.set(w, v * t.chip * t.meritoc * t.cosmos);
      }
    }
  }
  return map;
}

/** `StarSignsUnlocked`, the map of the sign names the account has unlocked. */
function unlockedSigns(ctx: Ctx): object {
  const unlocked = attr(ctx, "StarSignsUnlocked");
  if (unlocked === null || typeof unlocked !== "object" || Array.isArray(unlocked)) throw new InvalidSaveValue("StarSignsUnlocked", "a map", unlocked);
  return unlocked;
}

/** The first pass's list of active signs (`StarSignsDL`): the signs worn and, for each of the first `RiftStuff("enabledStarSigns")` signs the account has unlocked, its index. */
export function activeStarSigns(ctx: Ctx): string[] {
  const unlocked = unlockedSigns(ctx);
  const signs = STAR_SIGNS as unknown as readonly (readonly unknown[])[];
  const active = equippedSignsText(ctx).split(",");
  for (let f = 0, g = RiftStuff(ctx, "enabledStarSigns", 0) | 0; f < g; f++) {
    if (f < signs.length && Object.hasOwn(unlocked, hString(signs[f][0]))) active.push(`${f}`);
  }
  return active;
}

/** The three factors Seraph Cosmos (@6563930) gives every positive value: the Silkrode chip, the Meritoc bonus 22 and the Cosmos itself. */
export function seraphTerms(ctx: Ctx): { chip: number; meritoc: number; cosmos: number } {
  return {
    chip: Math.max(1, Math.min(2, 1 + chipBonuses(ctx, "star") * Math.floor((999 + RiftStuff(ctx, "enabledStarSigns", 0)) / 1e3))),
    meritoc: 1 + Summoning2(ctx, "MeritocBonusz", 22, 0) / 100,
    cosmos: Math.min(5, Math.pow(1.1 + Math.min(asNum(ctx, "Arcane", 40), 10) / 100, Math.ceil((asNum(ctx, "Lv0", 18) + 1) / 20))),
  };
}

/** Seraph Cosmos is unlocked. */
export function seraphUnlocked(ctx: Ctx): boolean {
  return Object.hasOwn(unlockedSigns(ctx), "Seraph_Cosmos");
}
