import { block } from "../ctx";
import { IDforETCbonus } from "../data";
import { hString } from "../hstring";
import { TotalStatsETCmap } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_EtcBonuses(c)` @6598331: the unique stat `IDforETCbonus[c]` ("46" is "%_ALL_STATS") as `DNSM.TotalStatsETCmap`
 * holds it (TotalStats.ts), 0 when nothing gives it. The value is returned as N.js does, with no `c.asNumber` (the map holds numbers).
 */
export const EtcBonuses = block("EtcBonuses", (ctx, c: string) => {
  const map = TotalStatsETCmap(ctx);
  const key = hString((IDforETCbonus as Readonly<Record<string, string>>)[c]);
  return map.has(key) ? (map.get(key) as number) : 0;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
