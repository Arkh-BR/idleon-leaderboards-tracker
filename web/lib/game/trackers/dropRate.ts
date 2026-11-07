// The Drop Rate tracker: the page's { tree, total } for N.js TotalStats("Drop_Rarity") (the "Drop Rate" line of Player Info), built from the ONE traced call.
//
// The number is TRACKERS.dropRateV2 (TotalStats(ctx, "Drop_Rarity"), njs/TotalStats.ts). The block keeps its working values (DropRateLUK, DropRateLUK2, the
// running total) as locals, so the tree is read out of the trace, as the EXP, AFK and Damage trackers do (trackers/expMulti.ts): each source finds the
// call(s) it stands for among the block's direct calls (by block and arguments, each call once, in call order), takes their values and carries the calls'
// own N.js trace as children. A number the block reads from the save itself (the bundles, OptionsListAccount, Dream) is a leaf. The source's value is the
// term as lib/arkh's tree has it and the game writes it: the % points in a `pct` group (the LUK source is 140 x the curve, outside the /100), the FACTOR in a
// `mult` group, the amount an `add` group adds, the new total of the Cove (0 when the character is not in it). The groups, ids and names are display
// (lib/dropRateV2/layers.ts and the table below: the names lib/arkh's tree has, which the page's Biggest Gains and the Observed Max data are keyed by); a
// node's value is only what it shows, and the total never comes from the tree.
//
// Two terms are no call of the block in every pass: the chip (chipBonuses("dr"), only called while the total is under 5; the tree shows it anyway, as
// lib/arkh does, and the `add` group's `below` applies it) and the Cove (Holes2("Cglunko_DR"), only called on map 216 in cavern 17; 0 elsewhere).
//
// The trace below a source is trimmed (Ruling L, trackers/page.ts). The reads that are no source but lead to a `runtime:` / `assumed:` note stay visible
// under the root. Ruling Y: a dungeon map counts as outside a dungeon (the in-dungeon branch is unreachable).
//
// The recombination guard rebuilds the total from the tree with the page's own Biggest Gains model (groupedGainsModel over DR2_GROUPS, the vote left
// out as the page does): if the sources no longer give the block's total it throws TreeTotalMismatch, so the tracker reads "incomplete" instead of
// showing a number the headline does not match.
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only).
import type { StatResult } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { DR2_GROUPS, DR2_ROOT, DR2_VOTE_NAME } from "@/lib/dropRateV2/layers";
import { groupNote, groupVal } from "@/lib/statTracker/groups";
import { asNum, asNumber, attr } from "../attr";
import { makeCtx, type Ctx, type TraceNode } from "../ctx";
import { CompanionDB } from "../data";
import { TreeTotalMismatch } from "../errors";
import { chipBonuses } from "../njs/chipBonuses";
import { haveBan } from "../njs/Thingies";
import { dropRateLuk, TotalStats } from "../njs/TotalStats";
import type { GameState } from "../state";
import { findCall, flagged, migratedNote, near, stateOf, takeFrom, traceTree, type Take } from "./page";

type Node = StatResult["tree"];

const READ = "a plain read of the save, not an N.js call";

/** What a source computes from: `t` takes a call (it must exist), `o` takes it when the block made it, `leaf` shows a number that is no call of its own, `c` reads the save. */
type Ops = {
  t: Take;
  o: (block: string, ...args: (string | number)[]) => number | undefined;
  leaf: (name: string, val: number, note?: string) => number;
  c: Ctx;
};
/** One source of the tree: its name and note as lib/arkh's tree has them (a function of the save and the source's value), and `of`, the term as the block uses it (see the header). */
type Source = { name: string; note?: string | ((c: Ctx, val: number) => string | undefined); of: (o: Ops) => number };

/** The Cove line @4196607: `216 == CurrentMap && 17 == Holes[0][<the current character>]` (the raw element, loosely). */
const inCove = (c: Ctx): boolean => 216 == c.map && 17 == attr(c, "Holes", 0, c.player);

/**
 * lib/arkh's note on a companion the account neither owns nor has a token for: what it would add, CompanionDB[id][2] (the value of a companion
 * not at stage 2). Companions(id) is 0 exactly then: it has no CompanionBon entry, and the six companions this note is on all have [2] and [11] above 0.
 */
