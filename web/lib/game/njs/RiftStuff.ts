import { asNum, asNumber } from "../attr";
import { block, withPlayer, type Ctx } from "../ctx";
import { DeathNoteMobs, MapAFKtarget, MapDetails } from "../data";
import { NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt, listOrMapAt } from "../lists";
import { Breeding } from "./Breeding";
import { WorkbenchStuff } from "./WorkbenchStuff";
import type { Ported } from "../ported";

/** N.js `_customBlock_RiftStuff(d, b)` @10789971. Only the sub-cases the Artifact Find port, Damage and Coin reach. */
export const RiftStuff = block("RiftStuff", (ctx, d: string, b: number) => {
  // @10796299: `0 == d.indexOf("RiftSkillBonus")`, a name with the skill after a comma ("RiftSkillBonus,<f>"): 0 below Rift 15, else 1
  // when the account's rank in skill f (skillLvRanks) is above b
  if (0 == d.indexOf("RiftSkillBonus")) return 15 > rift(ctx) ? 0 : skillLvRanks(ctx)[asNumber(d.split(",")[1]) | 0] > b ? 1 : 0;
  switch (d) {
    // @10790146: the Rift monster's HP at the account's Rift level r: 5e6 x (1.11 + .02 min(1, r / 10) + .08 min(1, max(0, r - 10) / 20) + .18 min(1, max(0, r - 20) / 23))^r
    case "mobHP": {
      const r = rift(ctx);
      return 5e6 * Math.pow(1.11 + 0.02 * Math.min(1, r / 10) + (0.08 * Math.min(1, Math.max(0, r - 10) / 20) + 0.18 * Math.min(1, Math.max(0, r - 20) / 23)), r);
    }
    // @10791380: how many star signs the Rift lets the account run without wearing them: none below Rift 10, else 5 + the Breeding's
    // Shiny bonus 3
    case "enabledStarSigns":
      return 10 > rift(ctx) ? 0 : 5 + Breeding(ctx, "ShinyBonusS", "Nah", 3, -1);
    // @10791078: the fifth card star, from Rift 45
    case "5starCards":
      return 45 > rift(ctx) ? 0 : 1;
    // @10794405: the Rift bonus b is unlocked from Rift 5 (b + 1)
    case "riftBonus":
      return rift(ctx) >= 5 * (b + 1) ? 1 : 0;
    case "KillroyDMG":
      return killroyDMG(ctx);
    case "eclipseSkulls":
      return eclipseSkulls(ctx);
    case "RiftSkillETC":
      if (0 != b) throw new NotPorted("RiftStuff", `RiftSkillETC:b=${b}`); // 2 is [~] (unreached.ts)
      return riftSkillETC(ctx, b);
    default:
      throw new NotPorted("RiftStuff", d);
  }
});

const rift = (ctx: Ctx): number => {
  listAt(ctx, "Rift"); // the game indexes Rift[0] directly
  return asNum(ctx, "Rift", 0);
};

const mobs = DeathNoteMobs as unknown as readonly (readonly unknown[])[];

/**
 * `KillroyDMG` @10791738: floor((the best Killroy kills, KRbest[name], summed over every Death Note monster of every world)^.4). The game
 * keeps it for the session (DNSM.KilRoDmg); here it is computed from the save each time.
 */
function killroyDMG(ctx: Ctx): number {
  const best = listOrMapAt(ctx, "KRbest") as Record<string, unknown>;
  let total = 0; // DNSM.KilRoDmg
  for (let d = 0; d < mobs.length; d++) for (let k = 0; k < mobs[d].length; k++) total += asNum(ctx, "KRbest", hString(mobs[d][k]));
  return Math.floor(Math.pow(total, 0.4));
}

/**
 * `eclipseSkulls` @10792655: 5 per Death Note monster of the worlds 0..5 whose map (MapAFKtarget.indexOf) the account has a Death Note
 * rank of 15 or more on (WorkbenchStuff DeathNoteRank of the kills there: the current character's, then every other one's, MapDetails[m][0][0]
 * minus KillsLeft2Advance[m][0]). A monster on no map counts 0 kills. The game keeps the count for the session (DNSM.EclipseSk).
 */
function eclipseSkulls(ctx: Ctx): number {
  const details = MapDetails as unknown as readonly (readonly (readonly unknown[])[])[];
  const targets = MapAFKtarget as unknown as readonly unknown[];
  let skulls = 0; // DNSM.EclipseSk
  for (let d = 0; d < 6; d++)
    for (let k = 0; k < mobs[d].length; k++) {
      const m = targets.indexOf(mobs[d][k]); // DummyNumber3
      let kills = 0; // DummyNumber4
      if (0 <= m) {
        const on = (c: Ctx) => {
          listAt(c, "KillsLeft2Advance", m); // the game indexes KillsLeft2Advance[m][0] directly
          return asNumber(details[m][0][0]) - asNum(c, "KillsLeft2Advance", m, 0);
        };
        kills = on(ctx);
        for (let t = 0, n = ctx.state.charNames.length; t < n; t++) if (t !== ctx.player) kills = kills + on(withPlayer(ctx, t));
      }
      if (15 <= WorkbenchStuff(ctx, "DeathNoteRank", kills, 0)) skulls = Math.round(skulls + 1);
    }
  return 5 * skulls;
}

/**
 * `skillLvRanks` @10794492: for each of the 24 skills, the account's total level (Lv0[f + 1] summed over every character) ranked 0..7 at
 * 150, 200, 300, 400, 500, 750 and 1000. The game builds it once (DNSM.skillLvRanks, when RiftSkillBonus first asks).
 */
function skillLvRanks(ctx: Ctx): number[] {
  const ranks: number[] = [];
  for (let f = 0; f < 24; f++) {
    let total = 0; // DNSM.skillLvRanksDN
    for (let t = 0, n = ctx.state.charNames.length; t < n; t++) total += asNum(withPlayer(ctx, t), "Lv0", f + 1);
    ranks.push(150 > total ? 0 : 200 > total ? 1 : 300 > total ? 2 : 400 > total ? 3 : 500 > total ? 4 : 750 > total ? 5 : 1e3 > total ? 6 : 7);
  }
  return ranks;
}

/**
 * `RiftSkillETC` @10796692: 7, plus, over the 18 skills f, RiftSkillBonus("<f>", b + 2) times 10 (b = 1), 1 (b = 3), 25 (b = 4), or, for any
 * other b, 5 for the skills but 0, 2, 3, 5, 6 and 8.
 */
function riftSkillETC(ctx: Ctx, b: number): number {
  let v = 7; // DNSM.skillLvRanksDN2
  for (let f = 0; f < 18; f++) {
    const on = () => RiftStuff(ctx, `RiftSkillBonus,${f}`, Math.round(b + 2));
    if (1 == b) v = v + 10 * on();
    else if (3 == b) v = v + on();
    else if (4 == b) v = v + 25 * on();
    else if (0 != f && 2 != f && 3 != f && 5 != f && 6 != f && 8 != f) v = v + 5 * on();
  }
  return v;
}

/** What this module covers (lib/game/ported.ts). `"()"` is the call with a computed name, RiftSkillETC's `"RiftSkillBonus,<f>"`. */
export const PORTED: Ported = { mobHP: true, enabledStarSigns: true, "5starCards": true, riftBonus: true, KillroyDMG: true, eclipseSkulls: true, RiftSkillETC: [0] /* 2: only SkillStats AllEfficiencies (unreached.ts) */, "()": ["RiftSkillBonus,0"] };
