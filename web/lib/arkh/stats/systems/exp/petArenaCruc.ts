// ===== PET ARENA CRUCIBLE (W4 Breeding, 2026-10-16) =====
// N.js Breeding("PetArenaCrucBonus","0",e,0) = CalcTalentMAP.arenaCruc > e ? 1 : 0.
// TalentCalc fills arenaCruc once per pass:
//   arenaCruc = 0; if 1 == MenagerieStuff("UnlockOwned",8,0):
//     for g in 0..15: OLA[628] >= RANDOlist[115][g] ? arenaCruc = g+1 : break
// i.e. the count of RANDOlist[115] waves the Crucible's best wave (OLA[628])
// has reached, only once Menagerie Unlock 8 is bought.
// ponytail: lives with EXP (its first caller); move to w4/ when another stat needs it.
import { RANDOlist } from "../../data/game/customlists.js";
import { optionsListData } from "../../../save/data";
import { menagerieUnlockOwned } from "../../data/w7/menagerie";
import type { SaveData } from "../../../state";

export function arenaCrucWave(): number {
  return Number((optionsListData as any[])?.[628]) || 0;
}

export function arenaCrucTier(s: SaveData): number {
  if (menagerieUnlockOwned(8, s) !== 1) return 0;
  const reqs = ((RANDOlist as any[])[115] ?? []) as unknown[];
  const wave = arenaCrucWave();
  let n = 0;
  for (let g = 0; g < 16; g++) {
    if (wave >= Number(reqs[g])) n = g + 1;
    else break;
  }
  return n;
}

// @njs PetArenaCrucBonus
export function petArenaCrucBonus(e: number, s: SaveData): number {
  return arenaCrucTier(s) > e ? 1 : 0;
}
