// `ScrollCircleINFO[43]` of the menu actor (ActorEvents_29): the obols' stats, which TotalStats reads. The actor builds it from the save
// when it is created and again whenever the obols change (@7093622, the same code @6741023 and @6843360), so it is a function of the
// save: this replays the build for the current player.
import { asNumber, attr } from "../attr";
import type { Ctx } from "../ctx";
import { InvalidSaveValue } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { itemDef } from "./TotalStats";

/** One row: the stat, what the character's own obols give, what the family obols give, and the two summed ([3]). */
export type ObolRow = [stat: unknown, own: unknown, family: unknown, total: number];

/** `_ItemStatsDisplayOrder[2..10]` @7076383: the stats read off each obol, the two unique stats last. */
const STATS = ["Weapon_Power", "STR", "AGI", "WIS", "LUK", "Reach", "Defence", "UQ1txt", "UQ2txt"];

/** The sparse-list lengths of the obol maps (@19936560): ObolEqMAP_<player> has 21 slots, ObolEqMAPz1 (the family's) 24. */
const MAP_SLOTS = [21, 24];

/** `ObolEquippedMap[g][q]`: a slot the save does not have is an empty map (`getLoadSparseList`); past the list the game reads undefined. */
function obolMap(ctx: Ctx, g: number, q: number): Readonly<Record<string, unknown>> {
  if (!(q < MAP_SLOTS[g])) throw new RangeError(`ScrollCircleINFO43: obol slot ${q} is past ObolEquippedMap[${g}]`);
  const v = attr(ctx, "ObolEquippedMap", g, q);
  if (v === undefined) return {};
  if (v === null || typeof v !== "object") throw new InvalidSaveValue(`ObolEquippedMap[${g}][${q}]`, "a map", v);
  return v as Readonly<Record<string, unknown>>;
}

/** What the obol in slot q of list g reads off: one [stat, value] per STATS entry, the build keeping the positive ones. Nothing for a "Blank" or locked `slot` (ObolEquippedOrder[g][q]). */
export function obolEntries(ctx: Ctx, g: number, q: number, slot: unknown): unknown[][] {
  const name = hString(slot);
  if ("ObolLocked" == name.substring(0, 10) || "Blank" == slot) return [];
  const def = itemDef(name);
  const own = obolMap(ctx, g, q);
  return STATS.map((text, e) => {
    let entry: unknown[];
    if (Object.hasOwn(own, text) && 7 > e) entry = [text, asNumber(def[text]) + asNumber(own[text])];
    else if (7 > e) entry = [text, def[text]];
    else if ("0" != def[text]) {
      const valKey = text.replace("txt", "val");
      entry = Object.hasOwn(own, valKey) ? [def[text], asNumber(def[valKey]) + asNumber(own[valKey])] : [def[text], def[valKey]];
    } else entry = ["NULL", 0];
    if (0 == e) {
      if (-1 != name.indexOf("Mining") || "PICKAXE" == def.Type) entry[0] = "Mining_Power";
      else if (-1 != name.indexOf("Choppin") || "HATCHET" == def.Type) entry[0] = "Choppin_Power";
      else if (-1 != name.indexOf("Fishing")) entry[0] = "Fishing_Power";
      else if (-1 != name.indexOf("Catching")) entry[0] = "Catching_Power";
      else if (-1 != name.indexOf("Trapping")) entry[0] = "Trapping_Power";
      else if (-1 != name.indexOf("Worship")) entry[0] = "Worship_Power";
    }
    return entry;
  });
}

/**
 * The build @7093622: ten rows to start (Weapon_Power, Mining_Power, Choppin_Power, FILLERlol, STR, AGI, WIS, LUK, Defence, Reach), then
 * for the character's obols (g = 0, ObolEquippedOrder[0]) and the family's (g = 1), every obol that is not "Blank" or locked: each stat
 * of STATS its definition has, plus the obol's own value (ObolEquippedMap) when it has one; a unique stat by its text (UQ1txt), with
 * its UQ1val. A Weapon_Power on a pickaxe (or an obol named "Mining") counts as Mining_Power, on a hatchet ("Choppin") as Choppin_Power,
 * and "Fishing" / "Catching" / "Trapping" / "Worship" in the obol's name as those powers. A positive value goes into column g + 1 of
 * its stat's row (a new row, past the ten, for a stat not there yet), and [3] is the two columns summed.
 */
export function ObolStats(ctx: Ctx): ObolRow[] {
  const rows: ObolRow[] = ["Weapon_Power", "Mining_Power", "Choppin_Power", "FILLERlol", "STR", "AGI", "WIS", "LUK", "Defence", "Reach"].map((s) => [s, 0, 0, 0]);
  const names: unknown[] = rows.map((r) => r[0]); // _DummyList3
  for (let g = 0; g < 2; g++) {
    const order = listAt(ctx, "ObolEquippedOrder", g);
    for (let q = 0; q < order.length; q++) {
      for (const entry of obolEntries(ctx, g, q, order[q])) {
        if (!(0 < asNumber(entry[1]))) continue;
        let i = names.indexOf(entry[0]);
        if (-1 != i) rows[i][g + 1] = asNumber(rows[i][g + 1]) + asNumber(entry[1]);
        else {
          names.push(entry[0]);
          entry.push(entry[1]);
          entry[2 - g] = 0;
          entry[3] = 0;
          rows.push(entry as ObolRow);
          i = rows.length - 1;
        }
        rows[i][3] = asNumber(rows[i][1]) + asNumber(rows[i][2]);
      }
    }
  }
  return rows;
}
