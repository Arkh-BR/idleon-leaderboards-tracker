// The Tome page's score: every quantity is lib/game's TomeQTY (N.js _customEvent_TomeQTY) and every task's points
// Summoning("TomePTS"). computeTome() unwraps the pasted/loaded save, runs the engine and builds the rows.

import {
  COMPUTE_LB_FALLBACK,
  NEI32,
  TOME_BONUSES,
  TOME_TASKS,
} from "./tasks";
import type { RawObj } from "./math";
import { makeCtx } from "@/lib/game/ctx";
import { Summoning } from "@/lib/game/njs/Summoning";
import { tomeQty } from "@/lib/game/njs/TomeQTY";
import { stateOf } from "@/lib/game/trackers/page";
import { pageError } from "@/lib/statTracker/pageErrors";

type ParsedData = Record<string, unknown>;

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
  // Set when the engine refused the save (or a quantity): the rows it could not read are MISSING / LB fallback.
  error?: string;
};

// What each row's Source column says (display only): where the old sheet read the quantity. The value is lib/game's TomeQTY.
const SOURCE_LABEL: Record<number, string> = {
  0: "raw.StampLv",
  1: "raw.StatueLevels_0",
  2: "sum(stars+1) per card",
  3: "max SL/SM per talent",
  4: "raw.QuestComplete",
  5: "raw.Lv0_X",
  6: "raw.TaskZZ1 sum",
  7: "raw.AchieveReg",
  8: "OptLacc[198]",
  9: "OptLacc[208]",
  10: "raw.Cards1 Trophy",
  11: "sum Lv0_X[1..20]",
  12: "OptLacc[201]",
  13: "raw.TaskZZ0[0][2]",
  14: "OptLacc[172]",
  15: "played char: charLv-1+skillSum1-9-3+â€¦",
  16: "1/OptLacc[202]",
  17: "OptLacc[71] vs dungeonLevels",
  18: "OptLacc[200]",
  19: "raw.SSprog sum done",
  20: "OptLacc[203]",
  21: "raw.Cards1 Obol",
  22: "CauldronInfo[0..3] sum",
  23: "CauldronInfo[4] sum",
  24: "CauldronP2W[4] sum",
  25: "OptLacc[199]",
  26: "raw.CYDeliveryBox*",
  27: "OptLacc[204]",
  28: "OptLacc[205]",
  29: "OptLacc[206]",
  30: "1000 - OptLacc[207]",
  31: "OptLacc[211]",
  32: "OptLacc[212]",
  33: "OptLacc[213]",
  34: "OptLacc[214]",
  35: "OptLacc[215]",
  36: "OptLacc[209]",
  37: "sum TotemInfo[0]",
  38: "deathNote99 + miniBoss digits",
  39: "WeeklyBoss d_*==-1",
  40: "Refinery salts[0..5].rank sum",
  41: "raw.Atoms",
  42: "Tower sum[0..26]",
  43: "ChestOrder/Critter11A",
  44: "OptLacc[224]",
  45: "raw.Rift[0]",
  46: "max powers PetsStored+Breeding[3]",
  47: "1000 - OptLacc[220]",
  48: "Cooking sum[6..8]",
  49: "parsedData.totalShinyLevels",
  50: "raw.Meals[0] sum",
  51: "parsedData.totalBreedabilityLevels",
  52: "Lab[15] sum max(0)",
  53: "raw.FamValColosseumHighscores",
  54: "OptLacc[217]",
  55: "raw.StuG",
  56: "1000 - OptLacc[218]",
  57: "Boats b[3]+b[5]",
  58: "Divinity[0..10] sum",
  59: "raw.GamingSprout[28][1]",
  60: "Sailing[3] sum",
  61: "raw.Sailing[1][0] (lootPile)",
  62: "max Captains[i][3]",
  63: "max(GamingSprout[8],OptLacc[210])",
  64: "raw.Gaming[8]",
  65: "Cards1.length (lootyRaw)",
  66: "raw.Gaming[0]",
  67: "2^OptLacc[219]",
  68: "keys(FarmCrop)",
  69: "Ninja[104] sum",
  70: "raw.Summon[0] sum",
  71: "Summon[1].length+OptLacc[319]",
  72: "OptLacc[232]*12",
  73: "Summon[4] reduce",
  74: "Ninja[102][9].length",
  75: "FamValMinigameHiscores sum[:5]",
  76: "sum PrayOwned[:19]",
  77: "raw.FarmRank[0] sum",
  78: "OptLacc[221]",
  79: "OptLacc[222]",
  80: "raw.ArcadeUpg sum",
  81: "min(1500,UpgVault[57]*2)",
  82: "sum Holes[11][65..70]",
  83: "sum ceil(lavaLog(Holes[9]))",
  84: "Holes[1] sum",
  85: "OptLacc[262]",
  86: "OptLacc[279]",
  87: "Holes[11][73]",
  88: "Holes[11][74]",
  89: "Holes[11][75]",
  90: "OptLacc[356]",
  91: "Holes[11][8]",
  92: "Holes[11][1,3,5,7] sum",
  93: "Holes[7] sum",
  94: "round(min(12,OptLacc[353])+1)",
  95: "round(OptLacc[369])",
  96: "sum KRbest[SummzTrz*]",
  97: "Spelunk[13] sum",
  98: "max Spelunk[1]",
  99: "Ninja[103] sum",
  100: "OptLacc[445]",
  101: "OptLacc[446]",
  102: "max Spelunk[2]",
  103: "sum max(0,Spelunk[5])",
  104: "Spelunk[6].length",
  105: "max Lv0_X[19]",
  106: "OptLacc[443]",
  107: "raw.Cards1 EquipmentNametag",
  108: "raw.Bubba[1][8]",
  109: "raw.Spelunk[46].length",
  110: "Research[7][4]",
  111: "Research[11].length",
  112: "OptLacc[140]",
  113: "OptLacc[498]",
  114: "raw.Research[0] sum",
  115: "Research[12] sum",
  116: "SushiStuff(UniqueSushi)",
  117: "OptLacc[594]",
  118: "raw.RoyalG[0] sum",
  119: "raw.RoyalMaps built (â‰¥3 fields)",
  120: "raw.RoyalG[5] sum",
  121: "raw.Research[7][9]",
  122: "raw.Menagerie[0][2]",
  123: "raw.Menagerie[3] sum",
};

