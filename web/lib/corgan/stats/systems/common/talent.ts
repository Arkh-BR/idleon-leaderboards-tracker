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
import {
  computeWinBonus,
  computeSummWinBonus,
  computeSummWinBonus24Parts,
  _winBonusParts,
} from "../w6/summoning";
import { DreamUpg } from "../../data/game/customlists.js";
import { SaltLicks, TaskShopDesc } from "../../data/game/customlists.js";
import { artifactBase } from "../../data/w5/sailing";
import { hasBonusMajor } from "../w5/divinity";
import { label, entityName } from "../../entity-names";
import { talentParams, familyBonusParams, CLASS_TREES } from "../../data/common/talent";
import { ClassNames } from "../../data/game/customlists.js";
import { companionBonus } from "../../data/common/companions";
import { companionChild } from "./companions";
import { bubbleParams } from "../../data/w2/alchemy";
import { equipSetBonus } from "../../data/common/equipment";
import { godMinorX1 } from "../../data/w5/divinity";
import { DIVINITY_MINOR_DENOM } from "../../data/game-constants";
import { numCharacters, charClassData } from "../../../save/data";
import { skillLvMaxData } from "../../../save/data";
import { achieveStatus } from "./achievement";
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

/** Computes the N.js maxBookLv formula (line 12252) and emits the
 *  full breakdown as kids of a "Max Book Lv Cap" node. Account-wide
 *  cap that clamps ALL regular talents (idx<615) per line 9508. Used
 *  by emitBaseLevelNode() to attach the cap structure to every tab
 *  1-5 talent's Base Level row. */
function computeMaxBookLvParts(saveData: SaveData): {
  value: number;
  kids: CorganNode[];
} {
  const baseLvl = 100;
  const talentBookLibBase = 25;
  const saltLick4Lv = Number((saveData as any).saltLickData?.[4]) || 0;
  const saltLick4PerLv = Number((SaltLicks as any)[4]?.[3]) || 2;
  const saltLick4 = saltLick4Lv > 0 ? saltLick4Lv * saltLick4PerLv : 0;
  const w3MeritPts =
    Number((saveData as any).tasksGlobalData?.[2]?.[2]?.[2]) || 0;
  const w3MeritShopPerPt =
    Number((TaskShopDesc as any)?.[2]?.[2]?.[11]) || 0;
  const w3MeritShop = w3MeritPts * w3MeritShopPerPt;
  const ach145 = Math.min(
    5,
    Math.max(0, 5 * achieveStatus(145, saveData))
  );
  const atom7Lv = Number((saveData as any).atomsData?.[7]) || 0;
  const atom7 = 10 * Math.min(atom7Lv, 1);
  const artifact21Tier =
    Number((saveData as any).sailingData?.[3]?.[21]) || 0;
  const artifact21Base = artifactBase(21);
  const furyRelic =
    artifact21Tier > 0 ? artifact21Base * artifact21Tier : 0;
  const summWB19 = computeWinBonus(19, null, saveData);
  const value = Math.round(
    baseLvl +
      talentBookLibBase +
      saltLick4 +
      w3MeritShop +
      ach145 +
      atom7 +
      furyRelic +
      summWB19
  );
  // Build the Summoning Winner Bonus 19 breakdown (reuses logic from
  // the original Tal144 implementation; each talent gets its own copy).
  const swb = computeSummWinBonus(saveData);
  const wb19Parts = _winBonusParts(19, swb, saveData);
  const summKids: CorganNode[] = [
    node("Cyan 14 Winner Raw", wb19Parts.raw ?? 0, null, { fmt: "raw" }),
    node("Base Multi", wb19Parts.baseMult ?? 3.5, null, { fmt: "x" }),
    node(
      "Crystal Comb Pristine Charm",
      wb19Parts.pristineMult ?? 1,
      [node("Pristine 8 Bonus", wb19Parts.pristine8 ?? 0, null, { fmt: "raw" })],
      { fmt: "x" }
    ),
    node(
      "Gem Shop Multi",
      wb19Parts.gemMult ?? 1,
      [node("Gem Items 11", wb19Parts.gemItems11 ?? 0, null, { fmt: "raw" })],
      { fmt: "x" }
    ),
    node(
      "Winner Multi (combined)",
      wb19Parts.winnerMult ?? 1,
      [
        node(
          "Sovereign Winz Lantern",
          wb19Parts.artBonus32 ?? 0,
          [
            node("Artifact 32 Base", 25, null, { fmt: "raw" }),
            node("Artifact 32 Tier", wb19Parts.artRarity ?? 0, null, { fmt: "raw" }),
          ],
          { fmt: "+" }
        ),
        node("W3 Merit Shop (Task)", wb19Parts.taskVal ?? 0, null, { fmt: "+" }),
        node("Regalis Achievement (379)", wb19Parts.ach379 ?? 0, null, { fmt: "+" }),
        node("Spectre Stars Achievement (373)", wb19Parts.ach373 ?? 0, null, { fmt: "+" }),
        node("Godshard Set", wb19Parts.godshardSet ?? 0, null, { fmt: "+" }),
      ],
      { fmt: "x" }
    ),
  ];
  const kids: CorganNode[] = [
    node("Base Level (N.js literal)", baseLvl, null, { fmt: "+" }),
    node("Talent Book Library Base", talentBookLibBase, null, { fmt: "+" }),
    node(
      "Salt Lick 4",
      saltLick4,
      [
        node("Salt Lick 4 Lv", saltLick4Lv, null, { fmt: "raw" }),
        node("Per Lv", saltLick4PerLv, null, { fmt: "raw" }),
      ],
      { fmt: "+" }
    ),
    node(
      "W3 Merit Shop Unlock",
      w3MeritShop,
      [
        node("W3 Merit Points Spent", w3MeritPts, null, { fmt: "raw" }),
        node("Per Point", w3MeritShopPerPt, null, { fmt: "raw" }),
      ],
      { fmt: "+" }
    ),
    node("Checkout Takeout Achievement", ach145, null, { fmt: "+" }),
    node(
      "Lv 1 Oxygen Atom",
      atom7,
      [node("Atom 7 Lv", atom7Lv, null, { fmt: "raw" })],
      { fmt: "+" }
    ),
    node(
      "Sovereign Fury Relic",
      furyRelic,
      [
        node("Artifact 21 Base", artifact21Base, null, { fmt: "raw" }),
        node("Artifact 21 Tier", artifact21Tier, null, { fmt: "raw" }),
      ],
      { fmt: "+" }
    ),
    node("Summoning Winner Bonus 19", summWB19, summKids, { fmt: "+" }),
  ];
  return { value, kids };
}

