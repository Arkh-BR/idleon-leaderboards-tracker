import { afkTarget } from "../afkTarget";
import { asNum, asNumber, attr } from "../attr";
import { assumed, block, withPlayer, type Ctx } from "../ctx";
import { DreamChallenge, MapAFKtarget, MapDetails, MONSTERS, RANDOlist } from "../data";
import { InvalidSaveValue, NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains, lengthOf, listAt, listOrMapAt } from "../lists";
import { GetTalentNumber } from "./GetTalentNumber";
import { getbonus2 } from "./getbonus2";
import { MenagerieStuff } from "./MenagerieStuff";
import { PlayerAccTot } from "./PlayerAccTot";
import { ReturnClasses } from "./ReturnClasses";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import type { Ported } from "../ported";

/** The length of a list the save keeps as a list or as a {"0": …, "length": n} map (the cloud's sparse lists: CauldronInfo[4], StampLevelMAX[t]). */

/**
 * Three of the four counts (DN3, at 1e8, feeds a key no talent here reads) of the maps whose monster is a FIGHTING one (the loop @4474411 inside `TalentCalc(d <= 0)`): over MapAFKtarget while the
 * map is in the current character's KillsLeft2Advance (a map with no monster is skipped; the first one past the list ends the loop), a map
 * adds to `dn1` at 1e5 kills of the current character (MapDetails[g][0][0] minus its KillsLeft2Advance[g][0]) and to `dn2` at 1e6 (@4474795); for the
 * last character whose fourth class step is 10 (`who`, DNSM.CalcTalentDT1; none: no count) it adds to `dn4` at 1e9.
 */
function fightingMaps(ctx: Ctx): { dn1: number; dn2: number; dn4: number } {
  let who = -1; // DNSM.CalcTalentDT1 ("No")
  for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (10 == ReturnClasses(asNum(withPlayer(ctx, t), "CharacterClass"))[3] && (-1 == who || t > who)) who = t;
  const kills = listAt(ctx, "KillsLeft2Advance").length;
  const out = { dn1: 0, dn2: 0, dn4: 0 };
  const targets = MapAFKtarget as unknown as readonly unknown[];
  for (let g = 0; g < targets.length; g++) {
    const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[hString(targets[g])];
    if (!mob) continue;
    if (!(g < kills)) break;
    if ("FIGHTING" != mob.AFKtype) continue;
    const total = asNumber((MapDetails as unknown as readonly (readonly (readonly unknown[])[])[])[g][0][0]);
    if (1e5 <= total - asNum(ctx, "KillsLeft2Advance", g, 0)) out.dn1 += 1;
    if (1e6 <= total - asNum(ctx, "KillsLeft2Advance", g, 0)) out.dn2 += 1;
    if (-1 != who) {
      if (1e9 <= total - asNum(withPlayer(ctx, who), "KillsLeft2Advance", g, 0)) out.dn4 += 1;
    }
  }
  return out;
}

/**
 * `DNSM.CalcTalentMAP[key]`, the counts every `TalentCalc(d <= 0)` rebuilds (@4467058) that the talents scale with. Only the keys the trackers
 * and /talents-level's wraps reach:
 *  - "31" @4468257: the lowest of the current character's nine skill levels (Lv0[1..9], from 1000);
 *  - "57" @4472039: the best Lv0[7] + Lv0[9] (Trapping + Worship) over the characters whose class is below 6, less 100, at least 0;
 *  - "59" @4472836: Σ Meals[0] (every meal's level), at least 0;
 *  - "110" @4475960: the FIGHTING maps with 1e5 kills of the current character (fightingMaps), at most talent 110's second curve;
 *  - "146" @4476138: the same at 1e6 kills, at most talent 146's second curve;
 *  - "209" @4476257: the FIGHTING maps with a billion kills of the last character whose fourth class step is 10; 0 with no such character;
 *  - "305" @4477679: the length of the Cards[1] list after the walk that drops its "Gem" and "Cards" entries (@4476811). The walk reads
 *    each element at `g - DN1`, where DN1 still holds the sum of RoyalG[0][0..7] (key 235's counter @4476758, never reset before this
 *    loop) and grows by one per entry dropped: a quirk of the game, ported as it is;
 *  - "430" @4477810: Σ Ninja[103] (the Ninja knowledge upgrades; the game adds 1 to it as an upgrade is bought, @11407106, which the next rebuild sums again);
 *  - "470" @4478721: the stamps (StampLevelMAX of the three tabs) above 0.5;
 *  - "485" @4479149: the vials (CauldronInfo[4]) above level 3;
 *  - "595" @4479280: Σ Summon[0] (the summoning upgrades; the Summoning actor writes the same sum @11677687);
 *  - "644" @4480598: Lv0[10] / 10, the character's Cooking level;
 *  - "616" @4479621: the highest Lv0[0] over the characters whose class is below 6 (the beginner line);
 *  - "620" @4480414: the account's highest character level (Lv0[0] over PlayerDATABASE, from 0);
 *  - "643" @4480462: -11 after every rebuild, and OverkillStuffs("2") once TalentCalc(643) finds that (@4519205): see TalentCalc 643;
 *  - "arena" @4467173: the Pet Arena waves cleared in a row by the best wave (OptionsListAccount[89] against RANDOlist[53][g]);
 *  - "arenaCruc" @4467464: the same for the Crucible (OptionsListAccount[628] against RANDOlist[115][g]), 0 without the Menagerie unlock 8;
 *  - "650" @4480714: how many of the items RANDOlist[82..86] lists (hats, rings, tools, obols) the account has found (Cards[1]); an item counts once;
 *  - "656" @4481319: the DreamChallenge entries whose WeeklyBoss "d_<n>" is -1 (the loop is skipped in the Tutorial scene, which a tracked
 *    account is not in).
 */
