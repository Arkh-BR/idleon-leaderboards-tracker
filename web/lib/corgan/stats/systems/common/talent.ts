// ===== TALENT SYSTEM =====
// Pragmatic port of corgan-source/js/stats/systems/common/talent.js.
//
// Reads the raw talent level for a character and applies the talent
// formula via formulaEval. The full Corgan implementation also folds in
// `computeAllTalentLVz` — a chain of ~15 sources (Spelunk Super Talents,
// Talent 149/374/539, Achievement 291, Family Bonus 68, Companion 1,
// Divinity Minor 2, Dream 12, OLA 232, Grimoire 39, Kattlekruk Set, Arcane
// 57, SuperBit 47) that bumps the effective level. Stage 2 ships a stub of
// that chain that returns 0 — the resulting val matches the game for any
// account that hasn't farmed those sources, and is a small underestimate
// otherwise. The chain will be filled in incrementally in Stages 3-4.

import { node, type CorganNode } from "../../../node";
import {
  skillLvData,
  cauldronInfoData,
  cauldronBubblesData,
  optionsListData,
  playerStuffData,
  dreamData,
} from "../../../save/data";
import { formulaEval, getLOG } from "../../../formulas";
import { superBitType, cloudBonus } from "../../../game-helpers";
import { computeWinBonus, computeSummWinBonus24Parts } from "../w6/summoning";
import { DreamUpg } from "../../data/game/customlists.js";
import { hasBonusMajor } from "../w5/divinity";
import { label, entityName } from "../../entity-names";
import { talentParams, familyBonusParams } from "../../data/common/talent";
import { companionBonus } from "../../data/common/companions";
import { companionChild } from "./companions";
import { bubbleParams } from "../../data/w2/alchemy";
import { equipSetBonus } from "../../data/common/equipment";
import { godMinorX1 } from "../../data/w5/divinity";
import { DIVINITY_MINOR_DENOM } from "../../data/game-constants";
import { numCharacters, charClassData } from "../../../save/data";
import type { SaveData } from "../../../state";

type Ctx = {
  saveData: SaveData;
  charIdx: number;
  activeCharIdx?: number;
};

type TalentResolveArgs = {
  tab?: number;
  mode?: "max";
};

export type TalentBonusDetail = { total: number; children: CorganNode[] };

type ATLOpts = {
  contextSlot?: number;
  skipFamBonus68?: boolean;
  skipTal144FamMult?: boolean;
  partialFamBonusMap?: Record<number, number>;
};

/**
 * Full port of corgan-source computeAllTalentLVz.
 * Returns the total "AllTalentLVz" bonus added to a talent's base level.
 * Sources: Spelunk super talent, Talents 149/374/539, Achievement 291,
 * Family Bonus 68 (Mage), Companion 1 (Rift Slug), Divinity Minor 2 (Arctis),
 * Dream 12, OLA 232 (Sneaking), Grimoire 39, Kattlekruk Set, Arcane 57,
 * SuperBit 47 Level Bonus.
 */
