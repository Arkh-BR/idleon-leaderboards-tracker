// The Artifact Find tracker: the page's { tree, total } for N.js Sailing("BoatArtiMulti", 0), built from the ONE traced call.
//
// The number is TRACKERS.artifactFind (Sailing BoatArtiMulti, njs/Sailing.ts). The tree is read out of that call's trace: each source
// finds the call it stands for among BoatArtiMulti's direct calls (by block and leading arguments), takes its value, and carries the
// call's own N.js trace as children. The grouping and the names are display (lib/artifactFind/groups.ts and the table below, the names
// lib/arkh's tree has: the page's Biggest Gains and the Observed Max data are keyed by them); a group's value is only the factor it
// shows, so the total never comes from the tree.
//
// The trace below a source is trimmed (Ruling L, trackers/page.ts). The whole trace is still there for debugging: run
// Sailing(ctx, "BoatArtiMulti", 0, 0) on a Ctx made with `trace: true` (gameArtifactFind does exactly that and trims what it hands the page).
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only). lib/game imports no lib/arkh, but one call
// still runs it: DNSM.TomeQTYtot calls lib/tome's computeTome (Ruling K), which imports about 20 lib/arkh modules until the Tome moves
// to lib/game.
//
// Performance, user decision 2026-11-04: the page switched to this engine at warm-character-switch parity with lib/arkh (about 2 ms); a
// loaded save costs about 24 ms once (state build + Tome) against lib/arkh's 2 ms, accepted as "no perceptible slowdown".
import type { StatResult } from "@/lib/statTracker/config";
import { ARTI_GROUPS, ARTI_ROOT, ARTI_VOTE_NAME } from "@/lib/artifactFind/groups";
import { makeCtx, type Ctx } from "../ctx";
import { TreeTotalMismatch } from "../errors";
import { listAt } from "../lists";
import type { GameState } from "../state";
import { TRACKERS } from "./index";
import { migratedNote, near, stateOf, takeFrom, traceTree, type Take } from "./page";

type Node = StatResult["tree"];

/** The value of a call BoatArtiMulti makes (its block and leading arguments); the call is remembered as this source's trace. */
/** A number the save gives that is no N.js call (a raw read), shown as a leaf of the source; returns it. */
type Leaf = (name: string, val: number, note: string) => number;

/**
 * One source of the tree. `of` is the term as lib/arkh's tree has it, which is the term as BoatArtiMulti writes it: before the `/100`
 * of a `pct` group, the factor itself for a `mult` group, but before the `max(1, …)` of a `max1` group and without the `1 +` of a
 * `raw` one (the group applies those). Boat 0 is the boat the Skill Info shows.
 */
type Source = { name: string; fmt: "+" | "x" | "raw"; note?: string; of: (t: Take, ctx: Ctx, leaf: Leaf) => number };

