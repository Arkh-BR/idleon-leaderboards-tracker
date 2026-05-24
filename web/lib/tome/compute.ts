// computeRawValue switch and the public computeTome() entry point.
// 1:1 port of Code_TomeRaw_v6_1.gs v7.9. See that file for source-of-truth.

import {
  COMPUTE_LB_FALLBACK,
  NEI32,
  TOME_BONUSES,
  TOME_TASKS,
} from "./tasks";
import {
  arrSum,
  calcTomePts,
  lavaLog,
  preparseLavaStrings,
  type RawObj,
} from "./math";
import * as ex from "./extractors";

type D = RawObj;
type ParsedData = Record<string, unknown>;

type SrcOut = { label: string };

// Numeric value or null when the JSON doesn't have what we need.
export type TomeRow = {
  idx: number; // 1..118 task position
  task: string;
  rawValue: number | null;
  pts: number | null;
  source: string; // "MISSING" / "raw.XYZ" / "OptLacc[N]" / "ERR:..." / "LB:..."
  computeIdx: number;
  bonus: readonly [number, number, number] | undefined;
};

export type TomeResult = {
  rows: TomeRow[];
  totalPts: number;
  coveredCount: number;
  missingCount: number;
  // True when we overrode our locally-computed pts with the authoritative
  // values from the input's parsedData.tomePoints (IT API response).
  usedParsedTomePoints: boolean;
};

function R<T>(out: SrcOut, label: string, value: T): T {
  out.label = label;
  return value;
}

function O(opt: unknown[], i: number, out: SrcOut): number | null {
  out.label = "OptLacc[" + i + "]";
  return opt[i] !== undefined ? Number(opt[i]) : null;
}

// In paste mode we have no leaderboard data — fallback always returns null
// but we still label the row "MISSING (LB fallback)" so the user knows it's
// because the LB-only data wasn't pasted (matches .gs behavior in paste mode).
function fallbackLabel(idx: number): string {
  const m = COMPUTE_LB_FALLBACK[idx];
  return m ? "MISSING (LB: " + m[0] + "." + m[1] + ")" : "MISSING";
}