export function computeAllTalentLVz(
  talentIdx: number,
  slotIdx: number,
  opts: ATLOpts | undefined,
  saveData: SaveData
): number {
  const ctxSlot =
    opts && opts.contextSlot !== undefined ? opts.contextSlot : slotIdx;
  if (
    (talentIdx >= 49 && talentIdx <= 59) ||
    talentIdx === 149 ||
    talentIdx === 374 ||
    talentIdx === 539 ||
    talentIdx === 505 ||
    talentIdx > 614
  ) {
    return 0;
  }

  // Spelunk super talent
  let spelunkBonus = 0;
  if (slotIdx >= 0) {
    const preset =
      Number(
        (playerStuffData as any)?.[slotIdx] && (playerStuffData as any)[slotIdx][1]
      ) || 0;
    const superArr =
      saveData.spelunkData &&
      (saveData.spelunkData as any)[20 + slotIdx + 12 * preset];
    if (Array.isArray(superArr) && superArr.indexOf(talentIdx) !== -1) {
      const base = 50;
      const legend7 =
        (Number(
          saveData.spelunkData &&
            (saveData.spelunkData as any)[18] &&
            (saveData.spelunkData as any)[18][7]
        ) || 0) * 10;
      const w7b5 =
        Number(
          saveData.spelunkData &&
            (saveData.spelunkData as any)[45] &&
            (saveData.spelunkData as any)[45][5]
        ) || 0;
      spelunkBonus = Math.round(base + legend7 + w7b5);
    }
  }

  // Talents 149/374/539: intervalAdd(1, 20, lv) on context character
  function intervalAddForChar(talId: number): number {
    const sl = ctxSlot >= 0 ? (skillLvData as any)[ctxSlot] : null;
    const lv = Number(sl && (sl[talId] || sl[String(talId)])) || 0;
    return lv > 0 ? 1 + Math.floor(lv / 20) : 0;
  }
  const tal149 = intervalAddForChar(149);
  const tal374 = intervalAddForChar(374);
  const tal539 = intervalAddForChar(539);
  const achieve291 =
    (saveData.achieveRegData as any)?.[291] === -1 ? 1 : 0;

  // Family Bonus 68 (Mage)
  let famBonus68 = 0;
  if (opts && opts.partialFamBonusMap !== undefined) {
    famBonus68 = Number(opts.partialFamBonusMap[68]) || 0;
  } else if (!(opts && opts.skipFamBonus68)) {
    const fb34 = familyBonusParams(34);
    let maxMageCharLv = 0;
    let maxMageCharIdx = -1;
    for (let ci = 0; ci < numCharacters; ci++) {
      const cls = (charClassData as any)[ci];
      if (cls === 34 || cls === 38) {
        const lv =
          (saveData as any).lv0AllData?.[ci] && (saveData as any).lv0AllData[ci][0] || 0;
        if (lv > maxMageCharLv) {
          maxMageCharLv = lv;
          maxMageCharIdx = ci;
        }
      }
    }
    const famN = Math.max(0, Math.round(maxMageCharLv - (fb34 as any).lvOffset));
    famBonus68 =
      famN > 0
        ? formulaEval((fb34 as any).formula, (fb34 as any).x1, (fb34 as any).x2, famN)
        : 0;
    // Talent 144 multiplier when active char IS max provider
    if (
      famBonus68 > 0 &&
      maxMageCharIdx === ctxSlot &&
      !(opts && opts.skipTal144FamMult)
    ) {
      const rawLv144 =
        Number((skillLvData as any)[ctxSlot] && (skillLvData as any)[ctxSlot][144]) ||
        0;
      if (rawLv144 > 0) {
        const atlFor144 = computeAllTalentLVz(
          144,
          slotIdx,
          Object.assign({}, opts, { skipTal144FamMult: true }),
          saveData
        );
        const effLv144 = rawLv144 + atlFor144;
        const t144 = talentParams(144);
        const tal144Val = formulaEval(
          (t144 as any).formula,
          (t144 as any).x1,
          (t144 as any).x2,
          effLv144
        );
        famBonus68 = famBonus68 * (1 + tal144Val / 100);
      }
    }
  }

  // Companion 1 (Rift Slug)
  const comp1 = saveData.companionIds && saveData.companionIds.has(1)
    ? companionBonus(1) : 0;

  // Divinity Minor 2 (Arctis)
  const y2bp = bubbleParams(3, 21);
  const y2BubbleLv =
    Number(
      (cauldronInfoData as any)?.[3] && (cauldronInfoData as any)[3][21]
    ) || 0;
  const y2Value =
    y2BubbleLv > 0
      ? formulaEval((y2bp as any).formula, (y2bp as any).x1, (y2bp as any).x2, y2BubbleLv)
      : 0;
  const allBubblesActive =
    saveData.companionIds && saveData.companionIds.has(4);
  let divMinor = 0;
  const coralKid3 = Number((optionsListData as any)?.[430]) || 0;
  if (ctxSlot >= 0 && hasBonusMajor(ctxSlot, 2, saveData)) {
    const divLv =
      ((saveData as any).lv0AllData?.[ctxSlot] && (saveData as any).lv0AllData[ctxSlot][14]) ||
      0;
    if (divLv > 0) {
      const includesY2 =
        (cauldronBubblesData as any)[ctxSlot] &&
        (cauldronBubblesData as any)[ctxSlot].includes("d21");
      const y2Active = allBubblesActive || includesY2 ? y2Value : 0;
      divMinor =
        Math.max(1, y2Active) *
        (1 + coralKid3 / 100) *
        (divLv / (DIVINITY_MINOR_DENOM + divLv)) *
        godMinorX1(2);
    }
  }

  const dream12 = Number((dreamData as any)?.[12]) || 0;
  const ola232 = Number((optionsListData as any)?.[232]) || 0;
  const ola232bonus = 5 * Math.floor((97 + ola232) / 100);
  const grimoire39 = Number((saveData as any).grimoireData?.[39]) || 0;
  const kattlekrukSet = String((optionsListData as any)?.[379] || "")
    .split(",")
    .includes("KATTLEKRUK_SET")
    ? Number(equipSetBonus("KATTLEKRUK_SET")) || 0
    : 0;
  const arcane57 = Math.min(
    5,
    Number((saveData as any).arcaneData?.[57]) || 0
  );

  const currentPlayerLv =
    (ctxSlot >= 0 &&
      (saveData as any).lv0AllData?.[ctxSlot] &&
      (saveData as any).lv0AllData[ctxSlot][0]) ||
    0;
  const superBit47 = superBitType(47, (saveData as any).gamingData?.[12]);
  const lvBonusTerm = superBit47
    ? Math.max(0, Math.floor((currentPlayerLv - 500) / 100))
    : 0;

  return Math.floor(
    spelunkBonus +
      tal149 +
      tal374 +
      tal539 +
      achieve291 +
      Math.floor(famBonus68) +
      comp1 +
      Math.ceil(divMinor) +
      dream12 +
      ola232bonus +
      grimoire39 +
      kattlekrukSet +
      arcane57 +
      lvBonusTerm
  );
}

