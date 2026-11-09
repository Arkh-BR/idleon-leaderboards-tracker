// What a page on lib/game shows when the engine refuses a save. Shared by every page whose compute runs lib/game (Artifact Find, Damage, AFK Gains, EXP Multi, Drop Rate V2, Coin Multi, Multikill).
// It imports only lib/game/errors (a file with no imports), so a page config that uses it keeps the engine out of its static chunk.
import { CURRENT_CSVER, MissingSaveKey, TreeTotalMismatch, UNPORTED_STEPS } from "@/lib/game/errors";
import type { StatPageConfig } from "./config";

/**
 * The error the page of `stat` shows for what the engine threw. The kit prints "<errPrefix>: <message>", so an engine's refusal (Ruling E:
 * a pre-migration save is refused, never guessed) becomes a sentence for the player; every other error goes through as it is.
 */
export function pageError(save: unknown, e: unknown, stat: string): unknown {
  const csver = (save as { data?: { CSver?: unknown } } | null)?.data?.CSver;
  // MissingSaveKey includes IncompleteTome. A current save that lacks a key is not "old": that is a bug, so the engine's message stays.
  if (e instanceof MissingSaveKey && typeof csver === "number" && csver < CURRENT_CSVER) {
    // older than the game's load steps lib/game replays: no key is missing, the tracker cannot bring the save up to date
    if (e.key === UNPORTED_STEPS) return new Error("This save is from an older game version that this tracker can't update yet. Sign in or paste a fresh save.");
    return new Error(`This save is from an older game version (missing ${e.key}). Sign in or paste a fresh save.`);
  }
  if (e instanceof TreeTotalMismatch) return new Error(`${stat} is incomplete for this save (internal check failed). Please report it.`);
  return e;
}

/** `compute` with its errors passed through `pageError` for `stat`. */
export const withPageErrors =
  (stat: string, compute: StatPageConfig["compute"]): StatPageConfig["compute"] =>
  async (save, charIdx, mapIdx) => {
    try {
      return await compute(save, charIdx, mapIdx);
    } catch (e) {
      throw pageError(save, e, stat);
    }
  };
