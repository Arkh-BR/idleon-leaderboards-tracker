import type { Ctx } from "@/lib/game/ctx";
import { DamageDealed } from "@/lib/game/njs/DamageDealed";
import { afkFightRate } from "@/lib/game/trackers/afkGains";
import { PlayerAccTot } from "@/lib/game/njs/PlayerAccTot";
import { PlayerHPmax } from "@/lib/game/njs/PlayerHPmax";
import { PlayerMPmax } from "@/lib/game/njs/PlayerMPmax";
import { Sailing } from "@/lib/game/njs/Sailing";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import type { StatKey } from "@/lib/readings/types";

// Ported trackers by stat; each migration plan registers its own (scripts/verify-map.ts reads this, lib/readings/compute.ts dispatches on it).
export const TRACKERS: Partial<Record<StatKey, (ctx: Ctx) => number>> = {
  // the Artifact Find line of the Skill Info: Sailing("BoatArtiMulti", 0), boat 0 (adapter: trackers/artifactFind.ts)
  artifactFind: (ctx) => Sailing(ctx, "BoatArtiMulti", 0, 0),
  // the Damage line of Player Info, Min ~ Max: DamageDealed("Max") on the Ctx's map, Mastery beside it (adapter: trackers/damage.ts)
  damage: (ctx) => DamageDealed(ctx, "Max"),
  // the AFK GAINS RATE line of the AFK Info panel: AFKgainrates("Fighting") on the Ctx's map, 0 where the AFK target has nothing to fight
  // (decision A9; adapter: trackers/afkGains.ts)
  afkGains: (ctx) => afkFightRate(ctx),
  // the Player Info stats the Damage readings carry as extras (Damage plan, Task 3; Ruling Q: every one equals the game's text)
  maxHp: (ctx) => PlayerHPmax(ctx),
  maxMp: (ctx) => PlayerMPmax(ctx),
  accuracy: (ctx) => PlayerAccTot(ctx),
  str: (ctx) => TotalStats(ctx, "STR"),
  agi: (ctx) => TotalStats(ctx, "AGI"),
  wis: (ctx) => TotalStats(ctx, "WIS"),
  luk: (ctx) => TotalStats(ctx, "LUK"),
};
