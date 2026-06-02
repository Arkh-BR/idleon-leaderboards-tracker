// ===== BREEDING DATA =====
// 1:1 port of corgan-source/js/stats/data/w4/breeding.js.
import { PetStats as _PetStats, RANDOlist } from "../game/customlists.js";
import { MONSTERS } from "../game/monsters.js";

const _petStatsArr = _PetStats as any[][];
const _monsters = MONSTERS as Record<string, any>;
const _rando = RANDOlist as any[];

export const PET_STATS: number[][][] = _petStatsArr.map((world: any[]) =>
  world.map((p: any) => [p[0], Number(p[5])])
);

export const PET_NAMES: string[][] = _petStatsArr.map((world: any[]) =>
  world.map((p: any) =>
    (_monsters[p[0]] ? _monsters[p[0]].Name : p[0]).replace(/_/g, " ")
  )
);

export const PET_SHINY_TYPE: number[][] = _petStatsArr.map((world: any[]) =>
  world.map((p: any) => Number(p[5]))
);

export const SHINY_TYPE_TO_CAT: number[] = (_rando[90] as any[]).map(Number);
export const SHINY_CAT_NAMES: string[] = (_rando[91] as any[]).map((s: string) =>
  s.replace(/_/g, " ")
);
export const SHINY_CAT_BONUS_PER_LV: number[] = (_rando[92] as any[]).map(Number);
export const SHINY_BONUS_PER_LV: number[] = SHINY_TYPE_TO_CAT.map(
  (cat) => SHINY_CAT_BONUS_PER_LV[cat]
);
