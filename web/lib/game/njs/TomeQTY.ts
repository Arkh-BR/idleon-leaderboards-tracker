// The Tome's quantities: `_customEvent_TomeQTY` @5739147 (the Tome actor, ActorEvents_229) fills `DNSM.TomeQTY`, one quantity per task
// of CustomLists.Tome, in its order (the task index of the Tome list). It is session state, not in the save (Ruling A): here it is the event
// replayed on the save, without its side effects.
//
// Before the quantities the event raises four account records to their live value (OptionsListAccount[198] to MoneyBANK, [200] to the
// Drop Rate, [202] to the Crystal Spawn chance, [224] to the Greenstacks): the save is immutable, so the raised record is kept in memory. [200] is raised too (TotalStats(Drop_Rarity), off map 216; an `assumed:` on TomeQTY[18] for the map). The scene gate
// (`"utorial"`) does not apply: a tracked account is in the world.
import { asNum, asNumber, attr } from "../attr";
import { assumed, block, isTestCache, withPlayer, type Ctx } from "../ctx";
import { DeathNoteMobs, MapAFKtarget, MapDetails, NinjaInfo, PetStats, RANDOlist, SceneNPCquestOrder, Tome } from "../data";
import { InvalidSaveValue } from "../errors";
import { hString } from "../hstring";
import { contains, lengthOf, listAt, listOrMapAt } from "../lists";
import { currency, skillLevelsMax } from "../player";
import { range } from "../ported";
import type { GameState } from "../state";
import { ArbitraryCode } from "./ArbitraryCode";
import { Breeding } from "./Breeding";
import { minigameHiscore } from "./DamageDealed";
import { FarmingStuffs } from "./FarmingStuffs";
import { getLOG } from "./getLOG";
import { MainframeBonus } from "./MainframeBonus";
import { Ninja } from "./Ninja";
import { ResearchStuff } from "./ResearchStuff";
import { RoyalG } from "./RoyalG";
import { CARD_INFO, RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { DNSM_TomeQTYtot } from "./DNSM";
import { Summoning } from "./Summoning";
import { SushiStuff } from "./SushiStuff";
import { Thingies } from "./Thingies";
import { TotalStats } from "./TotalStats";
import { TotalTalentPoints } from "./TotalTalentPoints";

/** Σ asNumber(list[i]) over a list the save may keep as a `{i, length}` map (the game's loader gives a list). */
function sumOf(ctx: Ctx, name: string, ...idx: number[]): number {
  let s = 0;
  for (let i = 0, n = lengthOf(listOrMapAt(ctx, name, ...idx)); i < n; i++) s += asNum(ctx, name, ...idx, i);
  return s;
}

/** Σ Math.round(Math.max(0, asNumber(list[i]))), the game's loop over a list's whole length. */
function roundedSum(ctx: Ctx, name: string, ...idx: number[]): number {
  let s = 0;
  for (let i = 0, n = listAt(ctx, name, ...idx).length; i < n; i++) s += Math.round(Math.max(0, asNum(ctx, name, ...idx, i)));
  return s;
}

/** The best asNumber(list[i]), from 0 (a value replaces it only when above it). */
function bestOf(ctx: Ctx, name: string, ...idx: number[]): number {
  let best = 0;
  for (let i = 0, n = listAt(ctx, name, ...idx).length; i < n; i++) if (asNum(ctx, name, ...idx, i) > best) best = asNum(ctx, name, ...idx, i);
  return best;
}

/**
 * `FamilyValuesMap[name]`: the loader fills each FamilyValuesMap key from the save key "FamVal" + name (@19929053, a loop SAVE_ATTRS cannot
 * name), as DamageDealed's `minigameHiscore` reads it.
 */
function famVal(ctx: Ctx, name: string): readonly unknown[] {
  const key = `FamVal${name}`;
  const list = ctx.state.get(key); // MissingSaveKey when the save lacks it
  if (!Array.isArray(list)) throw new InvalidSaveValue(key, "an array", list);
  return list;
}

/**
 * [49] and [51] @5754837: per pet name of the breeding actor's GenINFO[76] (ActorEvents_548's create @10096594: the names of PetStats[0..4]
 * that are not "_"), its group b and index f in GenINFO[65] (@10095586: the names of PetStats[0..8], the first group holding it): Σ its
 * SpecialPassives level, and Σ min(9, floor((2ndMulti - 1)^0.8) + 1).
 */
function petLevels(ctx: Ctx): [number, number] {
  const groups = PetStats as unknown as readonly (readonly (readonly unknown[])[])[];
  const byGroup = range(0, 9).map((b) => groups[b].map((pet) => pet[0])); // GenINFO[65]
  const names = range(0, 5).flatMap((b) => groups[b].map((pet) => pet[0]).filter((name) => "_" != name)); // GenINFO[76]
  let [shiny, breedability] = [0, 0];
  for (const name of names) {
    const text = hString(name); // DummyText
    const b = byGroup.findIndex((list) => -1 != list.indexOf(text));
    if (-1 == b) continue;
    const f = byGroup[b].indexOf(text);
    shiny += Breeding(ctx, "SpecialPassives", "Lv", b, f);
    breedability += Math.min(9, Math.floor(Math.pow(Breeding(ctx, "2ndMulti", "0", b, f) - 1, 0.8)) + 1);
  }
  return [shiny, breedability];
}

/**
 * [71] @5759469: the Summoning actor's GenINFO[143][9] (ActorEvents_623; its create runs the "x" trigger @11711289, @11662944): per entry of
 * Summon[1], the Pet wins in [0], else one in [g + 1] for each DeathNoteMobs[g] that has it; then round(Σ [0..8] + OptionsListAccount[319]).
 */
function careerSummonWins(ctx: Ctx): number {
  const mobs = DeathNoteMobs as unknown as readonly (readonly unknown[])[];
  const wins = Array<number>(Math.max(9, mobs.length + 1)).fill(0); // GenINFO[143]
  for (let i = 0, n = listAt(ctx, "Summon", 1).length; i < n; i++) {
    const won = attr(ctx, "Summon", 1, i);
    if (0 == hString(won).indexOf("Pet")) wins[0] += 1;
    else for (let g = 0; g < mobs.length; g++) if (contains(mobs[g], won)) wins[g + 1] += 1;
  }
  let total = 0; // DN1
  for (let k = 0; k < 9; k++) total = Math.round(total + wins[k]);
  return Math.round(total + asNum(ctx, "OptionsListAccount", 319));
}

/** The event on this character and map, in the game's order. */
function event(ctx: Ctx): number[] {
  const q = Array<number>(Tome.length).fill(NaN);
  const ola = (i: number) => asNum(ctx, "OptionsListAccount", i);
  const players = ctx.state.charNames.length;
  // @5739649 / @5740104: the records the event raises first (in memory)
  const money = asNum(ctx, "MoneyBANK");
  const ola198 = money > ola(198) ? money : ola(198);
  const crystal = ArbitraryCode(ctx, "CrystalSpawn");
  const ola202 = crystal > ola(202) ? crystal : ola(202);
  // @5740254: DNSM.LabMFbonuses.GrStk, which TalentCalc(-7) @4514715 sets to the GreenStacks the account has when the stored mainframe bonus
  // 11 is above 0 (MainframeBonus(11) is that bonus times the same count: above 0 together)
  const grStk = 0 < MainframeBonus(ctx, 11) ? listAt(ctx, "GreenStacks").length : 0;
  const ola224 = grStk > ola(224) ? grStk : ola(224);
  // @5739896: OptionsListAccount[200] raised to the live Drop Rate off map 216 (in memory). The Drop Rate reads the Tome score, which is 0 while
  // the Tome is counted (DNSM_TomeQTYtot's guard), as at login in the game.
  const live = 216 != ctx.map ? TotalStats(ctx, "Drop_Rarity") : 0;
  const ola200 = 216 != ctx.map && live > ola(200) ? live : ola(200);

  // [0] @5740553: the stamp actor's GenINFO[106] (ActorEvents_481's create @9085872), every StampLevel of the three tabs
  q[0] = sumOf(ctx, "StampLevel", 0) + sumOf(ctx, "StampLevel", 1) + sumOf(ctx, "StampLevel", 2);
  // [1] @5740889: the current character's StatueLevels[g][0]
  q[1] = 0;
  for (let g = 0, n = listAt(ctx, "StatueLevels").length; g < n; g++) q[1] += asNumber(listAt(ctx, "StatueLevels", g)[0]);
  // [2] @5741317: CardLv of every Cards[0] key the card info map (ActorEvents_312's GenINFO[45]) has
  q[2] = 0;
  for (const name of Object.keys(listOrMapAt(ctx, "Cards", 0))) if (CARD_INFO.has(name)) q[2] += RunCodeOfTypeXforThingY(ctx, "CardLv", name);
  // [3] @5742014: per talent of the current character's SkillLevelsMAX, the best of the account's (above 0)
  const maxes = range(0, players).map((p) => skillLevelsMax(ctx, p));
  q[3] = 0;
  for (let i = 0, n = maxes[ctx.player].length; i < n; i++) q[3] += Math.max(0, ...maxes.map((m) => asNumber(m[i])));
  // [4] @5742562: the SceneNPCquestOrder quests some character has done (QuestComplete 1)
  q[4] = 0;
  for (const quest of SceneNPCquestOrder as unknown as readonly unknown[]) {
    if (range(0, players).some((b) => 1 == attr(withPlayer(ctx, b), "QuestComplete", hString(quest)))) q[4] += 1;
  }
  // [5] @5742904: every character's Lv0[0]
  q[5] = 0;
  for (let g = 0; g < players; g++) q[5] += asNum(withPlayer(ctx, g), "Lv0", 0);
  // [6] @5743830: Tasks[1][i][0..7]
  q[6] = 0;
  for (let i = 0, n = listAt(ctx, "Tasks", 1).length; i < n; i++) {
    listAt(ctx, "Tasks", 1, i); // the game indexes Tasks[1][i][j] directly
    for (let j = 0; j < 8; j++) q[6] += asNum(ctx, "Tasks", 1, i, j);
  }
  // [7] @5744052: the achievements done
  q[7] = 0;
  for (let g = 0, n = listAt(ctx, "AchieveReg").length; g < n; g++) if (-1 == attr(ctx, "AchieveReg", g)) q[7] += 1;
  // [8] @5744117
  q[8] = ola198;
  // [9] @5744606: OptionsListAccount[208] raised to the Grasslands1 of the current character's inventory (@5744526, in memory)
  let spores = 0;
  for (let g = 0, n = listAt(ctx, "InventoryOrder").length; g < n; g++) if ("Grasslands1" == attr(ctx, "InventoryOrder", g)) spores += asNum(ctx, "ItemQuantity", g);
  q[9] = spores > ola(208) ? spores : ola(208);
  // [10] [21] [107] @5745136: the Cards[1] names that start with Trophy, else Obol, else EquipmentNametag
  [q[10], q[21], q[107]] = [0, 0, 0];
  for (let g = 0, n = listAt(ctx, "Cards", 1).length; g < n; g++) {
    const c = hString(attr(ctx, "Cards", 1, g));
    if (0 == c.indexOf("Trophy")) q[10] += 1;
    else if (0 == c.indexOf("Obol")) q[21] += 1;
    else if (0 == c.indexOf("EquipmentNametag")) q[107] += 1;
  }
  // [11] @5745686: every character's Lv0[1..21], each at least 0
  q[11] = 0;
  for (let p = 0; p < players; p++) for (let b = 0; b < 21; b++) q[11] += Math.max(0, asNum(withPlayer(ctx, p), "Lv0", b + 1));
  q[12] = ola(201); // @5745752
  listAt(ctx, "Tasks", 0, 0); // the game indexes Tasks[0][0][2] directly
  q[13] = asNum(ctx, "Tasks", 0, 0, 2); // @5745854
  q[14] = ola(172); // @5745946
  q[15] = TotalTalentPoints(ctx, 5); // @5746384, TotalTalentPoints(six 0s)[5]
  q[16] = 1 / ola202; // @5746509
  // [17] @5746624: the dungeon actor's GenINFO[12] (ActorEvents_498 @9245621), the first b with OptionsListAccount[71] below RANDOlist[29][b], else 1
  const ranks = (RANDOlist as unknown as readonly (readonly unknown[])[])[29];
  q[17] = 1;
  for (let b = 0; b < ranks.length; b++) {
    if (ola(71) < asNumber(ranks[b])) {
      q[17] = b;
      break;
    }
  }
  q[18] = ola200; // @5746788, under an assumed: in tomeQty (the map)
  // [19] @5747053: the constellations done
  q[19] = 0;
  for (let g = 0, n = listAt(ctx, "StarSignProg").length; g < n; g++) if (1 == attr(ctx, "StarSignProg", g, 1)) q[19] += 1;
  q[20] = ola(203); // @5747119
  q[22] = sumOf(ctx, "CauldronInfo", 0) + sumOf(ctx, "CauldronInfo", 1) + sumOf(ctx, "CauldronInfo", 2) + sumOf(ctx, "CauldronInfo", 3); // @5748082
  q[23] = sumOf(ctx, "CauldronInfo", 4); // @5748318
  // [24] @5748572: 1 + CauldronP2W[4][1 + 2g] for each g below ceil(length / 2)
  q[24] = 0;
  for (let g = 0, n = Math.ceil(listAt(ctx, "CauldronP2W", 4).length / 2); g < n; g++) q[24] += asNum(ctx, "CauldronP2W", 4, 1 + 2 * g) + 1;
  q[25] = ola(199); // @5748638
  const box = (k: string) => Math.round(asNumber(currency(ctx, `DeliveryBox${k}`)));
  q[26] = box("Complete") + (box("Streak") + box("Misc")); // @5748739
  q[27] = ola(204); // @5749057
  q[28] = ola(205);
  q[29] = ola(206);
  q[30] = 1e3 - ola(207); // @5749360
  q[31] = ola(211); // @5749477
  q[32] = ola(212);
  q[33] = ola(213);
  q[34] = ola(214);
  q[35] = ola(215);
  q[36] = ola(209); // @5749983
  q[37] = sumOf(ctx, "TotemInfo", 0); // @5750249
  // [38] @5752210: the Death Note, ceil(getLOG(the account's kills)) per mob of DeathNoteMobs that has a map (MapAFKtarget), a character's
  // kills being MapDetails[map][0][0] - KillsLeft2Advance[map][0]; then, with Emporium 7, ceil(getLOG(Ninja[105][g])) per miniboss
  q[38] = 0;
  const maps = MapAFKtarget as unknown as readonly unknown[];
  for (const mobs of DeathNoteMobs as unknown as readonly (readonly unknown[])[]) {
    for (const mob of mobs) {
      const m = maps.indexOf(mob);
      if (!(0 <= m)) continue;
      const req = asNumber((MapDetails as unknown as readonly (readonly (readonly unknown[])[])[])[m][0][0]);
      let kills = 0; // DummyNumber4
      for (let p = 0; p < players; p++) {
        const who = withPlayer(ctx, p);
        listAt(who, "KillsLeft2Advance", m); // the game indexes KillsLeft2Advance[m][0] directly
        kills += req - asNum(who, "KillsLeft2Advance", m, 0);
      }
      q[38] += Math.ceil(getLOG(ctx, kills));
    }
  }
  if (1 == Ninja(ctx, "EmporiumBonus", 7, 0)) {
    listAt(ctx, "Ninja", 105); // the game indexes Ninja[105][g] directly
    for (let g = 0, n = (NinjaInfo as unknown as readonly (readonly unknown[])[])[30].length; g < n; g++) q[38] += Math.ceil(getLOG(ctx, asNum(ctx, "Ninja", 105, g)));
  }
  // [39] @5752515: the WeeklyBoss keys starting d_ at -1
  q[39] = 0;
  for (const [k, v] of Object.entries(listOrMapAt(ctx, "WeeklyBoss"))) if (0 == k.indexOf("d_") && -1 == v) q[39] += 1;
  // [40] @5753055: the six salts' rank, Refinery[3..8][1]
  q[40] = 0;
  for (let s = 3; s <= 8; s++) q[40] += asNumber(listAt(ctx, "Refinery", s)[1]);
  q[41] = 0; // @5753272: the atoms' levels
  for (let g = 0, n = listAt(ctx, "Atoms").length; g < n; g++) q[41] += asNum(ctx, "Atoms", g);
  // [42] @5753339: the stamp actor's GenINFO[111] (its create @9087150), TowerInfo[0..26]
  listAt(ctx, "TowerInfo"); // the game indexes TowerInfo[f] directly
  q[42] = 0;
  for (let f = 0; f < 27; f++) q[42] += asNum(ctx, "TowerInfo", f);
  // [43] @5753730: the storage's Critter11A
  const chest = listAt(ctx, "ChestOrder").indexOf("Critter11A");
  q[43] = 0;
  if (-1 != chest) q[43] = asNumber(listAt(ctx, "ChestQuantity")[chest]);
  q[44] = ola224; // @5753796
  q[45] = asNumber(listAt(ctx, "Rift")[0]); // @5753897
  // [46] @5754429: the best Pets[g][2], then PetsStored[g][2]
  q[46] = 0;
  for (const pets of ["Pets", "PetsStored"]) {
    for (let g = 0, n = listAt(ctx, pets).length; g < n; g++) {
      const power = asNumber(listAt(ctx, pets, g)[2]);
      if (power > q[46]) q[46] = power;
    }
  }
  q[47] = 1e3 - ola(220); // @5754495
  // [48] @5754837: Cooking[g][6] + [7] + [8] of the ten kitchens
  q[48] = 0;
  for (let g = 0; g < 10; g++) {
    listAt(ctx, "Cooking", g); // the game indexes Cooking[g][6] directly
    q[48] += asNum(ctx, "Cooking", g, 6) + (asNum(ctx, "Cooking", g, 7) + asNum(ctx, "Cooking", g, 8));
  }
  [q[49], q[51]] = petLevels(ctx); // @5756149, @5756215
  q[50] = sumOf(ctx, "Meals", 0); // @5756439
  q[52] = 0; // @5756671: Lab[15], each at least 0
  for (let g = 0, n = listAt(ctx, "Lab", 15).length; g < n; g++) q[52] += Math.max(asNum(ctx, "Lab", 15, g), 0);
  q[53] = 0; // @5756952
  for (const v of famVal(ctx, "ColosseumHighscores")) q[53] += asNumber(v);
  q[54] = ola(217); // @5757018
  q[55] = ArbitraryCode(ctx, "StatueOnyxOwned"); // @5757119
  q[56] = 1e3 - ola(218); // @5757215
  q[57] = 0; // @5757539: Boats[g][3] + [5]
  for (let g = 0, n = listAt(ctx, "Boats").length; g < n; g++) {
    listAt(ctx, "Boats", g); // the game indexes Boats[g][3] directly
    q[57] += asNum(ctx, "Boats", g, 3) + asNum(ctx, "Boats", g, 5);
  }
  q[58] = Math.max(0, asNumber(listAt(ctx, "Divinity")[25]) - 10); // @5757605
  q[59] = asNumber(listAt(ctx, "GamingSprout", 28)[1]); // @5757722
  q[60] = sumOf(ctx, "Sailing", 3); // @5757980
  q[61] = asNumber(listAt(ctx, "Sailing", 1)[0]); // @5758046
  q[62] = 0; // @5758277: the best Captains[g][3] of the first 20
  for (let g = 0; g < 20; g++) q[62] = Math.max(q[62], asNumber(listAt(ctx, "Captains", g)[3]));
  q[63] = Math.max(asNumber(listAt(ctx, "GamingSprout", 32)[1]), ola(210)); // @5758343
  q[64] = asNumber(listAt(ctx, "Gaming")[8]); // @5758528
  q[65] = listAt(ctx, "Cards", 1).length; // @5758615
  q[66] = asNumber(listAt(ctx, "Gaming")[0]); // @5758708
  q[67] = Math.pow(2, ola(219)); // @5758795
  q[68] = Object.keys(listOrMapAt(ctx, "FarmCrop")).length; // @5758920, D.mapCount
  q[69] = sumOf(ctx, "Ninja", 104); // @5759179
  q[70] = sumOf(ctx, "Summon", 0); // @5759403
  q[71] = careerSummonWins(ctx);
  q[72] = 0 < ola(232) ? 12 * ola(232) : Ninja(ctx, "FloorsUnlocked", 0, 0); // @5759706
  q[74] = hString(listAt(ctx, "Ninja", 102)[9]).length; // @5759913, the Emporium letters
  // [73] @5760203: Σ Summon[4][g] x (1 x 3 x 4 x ... x (g + 2)) over g < 9
  listAt(ctx, "Summon", 4); // the game indexes Summon[4][g] directly
  q[73] = 0;
  for (let g = 0, w = 1; g < 9; w *= g + 3, g++) q[73] += w * asNum(ctx, "Summon", 4, g);
  // [75] @5760439, then [76] @5760874 (its sum is taken just before)
  q[75] = minigameHiscore(ctx, 0) + (minigameHiscore(ctx, 1) + (minigameHiscore(ctx, 2) + (minigameHiscore(ctx, 3) + ola(99))));
  q[76] = sumOf(ctx, "PrayersUnlocked");
  q[77] = sumOf(ctx, "FarmRank", 0); // @5761103
  q[78] = ola(221); // @5761169
  q[79] = ola(222); // @5761270
  q[80] = sumOf(ctx, "ArcadeUpg"); // @5761529
  q[81] = Math.min(1500, Summoning(ctx, "VaultUpgBonus", 57, 0)); // @5761595
  const gambit = (i: number) => asNumber(listAt(ctx, "Holes", 11)[i]);
  q[82] = gambit(65) + (gambit(66) + (gambit(67) + (gambit(68) + (gambit(69) + gambit(70))))); // @5761706
  q[83] = 0; // @5762283: the digits of the cavern resources
  for (let g = 0, n = listAt(ctx, "Holes", 9).length; g < n; g++) q[83] += Math.ceil(getLOG(ctx, asNum(ctx, "Holes", 9, g)));
  // From here the event stores some elements as they are (TomeQTY[85] = OptionsListAccount[262]); TomePCT reads each one through
  // c.asNumber, so the element's asNumber is kept, the same number to every reader. Its list is indexed directly, as the game does.
  q[84] = roundedSum(ctx, "Holes", 1); // @5762529
  q[85] = ola(262); // @5762595
  q[86] = ola(279);
  listAt(ctx, "Holes", 11); // the game indexes Holes[11][i] directly
  q[87] = asNum(ctx, "Holes", 11, 73);
  q[88] = asNum(ctx, "Holes", 11, 74);
  q[89] = asNum(ctx, "Holes", 11, 75);
  q[90] = ola(356);
  q[91] = asNum(ctx, "Holes", 11, 8); // @5763172
  const layer = (i: number) => Math.round(Math.max(0, asNum(ctx, "Holes", 11, i)));
  q[92] = layer(1) + layer(3) + (layer(5) + layer(7)); // @5763673
  q[93] = roundedSum(ctx, "Holes", 7); // @5763920
  q[94] = Math.round(Math.min(12, ola(353)) + 1); // @5763986
  q[95] = Math.round(ola(369)); // @5764126
  q[96] = 0; // @5764970: the nine Summoning stones' best trials
  for (let g = 0; g < 9; g++) q[96] += Math.round(Thingies(ctx, "SumStoneTrialz", g, 0));
  listAt(ctx, "Spelunk", 13); // the game indexes Spelunk[13][0..5] directly
  q[97] = 0; // @5765510
  for (let g = 0; g < 6; g++) q[97] += asNum(ctx, "Spelunk", 13, g);
  q[98] = bestOf(ctx, "Spelunk", 1); // @5765812
  q[99] = 0; // @5766038
  for (let g = 0, n = listAt(ctx, "Ninja", 103).length; g < n; g++) q[99] += asNum(ctx, "Ninja", 103, g);
  q[100] = ola(445); // @5766104
  q[101] = ola(446);
  q[102] = bestOf(ctx, "Spelunk", 2); // @5766544
  q[103] = 0; // @5766783
  for (let g = 0, n = listAt(ctx, "Spelunk", 5).length; g < n; g++) q[103] += Math.max(0, asNum(ctx, "Spelunk", 5, g));
  q[104] = listAt(ctx, "Spelunk", 6).length; // @5766851
  q[105] = 0; // @5767366: the best Lv0[19] of every character (PlayerDATABASE)
  for (let g = 0; g < players; g++) if (asNum(withPlayer(ctx, g), "Lv0", 19) > q[105]) q[105] = asNum(withPlayer(ctx, g), "Lv0", 19);
  q[106] = ola(443); // @5767433
  listAt(ctx, "Bubba", 1); // the game indexes Bubba[1][8] directly
  q[108] = asNum(ctx, "Bubba", 1, 8); // @5767535
  q[109] = listAt(ctx, "Spelunk", 46).length; // @5767625
  listAt(ctx, "Research", 7); // the game indexes Research[7][i] directly
  q[110] = asNum(ctx, "Research", 7, 4); // @5767722
  q[111] = listAt(ctx, "Research", 11).length; // @5767815
  q[112] = FarmingStuffs(ctx, "TotalStickers", 0, 0); // @5767914
  q[113] = ola(498); // @5768013
  q[114] = ResearchStuff(ctx, "Grid_PTSspent", 0, 0); // @5768115
  q[115] = roundedSum(ctx, "Research", 12); // @5768403
  q[116] = SushiStuff(ctx, "UniqueSushi", 0, 0); // @5768470
  q[117] = ola(594); // @5768564
  q[118] = 0; // @5768836
  for (let g = 0, n = listAt(ctx, "RoyalG", 0).length; g < n; g++) q[118] += Math.max(0, asNum(ctx, "RoyalG", 0, g));
  q[119] = RoyalG(ctx, "TotalStatz", 4, 0); // @5768903
  q[120] = RoyalG(ctx, "TotalStatz", 0, 0); // @5768993
  q[121] = asNum(ctx, "Research", 7, 9); // @5769082
  listAt(ctx, "Menagerie", 0); // the game indexes Menagerie[0][2] directly
  q[122] = asNum(ctx, "Menagerie", 0, 2); // @5769175
  q[123] = 0; // @5769433
  for (let g = 0, n = listAt(ctx, "Menagerie", 3).length; g < n; g++) q[123] += asNum(ctx, "Menagerie", 3, g);
  return q;
}

/** The arrays built, per state (per cache for a test's, isTestCache) and then per character and map: the event reads the whole save. */
const built = new WeakMap<GameState | Map<string, number>, Map<string, readonly number[]>>();

/**
 * `DNSM.TomeQTY`, the event's quantities for the current character and map. Built once per state, on a cache of its own: a caller's seeds
 * never reach the array every Ctx of the state reads. A test's cache keeps its stubs and seeds, and its own array.
 */
export function TomeQTY(ctx: Ctx): readonly number[] {
  const test = isTestCache(ctx.cache);
  const owner = test ? ctx.cache : ctx.state;
  let mine = built.get(owner);
  if (!mine) built.set(owner, (mine = new Map()));
  const key = `${ctx.player}|${ctx.map}`;
  let q = mine.get(key);
  if (!q) {
    // The count builds the array (its read of the score is 0, as at login): the event runs inside it, so the Drop Rate raise sees the
    // score at 0 for every caller. A read during the count finds it guarded and builds here.
    DNSM_TomeQTYtot(ctx);
    q = mine.get(key);
  }
  if (!q) mine.set(key, (q = Object.freeze(event(test ? ctx : { ...ctx, cache: new Map() }))));
  return q;
}

/** `DNSM.TomeQTY[i]`, read by key. */
export const tomeQty = block("DNSM.TomeQTY", (ctx, i: number) => {
  if (!(0 <= i && i < Tome.length)) throw new RangeError(`DNSM.TomeQTY: no task ${i} in CustomLists.Tome`);
  const v = TomeQTY(ctx)[i];
  if (18 != i) return v;
  return assumed(
    ctx,
    "Tome.dropRateMap",
    "Tome counts the Drop Rate of the map the character stands on",
    v,
    "TomeQTY[18] = OptionsListAccount[200] @5746788, raised first to the live TotalStats(Drop_Rarity) off map 216 (@5739896): the live value is that of the map the character is on, session state; the saved record (the load step DoOnceREAL < 378 resets it to 1) is the floor"
  );
});
