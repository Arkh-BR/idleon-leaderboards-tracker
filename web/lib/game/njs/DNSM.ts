// DNSM is the game's cache of computed values. It is not in the save (Ruling A), so each cache the port
// reads is a function that replays the code that fills it. Only the caches Artifact Find reads from here;
// the other DNSM keys are ported where their function is (ShinyBonusS in Breeding, NghMrTOT in MenagerieStuff).
//
// DNSM convention (one rule, two shapes):
//  - a cache the game's formulas read BY KEY (`DNSM.StarSigns["61"]`, `DNSM.AlchVials["6turtle"]`, `DNSM.TomeQTYtot[n]`) is a per-key
//    `block("DNSM.<Name>", (ctx, key) => number)`: the trace shows each read and an unported key throws NotPorted;
//  - a cache whose only consumers are already per-id blocks (`Companions(ctx, id)` reads CompanionLVz/CompanionBon) may stay a plain
//    function that returns the Map, because the block that consumes it is what the trace shows.
import { asNum, asNumber, assumedLeaf, attr } from "../attr";
import { assumed, block, runtime, type Ctx } from "../ctx";
import { AlchemyDescription, CompanionDB, StarSigns } from "../data";
import { IncompleteTome, InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { hString } from "../hstring";
import { contains } from "../lists";
import { charKey, opt, type GameState } from "../state";
import { computeTome } from "@/lib/tome/compute";
import { CauldronStats } from "./CauldronStats";
import { chipBonuses } from "./chipBonuses";
import { RiftStuff } from "./RiftStuff";
import { Summoning2 } from "./Summoning2";

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
  const l = typeof c === "object" ? (c as { l?: unknown }).l : undefined;
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
  if (ctx.map === 41) throw new NotPorted("DNSM.CompanionBon", "CurrentMap=41");
  const entries = companionEntries(ctx);
  const lvz = stage2Of(entries);
  const owned = new Set(entries.map((p) => asNumber(p[0])));
  const bon = new Map<string, number>();
  for (let f = 0; f < CompanionDB.length; f++) {
    if (owned.has(f)) bon.set(`${f}`, asNumber(CompanionDB[f][lvz.get(`${f}`) == 1 ? 11 : 2]));
  }
  // OptionsListAccount[606] may be undefined (3 real saves): the game reads it as "null" (Std.string), a token id that sets the harmless key "null"
  for (const id of hString(attr(ctx, "OptionsListAccount", 606)).split(",")) {
    const row = CompanionDB[asNumber(id) | 0]; // NaN | 0 is 0
    // the game indexes CompanionDB[id][2] directly and would throw on an id past the list
    if (!row) throw new InvalidSaveValue("OptionsListAccount[606]", "ids of CompanionDB", id);
    bon.set(id, asNumber(row[2]));
  }
  return bon;
}

/**
 * `PersonalValuesMap.StarSign` of the current player: the signs the character wears, as the text "69,49,26," (a trailing comma, `_` for
 * an empty slot). The cloud load @19924336 reads it from `PVtStarSign_<player>` (CSver 4 and up); when that is "" it takes
 * `"" + PVStarSign_<player>`, and "-1" becomes "0". The key is not in SAVE_ATTRS (a dynamic key of the loader's loop), so it is read here.
 */
function equippedSignsText(ctx: Ctx): string {
  const text = opt(ctx.state, charKey("PVtStarSign", ctx.player));
  if (text === undefined) throw new MissingSaveKey(charKey("PVtStarSign", ctx.player));
  if (text !== "") return hString(text);
  const old = opt(ctx.state, charKey("PVStarSign", ctx.player));
  if (old === undefined) throw new MissingSaveKey(charKey("PVStarSign", ctx.player));
  return hString(old) === "-1" ? "0" : hString(old);
}

/**
 * `DNSM.StarSigns["61"]` (Artifosho, +15% Artifact Find chance), the map `_customBlock_StarSigns` @6540622 rebuilds for the current player
 * every time it runs (a character loads, a sign is changed): a new map, then
 *  - the list of active signs `StarSignsDL`: the signs worn (`PersonalValuesMap.StarSign` split on ",") and, for each of the first
 *    `RiftStuff("enabledStarSigns")` signs whose name the account has unlocked (StarSignsUnlocked), its index; sign 61 is `15 + its
 *    value` when "61" is in that list (@6559902);
 *  - a second pass over the worn signs only, when the Silkrode Nanochip is the one star chip equipped (chipBonuses("star") is exactly 1)
 *    and the Rift enables no sign (@6541841), which adds the 15 again;
 *  - then, with Seraph Cosmos unlocked (@6563929), every positive value times max(1, min(2, 1 + chip x floor((999 + enabled) / 1000)))
 *    x (1 + Meritoc bonus 22 / 100) x min(5, (1.1 + min(Arcane[40], 10) / 100) ^ ceil((Lv0[18] + 1) / 20)).
 * A sign that is not active has no entry in the map, which the game reads as 0. Only the key "61" is ported; the other keys are other
 * signs' lines of the same function.
 */
