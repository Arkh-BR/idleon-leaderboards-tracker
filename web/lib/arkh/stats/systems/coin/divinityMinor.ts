// ===== DIVINITY MINOR BONUS (coin) =====
// Port of N.js Divinity("Bonus_Minor", -1, type): the sum, over players, of
// each one's minor bonus for the god whose minor type is `type`.
// Sources: Divinity("Bonus_Minor", -1, e) @10684830; DivMinorBonus @10688050;
// PocketDivOwned @10903585.

import {
  divinityData,
  optionsListData,
  numCharacters,
  cauldronInfoData,
  cauldronBubblesData,
} from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { bubbleParams } from "../../data/w2/alchemy";
import { DIVINITY_MINOR_DENOM } from "../../data/game-constants";
import { godsType } from "../../data/w4/gods";
import { godMinorX1 } from "../../data/w5/divinity";
import { companions } from "../common/companions";
import { cosmoBonus } from "../w5/hole";
import type { SaveData } from "../../../state";

/** N.js Holes("PocketDivOwned", type). */
export function pocketDivOwned(type: number, saveData: SaveData): number {
  const h11 = (((saveData.holesData as any[]) ?? [])[11] ?? []) as unknown[];
  const cosmo = cosmoBonus(saveData, 2, 0);
  if (godsType(Number(h11[29])) === type && cosmo > 0) return 1;
  if (godsType(Number(h11[30])) === type && cosmo > 1) return 1;
  return 0;
}

/** N.js AlchBubbles.Y2ACTIVE for the active char — same rule talent.ts uses
 *  for its own "Divinity Minor 2 (Arctis)" term (computeAllTalentLVz,
 *  common/talent.ts:757-778): bubble 3/21 ("d21") value if the all-bubbles
 *  companion (4) is owned, or the active char has it equipped. */
function y2Active(activeCi: number, saveData: SaveData): number {
  const bp = bubbleParams(3, 21);
  const lv = Number((cauldronInfoData as any[])?.[3]?.[21]) || 0;
  const val = bp && lv > 0 ? formulaEval(bp.formula, bp.x1, bp.x2, lv) : 0;
  const allBubbles = !!saveData.companionIds?.has(4);
  const equipped = !!(cauldronBubblesData as any[])?.[activeCi]?.includes?.("d21");
  return allBubbles || equipped ? val : 0;
}

/** N.js Divinity("DivMinorBonus", f, godIdx). */
function divMinorBonus(f: number, godIdx: number, activeCi: number, saveData: SaveData): number {
  const lv = Number((saveData.lv0AllData as any[])?.[f]?.[14]) || 0;
  const coral = Number((optionsListData as any[])[430]) || 0;
  const x1 = godMinorX1(godsType(godIdx));
  return (
    Math.max(1, y2Active(activeCi, saveData)) *
    (1 + coral / 100) *
    (lv / (DIVINITY_MINOR_DENOM + lv)) *
    x1
  );
}

export function divinityMinorSum(type: number, activeCi: number, saveData: SaveData): number {
  const typeOfGod: number[] = [];
  for (let g = 0; g < 10; g++) typeOfGod.push(godsType(g));
  const everyone =
    companions(0, saveData) === 1 ||
    pocketDivOwned(type, saveData) === 1 ||
    Number((optionsListData as any[])[425]) === type + 1;
  let sum = 0;
  for (let f = 0; f < 12; f++) {
    if (!everyone || (type !== 3 && type !== 5)) {
      const linked = Number((divinityData as any[])[f + 12]);
      if (Number.isFinite(linked) && linked !== -1 && godsType(linked) === type) {
        sum += divMinorBonus(f, linked, activeCi, saveData);
      }
    } else if (f < numCharacters) {
      sum += divMinorBonus(f, typeOfGod.indexOf(type), activeCi, saveData);
    }
  }
  return sum;
}
