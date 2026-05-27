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
  decomposeWinBonusRaw,
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
  /** When true, every emitted "Base Level" node defaults to the Max Book
   *  Lv Cap (research mode — caller is interested in the theoretical max,
   *  e.g. dr-max-values.html). When false/undefined (default), Base Level
   *  = min(rawLv, cap) and Points Invested = the actual save value, so
   *  Base + Bonus = Effective Level for /drop-rate and /talents-level. */
  useMaxResearchBaseLevel?: boolean;
  /** When true, the Spelunk Super Talent bonus is surfaced as a sibling
   *  "Super Levels" node under Effective Level instead of staying inside
   *  the Bonus Levels chain. Only meaningful for talents that pass the
   *  resolveAllTalentLVz exclusion gate (idx < 615, not in
   *  49-59/149/374/539/505) AND are listed in spelunkData[20+ci+12*preset]
   *  for the active char/preset — any other talent emits no Super node.
   *  Used by /talents-level so the user can see Base + Bonus + Super
   *  decomposed; left false by /drop-rate to keep the existing pool tree
   *  shape stable. */
  splitSuperLevels?: boolean;
};

type TalentResolveArgs = {
  tab?: number;
  mode?: "max";
};

export type TalentBonusDetail = {
  total: number;
  children: CorganNode[];
  /** Spelunk Super Talent contribution (50 + Legend7×10 + W7B5). Non-zero
   *  only when splitSuperLevels is on AND the talent is in
   *  spelunkData[20+ci+12*preset] for the active char's active preset.
   *  In every other case this stays 0 and the Spelunk node is left
   *  inside `children` (current /drop-rate behavior, unchanged). */
  superBonus?: number;
  /** Breakdown of the superBonus value (Base 50 / Legend 7 / W7 Bonus 5).
   *  Set alongside superBonus; used by talent.resolve to populate the
   *  separate Super Levels node's children when emitting the split shape. */
  superChildren?: CorganNode[];
  /** Whether this talent CAN be Spelunk-Super-Talented at all — i.e.
   *  passed the resolveAllTalentLVz exclusion check (idx < 615 and not
   *  in 49-59 / 149 / 374 / 539 / 505). True doesn't mean active; the
   *  active state is implied by superBonus > 0. talent.resolve uses
   *  this to decide whether to emit the Super Levels row in inactive
   *  (Active=0) state — when false, the row is omitted entirely. */
  superEligible?: boolean;
  /** The Spelunk Super Talent bonus the talent WOULD give if super-active
   *  on the char's preset (Base 50 + Legend7×10 + W7B5). Doesn't depend
   *  on which talent — it's an account-wide ceiling. Surfaced so
   *  talent.resolve can render an informative note on inactive Super
   *  Levels rows ("would give +60 if activated"). 0 when slotIdx < 0. */
  potentialSuperBonus?: number;
};

/** Build the Summoning Winner Bonus 19 ("Library Max") kids array.
 *  Groups the multiplicative chain into three nodes:
 *
 *  - Cyan 14 Winner Raw  : the raw points earned per mob (w6d3 +3 / w7a9 +1)
 *                          plus endless contribution. Now drilled down to
 *                          per-mob kill counts via decomposeWinBonusRaw.
 *  - Higher Bonus Multi  : Base × Pristine × Gem product — this is the
 *                          "X× higher bonus" multiplier the in-game tooltip
 *                          surfaces (~6.83× when all three are maxed)
 *  - Winner Multi        : additional 1 + Σ(artifact + tasks + achievements
 *                          + godshard set)/100 — shown separately because
 *                          the game treats this as a different upgrade lane
 *
 *  Final value = raw × Higher Bonus × Winner. */