const notOwned = (id: number) => (_c: Ctx, val: number) => (0 === val ? `Not owned — would grant +${asNumber(CompanionDB[id][2])}` : undefined);

/**
 * The chip when the block made no chipBonuses("dr") call (the total was 5 or more): the tree reads it on its own, as lib/arkh's tree does. The game
 * makes no such call there, so a read that fails (no Lab row, a chip ChipDesc does not have) must not break the page (Ruling PP): it is a 0 leaf
 * saying why.
 */
const chipUncalled = (leaf: Ops["leaf"], c: Ctx): number => {
  try {
    return chipBonuses(c, "dr");
  } catch (e) {
    return leaf('chipBonuses("dr")', 0, `not read: ${e instanceof Error ? e.message : String(e)} (the game makes no chip call at a total of 5 or more)`);
  }
};

// Offsets (raw N.js): TotalStats "Drop_Rarity" @4190432 (DropRateLUK2 @4190966, the base @4192476, the chip @4193824, outside a dungeon @4194240, the Cove @4196607)
const SOURCES: Record<string, Source> = {
  luk: { name: "LUK Scaling (Drop Rate)", note: "1.4 × the LUK curve, outside the /100: 140 × curve as %", of: ({ t }) => 140 * dropRateLuk(t("TotalStats", "LUK")) },
  talent279: { name: "Robbing Hood (Talent 279)", of: ({ t }) => t("GetTalentNumber", 1, 279) },
  box11: { name: "Non Predatory Loot Box (Post Office 11)", note: "post office 11,0", of: ({ t }) => t("DNSM.BoxRewards", "DropRate") },
  etc2: { name: "Drop Rate (Equipment)", note: "EtcBonuses(2) = %_DROP_RATE", of: ({ t }) => t("EtcBonuses", "2") },
  etc102: { name: "Drop Chance (Equipment)", note: "EtcBonuses(102) = %_DROP_CHANCE", of: ({ t }) => t("EtcBonuses", "102") },
  bubble: { name: "Droppin Loads (Kazam Cauldron)", note: "AlchBubbles.DropRate (bubble [3][1])", of: ({ t }) => t("DNSM.AlchBubbles", "DropRate") },
  card10: { name: "Drop Rate Cards (Card Type 10)", of: ({ t }) => t("CardBonusREAL", 10) },
  talent24: { name: "Curse Of Mr Looty Booty (Talent 24)", of: ({ t }) => t("GetTalentNumber", 1, 24) },
  starSigns: { name: "Star Signs: Drop Rate", note: "StarSigns.Drop: Pirate Booty (14), Druipi Major (76), × Seraph", of: ({ t }) => t("DNSM.StarSigns", "Drop") },
  guild10: { name: "Gold Charm (Guild 10)", note: "guild 10", of: ({ t }) => t("GuildBonuses", 10) },
  cardSet5: { name: "Card Set 5 (Damage · Drop · EXP)", of: ({ t }) => t("CardSetBonuses", 0, "5") },
  cardSet6: { name: "Drop Rate Set Bonus (Card Set 6)", of: ({ t }) => t("CardSetBonuses", 0, "6") },
  shrine4: { name: "Clover Shrine (Shrine 4)", note: "shrine 4", of: ({ t }) => t("Shrine", 4) },
  prayer7: { name: "Midas Minded (Prayer 7)", note: "prayer 7", of: ({ t }) => t("prayersReal", 7, 0) },
  sigil11: { name: "Trove Sigil (Sigil 11)", note: "sigil 11", of: ({ t }) => t("Labb", "SigilBonus", "Blank", 11, 0) },
  shiny0: { name: "Drop Rate Shiny Pet (Breeding 0)", note: "breeding shiny 0", of: ({ t }) => t("Breeding", "ShinyBonusS", "Nah", 0, -1) },
  arcade27: { name: "Drop Rate Arcade Bonus (Arcade 27)", note: "arcade 27", of: ({ t }) => t("ArcadeBonus", 27) },
  comp3: { name: "Crystal Custard (Companion 3)", note: notOwned(3), of: ({ t }) => t("Companions", 3) },
  comp50: { name: "Santa Snake (Companion 50)", note: notOwned(50), of: ({ t }) => t("Companions", 50) },
  stamp: { name: "Golden Sixes Stamp (Stamp A38)", note: "StampBonusOfTypeX(\"DropRate\")", of: ({ t }) => t("StampBonusOfTypeX", "DropRate") },
  talent655: { name: "Boss Battle Spillover (Talent 655)", of: ({ t, leaf, c }) => t("GetTalentNumber", 1, 655) * leaf("OptionsListAccount[189]", asNum(c, "OptionsListAccount", 189), "Skulls beaten") },
  dream10: { name: "Faux Jewels (Equinox Upgrade 8)", note: "5 × Dream[10], the upgrade's level", of: ({ leaf, c }) => 5 * leaf("Dream[10]", asNum(c, "Dream", 10), "Upgrade level") },
  win9: { name: "Drop Rate (Winner Bonus 9)", note: "Summoning winner bonus 9", of: ({ t }) => t("Summoning", "WinBonus", 9, 0) },
  tome2: { name: "Drop Rate Additive (Tome 2)", note: "tome 2", of: ({ t }) => t("Summoning", "TomeBonus", 2, 0) },
  mini5a: { name: "Domeo Magmus (Card mini5a)", of: ({ t }) => Math.min(1.5 * t("RunCodeOfTypeXforThingY", "CardLv", "mini5a"), 10) },
  caveCards: { name: "Ancient Golem · Crystal Glunko (Card caveC · caveD)", note: "min(100, 4 × caveC Lv + 6 × caveD Lv)", of: ({ t }) => Math.min(4 * t("RunCodeOfTypeXforThingY", "CardLv", "caveC") + 6 * t("RunCodeOfTypeXforThingY", "CardLv", "caveD"), 100) },
  anni4: { name: "Idleon 4th Anniversary (Card anni4Event1)", of: ({ t }) => Math.min(2 * t("RunCodeOfTypeXforThingY", "CardLv", "anni4Event1"), 20) },
  luckEvent: { name: "Luckulyte (Card luckEvent1)", of: ({ t }) => Math.min(3 * t("RunCodeOfTypeXforThingY", "CardLv", "luckEvent1"), 25) },
  goldFood: { name: "Golden Cake · Golden Sugar Cookie (Golden Food)", note: "Σ of equipped + Emporium golden foods with effect DropRatez", of: ({ t }) => t("GoldFoodBonuses", "DropRatez") },
  ach377: { name: "Summoning GM (Achievement 377)", of: ({ t }) => 6 * t("AchieveStatus", 377) },
  ach381: { name: "Big Big Hampter (Achievement 381)", of: ({ t }) => 4 * t("AchieveStatus", 381) },
  owl4: { name: "Super Feather Production (Owl Upgrade 4)", note: "+% Drop Rate (owl bonus 4)", of: ({ t }) => t("Summoning", "OwlBonuses", 4, 0) },
  rank9: { name: "Drop Rate (Farming Rank Upgrade 9)", note: "LankRankUpgBonus(9)", of: ({ t }) => t("FarmingStuffs", "LankRankUpgBonus", 9, 0) },
  vote27: { name: DR2_VOTE_NAME, note: "Only counts the week vote 27 wins", of: ({ t }) => t("Summoning", "VotingBonusz", 27, 0) },
  hole46: { name: "Gloomie Lootie (Cavern Upgrade 46)", note: "+5% Drop Rate per Gloomie Mushroom colony defeated", of: ({ t }) => t("Holes", "B_UPG", 46, 0) },
  cropSC7: { name: "Crop Depot: Drop Rate (Bonus 7)", note: "+1% Drop Rate per crop after 100 (CropSCbonus(7))", of: ({ t }) => t("FarmingStuffs", "CropSCbonus", 7, 0) },
  grimoire44: { name: "Skull of Major Droprate (Grimoire 44)", note: "grimoire 44", of: ({ t }) => t("Summoning", "GrimoireUpgBonus", 44, 0) },
  vault18: { name: "Drops for Days (Vault 18)", note: "vault 18", of: ({ t }) => t("Summoning", "VaultUpgBonus", 18, 0) },
  meas15: { name: "Drop Rate Measurement (Measurement 15)", note: "hole:meas15", of: ({ t }) => t("Holes", "MeasurementBonusTOTAL", 15, 0) },
  comp22: { name: "Quenchie (Companion 22)", note: notOwned(22), of: ({ t }) => t("Companions", 22) },
  comp158: { name: "Lucky Slug (Companion 158)", note: notOwned(158), of: ({ t }) => t("Companions", 158) },
  hole82: { name: "Sanctum of LOOT (Cavern Upgrade 82)", note: "+20% Drop Rate per Sanctum of Ancient Golems cleared", of: ({ t }) => t("Holes", "B_UPG", 82, 20) },
  monument: { name: "Wisdom Monument: Player Drop Rate", note: "MonumentROGbonuses(2, 6)", of: ({ t }) => t("Holes", "MonumentROGbonuses", 2, 6) },
  emperor11: { name: "Drop Rate (Emperor Bonus 11)", of: ({ t }) => t("Thingies", "EmperorBon", 11, 0) },
  efaunt: { name: "Efaunt Set", note: "Equipment set EFAUNT_SET", of: ({ t }) => t("GetSetBonus", "EFAUNT_SET", "Bonus", 0, 0) },
  exotic59: { name: "Pommelion Seed (Exotic Market 59)", of: ({ t }) => t("FarmingStuffs", "ExoticBonusQTY", 59, 0) },
  friend3: { name: "Drop Rate (Friend Bonus 3)", note: "Friend bonus type 3; scales with account level", of: ({ t }) => t("Thingies", "FriendBonusStatz", 3, 0) },
  legend1: { name: "Greatest Drop Party Ever (Legend 1)", note: "legend 1", of: ({ t }) => t("Thingies", "LegendPTS_bonus", 1, 0) },
  spelunk50: { name: "Golden Hardhat (Spelunk Shop 50)", of: ({ t }) => t("Spelunk", "ShopUpgBonus", 50, 0) },
  comp111: { name: "Clammie (Companion 111)", note: notOwned(111), of: ({ t }) => t("Companions", 111) },
  talent239: { name: "Graded Rate (Talent 239)", note: "× total resource-node grades (RoyalG TotalStatz)", of: ({ t }) => t("GetTalentNumber", 1, 239) * (t("RoyalG", "TotalStatz", 0, 0) / 1) },
  grid173: { name: "Divine Design (Research Grid 173)", of: ({ t }) => t("ResearchStuff", "Grid_Bonus", 173, 0) },
  comp132: { name: "Mama Troll (Companion 132)", note: notOwned(132), of: ({ t }) => t("Companions", 132) },
  chip: { name: "Grounded Processor (Lab Chip 3)", note: "chipBonuses(\"dr\") ÷ 100, only while the total is under 5; the active character's chips", of: ({ o, leaf, c }) => (o("chipBonuses", "dr") ?? chipUncalled(leaf, c)) / 100 },
  bunV: { name: "Death Bringer Bundle", note: "bun_v: +2 Drop Rate", of: ({ leaf, c }) => 1 == leaf("BundlesReceived.bun_v", haveBan(c, "bun_v"), "Owned") ? 2 : 0 },
  workbench: { name: "Archlord Of The Pirates (Talent 328)", of: ({ t }) => t("WorkbenchStuff", "AdditionExtraEXPnDR", 0, 0) },
  ola232: { name: "Sneaking Mastery", note: "+0.3 once OLA[232] ≥ 1", of: ({ leaf, c }) => 1 <= leaf("OptionsListAccount[232]", asNum(c, "OptionsListAccount", 232), "Sneaking mastery level") ? 0.3 : 0 },
  bunP: { name: "Explorer Bundle", note: "bun_p: ×1.2 Drop Rate", of: ({ leaf, c }) => 1 == leaf("BundlesReceived.bun_p", haveBan(c, "bun_p"), "Owned") ? 1.2 : 1 },
  arcane: { name: "Arcane Map Bonus: Drop Rate", note: "MapBon slot 0 on the selected map (ArcaneMapMulti_bon)", of: ({ t }) => t("ArcaneType", "ArcaneMapMulti_bon", 0, 0) },
  statue1: { name: "Royal Statue: Drop Rate", note: "royal statue 1", of: ({ t }) => t("RoyalG", "StatueBon", 1, 0) },
  menagerie24: { name: "Menagerie Boost: Drop Rate (Boost 24)", note: "menagerie boost 24", of: ({ t }) => t("MenagerieStuff", "BoostQTY", 24, 0) },
  card101: { name: "Drop Rate Multi Cards (Card Type 101)", of: ({ t }) => t("CardBonusREAL", 101) },
  family32: { name: "Royal Guardian Family Bonus", note: "family bonus 16 (FamBonusQTYs[\"32\"])", of: ({ t }) => t("DNSM.FamBonusQTYs", "32") },
  comp168x: { name: "Crystal Glunko (Companion 168)", of: ({ t }) => 1 + 0.3 * t("Companions", 168) },
  comp132x: { name: "Mama Troll (Companion 132)", of: ({ t }) => 1 + (Math.min(0.5, t("Companions", 132)) + 0.2 * t("CompLV2", 132)) },
  sushi48: { name: "Unagi Nigiri (Sushi Tier 49) — Drop Rate (RoG Bonus 48)", note: "sushi RoG 48", of: ({ t }) => t("SushiStuff", "RoG_BonusQTY", 48, 0) },
  jelly14: { name: "Gold Bangle (Jelly Obstruction 15) — Drop Rate (Jelly Bonus 14)", note: "jelly RoG 14", of: ({ t }) => t("JellyOperation", "RoG_BonusQTY", 14, 0) },
  glimbo: { name: "Glimbo Insider Trading Secrets (Research Grid 168)", note: "Minehead(\"GlimboDRmulti\") = 1 + Grid_Bonus(168, 2)/100 once the grid is level 1", of: ({ t }) => t("Minehead", "GlimboDRmulti", 0, 0) },
  tome7: { name: "Drop Rate Multi (Tome 7)", note: "tome 7", of: ({ t }) => t("Summoning", "TomeBonus", 7, 0) },
  etc99: { name: "Bonus Drop Rate (Equipment)", note: "EtcBonuses(99) = %_BONUS_DROP_RATE", of: ({ t }) => t("EtcBonuses", "99") },
  minehead0: { name: "Total Damage and Drop Rate (Minehead Floor 0)", note: "Minehead(\"BonusQTY\", 0): Research[20][0] once the Minehead floor passes 0", of: ({ t }) => t("Minehead", "BonusQTY", 0, 0) },
  cloud69: { name: "Megaflesh Collector (Equinox Challenge 69)", note: "5 × CloudBonus(69): acquire 10 Megaflesh from Bubba the Seal", of: ({ t }) => 5 * t("Dreamstuff", "CloudBonus", 69) },
  pristine3: { name: "Cotton Candy (Pristine Charm 3)", note: "x Drop Rate", of: ({ t }) => t("Ninja", "PristineBon", 3, 0) },
  etc91: { name: "Drop Rate Multi (Equipment)", note: "EtcBonuses(91) = %_DROP_RATE_MULTI", of: ({ t }) => t("EtcBonuses", "91") },
  vial: { name: "Ship in a Bottle (Vial 84)", note: "Vial effect key 7drMulto", of: ({ t }) => t("DNSM.AlchVials", "7drMulto") },
  comp26: { name: "Mallay (Companion 26)", of: ({ t }) => Math.min(1.3, 1 + t("Companions", 26)) },
  comp160: { name: "Glunko The Massive (Companion 160)", of: ({ t }) => 1 + 0.5 * t("Companions", 160) },
  comp50x: { name: "Santa Snake (Companion 50)", of: ({ t }) => Math.min(1.01, 1 + t("Companions", 50) / 2500) },
  cove: { name: "Crystal Glunko Cove", note: (c) => `Map 216 (The Hole), cavern 17 (The Cove): replaces the whole Drop Rate${inCove(c) ? "" : " · inactive: not map 216 in cavern 17"}`, of: ({ o }) => o("Holes2", "Cglunko_DR", 0, 0) ?? 0 },
};