/** Builds the breakdown node tree for the talent bonus levels — mirrors
 *  Corgan source resolveAllTalentLVz. */
function resolveAllTalentLVz(
  talentIdx: number,
  slotIdx: number,
  _opts: ATLOpts | undefined,
  saveData: SaveData
): TalentBonusDetail {
  if (
    (talentIdx >= 49 && talentIdx <= 59) ||
    talentIdx === 149 ||
    talentIdx === 374 ||
    talentIdx === 539 ||
    talentIdx === 505 ||
    talentIdx > 614
  ) {
    return { total: 0, children: [] };
  }
  const children: CorganNode[] = [];

  // Spelunk
  let spelunkBonus = 0;
  if (slotIdx >= 0) {
    const preset =
      Number(
        (playerStuffData as any)?.[slotIdx] && (playerStuffData as any)[slotIdx][1]
      ) || 0;
    const superArr =
      saveData.spelunkData &&
      (saveData.spelunkData as any)[20 + slotIdx + 12 * preset];
    if (Array.isArray(superArr) && superArr.indexOf(talentIdx) !== -1) {
      const base = 50;
      const legend7 =
        (Number(
          saveData.spelunkData &&
            (saveData.spelunkData as any)[18] &&
            (saveData.spelunkData as any)[18][7]
        ) || 0) * 10;
      const w7b5 =
        Number(
          saveData.spelunkData &&
            (saveData.spelunkData as any)[45] &&
            (saveData.spelunkData as any)[45][5]
        ) || 0;
      spelunkBonus = Math.round(base + legend7 + w7b5);
      children.push(
        node(
          "Spelunk Super Talent",
          spelunkBonus,
          [
            node("Base", base, null, { fmt: "raw" }),
            node("Spelunky Super Talent (Legend 7)", legend7, null, {
              fmt: "raw",
              note: "Spelunk[18][7] × 10",
            }),
            node("W7 Bonus 5", w7b5, null, { fmt: "raw" }),
          ],
          { fmt: "raw" }
        )
      );
    }
  }

  function intervalAddCharNode(talId: number, lbl: string): number {
    const sl = slotIdx >= 0 ? (skillLvData as any)[slotIdx] : null;
    const lv = Number(sl && (sl[talId] || sl[String(talId)])) || 0;
    const val = lv > 0 ? 1 + Math.floor(lv / 20) : 0;
    if (val > 0) {
      children.push(
        node(
          lbl,
          val,
          // Canonical formulaEval shape: intervalAdd(x1=1, x2=20, lv).
          // The Char Lv kid is the one editable input; the parent
          // recomputes 1 + floor(lv / 20) live via closedFormFormula.
          [node("Char Lv", lv, null, { fmt: "raw" })],
          { fmt: "raw", note: "intervalAdd(1,20," + lv + ")" }
        )
      );
    }
    return val;
  }
  const tal149 = intervalAddCharNode(149, label("Talent", 149));
  const tal374 = intervalAddCharNode(374, label("Talent", 374));
  const tal539 = intervalAddCharNode(539, label("Talent", 539));

  const achieve291 =
    (saveData.achieveRegData as any)?.[291] === -1 ? 1 : 0;
  if (achieve291 > 0) {
    children.push(node(label("Achievement", 291), achieve291, null, { fmt: "raw" }));
  }

  // Family bonus 68 (Mage). N.js iterates every player × class chain ×
  // formula slot, then KEEPS THE MAX. The active char's contribution
  // ALSO gets multiplied by (1 + GetTalentNumber(1, 144) / 100) — Sad
  // Souls for Wizards. Previously we shortcut "if maxMageCharIdx ===
  // slotIdx, apply the buff" which misses an edge case: if the active
  // char is a different mage AND their Sad Souls buff is big enough,
  // their buffed contribution might exceed the unbuffed best mage's
  // — in which case the active char becomes the slot's owner. Fixed by
  // looping all mages, applying the buff per-char (only the slotIdx
  // one), and picking the actual max.
  const fb34 = familyBonusParams(34);
  let tal144Mult = 1;
  {
    const rawLv144 =
      Number((skillLvData as any)[slotIdx] && (skillLvData as any)[slotIdx][144]) || 0;
    if (rawLv144 > 0) {
      const atlFor144 = computeAllTalentLVz(
        144,
        slotIdx,
        { skipTal144FamMult: true },
        saveData
      );
      const effLv144 = rawLv144 + atlFor144;
      const t144 = talentParams(144);
      const tal144Val = formulaEval(
        (t144 as any).formula,
        (t144 as any).x1,
        (t144 as any).x2,
        effLv144
      );
      tal144Mult = 1 + tal144Val / 100;
    }
  }
  let famBonus68 = 0;
  let maxMageCharLv = 0;
  let bestContribCharIdx = -1;
  let bestUsedTal144 = false;
  // Per-char level kids — one row per mage char so the user can see
  // every contributor and edit any of them for research. The "Best
  // Mage Lv" parent is then a maxOfKids formula over this set.
  const charLvKids: CorganNode[] = [];
  for (let ci = 0; ci < numCharacters; ci++) {
    const cls = (charClassData as any)[ci];
    if (cls !== 34 && cls !== 38) continue;
    const lv =
      ((saveData as any).lv0AllData?.[ci] && (saveData as any).lv0AllData[ci][0]) ||
      0;
    const n = Math.max(0, Math.round(lv - (fb34 as any).lvOffset));
    if (n <= 0) continue;
    let contrib = formulaEval(
      (fb34 as any).formula,
      (fb34 as any).x1,
      (fb34 as any).x2,
      n
    );
    const usedBuff = ci === slotIdx && tal144Mult > 1;
    if (usedBuff) contrib *= tal144Mult;
    if (contrib > famBonus68) {
      famBonus68 = contrib;
      maxMageCharLv = lv;
      bestContribCharIdx = ci;
      bestUsedTal144 = usedBuff;
    }
    const charName =
      (saveData.charNames && saveData.charNames[ci]) || `Char ${ci}`;
    const isActive = ci === slotIdx;
    charLvKids.push(
      node(
        `${charName} (Char ${ci}) Lv`,
        lv,
        null,
        {
          fmt: "raw",
          note:
            `class ${cls}` +
            (isActive ? " — ACTIVE char (gets Sad Souls buff)" : ""),
        }
      )
    );
  }
  // Kept for downstream code paths that still reference these (the
  // original computeAllTalentLVz block at line ~180 uses these names).
  const maxMageCharIdx = bestContribCharIdx;
  // Surface whether the Sad Souls buff actually won this slot — useful
  // when researching edge cases.
  void maxMageCharIdx;
  const famFloor = Math.floor(famBonus68);
  if (famFloor > 0) {
    const buffNote = bestUsedTal144 ? " — buffed by Sad Souls (Talent 144)" : "";
    const lvOffset = (fb34 as any).lvOffset;
    children.push(
      node(
        "Family Bonus 68 (Mage)",
        famFloor,
        [
          node(
            "Best Mage Lv",
            maxMageCharLv,
            // Each mage char's level lives here as an editable kid.
            // The "Best Mage Lv" parent recomputes via maxOfKids on
            // every edit so the user can research "what if Char X
            // had lv N" by tweaking that one row.
            charLvKids.length ? charLvKids : null,
            {
              fmt: "raw",
              note:
                "max across account — " +
                charLvKids.length +
                " mage char" +
                (charLvKids.length === 1 ? "" : "s"),
            }
          ),
          node(
            "Sad Souls Multi (×)",
            bestUsedTal144 ? tal144Mult : 1,
            null,
            {
              fmt: "raw",
              note: bestUsedTal144
                ? "active char's Talent 144 buff applied (1 + tal144Val/100)"
                : "1.0 — buff not applied (active char isn't the winning mage)",
            }
          ),
        ],
        {
          fmt: "raw",
          note:
            "floor(decay(" +
            (fb34 as any).x1 +
            ", " +
            (fb34 as any).x2 +
            ", max(0, Best Mage Lv − " +
            lvOffset +
            ")) × Sad Souls Multi)" +
            buffNote,
        }
      )
    );
  }

  const comp1v = saveData.companionIds && saveData.companionIds.has(1)
    ? companionBonus(1) : 0;
  if (comp1v > 0) {
    children.push(companionChild(1, comp1v, saveData, { fmt: "raw" }));
  }

  // Divinity Minor 2
  const y2bp = bubbleParams(3, 21);
  const y2BubbleLv =
    Number(
      (cauldronInfoData as any)?.[3] && (cauldronInfoData as any)[3][21]
    ) || 0;
  const y2Value =
    y2BubbleLv > 0
      ? formulaEval((y2bp as any).formula, (y2bp as any).x1, (y2bp as any).x2, y2BubbleLv)
      : 0;
  const allBubblesActive =
    saveData.companionIds && saveData.companionIds.has(4);
  let divMinor = 0;
  const coralKid3 = Number((optionsListData as any)?.[430]) || 0;
  const godX1_2 = godMinorX1(2);
  let divLvCaptured = 0;
  let y2ActiveCaptured = 0;
  if (slotIdx >= 0 && hasBonusMajor(slotIdx, 2, saveData)) {
    const divLv =
      ((saveData as any).lv0AllData?.[slotIdx] && (saveData as any).lv0AllData[slotIdx][14]) ||
      0;
    divLvCaptured = divLv;
    if (divLv > 0) {
      const includesY2 =
        (cauldronBubblesData as any)[slotIdx] &&
        (cauldronBubblesData as any)[slotIdx].includes("d21");
      const y2Active = allBubblesActive || includesY2 ? y2Value : 0;
      y2ActiveCaptured = y2Active;
      divMinor =
        Math.max(1, y2Active) *
        (1 + coralKid3 / 100) *
        (divLv / (DIVINITY_MINOR_DENOM + divLv)) *
        godMinorX1(2);
    }
  }
  const divCeil = Math.ceil(divMinor);
  if (divCeil > 0) {
    // Surface the four inputs the formula reads so the max-values
    // tool can recompute live. Handler key matches the parent name.
    children.push(
      node(
        "Divinity Minor 2 (Arctis)",
        divCeil,
        [
          node("Divinity Lv", divLvCaptured, null, { fmt: "raw" }),
          node("Bubble Y2 Active", y2ActiveCaptured, null, {
            fmt: "raw",
            note: "0 if Y2 bubble not equipped & no all-bubbles flag",
          }),
          node("Coral Kid 3", coralKid3, null, { fmt: "raw", note: "OLA[430]" }),
          node("God Minor X1(2)", godX1_2, null, {
            fmt: "raw",
            note: "GodsInfo[2][3] constant",
          }),
        ],
        { fmt: "raw" } // gen-source-catalog appends the formula text
      )
    );
  }

  // dreamData[12] is the user's CURRENT LV of DreamUpg[10] (Equinox
  // Symbols) — DreamUpg → Dream save indices have a +2 offset. Old
  // labels said "Nonstop Studies (Dream 12)" but the actual upgrade
  // is Equinox Symbols, which is the one that adds "+1 all talent LVs"
  // (DreamUpg[10] description). Nonstop Studies is DreamUpg[12] /
  // Dream[14] — gives Research EXP, not talent levels.
  const equinoxSymbolsLv = Number((dreamData as any)?.[12]) || 0;
  if (equinoxSymbolsLv > 0) {
    // Game N.js formula for Dream upgrade 10 max LV:
    //   round(DreamUpg[10][2] + Summoning("WinBonus", 24, 0)
    //   + 10·GamingStatType("SuperBitType", 35, 0)
    //   + 4·CloudBonus[30])
    const baseMax = Number((DreamUpg as any)[10]?.[2]) || 5;
    const summWB24Parts = computeSummWinBonus24Parts(saveData);
    const summWB24 = summWB24Parts.normal + summWB24Parts.endless;
    const superBit35 = superBitType(35, saveData.gamingData?.[12]);
    const cloudBonus30 = cloudBonus(30, saveData.weeklyBossData);
    children.push(
      node(
        "Equinox Symbols (Dream 10)",
        equinoxSymbolsLv,
        [
          node("Base Max", baseMax, null, {
            fmt: "raw",
            note: "DreamUpg[10][2] game constant",
          }),
          node(
            "Summoning WinBonus 24",
            summWB24,
            [
              node("Normal Wins Bonus", summWB24Parts.normal, null, {
                fmt: "raw",
                note: "Σ slot-24 contributions from owned summoning units",
              }),
              node(
                "Endless Wins Bonus",
                summWB24Parts.endless,
                [
                  node("Endless Wins Count", summWB24Parts.endlessWins, null, {
                    fmt: "raw",
                    note: "OLA[319] — total endless summoning victories",
                  }),
                  node("Per 40-Cycle Bonus", summWB24Parts.perCycle24, null, {
                    fmt: "raw",
                    note: "slot-24 contribution per 40-win cycle (game constant)",
                  }),
                ],
                {
                  fmt: "raw",
                  note: "floor(wins/40) × perCycle + partial cycle",
                }
              ),
            ],
            { fmt: "raw", note: "slot 24 is RAW (no multiplicative chain)" }
          ),
          node("SuperBit 35 (×10)", 10 * superBit35, null, {
            fmt: "raw",
            note: "Gaming SuperBitType 35 unlocked? × 10",
          }),
          node("Cloud 30 (×4)", 4 * cloudBonus30, null, {
            fmt: "raw",
            note: "Dream Challenge 30 completed? × 4",
          }),
        ],
        { fmt: "raw" }
      )
    );
  }

  const ola232 = Number((optionsListData as any)?.[232]) || 0;
  const ola232bonus = 5 * Math.floor((97 + ola232) / 100);
  if (ola232bonus > 0) {
    children.push(
      node("Sneaking Completions", ola232bonus, null, {
        fmt: "raw",
        note: "raw=" + ola232,
      })
    );
  }

  const grimoire39 = Number((saveData as any).grimoireData?.[39]) || 0;
  if (grimoire39 > 0) {
    children.push(
    node("Skull of Major Talent (Grimoire 39)", grimoire39, null, {
      fmt: "raw",
    })
  );
  }

  const kattlekrukSet = String((optionsListData as any)?.[379] || "")
    .split(",")
    .includes("KATTLEKRUK_SET")
    ? Number(equipSetBonus("KATTLEKRUK_SET")) || 0
    : 0;
  if (kattlekrukSet > 0) {
    children.push(node("Kattlekruk Set", kattlekrukSet, null, { fmt: "raw" }));
  }

  const arcane57 = Math.min(
    5,
    Number((saveData as any).arcaneData?.[57]) || 0
  );
  if (arcane57 > 0) {
    children.push(node("Arcane Map 57", arcane57, null, { fmt: "raw", note: "cap 5" }));
  }

  const currentPlayerLv =
    (slotIdx >= 0 &&
      (saveData as any).lv0AllData?.[slotIdx] &&
      (saveData as any).lv0AllData[slotIdx][0]) ||
    0;
  const superBit47 = superBitType(47, (saveData as any).gamingData?.[12]);
  const lvBonusTerm = superBit47
    ? Math.max(0, Math.floor((currentPlayerLv - 500) / 100))
    : 0;
  if (lvBonusTerm > 0) {
    children.push(
      node(
        label("Super Bit", 47) + " Lv Bonus",
        lvBonusTerm,
        [
          node("Player Level", currentPlayerLv, null, { fmt: "raw" }),
          node(
            "floor((" + currentPlayerLv + " - 500) / 100)",
            lvBonusTerm,
            null,
            { fmt: "raw" }
          ),
        ],
        { fmt: "raw" }
      )
    );
  }

  const total = Math.floor(
    spelunkBonus +
      tal149 +
      tal374 +
      tal539 +
      achieve291 +
      famFloor +
      comp1v +
      divCeil +
      equinoxSymbolsLv +
      ola232bonus +
      grimoire39 +
      kattlekrukSet +
      arcane57 +
      lvBonusTerm
  );
  return { total, children };
}

