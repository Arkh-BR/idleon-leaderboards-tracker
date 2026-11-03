// ===== ROO BONUSES (Poppy the Kangaroo Mouse) =====
// A leaf module: the accuracy in derived-damage reads RooBonuses(3) and must
// not go through coin.ts (coin → overkill → damage → derived-damage).
// coin.ts re-exports it for Coin and AFK; the damage system and the accuracy
// import this leaf directly.
import { node, type ArkhNode } from "../../../node";
import { optionsListData } from "../../../save/data";
import { legendPTSbonus } from "../w7/spelunking";
import { companions } from "../common/companions";
import type { SaveData } from "../../../state";

const raw = (name: string, v: number, note?: string): ArkhNode => node(name, v, null, { fmt: "raw", note });

/** N.js Summoning("RooBonuses", idx) (@10827396): coef·(1 + Legend26/100)·
 *  (1 + Companions(51))·(1 + RooBonusAll/100)·max(0, ⌈(OLA[271] − idx)/7⌉),
 *  RooBonusAll = the megafeather %. N.js coef per idx 0–6: 3, 3, 5, 2, 2, .5, 3. */
// @njs RooBonuses
export function rooBonus(idx: number, coef: number, s: SaveData): { val: number; children: ArkhNode[] } {
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const mf = (k: number) => (ola(279) > k ? (k === 11 ? ola(279) - 11 : 1) : 0);
  const all = 50 * mf(1) + 50 * mf(3) + 50 * mf(6) + 50 * mf(8) + 50 * Math.min(1, mf(11)) + 25 * Math.max(0, mf(11) - 1);
  const legend = legendPTSbonus(26, s);
  const c51 = companions(51, s);
  const steps = Math.max(0, Math.ceil((ola(271) - idx) / 7));
  return {
    val: coef * (1 + legend / 100) * (1 + c51) * (1 + all / 100) * steps,
    children: [raw("Legend 26", legend), raw("Companion 51", c51), raw("Megafeathers %", all), raw("Roo reset tiers", steps, `⌈(OLA[271] − ${idx}) / 7⌉: one tier per 7 Roo resets (OLA[271]) beyond this upgrade's offset`)],
  };
}
