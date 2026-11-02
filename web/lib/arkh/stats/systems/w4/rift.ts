// ===== RIFT (W4): skill mastery, Death Note eclipse skulls, Killroy =====
// N.js RiftStuff (@10789969): "skillLvRanks", "RiftSkillBonus,<f>" and
// "RiftSkillETC". From Rift 15 each skill's account-wide total level earns
// mastery ranks; RiftSkillETC sums the per-skill bonuses one stat reads.
// "eclipseSkulls" and "KillroyDMG" are Max damage's two Rift factors.
import { numCharacters } from "../../../save/data";
import { DeathNoteMobs, MapAFKtarget } from "../../data/game/customlists.js";
import { accountMapKills } from "../coin/accountKills";
import { deathNoteRank } from "../coin/gambit";
import type { SaveData } from "../../../state";

// @njs eclipseSkulls
/** N.js RiftStuff("eclipseSkulls") (@10792655): 5 per World 1–6 Death Note
 *  mob whose account kills on its map reach DeathNoteRank ≥ 15 (the eclipse
 *  skull: > 1e9 kills from Rift 20). */
export function eclipseSkulls(s: SaveData): number {
  const mapOf = MapAFKtarget as unknown as string[];
  let n = 0;
  for (let w = 0; w < 6; w++)
    for (const mob of (DeathNoteMobs as unknown as string[][])[w] ?? []) {
      const m = mapOf.indexOf(mob);
      if (m >= 0 && deathNoteRank(accountMapKills(m), s) >= 15) n++;
    }
  return 5 * n;
}

// @njs KillroyDMG
/** N.js RiftStuff("KillroyDMG") (@10791738): ⌊(Σ KRbest[mob] over every
 *  DeathNoteMobs list)^0.4⌋, KRbest = the best Killroy kills per monster. */
export function killroyDmg(s: SaveData): number {
  const kr = (s.krBestData ?? {}) as Record<string, unknown>;
  let t = 0;
  for (const list of DeathNoteMobs as unknown as string[][]) for (const mob of list) t += Number(kr[mob]) || 0;
  return Math.floor(Math.pow(t, 0.4));
}

// @njs skillLvRanks
/** Skill f's rank 0–7: Σ Lv0[f + 1] over every character against
 *  150 / 200 / 300 / 400 / 500 / 750 / 1000. */
export function skillLvRank(f: number, s: SaveData): number {
  let total = 0;
  for (let ci = 0; ci < numCharacters; ci++) total += Number((s.lv0AllData as any)?.[ci]?.[f + 1]) || 0;
  return [150, 200, 300, 400, 500, 750, 1000].filter((t) => total >= t).length;
}

// @njs RiftSkillETC
/** N.js RiftStuff("RiftSkillETC", b). It starts at 7 (the game's own seed),
 *  then over the first 18 skills adds RiftSkillBonus(f, k) = Rift[0] ≥ 15 and
 *  rank > k: b 1 → 10 each at k 3, b 3 → 1 at k 5, b 4 → 25 at k 6, any other
 *  b → 5 at k b + 2, skipping skills 0, 2, 3, 5, 6, 8. */
export function riftSkillETC(b: number, s: SaveData): number {
  const on = (Number((s.riftData as any)?.[0]) || 0) >= 15;
  const bonus = (f: number, k: number) => (on && skillLvRank(f, s) > k ? 1 : 0);
  let v = 7;
  for (let f = 0; f < 18; f++) {
    if (b === 1) v += 10 * bonus(f, 3);
    else if (b === 3) v += bonus(f, 5);
    else if (b === 4) v += 25 * bonus(f, 6);
    else if (![0, 2, 3, 5, 6, 8].includes(f)) v += 5 * bonus(f, b + 2);
  }
  return v;
}