function getTalentData(id: number, tab?: number) {
  const p = talentParams(id, tab);
  if (!p || !p.formula || p.formula === "txt" || p.formula === "_") return null;
  const name = entityName("Talent", id) || "Talent " + id;
  return { x1: p.x1, x2: p.x2, formula: p.formula, name };
}

function getTalentNumber(
  charIdx: number,
  talentIdx: number,
  data: { x1: number; x2: number; formula: string },
  activeCharIdx: number | undefined,
  atlIdx: number | undefined,
  saveData: SaveData
) {
  const sl = (skillLvData as any)[charIdx] || {};
  const rawLv = Number(sl[talentIdx] || sl[String(talentIdx)]) || 0;
  // Game's getbonus2 passes raw talent LEVEL (atlIdx) to AllTalentLVz instead
  // of the talent index. The ctxChar param decides which char's skill levels/
  // divinity/spelunk is queried for the ATL chain.
  // NOTE: we compute bonusDetail even when rawLv === 0 so the max-values
  // tool can surface "what would the bonus levels be if I picked up this
  // talent" for inactive (level-0) talents. The contribution sources
  // (Symbols of Beyond, family bonus, divinity etc.) exist independently
  // of whether the user has the talent themselves.
  const ctxChar = activeCharIdx != null ? activeCharIdx : charIdx;
  const atlInput = atlIdx !== undefined ? atlIdx : talentIdx;
  const bonusDetail = resolveAllTalentLVz(atlInput, ctxChar, undefined, saveData);
  const bonus = bonusDetail.total;
  const effectiveLv = rawLv + bonus;
  // Stay strict about val = 0 at rawLv 0 — the talent contributes
  // nothing if you don't have it, even if the bonus chain would have
  // boosted it. The Active toggle is the explicit "as-if" override.
  const val = rawLv > 0 ? formulaEval(data.formula, data.x1, data.x2, effectiveLv) : 0;
  return {
    val,
    rawLv,
    bonus,
    effectiveLv,
    bonusDetail,
  };
}

