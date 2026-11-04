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
  /**
   * Stats whose value the engine is known not to match yet. The save test expects those rows to
   * fail (it.fails), and verify-map does not count them as validation. Delete the entry on the
   * day the engine matches the game.
   */
  knownGaps?: StatKey[];
  /** Tome computeIdx, when `stat` is "tomeTask". */
  task?: number;
  /** Envelope file name inside READINGS_DIR (private, gitignored). */
  saveFile: string;
  saveSha1: string;
};
