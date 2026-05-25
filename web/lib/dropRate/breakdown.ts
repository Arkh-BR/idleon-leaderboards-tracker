// Phase 2 glue: runs IT's full parser pipeline on a raw "Copy for Support"
// save envelope and calls getDropRate() to produce the per-source breakdown.
//
// Heavy import — pulls in the IT parser graph (~36k LOC) plus the
// 9.7MB website-data.json. Only import this from code paths that genuinely
// need the breakdown; the simple snapshot flow in extract.ts is far lighter.

// Polyfills must run before any @parsers/* import — they add
// Array#toSimpleObject, String#capitalize, etc. that IT relies on.
import "../it/polyfills.js";
import { parseData } from "@parsers/index";
import { getDropRate } from "@parsers/character";

export type DropRateBreakdown = ReturnType<typeof getDropRate>;

export type RawSaveEnvelope = {
  accountCreateTime?: number;
  charNames?: string[];
  companion?: unknown;
  data?: Record<string, unknown>;
  guildData?: unknown;
  serverVars?: unknown;
  tournament?: unknown;
};

export function computeDropRateBreakdown(
  save: RawSaveEnvelope,
  charIndex: number
): { breakdown: DropRateBreakdown; characters: any[]; account: any } {
  if (!save?.data || !Array.isArray(save?.charNames)) {
    throw new Error(
      "Missing data/charNames — expected an IT 'Copy for Support' envelope"
    );
  }
  const result = parseData(
    save.data as any,
    save.charNames,
    (save.companion ?? null) as any,
    (save.guildData ?? null) as any,
    save.serverVars as any,
    save.accountCreateTime ?? 0,
    (save.tournament ?? null) as any
  );
  if (!result) {
    throw new Error("parseData returned undefined (parse pipeline failed)");
  }
  const { account, characters } = result;
  const character = characters?.[charIndex];
  if (!character) {
    throw new Error(`Character index ${charIndex} not found in parsed save`);
  }
  const breakdown = getDropRate(character, account, characters);
  return { breakdown, characters, account };
}
