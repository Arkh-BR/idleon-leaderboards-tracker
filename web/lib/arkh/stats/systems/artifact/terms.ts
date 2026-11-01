// ===== ARTIFACT FIND: REMAINING TERMS =====
// One export per N.js term the Artifact Find chance reads that the engine never
// ported. The sailing terms (captains, Davey Jones, Nightmariner levels) live
// in w5/sailing.ts, the sticker slot in exp/sticker.ts, Artifosho in
// common/starSign.ts.

import { optionsListData } from "../../../save/data";
import { getLOG } from "../../../formulas";
import { Spelunky, GrimoireUpg } from "../../data/game/customlists.js";
import { menagerieUnlockOwned } from "../../data/w7/menagerie";
import { grimoireUpgBonus } from "../mc/grimoire";
import { getSetBonus } from "../w3/setBonus";
import { nightmarinerTotLv } from "../w5/sailing";
import type { SaveData } from "../../../state";

const ola = (i: number) => Number((optionsListData as any[])?.[i]) || 0;

/** Hours of Fractal Island needed for bonus idx (GenINFO[25], @11687464). */
const FRACTAL_HOURS = [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4] as const;

/** N.js Thingies("FractalIslandBonus", idx) (@10778571) = DNSM.FracIsBn[idx],
 *  which the load code (@11687464) fills with 1 once OLA[184] ≥ GenINFO[25][idx]. */
// @njs FractalIslandBonus
export function fractalIslandBonus(idx: number, _s: SaveData): number {
  return ola(184) >= (FRACTAL_HOURS[idx] ?? Infinity) ? 1 : 0;
}

/** N.js "KillroyBonuses" 0 (@10777364): 1 + OLA[228]/(300 + OLA[228]). */
// @njs KillroyBonuses
export function killroyBonus0(_s: SaveData): number {
  const k = ola(228);
  return 1 + k / (300 + k);
}

/** N.js "NightmarinerBon" 0 (@5182505): with Menagerie unlock 13,
 *  max(1, 1 + 1999·T/(T + 1e4)), T = the Nightmariner level total; else 1. */
// @njs NightmarinerBon
export function nightmarinerBon0(s: SaveData): number {
  if (menagerieUnlockOwned(13, s) !== 1) return 1;
  const t = nightmarinerTotLv(s);
  return Math.max(1, 1 + 1999 * (t / (t + 1e4)));
}

/** N.js Holes("B_UPG", 55) (@10992210): 0 until Holes[13][55] is bought, then
 *  10·⌊getLOG(Holes[9][11])⌋. */
// @njs B_UPG
export function holesBUpg55(s: SaveData): number {
  const holes = s.holesData as any[];
  if (!(Number(holes?.[13]?.[55]) || 0)) return 0;
  return 10 * Math.floor(getLOG(Number(holes[9]?.[11]) || 0));
}

/** N.js Spelunking("LoreEpiBon", idx) (@10970997), recomputed each call (the
 *  game caches it in DNSM): once Spelunk[13][2] > idx,
 *  (1 + (Grimoire 17 + TROLL_SET)/100) · a · f(tome − b), Spelunky[21][idx] =
 *  "a|b", f(x) = p/(25 + p), p = ⌊max(0, x)/100⌋^0.7. The Tome score is
 *  GenInfo[84] (TomeQTYtot). */
// @njs LoreEpiBon
export function loreEpiBon(idx: number, s: SaveData): number {
  const entry = (Spelunky as any[])[21]?.[idx];
  if (entry == null || !((Number((s.spelunkData as any[])?.[13]?.[2]) || 0) > idx)) return 0;
  const [a, b] = String(entry).split("|").map(Number);
  const p = Math.pow(Math.floor(Math.max(0, s.totalTomePoints - b) / 100), 0.7);
  const grimoire = grimoireUpgBonus(17, GrimoireUpg, s);
  return (1 + (grimoire + getSetBonus("TROLL_SET").val) / 100) * a * Math.max(0, p / (25 + p));
}