/** Wraps a raw skill lv in the Base Level structure for tab 1-5
 *  talents — min(Points Invested, Max Book Lv Cap). The cap breakdown
 *  is duplicated under each talent (account-wide value, but each
 *  talent's tree is self-contained so the user can edit independently
 *  per-talent for research scenarios). Skip for star talents (>=600). */
function emitBaseLevelNode(
  rawLv: number,
  saveData: SaveData,
  options?: { ownerName?: string; ownerCharIdx?: number }
): CorganNode {
  const cap = computeMaxBookLvParts(saveData);
  // For max DR research: BOTH Points Invested and Base Level default
  // to Max Book Lv Cap (assumes player has maxed the talent up to the
  // cap). This works even for talents owned by other classes (e.g.,
  // Tal 328 Archlord — Bowman class owner is NOT the active char, but
  // we still default to the cap because we're researching the THEORY
  // max). When a real save mode is added, Points Invested.refValue
  // should be rawLv (owner char's actual invested level) and the
  // min() gate will surface the actual investment cap.
  const baseValue = cap.value;
  const ownerSuffix = options?.ownerName
    ? ` — owner: ${options.ownerName}`
    : options?.ownerCharIdx != null
      ? ` — owner: Char ${options.ownerCharIdx}`
      : "";
  return node(
    "Base Level",
    baseValue,
    [
      node("Points Invested", cap.value, null, {
        fmt: "raw",
        note:
          "Defaults to Max Book Lv Cap for max DR research" +
          ownerSuffix +
          ". Save's actual invested = " +
          rawLv +
          ". Edit to research 'what if I'd only spent N points'.",
      }),
      node("Max Book Lv Cap", cap.value, cap.kids, {
        fmt: "raw",
        note:
          "Max Book Lv Cap = round(100 + 25 + SaltLick(4) + W3 Merit + " +
          "Achievement 145 + Lv1 Oxygen Atom + Fury Relic + Summoning WB 19). " +
          "Account-wide cap per N.js line 12252; clamps ALL regular talents " +
          "(idx<615) at line 9508.",
      }),
    ],
    {
      fmt: "raw",
      note:
        "Base Level = min(Points Invested, Max Book Lv Cap). Requires both " +
        "the cap AND actual points spent." +
        ownerSuffix,
    }
  );
}

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
          // The Base Level kid is the editable input (with Points
          // Invested + Max Book Lv Cap min() structure, same as other
          // tab 1-5 talents). closedFormFormula reads "Base Level" via
          // its "any raw kid" fallback and applies intervalAdd.
          [
            emitBaseLevelNode(lv, saveData, {
              ownerCharIdx: slotIdx,
              ownerName:
                saveData.charNames && saveData.charNames[slotIdx],
            }),
          ],
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
  // char is a different mage AND their Family Guy buff is big enough,
  // their buffed contribution might exceed the unbuffed best mage's
  // — in which case the active char becomes the slot's owner. Fixed by
  // looping all mages, applying the buff per-char (only the slotIdx
  // one), and picking the actual max.
  const fb34 = familyBonusParams(34);
  // Talent 144 ("The Family Guy" — same name across all classes' tabs,
  // class) buffs the active char's family bonus contribution by
  // (1 + tal144Val/100). We expose the full sub-tree so the user can
  // research what would change at higher tal144 levels.
  const t144 = talentParams(144);
  let tal144Mult = 1;
  let tal144EffLv = 0;
  let tal144RawLv = 0;
  let tal144Val = 0;
  {
    tal144RawLv =
      Number((skillLvData as any)[slotIdx] && (skillLvData as any)[slotIdx][144]) || 0;
    if (tal144RawLv > 0 && t144) {
      const atlFor144 = computeAllTalentLVz(
        144,
        slotIdx,
        { skipTal144FamMult: true },
        saveData
      );
      tal144EffLv = tal144RawLv + atlFor144;
      tal144Val = formulaEval(
        (t144 as any).formula,
        (t144 as any).x1,
        (t144 as any).x2,
        tal144EffLv
      );
      tal144Mult = 1 + tal144Val / 100;
    }
  }
  // Replicate Lava's N.js algorithm EXACTLY (line 4401089 area). Not
  // a fixed-point convergence and not a stale frame cache — it's a
  // single-pass with store-then-buff in iteration order:
  //
  //   FamBonusQTYs["68"] = 0  (fresh map each rebuild)
  //   for each player in PlayerDATABASE (iteration order):
  //     for each class in player's chain:
  //       if class === 34 (Elemental Sorcerer):
  //         v = formulaEval(decay, 20, 350, max(0, lv - 69))
  //         if v > FamBonusQTYs["68"]:
  //           FamBonusQTYs["68"] = v                    ← store UNBUFFED
  //           if (active char && tal144 > 0):
  //             FamBonusQTYs["68"] = v × (1 + tal144Val/100)  ← overwrite BUFFED
  //
  // tal144Val internally reads AllTalentLV(144) which reads
  // FamBonusQTYs["68"] — which was just set to v (unbuffed) at the
  // previous line. So tal144 always sees the unbuffed family bonus
  // contribution; the buff is applied AFTER tal144 reads, breaking
  // the visual circular dependency.
  //
  // Filter: class 34 only (Elemental Sorcerer). The "Mage" naming
  // in our label is a holdover — the actual class index is 34 = ES.
  let famBonus68 = 0;
  let maxMageCharLv = 0;
  let bestContribCharIdx = -1;
  let bestUsedTal144 = false;
  const charLvKids: CorganNode[] = [];
  for (let ci = 0; ci < numCharacters; ci++) {
    const cls = Number((charClassData as any)[ci]) || 0;
    // ANY class whose chain includes 34 (Elemental Sorcerer)
    // contributes to Family Bonus 68. Currently 34 (ES), 35
    // (Spiritual Monk), 37 (placeholder for ES master class — "NOPE"
    // in ClassNames), and 41 (FILLER — another future master slot).
    // Using CLASS_TREES auto-detects future master classes once
    // Lava names them in ClassNames; no code change needed.
    const chain = CLASS_TREES[cls];
    if (!chain || !chain.includes(34)) continue;
    const lv =
      ((saveData as any).lv0AllData?.[ci] && (saveData as any).lv0AllData[ci][0]) ||
      0;
    const n = Math.max(0, Math.round(lv - (fb34 as any).lvOffset));
    if (n <= 0) continue;
    const unbuffed = formulaEval(
      (fb34 as any).formula,
      (fb34 as any).x1,
      (fb34 as any).x2,
      n
    );
    if (unbuffed > famBonus68) {
      famBonus68 = unbuffed;
      maxMageCharLv = lv;
      bestContribCharIdx = ci;
      if (ci === slotIdx && tal144Mult > 1) {
        famBonus68 = unbuffed * tal144Mult;
        bestUsedTal144 = true;
      } else {
        bestUsedTal144 = false;
      }
    }
    // Resolve the friendly class name (e.g. "ELEMENTAL_SORCERER")
    // dynamically from ClassNames — empty for placeholder slots.
    const className =
      (ClassNames as Record<number, string>)[cls] || `cls ${cls}`;
    const charName =
      (saveData.charNames && saveData.charNames[ci]) || `Char ${ci}`;
    const isActive = ci === slotIdx;
    // STABLE catalog id — uses "Char N Lv" without baking the friendly
    // name into the path, so other accounts loading their save can
    // override these refs (their flat tree emits the same "Char N Lv"
    // keys). The friendly name lives in the note.
    charLvKids.push(
      node(
        `Char ${ci} Lv`,
        lv,
        null,
        {
          fmt: "raw",
          note:
            `${charName} — ${className.replace(/_/g, " ").toLowerCase()} (cls ${cls})` +
            (isActive ? " — ACTIVE char (gets Family Guy buff if it wins the slot)" : ""),
        }
      )
    );
  }
  // Kept for downstream code paths that still reference these (the
  // original computeAllTalentLVz block at line ~180 uses these names).
  const maxMageCharIdx = bestContribCharIdx;
  // Surface whether the Family Guy buff actually won this slot — useful
  // when researching edge cases.
  void maxMageCharIdx;
  const famFloor = Math.floor(famBonus68);
  if (famFloor > 0) {
    const buffNote = bestUsedTal144 ? " — buffed by The Family Guy (Talent 144)" : "";
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
          // FB68's decay constants — kids so the formula is driven by
          // data (familyBonusParams(34) from customlists.js) rather
          // than hardcoded into the runtime handler. Positioned
          // BETWEEN Best Mage Lv and Family Guy Multi so they group
          // visually with FB68's own inputs; Family Guy Multi sits
          // LAST so its sub-tree expansion makes ownership obvious.
          node("Formula x1", (fb34 as any).x1, null, {
            fmt: "raw",
            note: "decay formula x1 — Mage family bonus constant (ClassAccountBonus[34])",
          }),
          node("Formula x2", (fb34 as any).x2, null, {
            fmt: "raw",
            note: "decay formula x2 — Mage family bonus constant (ClassAccountBonus[34])",
          }),
          node("Lv Offset", lvOffset, null, {
            fmt: "raw",
            note: "ClassAccountBonus[34][1] — Mage family bonus level offset",
          }),
          // Family Guy Multi (× — potential buff). Placed LAST among
          // FB68's children so the constants above clearly belong to
          // FB68 (siblings, not children of Family Guy Multi). The
          // Tal144 decay constants live as kids of THIS row, sourced
          // from talentParams(144) — also data-driven, not hardcoded.
          //
          // Lava's resolution of the FB68 ↔ Tal144 visual loop: single-
          // pass with store-then-buff (not fixed-point convergence).
          // Tal144 in this row's ATL chain reads UNBUFFED FB68 from the
          // cache; the buff is applied AFTER that read, breaking what
          // would otherwise look like Family Guy affecting Family Guy.
          (() => {
            // CORRECT formula port from N.js line 12252-12253 (the
            // _customBlock_WorkbenchStuff("maxBookLv", 0, 0) case):
            //
            //   maxBookLv = round(
            //     125                              // 100 base + 25 Talent Book Library Base
            //     + Sailing.ArtifactBonus(21)      // Sovereign Fury Relic
            //     + Summoning.WinBonus(19)         // Summoning Winner Bonuses
            //     + 10 × min(Atoms[7], 1)          // Lv 1 Oxygen Atom
            //     + min(5, max(0, 5 × Achieve(145)))  // Checkout Takeout Achievement
            //     + SaltLick(4)                    // Salt Lick 4 (Refinery3 — +X Max Talent Book Lv)
            //     + Tasks[2][2][2] × TaskShopDesc[2][2][11]  // W3 Merit Shop Unlock
            //   )
            //
            // Then at line 9508-9509 the engine clamps every regular
            // talent (idx < 615) to this maxBookLv if their stored
            // SkillLevelsMAX exceeds it. So for Tal144 (and ALL Tab 1-5
            // talents), the cap = min(initialCap, maxBookLv).
            //
            // The 100 + 25 split matches the spreadsheet from the
            // community wiki: "100 Base Level" + "25 Talent Book Library
            // Base Level (Construction Building 2)". In N.js this is a
            // single literal 125 — we split it visually for clarity.
            // 100 + 25 = 125 (N.js literal, split for visual clarity)
            const baseLvl = 100;
            const talentBookLibBase = 25;
            // Salt Lick 4 (Refinery3): saltLickData[4] × SaltLicks[4][3]
            // SaltLicks[4] = ["Refinery3", "...Max level for talent
            // books...", "5", "2", "10", "2.2"] → per-lv = 2
            const saltLick4Lv =
              Number((saveData as any).saltLickData?.[4]) || 0;
            const saltLick4PerLv = Number((SaltLicks as any)[4]?.[3]) || 2;
            const saltLick4 = saltLick4Lv > 0 ? saltLick4Lv * saltLick4PerLv : 0;
            // W3 Merit Shop Unlock: Tasks[2][2][2] × TaskShopDesc[2][2][11]
            // The per-lv bonus is TaskShopDesc[2][2][11] = "2" (read from
            // customlists), giving 2 max book lv per purchased upgrade.
            const w3MeritPts =
              Number((saveData as any).tasksGlobalData?.[2]?.[2]?.[2]) || 0;
            const w3MeritShopPerPt =
              Number((TaskShopDesc as any)?.[2]?.[2]?.[11]) || 0;
            const w3MeritShop = w3MeritPts * w3MeritShopPerPt;
            // Achievement 145 — Checkout Takeout: 5 × status, capped at 5.
            const ach145 = Math.min(
              5,
              Math.max(0, 5 * achieveStatus(145, saveData))
            );
            // Lv 1 Oxygen Atom: 10 × min(Atoms[7], 1).
            // atomsData[7] is the Oxygen Atom's lv (>= 1 if unlocked).
            const atom7Lv = Number((saveData as any).atomsData?.[7]) || 0;
            const atom7 = 10 * Math.min(atom7Lv, 1);
            // Sovereign Fury Relic: Sailing.ArtifactBonus(21).
            // artifactBase(21) gives the base value (100 for Fury Relic),
            // multiplied by the unlocked tier (Base=1, Ancient=2, Eldritch=
            // 3, Sovereign=4, etc.).
            const artifact21Tier =
              Number((saveData as any).sailingData?.[3]?.[21]) || 0;
            const artifact21Base = artifactBase(21);
            const furyRelic =
              artifact21Tier > 0 ? artifact21Base * artifact21Tier : 0;
            // Summoning Winner Bonuses (slot 19): computeWinBonus(19).
            // We compute the breakdown via _winBonusParts so the user
            // can edit individual contributors (Cyan 14 Winner Raw,
            // Crystal Comb Pristine Charm, Sovereign Fury Lantern,
            // Regalis/Spectre achievements, W3 Merit Shop, Godshard
            // Set) and the cascade flows up to Base Level → Family
            // Guy Multi → FB68.
            //
            // Formula (N.js):
            //   val = baseMult × raw × pristineMult × gemMult × winnerMult
            // where baseMult=3.5 (slot 19), pristineMult = 1 + pristine8/100,
            // gemMult = 1 + 10·gemItems11/100,
            // winnerMult = 1 + (artBonus32 + taskVal + ach379 + ach373 +
            //   godshardSet)/100   ← idx=19 skips wb31 + empBon8
            const swb = computeSummWinBonus(saveData);
            const wb19Parts = _winBonusParts(19, swb, saveData);
            const summWB19 = wb19Parts.val;
            // Total per N.js formula. The cap is min(initialCap, maxBookLv)
            // (clamp at line 9508), where initialCap = save's saved value
            // for talents that may have been set higher by class promotion
            // historic events. For our zArkhe save Tal144 cap = 396 ≈
            // maxBookLv, so the formula matches reality.
            const maxBookLv = Math.round(
              baseLvl +
                talentBookLibBase +
                saltLick4 +
                w3MeritShop +
                ach145 +
                atom7 +
                furyRelic +
                summWB19
            );
            void maxBookLv;
            return node(
            "Family Guy Multi (×) — potential buff",
            tal144Mult,
            [
              node(
                "Base Level",
                Math.min(tal144RawLv, maxBookLv),
                [
                  // For Max DR research the default assumption is that
                  // the player has invested points up to the cap — so
                  // Points Invested.refValue = Max Book Lv Cap, NOT the
                  // current save's invested level. The actual saved
                  // invested level (tal144RawLv) is what the player
                  // CURRENTLY has, but the research question is "what
                  // would the max DR be if I maxed this talent?". When
                  // a real-time save is pasted (future flow), the live
                  // pipeline can override Points Invested with the
                  // actual save value.
                  node("Points Invested", maxBookLv, null, {
                    fmt: "raw",
                    note:
                      "Defaults to Max Book Lv Cap for max DR research (assumes " +
                      "the player has invested up to the cap). Save's actual " +
                      "invested level (skillLvData[slotIdx][144]) = " +
                      tal144RawLv +
                      ". Edit this row to research 'what if I'd only spent N points'.",
                  }),
                  node(
                    "Max Book Lv Cap",
                    maxBookLv,
                    [
                  node("Base Level (N.js literal)", baseLvl, null, {
                    fmt: "+",
                    note: "100 — hardcoded base in N.js maxBookLv formula",
                  }),
                  node("Talent Book Library Base", talentBookLibBase, null, {
                    fmt: "+",
                    note:
                      "25 — Construction Building 2 (Talent Book Library) base " +
                      "contribution. Part of N.js literal 125 split for clarity.",
                  }),
                  node("Salt Lick 4", saltLick4, [
                    node("Salt Lick 4 Lv", saltLick4Lv, null, {
                      fmt: "raw",
                      note:
                        "saltLickData[4] — Refinery3 upgrade lv (+X Max Talent Book Lv)",
                    }),
                    node("Per Lv", saltLick4PerLv, null, {
                      fmt: "raw",
                      note: "SaltLicks[4][3] — game constant (2 per upgrade lv)",
                    }),
                  ], {
                    fmt: "+",
                    note: "Formula: Salt Lick 4 Lv × Per Lv (Refinery3)",
                  }),
                  node("W3 Merit Shop Unlock", w3MeritShop, [
                    node("W3 Merit Points Spent", w3MeritPts, null, {
                      fmt: "raw",
                      note: "Tasks[2][2][2] — W3 merit shop purchase qty",
                    }),
                    node("Per Point", w3MeritShopPerPt, null, {
                      fmt: "raw",
                      note:
                        "TaskShopDesc[2][2][11] — per-point bonus (game " +
                        "constant; W3 Talent Book Lv shop gives 2 per purchase)",
                    }),
                  ], {
                    fmt: "+",
                    note: "Formula: Merit Points × Per Point",
                  }),
                  node("Checkout Takeout Achievement", ach145, null, {
                    fmt: "+",
                    note:
                      "min(5, max(0, 5 × achieveStatus(145))) — caps at 5 when " +
                      "Achievement 145 is unlocked",
                  }),
                  node("Lv 1 Oxygen Atom", atom7, [
                    node("Atom 7 Lv", atom7Lv, null, {
                      fmt: "raw",
                      note: "atomsData[7] — Oxygen Atom lv",
                    }),
                  ], {
                    fmt: "+",
                    note: "10 × min(Atom 7 Lv, 1) — flat 10 if unlocked, 0 if not",
                  }),
                  node("Sovereign Fury Relic", furyRelic, [
                    node("Artifact 21 Base", artifact21Base, null, {
                      fmt: "raw",
                      note: "artifactBase(21) — Fury Relic base value (100)",
                    }),
                    node("Artifact 21 Tier", artifact21Tier, null, {
                      fmt: "raw",
                      note:
                        "sailingData[3][21] — Fury Relic tier (1=Base, 2=Ancient, " +
                        "3=Eldritch, 4=Sovereign, etc.)",
                    }),
                  ], {
                    fmt: "+",
                    note:
                      "Sailing.ArtifactBonus(21) = artifactBase × tier. " +
                      "Spreadsheet shows 100 = Sovereign (all 4 tiers unlocked).",
                  }),
                  node(
                    "Summoning Winner Bonus 19",
                    summWB19,
                    [
                      node(
                        "Cyan 14 Winner Raw",
                        wb19Parts.raw ?? 0,
                        null,
                        {
                          fmt: "raw",
                          note:
                            "swb[19] — Σ unit bonuses contributing to slot 19 " +
                            "(from owned summoning units + endless wins cycles)",
                        }
                      ),
                      node("Base Multi", wb19Parts.baseMult ?? 3.5, null, {
                        fmt: "x",
                        note: "3.5 for slot 19 (idx < 20) — game constant",
                      }),
                      node(
                        "Crystal Comb Pristine Charm",
                        wb19Parts.pristineMult ?? 1,
                        [
                          node("Pristine 8 Bonus", wb19Parts.pristine8 ?? 0, null, {
                            fmt: "raw",
                            note:
                              "ninjaData[107][8] — 30 if Crystal Comb Pristine " +
                              "Charm equipped, 0 otherwise",
                          }),
                        ],
                        {
                          fmt: "x",
                          note: "1 + Pristine 8 Bonus / 100",
                        }
                      ),
                      node(
                        "Gem Shop Multi",
                        wb19Parts.gemMult ?? 1,
                        [
                          node(
                            "Gem Items 11",
                            wb19Parts.gemItems11 ?? 0,
                            null,
                            {
                              fmt: "raw",
                              note: "gemItemsData[11] — gem shop summoning bonus stacks",
                            }
                          ),
                        ],
                        {
                          fmt: "x",
                          note: "1 + 10 × Gem Items 11 / 100",
                        }
                      ),
                      node(
                        "Winner Multi (combined)",
                        wb19Parts.winnerMult ?? 1,
                        [
                          node(
                            "Sovereign Winz Lantern",
                            wb19Parts.artBonus32 ?? 0,
                            [
                              node(
                                "Artifact 32 Base",
                                25,
                                null,
                                {
                                  fmt: "raw",
                                  note: "artifactBase(32) — The Winz Lantern base",
                                }
                              ),
                              node(
                                "Artifact 32 Tier",
                                wb19Parts.artRarity ?? 0,
                                null,
                                {
                                  fmt: "raw",
                                  note:
                                    "sailingData[3][32] — The Winz Lantern tier (1=Base, " +
                                    "2=Ancient, 4=Sovereign, etc.)",
                                }
                              ),
                            ],
                            {
                              fmt: "+",
                              note: "artifactBase(32) × tier — The Winz Lantern",
                            }
                          ),
                          node("W3 Merit Shop (Task)", wb19Parts.taskVal ?? 0, null, {
                            fmt: "+",
                            note:
                              "min(10, tasksGlobalData[2][5][4]) — W3 task shop " +
                              "purchases capped at 10",
                          }),
                          node("Regalis Achievement (379)", wb19Parts.ach379 ?? 0, null, {
                            fmt: "+",
                            note: "achieveStatus(379) — +1 if achieved",
                          }),
                          node("Spectre Stars Achievement (373)", wb19Parts.ach373 ?? 0, null, {
                            fmt: "+",
                            note: "achieveStatus(373) — +1 if achieved",
                          }),
                          node("Godshard Set", wb19Parts.godshardSet ?? 0, null, {
                            fmt: "+",
                            note:
                              "equipSetBonus('GODSHARD_SET') if equipped (olaData[379])",
                          }),
                        ],
                        {
                          fmt: "x",
                          note:
                            "1 + (Sovereign Fury Lantern + W3 Merit + Regalis + " +
                            "Spectre Stars + Godshard Set) / 100. Note: idx=19 " +
                            "SKIPS wb31 and empBon8 from the global formula.",
                        }
                      ),
                    ],
                    {
                      fmt: "+",
                      note:
                        "Summoning.WinBonus(19) = Cyan 14 Winner Raw × Base Multi × " +
                        "Crystal Comb × Gem Shop × Winner Multi. Print shows " +
                        "10.5 base × 1.30 × 1.10 × 2.27 ≈ 31; our save's value " +
                        "differs because the contributors are larger.",
                    }
                  ),
                    ],
                    {
                      fmt: "raw",
                      note:
                        "Max Book Lv Cap = round(100 + 25 + SaltLick(4) + W3MeritShop " +
                        "+ Achievement 145 + Lv1 OxygenAtom + Fury Relic + " +
                        "Summoning WinBonus 19). N.js line 12252. This is the " +
                        "ceiling; Base Level is also gated by Points Invested.",
                    }
                  ),
                ],
                {
                  fmt: "raw",
                  note:
                    "Base Level = min(Points Invested, Max Book Lv Cap). The " +
                    "talent only contributes if you have BOTH (a) enough max " +
                    "cap from Library/Salt Lick/etc AND (b) actually spent " +
                    "points on it.",
                }
              ),
              node(
                "Bonus Levels",
                tal144EffLv - tal144RawLv,
                null,
                {
                  fmt: "+",
                  note:
                    "Σ ATL chain for talent 144 (Symbols of Beyond, " +
                    "Family Bonus 68 UNBUFFED, etc.). Lava's single-pass " +
                    "algorithm reads FB68 BEFORE the Family Guy buff " +
                    "applies, so this sum uses the unbuffed FB68 — NOT a " +
                    "feedback loop.",
                }
              ),
              node("Tal144 Formula x1", t144 ? (t144 as any).x1 : 40, null, {
                fmt: "raw",
                note: "decay formula x1 — The Family Guy (TalentDescriptions[144])",
              }),
              node("Tal144 Formula x2", t144 ? (t144 as any).x2 : 100, null, {
                fmt: "raw",
                note: "decay formula x2 — The Family Guy (TalentDescriptions[144])",
              }),
            ],
            {
              fmt: "raw",
              note:
                "Formula: 1 + decay(Tal144 Formula x1, Tal144 Formula x2, " +
                "Base+Bonus) / 100. Lava applies this AFTER Family Bonus 68 " +
                "stores the unbuffed value in iteration order — store-then-" +
                "buff (single pass, not fixed-point). Tal144 reads UNBUFFED " +
                "FB68 in its ATL chain, so the apparent FB68 ↔ Tal144 cycle " +
                "is broken by sequencing.",
            }
          );
          })(),
        ],
        {
          fmt: "raw",
          note:
            "Formula: floor(decay(Formula x1, Formula x2, BestMageLv − Lv Offset) × Family Guy Multi if active char wins). " +
            "Lava single-pass: iterate ES chars in order; for each, store unbuffed; if ACTIVE char wins, overwrite with × Family Guy Multi" +
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
          node("Player Lv", currentPlayerLv, null, {
            fmt: "raw",
            note: "Lv0[0] — char's class lv. Editable for max DR research.",
          }),
        ],
        {
          fmt: "raw",
          note:
            "Formula: max(0, floor((Player Lv − 500) / 100)) — only active " +
            "when SuperBit 47 is unlocked. Recomputes live from Player Lv kid.",
        }
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
          node(
            "Effective Level",
            r.detail.effectiveLv,
            [
              emitBaseLevelNode(r.detail.rawLv, saveData, {
                ownerCharIdx: r.bestChar,
                ownerName: saveData.charNames && saveData.charNames[r.bestChar],
              }),
              node(
                "Bonus Levels",
                r.detail.bonus,
                r.detail.bonusDetail.children.length ? r.detail.bonusDetail.children : null,
                { fmt: "+" }
              ),
            ],
            { fmt: "raw" }
          ),
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
        // Surface the owner char in the Base Level note — for Tal 328
        // (Bowman class), the owner is the best Bowman char in the
        // account (NOT necessarily the active char zArkhe/DK).
        const ownerName = saveData.charNames && saveData.charNames[gb.bestChar];
        talCh.push(
          node(
            "Effective Level",
            gb.detail.effectiveLv,
            [
              emitBaseLevelNode(gb.detail.rawLv, saveData, {
                ownerCharIdx: gb.bestChar,
                ownerName,
              }),
              node(
                "Bonus Levels",
                gb.detail.bonus || 0,
                gb.detail.bonusDetail && gb.detail.bonusDetail.children.length
                  ? gb.detail.bonusDetail.children
                  : null,
                { fmt: "+", note: "computed for active char" }
              ),
            ],
            { fmt: "raw" }
          )
        );
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
        node(
          "Effective Level",
          r.effectiveLv,
          [
            emitBaseLevelNode(r.rawLv, saveData, {
              ownerCharIdx: ctx.charIdx,
              ownerName: saveData.charNames && saveData.charNames[ctx.charIdx],
            }),
            node("Bonus Levels", r.bonus || 0, bonusChildren, { fmt: "+" }),
          ],
          {
            fmt: "raw",
            note:
              "Effective Level = Base Level + Bonus Levels. Recomputes live " +
              "when either kid changes (sum of two children).",
          }
        ),
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
