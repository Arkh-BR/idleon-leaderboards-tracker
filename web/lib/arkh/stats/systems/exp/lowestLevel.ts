// N.js ExpMulti(0) merit block (@4239109): the active character's class level
// must be strictly below every other character's (a tie fails).
import { numCharacters } from "../../../save/data";

export function isLowestLevel(ci: number, s: any): boolean {
  const lv = (c: number) => Number((s.lv0AllData as any[])?.[c]?.[0]) || 0;
  for (let c = 0; c < numCharacters; c++) if (c !== ci && !(lv(ci) < lv(c))) return false;
  return true;
}
