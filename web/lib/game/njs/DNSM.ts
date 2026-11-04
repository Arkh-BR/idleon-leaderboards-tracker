// DNSM is the game's cache of computed values. It is not in the save (Ruling A), so each cache the port
// reads is a function that replays the code that fills it. Only the caches Artifact Find reads from here;
// the other DNSM keys are ported where their function is (ShinyBonusS in Breeding, NghMrTOT in MenagerieStuff).
import { asNumber, attr } from "../attr";
import { runtime, type Ctx } from "../ctx";
import { CompanionDB } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";

/** Haxe `Std.string` of a value the game concatenates to "": null (and undefined) print as "null". */
const hString = (v: unknown): string => (v == null ? "null" : String(v));

/**
 * `u.getCompanionInfoMe()` @10650052: the account's companion list, one "id,x,x,x,stage2" entry each,
 * split on commas. It is not in the cloud save: the game asks the server at the map load. The envelope's
 * `companion.l` is a capture of that answer, which is the only copy of it a save has. A null envelope
 * companion is the game's own `null == list` fallback (an empty list), and shows in the trace as not counted.
 */
function companionEntries(ctx: Ctx): string[][] {
  const c = ctx.state.companion;
  if (c === null) {
    runtime(ctx, "getCompanionInfoMe", "envelope.companion is null: no companion list, so no owned companion");
    return [];
  }
  const l = c !== null && typeof c === "object" ? (c as { l?: unknown }).l : undefined;
  if (l === undefined) throw new MissingSaveKey("envelope.companion.l");
  if (!Array.isArray(l)) throw new InvalidSaveValue("envelope.companion.l", "an array", l);
  return l.map((e) => hString(e).split(","));
}

/** DNSM.CompanionLVz @10650052: companion id (the entry's text before the first comma) -> the highest field 4 of its entries. */
const stage2Of = (entries: string[][]): Map<string, number> => {
  const lvz = new Map<string, number>();
  for (const p of entries) lvz.set(p[0], Math.max(asNumber(lvz.get(p[0])), asNumber(p[4])));
  return lvz;
};
export const DNSM_CompanionLVz = (ctx: Ctx): Map<string, number> => stage2Of(companionEntries(ctx));

/**
 * DNSM.CompanionBon @10650632: companion id -> its bonus. Owned companions (`f < CompanionDB.length`)
 * take CompanionDB[f][11] when their stage is exactly 1 (`1 == CompanionLVz[f]`), else [2]. Then every
 * Pet-Bonus Token in OptionsListAccount[606] (a comma list of ids) sets CompanionDB[id][2], over what
 * ownership gave: a token for a companion at stage 2 takes it back to the stage-1 value.
 *
 * With `CurrentMap == 41` the game first drops from the token list the ids owned and a fixed list
 * (@10651111), and rewrites OptionsListAccount[606]; the Artifact Find map is 0, so that is not ported.
 */
export function DNSM_CompanionBon(ctx: Ctx): Map<string, number> {
  if (ctx.map === 41) throw new NotPorted("DNSM.CompanionBon", "CurrentMap 41");
  const entries = companionEntries(ctx);
  const lvz = stage2Of(entries);
  const owned = new Set(entries.map((p) => asNumber(p[0])));
  const bon = new Map<string, number>();
  for (let f = 0; f < CompanionDB.length; f++) {
    if (owned.has(f)) bon.set(`${f}`, asNumber(CompanionDB[f][lvz.get(`${f}`) == 1 ? 11 : 2]));
  }
  for (const id of hString(attr(ctx, "OptionsListAccount", 606)).split(",")) {
    const row = CompanionDB[asNumber(id) | 0]; // NaN | 0 is 0
    // the game indexes CompanionDB[id][2] directly and would throw on an id past the list
    if (!row) throw new InvalidSaveValue("OptionsListAccount[606]", "ids of CompanionDB", id);
    bon.set(id, asNumber(row[2]));
  }
  return bon;
}
