// The site's value for one recorded in-game reading. Today every stat is routed
// to lib/arkh; later plans swap each one to lib/game behind this same function.
// lib/arkh keeps module-level state (saveData): call this sequentially, never in
// parallel — the save is reloaded on every call.

import { computeArkhDamage } from "@/lib/arkh/computeDamage";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeAccuracy } from "@/lib/arkh/stats/systems/common/derived-damage";
import { computePlayerHPmax, computePlayerMPmax } from "@/lib/arkh/stats/systems/common/derived-stats";
import { computeTotalStat } from "@/lib/arkh/stats/systems/common/stats";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";
import { ARTIFACT_PAGE } from "@/lib/artifactFind/pageConfig";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import type { StatPageConfig } from "@/lib/statTracker/config";
import { computeTome } from "@/lib/tome/compute";
import type { Reading, StatKey } from "./types";

// lib/arkh reads `window` at module scope in places (the tests set the same shim).
const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const KIT_PAGES: Partial<Record<StatKey, StatPageConfig>> = {
  dropRateV2: DR2_PAGE,
  coinMulti: COIN_PAGE,
  expMulti: EXP_PAGE,
  afkGains: AFK_PAGE,
  multikill: MULTIKILL_PAGE,
  artifactFind: ARTIFACT_PAGE,
};

const MAIN_STATS = { str: "STR", agi: "AGI", wis: "WIS", luk: "LUK" } as const;

/** `stat` of the reading `r` (or one of its `extra` stats), computed from its save. */
export async function computeReadingValue(
  r: Reading,
  save: unknown,
  stat: StatKey = r.stat,
): Promise<{ value: number; min?: number }> {
  const { charIdx: ci, map } = r;
  const page = KIT_PAGES[stat];
  if (page) return { value: (await page.compute(save, ci, map)).total };

  switch (stat) {
    case "damage": {
      const d = computeArkhDamage(save, ci, map);
      // Player Info's Min = Max × the Mastery (Min) factor.
      const mastery = d.tree.children!.find((c) => c.name === "Mastery (Min)")!.val;
      return { value: d.total, min: d.total * mastery };
    }
    case "tomeScore":
    case "tomeTask": {
      // parsedData dropped so the site's own Tome computation is what's measured.
      const env = { ...(save as object) } as { parsedData?: unknown };
      delete env.parsedData;
      const tome = computeTome(env as never);
      if (stat === "tomeScore") return { value: tome.totalPts };
      const row = tome.rows.find((x) => x.computeIdx === r.task);
      if (!row || row.pts === null) throw new Error(`reading ${r.id}: no Tome task ${r.task}`);
      return { value: row.pts };
    }
    case "maxHp":
    case "maxMp":
    case "accuracy":
    case "str":
    case "agi":
    case "wis":
    case "luk": {
      loadSaveData(save as never);
      const ctx = { saveData, charIdx: ci, activeCharIdx: ci };
      if (stat === "maxHp") return { value: computePlayerHPmax(ci, ctx).val };
      if (stat === "maxMp") return { value: computePlayerMPmax(ci, ctx).val };
      if (stat === "accuracy") return { value: computeAccuracy(ci, ctx) };
      return { value: computeTotalStat(MAIN_STATS[stat], ci, ctx).computed };
    }
    default:
      throw new Error(`computeReadingValue: no engine for ${stat}`);
  }
}
