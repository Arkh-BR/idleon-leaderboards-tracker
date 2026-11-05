import type { Ctx } from "@/lib/game/ctx";
import { DamageDealed } from "@/lib/game/njs/DamageDealed";
import { Sailing } from "@/lib/game/njs/Sailing";
import type { StatKey } from "@/lib/readings/types";

// Ported trackers by stat; each migration plan registers its own (scripts/verify-map.ts reads this).
export const TRACKERS: Partial<Record<StatKey, (ctx: Ctx) => number>> = {
  // the Artifact Find line of the Skill Info: Sailing("BoatArtiMulti", 0), boat 0 (adapter: trackers/artifactFind.ts)
  artifactFind: (ctx) => Sailing(ctx, "BoatArtiMulti", 0, 0),
  // the Damage line of Player Info, Min ~ Max: DamageDealed("Max") on the Ctx's map, Mastery beside it (adapter: trackers/damage.ts)
  damage: (ctx) => DamageDealed(ctx, "Max"),
};
