import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { GuildBonuses as GUILD_BONUSES } from "../data";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import type { Ported } from "../ported";

/** N.js `_customBlock_GuildBonuses(d)` @7763433: guild bonus `d`, its curve (GuildBonuses[d][4..6]) at its level GuildTasks[0][d]. */
export const GuildBonuses = block("GuildBonuses", (ctx, d: number) => {
  const row = (GUILD_BONUSES as unknown as readonly (readonly unknown[])[])[d | 0];
  // the game indexes GuildBonuses[d][...] directly and would throw on a bonus it does not have
  if (!row) throw new RangeError(`GuildBonuses: no guild bonus ${d}`);
  listAt(ctx, "GuildTasks", 0); // the game indexes GuildTasks[0][d] directly
  return ArbitraryCode5Inputs(ctx, hString(row[6]), asNumber(row[4]), asNumber(row[5]), asNum(ctx, "GuildTasks", 0, d | 0), 0, 0);
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
