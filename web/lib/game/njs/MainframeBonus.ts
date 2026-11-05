import { asNumber, attr } from "../attr";
import { assumed, block, type Ctx } from "../ctx";
import { JewelDesc, LabMainBonus, NinjaInfo } from "../data";
import { NotPorted } from "../errors";
import { listAt } from "../lists";
import { Breeding } from "./Breeding";
import { Ninja } from "./Ninja";
import type { Ported } from "../ported";

type Row = readonly unknown[];

/**
 * `CustomLists.LabMainBonus` as the running game has it. The data file holds the 14 base bonuses (0..13); the Laboratory actor's
 * Create @10087158 then pushes `NinjaInfo[25 + e]` for each Emporium item `8 + e` (e = 0..3) the account owns, in order, so the first
 * item owned becomes bonus 14 (item 8 is Artifact Attraction, 9 Slab Sovereignty, 10 Spiritual Growth, 11 Depot Studies PhD). The
 * `length < 15 + e` guard of the game is always true at its turn (the list has grown at most e times), so it is kept as written.
 */
function labMainBonus(ctx: Ctx): Row[] {
  const list = [...(LabMainBonus as unknown as Row[])];
  for (let e = 0; e < 4; e++) {
    if (list.length < 15 + e && 1 == Ninja(ctx, "EmporiumBonus", Math.round(8 + e), 0)) list.push((NinjaInfo as unknown as Row[])[25 + e]);
  }
  return list;
}

/**
 * `GenINFO[92][d]` of the Laboratory actor (ActorEvents_548): 1 when the mainframe bonus `d` is connected. The actor sets it from the
 * Lab page's live state (`_customEvent_Lab` with the "d" trigger @10069277, setting 1 @10073751): the characters standing in the
 * lab (AFK target "Laboratory", or a Divinity link), where each is (Lab[0]), the width of each one's line (meals, chips, cards,
 * pets, jewels) and the distance to the node. The save has all of that, but replaying it is the lab's whole connection walk, which
 * this engine does not port. Until it does, the node is counted as connected, as lib/arkh does ("assume the lab is built"), by a
 * declared `assumed()` (Ruling J): the trace says so, this is an assumption, not a read. For an account whose lab does not reach the
 * node the game's bonus is the inactive value (LabMainBonus[d][4]) instead.
 */
function labNodeConnected(ctx: Ctx, d: number): boolean {
  const connected = assumed(
    ctx,
    `GenINFO[92][${d}]`,
    "lab node counted as connected (the game checks it live)",
    1,
    "the Laboratory's connection walk (ActorEvents_548 @10069277) is not ported; the node is counted as connected (Ruling J)"
  );
  return 1 == connected;
}

/**
 * N.js `_customBlock_MainframeBonus(d)` @7990420, for the bonuses Artifact Find reaches (14, Artifact Attraction, through the Emporium;
 * 10, My 1st Chemistry Set, read by the vials), the character stats reach (7 for the stamps, 104 for the % to all stats with 8 and
 * 119 under it) and Damage reaches (0 with 101 under it, 11 with 117, jewel 110 with 107..109, and 15 / 17 under the artifact and crop
 * multipliers with 118 / 120). The other bonuses throw NotPorted.
 *
 * The game keeps the values in `DNSM.LabMFbonuses`. Once that map holds "YES" the function returns `LabMFbonuses[d]`, which
 * TalentCalc(-7) @4511431 filled by asking this function for every bonus while the map had no "YES": `1 == GenINFO[92][d] ? row[5] :
 * row[4]` for a bonus with no rule of its own, row = LabMainBonus[d] ([5] when connected, [4] when not). 10 and 14 have none, and
 * the later changes to the map (9, 11 and 114 are multiplied; 8, 13, 105 and 109 follow the connection) are not theirs. Past the end
 * of LabMainBonus the answer is 0, so bonus 14 is 0 for an account that owns none of the four Emporium items.
 */
export const MainframeBonus: (ctx: Ctx, d: number) => number = block("MainframeBonus", (ctx, d: number) => {
  if (!PORTED_SET.has(d)) throw new NotPorted("MainframeBonus", `d=${d}`);
  const list = labMainBonus(ctx);
  if (d >= list.length && 99 > d) return 0;
  if (100 > d) {
    const row = list[d];
    if (!labNodeConnected(ctx, d)) return asNumber(row[4]);
    // @7990420: the bonuses with a rule of their own add a jewel under them (0 also times the pets found, 8 a hundredth of 119); 5, 7, 10,
    // 13 and 14 have none. TalentCalc(-7) @4511431 then times the stored 11 by the GreenStacks the account has (the "YES" pass).
    const v = asNumber(row[5]);
    if (0 == d) return (v + MainframeBonus(ctx, 101)) * Breeding(ctx, "TotPetsFound", "0", 0, 0);
    if (3 == d) return v + MainframeBonus(ctx, 107);
    if (11 == d) return (v + MainframeBonus(ctx, 117)) * listAt(ctx, "GreenStacks").length;
    if (15 == d) return v + MainframeBonus(ctx, 118);
    if (17 == d) return v + MainframeBonus(ctx, 120);
    return 8 == d ? v + MainframeBonus(ctx, 119) / 100 : v;
  }
  // a jewel (d - 100 of JewelDesc), connected through GenINFO[92][d - 100 + LabMainBonus.length]: 119 is its value [12], 104 and 116 its value
  // times bonus 8
  const jewel = (JewelDesc as unknown as readonly (readonly unknown[])[])[(d - 100) | 0];
  // the game indexes JewelDesc[d - 100][12] directly and would throw on a jewel it does not have
  if (!jewel) throw new RangeError(`MainframeBonus: no jewel ${d - 100} in JewelDesc`);
  // a jewel is only on the board once the account owns it (Lab[14][j] == 1, which the connection walk checks @10071907); an owned one is
  // assumed in reach like the main bonuses (Ruling J)
  if (!(1 == attr(ctx, "Lab", 14, (d - 100) | 0) && labNodeConnected(ctx, d - 100 + list.length))) return 0;
  if (119 == d) return asNumber(jewel[12]);
  const j = asNumber(jewel[12]) * MainframeBonus(ctx, 8);
  // jewel 110 is doubled when jewels 107, 108 and 109 are all above 0
  return 110 == d && 0 < MainframeBonus(ctx, 107) && 0 < MainframeBonus(ctx, 108) && 0 < MainframeBonus(ctx, 109) ? 2 * j : j;
});

const PORTED_SET = new Set([0, 3, 5, 7, 8, 10, 11, 13, 14, 15, 17, 101, 104, 107, 108, 109, 110, 116, 117, 118, 119, 120]);

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [...PORTED_SET];