function buildSummWB19Kids(
  wb19Parts: ReturnType<typeof _winBonusParts>,
  saveData: SaveData
): CorganNode[] {
  const baseMult = wb19Parts.baseMult ?? 3.5;
  const pristineMult = wb19Parts.pristineMult ?? 1;
  const gemMult = wb19Parts.gemMult ?? 1;
  const higherBonus = baseMult * pristineMult * gemMult;
  // Decompose the raw 4 (or whatever) into Summoning Battles, grouped
  // by world/color. Each battle is a Cyan (W6) / Teal (W7) / etc. row
  // showing how many times the user has beaten that specific mini-boss
  // and its per-kill contribution to this slot.
  const rawBreakdown = decomposeWinBonusRaw(saveData, 19);
  const battleKids: CorganNode[] = [];
  for (const group of rawBreakdown.groups) {
    const groupKids: CorganNode[] = group.battles.map((b) =>
      node(b.label, b.kills, null, {
        fmt: "raw",
        note:
          b.kills > 0
            ? `killed × ${b.perKill} per kill = +${b.contribution}`
            : `not yet defeated — would give +${b.perKill} per kill`,
      })
    );
    battleKids.push(
      node(group.color, group.total, groupKids, {
        fmt: "+",
        note: `Σ ${group.color} (W${group.worldIdx}) battle contributions`,
      })
    );
  }
  // Endless row — only when the 40-cycle actually targets this slot.
  // For Winner Bonus 19 ("Library Max") it never does, so this stays
  // hidden on slot-19 trees but will appear for slots 20-31 etc.
  if (rawBreakdown.perCycle > 0 || rawBreakdown.endlessTotal > 0) {
    battleKids.push(
      node(
        "Endless Summoning",
        rawBreakdown.endlessTotal,
        [
          node("Endless Wins (OLA[319])", rawBreakdown.endlessWins, null, {
            fmt: "raw",
          }),
          node("Per 40-cycle to this slot", rawBreakdown.perCycle, null, {
            fmt: "raw",
          }),
        ],
        {
          fmt: "+",
          note: `floor(${rawBreakdown.endlessWins}/40) × ${rawBreakdown.perCycle} + partial`,
        }
      )
    );
  }
  return [
    node("Summoning Battles", wb19Parts.raw ?? 0, battleKids.length ? battleKids : null, {
      fmt: "raw",
      note:
        "× " +
        higherBonus.toFixed(2) +
        "× Higher Bonus × " +
        (wb19Parts.winnerMult ?? 1).toFixed(2) +
        "× Winner Multi → " +
        (wb19Parts.val ?? 0).toFixed(2) +
        " effective",
    }),
    node(
      "Higher Bonus Multi",
      higherBonus,
      [
        node("Base Multi", baseMult, null, { fmt: "x" }),
        node(
          "Crystal Comb Pristine Charm",
          pristineMult,
          [node("Pristine 8 Bonus", wb19Parts.pristine8 ?? 0, null, { fmt: "raw" })],
          { fmt: "x", note: "1 + lv/100" }
        ),
        node(
          "Gem Shop Multi",
          gemMult,
          [node("Gem Items 11", wb19Parts.gemItems11 ?? 0, null, { fmt: "raw" })],
          { fmt: "x", note: "1 + 10×lv/100" }
        ),
      ],
      {
        fmt: "x",
        note: "Base × Pristine × Gem — the in-game 'X× higher bonus'",
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
      { fmt: "x", note: "1 + Σ winner sources / 100" }
    ),
  ];
}

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
  const summKids: CorganNode[] = buildSummWB19Kids(wb19Parts, saveData);
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
 *  per-talent for research scenarios). Skip for star talents (>=600).
 *
 *  Two modes:
 *  - Default ("actual save" — used by /drop-rate, /talents-level):
 *      Points Invested = rawLv (real save value)
 *      Base Level = min(rawLv, cap)
 *    so Base + Bonus = Effective Level holds in the displayed tree.
 *  - useMaxResearch=true (used by dr-max-values.html research tool):
 *      Points Invested = cap.value (theoretical max)
 *      Base Level = cap.value
 *    so the catalog gen-time refValue starts at the ceiling and the
 *    user only ever edits downward when researching scenarios. */
