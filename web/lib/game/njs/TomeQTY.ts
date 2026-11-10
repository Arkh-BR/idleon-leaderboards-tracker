// The Tome's quantities: `_customEvent_TomeQTY` @5739147 (the Tome actor, ActorEvents_229) fills `DNSM.TomeQTY`, one quantity per task
// of CustomLists.Tome, in its order (the task index of the Tome list). It is session state, not in the save (Ruling A): here it is the event
// replayed on the save, without its side effects.
//
// Before the quantities the event raises three account records to their live value (OptionsListAccount[198] to MoneyBANK, [200] to the
// Drop Rate, [202] to the Crystal Spawn chance; [224], to the Greenstacks, comes with task 44): the save is immutable, so the raised record
// is kept in memory. The Drop Rate is not raised (an `assumed:` on TomeQTY[18], like the load step DoOnceREAL < 378). The scene gate
// (`"utorial"`) does not apply: a tracked account is in the world.
import { asNum, asNumber, attr } from "../attr";
import { assumed, block, withPlayer, type Ctx } from "../ctx";
import { DeathNoteMobs, MapAFKtarget, MapDetails, NinjaInfo, RANDOlist, SceneNPCquestOrder, Tome } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { lengthOf, listAt, listOrMapAt } from "../lists";
import { DROP_RATE_RECORD } from "../migrations";
import { currency, skillLevelsMax } from "../player";
import { range } from "../ported";
import type { GameState } from "../state";
import { ArbitraryCode } from "./ArbitraryCode";
import { getLOG } from "./getLOG";
import { Ninja } from "./Ninja";
import { CARD_INFO, RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { TotalTalentPoints } from "./TotalTalentPoints";

/** The quantities ported so far: 0..41 and 107 (counted in the same loop as 10 and 21). */
const PORTED_QTY: ReadonlySet<number> = new Set([...range(0, 42), 107]);
/** The quantities not ported yet: `tomeQty` throws NotPorted for them. */
export const PENDING_QTY: ReadonlySet<number> = new Set(range(0, Tome.length).filter((i) => !PORTED_QTY.has(i)));

/** Σ asNumber(list[i]) over a list the save may keep as a `{i, length}` map (the game's loader gives a list). */
function sumOf(ctx: Ctx, name: string, ...idx: number[]): number {
  let s = 0;
  for (let i = 0, n = lengthOf(listOrMapAt(ctx, name, ...idx)); i < n; i++) s += asNum(ctx, name, ...idx, i);
  return s;
}

/** The event on this character and map, in the game's order. A quantity not ported yet is NaN. */
function event(ctx: Ctx): number[] {
  const q = Array<number>(Tome.length).fill(NaN);
  const ola = (i: number) => asNum(ctx, "OptionsListAccount", i);
  const players = ctx.state.charNames.length;
  // @5739649 / @5740104: the records the event raises first (in memory)
  const money = asNum(ctx, "MoneyBANK");
  const ola198 = money > ola(198) ? money : ola(198);
  const crystal = ArbitraryCode(ctx, "CrystalSpawn");
  const ola202 = crystal > ola(202) ? crystal : ola(202);

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
  q[18] = ola(200); // @5746788, under an assumed: in tomeQty
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
  return q;
}

/** The arrays built, per state and then per character and map: the event reads the whole save, so it runs once for each. */
const built = new WeakMap<GameState, Map<string, readonly number[]>>();

/** `DNSM.TomeQTY`, the event's quantities for the current character and map (NaN where not ported yet). Built once per state. */
export function TomeQTY(ctx: Ctx): readonly number[] {
  let mine = built.get(ctx.state);
  if (!mine) built.set(ctx.state, (mine = new Map()));
  const key = `${ctx.player}|${ctx.map}`;
  let q = mine.get(key);
  if (!q) mine.set(key, (q = Object.freeze(event(ctx))));
  return q;
}

/** `DNSM.TomeQTY[i]`, read by key: a quantity not ported yet throws NotPorted. */
export const tomeQty = block("DNSM.TomeQTY", (ctx, i: number) => {
  if (!(0 <= i && i < Tome.length)) throw new RangeError(`DNSM.TomeQTY: no task ${i} in CustomLists.Tome`);
  if (PENDING_QTY.has(i)) throw new NotPorted("TomeQTY", `i=${i}`);
  const v = TomeQTY(ctx)[i];
  if (18 != i) return v;
  return assumed(
    ctx,
    DROP_RATE_RECORD.key,
    "Tome counts the saved Drop Rate record, where the game raises it to the live Drop Rate first",
    v,
    "TomeQTY[18] = OptionsListAccount[200] @5746788, which the event first raises to the live TotalStats(Drop_Rarity) off map 216 (@5739896): not ported, the saved record is used (the load step DoOnceREAL < 378 resets it to 1)"
  );
});