const SOURCES: Record<string, Source> = {
  // ── the additive pool ──
  artifact3: { name: "Fauxory Tusk (Artifact 3)", fmt: "+", note: "+ % per Sailing level × artifact tier", of: (t) => t("Sailing", "ArtifactBonus", 3, 0) },
  captain: { name: "Boat Captain (Artifact Find Chance)", fmt: "+", note: "Captain trait type 3 of boat 0 (the boat Skill Info shows)", of: (t) => t("CaptBonusCalc", 3) },
  shiny21: { name: "Higher Artifact Find Chance Shiny Pet (Breeding 21)", fmt: "+", note: "breeding shiny 21", of: (t) => t("Breeding", "ShinyBonusS", "Nah", 21, -1) },
  fractal3: { name: "Sailing Artifact Chance (Fractal Island 3)", fmt: "+", note: "×20 = +20% (the 1.20x milestone); unlocks at 2,500 h (OLA[184])", of: (t) => 20 * t("RandomEvent", "FractalIslandBonus", 3, 999) },
  bribe34: { name: "Artifact Pilfering (Bribe 34)", fmt: "+", note: "+20% artifact find chance", of: (t) => t("GetBribeBonus", "34") },
  captains6: { name: "Captains of type 6", fmt: "+", note: "+25% each, up to 30. The game adds it once any character enters the W5 town (map 200) in the session", of: (t) => 25 * Math.min(30, t("NONdummies.60")) },
  arcade32: { name: "Artifact Find Arcade Bonus (Arcade 32)", fmt: "+", of: (t) => t("ArcadeBonus", 32) },
  arcade66: { name: "Artifact Find Arcade Bonus (Arcade 66)", fmt: "+", of: (t) => t("ArcadeBonus", 66) },
  bUpg55: { name: "Tune of Artifaction (Cavern Upgrade 55)", fmt: "+", note: "+10% per power of 10 Natural Notes", of: (t) => t("Holes", "B_UPG", 55, 0) },
  sticker2add: { name: "Chocotastic Muffin Sticker (Sticker 2)", fmt: "+", note: "Additive slot (while Menagerie unlock 22 is locked)", of: (t) => t("FarmingStuffs", "StickerBonus", 2, 99) },
  grid109: { name: "Transcendent Artifacts (Research Grid 109)", fmt: "+", of: (t) => t("ResearchStuff", "Grid_Bonus", 109, 0) },
  vault63: { name: "Artifact Find Chance (Vault 63)", fmt: "+", of: (t) => t("Summoning", "VaultUpgBonus", 63, 0) },
  // ── the factors ──
  starSign61: { name: "Artifosho (Star Sign 61)", fmt: "+", of: (t) => t("DNSM.StarSigns", "61") },
  sticker2mult: { name: "Chocotastic Muffin Sticker (Sticker 2)", fmt: "+", note: "Multiplier slot (once Menagerie unlock 22 is bought)", of: (t) => t("FarmingStuffs", "StickerBonus", 2, 100) },
  nightmariner: { name: "Nightmariner (Menagerie)", fmt: "x", of: (t) => t("MenagerieStuff", "NightmarinerBon", 0, 0) },
  comp154: { name: "Glimbo (Companion 154)", fmt: "x", of: (t) => Math.min(2, 1 + 2 * t("Companions", 154)) + t("CompLV2", 154) },
  killroy: { name: "Artifact Find Chance (Killroy Skull Shop 11)", fmt: "x", note: "1 + OLA[228] / (300 + OLA[228])", of: (t) => t("RandomEvent", "KillroyBonuses", 0, 0) },
  button3: { name: "Artifact Odds (Minehead Button 3)", fmt: "+", note: "Button slot 3", of: (t) => t("Minehead", "Button_Bonuses", 3, 0) },
  grid106: { name: "The Maw (Research Grid 106)", fmt: "+", of: (t) => t("ResearchStuff", "Grid_Bonus", 106, 0) },
  vialTurtle: { name: "Turtle Tisane (Vial 74)", fmt: "+", note: "Vial effect key 6turtle", of: (t) => t("DNSM.AlchVials", "6turtle") },
  slugs: { name: "Noble Sluggo (Event Shop 48)", fmt: "x", note: "1.5 ^ owned (Purple Chest Slugs)", of: (t) => Math.pow(1.5, t("Stuff2", "PurpleChestSlugsOwned", 0, 0)) },
  sushi7: { name: "Cucumber Uramaki (Sushi Tier 8) — artifact find chance (RoG Bonus 7)", fmt: "+", note: "sushi RoG 7", of: (t) => t("SushiStuff", "RoG_BonusQTY", 7, 0) },
  win3: { name: "Artifact Find (Winner Bonus 3)", fmt: "+", note: "Summoning winner bonus 3", of: (t) => t("Summoning", "WinBonus", 3, 0) },
  jelly19: { name: "Sapphire Ring (Jelly Obstruction 20) — artifact find chance (Jelly Bonus 19)", fmt: "+", note: "jelly RoG 19", of: (t) => t("JellyOperation", "RoG_BonusQTY", 19, 0) },
  davey: { name: "Davey Jones", fmt: "x", note: "Boat 0 (the boat Skill Info shows)", of: (t) => t("Sailing", "DaveyJonesBonus", 0, 0) },
  mainframe14: { name: "Artifact Attraction (Mainframe 14)", fmt: "+", note: "Lab main bonus 14 (Emporium unlock)", of: (t) => t("MainframeBonus", 14) },
  loreEpi3: { name: "Artifact Find (Lore Episode 3)", fmt: "+", note: "Spelunking lore bonus 3", of: (t) => t("Thingies", "LoreEpiBon", 3, 0) },
  pristine2: { name: "Glowing Veil (Pristine Charm 2)", fmt: "+", note: "x Artifact Find Chance", of: (t) => t("Ninja", "PristineBon", 2, 0) },
  vote20: { name: ARTI_VOTE_NAME, fmt: "+", note: "Only counts the week vote 20 wins", of: (t) => t("Summoning", "VotingBonusz", 20, 0) },
  comp43: { name: "Litterfish (Companion 43)", fmt: "raw", of: (t) => t("Companions", 43) },
  comp56: { name: "Magni Pufferfin (Companion 56)", fmt: "x", note: "÷ 5", of: (t) => t("Companions", 56) / 5 },
  monument1_2: { name: "Justice Monument: Artifact Find Chance", fmt: "+", of: (t) => t("Holes", "MonumentROGbonuses", 1, 2) },
  exotic45: { name: "5 Leaf Clover (Exotic Market 45)", fmt: "+", note: "x Artifact Find Chance", of: (t) => t("FarmingStuffs", "ExoticBonusQTY", 45, 0) },
  palette5: { name: "Bright Cyan (Palette 5)", fmt: "+", note: "x Artifact Find chance", of: (t) => t("GamingStatType", "PaletteBonus", 5, 0) },
  // Spelunk[6].length is a plain read of the save (no call): the same strict read BoatArtiMulti made, which already passed
  spelunkBit26: { name: "Artifacto Discoveries (Super Bit 26)", fmt: "x", note: "1.02 ^ Spelunk discoveries × Super Bit 26", of: (t, ctx, leaf) => Math.pow(1.02, leaf("Spelunk[6].length", listAt(ctx, "Spelunk", 6).length, "a plain read of the save, not an N.js call")) * t("GamingStatType", "SuperBitType", 26, 0) },
};

