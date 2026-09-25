// ===== OVERKILL (damage tier) =====
// N.js RunCodeOfTypeXforThingY("OverkillStuffs", b) (@4075410): the damage
// tier the AFK Info's purple bar shows ("2"), its two thresholds ("0", "1")
// and the multikill activation flag ("3"), measured against the AFK target's
// HP as performETCaction("MonsterRespawnTimeReset") (@6458543) leaves it:
// every monster's HP × (1 + (curse 0 + curse 7 + curse 8)/100) — Big Brain
// Time, Midas Minded, Jawbreaker, equipped by this character (@6466526) —
// THEN the Clamworks clam w7a6 set to Thingies("Clamz_HP") = 1e16·30^OLA[464]
// (@10887166, @6467129), so the clam never carries the curses.
// Shared by Coin's talent 643 and the Multikill page (spec M5). Not
// derived-damage.ts:computeOverkillTier (MapAFKtarget + a FIGHTING gate, no
// curses), which keeps feeding talent.resolve(643)'s wrap.

import { MapAFKtarget } from "../../data/game/customlists.js";
import { MONSTERS } from "../../data/game/monsters.js";
import { optionsListData, currentMapData } from "../../../save/data";
import { prayersReal } from "../w3/prayer";
import { computeAccuracy, computeMaxDamage } from "./derived-damage";
import type { SaveData } from "../../../state";

// @njs OverkillStuffs
/** OverkillStuffs("2"): t = 1; for f = 0..49: Max ≥ HP·E·E^(f+1) → t = f + 2,
 *  else stop. So tier k ⇔ HP·E^k ≤ Max < HP·E^(k+1); 1 below HP·E²; cap 51.
 *  Moved unchanged from coin.ts. */
export function multikillTier(hp: number, maxDmg: number, exponent: number): number {
  if (hp <= 0) return 1;
  let tier = 1;
  for (let st = 0; st < 50; st++) {
    if (maxDmg >= hp * exponent * Math.pow(exponent, st + 1)) tier = st + 2;
    else break;
  }
  return tier;
}

export type Overkill = {
  map: number;
  /** AFKtarget_N on the character's own saved map, MapAFKtarget[map] elsewhere (spec M1). */
  target: string;
  /** The Clamworks clam (w7a6): Clamz_HP, never cursed. */
  clam: boolean;
  /** The table's MonsterHPTotal, or Clamz_HP for the clam. */
  staticHp: number;
  /** Curses 0 / 7 / 8 in % (0 for the clam). */
  curses: [number, number, number];
  /** 1 + Σ curses/100. */
  curse: number;
  hp: number;
  /** OverkillEXPONENT: 5 on maps ≥ 300, else 2. */
  exponent: number;
  maxDmg: number;
  tier: number;
  /** OverkillStuffs("0"): HP at tier 1, else HP·E^tier. */
  tierAt: number;
  /** OverkillStuffs("1"): HP·E^(tier+1). */
  nextAt: number;
};

// @njs MonsterRespawnTimeReset
// @njs Clamz_HP
/** `opts.maxDmg`: the character's max damage when the caller already has it
 *  (it depends on the character, not on the map or target). */
export function overkillStuffs(
  ci: number,
  map: number,
  ctx: { saveData: SaveData; afkTarget?: string },
  opts?: { maxDmg?: number }
): Overkill {
  const s = ctx.saveData;
  const savedMap = Number((currentMapData as any)?.[ci]);
  const target = String((map === savedMap && ctx.afkTarget ? ctx.afkTarget : (MapAFKtarget as any)[map]) ?? "");
  const clam = target === "w7a6";
  const curses = [0, 7, 8].map((d) => (clam ? 0 : Number(prayersReal(d, 1, ci, s).val) || 0)) as [number, number, number];
  const curse = 1 + (curses[0] + curses[1] + curses[2]) / 100;
  const staticHp = clam
    ? 1e16 * Math.pow(30, Number((optionsListData as any[])[464]) || 0)
    : Number((MONSTERS as any)[target]?.MonsterHPTotal) || 0;
  const hp = staticHp * curse;
  const exponent = map >= 300 ? 5 : 2;
  // Not swallowed: a failing max damage must surface, not read as tier 1.
  const maxDmg = opts?.maxDmg || computeMaxDamage(ci, { saveData: s, charIdx: ci }) || 0;
  const tier = multikillTier(hp, maxDmg, exponent);
  return {
    map, target, clam, staticHp, curses, curse, hp, exponent, maxDmg, tier,
    tierAt: tier === 1 ? hp : hp * Math.pow(exponent, tier),
    nextAt: hp * Math.pow(exponent, tier + 1),
  };
}

export type OverkillActive = {
  active: boolean;
  maxOk: boolean;
  deathNote: boolean;
  accOk: boolean;
  accuracy: number;
  defence: number;
  /** The target's AFKtype; the AFK Info prints the MULTIKILL line only for "FIGHTING". */
  type: string;
};

/** OverkillStuffs("3"): Max ≥ HP·E && TowerInfo[2] > 0.5 (Death Note built)
 *  && PlayerAccTot() > 1.5·Defence(target). The game applies the multikill
 *  only when it holds, and prints the AFK Info line only for a FIGHTING
 *  target (@3835457). */
export function overkillActive(ok: Overkill, ci: number, s: SaveData): OverkillActive {
  const mon = (MONSTERS as any)[ok.target];
  const defence = Number(mon?.Defence) || 0;
  const accuracy = computeAccuracy(ci, { saveData: s, charIdx: ci });
  // A target missing from MONSTERS has no HP (N.js reads undefined: the test is false).
  const maxOk = ok.hp > 0 && ok.maxDmg >= ok.hp * ok.exponent;
  const deathNote = (Number((s.towerData as any)?.[2]) || 0) > 0.5;
  const accOk = accuracy > 1.5 * defence;
  return {
    active: maxOk && deathNote && accOk,
    maxOk, deathNote, accOk, accuracy, defence,
    type: String(mon?.AFKtype ?? "no definition"),
  };
}