function emitBaseLevelNode(
  rawLv: number,
  saveData: SaveData,
  options?: {
    ownerName?: string;
    ownerCharIdx?: number;
    useMaxResearch?: boolean;
  }
): CorganNode {
  const cap = computeMaxBookLvParts(saveData);
  const ownerSuffix = options?.ownerName
    ? ` — owner: ${options.ownerName}`
    : options?.ownerCharIdx != null
      ? ` — owner: Char ${options.ownerCharIdx}`
      : "";
  if (options?.useMaxResearch) {
    // Research mode: every leaf snaps to cap so the gen-source-catalog
    // tool seeds the editable inputs at the ceiling. The "save=" suffix
    // on the Points Invested note still carries the real rawLv so the
    // user can see what they're actually at.
    return node(
      "Base Level",
      cap.value,
      [
        node("Points Invested", cap.value, null, {
          fmt: "raw",
          note: "save=" + rawLv + ownerSuffix,
        }),
        node("Max Book Lv Cap", cap.value, cap.kids, {
          fmt: "raw",
          note: "N.js maxBookLv",
        }),
      ],
      { fmt: "raw", note: "min(invested, cap)" + ownerSuffix }
    );
  }
  // Actual-save mode (default). Base Level reflects what the talent is
  // ACTUALLY at, capped by the account-wide max. This keeps the parent
  // Effective Level node's val = Base + Bonus on /drop-rate and
  // /talents-level — users were noticing the sum didn't add up before
  // because Base was hardcoded to cap.
  const capped = Math.min(rawLv, cap.value);
  return node(
    "Base Level",
    capped,
    [
      node("Points Invested", rawLv, null, {
        fmt: "raw",
        note: "actual save" + ownerSuffix,
      }),
      node("Max Book Lv Cap", cap.value, cap.kids, {
        fmt: "raw",
        note: "N.js maxBookLv",
      }),
    ],
    { fmt: "raw", note: "min(invested, cap)" + ownerSuffix }
  );
}