/** What a group shows: the factor of its sources and the shape note (lib/arkh's, which the page's tooltip prints). */
function groupOf(g: (typeof ARTI_GROUPS)[number], vals: readonly number[]): { val: number; note: string } {
  const sum = vals.reduce((a, v) => a + v, 0);
  if (g.kind === "pct") return { val: 1 + sum / 100, note: "× (1 + Σ/100)" };
  if (g.kind === "raw") return { val: 1 + sum, note: "× (1 + Σ)" };
  if (g.kind === "mult") {
    const product = vals.reduce((a, v) => a * v, 1);
    return g.max1 ? { val: Math.max(1, product), note: "× max(1, Π)" } : { val: product, note: "× Π" };
  }
  throw new Error(`Artifact Find: group "${g.key}" has kind "${g.kind}", which the page does not use`);
}

/**
 * The page's result for character `charIdx` of a built state: runs BoatArtiMulti once, with the trace on, and reads the tree out of it.
 * A save the game would not have the keys for (Ruling E) throws what the engine throws (MissingSaveKey...): there is no number to show.
 */
export function gameArtifactFind(state: GameState, charIdx: number): StatResult {
  const ctx = makeCtx(state, { player: charIdx, map: 0, trace: true });
  const total = TRACKERS.artifactFind!(ctx);
  const boat = ctx.trace!.children.find((c) => c.block === "Sailing" && c.args[0] === "BoatArtiMulti");
  if (!boat) throw new Error("Artifact Find: the registered tracker made no Sailing BoatArtiMulti call");

  const source = (id: string): Node => {
    const def = SOURCES[id];
    if (!def) throw new Error(`Artifact Find: no source "${id}" in the adapter`);
    const kept: Node[] = [];
    const take = takeFrom(boat, undefined, kept, "Artifact Find: BoatArtiMulti", id);
    const leaf: Leaf = (name, val, note) => {
      kept.push({ name, val, fmt: "raw", note });
      return val;
    };
    const val = def.of(take, ctx, leaf);
    return { name: def.name, val, fmt: def.fmt, ...(def.note ? { note: def.note } : {}), children: kept };
  };

  const groups = ARTI_GROUPS.map((g): Node => {
    const items = g.sources.map(source);
    const shape = groupOf(g, items.map((i) => i.val));
    return { name: g.name, val: shape.val, fmt: "x", note: g.note ? `${shape.note} · ${g.note}` : shape.note, children: items };
  });
  // One path for the number (spec section 4): six sources redo a little arithmetic of BoatArtiMulti (see `of`), and Biggest Gains rebuilds the
  // total from these values. If the groups no longer give the call's total (an N.js constant changed in one place only), there is no honest
  // tree to show: throw, so the tracker reads "incomplete" (spec section 5) instead of a number the headline does not match. The call's own
  // outer Math.max(1, ...) is applied to the product, as N.js does.
  const rebuilt = Math.max(1, groups.reduce((t, g) => t * g.val, 1));
  if (!near(rebuilt, total)) throw new TreeTotalMismatch(total, rebuilt);
  // an older save is computed after the game's own load steps: the root says so (trackers/page.ts)
  const migrated = migratedNote(state);
  return { tree: { name: ARTI_ROOT, val: total, fmt: "x", ...(migrated ? { note: migrated } : {}), children: groups }, total };
}

/** `computeArkhArtifactFind`'s counterpart: the envelope of a save and a character index (its GameState is kept per envelope, trackers/page.ts). */
export function computeGameArtifactFind(save: unknown, charIdx: number): StatResult {
  return gameArtifactFind(stateOf(save), charIdx);
}
