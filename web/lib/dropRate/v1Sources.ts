// The sources of the Drop Rate V1 tree, in the page's order. Each one is a row: its name, format and note (the page's snapshots and Compare are keyed by the names, lib/dropRate/treeFlatten), and
// `from`, where its number is in the one TotalStats("Drop_Rarity") call: a source id of the V2 adapter (lib/game/trackers/dropRate.ts, the same terms) or how to read it from that call's trace.
//
// A row's look follows what the row is: most show no format while they are 0 (not built, not owned) and some say why, so `fmt` and `note` can be functions of the save and the row's value.
// The rows under a source are lib/dropRate/explain.
import type { Ctx } from "@/lib/game/ctx";
import { asNum } from "@/lib/game/attr";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { dropRateLuk } from "@/lib/game/njs/TotalStats";
import { chipUncalled, notOwned, SOURCES, type Ops } from "@/lib/game/trackers/dropRate";
import { talentNote } from "./explain/talent";
import type { NodeFmt } from "./node";

export type V1Pool = "base" | "addMain" | "addLUK2" | "chipDR" | "postFlat" | "postMult";

type OfRow<T> = T | ((c: Ctx, val: number) => T);

export type V1Source = {
  id: string;
  pool: V1Pool;
  name: OfRow<string>;
  fmt?: OfRow<NodeFmt | undefined>;
  note?: OfRow<string | undefined>;
  /** A V2 source id, or how to read the number from the block's trace. */
  from: string | ((o: Ops) => number);
  /** A row that exists only while this holds (default: always). */
  shown?: (val: number) => boolean;
};

/** The root row of the Crystal Glunko Cove, there only while the character is in it (V1 has no Cove in its pools: the row says what the total is). */
export const V1_COVE = "🏝️ Crystal Glunko Cove";

/** `+` while the row has a value, no format while it is 0. */
const plusIfSet = (_c: Ctx, val: number): NodeFmt | undefined => (val ? "+" : undefined);
/** A note only while the row is 0. */
const whenZero = (text: string) => (_c: Ctx, val: number) => (val ? undefined : text);

const skullsNote = (c: Ctx, val: number): string => {
  const perSkull = GetTalentNumber(c, 1, 655);
  const skulls = asNum(c, "OptionsListAccount", 189);
  if (val) return `${perSkull.toFixed(2)} per skull × ${skulls} skulls`;
  return 0 >= skulls ? "Inactive — no Skulls Beaten (OLA[189])" : "Inactive — Per-Skull contribution is 0";
};

/** WorkbenchStuff("AdditionExtraEXPnDR") @7824907: 1 + getbonus2(1, 328, -1) × getLOG(OLA[139]) / 100. */
const workbenchNote = (c: Ctx): string => {
  const talent = getbonus2(c, 1, 328, -1);
  const kills = asNum(c, "OptionsListAccount", 139);
  if (0 < talent && 0 < kills) return `1 + (${talent.toFixed(2)} × log10(${kills})) / 100`;
  return 0 >= kills ? "Inactive — no Plunderous Kills (OLA[139])" : "Inactive — talent 0";
};

/** GlimboDRmulti @11198811 has a value once Grid_Bonus(168, 0) is 1 or more; below that V1's row is the grid square, at 0. */
const glimboLevelled = (c: Ctx): boolean => 1 <= ResearchStuff(c, "Grid_Bonus", 168, 0);

