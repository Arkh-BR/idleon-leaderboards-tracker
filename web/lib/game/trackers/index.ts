import type { Ctx } from "@/lib/game/ctx";
import type { StatKey } from "@/lib/readings/types";

// Ported trackers by stat; each migration plan registers its own (scripts/verify-map.ts reads this).
export const TRACKERS: Partial<Record<StatKey, (ctx: Ctx) => number>> = {};