function getbonus2(
  talentIdx: number,
  data: { x1: number; x2: number; formula: string },
  activeCharIdx: number | undefined,
  saveData: SaveData
) {
  let best = 0;
  let bestChar = -1;
  let bestR:
    | ReturnType<typeof getTalentNumber>
    | null = null;
  for (let ci = 0; ci < numCharacters; ci++) {
    const sl = (skillLvData as any)[ci] || {};
    const rawLv = Number(sl[talentIdx] || sl[String(talentIdx)]) || 0;
    let r: ReturnType<typeof getTalentNumber>;
    if (talentIdx >= 100) {
      const ctxForATL = activeCharIdx != null && activeCharIdx >= 0 ? activeCharIdx : ci;
      r = getTalentNumber(ci, talentIdx, data, ctxForATL, rawLv, saveData);
    } else if (rawLv <= 0) {
      r = {
        val: 0,
        rawLv: 0,
        bonus: 0,
        effectiveLv: 0,
        bonusDetail: { total: 0, children: [] },
      };
    } else {
      const v = formulaEval(data.formula, data.x1, data.x2, rawLv);
      r = {
        val: v,
        rawLv,
        bonus: 0,
        effectiveLv: rawLv,
        bonusDetail: { total: 0, children: [] },
      };
    }
    if (r.val > best) {
      best = r.val;
      bestChar = ci;
      bestR = r;
    }
  }
  return { val: best, bestChar, detail: bestR };
}

