// ===== DIVINITY MINOR BONUS (coin) =====
// Port of N.js Divinity("Bonus_Minor", -1, type): the sum, over players, of
// each one's minor bonus for the god whose minor type is `type`.
// Sources: Divinity("Bonus_Minor", -1, e) @10684830; DivMinorBonus @10688050;
// PocketDivOwned @10903585.

import {
  divinityData,
  optionsListData,
  numCharacters,
  skillLvData,
} from "../../../save/data";
import { bubbleValByKey } from "../w2/alchemy";
import { DIVINITY_MINOR_DENOM } from "../../data/game-constants";
import { godsType } from "../../data/w4/gods";
import { godMinorX1 } from "../../data/w5/divinity";
import { companions } from "../common/companions";
import { cosmoBonus } from "../w5/hole";
import { gridBonusValue } from "../w4/lab";
import type { SaveData } from "../../../state";

// @njs PocketDivOwned
/** N.js Holes("PocketDivOwned", type). */
export function pocketDivOwned(type: number, saveData: SaveData): number {
  const h11 = (((saveData.holesData as any[]) ?? [])[11] ?? []) as unknown[];
  const cosmo = cosmoBonus(saveData, 2, 0);
  if (godsType(Number(h11[29])) === type && cosmo > 0) return 1;
  if (godsType(Number(h11[30])) === type && cosmo > 1) return 1;
  return 0;
}

// @njs DivMinorBonus
/** N.js Divinity("DivMinorBonus", f, godIdx). Y2ACTIVE (BIG_P) is the
 *  active char's, Prisma included. */
function divMinorBonus(f: number, godIdx: number, activeCi: number, saveData: SaveData): number {
  const lv = Number((saveData.lv0AllData as any[])?.[f]?.[14]) || 0;
  const coral = Number((optionsListData as any[])[430]) || 0;
  const x1 = godMinorX1(godsType(godIdx));
  return (
    Math.max(1, bubbleValByKey("Y2ACTIVE", activeCi, saveData).val) *
    (1 + coral / 100) *
    (lv / (DIVINITY_MINOR_DENOM + lv)) *
    x1
  );
}

// @njs Bonus_Minor
/** N.js Divinity("Bonus_Minor", -1, type). */
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

// @njs Bonus_Minor
/** N.js Divinity("Bonus_Minor", charIdx, type) — the SINGLE-PLAYER branch
 *  (charIdx != -1), read from the same "Bonus_Minor"==d block as
 *  divinityMinorSum (@10684830), starting right after its `if(-1==b){...}`
 *  arm. EXP Multi's divMinor4 calls this shape (N.js @4241238:
 *  `Divinity("Bonus_Minor", GetPlayersUsernames.indexOf(UserInfo[0]), 4)`),
 *  NOT divinityMinorSum's roster-sum shape — Coin's divMinor3 is the only
 *  existing caller of that one, and it really does pass -1.
 *
 *  Differences from the roster-sum branch's "everyone" override:
 *    - applies for ANY type (not gated to type 3/5)
 *    - two more unlock conditions: ResearchStuff("Grid_Bonus",173,0)>=1 for
 *      type 2, and GemItemsPurchased[9]==1 for type 0
 *  When not "everyone": checks the character's own linked god
 *  (Divinity[charIdx+12]), then falls back to the Talent 505 (Polytheism)
 *  covenant — SkillLevels[505] mod 10 selects a god by raw index, gated on
 *  Divinity[25] (unlocked deities count) being greater than that index. */
export function divinityMinorFor(charIdx: number, type: number, saveData: SaveData): number {
  const grid173 = gridBonusValue(173, saveData);
  const gem9 = Number((saveData.gemItemsData as any[])?.[9]) || 0;
  const everyone =
    companions(0, saveData) === 1 ||
    pocketDivOwned(type, saveData) === 1 ||
    (grid173 >= 1 && type === 2) ||
    (gem9 === 1 && type === 0);
  if (everyone) {
    const typeOfGod: number[] = [];
    for (let g = 0; g < 10; g++) typeOfGod.push(godsType(g));
    return divMinorBonus(charIdx, typeOfGod.indexOf(type), charIdx, saveData);
  }

  const linked = Number((divinityData as any[])[charIdx + 12]);
  if (!Number.isFinite(linked) || linked === -1) return 0;
  if (godsType(linked) === type) return divMinorBonus(charIdx, linked, charIdx, saveData);

  // Talent 505 (Polytheism) covenant: raw SkillLevels[505] mod 10 = chosen
  // god index (N.js writes it as `lv505-10*floor(lv505/10)`, same thing for
  // lv505>=0), only live once Divinity[25] (unlocked deities) exceeds it.
  const lv505 = Number((skillLvData as any[])?.[charIdx]?.[505]) || 0;
  if (lv505 <= 0) return 0;
  const godIdx = lv505 % 10;
  if (godsType(godIdx) !== type) return 0;
  const unlockedDeities = Number((divinityData as any[])?.[25]) || 0;
  if (unlockedDeities <= godIdx) return 0;
  return divMinorBonus(charIdx, godIdx, charIdx, saveData);
}
