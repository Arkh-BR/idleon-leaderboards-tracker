// ===== SUMMONING SYSTEM (W6) =====
// 1:1 port of corgan-source/js/stats/systems/w6/summoning.js. Adds the
// winBonus resolver used by the DR descriptor.

import { node, treeResult, type CorganNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { artifactBase } from "../../data/w5/sailing";
import { equipSetBonus } from "../../data/common/equipment";
import { SummonUPG } from "../../data/game/customlists.js";
import {
  SUMMON_ENDLESS_TYPE,
  SUMMON_ENDLESS_VAL,
  SUMMON_NORMAL_BONUS,
} from "../../data/w7/summon";
import { achieveStatus } from "../common/achievement";
import { computeEmperorBon } from "./emperor";
import { maxTalentBonus } from "../common/talent";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

/** Decompose the slot-24 SummWinBonus into its two sources — normal
 *  summoning unit ownership and endless summoning victories — so the
 *  max-values tool can expose each as an editable input. The endless
 *  side ALSO returns its raw OLA[319] win count and the per-40-cycle
 *  contribution for slot 24, so the user can research "what if I had
 *  N more endless wins". Slot 24 is one of the four (20/22/24/31)
 *  that skip the multiplicative chain — output is the raw sum. */
export function computeSummWinBonus24Parts(saveData: SaveData): {
  normal: number;
  endless: number;
  endlessWins: number;
  perCycle24: number;
} {
  const SLOT = 24; // matches bonusIdx after the -1 offset
  let normal = 0;
  if (saveData?.summonData) {
    const wins = (saveData.summonData[1] || []) as any[];
    for (let i = 0; i < wins.length; i++) {
      const name = wins[i];
      if (typeof name !== "string" || name.startsWith("rift")) continue;
      const entry = SUMMON_NORMAL_BONUS[name];
      if (!entry) continue;
      const bonusIdx = Math.round(entry[0] - 1);
      if (bonusIdx === SLOT) normal += entry[1];
    }
  }
  // Per-cycle contribution: sum over the 40-slot ring of values that
  // target slot 24.
  let perCycle24 = 0;
  for (let i = 0; i < 40; i++) {
    const type = (SUMMON_ENDLESS_TYPE[i] || 0) - 1;
    if (type === SLOT) perCycle24 += SUMMON_ENDLESS_VAL[i] || 0;
  }
  // Total endless contribution: full cycles × per cycle, plus the
  // partial cycle for any leftover wins.
  const endlessWins = Number((saveData?.olaData as any)?.[319]) || 0;
  const fullCycles = Math.floor(endlessWins / 40);
  const remainder = endlessWins % 40;
  let partial = 0;
  for (let i = 0; i < remainder; i++) {
    const type = (SUMMON_ENDLESS_TYPE[i] || 0) - 1;
    if (type === SLOT) partial += SUMMON_ENDLESS_VAL[i] || 0;
  }
  const endless = fullCycles * perCycle24 + partial;
  return { normal, endless, endlessWins, perCycle24 };
}

export function computeSummWinBonus(saveData: SaveData): number[] {
  const bonus = new Array(32).fill(0);
  if (!saveData || !saveData.summonData) return bonus;
  const normalWins = (saveData.summonData[1] || []) as any[];
  for (let i = 0; i < normalWins.length; i++) {
    const name = normalWins[i];
    if (typeof name !== "string" || name.startsWith("rift")) continue;
    const entry = SUMMON_NORMAL_BONUS[name];
    if (!entry) continue;
    const bonusIdx = Math.round(entry[0] - 1);
    if (bonusIdx >= 0 && bonusIdx < 32) bonus[bonusIdx] += entry[1];
  }
  const endlessWins = Number((saveData.olaData as any)?.[319]) || 0;
  for (let i = 0; i < endlessWins; i++) {
    const idx = i % 40;
    const type = (SUMMON_ENDLESS_TYPE[idx] || 0) - 1;
    if (type >= 0 && type < 32) bonus[type] += SUMMON_ENDLESS_VAL[idx] || 0;
  }
  return bonus;
}

/** Decompose where the raw Summoning Winner Bonus for a specific slot
 *  came from — used by talent.ts to surface per-mob kill counts under
 *  the "Summoning Battles" node so the user can see WHICH battles are
 *  contributing the points. Battles are grouped by world color: w6 →
 *  Cyan, w7 → Teal, etc. Endless wins fold into a single row when
 *  they contribute. */
export type WinBonusBattleEntry = {
  /** Raw mob id from the save (e.g. "w6d3", "w7a9"). */
  mob: string;
  /** Human-readable "Battle N" name parsed from the mob id. */
  label: string;
  /** Kill count from saveData.summonData[1]. 0 means the battle is
   *  available but not yet defeated. */
  kills: number;
  /** Per-kill value for the target bonus slot. */
  perKill: number;
  /** kills × perKill — the actual contribution to the slot's raw. */
  contribution: number;
};

export type WinBonusBattleGroup = {
  /** "Cyan", "Teal", "World N" — the friendly color/world label. */
  color: string;
  /** Worlds parsed from mob name prefix: 6 → "w6", 7 → "w7", etc. 0
   *  for mobs without a wN prefix (early-game mobs, treated as W1). */
  worldIdx: number;
  /** Battles in this world that target the requested bonus slot. */
  battles: WinBonusBattleEntry[];
  /** Σ contribution across the group (sum of battle contributions). */
  total: number;
};

export type WinBonusRawBreakdown = {
  /** Total raw value (= Σ groups + endlessTotal). */
  total: number;
  /** Battles grouped by world / color. Only worlds that have at least
   *  one battle targeting this slot are included. */
  groups: WinBonusBattleGroup[];
  /** Sum of all endless contributions to this slot. 0 when no slot
   *  in the 40-cycle targets this bonus index. */
  endlessTotal: number;
  /** Endless wins count (OLA[319]) — surfaced for context. */
  endlessWins: number;
  /** Per-40-cycle contribution to this slot (= constant). When 0, more
   *  endless wins won't grow this raw. */
  perCycle: number;
};

// World index → friendly color name shown in the tree. Cyan (w6) and
// Teal (w7) are confirmed; the others are best-guesses based on the
// in-game Summoning UI color palette and might need tweaking when a
// save with W2-W5 contributions to a non-19 slot is inspected.
const WORLD_COLOR: Record<number, string> = {
  1: "Green",
  2: "Blue",
  3: "Pink",
  4: "Yellow",
  5: "Purple",
  6: "Cyan",
  7: "Teal",
  8: "Crimson",
};

function parseWorldFromMob(mob: string): {
  worldIdx: number;
  section: string;
  num: number;
} | null {
  // Mobs follow "w<world><section><num>" pattern (e.g. "w6d3" = W6,
  // section "d", number 3). Returns null for mobs without this prefix
  // (early-game mushG/frogG/Copper/Iron/Pet* — those don't get a
  // "Battle N" label since they belong to W1's grid that uses unique
  // mob names, not section-numbered slots).
  const m = mob.match(/^w(\d+)([a-z]+)(\d+)$/);
  if (m) {
    return { worldIdx: Number(m[1]), section: m[2], num: Number(m[3]) };
  }
  return null;
}

/** Stable sort key for "natural" ordering of W6/W7 battles: (section
 *  letter, numeric position). This makes w6a1 < w6a2 < ... < w6a5 <
 *  w6b1 < ... < w6d3 (matching the in-game grid order), and
 *  w7a1 < w7a2 < ... < w7a9 < w7a10 < w7a11 (instead of lexicographic
 *  which would put w7a10 before w7a2). */
function battleSortKey(p: { section: string; num: number }): string {
  return p.section + p.num.toString().padStart(4, "0");
}

export function decomposeWinBonusRaw(
  saveData: SaveData,
  bonusIdx: number
): WinBonusRawBreakdown {
  // Step 0: compute a world → ordered-mob-list lookup. This is the
  // "in-game grid position" — each mob's number within its world (e.g.
  // w6d3 is the 14th Cyan battle in the natural section-letter +
  // numeric-suffix order: a1..a5, b1..b4, c1..c2, d1..d3). The user
  // expects "Battle 14" / "Battle 9" labels, not "Battle d3" / "Battle
  // a9", so we have to enumerate ALL mobs that match the wN<section>
  // pattern and sort naturally.
  const worldPositions = new Map<string, number>();
  const worldRosters = new Map<number, string[]>();
  for (const mob in SUMMON_NORMAL_BONUS) {
    const parsed = parseWorldFromMob(mob);
    if (!parsed) continue;
    let roster = worldRosters.get(parsed.worldIdx);
    if (!roster) {
      roster = [];
      worldRosters.set(parsed.worldIdx, roster);
    }
    roster.push(mob);
  }
  for (const [w, mobs] of worldRosters) {
    void w;
    mobs.sort((a, b) => {
      const pa = parseWorldFromMob(a)!;
      const pb = parseWorldFromMob(b)!;
      return battleSortKey(pa).localeCompare(battleSortKey(pb));
    });
    mobs.forEach((m, i) => worldPositions.set(m, i + 1));
  }

  // Step 1: figure out every mob that targets this slot.
  const eligible: Array<{ mob: string; perKill: number }> = [];
  for (const mob in SUMMON_NORMAL_BONUS) {
    const entry = SUMMON_NORMAL_BONUS[mob];
    const idx = Math.round(entry[0] - 1);
    const perKill = entry[1];
    if (idx === bonusIdx && perKill > 0) {
      eligible.push({ mob, perKill });
    }
  }

  // Step 2: count user's kills per eligible mob from saveData.summonData[1].
  const killCount = new Map<string, number>();
  if (saveData?.summonData) {
    const normalWins = (saveData.summonData[1] || []) as any[];
    for (const name of normalWins) {
      if (typeof name !== "string") continue;
      killCount.set(name, (killCount.get(name) || 0) + 1);
    }
  }

  // Step 3: group eligible mobs by world and label each with its
  // grid-position number ("Battle 14", "Battle 9", …).
  const byWorld = new Map<number, WinBonusBattleEntry[]>();
  for (const { mob, perKill } of eligible) {
    const parsed = parseWorldFromMob(mob);
    if (!parsed) continue; // shouldn't happen for slots > 1
    const worldIdx = parsed.worldIdx;
    const position = worldPositions.get(mob) ?? 0;
    const kills = killCount.get(mob) || 0;
    const battle: WinBonusBattleEntry = {
      mob,
      label: position > 0 ? `Battle ${position}` : mob,
      kills,
      perKill,
      contribution: kills * perKill,
    };
    const arr = byWorld.get(worldIdx);
    if (arr) arr.push(battle);
    else byWorld.set(worldIdx, [battle]);
  }
  const groups: WinBonusBattleGroup[] = Array.from(byWorld.entries())
    .map(([worldIdx, battles]) => ({
      worldIdx,
      color: WORLD_COLOR[worldIdx] || `World ${worldIdx}`,
      battles: battles.sort((a, b) => {
        const pa = parseWorldFromMob(a.mob)!;
        const pb = parseWorldFromMob(b.mob)!;
        return battleSortKey(pa).localeCompare(battleSortKey(pb));
      }),
      total: battles.reduce((s, b) => s + b.contribution, 0),
    }))
    .sort((a, b) => a.worldIdx - b.worldIdx);

  // Step 4: endless cycle math (unchanged from before).
  let perCycle = 0;
  for (let i = 0; i < 40; i++) {
    const type = (SUMMON_ENDLESS_TYPE[i] || 0) - 1;
    if (type === bonusIdx) perCycle += SUMMON_ENDLESS_VAL[i] || 0;
  }
  const endlessWins = Number((saveData?.olaData as any)?.[319]) || 0;
  const fullCycles = Math.floor(endlessWins / 40);
  const remainder = endlessWins % 40;
  let partial = 0;
  for (let i = 0; i < remainder; i++) {
    const type = (SUMMON_ENDLESS_TYPE[i] || 0) - 1;
    if (type === bonusIdx) partial += SUMMON_ENDLESS_VAL[i] || 0;
  }
  const endlessTotal = fullCycles * perCycle + partial;

  const total = groups.reduce((s, g) => s + g.total, 0) + endlessTotal;
  return { total, groups, endlessTotal, endlessWins, perCycle };
}

type WinBonusParts = {
  val: number;
  raw: number;
  simple?: boolean;
  baseMult?: number;
  pristine8?: number;
  pristineMult?: number;
  gemItems11?: number;
  gemMult?: number;
  artBonus32?: number;
  artRarity?: number;
  taskVal?: number;
  ach379?: number;
  ach373?: number;
  wb31?: number;
  empBon8?: number;
  godshardSet?: number;
  winnerSum?: number;
  winnerMult?: number;
  idx?: number;
};

export function _winBonusParts(idx: number, swb: number[], saveData: SaveData): WinBonusParts {
  const raw = swb[idx] || 0;
  if (raw <= 0) return { val: 0, raw: 0 };
  if (idx === 20 || idx === 22 || idx === 24 || idx === 31)
    return { val: raw, raw, simple: true };
  const pristine8 =
    saveData.ninjaData && (saveData.ninjaData[107] as any)?.[8] === 1 ? 30 : 0;
  const gemItems11 = Number((saveData.gemItemsData as any)?.[11]) || 0;
  const artRarity =
    Number((saveData.sailingData as any)?.[3]?.[32]) || 0;
  const artBonus32 = artRarity > 0 ? artifactBase(32) * artRarity : 0;
  const taskVal = Math.min(
    10,
    Number((saveData.tasksGlobalData as any)?.[2]?.[5]?.[4]) || 0
  );
  const wb31 = swb[31] || 0;
  const empBon8 = computeEmperorBon(8, saveData);
  const godshardSet = String((saveData.olaData as any)?.[379] ?? "").includes(
    "GODSHARD_SET"
  )
    ? equipSetBonus("GODSHARD_SET")
    : 0;
  const ach379 = achieveStatus(379, saveData);
  const ach373 = achieveStatus(373, saveData);
  const baseMult = idx >= 20 && idx <= 33 ? 1 : 3.5;
  const pristineMult = 1 + pristine8 / 100;
  const gemMult = 1 + (10 * gemItems11) / 100;
  let winnerSum = artBonus32 + taskVal + ach379 + ach373 + godshardSet;
  if (idx !== 19) winnerSum += wb31 + empBon8;
  const winnerMult = 1 + winnerSum / 100;
  const val = baseMult * raw * pristineMult * gemMult * winnerMult;
  return {
    val, raw, baseMult, pristine8, pristineMult, gemItems11, gemMult,
    artBonus32, artRarity, taskVal, ach379, ach373, wb31, empBon8,
    godshardSet, winnerSum, winnerMult, idx,
  };
}

export function computeWinBonus(
  idx: number,
  opts: { noArt32?: boolean } | null,
  saveData: SaveData
): number {
  const swb = computeSummWinBonus(saveData);
  const p = _winBonusParts(idx, swb, saveData);
  if (opts && opts.noArt32 && (p.artBonus32 || 0) > 0) {
    const ws = (p.winnerSum || 0) - (p.artBonus32 || 0);
    return (
      (p.baseMult || 0) * p.raw * (p.pristineMult || 1) * (p.gemMult || 1) *
      (1 + ws / 100)
    );
  }
  return p.val;
}

export function computeSummUpgBonus(t: number, saveData: SaveData): TreeResult {
  const level = Number((saveData.summonData as any)?.[0]?.[t]) || 0;
  if (level <= 0) return treeResult(0);
  const perLv = Number((SummonUPG as any)[t]?.[6]) || 0;
  if (perLv <= 0) return treeResult(0);
  let moltoz = 1;
  const moltozChildren: CorganNode[] = [];
  const gilded = saveData.holesData && (saveData.holesData[28] as any[] | undefined);
  if (gilded && gilded.indexOf(t) !== -1) {
    moltoz = 2;
    const tal597 = maxTalentBonus(597, undefined, saveData);
    const tal597Add = Math.max(0, tal597 / 100 - 1);
    let bonus78 = 0;
    if (t !== 78) {
      const lv78 = Number((saveData.summonData as any)?.[0]?.[78]) || 0;
      const pLv78 = Number((SummonUPG as any)[78]?.[6]) || 0;
      bonus78 = lv78 * pLv78;
    }
    moltoz += tal597Add + bonus78 / 100;
    moltozChildren.push(node("Gilded Base", 2, null, { fmt: "raw" }));
    if (tal597Add > 0)
      moltozChildren.push(node("Talent 597", tal597Add, null, { fmt: "raw" }));
    if (bonus78 > 0)
      moltozChildren.push(node("Bonus78 (" + bonus78 + "/100)", bonus78 / 100, null, { fmt: "raw" }));
  }
  const stoneEligible = Number((SummonUPG as any)[t]?.[10]) || 0;
  if (stoneEligible === 1) {
    const stoneType = Number((SummonUPG as any)[t]?.[2]) || 0;
    const kr = saveData.krBestData as any;
    const trialVal = kr && kr["SummzTrz" + stoneType] ? Number(kr["SummzTrz" + stoneType]) : 0;
    if (trialVal > 0) {
      moltoz *= 1 + trialVal;
      moltozChildren.push(
        node("Stone Trial (" + stoneType + ")", 1 + trialVal, null, { fmt: "x" })
      );
    }
  }
  const val = moltoz * level * perLv;
  return treeResult(val, [
    node("Level", level, null, { fmt: "raw" }),
    node("Per Level", perLv, null, { fmt: "raw" }),
    node("Moltoz Multi", moltoz, moltozChildren.length ? moltozChildren : null, { fmt: "x" }),
  ]);
}

// Friendly labels for the Summoning win-bonus tiers that feed the DR pool.
// Sourced from summoningBonuses[i].bonus in IT website-data, scrubbed of the
// "+{%_" placeholder syntax.
const SUMM_WIN_NAMES: Record<number, string> = {
  9: "Drop Rate Summoning Win",
};
function summoningWinName(id: number): string {
  const friendly = SUMM_WIN_NAMES[id];
  return friendly ? `${friendly} (Summoning ${id})` : label("Summoning", id);
}

export const winBonus = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const swb = computeSummWinBonus(saveData);
    const p = _winBonusParts(id, swb, saveData);
    if (p.val <= 0)
      return node(summoningWinName(id), 0, null, { note: "summoning win " + id });

    if (p.simple) {
      return node(
        summoningWinName(id),
        p.val,
        [node("Win Bonus Raw", p.raw, null, { fmt: "raw" })],
        { fmt: "+", note: "summoning win " + id }
      );
    }

    const winnerSumParts: CorganNode[] = [
      node(label("Artifact", 32), p.artBonus32 || 0, null, {
        fmt: "raw",
        note: "rarity=" + (p.artRarity || 0),
      }),
      node("Task Shop", p.taskVal || 0, null, { fmt: "raw" }),
      node(label("Achievement", 379), p.ach379 || 0, null, { fmt: "raw" }),
      node(label("Achievement", 373), p.ach373 || 0, null, { fmt: "raw" }),
    ];
    if (id !== 19) {
      winnerSumParts.push(node("Win Bonus 31", p.wb31 || 0, null, { fmt: "raw" }));
      winnerSumParts.push(node("Emperor Bon 8", p.empBon8 || 0, null, { fmt: "raw" }));
    }
    winnerSumParts.push(node("Godshard Set", p.godshardSet || 0, null, { fmt: "raw" }));
    return node(
      summoningWinName(id),
      p.val,
      [
        node("Win Bonus Raw", p.raw, null, { fmt: "raw" }),
        node("Base Multiplier", p.baseMult || 1, null, { fmt: "x" }),
        node("Crystal Comb (Pristine 8)", p.pristineMult || 1, null, {
          fmt: "x",
          note: (p.pristine8 || 0) > 0 ? "Equipped" : "Not equipped",
        }),
        node("Gem Shop Bonus", p.gemMult || 1, null, {
          fmt: "x",
          note: "items=" + (p.gemItems11 || 0),
        }),
        node("Winner Multi", p.winnerMult || 1, winnerSumParts, { fmt: "x" }),
      ],
      { fmt: "+", note: "summoning win " + id }
    );
  },
};