// The page's Biggest Gains model: the guard below recombines the tree with it (the one path for the number).
const MODEL = groupedGainsModel(DR2_ROOT, DR2_GROUPS, { skip: [DR2_VOTE_NAME] });

/**
 * The page's result for the character and map of a traced Ctx (nothing computed on it yet): runs `TotalStats("Drop_Rarity")` once, then reads the tree
 * out of the call it made. A save the game would not have the keys for (Ruling E) throws what the engine throws (MissingSaveKey...).
 */
export function dropRateTree(ctx: Ctx): StatResult {
  if (!ctx.trace) throw new Error("Drop Rate: the tree is read from the trace, and this Ctx has none");
  const state = ctx.state;
  const total = TotalStats(ctx, "Drop_Rarity"); // the one call (TRACKERS.dropRateV2, trackers/index.ts)
  const root = ctx.trace;
  const call = root.children.find((n) => n.block === "TotalStats" && "Drop_Rarity" === n.args[0] && "cached" !== n.note);
  if (!call) throw new Error('Drop Rate: no TotalStats("Drop_Rarity") call in the trace');
  const plain: Ctx = { ...ctx, trace: null }; // the adapter's own save reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const source = (id: string, fmt: "x" | "+"): Node => {
    const def = SOURCES[id];
    if (!def) throw new Error(`Drop Rate: no source "${id}" in the adapter`);
    const kept: Node[] = [];
    const t = takeFrom(call, used, kept, 'Drop Rate: TotalStats("Drop_Rarity")', id);
    const o = (block: string, ...args: (string | number)[]): number | undefined => {
      const n = findCall(call, block, args, used);
      if (!n) return undefined;
      used.add(n);
      kept.push(traceTree(n));
      return n.value;
    };
    const leaf = (name: string, val: number, note = READ) => (kept.push({ name, val, fmt: "raw", note }), val);
    const val = def.of({ t, o, leaf, c: plain });
    const note = typeof def.note === "function" ? def.note(plain, val) : def.note;
    return { name: def.name, val, fmt, ...(note ? { note } : {}), ...(kept.length ? { children: kept } : {}) };
  };

  const groups: Node[] = DR2_GROUPS.map((g) => {
    const items = g.sources.map((id) => source(id, g.kind === "mult" || g.kind === "replace" ? "x" : "+"));
    const fmt = g.kind === "add" ? "+" : g.kind === "replace" ? "raw" : "x";
    return { name: g.name, val: groupVal(g, items.map((i) => i.val)), fmt, note: g.note ? `${groupNote(g)} · ${g.note}` : groupNote(g), children: items };
  });

  const migrated = migratedNote(state);
  const tree: Node = { name: DR2_ROOT, val: total, fmt: "x", ...(migrated ? { note: migrated } : {}), children: groups };
  // One path for the number (spec section 4): the page's Biggest Gains rebuilds the total from the tree's values.
  const rebuilt = MODEL.totalFromFlat(flattenTree(tree));
  if (!near(rebuilt, total)) throw new TreeTotalMismatch(total, rebuilt);

  // reads that are no source but lead to a runtime: / assumed: note stay visible, under the root
  const extras = [...call.children, ...root.children.filter((n) => n !== call)].filter((n) => !used.has(n) && flagged(n)).map(traceTree);
  if (extras.length) tree.children = [...groups, ...extras];
  return { tree, total };
}

/** `computeArkhDropRateV2`'s counterpart on a built state: TotalStats("Drop_Rarity") once, with the trace on, and the tree read out of it. */
export const gameDropRate = (state: GameState, charIdx: number, mapIdx: number): StatResult => dropRateTree(makeCtx(state, { player: charIdx, map: mapIdx, trace: true }));

/** `computeArkhDropRateV2`'s counterpart: the envelope of a save, a character index and the map to compute on. */
export function computeGameDropRate(save: unknown, charIdx: number, mapIdx: number): StatResult {
  return gameDropRate(stateOf(save), charIdx, mapIdx);
}
