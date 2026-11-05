import { afkTarget } from "../afkTarget";
import { asNum, asNumber } from "../attr";
import { block, withPlayer, type Ctx } from "../ctx";
import { DreamChallenge, MapAFKtarget, MapDetails, MONSTERS } from "../data";
import { InvalidSaveValue, NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt, listOrMapAt } from "../lists";
import { GetTalentNumber } from "./GetTalentNumber";
import { PlayerAccTot } from "./PlayerAccTot";
import { ReturnClasses } from "./ReturnClasses";
import type { Ported } from "../ported";

/** The length of a list the save keeps as a list or as a {"0": …, "length": n} map (the cloud's sparse lists: CauldronInfo[4], StampLevelMAX[t]). */
const lengthOf = (l: object): number => (Array.isArray(l) ? l.length : asNumber((l as { length?: unknown }).length));

/**
 * Two of the four counts (the others feed keys Damage does not read) of the maps whose monster is a FIGHTING one (the loop @4474411 inside `TalentCalc(d <= 0)`): over MapAFKtarget while the
 * map is in the current character's KillsLeft2Advance (a map with no monster is skipped; the first one past the list ends the loop), a map
 * adds to `dn1` at 1e5 kills of the current character (MapDetails[g][0][0] minus its KillsLeft2Advance[g][0]); for the
 * last character whose fourth class step is 10 (`who`, DNSM.CalcTalentDT1; none: no count) it adds to `dn4` at 1e9.
 */
function fightingMaps(ctx: Ctx): { dn1: number; dn4: number } {
  let who = -1; // DNSM.CalcTalentDT1 ("No")
  for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (10 == ReturnClasses(asNum(withPlayer(ctx, t), "CharacterClass"))[3] && (-1 == who || t > who)) who = t;
  const kills = listAt(ctx, "KillsLeft2Advance").length;
  const out = { dn1: 0, dn4: 0 };
  const targets = MapAFKtarget as unknown as readonly unknown[];
  for (let g = 0; g < targets.length; g++) {
    const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[hString(targets[g])];
    if (!mob) continue;
    if (!(g < kills)) break;
    if ("FIGHTING" != mob.AFKtype) continue;
    const total = asNumber((MapDetails as unknown as readonly (readonly (readonly unknown[])[])[])[g][0][0]);
    if (1e5 <= total - asNum(ctx, "KillsLeft2Advance", g, 0)) out.dn1 += 1;
    if (-1 != who) {
      if (1e9 <= total - asNum(withPlayer(ctx, who), "KillsLeft2Advance", g, 0)) out.dn4 += 1;
    }
  }
  return out;
}

/**
 * `DNSM.CalcTalentMAP[key]`, the counts every `TalentCalc(d <= 0)` rebuilds (@4467058) that the talents scale with. Only the keys Damage
 * and the character stats reach:
 *  - "31" @4468257: the lowest of the current character's nine skill levels (Lv0[1..9], from 1000);
 *  - "110" @4475960: the FIGHTING maps with 1e5 kills of the current character (fightingMaps), at most talent 110's second curve;
 *  - "209" @4476257: the FIGHTING maps with a billion kills of the last character whose fourth class step is 10; 0 with no such character;
 *  - "305" @4477679: the length of the Cards[1] list after the walk that drops its "Gem" and "Cards" entries (@4476811). The walk reads
 *    each element at `g - DN1`, where DN1 still holds the sum of RoyalG[0][0..7] (key 235's counter @4476758, never reset before this
 *    loop) and grows by one per entry dropped: a quirk of the game, ported as it is;
 *  - "470" @4478721: the stamps (StampLevelMAX of the three tabs) above 0.5;
 *  - "485" @4479149: the vials (CauldronInfo[4]) above level 3;
 *  - "616" @4479621: the highest Lv0[0] over the characters whose class is below 6 (the beginner line);
 *  - "620" @4480414: the account's highest character level (Lv0[0] over PlayerDATABASE, from 0);
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
    case "110":
      return Math.min(fightingMaps(ctx).dn1, GetTalentNumber(ctx, 2, 110));
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
 * tracked account is not on. Only the talents Damage and the character stats reach.
 */
export const TalentCalc = block("TalentCalc", (ctx, d: number) => {
  switch (d) {
    // @4515400: talent 31 times a fifth of the lowest skill level, rounded down
    case 31:
      return GetTalentNumber(ctx, 1, 31) * Math.floor(DNSM_CalcTalentMAP(ctx, "31") / 5);
    // @4515988: talent 110 times its maps
    case 110:
      return GetTalentNumber(ctx, 1, 110) * DNSM_CalcTalentMAP(ctx, "110");
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
export const PORTED: Ported = [31, 110, 125, 485, 305, 470, 656, 616, 620];
