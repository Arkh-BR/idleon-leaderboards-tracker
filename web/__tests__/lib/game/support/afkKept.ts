// The proof that a pair's difference from lib/arkh is Ruling V alone (the kept AFK target): force the target the map gives (the character
// stands on `map` with `MapAFKtarget[map]`), recompute lib/game, and the total must be lib/arkh's. Used by scripts/characterize.ts and
// trackers/afkGains.test.ts. A pair that does not close is not explained.
import { MapAFKtarget } from "@/lib/game/data";
import { computeGameAfkGains } from "@/lib/game/trackers/afkGains";

export function keptTargetCloses(env: { data: Record<string, unknown> }, ci: number, map: number, arkhTotal: number): boolean {
  const forced = { ...env, data: { ...env.data, [`AFKtarget_${ci}`]: (MapAFKtarget as unknown as readonly unknown[])[map], [`CurrentMap_${ci}`]: map } };
  const total = computeGameAfkGains(forced, ci, map).total;
  return Math.abs(total - arkhTotal) <= 1e-9 * Math.max(1, Math.abs(arkhTotal));
}