export const DNSM_CalcTalentMAP = block("DNSM.CalcTalentMAP", (ctx, key: string) => {
  switch (key) {
    case "31": {
      let low = 1e3; // DNSM.CalcTalentDN1 (the guard `!(8 < g)` is always true for g < 9)
      for (let g = 0; 9 > g; g++) if (asNum(ctx, "Lv0", g + 1) < low) low = asNum(ctx, "Lv0", g + 1);
      return low;
    }
    case "57": {
      let best = 0; // DNSM.CalcTalentDN1
      for (let t = 0, n = ctx.state.charNames.length; t < n; t++) {
        const p = withPlayer(ctx, t);
        if (6 > asNum(p, "CharacterClass") && asNum(p, "Lv0", 7) + asNum(p, "Lv0", 9) > best) best = asNum(p, "Lv0", 7) + asNum(p, "Lv0", 9);
      }
      return Math.max(0, best - 100);
    }
    case "59": {
      let sum = 0;
      for (let g = 0, n = listAt(ctx, "Meals", 0).length; g < n; g++) sum += asNum(ctx, "Meals", 0, g);
      return Math.max(0, sum);
    }
    case "110":
      return Math.min(fightingMaps(ctx).dn1, GetTalentNumber(ctx, 2, 110));
    case "146":
      return Math.min(fightingMaps(ctx).dn2, GetTalentNumber(ctx, 2, 146));
    case "430": {
      let sum = 0;
      for (let g = 0, n = listAt(ctx, "Ninja", 103).length; g < n; g++) sum += asNum(ctx, "Ninja", 103, g);
      return sum;
    }
    case "595": {
      let sum = 0;
      for (let g = 0, n = listAt(ctx, "Summon", 0).length; g < n; g++) sum += asNum(ctx, "Summon", 0, g);
      return sum;
    }
    // the game finds -11 here after every rebuild and stores the tier the first time TalentCalc(643) asks (@4519205), keeping it until the next rebuild (the scene load and the stat panels call
    // TalentCalc(d <= 0)); here it is worked out now for ctx.map, stated as an assumption
    case "643":
      return assumed(ctx, 'DNSM.CalcTalentMAP["643"]', "multikill tier worked out for this map (the game keeps the one it found at its last stat rebuild)", RunCodeOfTypeXforThingY(ctx, "OverkillStuffs", "2"), "TalentCalc(643) @4519205 stores OverkillStuffs(\"2\") in DNSM.CalcTalentMAP[\"643\"] when it finds -11 (@4480476); the stored tier stays until the next TalentCalc(d <= 0)");
    case "209":
      return fightingMaps(ctx).dn4;
    case "305": {
      const list = listAt(ctx, "Cards", 1).slice(); // u.deepCopyList (the cards are strings)
      let dn1 = 0; // DNSM.CalcTalentDN1: still the Royal Guardian sum
      listAt(ctx, "RoyalG", 0); // the game indexes RoyalG[0][g] directly
      for (let g = 0; 8 > g; g++) dn1 += asNum(ctx, "RoyalG", 0, g);
      for (let f = 0, t = list.length; f < t; ) {
        const g = f++;
        const at = list[(g - dn1) | 0];
        if (0 == hString(at).indexOf("Gem") || 0 == hString(at).indexOf("Cards")) {
          const i = list.indexOf(at); // ba.remove: the first element that is that one
          if (-1 != i) list.splice(i, 1);
          dn1 += 1;
        }
      }
      return list.length;
    }
    case "470": {
      let n = 0;
      for (let tab = 0; 3 > tab; tab++) {
        const stamps = listOrMapAt(ctx, "StampLevelMAX", tab); // the game indexes StampLevelMAX[tab].length directly
        for (let a = 0, len = lengthOf(stamps); a < len; a++) if (0.5 < asNum(ctx, "StampLevelMAX", tab, a)) n += 1;
      }
      return n;
    }
    case "485": {
      let n = 0;
      const vials = listOrMapAt(ctx, "CauldronInfo", 4);
      for (let g = 0, len = lengthOf(vials); g < len; g++) if (3 < asNum(ctx, "CauldronInfo", 4, g)) n += 1;
      return n;
    }
    case "644":
      return asNum(ctx, "Lv0", 10) / 10;
    case "616": {
      let top = 0;
      for (let t = 0, n = ctx.state.charNames.length; t < n; t++)
        if (6 > asNum(withPlayer(ctx, t), "CharacterClass") && asNum(withPlayer(ctx, t), "Lv0", 0) > top) top = asNum(withPlayer(ctx, t), "Lv0", 0);
      return top;
    }
    case "620": {
      let top = 0;
      for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (asNum(withPlayer(ctx, t), "Lv0", 0) > top) top = asNum(withPlayer(ctx, t), "Lv0", 0);
      return top;
    }
    // @4467173: how many Pet Arena waves the best one (OptionsListAccount[89]) clears in a row, RANDOlist[53][0..15]
    case "arena": {
      let n = 0;
      for (let g = 0; 16 > g; g++) {
        if (asNum(ctx, "OptionsListAccount", 89) >= asNumber((RANDOlist as unknown as readonly (readonly unknown[])[])[53][g])) n = g + 1;
        else break;
      }
      return n;
    }
    // @4467464 (the lines after "arena"): the Pet Arena Crucible waves cleared in a row by the best one (OptionsListAccount[628] against
    // RANDOlist[115][g]), 0 unless the Menagerie unlock 8 is owned
    case "arenaCruc": {
      let n = 0;
      if (1 == MenagerieStuff(ctx, "UnlockOwned", 8, 0)) {
        for (let g = 0; 16 > g; g++) {
          if (asNum(ctx, "OptionsListAccount", 628) >= asNumber((RANDOlist as unknown as readonly (readonly unknown[])[])[115][g])) n = g + 1;
          else break;
        }
      }
      return n;
    }
    case "650": {
      const owned = attr(ctx, "Cards", 1);
      let n = 0;
      for (let g = 0; 5 > g; g++) for (const card of (RANDOlist as unknown as readonly (readonly unknown[])[])[82 + g]) if (contains(owned, card)) n += 1; // D.contains
      return n;
    }
    case "656": {
      let n = 0;
      for (let g = 0, len = (DreamChallenge as unknown as readonly unknown[]).length; g < len; g++) if (-1 == asNum(ctx, "WeeklyBoss", `d_${g}`)) n += 1;
      return n;
    }
    default:
      throw new NotPorted("DNSM.CalcTalentMAP", `CalcTalentMAP:key=${key}`);
  }
});