// In paste mode we have no leaderboard data — fallback always returns null
// but we still label the row "MISSING (LB fallback)" so the user knows it's
// because the LB-only data wasn't pasted (matches .gs behavior in paste mode).
function fallbackLabel(idx: number): string {
  const m = COMPUTE_LB_FALLBACK[idx];
  return m ? "MISSING (LB: " + m[0] + "." + m[1] + ")" : "MISSING";
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

  // Unwrap the envelope shapes: the engine reads the envelope (data + charNames, companion, guildData…), not the bare save.
  let envelope: RawObj = data;
  if (Object.keys(data).length < 50) {
    if (
      data.data &&
      typeof data.data === "object" &&
      Object.keys(data.data as RawObj).length > 100
    ) {
      if (data.parsedData && typeof data.parsedData === "object") {
        pd = data.parsedData as ParsedData;
      }
    } else if (data.profileData && typeof data.profileData === "object") {
      envelope = data.profileData as RawObj;
    }
  }

  // If the input came with parsedData.tomePoints (IT API response), the
  // server-side computation is authoritative — use those values directly for
  // a guaranteed match to what idleontoolbox.com shows. We still run our
  // local computation so the Source / Raw Value columns stay informative.
  const itPts = Array.isArray(pd.tomePoints) ? (pd.tomePoints as unknown[]) : null;
  const usedParsedTomePoints = itPts !== null && itPts.length === TOME_TASKS.length;

  // The Tome is account-level but TomeQTY[15] reads the logged-in character: the latest PTimeAway, as the game marks it.
  // The map is 251, the one the lib/game comparer uses (only the Crystal Spawn record reads it, under the saved record).
  let error: unknown;
  let ctx: ReturnType<typeof makeCtx> | null = null;
  try {
    const state = stateOf(envelope);
    let player = 0;
    let at = 0;
    for (let c = 0; c < state.charNames.length; c++) {
      const away = Number(state.data[`PTimeAway_${c}`]) || 0;
      if (away > at) [at, player] = [away, c];
    }
    ctx = makeCtx(state, { player, map: 251 });
  } catch (e) {
    error = pageError(envelope, e, "Tome");
  }

  const rows: TomeRow[] = [];
  let totalPts = 0;
  let covered = 0;
  let missing = 0;

  for (let i = 0; i < TOME_TASKS.length; i++) {
    const ci = NEI32[i];
    let label = SOURCE_LABEL[ci] ?? "TomeQTY[" + ci + "]";
    let raw: number | null = null;
    let pts: number | null = null;
    if (ctx) {
      try {
        raw = tomeQty(ctx, ci);
        pts = Summoning(ctx, "TomePTS", ci, 0);
      } catch (e) {
        label = "ERR:" + (e instanceof Error ? e.message : String(e));
        raw = pts = null;
        error ??= pageError(envelope, e, "Tome");
      }
    } else label = "ERR:save refused";

    let source = label;
    if (raw === null || Number.isNaN(raw)) {
      missing++;
      pts = null;
      source = !label.startsWith("ERR") ? label + " (null)" : fallbackLabel(ci);
    } else {
      covered++;
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
    ...(error !== undefined ? { error: error instanceof Error ? error.message : String(error) } : {}),
  };
}
