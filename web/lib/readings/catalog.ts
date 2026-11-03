import type { StatKey } from "./types";

/** Other panel values the "Record in-game reading" form asks for next to the stat itself. */
export const INTERMEDIATES: Record<StatKey, StatKey[]> = {
  damage: ["maxHp", "maxMp", "str", "agi", "wis", "luk", "accuracy"],
  dropRateV2: [],
  coinMulti: [],
  expMulti: [],
  afkGains: [],
  multikill: [],
  artifactFind: [],
  maxHp: [],
  maxMp: [],
  accuracy: [],
  str: [],
  agi: [],
  wis: [],
  luk: [],
  tomeScore: [],
  tomeTask: [],
};