/**
 * N.js `_customBlock_TalentCalc(d)` @4464686: `d <= 0` rebuilds the DNSM caches (CalcTalentMAP above; BoxRewards, AlchBubbles,
 * FamBonusQTYs... in DNSM.ts, one cache each); a talent id reads one of them. The function opens with a Tutorial-scene guard, which a
 * tracked account is not on. Only the talents the trackers and /talents-level's wraps reach (595 has no case: Summoning("UpgCost") reads its CalcTalentMAP key).
 */
export const TalentCalc = block("TalentCalc", (ctx, d: number) => {
  switch (d) {
    // @4515400: talent 31 times a fifth of the lowest skill level, rounded down
    case 31:
      return GetTalentNumber(ctx, 1, 31) * Math.floor(DNSM_CalcTalentMAP(ctx, "31") / 5);
    // @4515534: the best character's talent 57 times the Trapping + Worship levels over 100
    case 57:
      return getbonus2(ctx, 1, 57, -1) * DNSM_CalcTalentMAP(ctx, "57");
    // @4515654: (1 + talent 59 / 100, at most 1.012) to the power of the meal levels, with the character's own talent 59 when it has it, the best character's otherwise
    case 59: {
      const own = GetTalentNumber(ctx, 1, 59);
      return Math.pow(Math.min(1.012, 1 + (0 < own ? own : getbonus2(ctx, 1, 59, -1)) / 100), DNSM_CalcTalentMAP(ctx, "59"));
    }
    // @4515988: talent 110 times its maps
    case 110:
      return GetTalentNumber(ctx, 1, 110) * DNSM_CalcTalentMAP(ctx, "110");
    // @4516605: talent 146 times its maps
    case 146:
      return GetTalentNumber(ctx, 1, 146) * DNSM_CalcTalentMAP(ctx, "146");
    // @4516732: talent 209 times its maps (only its tooltip asks; the gold food sum @5057606 reads getbonus2(1,209,-1) x CalcTalentMAP["209"])
    case 209:
      return GetTalentNumber(ctx, 1, 209) * DNSM_CalcTalentMAP(ctx, "209");
    // @4516984: talent 430 (the character's own when it has it, the best character's otherwise) times a tenth of the Ninja upgrades, rounded down
    case 430: {
      const own = GetTalentNumber(ctx, 1, 430);
      return (0 < own ? own : getbonus2(ctx, 1, 430, -1)) * Math.floor(DNSM_CalcTalentMAP(ctx, "430") / 10);
    }
    // @4516114: the six Refinery ranks (Refinery[3..8][1]) when the accuracy is at least 2.25 times the Defence of the monster of the
    // character's AFK target, else 0 (DamageDealed multiplies it by talent 125)
    case 125: {
      const target = afkTarget(ctx); // the target on ctx.map (Ruling V)
      const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[target];
      // the game reads MonsterDefinitionsGET[AFKtarget].Defence directly and would throw on a target it does not have
      if (!mob) throw new InvalidSaveValue("AFKtarget", "a MonsterDefinitions key", target);
      if (PlayerAccTot(ctx) >= 2.25 * asNumber(mob.Defence)) {
        let sum = 0; // DNSM.CalcTalentDN1
        for (let g = 0; 6 > g; g++) { listAt(ctx, "Refinery", 3 + g); /* the game indexes Refinery[3 + g][1] directly */ sum += asNum(ctx, "Refinery", 3 + g, 1); }
        return sum;
      }
      return 0;
    }
    // @4517416: talent 485 times its vials
    case 485:
      return GetTalentNumber(ctx, 1, 485) * DNSM_CalcTalentMAP(ctx, "485");
    // @4516861: talent 305 times its cards
    case 305:
      return GetTalentNumber(ctx, 1, 305) * DNSM_CalcTalentMAP(ctx, "305");
    // @4517290: talent 470 times its stamps
    case 470:
      return GetTalentNumber(ctx, 1, 470) * DNSM_CalcTalentMAP(ctx, "470");
    // @4519205: talent 643 times its multikill tier (DNSM_CalcTalentMAP "643" says why that tier is an assumption)
    case 643:
      return GetTalentNumber(ctx, 1, 643) * DNSM_CalcTalentMAP(ctx, "643");
    // @4519205: talent 644 times the Cooking level / 10
    case 644:
      return GetTalentNumber(ctx, 1, 644) * DNSM_CalcTalentMAP(ctx, "644");
    // @4520200: talent 650 times the items of RANDOlist[82..86] found (the `d == -7044.5` branch @4466996 after it, the item sell price
    // table, is not reached by a talent id)
    case 650:
      return GetTalentNumber(ctx, 1, 650) * DNSM_CalcTalentMAP(ctx, "650");
    // @4519089: talent 656 times its dream challenges
    case 656:
      return GetTalentNumber(ctx, 1, 656) * DNSM_CalcTalentMAP(ctx, "656");
    // @4518806: talent 616, at most a tenth of the highest beginner-line level
    case 616:
      return Math.min(GetTalentNumber(ctx, 1, 616), Math.floor(DNSM_CalcTalentMAP(ctx, "616") / 10));
    // @4518948: talent 620, at most a tenth of the account's highest level
    case 620:
      return Math.min(GetTalentNumber(ctx, 1, 620), Math.floor(DNSM_CalcTalentMAP(ctx, "620") / 10));
    default:
      throw new NotPorted("TalentCalc", `d=${d}`);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [31, 57, 59, 110, 125, 146, 209, 430, 485, 305, 470, 650, 656, 616, 620, 643, 644];