export function maxTalentBonus(
  talentIdx: number,
  activeCharIdx: number | undefined,
  saveData: SaveData
): number {
  const data = getTalentData(talentIdx);
  if (!data) return 0;
  return getbonus2(talentIdx, data, activeCharIdx, saveData).val;
}

export const talent = {
  resolve(id: number, ctx: Ctx, args?: TalentResolveArgs): CorganNode {
    const saveData = ctx.saveData;
    const tab = args && args.tab;
    const data = getTalentData(id, tab);
    if (!data) {
      return node(label("Talent", id), 0, null, { note: "no formula data" });
    }
    const name = label("Talent", id);
    const mode = args && args.mode;

    if (mode === "max") {
      const r = getbonus2(id, data, ctx.charIdx, saveData);
      let maxChildren: CorganNode[] = [
        node("Best Character " + r.bestChar, r.val, null, { fmt: "raw" }),
      ];
      if (r.detail) {
        maxChildren = [
          node("Base Level", r.detail.rawLv, null, { fmt: "raw" }),
          node(
            "Bonus Levels",
            r.detail.bonus,
            r.detail.bonusDetail.children.length ? r.detail.bonusDetail.children : null,
            { fmt: "+" }
          ),
          node("Effective Level", r.detail.effectiveLv, null, { fmt: "raw" }),
          node("Best Character " + r.bestChar, r.val, null, { fmt: "raw" }),
        ];
      }
      return node(name, r.val, maxChildren, { fmt: "+" });
    }

    // Talent 328 (Archlord of the Pirates): multiplicative DR factor
    if (id === 328) {
      const gb = getbonus2(id, data, ctx.charIdx, saveData);
      const plunderKills = Number((optionsListData as any)[139]) || 0;
      const logVal = plunderKills > 0 ? getLOG(plunderKills) : 0;
      if (gb.val <= 0 || plunderKills <= 0) {
        return node(name, 1, null, { fmt: "x" });
      }
      const total328 = 1 + (gb.val * logVal) / 100;
      const talCh: CorganNode[] = [];
      if (gb.detail) {
        // Surface the owner char on Base Level — the game picks the
        // best-rolled char for the talent, which is NOT necessarily
        // the active char. Active char only drives the Bonus chain.
        const ownerName = saveData.charNames && saveData.charNames[gb.bestChar];
        const ownerLabel = ownerName
          ? `Base Level (owner: ${ownerName})`
          : `Base Level (owner: char ${gb.bestChar})`;
        talCh.push(
          node(ownerLabel, gb.detail.rawLv, null, {
            fmt: "raw",
            note: "skill levels of owner char",
          })
        );
        talCh.push(
          node(
            "Bonus Levels",
            gb.detail.bonus || 0,
            gb.detail.bonusDetail && gb.detail.bonusDetail.children.length
              ? gb.detail.bonusDetail.children
              : null,
            { fmt: "+", note: "computed for active char" }
          )
        );
        talCh.push(node("Effective Level", gb.detail.effectiveLv, null, { fmt: "raw" }));
      }
      const active328 = gb.detail && gb.detail.rawLv > 0 ? 1 : 0;
      return node(
        name,
        total328,
        [
          node("Active", active328, null, { fmt: "raw" }),
          node("Talent Value", gb.val, talCh, {
            fmt: "raw",
            note:
              "decay(6,150," +
              (gb.detail ? gb.detail.effectiveLv : "?") +
              ")",
          }),
          node("Plunderous Kills", plunderKills, null, {
            fmt: "raw",
            note: "OLA[139]",
          }),
          node("log₁₀(" + plunderKills + ")", logVal, null, { fmt: "raw" }),
        ],
        { fmt: "x" }
      );
    }

    const r = getTalentNumber(ctx.charIdx, id, data, ctx.activeCharIdx, undefined, saveData);
    // Emit the full talent breakdown even for level-0 talents so the
    // max-values tool can show what the talent would contribute if
    // the user levelled it. The Active toggle (0 = current state,
    // 1 = "as if active") lets them research that without zero-out
    // hacks.
    const bonusChildren =
      r.bonusDetail && r.bonusDetail.children.length ? r.bonusDetail.children : null;
    const activeFlag = r.rawLv > 0 ? 1 : 0;
    // Canonical formula note matches the gen-time detectFormulaSpec
    // shape — "type(x1,x2,lvAtGenTime)". The runtime closedFormFormula
    // handler uses Base + Bonus internally to derive effLv live.
    const formulaNote = `${data.formula}(${data.x1},${data.x2},${r.effectiveLv})`;

    // Talent 655 (Boss Battle Spillover): star talent — universal,
    // no external bonus levels stack with it (rawLv IS effLv). Skip
    // the Bonus / Effective rows. Also skip Active — for a star
    // talent the bonus is gated entirely by Base Level (lv 0 → 0
    // contribution), so the toggle would be redundant.
    if (id === 655) {
      const skulls = Number((optionsListData as any)[189]) || 0;
      const perSkull = r.val;
      const total = perSkull * skulls;
      return node(
        name,
        total,
        [
          node("Base Level", r.rawLv, null, { fmt: "raw" }),
          node("Per Skull", perSkull, null, {
            fmt: "raw",
            note: formulaNote,
          }),
          node("Skulls Beaten", skulls, null, { fmt: "raw", note: "OLA[189]" }),
        ],
        { fmt: "+", note: "talent " + id }
      );
    }

    return node(
      name,
      r.val,
      [
        node("Active", activeFlag, null, { fmt: "raw" }),
        node("Base Level", r.rawLv, null, { fmt: "raw" }),
        node("Bonus Levels", r.bonus || 0, bonusChildren, { fmt: "+" }),
        node("Effective Level", r.effectiveLv, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: formulaNote }
    );
  },
};

// Silence unused-import warnings — these symbols stay imported to keep
// the source dependency map identical to Corgan's, so Stage 3+ can
// add the real implementations without changing the import surface.
void cauldronInfoData;
void playerStuffData;
void superBitType;
void hasBonusMajor;
void companionBonus;
void bubbleParams;
void equipSetBonus;
void godMinorX1;
void DIVINITY_MINOR_DENOM;
void familyBonusParams;
void charClassData;
