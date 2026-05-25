// ===== W7 SUMMON DATA =====
// 1:1 port of corgan-source/js/stats/data/w7/summon.js.
import { SummonEnemies } from "../game/customlists.js";

const _summonEnemies = SummonEnemies as any[][];

export const SUMMON_ENDLESS_TYPE: number[] = _summonEnemies[9].map(Number);
export const SUMMON_ENDLESS_VAL: number[] = _summonEnemies[10].map(Number);

export const SUMMON_NORMAL_BONUS: Record<string, [number, number]> = (() => {
  const out: Record<string, [number, number]> = {};
  for (let i = 0; i < _summonEnemies[0].length; i++) {
    const mob = _summonEnemies[0][i];
    const t = _summonEnemies[5][i];
    const v = _summonEnemies[7][i];
    if (t === "_") continue;
    out[mob] = [Number(t), Number(v)];
  }
  return out;
})();
