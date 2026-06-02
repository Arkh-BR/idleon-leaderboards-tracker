// ===== GUILD DATA =====
import { GuildBonuses } from "../game/customlists.js";

export type GuildBonusParams = {
  x1: number;
  x2: number;
  formula: string;
  name: string;
};

export function guildBonusParams(idx: number): GuildBonusParams | null {
  const gb = (GuildBonuses as any)[idx];
  if (!gb) return null;
  return {
    x1: Number(gb[4]),
    x2: Number(gb[5]),
    formula: gb[6],
    name: String(gb[0]).replace(/_/g, " "),
  };
}
