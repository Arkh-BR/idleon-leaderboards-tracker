export type StatKey =
  | "damage" | "dropRateV2" | "coinMulti" | "expMulti" | "afkGains" | "multikill"
  | "artifactFind" | "maxHp" | "maxMp" | "accuracy" | "str" | "agi" | "wis" | "luk"
  | "tomeScore" | "tomeTask";

/** One in-game reading: what the game showed, plus the save captured at that moment. */
export type Reading = {
  id: string;
  stat: StatKey;
  charIdx: number;
  charName: string;
  map: number;
  /** ISO time of the save (envelope `lastUpdated`). */
  capturedAt: string;
  /** Exact text the game shows. */
  game: string;
  /** Other panel values captured at the same time (key = StatKey). */
  extra?: Record<string, string>;
  /** Tome computeIdx, when `stat` is "tomeTask". */
  task?: number;
  /** Envelope file name inside READINGS_DIR (private, gitignored). */
  saveFile: string;
  saveSha1: string;
};