function computeRawValue(
  idx: number,
  data: D,
  pd: ParsedData,
  out: SrcOut
): number | null {
  const opt = Array.isArray(data.OptLacc) ? (data.OptLacc as unknown[]) : [];

  switch (idx) {
    case 0: {
      const v = ex.rawStamps(data);
      return v !== null ? R(out, "raw.StampLv", v) : null;
    }
    case 1: return R(out, "raw.StatueLevels_0", ex.rawStatues(data));
    case 2: {
      const v = ex.rawCardsTotalLvProper(data);
      return v !== null ? R(out, "sum(stars+1) per card", v) : null;
    }
    case 3: {
      const v = ex.rawTalentMaxLevel(data);
      return v !== null ? R(out, "max SL/SM per talent", v) : null;
    }
    case 4: return R(out, "raw.QuestComplete", ex.rawUniqueQuests(data));
    case 5: return R(out, "raw.Lv0_X", ex.rawAccountLevel(data));
    case 6: return R(out, "raw.TaskZZ1 sum", ex.rawTotalTasks(data));
    case 7: return R(out, "raw.AchieveReg", ex.rawAchievements(data));
    case 8: return O(opt, 198, out);
    case 9: return O(opt, 208, out);
    case 10: {
      const v = ex.rawLootyCount(data, "Trophy");
      return v !== null ? R(out, "raw.Cards1 Trophy", v) : null;
    }
    case 11: {
      const v = ex.rawSkillsLevels(data);
      return v !== null ? R(out, "sum Lv0_X[1..20]", v) : null;
    }
    case 12: return O(opt, 201, out);
    case 13: {
      const t = data.TaskZZ0;
      if (Array.isArray(t) && Array.isArray(t[0]) && t[0][2] !== undefined) {
        return R(out, "raw.TaskZZ0[0][2]", Number(t[0][2]));
      }
      return null;
    }
    case 14: return O(opt, 172, out);
    case 15: {
      const v = ex.rawStarTalentsProper(data);
      return v !== null ? R(out, "max(charLv-1+skillSum1-9-3)", v) : null;
    }
    case 16: {
      const s = O(opt, 202, out);
      return s ? R(out, "1/OptLacc[202]", 1 / s) : null;
    }
    case 17: {
      const v = ex.rawDungeonRank(data);
      return v !== null ? R(out, "OptLacc[71] vs dungeonLevels", v) : null;
    }
    case 18: return O(opt, 200, out);
    case 19: {
      const v = ex.rawConstellations(data);
      return v !== null ? R(out, "raw.SSprog sum done", v) : null;
    }
    case 20: return O(opt, 203, out);
    case 21: {
      const v = ex.rawLootyCount(data, "Obol");
      return v !== null ? R(out, "raw.Cards1 Obol", v) : null;
    }
    case 22: {
      const v = ex.rawBubbleTotalLv(data);
      return v !== null ? R(out, "CauldronInfo[0..3] sum", v) : null;
    }
    case 23: {
      const v = ex.rawVialTotalLv(data);
      return v !== null ? R(out, "CauldronInfo[4] sum", v) : null;
    }
    case 24: {
      const v = ex.rawSigils(data);
      return v !== null ? R(out, "CauldronP2W[4] sum", v) : null;
    }
    case 25: return O(opt, 199, out);
    case 26: {
      const po =
        Number(data.CYDeliveryBoxComplete || 0) +
        Number(data.CYDeliveryBoxStreak || 0) +
        Number(data.CYDeliveryBoxMisc || 0);
      return po > 0 ? R(out, "raw.CYDeliveryBox*", po) : null;
    }
    case 27: return O(opt, 204, out);
    case 28: return O(opt, 205, out);
    case 29: return O(opt, 206, out);
    case 30: {
      const ef = O(opt, 207, out);
      return ef !== null ? R(out, "1000 - OptLacc[207]", 1000 - ef) : null;
    }
    case 31: return O(opt, 211, out);
    case 32: return O(opt, 212, out);
    case 33: return O(opt, 213, out);
    case 34: return O(opt, 214, out);
    case 35: return O(opt, 215, out);
    case 36: return O(opt, 209, out);
    case 37: {
      const v = ex.rawWorshipWaves(data);
      return v !== null ? R(out, "sum TotemInfo[0]", v) : null;
    }
    case 38: {
      const v = ex.rawDeathNoteDigitsProper(data);
      return v !== null ? R(out, "deathNote99 + miniBoss digits", v) : null;
    }
    case 39: {
      const v = ex.rawEquinoxClouds(data);
      return v !== null ? R(out, "WeeklyBoss d_*==-1", v) : null;
    }
    case 40: {
      const v = ex.rawRefineryRank(data);
      return v !== null ? R(out, "Refinery salts[0..5].rank sum", v) : null;
    }
    case 41: return R(out, "raw.Atoms", arrSum(data.Atoms));
    case 42: {
      const v = ex.rawTowerSum(data);
      return v !== null && v > 0 ? R(out, "Tower sum[0..26]", v) : null;
    }
    case 43: {
      const v = ex.rawStorageCritter(data);
      return v !== null ? R(out, "ChestOrder/Critter11A", v) : null;
    }
    case 44: return O(opt, 224, out);
    case 45: {
      if (Array.isArray(data.Rift) && (data.Rift as unknown[])[0] !== undefined) {
        return R(out, "raw.Rift[0]", Number((data.Rift as unknown[])[0]));
      }
      return null;
    }
    case 46: {
      const v = ex.rawHighestPowerMob(data);
      return v !== null ? R(out, "max powers PetsStored+Breeding[3]", v) : null;
    }
    case 47: {
      const rd = O(opt, 220, out);
      return rd !== null ? R(out, "1000 - OptLacc[220]", 1000 - rd) : null;
    }
    case 48: {
      const v = ex.rawKitchenLevels(data);
      return v !== null ? R(out, "Cooking sum[6..8]", v) : null;
    }
    case 49: {
      const v = ex.rawShinyLevelsProper(data);
      if (v !== null) return R(out, "sum getShinyLevel per pet", v);
      if (pd && pd.totalShinyLevels !== undefined) {
        return R(out, "parsedData.totalShinyLevels", Number(pd.totalShinyLevels));
      }
      return null;
    }
    case 50: {
      const v = ex.rawMeals(data);
      return v !== null ? R(out, "raw.Meals[0] sum", v) : null;
    }
    case 51: {
      const v = ex.rawBreedability(data);
      if (v !== null) return R(out, "Breeding[7] sum", v);
      if (pd && pd.totalBreedabilityLevels !== undefined) {
        return R(out, "parsedData.totalBreedabilityLevels", Number(pd.totalBreedabilityLevels));
      }
      return null;
    }
    case 52: {
      const v = ex.rawLabChips(data);
      return v !== null ? R(out, "Lab[15] sum max(0)", v) : null;
    }
    case 53: return R(out, "raw.FamValColosseumHighscores", ex.rawColoScore(data));
    case 54: return O(opt, 217, out);
    case 55: return R(out, "raw.StuG", ex.rawOnyxStatues(data));
    case 56: {
      const v = O(opt, 218, out);
      return v !== null ? R(out, "1000 - OptLacc[218]", 1000 - v) : null;
    }
    case 57: {
      const v = ex.rawBoatsLevel(data);
      return v !== null ? R(out, "Boats b[3]+b[5]", v) : null;
    }
    case 58: {
      const v = ex.rawGodRank(data);
      return v !== null ? R(out, "Divinity[0..10] sum", v) : null;
    }
    case 59: {
      const gs = data.GamingSprout;
      if (Array.isArray(gs) && Array.isArray(gs[28]) && (gs[28] as unknown[])[1] !== undefined) {
        return R(out, "raw.GamingSprout[28][1]", Number((gs[28] as unknown[])[1]));
      }
      return null;
    }
    case 60: {
      const v = ex.rawArtifacts(data);
      return v !== null ? R(out, "Sailing[3] sum", v) : null;
    }
    case 61: {
      if (Array.isArray(data.Sailing) && Array.isArray((data.Sailing as unknown[])[1])) {
        const sl = (data.Sailing as unknown[])[1] as unknown[];
        return R(out, "raw.Sailing[1][0] (lootPile)", Number(sl[0]));
      }
      return null;
    }
    case 62: {
      const v = ex.rawCaptainMaxLv(data);
      return v !== null ? R(out, "max Captains[i][3]", v) : null;
    }
    case 63: {
      // Mirror .gs: `(data.GamingSprout && Number(data.GamingSprout[8]||0)) || 0`
      // — the trailing `|| 0` catches NaN from non-numeric values.
      const gs8 =
        Array.isArray(data.GamingSprout) && (data.GamingSprout as unknown[])[8] !== undefined
          ? Number((data.GamingSprout as unknown[])[8])
          : 0;
      const snl = Number.isFinite(gs8) ? gs8 : 0;
      const op210 = O(opt, 210, out) || 0;
      return R(out, "max(GamingSprout[8],OptLacc[210])", Math.max(snl, op210));
    }
    case 64: {
      if (Array.isArray(data.Gaming) && (data.Gaming as unknown[])[8] !== undefined) {
        return R(out, "raw.Gaming[8]", Number((data.Gaming as unknown[])[8]));
      }
      return null;
    }
    case 65: {
      if (pd && pd.slab !== undefined) return R(out, "parsedData.slab", Number(pd.slab));
      const v = ex.rawItemsFound(data);
      return v !== null ? R(out, "Cards1.length (lootyRaw)", v) : null;
    }
    case 66: {
      if (Array.isArray(data.Gaming) && (data.Gaming as unknown[])[0] !== undefined) {
        return R(out, "raw.Gaming[0]", Number((data.Gaming as unknown[])[0]));
      }
      return null;
    }
    case 67: {
      const co = O(opt, 219, out);
      return co !== null ? R(out, "2^OptLacc[219]", Math.pow(2, co)) : null;
    }
    case 68: return R(out, "keys(FarmCrop)", ex.rawCropsDiscovered(data));
    case 69: {
      const v = ex.rawBeanstalk(data);
      return v !== null ? R(out, "Ninja[104] sum", v) : null;
    }
    case 70: return R(out, "raw.Summon[0] sum", ex.rawSummoningUpg(data));
    case 71: {
      const v = ex.rawCareerSummWins(data);
      return v !== null ? R(out, "Summon[1].length+OptLacc[319]", v) : null;
    }
    case 72: {
      const op72 = O(opt, 232, out);
      if (op72 && op72 > 0) return R(out, "OptLacc[232]*12", op72 * 12);
      return null;
    }
    case 73: {
      const v = ex.rawFamiliars(data);
      return v !== null ? R(out, "Summon[4] reduce", v) : null;
    }
    case 74: {
      const v = ex.rawJadeEmporium(data);
      return v !== null ? R(out, "Ninja[102][9].length", v) : null;
    }
    case 75: {
      const v = ex.rawMinigameScore(data);
      return v !== null ? R(out, "FamValMinigameHiscores sum[:5]", v) : null;
    }
    case 76: {
      const v = ex.rawPrayers(data);
      return v !== null ? R(out, "sum PrayOwned[:19]", v) : null;
    }
    case 77: return R(out, "raw.FarmRank[0] sum", ex.rawLandRank(data));
    case 78: return O(opt, 221, out);
    case 79: return O(opt, 222, out);
    case 80: return R(out, "raw.ArcadeUpg sum", ex.rawArcade(data));
    case 81: {
      if (Array.isArray(data.UpgVault) && (data.UpgVault as unknown[])[57] !== undefined) {
        return R(out, "min(1500,UpgVault[57]*2)", Math.min(1500, Number((data.UpgVault as unknown[])[57]) * 2));
      }
      return null;
    }
    case 82: {
      const v = ex.rawGambitTime(data);
      return v !== null ? R(out, "sum Holes[11][65..70]", v) : null;
    }
    case 83: {
      if (Array.isArray(data.Holes) && Array.isArray((data.Holes as unknown[])[9])) {
        const h9 = (data.Holes as unknown[])[9] as unknown[];
        let s = 0;
        for (let i = 0; i < h9.length; i++) s += Math.ceil(lavaLog(Number(h9[i]) || 0));
        return R(out, "sum ceil(lavaLog(Holes[9]))", s);
      }
      return null;
    }
    case 84: {
      const v = ex.rawHolesSum(data, 1);
      return v !== null ? R(out, "Holes[1] sum", v) : null;
    }
    case 85: return O(opt, 262, out);
    case 86: return O(opt, 279, out);
    case 87: {
      const v = ex.rawExtraCalc(data, 73);
      return v !== null ? R(out, "Holes[11][73]", v) : null;
    }
    case 88: {
      const v = ex.rawExtraCalc(data, 74);
      return v !== null ? R(out, "Holes[11][74]", v) : null;
    }
    case 89: {
      const v = ex.rawExtraCalc(data, 75);
      return v !== null ? R(out, "Holes[11][75]", v) : null;
    }
    case 90: return O(opt, 356, out);
    case 91: {
      const v = ex.rawExtraCalc(data, 8);
      return v !== null ? R(out, "Holes[11][8]", v) : null;
    }
    case 92: {
      const v = ex.rawHoleLayers(data);
      return v !== null ? R(out, "Holes[11][1,3,5,7] sum", v) : null;
    }
    case 93: {
      const v = ex.rawHoleOpals(data);
      return v !== null ? R(out, "Holes[7] sum", v) : null;
    }
    case 94: {
      const v = O(opt, 353, out);
      return v !== null ? R(out, "round(min(12,OptLacc[353])+1)", Math.round(Math.min(12, v) + 1)) : null;
    }
    case 95: {
      const v = O(opt, 369, out);
      return v !== null ? R(out, "round(OptLacc[369])", Math.round(v)) : null;
    }
    case 96: {
      const v = ex.rawSummonStones(data);
      return v !== null ? R(out, "sum KRbest[SummzTrz*]", v) : null;
    }
    case 97: {
      const v = ex.rawCoralReefSum(data);
      return v !== null ? R(out, "Spelunk[13] sum", v) : null;
    }
    case 98: {
      const v = ex.rawBestCave(data);
      return v !== null ? R(out, "max Spelunk[1]", v) : null;
    }
    case 99: {
      const v = ex.rawNinjaUpgrades(data);
      return v !== null ? R(out, "Ninja[103] sum", v) : null;
    }
    case 100: return O(opt, 445, out);
    case 101: return O(opt, 446, out);
    case 102: {
      const v = ex.rawBiggestHaul(data);
      return v !== null ? R(out, "max Spelunk[2]", v) : null;
    }
    case 103: {
      const v = ex.rawSpelunkUpgrades(data);
      return v !== null ? R(out, "sum max(0,Spelunk[5])", v) : null;
    }
    case 104: {
      const v = ex.rawSpelunkDiscoveries(data);
      return v !== null ? R(out, "Spelunk[6].length", v) : null;
    }
    case 105: {
      const v = ex.rawSpelunkerLevel(data);
      return v !== null ? R(out, "max Lv0_X[19]", v) : null;
    }
    case 106: return O(opt, 443, out);
    case 107: {
      const v = ex.rawLootyCount(data, "EquipmentNametag");
      return v !== null ? R(out, "raw.Cards1 EquipmentNametag", v) : null;
    }
    case 108: {
      const v = ex.rawMegaflesh(data);
      return v !== null ? R(out, "raw.Bubba[1][8]", v) : null;
    }
    case 109: {
      const v = ex.rawHatsTotal(data);
      return v !== null ? R(out, "raw.Spelunk[46].length", v) : null;
    }
    case 110: {
      const v = ex.rawMineheadOpponents(data);
      return v !== null ? R(out, "Research[7][4]", v) : null;
    }
    case 111: {
      const v = ex.rawRatKingCrowns(data);
      return v !== null ? R(out, "Research[11].length", v) : null;
    }
    case 112: {
      const v = ex.rawFarmingStickers(data);
      return v !== null ? R(out, "OptLacc[140]", v) : null;
    }
    case 113: return O(opt, 498, out);
    case 114: return R(out, "raw.Research[0] sum", ex.rawResearch(data));
    case 115: {
      const v = ex.rawGlimboTrades(data);
      return v !== null ? R(out, "Research[12] sum", v) : null;
    }
    case 116: {
      if (Array.isArray(data.Sushi) && Array.isArray((data.Sushi as unknown[])[0])) {
        const sushi = (data.Sushi as unknown[])[0] as unknown[];
        let c = 0;
        for (let i = 0; i < sushi.length; i++) if (Number(sushi[i]) > 0) c++;
        return R(out, "raw.Sushi[0] count>0", c);
      }
      return null;
    }
    case 117: return O(opt, 594, out);
    default: return null;
  }
}

