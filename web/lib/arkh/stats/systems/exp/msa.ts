// ===== MSA TOTALIZER (W5 Gaming) =====
// N.js GamingStatType("MSA_Bonus",b,0) (@10670134) reads ActorEvents_481's
// _GenINFO[114] (PixelHelperActor[8]). That actor's init (@8993985) fills
// index 114 once per load as Σ TotemInfo[0][f] (@9028193) — the account's
// total Worship waves, straight from the save — so the bonus derives from
// the save. The branch's `114 < _GenINFO.length` guard always holds once
// the game has loaded.
// @njs MSA_Bonus
// ponytail: only b=4 (Class EXP) is ported; add another slot's branch when
// a page reads it (each has its own coefficient and super-bit gate).
import { superBitType } from "../../../game-helpers";
import type { SaveData } from "../../../state";

/** _GenINFO[114]: Σ TotemInfo[0] (skips a deserialized array's "length" key). */
export function msaTotalWaves(s: SaveData): number {
  const waves = (s.totemInfoData as any)?.[0];
  if (!waves || typeof waves !== "object") return 0;
  let sum = 0;
  for (const k of Object.keys(waves)) if (/^\d+$/.test(k)) sum += Number(waves[k]) || 0;
  return sum;
}

/** MSA_Bonus(4): SuperBitType(11) ? 1.12 · floor(waves/10) : 0. */
export function msaClassExp(s: SaveData): number {
  if (superBitType(11, (s.gamingData as any)?.[12]) !== 1) return 0;
  return 1.12 * Math.floor(msaTotalWaves(s) / 10);
}
