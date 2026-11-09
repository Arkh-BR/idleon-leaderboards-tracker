// The site's value for one recorded in-game reading. Artifact Find, Damage, AFK Gains, EXP Multi, Drop Rate V2, Coin Multi and Multikill go through their page configs (all compute on lib/game),
// the Player Info stats Damage readings carry (HP, MP, Accuracy, STR/AGI/WIS/LUK) through lib/game's TRACKERS, the Tome through lib/tome,
// the other kit stats through their page configs; later plans swap each one to lib/game behind this same function.
// lib/arkh keeps module-level state (saveData): call this sequentially, never in parallel — the save is reloaded on every call.

import { AFK_PAGE } from "@/lib/afkGains/pageConfig";
import { ARTIFACT_PAGE } from "@/lib/artifactFind/pageConfig";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { DMG_NODES } from "@/lib/damage/layers";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { makeCtx } from "@/lib/game/ctx";
import { TRACKERS } from "@/lib/game/trackers";
import { stateOf } from "@/lib/game/trackers/page";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import type { StatPageConfig } from "@/lib/statTracker/config";
import { computeTome } from "@/lib/tome/compute";
import type { Reading, StatKey } from "./types";

// lib/arkh (and lib/tome, which imports it) reads `window` at module scope in places (the tests set the same shim).
const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

export const KIT_PAGES: Partial<Record<StatKey, StatPageConfig>> = {
  dropRateV2: DR2_PAGE,
  coinMulti: COIN_PAGE,
  expMulti: EXP_PAGE,
  afkGains: AFK_PAGE,
  multikill: MULTIKILL_PAGE,
  artifactFind: ARTIFACT_PAGE,
};

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
      const d = await DAMAGE_PAGE.compute(save, ci, map);
      // Player Info's Min = Max × the Mastery (Min) factor.
      const mastery = d.tree.children!.find((c) => c.name === DMG_NODES.mastery)!.val;
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
    default: {
      // a Player Info stat: lib/game's block on the reading's character and map (the state is the one kept per envelope, trackers/page.ts)
      const tracker = TRACKERS[stat];
      if (!tracker) throw new Error(`computeReadingValue: no engine for ${stat}`);
      return { value: tracker(makeCtx(stateOf(save), { player: ci, map })) };
    }
  }
}