export const DNSM_StarSigns = block("DNSM.StarSigns", (ctx, key: string) => {
  if (key !== "61") throw new NotPorted("DNSM.StarSigns", `StarSigns:key=${key}`);
  const equipped = () => equippedSignsText(ctx).split(",");
  const unlocked = attr(ctx, "StarSignsUnlocked");
  if (unlocked === null || typeof unlocked !== "object" || Array.isArray(unlocked)) throw new InvalidSaveValue("StarSignsUnlocked", "a map", unlocked);
  const signs = StarSigns as unknown as readonly (readonly unknown[])[];
  let active = equipped(); // DNSM.StarSignsDL
  for (let f = 0, g = RiftStuff(ctx, "enabledStarSigns", 0) | 0; f < g; f++) {
    if (f < signs.length && Object.hasOwn(unlocked, hString(signs[f][0]))) active.push(`${f}`);
  }
  let value: number | undefined; // StarSigns.h["61"]
  for (let pass = 0; pass < 2; pass++) {
    if (0 == pass || (1 == chipBonuses(ctx, "star") && !(1 <= RiftStuff(ctx, "enabledStarSigns", 0)))) {
      if (1 == pass) active = equipped();
      if (contains(active, "61")) value = 15 + asNumber(value);
    }
  }
  if (Object.hasOwn(unlocked, "Seraph_Cosmos") && 0 < asNumber(value)) {
    value =
      asNumber(value) *
      Math.max(1, Math.min(2, 1 + chipBonuses(ctx, "star") * Math.floor((999 + RiftStuff(ctx, "enabledStarSigns", 0)) / 1e3))) *
      (1 + Summoning2(ctx, "MeritocBonusz", 22, 0) / 100) *
      Math.min(5, Math.pow(1.1 + Math.min(asNum(ctx, "Arcane", 40), 10) / 100, Math.ceil((asNum(ctx, "Lv0", 18) + 1) / 20)));
  }
  return asNumber(value);
});

/**
 * `DNSM.AlchVials[key]`, the map `TalentCalc(-2)` (@4482440) rebuilds at @4495601: a new map, then for each vial g of AlchemyDescription[4], under the vial's
 * kind AlchemyDescription[4][g][11], `CauldronStats("VialBonus", 4, g, 0)` added to what the kind already holds. `"6turtle"` is
 * Turtle Tisane (vial 74), the only vial of its kind. A kind no vial has is absent from the map, which the game reads as 0. Only the
 * vials of the kind asked are computed here; the others are other keys of the same loop.
 */
export const DNSM_AlchVials = block("DNSM.AlchVials", (ctx, key: string) => {
  let total: number | undefined;
  const vials = (AlchemyDescription as unknown as readonly (readonly unknown[])[][])[4];
  for (let g = 0; g < vials.length; g++) {
    if (hString(vials[g][11]) !== key) continue;
    total = CauldronStats(ctx, "VialBonus", 4, g, 0) + asNumber(total);
  }
  return asNumber(total);
});

/** The Tome score of a state, or the refusal: `computeTome` is heavy (124 rows), the state is immutable and the score is the account's, so once per state. */
const tomeScores = new WeakMap<GameState, { total: number; covered: number; rows: number } | IncompleteTome>();

/**
 * `DNSM.TomeQTYtot`, the account's Tome score: the Tome actor's `GenInfo[84]` (ActorEvents_229), which sums `Summoning("TomePTS", g)`
 * over `DNSM.TomeQTY` @5779007 and keeps it in `TomeQTYtot` @5778865. It is runtime state this engine does not replay, so it stands in
 * with our own port of the Tome, `computeTome` (lib/tome, written from the N.js, validated in the game on 2026-11-03), run on the save
 * as the state holds it, after the game's load steps (lib/game/migrations) (Ruling K). Nothing IdleonToolbox computed is read: the
 * envelope is rebuilt without `parsedData` and `extraData`, which would make `computeTome` take IT's per-task points.
 *
 * `computeTome` does not throw for a row it cannot compute (the save lacks what it reads): it counts it as no points. That would make a
 * pre-migration save's score a silent floor, so a result with fewer rows computed than rows is refused (`IncompleteTome`, a
 * MissingSaveKey, Ruling E) naming the rows. Any other error from it is not caught.
 */
export const DNSM_TomeQTYtot = block("DNSM.TomeQTYtot", (ctx) => {
  let score = tomeScores.get(ctx.state);
  if (!score) {
    const s = ctx.state;
    const result = computeTome({
      data: structuredClone(s.data), // computeTome writes into the save it is given; the state is frozen
      charNames: [...s.charNames],
      companion: structuredClone(s.companion),
      guildData: structuredClone(s.guildData),
      tournament: structuredClone(s.tournament),
      serverVars: structuredClone(s.serverVars),
    } as unknown as Parameters<typeof computeTome>[0]);
    const uncovered = result.rows.filter((r) => r.pts === null);
    score =
      result.coveredCount < result.rows.length || uncovered.length
        ? new IncompleteTome(uncovered.map((r) => ({ idx: r.idx, task: r.task, source: r.source })))
        : { total: result.totalPts, covered: result.coveredCount, rows: result.rows.length };
    tomeScores.set(s, score);
  }
  if (score instanceof IncompleteTome) throw score;
  const total = assumed(
    ctx,
    "Tome.totalPoints",
    "Tome score from our own Tome calculation",
    score.total,
    `Tome score from lib/tome computeTome (an N.js port, validated in game 2026-11-03; ${score.covered} of ${score.rows} rows computed): the Tome actor's GenInfo[84] is runtime state (Ruling K)`
  );
  // the Tome reads the whole save: every assumption the load steps made is part of its score (block 378's DROP_RATE_RECORD among them)
  if (ctx.trace) for (const a of ctx.state.assumed) assumedLeaf(ctx.trace, ctx.player, a);
  return total;
});