/**
 * Public entry point: take a raw JSON string OR a parsed object (from
 * idleontoolbox.com "Copy raw data"), return the 118-row tome breakdown.
 *
 * Throws if the input doesn't look like a Lava save (no fields at all, or
 * too few). Specifically accepts:
 *   - The raw save object directly
 *   - A wrapper { data: <save>, parsedData: ... } (IT API response)
 *   - A wrapper { profileData: <save> }
 */
export function computeTome(input: string | RawObj): TomeResult {
  let data: RawObj;
  let pd: ParsedData = {};

  if (typeof input === "string") {
    try {
      data = JSON.parse(input) as RawObj;
    } catch (e) {
      throw new Error(
        "Invalid JSON: " + (e instanceof Error ? e.message : String(e))
      );
    }
  } else {
    data = input;
  }
  if (!data || typeof data !== "object") {
    throw new Error("Input is not an object.");
  }

  // Unwrap common envelopes. Some extractors need fields that live OUTSIDE
  // .data (companion, guildData) — preserve them onto the inner save so the
  // extractors don't have to know about the envelope shape.
  if (Object.keys(data).length < 50) {
    if (
      data.data &&
      typeof data.data === "object" &&
      Object.keys(data.data as RawObj).length > 100
    ) {
      if (data.parsedData && typeof data.parsedData === "object") {
        pd = data.parsedData as ParsedData;
      }
      const envelope = data;
      data = envelope.data as RawObj;
      for (const sideKey of ["companion", "guildData", "tournament", "serverVars", "charNames"]) {
        if (envelope[sideKey] !== undefined && data[sideKey] === undefined) {
          data[sideKey] = envelope[sideKey];
        }
      }
    } else if (data.profileData && typeof data.profileData === "object") {
      data = data.profileData as RawObj;
    }
  }

  preparseLavaStrings(data);

  // If the input came with parsedData.tomePoints (IT API response), the
  // server-side computation is authoritative — use those values directly for
  // a guaranteed match to what idleontoolbox.com shows. We still run our
  // local computation so the Source / Raw Value columns stay informative.
  const itPts = Array.isArray(pd.tomePoints) ? (pd.tomePoints as unknown[]) : null;
  const usedParsedTomePoints = itPts !== null && itPts.length === TOME_TASKS.length;

  const rows: TomeRow[] = [];
  let totalPts = 0;
  let covered = 0;
  let missing = 0;

  for (let i = 0; i < TOME_TASKS.length; i++) {
    const ci = NEI32[i];
    const out: SrcOut = { label: "" };
    let raw: number | null = null;
    try {
      raw = computeRawValue(ci, data, pd, out);
    } catch (e) {
      out.label =
        "ERR:" + (e instanceof Error ? e.message : String(e));
    }
    let source = out.label || "MISSING";
    let pts: number | null = null;
    if (raw === null || raw === undefined || Number.isNaN(raw)) {
      missing++;
      source = source && source !== "MISSING" && !source.startsWith("ERR")
        ? source + " (null)"
        : fallbackLabel(ci);
    } else {
      covered++;
      pts = calcTomePts(ci, raw);
    }

    // Override with IT's value when available — but keep our raw/source/pts
    // visible by overwriting pts only and tagging the source.
    if (usedParsedTomePoints) {
      const itVal = Number(itPts![i]);
      if (Number.isFinite(itVal)) {
        pts = itVal;
        source = source + " [IT]";
      }
    }
    if (typeof pts === "number") totalPts += pts;

    rows.push({
      idx: i + 1,
      task: TOME_TASKS[i],
      rawValue: raw,
      pts,
      source,
      computeIdx: ci,
      bonus: TOME_BONUSES[ci],
    });
  }

  return {
    rows,
    totalPts,
    coveredCount: covered,
    missingCount: missing,
    usedParsedTomePoints,
  };
}