type ATLOpts = {
  contextSlot?: number;
  skipFamBonus68?: boolean;
  skipTal144FamMult?: boolean;
  partialFamBonusMap?: Record<number, number>;
  /** Threads ctx.useMaxResearchBaseLevel into the inner intervalAddCharNode
   *  closure so the Base Level kid it emits (for Tal 149/374/539 char rows)
   *  uses the same mode as the outer talent's Effective Level structure. */
  useMaxResearchBaseLevel?: boolean;
  /** Threads ctx.splitSuperLevels into resolveAllTalentLVz so it can
   *  decide whether to keep the Spelunk Super Talent node inside the Bonus
   *  chain or pull it out into the separate superBonus return field. */
  splitSuperLevels?: boolean;
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
  opts: ATLOpts | undefined,
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

  // Spelunk Super Talent. Two factors:
  //  - Is this talent ELIGIBLE? (passed the exclusion check above — set
  //    on the return as superEligible)
  //  - Is it ACTIVE for the active char's preset? (in spelunkData[20+ci+
  //    12*preset]). When yes, spelunkBonus = 50 + Legend7×10 + W7B5 and
  //    contributes to total. When no, spelunkBonus stays 0 BUT we still
  //    surface a Super Levels row in split mode so the user knows the
  //    bonus exists and is currently inactive (Active=0).
  //  - The Legend7 / W7B5 multipliers are account-wide, so the potential
  //    value can be computed even when the talent isn't yet super — we
  //    expose it via a note so the user can see "+60 if activated".
  const splitSuper = !!opts?.splitSuperLevels;
  let spelunkBonus = 0;
  let superChildren: CorganNode[] | undefined;
  let superActive = false;
  let potentialSuperBonus = 0;
  if (slotIdx >= 0) {
    const preset =
      Number(
        (playerStuffData as any)?.[slotIdx] && (playerStuffData as any)[slotIdx][1]
      ) || 0;
    // Compute the per-talent super bonus value regardless of array
    // membership — Legend7/W7B5 don't depend on which talent is selected,
    // only on account progress.
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
    potentialSuperBonus = Math.round(base + legend7 + w7b5);
    const superArr =
      saveData.spelunkData &&
      (saveData.spelunkData as any)[20 + slotIdx + 12 * preset];
    superActive = Array.isArray(superArr) && superArr.indexOf(talentIdx) !== -1;
    if (superActive) {
      spelunkBonus = potentialSuperBonus;
      const kids: CorganNode[] = [
        node("Base", base, null, { fmt: "raw" }),
        node("Spelunky Super Talent (Legend 7)", legend7, null, {
          fmt: "raw",
          note: "Spelunk[18][7] × 10",
        }),
        node("W7 Bonus 5", w7b5, null, { fmt: "raw" }),
      ];
      if (splitSuper) {
        // Split mode — pull the breakdown into the return so talent.resolve
        // can emit a separate "Super Levels" sibling. The Bonus chain
        // children list intentionally does NOT include this node.
        superChildren = kids;
      } else {
        // Legacy /drop-rate mode — keep Spelunk Super Talent inside the
        // Bonus chain (same shape the gen-source-catalog tool snapshots).
        children.push(
          node("Spelunk Super Talent", spelunkBonus, kids, { fmt: "raw" })
        );
      }
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
              useMaxResearch: !!opts?.useMaxResearchBaseLevel,
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
          // FB68's decay constants — emitted as kids ONLY when the
          // research tool is reading the tree at gen time (so
          // liftFormulaConsts in gen-source-catalog.ts can copy x1/x2/
          // lvOffset onto entry.familyBonusConsts metadata). On
          // /drop-rate and /talents-level these are noise — the formula
          // is invariant across the chosen char and the user can't edit
          // it from outside the research tool — so we omit them.
          ...(opts?.useMaxResearchBaseLevel
            ? [
                node("Formula x1", (fb34 as any).x1, null, { fmt: "raw" }),
                node("Formula x2", (fb34 as any).x2, null, { fmt: "raw" }),
                node("Lv Offset", lvOffset, null, { fmt: "raw" }),
              ]
            : []),
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
                    note: "save=" + tal144RawLv,
                  }),
                  node(
                    "Max Book Lv Cap",
                    maxBookLv,
                    [
                  node("Base Level (N.js literal)", baseLvl, null, { fmt: "+" }),
                  node("Talent Book Library Base", talentBookLibBase, null, { fmt: "+" }),
                  node("Salt Lick 4", saltLick4, [
                    node("Salt Lick 4 Lv", saltLick4Lv, null, { fmt: "raw" }),
                    node("Per Lv", saltLick4PerLv, null, { fmt: "raw" }),
                  ], { fmt: "+", note: "Lv × Per Lv" }),
                  node("W3 Merit Shop Unlock", w3MeritShop, [
                    node("W3 Merit Points Spent", w3MeritPts, null, { fmt: "raw" }),
                    node("Per Point", w3MeritShopPerPt, null, { fmt: "raw" }),
                  ], { fmt: "+", note: "Pts × Per Point" }),
                  node("Checkout Takeout Achievement", ach145, null, { fmt: "+" }),
                  node("Lv 1 Oxygen Atom", atom7, [
                    node("Atom 7 Lv", atom7Lv, null, { fmt: "raw" }),
                  ], { fmt: "+", note: "10 × min(Lv, 1)" }),
                  node("Sovereign Fury Relic", furyRelic, [
                    node("Artifact 21 Base", artifact21Base, null, { fmt: "raw" }),
                    node("Artifact 21 Tier", artifact21Tier, null, { fmt: "raw" }),
                  ], { fmt: "+", note: "Base × Tier" }),
                  node(
                    "Summoning Winner Bonus 19",
                    summWB19,
                    buildSummWB19Kids(wb19Parts, saveData),
                    { fmt: "+", note: "Raw × Higher Bonus × Winner Multi" }
                  ),
                    ],
                    { fmt: "raw", note: "N.js maxBookLv" }
                  ),
                ],
                { fmt: "raw", note: "min(invested, cap)" }
              ),
              node(
                "Bonus Levels",
                tal144EffLv - tal144RawLv,
                null,
                { fmt: "+", note: "Σ ATL (unbuffed FB68)" }
              ),
              // Tal144 decay constants — same story as FB68 above: only
              // emit when gen-source-catalog will lift them into
              // entry.familyGuyConsts metadata. Hidden on /drop-rate and
              // /talents-level since they're game-fixed.
              ...(opts?.useMaxResearchBaseLevel
                ? [
                    node("Tal144 Formula x1", t144 ? (t144 as any).x1 : 40, null, { fmt: "raw" }),
                    node("Tal144 Formula x2", t144 ? (t144 as any).x2 : 100, null, { fmt: "raw" }),
                  ]
                : []),
            ],
            { fmt: "raw", note: "1 + decay(x1, x2, Base+Bonus)/100" }
          );
          })(),
        ],
        {
          fmt: "raw",
          note: "floor(decay × Family Guy Multi if active)" + buffNote,
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
            note: "Lv0[0]",
          }),
        ],
        { fmt: "raw", note: "max(0, floor((Lv − 500)/100))" }
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
  // Effective Level = rawLv + total still holds regardless of split mode:
  // when splitSuper is true, the Bonus row in talent.resolve reports
  // (total - superBonus) and the Super row reports superBonus; sum is
  // unchanged. Only the presentation moves.
  return {
    total,
    children,
    superBonus: splitSuper ? spelunkBonus : 0,
    superChildren: splitSuper && superChildren ? superChildren : undefined,
    // Passed the exclusion check at line 510-518, so this talent is
    // eligible for the Spelunking 4D super slot. talent.resolve uses
    // this to keep the Super Levels row visible (with Active=0) even
    // when the user hasn't put the talent in the array for the active
    // char's preset. Only set when splitSuper is on so /drop-rate's
    // tree shape stays unchanged.
    superEligible: splitSuper ? true : undefined,
    potentialSuperBonus: splitSuper ? potentialSuperBonus : undefined,
  };
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
  saveData: SaveData,
  atlOpts?: ATLOpts
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
  const bonusDetail = resolveAllTalentLVz(atlInput, ctxChar, atlOpts, saveData);
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
  saveData: SaveData,
  atlOpts?: ATLOpts
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
      r = getTalentNumber(ci, talentIdx, data, ctxForATL, rawLv, saveData, atlOpts);
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
    // Convenience: ATL options carry the same flag as ctx so it reaches
    // every nested resolver (resolveAllTalentLVz → intervalAddCharNode →
    // emitBaseLevelNode).
    const atlOpts: ATLOpts = {
      useMaxResearchBaseLevel: !!ctx.useMaxResearchBaseLevel,
      splitSuperLevels: !!ctx.splitSuperLevels,
    };
    const baseOpts = { useMaxResearch: !!ctx.useMaxResearchBaseLevel };

    // Helper used by every Effective Level emit (mode="max", Tal 328
    // special, default emit). Three modes:
    //
    //   - splitSuperLevels off (default — /drop-rate, research tool):
    //       Effective Lv = [Base, Bonus]. Spelunk Super Talent stays
    //       inside the Bonus chain via resolveAllTalentLVz's children.
    //
    //   - splitSuperLevels on + talent ELIGIBLE + super ACTIVE:
    //       Effective Lv = [Base, Bonus (without spelunk), Super (with
    //       Active=1 + Base 50/Legend 7/W7 Bonus 5 kids)].
    //
    //   - splitSuperLevels on + talent ELIGIBLE + super INACTIVE:
    //       Effective Lv = [Base, Bonus, Super (val=0, with Active=0
    //       kid + a "would give +X" note showing the potential)].
    //
    //   - splitSuperLevels on + talent NOT eligible (49-59 / 149 / 374 /
    //     539 / 505 / >=615): no Super row emitted — those talents can't
    //     receive the Spelunk bonus at all.
    function buildEffectiveChildren(
      detail: TalentBonusDetail,
      baseLevelNode: CorganNode,
      bonusOpts?: { note?: string }
    ): CorganNode[] {
      const isSplit = !!atlOpts.splitSuperLevels && !!detail.superEligible;
      const superBonus = detail.superBonus || 0;
      const isSuperActive = superBonus > 0;
      const bonusOnly = isSplit ? detail.total - superBonus : detail.total;
      const bonusKidChildren = detail.children.length ? detail.children : null;
      const out: CorganNode[] = [
        baseLevelNode,
        node("Bonus Levels", bonusOnly, bonusKidChildren, {
          fmt: "+",
          note: bonusOpts?.note,
        }),
      ];
      if (isSplit) {
        const potential = detail.potentialSuperBonus || 0;
        const superKids: CorganNode[] = [
          node("Active", isSuperActive ? 1 : 0, null, { fmt: "raw" }),
        ];
        if (isSuperActive && detail.superChildren) {
          // Active — append the full Base 50 / Legend 7 / W7 Bonus 5
          // breakdown so the user can drill into where +60 came from.
          superKids.push(...detail.superChildren);
        }
        const superNote = isSuperActive
          ? "Spelunk Super Talent — active on this preset"
          : potential > 0
            ? `Spelunk Super Talent — inactive (would give +${potential} if super-talented on this preset)`
            : "Spelunk Super Talent — inactive on this preset";
        out.push(
          node("Super Levels", superBonus, superKids, {
            fmt: "+",
            note: superNote,
          })
        );
      }
      return out;
    }

    if (mode === "max") {
      const r = getbonus2(id, data, ctx.charIdx, saveData, atlOpts);
      let maxChildren: CorganNode[] = [
        node("Best Character " + r.bestChar, r.val, null, { fmt: "raw" }),
      ];
      if (r.detail) {
        maxChildren = [
          node(
            "Effective Level",
            r.detail.effectiveLv,
            buildEffectiveChildren(
              r.detail.bonusDetail,
              emitBaseLevelNode(r.detail.rawLv, saveData, {
                ownerCharIdx: r.bestChar,
                ownerName: saveData.charNames && saveData.charNames[r.bestChar],
                ...baseOpts,
              })
            ),
            { fmt: "raw" }
          ),
          node("Best Character " + r.bestChar, r.val, null, { fmt: "raw" }),
        ];
      }
      return node(name, r.val, maxChildren, { fmt: "+" });
    }

    // Talent 328 (Archlord of the Pirates): multiplicative DR factor
    if (id === 328) {
      const gb = getbonus2(id, data, ctx.charIdx, saveData, atlOpts);
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
            buildEffectiveChildren(
              gb.detail.bonusDetail,
              emitBaseLevelNode(gb.detail.rawLv, saveData, {
                ownerCharIdx: gb.bestChar,
                ownerName,
                ...baseOpts,
              }),
              { note: "computed for active char" }
            ),
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
        ],
        { fmt: "x" }
      );
    }

    const r = getTalentNumber(ctx.charIdx, id, data, ctx.activeCharIdx, undefined, saveData, atlOpts);
    // Emit the full talent breakdown even for level-0 talents so the
    // max-values tool can show what the talent would contribute if
    // the user levelled it. The Active toggle (0 = current state,
    // 1 = "as if active") lets them research that without zero-out
    // hacks.
    // bonusChildren is now built inside buildEffectiveChildren — the
    // helper reads r.bonusDetail.children directly and slices out the
    // Spelunk Super Talent node when split mode is on.
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

    // Star talents (id >= 615, minus 655 handled above). They're capped at
    // ~100 lv from a separate Star Talent Points pool — NOT subject to the
    // book-lv cap (idx < 615 in N.js line 9508-9509 clamp) and they don't
    // accept ATL bonus levels (computeAllTalentLVz returns 0 for idx > 614).
    // So the tree should be just Active + Level + formula — no Base Level
    // wrapped in Max Book Lv Cap, no Bonus Levels chain.
    if (id >= 615) {
      return node(
        name,
        r.val,
        [
          node("Active", activeFlag, null, { fmt: "raw" }),
          node("Level", r.rawLv, null, {
            fmt: "raw",
            note: "star talent — pool capped, no book lv",
          }),
        ],
        { fmt: "+", note: formulaNote }
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
          buildEffectiveChildren(
            r.bonusDetail,
            emitBaseLevelNode(r.rawLv, saveData, {
              ownerCharIdx: ctx.charIdx,
              ownerName: saveData.charNames && saveData.charNames[ctx.charIdx],
              ...baseOpts,
            })
          ),
          {
            fmt: "raw",
            note: atlOpts.splitSuperLevels
              ? "Base + Bonus + Super"
              : "Base + Bonus",
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
