import { asNum, asNumber } from "../attr";
import { block, withPlayer } from "../ctx";
import { MapAFKtarget, MapDetails, MONSTERS } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { GetTalentNumber } from "./GetTalentNumber";
import { ReturnClasses } from "./ReturnClasses";
import type { Ported } from "../ported";

/**
 * `DNSM.CalcTalentMAP[key]`, the counts every `TalentCalc(d <= 0)` rebuilds (@4467058) that the talents scale with. Only the keys the
 * character stats reach:
 *  - "620" @4480414: the account's highest character level (Lv0[0] over PlayerDATABASE, from 0);
 *  - "209" @4476257: the maps whose monster is a FIGHTING one (MapAFKtarget in MonsterDefinitions, while the map is in the current
 *    character's KillsLeft2Advance) where the last character whose fourth class step is 10 has a billion kills (MapDetails[g][0][0] minus
 *    its KillsLeft2Advance[g][0]); 0 when there is no such character.
 */
export const DNSM_CalcTalentMAP = block("DNSM.CalcTalentMAP", (ctx, key: string) => {
  switch (key) {
    case "620": {
      let top = 0;
      for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (asNum(withPlayer(ctx, t), "Lv0", 0) > top) top = asNum(withPlayer(ctx, t), "Lv0", 0);
      return top;
    }
    case "209": {
      let who = -1; // DNSM.CalcTalentDT1 ("No")
      for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (10 == ReturnClasses(asNum(withPlayer(ctx, t), "CharacterClass"))[3] && (-1 == who || t > who)) who = t;
      if (-1 == who) return 0;
      const kills = listAt(ctx, "KillsLeft2Advance").length;
      let maps = 0; // DNSM.CalcTalentDN4
      const targets = MapAFKtarget as unknown as readonly unknown[];
      for (let g = 0; g < targets.length; g++) {
        const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[hString(targets[g])];
        if (!mob) continue;
        if (!(g < kills)) break;
        if ("FIGHTING" != mob.AFKtype) continue;
        if (1e9 <= asNumber((MapDetails as unknown as readonly (readonly (readonly unknown[])[])[])[g][0][0]) - asNum(withPlayer(ctx, who), "KillsLeft2Advance", g, 0)) maps += 1;
      }
      return maps;
    }
    default:
      throw new NotPorted("DNSM.CalcTalentMAP", `CalcTalentMAP:key=${key}`);
  }
});

/**
 * N.js `_customBlock_TalentCalc(d)` @4464686: `d <= 0` rebuilds the DNSM caches (CalcTalentMAP above; BoxRewards, AlchBubbles,
 * FamBonusQTYs... in DNSM.ts, one cache each); a talent id reads one of them. The function opens with a Tutorial-scene guard, which a
 * tracked account is not on. Only the talents the character stats reach.
 */
export const TalentCalc = block("TalentCalc", (ctx, d: number) => {
  switch (d) {
    // @4518948: talent 620, at most a tenth of the account's highest level
    case 620:
      return Math.min(GetTalentNumber(ctx, 1, 620), Math.floor(DNSM_CalcTalentMAP(ctx, "620") / 10));
    default:
      throw new NotPorted("TalentCalc", `d=${d}`);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [620];