export const V1_SOURCES: readonly V1Source[] = [
  { id: "lukScaling", pool: "base", name: "LUK Scaling", fmt: "raw", from: ({ t }) => dropRateLuk(t("TotalStats", "LUK")) },

  { id: "talent279", pool: "addMain", name: "Robbing Hood (Talent 279)", fmt: "+", note: (c) => talentNote(c, 279), from: "talent279" },
  { id: "talent24", pool: "addMain", name: "Curse Of Mr Looty Booty (Talent 24)", fmt: "+", note: (c) => talentNote(c, 24), from: "talent24" },
  { id: "talent655", pool: "addMain", name: "Boss Battle Spillover (Talent 655)", fmt: "+", note: skullsNote, from: "talent655" },
  { id: "stampA38", pool: "addMain", name: "Golden Sixes Stamp (Stamp A38)", fmt: plusIfSet, note: whenZero("Level 0 — not collected"), from: "stamp" },
  { id: "bubble", pool: "addMain", name: "Droppin Loads (Bubble 3,1)", fmt: plusIfSet, note: "bubble DROPPIN_LOADS", from: "bubble" },
  { id: "prayer7", pool: "addMain", name: "Midas Minded (Prayer 7)", fmt: plusIfSet, note: whenZero("prayer 7"), from: "prayer7" },
  { id: "shrine4", pool: "addMain", name: "Clover Shrine (Shrine 4)", fmt: plusIfSet, note: "shrine 4", from: "shrine4" },
  { id: "arcade27", pool: "addMain", name: "Drop Rate Arcade Bonus (Arcade 27)", fmt: plusIfSet, note: "arcade 27", from: "arcade27" },
  { id: "card10", pool: "addMain", name: "Drop Rate Cards (Card Type 10)", fmt: "+", from: "card10" },
  { id: "guild10", pool: "addMain", name: "Gold Charm (Guild 10)", fmt: plusIfSet, note: "guild 10", from: "guild10" },
  { id: "cardSet5", pool: "addMain", name: "Damage / Drop / EXP Set Bonus (Card Set 5)", fmt: "+", from: "cardSet5" },
  { id: "cardSet6", pool: "addMain", name: "Drop Rate Set Bonus (Card Set 6)", fmt: "+", from: "cardSet6" },
  { id: "starSigns", pool: "addMain", name: "Star Signs", fmt: "+", note: "starSign:drop", from: "starSigns" },
  { id: "postOffice11", pool: "addMain", name: "Non Predatory Loot Box (Post Office 11)", fmt: plusIfSet, note: "post office 11,0", from: "box11" },
  { id: "etc2", pool: "addMain", name: "Drop Rate (Equipment) (etcBonus 2)", fmt: "+", from: "etc2" },
  // ponytail: N.js adds EtcBonuses("102") too, but no item carries %_DROP_CHANCE (only a rare UQ stone could): a row only while it is not 0, so no path changes and the total still rebuilds
  { id: "etc102", pool: "addMain", name: "EtcBonuses(102) (etcBonus 102)", fmt: "+", from: "etc102", shown: (val) => 0 !== val },
  { id: "sigil11", pool: "addMain", name: "Trove Sigil (Sigil 11)", fmt: plusIfSet, note: "sigil 11", from: "sigil11" },
  { id: "shiny0", pool: "addMain", name: "Drop Rate Shiny Pet (Breeding 0)", fmt: "+", note: "breeding shiny 0", from: "shiny0" },
  { id: "comp3", pool: "addMain", name: "Crystal Custard (Companion 3)", fmt: plusIfSet, note: notOwned(3), from: "comp3" },
  { id: "comp50", pool: "addMain", name: "Santa Snake (Companion 50)", fmt: plusIfSet, note: notOwned(50), from: "comp50" },
  { id: "win9", pool: "addMain", name: "Drop Rate Summoning Win (Summoning 9)", fmt: plusIfSet, note: "summoning win 9", from: "win9" },
  { id: "tome2", pool: "addMain", name: "Drop Rate Additive (Tome 2)", fmt: plusIfSet, note: "tome 2", from: "tome2" },
  { id: "grid173", pool: "addMain", name: "Divine Design (Grid 173)", fmt: plusIfSet, note: "grid 173", from: "grid173" },
  { id: "dream10", pool: "addMain", name: "Equinox Symbols (Dream 10)", fmt: "+", note: "dream 10", from: "dream10" },

  { id: "mini5a", pool: "addLUK2", name: "Domeo Magmus (Card mini5a)", fmt: "+", from: "mini5a" },
  { id: "caveDR", pool: "addLUK2", name: "Cave Drop Rate (Card caveC+caveD)", fmt: "+", from: "caveCards" },
  { id: "anni4", pool: "addLUK2", name: "Idleon 4th Anniversary (Card anni4Event1)", fmt: "+", from: "anni4" },
  { id: "luckEvent", pool: "addLUK2", name: "Luckulyte (Card luckEvent1)", fmt: "+", from: "luckEvent" },
  { id: "goldFood", pool: "addLUK2", name: "Golden Food: DropRatez", fmt: plusIfSet, from: "goldFood" },
  { id: "ach377", pool: "addLUK2", name: "Summoning GM (Achievement 377)", fmt: plusIfSet, note: whenZero("Not completed — would grant +6"), from: "ach377" },
  { id: "ach381", pool: "addLUK2", name: "Big Big Hampter (Achievement 381)", fmt: plusIfSet, note: whenZero("Not completed — would grant +4"), from: "ach381" },
  { id: "owl4", pool: "addLUK2", name: "Summoning Owl", fmt: plusIfSet, note: "owl 4", from: "owl4" },
  { id: "vote27", pool: "addLUK2", name: "Voting Bonus (DR)", fmt: plusIfSet, note: "voting 27", from: "vote27" },
  { id: "grimoire44", pool: "addLUK2", name: "Skull of Major Droprate (Grimoire 44)", fmt: plusIfSet, note: "grimoire 44", from: "grimoire44" },
  { id: "vault18", pool: "addLUK2", name: "Drops for Days (Vault 18)", fmt: "+", note: "vault 18", from: "vault18" },
  { id: "rank9", pool: "addLUK2", name: "Crop Drop Rate Rank (Farming rank9)", fmt: plusIfSet, note: "farm rank9", from: "rank9" },
  { id: "cropSC7", pool: "addLUK2", name: "Crop Depot Bonus 7 (Farming cropSC7)", fmt: plusIfSet, note: "farm cropSC7", from: "cropSC7" },
  { id: "exotic59", pool: "addLUK2", name: "Pommelion Seed (Exotic 59)", fmt: plusIfSet, note: "farm exotic59", from: "exotic59" },
  { id: "hole46", pool: "addLUK2", name: "Gloomie Lootie (Cavern upg46)", fmt: plusIfSet, note: "hole:upg46", from: "hole46" },
  { id: "hole82", pool: "addLUK2", name: "Sanctum of LOOT (Cavern upg82)", fmt: plusIfSet, note: "hole:upg82", from: "hole82" },
  { id: "meas15", pool: "addLUK2", name: "Drop Rate Measurement (Measurement 15)", fmt: plusIfSet, note: "hole:meas15", from: "meas15" },
  { id: "monument", pool: "addLUK2", name: "Monument Drop Rate", fmt: plusIfSet, note: "hole:monument", from: "monument" },
  { id: "comp22", pool: "addLUK2", name: "Quenchie (Companion 22)", fmt: plusIfSet, note: notOwned(22), from: "comp22" },
  { id: "comp158", pool: "addLUK2", name: "Lucky Slug (Companion 158)", fmt: plusIfSet, note: notOwned(158), from: "comp158" },
  { id: "comp111", pool: "addLUK2", name: "Clammie (Companion 111)", fmt: plusIfSet, note: notOwned(111), from: "comp111" },
  { id: "emperor11", pool: "addLUK2", name: "Drop Rate Emperor Bonus (Emperor 11)", fmt: plusIfSet, note: "emperor 11", from: "emperor11" },
  { id: "efaunt", pool: "addLUK2", name: "Efaunt Set Bonus (Smithing efaunt)", fmt: "+", note: "set efaunt", from: "efaunt" },
  { id: "friend3", pool: "addLUK2", name: "Friend Bonus", fmt: plusIfSet, note: "friend 3", from: "friend3" },
  { id: "legend1", pool: "addLUK2", name: "Greatest Drop Party Ever (Legend 1)", fmt: plusIfSet, note: "legend 1", from: "legend1" },
  { id: "spelunk50", pool: "addLUK2", name: "Golden Hardhat (Spelunking 50)", fmt: plusIfSet, note: "spelunk 50", from: "spelunk50" },
  { id: "comp132", pool: "addLUK2", name: "Mama Troll (Companion 132)", fmt: plusIfSet, note: notOwned(132), from: "comp132" },
  { id: "talent239", pool: "addLUK2", name: "Graded Rate × Total Resource Grades (Talent 239)", fmt: "+", note: "talent 239 × total resource grade", from: "talent239" },

  { id: "chip", pool: "chipDR", name: "Lab Chip DR", fmt: "+", note: "chip dr", from: ({ o, leaf, c }) => o("chipBonuses", "dr") ?? chipUncalled(leaf, c) },

  { id: "bunV", pool: "postFlat", name: "Death Bringer Bundle (Bundle bun_v)", fmt: "+", note: "bundle bun_v", from: "bunV" },
  { id: "ola232", pool: "postFlat", name: "Sneaking Completions (Sneaking Mastery)", fmt: "+", note: "ola 232", from: "ola232" },

  { id: "workbench", pool: "postMult", name: "Archlord Of The Pirates (Talent 328)", fmt: "x", note: workbenchNote, from: "workbench" },
  { id: "bunP", pool: "postMult", name: "Explorer Bundle (Bundle bun_p)", fmt: "x", note: "bundle bun_p", from: "bunP" },
  { id: "arcane", pool: "postMult", name: "Arcane Map Bonus", fmt: "+", note: "arcane map", from: "arcane" },
  { id: "statue1", pool: "postMult", name: "Royal Statue: Drop Rate", fmt: "+", note: "royal statue 1", from: "statue1" },
  { id: "menagerie24", pool: "postMult", name: "Menagerie Boost: Drop Rate (Boost 24)", fmt: "+", note: "menagerie boost 24", from: "menagerie24" },
  { id: "card101", pool: "postMult", name: "Drop Rate Multi Cards (Card Type 101)", fmt: "+", from: "card101" },
  { id: "family32", pool: "postMult", name: "Royal Guardian Family Bonus", fmt: "+", note: 'family bonus 16 (FamBonusQTYs["32"])', from: "family32" },
  { id: "rog", pool: "postMult", name: "Sushi + Jelly Drop Rate (RoG Bonus 48 + Jelly Bonus 14)", fmt: "+", note: "×(1 + (Sushi RoG 48 + Jelly RoG 14) / 100)", from: (o) => SOURCES.sushi48.of(o) + SOURCES.jelly14.of(o) },
  {
    id: "glimbo",
    pool: "postMult",
    name: (c) => (glimboLevelled(c) ? "Glimbo DR Multi" : "Glimbo Insider Trading Secrets (Grid 168)"),
    fmt: (c) => (glimboLevelled(c) ? "x" : undefined),
    note: "grid 168",
    from: (o) => {
      const multi = SOURCES.glimbo.of(o);
      return glimboLevelled(o.c) ? multi : 0;
    },
  },
  { id: "tome7", pool: "postMult", name: "Drop Rate Multi (Tome 7)", fmt: plusIfSet, note: "tome 7", from: "tome7" },
  { id: "etc99", pool: "postMult", name: "Bonus Drop Rate (Equipment) (etcBonus 99)", fmt: "+", from: "etc99" },
  { id: "minehead0", pool: "postMult", name: "Minehead Floor 0", fmt: plusIfSet, note: "minehead 0", from: "minehead0" },
  { id: "cloud69", pool: "postMult", name: "Megaflesh Collector (Dream Challenge 69)", fmt: "+", note: "cloudBonus 69", from: "cloud69" },
  { id: "pristine3", pool: "postMult", name: "Cotton Candy (Pristine 3)", fmt: "+", note: "pristine 3", from: "pristine3" },
  { id: "etc91", pool: "postMult", name: "Drop Rate Multi (Equipment) (etcBonus 91)", fmt: "+", from: "etc91" },
  { id: "comp132x", pool: "postMult", name: "Mama Troll (Companion 132)", fmt: "x", from: "comp132x" },
  { id: "comp168x", pool: "postMult", name: "Crystal Glunko (Companion 168)", fmt: "x", from: "comp168x" },
  { id: "comp26", pool: "postMult", name: "Mallay (Companion 26)", fmt: "x", from: "comp26" },
  { id: "comp160", pool: "postMult", name: "Glunko The Massive (Companion 160)", fmt: "x", from: "comp160" },
  { id: "comp50x", pool: "postMult", name: "Santa Snake (Companion 50)", fmt: "x", from: "comp50x" },
  { id: "vial", pool: "postMult", name: "Drop Rate Vial", fmt: "+", note: "vial 7drMulto", from: "vial" },
];
