import { asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { EquipmentSets } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";

type EquipmentSet = readonly (readonly unknown[])[];

/** The set `d` of `CustomMaps.EquipmentSets`; the game indexes `.h[d]` and would throw on a set it does not have. */
function setOf(d: string): EquipmentSet {
  const set = (EquipmentSets as Record<string, EquipmentSet>)[d];
  if (!set) throw new RangeError(`GetSetBonus: no set ${d} in EquipmentSets`);
  return set;
}

/** N.js `D.contains(list, x)` @2160529: loose `==` against every element; a missing list contains nothing. The save keeps the lists as `{"0": …}` maps. */
function contains(list: unknown, x: unknown): boolean {
  if (list == null) return false;
  const values: unknown[] = Array.isArray(list) ? list : Object.values(list as object);
  return values.some((v) => v == x);
}

/**
 * N.js `_customBlock_GetSetBonus(d, b, e, f)` @11096567: the equipment set `d`; `b` says what is asked. Only the sub-cases the Artifact
 * Find port reaches. `e` is not read; `f` is only the game's "rebuild the cache" flag (-1), which the replay below does not need.
 */
export const GetSetBonus: (ctx: Ctx, d: string, b: string, e: number, f: number) => number = block(
  "GetSetBonus",
  (ctx, d: string, b: string, _e: number, _f: number) => {
    switch (b) {
      // @11096613: how many parts of set d the character wears: the pieces of [0] in EquipmentOrder[0], the tools of [1] in
      // EquipmentOrder[1] (at most [3][0] of them), and one weapon of [2] in EquipmentOrder[0] when [3][1] is 1
      case "PartsOn": {
        const set = setOf(d);
        let parts = 0; // DNSM.SetzuDN1
        for (const piece of set[0]) if (contains(attr(ctx, "EquipmentOrder", 0), piece)) parts++;
        let tools = 0; // DNSM.SetzuDN2
        for (const tool of set[1]) if (contains(attr(ctx, "EquipmentOrder", 1), tool) && Math.round(tools) < asNumber(set[3][0])) (parts++, tools++);
        if (1 == asNumber(set[3][1])) for (const weapon of set[2]) if (contains(attr(ctx, "EquipmentOrder", 0), weapon)) { parts++; break; }
        return Math.round(parts);
      }
      // @11098155
      case "PartsReq": {
        const set = setOf(d);
        return Math.round(set[0].length + (asNumber(set[3][0]) + asNumber(set[3][1])));
      }
      // @11098422: the set's bonus, set[3][2], when it is permanently unlocked (named in OptionsListAccount[379]) or worn whole, else 0.
      // The game fills DNSM.SetBonusTOTz for every set the first time it is asked (and when f == -1) and, for a set worn whole while
      // OptionsListAccount[380] == 1, writes the set's name into OptionsListAccount[379]. That write never changes the value of this call
      // (the set is then unlocked, with the same bonus), so only the asked set is computed.
      case "Bonus": {
        const set = setOf(d);
        const bonus = asNumber(set[3][2]);
        if (hString(attr(ctx, "OptionsListAccount", 379)).split(",").some((n) => n == d)) return bonus;
        return GetSetBonus(ctx, d, "PartsOn", 0, 0) >= GetSetBonus(ctx, d, "PartsReq", 0, 0) ? bonus : 0;
      }
      default:
        throw new NotPorted("GetSetBonus", b);
    }
  }
);
